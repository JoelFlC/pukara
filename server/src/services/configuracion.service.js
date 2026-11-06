/**
 * @file configuracion.service.js
 * @description Servicio para la consulta, versionado inmutable, activación y auditoría
 * de la configuración de reglas y umbrales en PUKARA (Pruebas P05 y P16).
 *
 * REGLA INQUEBRANTABLE (P05 / P16):
 * - Las configuraciones son inmutables: al modificar umbrales se crea una nueva versión.
 * - Al activar una versión, se archiva la anterior y se reinicia el contador de descenso.
 * - Las evaluaciones pasadas conservan su versión y NUNCA se recalculan.
 * - Se exige doble candado de validación estricta antes de persistir o activar.
 */

import { pool } from '../db/pool.js';
import {
  validarConfiguracionCompleta,
  ConfiguracionInvalidaError,
} from '../engine/validarConfiguracion.js';

export const PARAMETROS_DEFECTO_S1 = Object.freeze({
  t_max_minutos: 60,
  separacion_minima_minutos: 15,
  muestras_descenso: 2,
  saturacion: Object.freeze({
    habilitada: true,
    acum_72h_min_mm: 60,
    intensidad_min_mm_h: 2.5,
    nivel_minimo: 'ALERTA',
  }),
});

/**
 * Normaliza los parámetros de configuración de reglas asegurando valores numéricos
 * y estructura segura con fallback a los ratificados en Semana 1.
 *
 * @param {Object|null|undefined} rawParametros
 * @returns {Object} Parámetros normalizados
 */
export function normalizarParametrosReglas(rawParametros = {}) {
  const p = rawParametros || {};
  const sat = p.saturacion || {};

  return {
    t_max_minutos:
      p.t_max_minutos !== undefined && !Number.isNaN(Number(p.t_max_minutos))
        ? Number(p.t_max_minutos)
        : PARAMETROS_DEFECTO_S1.t_max_minutos,
    separacion_minima_minutos:
      p.separacion_minima_minutos !== undefined &&
      !Number.isNaN(Number(p.separacion_minima_minutos))
        ? Number(p.separacion_minima_minutos)
        : PARAMETROS_DEFECTO_S1.separacion_minima_minutos,
    muestras_descenso:
      p.muestras_descenso !== undefined &&
      !Number.isNaN(Number(p.muestras_descenso))
        ? Number(p.muestras_descenso)
        : PARAMETROS_DEFECTO_S1.muestras_descenso,
    saturacion: {
      habilitada:
        sat.habilitada === undefined
          ? PARAMETROS_DEFECTO_S1.saturacion.habilitada
          : Boolean(sat.habilitada),
      acum_72h_min_mm:
        sat.acum_72h_min_mm !== undefined &&
        !Number.isNaN(Number(sat.acum_72h_min_mm))
          ? Number(sat.acum_72h_min_mm)
          : PARAMETROS_DEFECTO_S1.saturacion.acum_72h_min_mm,
      intensidad_min_mm_h:
        sat.intensidad_min_mm_h !== undefined &&
        !Number.isNaN(Number(sat.intensidad_min_mm_h))
          ? Number(sat.intensidad_min_mm_h)
          : PARAMETROS_DEFECTO_S1.saturacion.intensidad_min_mm_h,
      nivel_minimo:
        sat.nivel_minimo || PARAMETROS_DEFECTO_S1.saturacion.nivel_minimo,
    },
  };
}

/**
 * Resuelve el ID del usuario administrador o el primer usuario del sistema para bitácora.
 *
 * @param {number|string|null} usuarioId
 * @param {Object} db
 * @returns {Promise<number>}
 */
async function resolverUsuarioAdmin(usuarioId, db) {
  if (usuarioId !== null && usuarioId !== undefined) {
    return Number(usuarioId);
  }
  const resAdmin = await db.query(
    "SELECT id FROM usuarios WHERE rol = 'administrador' ORDER BY id ASC LIMIT 1;"
  );
  if (resAdmin.rows.length > 0) {
    return Number(resAdmin.rows[0].id);
  }
  const resFallback = await db.query(
    'SELECT id FROM usuarios ORDER BY id ASC LIMIT 1;'
  );
  if (resFallback.rows.length > 0) {
    return Number(resFallback.rows[0].id);
  }
  return 1;
}

/**
 * Obtiene la configuración de reglas actualmente vigente en la base de datos
 * junto con sus umbrales asociados, con parámetros normalizados.
 *
 * @param {Object} [opciones]
 * @param {Object} [opciones.db=pool] Cliente o pool de base de datos
 * @returns {Promise<Object|null>} Configuración vigente o null si no existe
 */
export async function obtenerConfiguracionVigente({ db = pool } = {}) {
  const configRes = await db.query(
    "SELECT * FROM configuraciones_reglas WHERE estado = 'vigente' LIMIT 1;"
  );

  if (configRes.rows.length === 0) {
    return null;
  }

  const fila = configRes.rows[0];

  const umbralesRes = await db.query(
    'SELECT variable, nivel, valor FROM umbrales WHERE configuracion_id = $1 ORDER BY variable ASC, valor ASC;',
    [fila.id]
  );

  const umbrales = umbralesRes.rows.map((u) => ({
    variable: u.variable,
    nivel: u.nivel,
    valor: Number(u.valor),
  }));

  const parametros = normalizarParametrosReglas(fila.parametros);

  return {
    id: Number(fila.id),
    version: Number(fila.version),
    estado: fila.estado,
    parametros,
    umbrales,
    creada_por: fila.creada_por ? Number(fila.creada_por) : null,
    creada_en: fila.creada_en,
    activada_en: fila.activada_en,
    motivo: fila.motivo,
  };
}

/**
 * Crea una nueva versión inmutable de configuración de reglas y sus 9 umbrales (P05/P16).
 *
 * @param {Object} opciones
 * @param {Array<Object>|Object} opciones.umbrales 9 umbrales requeridos
 * @param {Object} [opciones.parametros={}] Parámetros temporales y de saturación
 * @param {string|null} [opciones.motivo=null] Justificación del cambio
 * @param {number|null} [opciones.usuarioId=null] ID del usuario autor
 * @param {string} [opciones.estadoInicial='borrador'] 'borrador' o 'vigente'
 * @param {Object} [opciones.db=pool]
 * @returns {Promise<Object>} Nueva versión creada
 */
export async function crearVersionConfiguracion({
  umbrales,
  parametros = {},
  motivo = null,
  usuarioId = null,
  estadoInicial = 'borrador',
  db = pool,
} = {}) {
  // 1. Candado de validación pura matemática y estructural (P16)
  const validacion = validarConfiguracionCompleta({ umbrales, parametros });
  if (!validacion.valida) {
    throw new ConfiguracionInvalidaError(
      'La configuración de reglas es inválida.',
      validacion.errores
    );
  }

  const usuarioIdResuelto = await resolverUsuarioAdmin(usuarioId, db);

  // 2. Manejo transaccional para atomicidad e inmutabilidad
  const cliente = typeof db.connect === 'function' ? await db.connect() : db;
  const debeLiberar = typeof db.connect === 'function';

  try {
    await cliente.query('BEGIN');

    // Siguiente número de versión correlativa
    const versionRes = await cliente.query(
      'SELECT COALESCE(MAX(version), 0) + 1 AS siguiente_version FROM configuraciones_reglas;'
    );
    const siguienteVersion = Number(versionRes.rows[0].siguiente_version);

    // Insertar fila en configuraciones_reglas siempre como 'borrador' inicialmente
    const insertConfigSql = `
      INSERT INTO configuraciones_reglas (version, estado, parametros, creada_por, motivo)
      VALUES ($1, 'borrador', $2, $3, $4)
      RETURNING *;
    `;
    const configRes = await cliente.query(insertConfigSql, [
      siguienteVersion,
      JSON.stringify(validacion.parametros_normalizados),
      usuarioIdResuelto,
      motivo,
    ]);
    const nuevaConfig = configRes.rows[0];

    // Insertar exactamente los 9 umbrales
    const insertUmbralSql = `
      INSERT INTO umbrales (configuracion_id, variable, nivel, valor)
      VALUES ($1, $2, $3, $4);
    `;
    for (const u of validacion.umbrales_lista) {
      await cliente.query(insertUmbralSql, [
        nuevaConfig.id,
        u.variable,
        u.nivel,
        u.valor,
      ]);
    }

    // Registrar en bitacora_cambios
    const insertBitacoraSql = `
      INSERT INTO bitacora_cambios (usuario_id, entidad, entidad_id, accion, valor_anterior, valor_nuevo)
      VALUES ($1, 'configuraciones_reglas', $2, 'crear', NULL, $3);
    `;
    await cliente.query(insertBitacoraSql, [
      usuarioIdResuelto,
      nuevaConfig.id,
      JSON.stringify({
        version: siguienteVersion,
        estado: 'borrador',
        motivo,
        parametros: validacion.parametros_normalizados,
        umbrales: validacion.umbrales_normalizados,
      }),
    ]);

    await cliente.query('COMMIT');

    // Si se solicitó activación inmediata, delegar en activarVersionConfiguracion
    if (estadoInicial === 'vigente') {
      return await activarVersionConfiguracion({
        configuracionId: Number(nuevaConfig.id),
        usuarioId: usuarioIdResuelto,
        motivo,
        db,
      });
    }

    return {
      id: Number(nuevaConfig.id),
      version: siguienteVersion,
      estado: 'borrador',
      motivo: nuevaConfig.motivo,
      creada_por: Number(usuarioIdResuelto),
      creada_en: new Date(nuevaConfig.creada_en).toISOString(),
      activada_en: null,
      parametros: validacion.parametros_normalizados,
      umbrales: validacion.umbrales_lista,
      umbrales_mapa: validacion.umbrales_normalizados,
    };
  } catch (err) {
    await cliente.query('ROLLBACK');
    throw err;
  } finally {
    if (debeLiberar) cliente.release();
  }
}

/**
 * Activa una versión existente de configuración archivando la vigente actual
 * y garantizando la regla de reinicio de contador de descenso (P05/P16).
 *
 * @param {Object} opciones
 * @param {number|string} opciones.configuracionId ID de la configuración a activar
 * @param {number|null} [opciones.usuarioId=null]
 * @param {string|null} [opciones.motivo=null]
 * @param {Object} [opciones.db=pool]
 * @returns {Promise<Object>} Configuración vigente activada con contador_descenso_reiniciado: true
 */
export async function activarVersionConfiguracion({
  configuracionId,
  usuarioId = null,
  motivo = null,
  db = pool,
} = {}) {
  if (!configuracionId) {
    throw new Error('Parámetro requerido: configuracionId es obligatorio.');
  }

  // 1. Obtener la configuración objetivo
  const configObjRes = await db.query(
    'SELECT * FROM configuraciones_reglas WHERE id = $1;',
    [configuracionId]
  );
  if (configObjRes.rows.length === 0) {
    const err = new Error(
      `Configuración con ID ${configuracionId} no encontrada.`
    );
    err.statusCode = 404;
    throw err;
  }
  const configObjetivo = configObjRes.rows[0];

  // 2. Cargar los umbrales de la configuración objetivo
  const umbralesRes = await db.query(
    'SELECT variable, nivel, valor FROM umbrales WHERE configuracion_id = $1;',
    [configuracionId]
  );
  const umbralesLista = umbralesRes.rows.map((u) => ({
    variable: u.variable,
    nivel: u.nivel,
    valor: Number(u.valor),
  }));

  // 3. Doble Candado P16: Verificar integridad matemática antes de activar
  const validacion = validarConfiguracionCompleta({
    umbrales: umbralesLista,
    parametros: configObjetivo.parametros,
  });
  if (!validacion.valida) {
    throw new ConfiguracionInvalidaError(
      `La configuración ${configuracionId} no cumple las reglas matemáticas requeridas para ser activada.`,
      validacion.errores
    );
  }

  const usuarioIdResuelto = await resolverUsuarioAdmin(usuarioId, db);

  // 4. Transacción atómica de activación
  const cliente = typeof db.connect === 'function' ? await db.connect() : db;
  const debeLiberar = typeof db.connect === 'function';

  try {
    await cliente.query('BEGIN');

    // Obtener la configuración vigente anterior para auditoría
    const vigenteActualRes = await cliente.query(
      "SELECT * FROM configuraciones_reglas WHERE estado = 'vigente' LIMIT 1;"
    );

    let valorAnterior = null;
    if (vigenteActualRes.rows.length > 0) {
      const vig = vigenteActualRes.rows[0];
      const umbralesVigRes = await cliente.query(
        'SELECT variable, nivel, valor FROM umbrales WHERE configuracion_id = $1;',
        [vig.id]
      );
      valorAnterior = {
        configuracion_id: Number(vig.id),
        version: Number(vig.version),
        estado: 'vigente',
        parametros: vig.parametros,
        umbrales: umbralesVigRes.rows.map((u) => ({
          variable: u.variable,
          nivel: u.nivel,
          valor: Number(u.valor),
        })),
      };
    }

    // Archivar cualquier configuración vigente actual (excepto la misma si ya lo fuera)
    await cliente.query(
      "UPDATE configuraciones_reglas SET estado = 'archivada' WHERE estado = 'vigente' AND id <> $1;",
      [configuracionId]
    );

    // Activar la nueva configuración
    const updateActivarSql = `
      UPDATE configuraciones_reglas
      SET estado = 'vigente',
          activada_en = now(),
          motivo = COALESCE($2, motivo)
      WHERE id = $1
      RETURNING *;
    `;
    const resActivada = await cliente.query(updateActivarSql, [
      configuracionId,
      motivo,
    ]);
    const activadaRow = resActivada.rows[0];

    // Registrar en bitácora de auditoría
    const valorNuevo = {
      configuracion_id: Number(configuracionId),
      version: Number(activadaRow.version),
      estado: 'vigente',
      contador_descenso_reiniciado: true,
      motivo: activadaRow.motivo,
      parametros: validacion.parametros_normalizados,
      umbrales: validacion.umbrales_normalizados,
    };

    const insertBitacoraSql = `
      INSERT INTO bitacora_cambios (usuario_id, entidad, entidad_id, accion, valor_anterior, valor_nuevo)
      VALUES ($1, 'configuraciones_reglas', $2, 'activar', $3, $4);
    `;
    await cliente.query(insertBitacoraSql, [
      usuarioIdResuelto,
      configuracionId,
      valorAnterior ? JSON.stringify(valorAnterior) : null,
      JSON.stringify(valorNuevo),
    ]);

    await cliente.query('COMMIT');

    return {
      id: Number(activadaRow.id),
      version: Number(activadaRow.version),
      estado: 'vigente',
      motivo: activadaRow.motivo,
      creada_por: Number(activadaRow.creada_por),
      creada_en: new Date(activadaRow.creada_en).toISOString(),
      activada_en: new Date(activadaRow.activada_en).toISOString(),
      parametros: validacion.parametros_normalizados,
      umbrales: validacion.umbrales_lista,
      umbrales_mapa: validacion.umbrales_normalizados,
      contador_descenso_reiniciado: true,
    };
  } catch (err) {
    await cliente.query('ROLLBACK');
    throw err;
  } finally {
    if (debeLiberar) cliente.release();
  }
}

/**
 * Lista todas las versiones de configuraciones_reglas ordenadas por version DESC
 * junto con sus umbrales asociados y autor.
 *
 * @param {Object} [opciones]
 * @param {Object} [opciones.db=pool]
 * @returns {Promise<Array<Object>>}
 */
export async function listarVersionesConfiguracion({ db = pool } = {}) {
  const querySql = `
    SELECT 
      c.id,
      c.version,
      c.estado,
      c.parametros,
      c.motivo,
      c.creada_en,
      c.activada_en,
      u.id AS usuario_id,
      u.nombre AS autor_nombre,
      u.email AS autor_email
    FROM configuraciones_reglas c
    LEFT JOIN usuarios u ON u.id = c.creada_por
    ORDER BY c.version DESC;
  `;

  const configRes = await db.query(querySql);
  const versiones = [];

  for (const fila of configRes.rows) {
    const umbralesRes = await db.query(
      'SELECT variable, nivel, valor FROM umbrales WHERE configuracion_id = $1 ORDER BY variable ASC, valor ASC;',
      [fila.id]
    );

    versiones.push({
      id: Number(fila.id),
      version: Number(fila.version),
      estado: fila.estado,
      motivo: fila.motivo,
      parametros: normalizarParametrosReglas(fila.parametros),
      umbrales: umbralesRes.rows.map((u) => ({
        variable: u.variable,
        nivel: u.nivel,
        valor: Number(u.valor),
      })),
      autor: fila.usuario_id
        ? {
            id: Number(fila.usuario_id),
            nombre: fila.autor_nombre,
            email: fila.autor_email,
          }
        : null,
      creada_en: fila.creada_en
        ? new Date(fila.creada_en).toISOString()
        : null,
      activada_en: fila.activada_en
        ? new Date(fila.activada_en).toISOString()
        : null,
    });
  }

  return versiones;
}

export default {
  PARAMETROS_DEFECTO_S1,
  normalizarParametrosReglas,
  obtenerConfiguracionVigente,
  crearVersionConfiguracion,
  activarVersionConfiguracion,
  listarVersionesConfiguracion,
};
