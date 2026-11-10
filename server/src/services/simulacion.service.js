/**
 * @file simulacion.service.js
 * @description Servicio para la gestión de lecturas y evaluaciones meteorológicas simuladas
 * con aislamiento estricto respecto a los datos reales (Prueba P11).
 *
 * REGLA INQUEBRANTABLE (P11):
 * - Las lecturas simuladas se registran con modalidad = 'simulada' y nunca leen ni alteran
 *   el nivel_vigente ni el contador_descenso del flujo real.
 * - Toda consulta o limpieza filtra estrictamente por modalidad.
 */

import { pool } from '../db/pool.js';
import { obtenerConfiguracionVigente } from './configuracion.service.js';
import { insertarLecturaMeteorologica } from './lecturas.service.js';
import { clasificarMuestra, obtenerNivelMayor } from '../engine/clasificar.js';
import {
  siguienteEstado,
  crearEstadoInicialMotor,
  derivarEstadoAlConsultar,
} from '../engine/estado.js';

export const AVISO_MODO_SIMULACION =
  'MODO SIMULACIÓN ACADÉMICA — NO ALTERA EL ESTADO REAL';
export const BANNER_SIMULACION =
  'DATOS SIMULADOS DE DEMOSTRACIÓN ACADÉMICA';

/**
 * Valida que la modalidad sea reconocida ('real' o 'simulada').
 *
 * @param {string} modalidad
 * @throws {Error} Si la modalidad no es válida
 */
function validarModalidad(modalidad) {
  if (modalidad !== 'real' && modalidad !== 'simulada') {
    throw new Error(
      `Modalidad inválida: "${modalidad}". Debe ser "real" o "simulada".`
    );
  }
}

/**
 * Obtiene la última evaluación registrada para la modalidad indicada,
 * aislando estrictamente los datos reales de los simulados.
 *
 * @param {Object} [opciones]
 * @param {string} [opciones.modalidad='real'] 'real' o 'simulada'
 * @param {Object} [opciones.db=pool] Cliente o Pool de PostgreSQL
 * @returns {Promise<Object|null>} Última evaluación con datos de lectura o null
 */
export async function obtenerUltimaEvaluacionPorModalidad({
  modalidad = 'real',
  db = pool,
} = {}) {
  validarModalidad(modalidad);

  const queryUltima = `
    SELECT 
      e.id AS evaluacion_id,
      e.lectura_id,
      e.configuracion_id,
      e.nivel_calculado,
      e.nivel_vigente,
      e.estado_sistema,
      e.contador_descenso,
      e.evaluada_en,
      l.modalidad,
      l.fuente,
      l.observado_en,
      l.intensidad_mm_h,
      l.acum_24h_mm,
      l.acum_72h_mm,
      l.horas_validas_24h,
      l.horas_validas_72h,
      l.estado AS estado_lectura,
      l.temperatura,
      l.humedad,
      l.viento
    FROM evaluaciones_nivel e
    JOIN lecturas_meteorologicas l ON l.id = e.lectura_id
    WHERE l.modalidad = $1
    ORDER BY l.observado_en DESC, e.id DESC
    LIMIT 1;
  `;

  const { rows } = await db.query(queryUltima, [modalidad]);
  if (!rows || rows.length === 0) {
    return null;
  }

  const fila = rows[0];
  let candidatoMaximo = null;

  // Si existe un descenso en curso (contador > 0), recuperar el candidato previo
  if (Number(fila.contador_descenso) > 0) {
    candidatoMaximo = fila.nivel_calculado;

    if (Number(fila.contador_descenso) > 1) {
      const queryAnterior = `
        SELECT e.nivel_calculado
        FROM evaluaciones_nivel e
        JOIN lecturas_meteorologicas l ON l.id = e.lectura_id
        WHERE l.modalidad = $1 AND e.id < $2 AND e.contador_descenso > 0
        ORDER BY e.id DESC
        LIMIT 1;
      `;
      const resAnterior = await db.query(queryAnterior, [
        modalidad,
        fila.evaluacion_id,
      ]);
      if (resAnterior.rows && resAnterior.rows.length > 0) {
        candidatoMaximo = obtenerNivelMayor(
          resAnterior.rows[0].nivel_calculado,
          fila.nivel_calculado
        );
      }
    }
  }

  return {
    evaluacion_id: Number(fila.evaluacion_id),
    lectura_id: Number(fila.lectura_id),
    configuracion_id: Number(fila.configuracion_id),
    modalidad: fila.modalidad,
    fuente: fila.fuente,
    observado_en: new Date(fila.observado_en).toISOString(),
    intensidad_mm_h:
      fila.intensidad_mm_h !== null ? Number(fila.intensidad_mm_h) : null,
    acum_24h_mm:
      fila.acum_24h_mm !== null ? Number(fila.acum_24h_mm) : null,
    acum_72h_mm:
      fila.acum_72h_mm !== null ? Number(fila.acum_72h_mm) : null,
    horas_validas_24h:
      fila.horas_validas_24h !== null ? Number(fila.horas_validas_24h) : null,
    horas_validas_72h:
      fila.horas_validas_72h !== null ? Number(fila.horas_validas_72h) : null,
    estado_lectura: fila.estado_lectura,
    nivel_calculado: fila.nivel_calculado,
    nivel_vigente: fila.nivel_vigente,
    estado_sistema: fila.estado_sistema,
    contador_descenso: Number(fila.contador_descenso),
    candidato_descenso_maximo: candidatoMaximo,
    evaluada_en: new Date(fila.evaluada_en).toISOString(),
  };
}

/**
 * Registra una lectura meteorológica simulada y ejecuta la máquina de estados
 * con aislamiento total respecto a la modalidad real.
 *
 * @param {Object} datosSimulados
 * @param {string|Date} datosSimulados.observado_en
 * @param {number|null} datosSimulados.intensidad_mm_h
 * @param {number|null} datosSimulados.acum_24h_mm
 * @param {number|null} datosSimulados.acum_72h_mm
 * @param {number} [datosSimulados.horas_validas_24h=24]
 * @param {number} [datosSimulados.horas_validas_72h=72]
 * @param {number|null} [datosSimulados.temperatura=null]
 * @param {number|null} [datosSimulados.humedad=null]
 * @param {number|null} [datosSimulados.viento=null]
 * @param {string} [datosSimulados.fuente='simulacion_academica']
 * @param {boolean} [datosSimulados.reiniciar_secuencia=false]
 * @param {Object} [opciones]
 * @param {Object} [opciones.db=pool]
 * @returns {Promise<Object>} Resultado de la simulación
 */
export async function registrarYEvaluarLecturaSimulada(
  datosSimulados = {},
  { db = pool } = {}
) {
  const datos = datosSimulados || {};

  // 1. Manejo de reinicio explícito (para que los presets rápidos muestren el nivel inmediato)
  if (
    datos.reiniciar_antes === true ||
    datos.reiniciar_escenario === true ||
    datos.modo_preset === true
  ) {
    await limpiarDatosSimulados({ db });
  }

  // 2. Normalización de campos numéricos y tolerancias de nombres
  const parseNum = (val) => {
    if (val === null || val === undefined || val === '') return null;
    const n = Number(val);
    return Number.isFinite(n) ? n : null;
  };

  const intensidad_mm_h = parseNum(datos.intensidad_mm_h ?? datos.intensidad);
  const acum_24h_mm = parseNum(
    datos.acum_24h_mm ?? datos.acum24h ?? datos.acumulado_24h
  );
  const acum_72h_mm = parseNum(
    datos.acum_72h_mm ?? datos.acum72h ?? datos.acumulado_72h
  );
  const horas_validas_24h = parseNum(datos.horas_validas_24h) ?? 24;
  const horas_validas_72h = parseNum(datos.horas_validas_72h) ?? 72;
  const temperatura = parseNum(datos.temperatura) ?? 14.5;
  const humedad = parseNum(datos.humedad) ?? 68;
  const viento = parseNum(datos.viento) ?? 9.2;
  const fuente = datos.fuente || 'simulacion_academica';

  // 3. Garantía de observado_en monotónico y sin colisión UNIQUE
  let observadoEn = datos.observado_en;

  if (!observadoEn) {
    const resMax = await db.query(
      `SELECT MAX(observado_en) AS ultimo FROM lecturas_meteorologicas WHERE modalidad = 'simulada'`
    );
    const ultimo = resMax.rows[0]?.ultimo;
    if (ultimo) {
      // Avanzar al menos 16 minutos tras la última lectura simulada
      const proximoMs = Math.max(Date.now(), new Date(ultimo).getTime() + 16 * 60 * 1000);
      observadoEn = new Date(proximoMs).toISOString();
    } else {
      observadoEn = new Date().toISOString();
    }
  } else {
    observadoEn = new Date(observadoEn).toISOString();
  }

  const datosNormalizados = {
    observado_en: observadoEn,
    intensidad_mm_h,
    acum_24h_mm,
    acum_72h_mm,
    horas_validas_24h,
    horas_validas_72h,
    temperatura,
    humedad,
    viento,
    fuente,
  };

  // 4. Obtener la configuración vigente de umbrales y reglas
  const configVigente = await obtenerConfiguracionVigente({ db });

  // 5. Clasificar muestra según umbrales vigentes
  const clasificacion = clasificarMuestra(datosNormalizados, configVigente);

  // 6. Determinar estado de la lectura para lecturas_meteorologicas
  let estadoLectura = 'valida';
  if (!clasificacion.muestra_valida) {
    estadoLectura = 'invalida';
  } else if (clasificacion.clasificacion_parcial) {
    estadoLectura = 'incompleta';
  }

  // 7. Insertar de forma idempotente la lectura forzando siempre modalidad = 'simulada'
  const { lectura: filaLectura } = await insertarLecturaMeteorologica(
    {
      modalidad: 'simulada',
      fuente,
      observado_en: observadoEn,
      intensidad_mm_h,
      acum_24h_mm,
      acum_72h_mm,
      horas_validas_24h,
      horas_validas_72h,
      estado: estadoLectura,
      temperatura,
      humedad,
      viento,
    },
    { db }
  );

  // 8. Si la muestra no es válida, retornar T5 sin registrar evaluación
  if (!clasificacion.muestra_valida) {
    return {
      ok: true,
      modalidad: 'simulada',
      aviso_simulacion: AVISO_MODO_SIMULACION,
      lectura: filaLectura,
      clasificacion,
      evaluacion: null,
      estado_motor: {
        transicion: 'T5_SIN_MUESTRA_VALIDA',
        evaluacion_creada: false,
        motivo: clasificacion.motivo_invalidez || 'MUESTRA_INVALIDA',
      },
    };
  }

  // 9. Obtener estado previo simulado (aislamiento estricto de modalidad = 'real')
  const estadoSimuladoPrevio =
    datos.reiniciar_secuencia === true ||
    datos.reiniciar_antes === true ||
    datos.reiniciar_escenario === true ||
    datos.modo_preset === true
      ? crearEstadoInicialMotor()
      : await obtenerUltimaEvaluacionPorModalidad({
          modalidad: 'simulada',
          db,
        });

  // 10. Evaluar siguiente estado en la máquina con histéresis
  const resultadoEstado = siguienteEstado(
    estadoSimuladoPrevio,
    {
      ...clasificacion,
      observado_en: filaLectura.observado_en,
    },
    configVigente
  );

  let filaEvaluacion = null;

  // 8. Si la transición crea una evaluación, persistir en evaluaciones_nivel
  if (resultadoEstado.evaluacion_creada === true) {
    const queryInsertEval = `
      INSERT INTO evaluaciones_nivel (
        lectura_id,
        configuracion_id,
        nivel_calculado,
        nivel_vigente,
        estado_sistema,
        contador_descenso,
        evaluada_en
      ) VALUES ($1, $2, $3, $4, $5, $6, now())
      ON CONFLICT (lectura_id, configuracion_id) DO UPDATE SET
        nivel_calculado = EXCLUDED.nivel_calculado,
        nivel_vigente = EXCLUDED.nivel_vigente,
        estado_sistema = EXCLUDED.estado_sistema,
        contador_descenso = EXCLUDED.contador_descenso,
        evaluada_en = EXCLUDED.evaluada_en
      RETURNING *;
    `;

    const resEval = await db.query(queryInsertEval, [
      filaLectura.id,
      configVigente.id,
      resultadoEstado.ultimo_nivel_calculado,
      resultadoEstado.nivel_vigente,
      resultadoEstado.estado_sistema,
      resultadoEstado.contador_descenso,
    ]);

    const evalRow = resEval.rows[0];
    filaEvaluacion = {
      id: Number(evalRow.id),
      lectura_id: Number(evalRow.lectura_id),
      configuracion_id: Number(evalRow.configuracion_id),
      nivel_calculado: evalRow.nivel_calculado,
      nivel_vigente: evalRow.nivel_vigente,
      estado_sistema: evalRow.estado_sistema,
      contador_descenso: Number(evalRow.contador_descenso),
      evaluada_en: new Date(evalRow.evaluada_en).toISOString(),
    };
  }

  return {
    ok: true,
    modalidad: 'simulada',
    aviso_simulacion: AVISO_MODO_SIMULACION,
    lectura: filaLectura,
    clasificacion,
    evaluacion: filaEvaluacion,
    estado_motor: resultadoEstado,
  };
}

/**
 * Consulta el estado derivado del sistema para la modalidad solicitada ('real' o 'simulada'),
 * aplicando la regla T6 (vencimiento P15) y preservando el aislamiento.
 *
 * @param {Object} [opciones]
 * @param {string} [opciones.modalidad='real'] 'real' o 'simulada'
 * @param {Date|string|number} [opciones.ahora=new Date()] Marca de tiempo de consulta
 * @param {Object} [opciones.db=pool]
 * @returns {Promise<Object>}
 */
export async function consultarEstadoPorModalidad({
  modalidad = 'real',
  ahora = new Date(),
  db = pool,
} = {}) {
  validarModalidad(modalidad);

  const configVigente = await obtenerConfiguracionVigente({ db });
  const ultimaEval = await obtenerUltimaEvaluacionPorModalidad({
    modalidad,
    db,
  });

  const estadoDerivado = derivarEstadoAlConsultar(ultimaEval, {
    ahora,
    t_max_minutos: configVigente?.parametros?.t_max_minutos ?? 60,
    modalidad,
  });

  return {
    ...estadoDerivado,
    es_simulacion: modalidad === 'simulada',
    banner_simulacion: modalidad === 'simulada' ? BANNER_SIMULACION : null,
  };
}

/**
 * Elimina todas las evaluaciones y lecturas meteorológicas en modalidad 'simulada',
 * sin afectar jamás ninguna fila con modalidad 'real'.
 *
 * @param {Object} [opciones]
 * @param {Object} [opciones.db=pool]
 * @returns {Promise<{ ok: boolean, mensaje: string, evaluaciones_eliminadas: number, lecturas_eliminadas: number }>}
 */
export async function limpiarDatosSimulados({ db = pool } = {}) {
  // 1. Eliminar evaluaciones asociadas a lecturas simuladas
  const delEval = await db.query(`
    DELETE FROM evaluaciones_nivel
    WHERE lectura_id IN (
      SELECT id FROM lecturas_meteorologicas WHERE modalidad = 'simulada'
    );
  `);

  // 2. Eliminar lecturas simuladas
  const delLecturas = await db.query(`
    DELETE FROM lecturas_meteorologicas
    WHERE modalidad = 'simulada';
  `);

  return {
    ok: true,
    mensaje: 'Datos simulados limpiados exitosamente',
    evaluaciones_eliminadas: delEval.rowCount ?? 0,
    lecturas_eliminadas: delLecturas.rowCount ?? 0,
  };
}

export default {
  AVISO_MODO_SIMULACION,
  BANNER_SIMULACION,
  obtenerUltimaEvaluacionPorModalidad,
  registrarYEvaluarLecturaSimulada,
  consultarEstadoPorModalidad,
  limpiarDatosSimulados,
};
