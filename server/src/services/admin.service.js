/**
 * @file admin.service.js
 * @description Servicio de administración integral de PUKARA:
 * - Versionado y activación de reglas y umbrales (P05 / P16)
 * - CRUD versionado de recomendaciones preventivas
 * - Gestión de contactos de emergencia
 * - Edición de atributos descriptivos y de verificación de capas cartográficas
 * - Consulta y registro auditable en bitacora_cambios
 */

import { pool } from '../db/pool.js';
import {
  listarVersionesConfiguracion,
  obtenerConfiguracionVigente,
  crearVersionConfiguracion,
  activarVersionConfiguracion,
} from './configuracion.service.js';
import {
  validarConfiguracionCompleta,
  ConfiguracionInvalidaError,
} from '../engine/validarConfiguracion.js';
import {
  registrarYEvaluarLecturaSimulada,
  limpiarDatosSimulados,
} from './simulacion.service.js';

/**
 * Inserta un registro de auditoría en la tabla bitacora_cambios.
 *
 * @param {import('pg').PoolClient|import('pg').Pool} client
 * @param {Object} datos
 * @param {number|string} datos.usuario_id
 * @param {string} datos.entidad
 * @param {number|string} datos.entidad_id
 * @param {string} datos.accion
 * @param {any} [datos.valor_anterior=null]
 * @param {any} [datos.valor_nuevo=null]
 * @returns {Promise<Object>} Registro insertado en bitácora
 */
export async function registrarEnBitacora(client, {
  usuario_id,
  entidad,
  entidad_id,
  accion,
  valor_anterior = null,
  valor_nuevo = null,
}) {
  const query = `
    INSERT INTO bitacora_cambios (
      usuario_id, entidad, entidad_id, accion, valor_anterior, valor_nuevo, ocurrido_en
    ) VALUES ($1, $2, $3, $4, $5, $6, NOW())
    RETURNING *;
  `;

  const res = await client.query(query, [
    Number(usuario_id),
    entidad,
    Number(entidad_id) || 0,
    accion,
    valor_anterior !== null && valor_anterior !== undefined
      ? JSON.stringify(valor_anterior)
      : null,
    valor_nuevo !== null && valor_nuevo !== undefined
      ? JSON.stringify(valor_nuevo)
      : null,
  ]);

  return res.rows[0];
}

// ===========================================================================
// 1. GESTIÓN DE CONFIGURACIONES Y UMBRALES (P05 / P16)
// ===========================================================================

export {
  listarVersionesConfiguracion,
  obtenerConfiguracionVigente,
  crearVersionConfiguracion,
  activarVersionConfiguracion,
  ConfiguracionInvalidaError,
};

// ===========================================================================
// 2. GESTIÓN DE RECOMENDACIONES PREVENTIVAS
// ===========================================================================

const NIVELES_VALIDOS = ['NORMAL', 'PRECAUCION', 'ALERTA', 'EMERGENCIA'];
const ESTADOS_PUBLICACION = ['borrador', 'publicado', 'archivado'];
const ORIGENES_VALIDOS = ['demostracion', 'institucional_verificada'];

/**
 * Lista todas las recomendaciones preventivas registradas ordenadas por nivel y versión descendente.
 *
 * @param {Object} [opciones]
 * @param {import('pg').Pool|import('pg').PoolClient} [opciones.db=pool]
 * @returns {Promise<Array<Object>>}
 */
export async function listarRecomendacionesAdmin({ db = pool } = {}) {
  const query = `
    SELECT 
      r.id,
      r.nivel,
      r.titulo,
      r.contenido,
      r.version,
      r.estado_publicacion,
      r.origen,
      r.fuente,
      r.actualizado_por,
      r.actualizado_en,
      u.nombre AS autor_nombre,
      u.email AS autor_email
    FROM recomendaciones_preventivas r
    LEFT JOIN usuarios u ON u.id = r.actualizado_por
    ORDER BY 
      CASE r.nivel 
        WHEN 'NORMAL' THEN 1 
        WHEN 'PRECAUCION' THEN 2 
        WHEN 'ALERTA' THEN 3 
        WHEN 'EMERGENCIA' THEN 4 
      END ASC,
      r.version DESC;
  `;

  const res = await db.query(query);
  return res.rows.map((r) => ({
    ...r,
    id: Number(r.id),
    actualizado_por: r.actualizado_por ? Number(r.actualizado_por) : null,
  }));
}

/**
 * Crea una nueva versión de recomendación preventiva para un nivel informativo.
 *
 * @param {Object} datos
 * @param {string} datos.nivel
 * @param {string} datos.titulo
 * @param {string} datos.contenido
 * @param {string} [datos.estado_publicacion='publicado']
 * @param {string} [datos.origen='demostracion']
 * @param {string|null} [datos.fuente=null]
 * @param {number|string} usuarioId
 * @param {Object} [opciones]
 * @param {import('pg').Pool} [opciones.db=pool]
 * @returns {Promise<Object>}
 */
export async function crearRecomendacionPreventiva(
  {
    nivel,
    titulo,
    contenido,
    estado_publicacion = 'publicado',
    origen = 'demostracion',
    fuente = null,
  },
  usuarioId,
  { db = pool } = {}
) {
  if (!nivel || !NIVELES_VALIDOS.includes(nivel)) {
    const err = new Error(
      `Nivel inválido. Debe ser uno de: ${NIVELES_VALIDOS.join(', ')}`
    );
    err.statusCode = 400;
    throw err;
  }

  if (!titulo || typeof titulo !== 'string' || titulo.trim().length === 0) {
    const err = new Error('El título de la recomendación es obligatorio.');
    err.statusCode = 400;
    throw err;
  }

  if (!contenido || typeof contenido !== 'string' || contenido.trim().length === 0) {
    const err = new Error('El contenido de la recomendación es obligatorio.');
    err.statusCode = 400;
    throw err;
  }

  if (!ESTADOS_PUBLICACION.includes(estado_publicacion)) {
    const err = new Error(
      `Estado de publicación inválido. Debe ser: ${ESTADOS_PUBLICACION.join(', ')}`
    );
    err.statusCode = 400;
    throw err;
  }

  if (!ORIGENES_VALIDOS.includes(origen)) {
    const err = new Error(
      `Origen inválido. Debe ser: ${ORIGENES_VALIDOS.join(', ')}`
    );
    err.statusCode = 400;
    throw err;
  }

  const client = typeof db.connect === 'function' ? await db.connect() : db;
  const debeLiberar = typeof db.connect === 'function';

  try {
    await client.query('BEGIN');

    // Siguiente número correlativo de versión para este nivel
    const verRes = await client.query(
      'SELECT COALESCE(MAX(version), 0) + 1 AS siguiente_version FROM recomendaciones_preventivas WHERE nivel = $1;',
      [nivel]
    );
    const siguienteVersion = Number(verRes.rows[0].siguiente_version);

    // Si se publica, archivar versiones previas publicadas del mismo nivel
    if (estado_publicacion === 'publicado') {
      await client.query(
        `UPDATE recomendaciones_preventivas 
         SET estado_publicacion = 'archivado', actualizado_en = NOW() 
         WHERE nivel = $1 AND estado_publicacion = 'publicado';`,
        [nivel]
      );
    }

    const insertSql = `
      INSERT INTO recomendaciones_preventivas (
        nivel, titulo, contenido, version, estado_publicacion, origen, fuente, actualizado_por, actualizado_en
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
      RETURNING *;
    `;

    const resInsert = await client.query(insertSql, [
      nivel,
      titulo.trim(),
      contenido.trim(),
      siguienteVersion,
      estado_publicacion,
      origen,
      fuente ? fuente.trim() : null,
      Number(usuarioId),
    ]);

    const nuevaFila = resInsert.rows[0];

    await registrarEnBitacora(client, {
      usuario_id: usuarioId,
      entidad: 'recomendaciones_preventivas',
      entidad_id: nuevaFila.id,
      accion: 'crear',
      valor_anterior: null,
      valor_nuevo: nuevaFila,
    });

    await client.query('COMMIT');
    return {
      ...nuevaFila,
      id: Number(nuevaFila.id),
      actualizado_por: Number(nuevaFila.actualizado_por),
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    if (debeLiberar) client.release();
  }
}

/**
 * Actualiza una recomendación preventiva existente y registra el cambio en bitácora.
 *
 * @param {number|string} id
 * @param {Object} cambios
 * @param {number|string} usuarioId
 * @param {Object} [opciones]
 * @param {import('pg').Pool} [opciones.db=pool]
 * @returns {Promise<Object>}
 */
export async function actualizarRecomendacionPreventiva(
  id,
  cambios,
  usuarioId,
  { db = pool } = {}
) {
  const client = typeof db.connect === 'function' ? await db.connect() : db;
  const debeLiberar = typeof db.connect === 'function';

  try {
    await client.query('BEGIN');

    const resActual = await client.query(
      'SELECT * FROM recomendaciones_preventivas WHERE id = $1 FOR UPDATE;',
      [id]
    );

    if (resActual.rows.length === 0) {
      const err = new Error(`Recomendación preventiva con ID ${id} no encontrada.`);
      err.statusCode = 404;
      throw err;
    }

    const actual = resActual.rows[0];

    const nuevoTitulo =
      cambios.titulo !== undefined ? cambios.titulo.trim() : actual.titulo;
    const nuevoContenido =
      cambios.contenido !== undefined ? cambios.contenido.trim() : actual.contenido;
    const nuevoEstado =
      cambios.estado_publicacion !== undefined
        ? cambios.estado_publicacion
        : actual.estado_publicacion;
    const nuevoOrigen =
      cambios.origen !== undefined ? cambios.origen : actual.origen;
    const nuevaFuente =
      cambios.fuente !== undefined
        ? cambios.fuente ? cambios.fuente.trim() : null
        : actual.fuente;

    if (!nuevoTitulo || nuevoTitulo.length === 0) {
      const err = new Error('El título no puede estar vacío.');
      err.statusCode = 400;
      throw err;
    }

    if (!nuevoContenido || nuevoContenido.length === 0) {
      const err = new Error('El contenido no puede estar vacío.');
      err.statusCode = 400;
      throw err;
    }

    if (!ESTADOS_PUBLICACION.includes(nuevoEstado)) {
      const err = new Error(`Estado de publicación inválido: ${nuevoEstado}`);
      err.statusCode = 400;
      throw err;
    }

    if (!ORIGENES_VALIDOS.includes(nuevoOrigen)) {
      const err = new Error(`Origen inválido: ${nuevoOrigen}`);
      err.statusCode = 400;
      throw err;
    }

    // Si pasa a publicado, archivar otras versiones del mismo nivel
    if (nuevoEstado === 'publicado' && actual.estado_publicacion !== 'publicado') {
      await client.query(
        `UPDATE recomendaciones_preventivas 
         SET estado_publicacion = 'archivado', actualizado_en = NOW() 
         WHERE nivel = $1 AND estado_publicacion = 'publicado' AND id <> $2;`,
        [actual.nivel, id]
      );
    }

    const updateSql = `
      UPDATE recomendaciones_preventivas
      SET titulo = $1, contenido = $2, estado_publicacion = $3, origen = $4, fuente = $5,
          actualizado_por = $6, actualizado_en = NOW()
      WHERE id = $7
      RETURNING *;
    `;

    const resUpdate = await client.query(updateSql, [
      nuevoTitulo,
      nuevoContenido,
      nuevoEstado,
      nuevoOrigen,
      nuevaFuente,
      Number(usuarioId),
      id,
    ]);

    const actualizada = resUpdate.rows[0];

    await registrarEnBitacora(client, {
      usuario_id: usuarioId,
      entidad: 'recomendaciones_preventivas',
      entidad_id: id,
      accion: 'modificar',
      valor_anterior: actual,
      valor_nuevo: actualizada,
    });

    await client.query('COMMIT');
    return {
      ...actualizada,
      id: Number(actualizada.id),
      actualizado_por: Number(actualizada.actualizado_por),
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    if (debeLiberar) client.release();
  }
}

// ===========================================================================
// 3. GESTIÓN DE CONTACTOS DE EMERGENCIA
// ===========================================================================

/**
 * Lista todos los contactos de emergencia.
 *
 * @param {Object} [opciones]
 * @param {import('pg').Pool|import('pg').PoolClient} [opciones.db=pool]
 * @returns {Promise<Array<Object>>}
 */
export async function listarContactosAdmin({ db = pool } = {}) {
  const res = await db.query('SELECT * FROM contactos_emergencia ORDER BY id ASC;');
  return res.rows.map((c) => ({
    ...c,
    id: Number(c.id),
  }));
}

/**
 * Crea un contacto de emergencia y lo registra en bitácora.
 *
 * @param {Object} datos
 * @param {string} datos.nombre
 * @param {string} datos.telefono
 * @param {string|null} [datos.fuente=null]
 * @param {string|null} [datos.verificado_en=null]
 * @param {boolean} [datos.activo=true]
 * @param {number|string} usuarioId
 * @param {Object} [opciones]
 * @param {import('pg').Pool} [opciones.db=pool]
 * @returns {Promise<Object>}
 */
export async function crearContactoEmergencia(
  { nombre, telefono, fuente = null, verificado_en = null, activo = true },
  usuarioId,
  { db = pool } = {}
) {
  if (!nombre || typeof nombre !== 'string' || nombre.trim().length === 0) {
    const err = new Error('El nombre del contacto es obligatorio.');
    err.statusCode = 400;
    throw err;
  }

  if (!telefono || typeof telefono !== 'string' || telefono.trim().length === 0) {
    const err = new Error('El teléfono del contacto es obligatorio.');
    err.statusCode = 400;
    throw err;
  }

  const client = typeof db.connect === 'function' ? await db.connect() : db;
  const debeLiberar = typeof db.connect === 'function';

  try {
    await client.query('BEGIN');

    const insertSql = `
      INSERT INTO contactos_emergencia (nombre, telefono, fuente, verificado_en, activo)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *;
    `;

    const res = await client.query(insertSql, [
      nombre.trim(),
      telefono.trim(),
      fuente ? fuente.trim() : null,
      verificado_en || null,
      Boolean(activo),
    ]);

    const nuevoContacto = res.rows[0];

    await registrarEnBitacora(client, {
      usuario_id: usuarioId,
      entidad: 'contactos_emergencia',
      entidad_id: nuevoContacto.id,
      accion: 'crear',
      valor_anterior: null,
      valor_nuevo: nuevoContacto,
    });

    await client.query('COMMIT');
    return { ...nuevoContacto, id: Number(nuevoContacto.id) };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    if (debeLiberar) client.release();
  }
}

/**
 * Actualiza un contacto de emergencia existente y registra en bitácora.
 *
 * @param {number|string} id
 * @param {Object} cambios
 * @param {number|string} usuarioId
 * @param {Object} [opciones]
 * @param {import('pg').Pool} [opciones.db=pool]
 * @returns {Promise<Object>}
 */
export async function actualizarContactoEmergencia(
  id,
  cambios,
  usuarioId,
  { db = pool } = {}
) {
  const client = typeof db.connect === 'function' ? await db.connect() : db;
  const debeLiberar = typeof db.connect === 'function';

  try {
    await client.query('BEGIN');

    const resActual = await client.query(
      'SELECT * FROM contactos_emergencia WHERE id = $1 FOR UPDATE;',
      [id]
    );

    if (resActual.rows.length === 0) {
      const err = new Error(`Contacto con ID ${id} no encontrado.`);
      err.statusCode = 404;
      throw err;
    }

    const actual = resActual.rows[0];

    const nuevoNombre =
      cambios.nombre !== undefined ? cambios.nombre.trim() : actual.nombre;
    const nuevoTelefono =
      cambios.telefono !== undefined ? cambios.telefono.trim() : actual.telefono;
    const nuevaFuente =
      cambios.fuente !== undefined
        ? cambios.fuente ? cambios.fuente.trim() : null
        : actual.fuente;
    const nuevoVerificado =
      cambios.verificado_en !== undefined
        ? cambios.verificado_en || null
        : actual.verificado_en;
    const nuevoActivo =
      cambios.activo !== undefined ? Boolean(cambios.activo) : actual.activo;

    if (!nuevoNombre || nuevoNombre.length === 0) {
      const err = new Error('El nombre no puede estar vacío.');
      err.statusCode = 400;
      throw err;
    }

    if (!nuevoTelefono || nuevoTelefono.length === 0) {
      const err = new Error('El teléfono no puede estar vacío.');
      err.statusCode = 400;
      throw err;
    }

    const updateSql = `
      UPDATE contactos_emergencia
      SET nombre = $1, telefono = $2, fuente = $3, verificado_en = $4, activo = $5
      WHERE id = $6
      RETURNING *;
    `;

    const resUpdate = await client.query(updateSql, [
      nuevoNombre,
      nuevoTelefono,
      nuevaFuente,
      nuevoVerificado,
      nuevoActivo,
      id,
    ]);

    const actualizado = resUpdate.rows[0];

    await registrarEnBitacora(client, {
      usuario_id: usuarioId,
      entidad: 'contactos_emergencia',
      entidad_id: id,
      accion: 'modificar',
      valor_anterior: actual,
      valor_nuevo: actualizado,
    });

    await client.query('COMMIT');
    return { ...actualizado, id: Number(actualizado.id) };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    if (debeLiberar) client.release();
  }
}

// ===========================================================================
// 4. GESTIÓN DE ATRIBUTOS DE CAPAS Y PUNTOS DE REFERENCIA
// ===========================================================================

/**
 * Lista zonas y puntos de referencia para administración.
 *
 * @param {Object} [opciones]
 * @param {import('pg').Pool|import('pg').PoolClient} [opciones.db=pool]
 * @returns {Promise<{ zonas: Array<Object>, puntos: Array<Object> }>}
 */
export async function listarCapasAdmin({ db = pool } = {}) {
  const resZonas = await db.query(
    'SELECT id, nombre, fuente, fecha_dato, vigente_hasta, verificada, advertencia FROM zonas_referencia ORDER BY id ASC;'
  );

  const resPuntos = await db.query(
    'SELECT id, nombre, tipo, latitud, longitud, fuente, estado_verificacion, activo FROM puntos_referencia ORDER BY id ASC;'
  );

  return {
    zonas: resZonas.rows.map((z) => ({
      ...z,
      id: Number(z.id),
    })),
    puntos: resPuntos.rows.map((p) => ({
      ...p,
      id: Number(p.id),
      latitud: Number(p.latitud),
      longitud: Number(p.longitud),
    })),
  };
}

/**
 * Actualiza los atributos descriptivos de una zona de referencia (NUNCA altera su geometría).
 *
 * @param {number|string} id
 * @param {Object} atributos
 * @param {number|string} usuarioId
 * @param {Object} [opciones]
 * @param {import('pg').Pool} [opciones.db=pool]
 * @returns {Promise<Object>}
 */
export async function actualizarAtributosZona(
  id,
  atributos,
  usuarioId,
  { db = pool } = {}
) {
  const client = typeof db.connect === 'function' ? await db.connect() : db;
  const debeLiberar = typeof db.connect === 'function';

  try {
    await client.query('BEGIN');

    const resActual = await client.query(
      'SELECT id, nombre, fuente, fecha_dato, vigente_hasta, verificada, advertencia FROM zonas_referencia WHERE id = $1 FOR UPDATE;',
      [id]
    );

    if (resActual.rows.length === 0) {
      const err = new Error(`Zona de referencia con ID ${id} no encontrada.`);
      err.statusCode = 404;
      throw err;
    }

    const actual = resActual.rows[0];

    const nuevoNombre =
      atributos.nombre !== undefined ? atributos.nombre.trim() : actual.nombre;
    const nuevaFuente =
      atributos.fuente !== undefined ? atributos.fuente.trim() : actual.fuente;
    const nuevaFechaDato =
      atributos.fecha_dato !== undefined
        ? atributos.fecha_dato
        : actual.fecha_dato;
    const nuevoVigenteHasta =
      atributos.vigente_hasta !== undefined
        ? atributos.vigente_hasta || null
        : actual.vigente_hasta;
    const nuevaVerificada =
      atributos.verificada !== undefined
        ? Boolean(atributos.verificada)
        : actual.verificada;
    const nuevaAdvertencia =
      atributos.advertencia !== undefined
        ? atributos.advertencia.trim()
        : actual.advertencia;

    if (!nuevoNombre || nuevoNombre.length === 0) {
      const err = new Error('El nombre de la zona no puede estar vacío.');
      err.statusCode = 400;
      throw err;
    }

    if (!nuevaFuente || nuevaFuente.length === 0) {
      const err = new Error('La fuente cartográfica no puede estar vacía.');
      err.statusCode = 400;
      throw err;
    }

    if (!nuevaAdvertencia || nuevaAdvertencia.length === 0) {
      const err = new Error('La leyenda de advertencia no puede estar vacía.');
      err.statusCode = 400;
      throw err;
    }

    const updateSql = `
      UPDATE zonas_referencia
      SET nombre = $1, fuente = $2, fecha_dato = $3, vigente_hasta = $4, verificada = $5, advertencia = $6
      WHERE id = $7
      RETURNING id, nombre, fuente, fecha_dato, vigente_hasta, verificada, advertencia;
    `;

    const resUpdate = await client.query(updateSql, [
      nuevoNombre,
      nuevaFuente,
      nuevaFechaDato,
      nuevoVigenteHasta,
      nuevaVerificada,
      nuevaAdvertencia,
      id,
    ]);

    const actualizada = resUpdate.rows[0];

    await registrarEnBitacora(client, {
      usuario_id: usuarioId,
      entidad: 'zonas_referencia',
      entidad_id: id,
      accion: 'modificar',
      valor_anterior: actual,
      valor_nuevo: actualizada,
    });

    await client.query('COMMIT');
    return { ...actualizada, id: Number(actualizada.id) };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    if (debeLiberar) client.release();
  }
}

/**
 * Actualiza los atributos descriptivos de un punto de referencia (NUNCA altera coordenadas lat/lon).
 *
 * @param {number|string} id
 * @param {Object} atributos
 * @param {number|string} usuarioId
 * @param {Object} [opciones]
 * @param {import('pg').Pool} [opciones.db=pool]
 * @returns {Promise<Object>}
 */
export async function actualizarAtributosPunto(
  id,
  atributos,
  usuarioId,
  { db = pool } = {}
) {
  const client = typeof db.connect === 'function' ? await db.connect() : db;
  const debeLiberar = typeof db.connect === 'function';

  try {
    await client.query('BEGIN');

    const resActual = await client.query(
      'SELECT id, nombre, tipo, latitud, longitud, fuente, estado_verificacion, activo FROM puntos_referencia WHERE id = $1 FOR UPDATE;',
      [id]
    );

    if (resActual.rows.length === 0) {
      const err = new Error(`Punto de referencia con ID ${id} no encontrado.`);
      err.statusCode = 404;
      throw err;
    }

    const actual = resActual.rows[0];

    const nuevoNombre =
      atributos.nombre !== undefined ? atributos.nombre.trim() : actual.nombre;
    const nuevoTipo =
      atributos.tipo !== undefined
        ? atributos.tipo ? atributos.tipo.trim() : null
        : actual.tipo;
    const nuevaFuente =
      atributos.fuente !== undefined
        ? atributos.fuente ? atributos.fuente.trim() : null
        : actual.fuente;
    const nuevoEstadoVerificacion =
      atributos.estado_verificacion !== undefined
        ? atributos.estado_verificacion
        : actual.estado_verificacion;
    const nuevoActivo =
      atributos.activo !== undefined
        ? Boolean(atributos.activo)
        : actual.activo;

    if (!nuevoNombre || nuevoNombre.length === 0) {
      const err = new Error('El nombre del punto no puede estar vacío.');
      err.statusCode = 400;
      throw err;
    }

    if (
      nuevoEstadoVerificacion !== 'sin_verificar' &&
      nuevoEstadoVerificacion !== 'verificado_por_autoridad'
    ) {
      const err = new Error(
        `Estado de verificación inválido: "${nuevoEstadoVerificacion}". Debe ser 'sin_verificar' o 'verificado_por_autoridad'.`
      );
      err.statusCode = 400;
      throw err;
    }

    const updateSql = `
      UPDATE puntos_referencia
      SET nombre = $1, tipo = $2, fuente = $3, estado_verificacion = $4, activo = $5
      WHERE id = $6
      RETURNING id, nombre, tipo, latitud, longitud, fuente, estado_verificacion, activo;
    `;

    const resUpdate = await client.query(updateSql, [
      nuevoNombre,
      nuevoTipo,
      nuevaFuente,
      nuevoEstadoVerificacion,
      nuevoActivo,
      id,
    ]);

    const actualizado = resUpdate.rows[0];

    await registrarEnBitacora(client, {
      usuario_id: usuarioId,
      entidad: 'puntos_referencia',
      entidad_id: id,
      accion: 'modificar',
      valor_anterior: {
        nombre: actual.nombre,
        tipo: actual.tipo,
        fuente: actual.fuente,
        estado_verificacion: actual.estado_verificacion,
        activo: actual.activo,
      },
      valor_nuevo: {
        nombre: actualizado.nombre,
        tipo: actualizado.tipo,
        fuente: actualizado.fuente,
        estado_verificacion: actualizado.estado_verificacion,
        activo: actualizado.activo,
      },
    });

    await client.query('COMMIT');
    return {
      ...actualizado,
      id: Number(actualizado.id),
      latitud: Number(actualizado.latitud),
      longitud: Number(actualizado.longitud),
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    if (debeLiberar) client.release();
  }
}

// ===========================================================================
// 5. CONSULTA DE BITÁCORA DE CAMBIOS
// ===========================================================================

/**
 * Consulta el registro cronológico auditable de bitacora_cambios.
 *
 * @param {Object} [opciones]
 * @param {number} [opciones.limite=50] Cantidad máxima de registros
 * @param {string|null} [opciones.entidad=null] Filtro opcional por entidad
 * @param {import('pg').Pool|import('pg').PoolClient} [opciones.db=pool]
 * @returns {Promise<Array<Object>>}
 */
export async function listarBitacoraCambios({
  limite = 50,
  entidad = null,
  db = pool,
} = {}) {
  const limiteNum = Math.min(Math.max(1, Number(limite) || 50), 200);

  const query = `
    SELECT 
      b.id,
      b.usuario_id,
      u.nombre AS usuario_nombre,
      u.email AS usuario_email,
      b.entidad,
      b.entidad_id,
      b.accion,
      b.valor_anterior,
      b.valor_nuevo,
      b.ocurrido_en
    FROM bitacora_cambios b
    LEFT JOIN usuarios u ON u.id = b.usuario_id
    WHERE ($1::text IS NULL OR b.entidad = $1)
    ORDER BY b.ocurrido_en DESC, b.id DESC
    LIMIT $2;
  `;

  const res = await db.query(query, [entidad || null, limiteNum]);
  return res.rows.map((row) => ({
    id: Number(row.id),
    usuario_id: row.usuario_id ? Number(row.usuario_id) : null,
    usuario_nombre: row.usuario_nombre,
    usuario_email: row.usuario_email,
    entidad: row.entidad,
    entidad_id: Number(row.entidad_id),
    accion: row.accion,
    valor_anterior: row.valor_anterior,
    valor_nuevo: row.valor_nuevo,
    ocurrido_en: row.ocurrido_en,
  }));
}

// ===========================================================================
// 6. OPERACIONES DE SIMULACIÓN ADMINISTRATIVA CON BITÁCORA
// ===========================================================================

/**
 * Inyecta una lectura simulada y registra la acción en bitácora.
 *
 * @param {Object} payload
 * @param {number|string} usuarioId
 * @param {Object} [opciones]
 * @returns {Promise<Object>}
 */
export async function inyectarLecturaSimuladaConBitacora(
  payload,
  usuarioId,
  { db = pool } = {}
) {
  const datosLectura = {
    observado_en: payload?.observado_en || new Date().toISOString(),
    ...payload,
  };
  const resultado = await registrarYEvaluarLecturaSimulada(datosLectura, { db });

  await registrarEnBitacora(db, {
    usuario_id: usuarioId,
    entidad: 'simulacion',
    entidad_id: 0,
    accion: 'simular',
    valor_anterior: null,
    valor_nuevo: {
      nivel_calculado: resultado.evaluacion?.nivel_calculado,
      nivel_vigente: resultado.evaluacion?.nivel_vigente,
      estado_sistema: resultado.evaluacion?.estado_sistema,
      intensidad_mm_h: resultado.lectura?.intensidad_mm_h,
      acum_24h_mm: resultado.lectura?.acum_24h_mm,
      acum_72h_mm: resultado.lectura?.acum_72h_mm,
    },
  });

  return resultado;
}

/**
 * Limpia los datos simulados y registra la acción en bitácora.
 *
 * @param {number|string} usuarioId
 * @param {Object} [opciones]
 * @returns {Promise<Object>}
 */
export async function limpiarSimulacionConBitacora(
  usuarioId,
  { db = pool } = {}
) {
  const resultado = await limpiarDatosSimulados({ db });

  await registrarEnBitacora(db, {
    usuario_id: usuarioId,
    entidad: 'simulacion',
    entidad_id: 0,
    accion: 'limpiar',
    valor_anterior: null,
    valor_nuevo: resultado,
  });

  return resultado;
}

