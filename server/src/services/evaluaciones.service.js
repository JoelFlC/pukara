/**
 * @file evaluaciones.service.js
 * @description Orquestador del motor de reglas de PUKARA para evaluar lecturas meteorológicas
 * con la configuración vigente, persistir evaluaciones idempotentes en PostgreSQL y
 * consultar el historial de evaluaciones por modalidad ('real' o 'simulada').
 *
 * REGLAS INQUEBRANTABLES:
 * - Aislamiento estricto de modalidad (P11): las consultas e inserciones filtran por modalidad.
 * - Idempotencia: una combinación (lectura_id, configuracion_id) solo genera una fila.
 * - Inmutabilidad histórica (P05): jamás se recalcula ni actualiza una evaluación pasada.
 */

import { pool } from '../db/pool.js';
import { obtenerConfiguracionVigente } from './configuracion.service.js';
import {
  consultarYRegistrarLecturaReal,
  obtenerUltimaLecturaRegistrada,
} from './lecturas.service.js';
import { clasificarMuestra } from '../engine/clasificar.js';
import {
  siguienteEstado,
  crearEstadoInicialMotor,
  derivarEstadoAlConsultar,
} from '../engine/estado.js';
import { obtenerUltimaEvaluacionPorModalidad } from './simulacion.service.js';

/**
 * Valida que la modalidad sea reconocida ('real' o 'simulada').
 *
 * @param {string} modalidad
 */
function validarModalidad(modalidad) {
  if (modalidad !== 'real' && modalidad !== 'simulada') {
    const err = new Error(
      `Modalidad inválida: "${modalidad}". Debe ser "real" o "simulada".`
    );
    err.statusCode = 400;
    throw err;
  }
}

/**
 * Evalúa una lectura meteorológica específica con la configuración vigente
 * e inserta la evaluación correspondiente de forma idempotente.
 *
 * @param {Object} lectura Fila de lecturas_meteorologicas
 * @param {Object} [opciones]
 * @param {Object} [opciones.db=pool]
 * @returns {Promise<Object>} Resultado de la evaluación
 */
export async function evaluarLecturaConConfiguracionVigente(
  lectura,
  { db = pool } = {}
) {
  if (!lectura || !lectura.id) {
    return {
      evaluacion: null,
      clasificacion: null,
      estado_motor: null,
      ya_existia: false,
      motivo: 'SIN_LECTURA',
    };
  }

  const configVigente = await obtenerConfiguracionVigente({ db });
  if (!configVigente) {
    throw new Error('No existe una configuración de reglas vigente en el sistema.');
  }

  // 1. Idempotencia en BD: comprobar si ya fue evaluada con esta configuración
  const checkSql = `
    SELECT * FROM evaluaciones_nivel
    WHERE lectura_id = $1 AND configuracion_id = $2
    LIMIT 1;
  `;
  const resExistente = await db.query(checkSql, [lectura.id, configVigente.id]);

  if (resExistente.rows.length > 0) {
    const fila = resExistente.rows[0];
    const clasificacion = clasificarMuestra(lectura, configVigente);
    return {
      evaluacion: {
        id: Number(fila.id),
        lectura_id: Number(fila.lectura_id),
        configuracion_id: Number(fila.configuracion_id),
        nivel_calculado: fila.nivel_calculado,
        nivel_vigente: fila.nivel_vigente,
        estado_sistema: fila.estado_sistema,
        contador_descenso: Number(fila.contador_descenso),
        evaluada_en: new Date(fila.evaluada_en).toISOString(),
      },
      clasificacion,
      estado_motor: null,
      ya_existia: true,
    };
  }

  // 2. Clasificar muestra según umbrales de la configuración vigente
  const clasificacion = clasificarMuestra(lectura, configVigente);

  // Regla T5: Muestra inválida no genera evaluación ni altera contador
  if (!clasificacion.muestra_valida) {
    return {
      evaluacion: null,
      clasificacion,
      estado_motor: null,
      ya_existia: false,
      motivo: clasificacion.motivo_invalidez || 'MUESTRA_INVALIDA',
    };
  }

  // 3. Obtener la última evaluación previa de la misma modalidad
  const modalidad = lectura.modalidad || 'real';
  const queryPrev = `
    SELECT e.*, l.observado_en
    FROM evaluaciones_nivel e
    JOIN lecturas_meteorologicas l ON l.id = e.lectura_id
    WHERE l.modalidad = $1 AND l.id <> $2
    ORDER BY l.observado_en DESC, e.id DESC
    LIMIT 1;
  `;
  const resPrev = await db.query(queryPrev, [modalidad, lectura.id]);
  const prevFila = resPrev.rows[0] || null;

  let estadoPrevio = null;
  if (prevFila) {
    estadoPrevio = {
      nivel_vigente: prevFila.nivel_vigente,
      estado_sistema: prevFila.estado_sistema,
      ultimo_nivel_calculado: prevFila.nivel_calculado,
      contador_descenso: Number(prevFila.contador_descenso),
      configuracion_id: Number(prevFila.configuracion_id),
      ultimo_observado_en: prevFila.observado_en,
      candidato_descenso_maximo:
        Number(prevFila.contador_descenso) > 0
          ? prevFila.nivel_calculado
          : null,
    };
  } else {
    estadoPrevio = crearEstadoInicialMotor();
  }

  // 4. Evaluar transición de la máquina de estados con histéresis y versión
  const estadoMotor = siguienteEstado(
    estadoPrevio,
    {
      ...clasificacion,
      observado_en: lectura.observado_en,
    },
    configVigente
  );

  // Si la muestra fue ignorada (no independiente)
  if (estadoMotor.evaluacion_creada === false) {
    return {
      evaluacion: prevFila
        ? {
            id: Number(prevFila.id),
            lectura_id: Number(prevFila.lectura_id),
            configuracion_id: Number(prevFila.configuracion_id),
            nivel_calculado: prevFila.nivel_calculado,
            nivel_vigente: prevFila.nivel_vigente,
            estado_sistema: prevFila.estado_sistema,
            contador_descenso: Number(prevFila.contador_descenso),
            evaluada_en: new Date(prevFila.evaluada_en).toISOString(),
          }
        : null,
      clasificacion,
      estado_motor: estadoMotor,
      ya_existia: false,
      motivo: estadoMotor.transicion,
    };
  }

  // 5. Persistir la nueva evaluación de forma atómica
  const insertEvalSql = `
    INSERT INTO evaluaciones_nivel (
      lectura_id,
      configuracion_id,
      nivel_calculado,
      nivel_vigente,
      estado_sistema,
      contador_descenso,
      evaluada_en
    ) VALUES ($1, $2, $3, $4, $5, $6, now())
    ON CONFLICT (lectura_id, configuracion_id) DO NOTHING
    RETURNING *;
  `;

  const resInsert = await db.query(insertEvalSql, [
    lectura.id,
    configVigente.id,
    estadoMotor.ultimo_nivel_calculado,
    estadoMotor.nivel_vigente,
    estadoMotor.estado_sistema,
    estadoMotor.contador_descenso,
  ]);

  let evalRow = resInsert.rows[0];
  if (!evalRow) {
    const fetchExistente = await db.query(checkSql, [
      lectura.id,
      configVigente.id,
    ]);
    evalRow = fetchExistente.rows[0];
  }

  const filaEvaluacion = {
    id: Number(evalRow.id),
    lectura_id: Number(evalRow.lectura_id),
    configuracion_id: Number(evalRow.configuracion_id),
    nivel_calculado: evalRow.nivel_calculado,
    nivel_vigente: evalRow.nivel_vigente,
    estado_sistema: evalRow.estado_sistema,
    contador_descenso: Number(evalRow.contador_descenso),
    evaluada_en: new Date(evalRow.evaluada_en).toISOString(),
  };

  return {
    evaluacion: filaEvaluacion,
    clasificacion,
    estado_motor: estadoMotor,
    ya_existia: false,
  };
}

/**
 * Orquesta la consulta y evaluación de la última lectura meteorológica,
 * derivando el estado al instante actual de consulta.
 *
 * @param {Object} [opciones]
 * @param {string} [opciones.modalidad='real']
 * @param {boolean} [opciones.forzarConsultaExterna=false]
 * @param {Date|string|number} [opciones.ahora=new Date()]
 * @param {Function} [opciones.fetcher]
 * @param {Object} [opciones.db=pool]
 * @param {boolean} [opciones.usarSoloBaseDatos=false]
 * @returns {Promise<Object>}
 */
export async function evaluarUltimaLectura({
  modalidad = 'real',
  forzarConsultaExterna = false,
  ahora = new Date(),
  fetcher,
  db = pool,
  usarSoloBaseDatos = false,
} = {}) {
  validarModalidad(modalidad);

  const configVigente = await obtenerConfiguracionVigente({ db });
  let lectura = null;
  let resEvaluacion = null;

  if (modalidad === 'real') {
    if (usarSoloBaseDatos) {
      lectura =
        (await obtenerUltimaLecturaRegistrada({
          modalidad: 'real',
          db,
          soloClasificables: true,
        })) ||
        (await obtenerUltimaLecturaRegistrada({ modalidad: 'real', db }));
    } else {
      const ahoraMs =
        ahora instanceof Date
          ? ahora.getTime()
          : typeof ahora === 'number'
            ? ahora
            : Date.parse(ahora);

      const resConsulta = await consultarYRegistrarLecturaReal({
        forzarConsultaExterna,
        ahoraFn: () => ahoraMs,
        consultarMeteoFn: fetcher,
        db,
      });
      lectura =
        resConsulta?.lectura ||
        (await obtenerUltimaLecturaRegistrada({ modalidad: 'real', db }));
    }

    if (lectura) {
      resEvaluacion = await evaluarLecturaConConfiguracionVigente(lectura, {
        db,
      });
    }

    const ultimaEval = await obtenerUltimaEvaluacionPorModalidad({
      modalidad: 'real',
      db,
    });

    const estadoDerivado = derivarEstadoAlConsultar(ultimaEval, {
      ahora,
      t_max_minutos: configVigente?.parametros?.t_max_minutos ?? 60,
      modalidad: 'real',
    });

    return {
      modalidad: 'real',
      configuracion: configVigente,
      lectura,
      evaluacion: ultimaEval,
      clasificacion: resEvaluacion?.clasificacion || null,
      estado_actual: estadoDerivado,
    };
  }

  // Modalidad simulada
  lectura = await obtenerUltimaLecturaRegistrada({
    modalidad: 'simulada',
    db,
  });

  if (lectura) {
    resEvaluacion = await evaluarLecturaConConfiguracionVigente(lectura, {
      db,
    });
  }

  const ultimaEvalSim = await obtenerUltimaEvaluacionPorModalidad({
    modalidad: 'simulada',
    db,
  });

  const estadoDerivado = derivarEstadoAlConsultar(ultimaEvalSim, {
    ahora,
    t_max_minutos: configVigente?.parametros?.t_max_minutos ?? 60,
    modalidad: 'simulada',
  });

  return {
    modalidad: 'simulada',
    configuracion: configVigente,
    lectura,
    evaluacion: ultimaEvalSim,
    clasificacion: resEvaluacion?.clasificacion || null,
    estado_actual: estadoDerivado,
  };
}

/**
 * Consulta el historial paginado de evaluaciones para la modalidad indicada.
 *
 * @param {Object} [opciones]
 * @param {string} [opciones.modalidad='real']
 * @param {number|string} [opciones.limite=20]
 * @param {number|string} [opciones.offset=0]
 * @param {Object} [opciones.db=pool]
 * @returns {Promise<Object>} Historial paginado
 */
export async function obtenerHistorialEvaluaciones({
  modalidad = 'real',
  limite = 20,
  offset = 0,
  db = pool,
} = {}) {
  validarModalidad(modalidad);

  const lim = Math.max(1, Math.min(100, Number.parseInt(limite, 10) || 20));
  const off = Math.max(0, Number.parseInt(offset, 10) || 0);

  const countRes = await db.query(
    `SELECT COUNT(*)::int AS total
     FROM evaluaciones_nivel e
     JOIN lecturas_meteorologicas l ON l.id = e.lectura_id
     WHERE l.modalidad = $1;`,
    [modalidad]
  );
  const total = countRes.rows[0]?.total ?? 0;

  const queryItems = `
    SELECT 
      e.id AS evaluacion_id,
      e.lectura_id,
      e.configuracion_id,
      e.nivel_calculado,
      e.nivel_vigente,
      e.estado_sistema,
      e.contador_descenso,
      e.evaluada_en,
      c.version AS version_reglas,
      l.modalidad,
      l.fuente,
      l.observado_en,
      l.intensidad_mm_h,
      l.acum_24h_mm,
      l.acum_72h_mm,
      l.horas_validas_24h,
      l.horas_validas_72h,
      l.estado AS estado_lectura
    FROM evaluaciones_nivel e
    JOIN lecturas_meteorologicas l ON l.id = e.lectura_id
    JOIN configuraciones_reglas c ON c.id = e.configuracion_id
    WHERE l.modalidad = $1
    ORDER BY l.observado_en DESC, e.id DESC
    LIMIT $2 OFFSET $3;
  `;

  const itemsRes = await db.query(queryItems, [modalidad, lim, off]);

  const items = itemsRes.rows.map((fila) => ({
    evaluacion_id: Number(fila.evaluacion_id),
    lectura_id: Number(fila.lectura_id),
    configuracion_id: Number(fila.configuracion_id),
    version_reglas: Number(fila.version_reglas),
    observado_en: new Date(fila.observado_en).toISOString(),
    evaluada_en: new Date(fila.evaluada_en).toISOString(),
    modalidad: fila.modalidad,
    fuente: fila.fuente,
    nivel_calculado: fila.nivel_calculado,
    nivel_vigente: fila.nivel_vigente,
    estado_sistema: fila.estado_sistema,
    contador_descenso: Number(fila.contador_descenso),
    variables: {
      intensidad_mm_h:
        fila.intensidad_mm_h !== null ? Number(fila.intensidad_mm_h) : null,
      acum_24h_mm:
        fila.acum_24h_mm !== null ? Number(fila.acum_24h_mm) : null,
      acum_72h_mm:
        fila.acum_72h_mm !== null ? Number(fila.acum_72h_mm) : null,
      horas_validas_24h:
        fila.horas_validas_24h !== null
          ? Number(fila.horas_validas_24h)
          : null,
      horas_validas_72h:
        fila.horas_validas_72h !== null
          ? Number(fila.horas_validas_72h)
          : null,
      estado_lectura: fila.estado_lectura,
    },
  }));

  return {
    modalidad,
    total,
    limite: lim,
    offset: off,
    items,
  };
}

export default {
  evaluarLecturaConConfiguracionVigente,
  evaluarUltimaLectura,
  obtenerHistorialEvaluaciones,
};
