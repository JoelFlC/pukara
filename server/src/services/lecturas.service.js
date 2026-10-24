/**
 * @file lecturas.service.js
 * @description Servicio orquestador para la consulta, almacenamiento en caché en memoria,
 * cálculo funcional de acumulados y persistencia idempotente de lecturas meteorológicas
 * en PostgreSQL para el sector Llojeta (proyecto PUKARA).
 *
 * Incluye resiliencia de servidor ante indisponibilidad de la API externa (Regla T5, Prueba P03)
 * y protección de caché en memoria de 10 a 15 minutos (Prueba P04).
 */

import { pool } from '../db/pool.js';
import { consultarOpenMeteo } from './openMeteo.js';
import { calcularAcumuladosYCalidad } from '../engine/acumulados.js';

export const TTL_CACHE_DEFAULT_MINUTOS = 12;
export const TTL_CACHE_MIN_MINUTOS = 10;
export const TTL_CACHE_MAX_MINUTOS = 15;

/**
 * Normaliza y acota el TTL del caché al rango obligatorio [10, 15] minutos.
 *
 * @param {number|string|null|undefined} valor
 * @returns {number} Minutos dentro de [10, 15]
 */
export function normalizarTtlCacheMinutos(valor) {
  if (valor === undefined || valor === null || valor === '') {
    return TTL_CACHE_DEFAULT_MINUTOS;
  }
  const num = Number(valor);
  if (!Number.isFinite(num)) {
    return TTL_CACHE_DEFAULT_MINUTOS;
  }
  if (num < TTL_CACHE_MIN_MINUTOS) {
    return TTL_CACHE_MIN_MINUTOS;
  }
  if (num > TTL_CACHE_MAX_MINUTOS) {
    return TTL_CACHE_MAX_MINUTOS;
  }
  return num;
}

// Estado interno en memoria del proceso Node.js
let cacheMemoria = null;
let promesaEnVuelo = null;

/**
 * Reinicia el estado interno del caché en memoria del servidor.
 * Esencial para el aislamiento y reproducibilidad en pruebas unitarias e integración.
 */
export function limpiarCacheLecturas() {
  cacheMemoria = null;
  promesaEnVuelo = null;
}

/**
 * Calcula la antigüedad en minutos con 1 decimal respecto a la marca temporal dada.
 *
 * @param {string|Date|number|null} observadoEn
 * @param {number} [ahoraMs=Date.now()]
 * @returns {number|null} Minutos transcurridos (nunca negativo) o null si la fecha es inválida
 */
export function calcularAntiguedadMinutos(observadoEn, ahoraMs = Date.now()) {
  if (!observadoEn) {
    return null;
  }
  const tsObs =
    typeof observadoEn === 'number'
      ? observadoEn
      : observadoEn instanceof Date
        ? observadoEn.getTime()
        : Date.parse(observadoEn);

  if (Number.isNaN(tsObs)) {
    return null;
  }

  const minutos = (ahoraMs - tsObs) / 60_000;
  return Math.max(0, Math.round(minutos * 10) / 10);
}

/**
 * Mapea una tupla cruda de PostgreSQL a un objeto de dominio con tipos numéricos
 * explícitos y fechas en formato ISO 8601 UTC, preservando estrictamente los valores null.
 *
 * @param {Object} fila Fila devuelta por pg
 * @param {number} [ahoraMs=Date.now()]
 * @returns {Object}
 */
export function mapearFilaLectura(fila, ahoraMs = Date.now()) {
  if (!fila || typeof fila !== 'object') {
    return null;
  }

  const parseNum = (val) => (val !== null && val !== undefined ? Number(val) : null);

  const observadoIso = fila.observado_en
    ? new Date(fila.observado_en).toISOString()
    : null;

  const recibidoIso = fila.recibido_en
    ? new Date(fila.recibido_en).toISOString()
    : null;

  return {
    id: fila.id !== null && fila.id !== undefined ? Number(fila.id) : null,
    modalidad: fila.modalidad,
    fuente: fila.fuente,
    observado_en: observadoIso,
    recibido_en: recibidoIso,
    intensidad_mm_h: parseNum(fila.intensidad_mm_h),
    acum_24h_mm: parseNum(fila.acum_24h_mm),
    acum_72h_mm: parseNum(fila.acum_72h_mm),
    horas_validas_24h: parseNum(fila.horas_validas_24h),
    horas_validas_72h: parseNum(fila.horas_validas_72h),
    estado: fila.estado,
    temperatura: parseNum(fila.temperatura),
    humedad: parseNum(fila.humedad),
    viento: parseNum(fila.viento),
    antiguedad_minutos: calcularAntiguedadMinutos(observadoIso, ahoraMs),
  };
}

/**
 * Obtiene la última lectura meteorológica registrada en la base de datos para la modalidad indicada.
 *
 * @param {Object} [opciones]
 * @param {'real'|'simulada'} [opciones.modalidad='real']
 * @param {boolean} [opciones.soloClasificables=false] Si es true, filtra solo estado IN ('valida', 'incompleta')
 * @param {Object} [opciones.db=pool] Cliente o Pool de PostgreSQL
 * @param {Function} [opciones.ahoraFn=() => Date.now()]
 * @returns {Promise<Object|null>}
 */
export async function obtenerUltimaLecturaRegistrada({
  modalidad = 'real',
  soloClasificables = false,
  db = pool,
  ahoraFn = () => Date.now(),
} = {}) {
  let sql = 'SELECT * FROM lecturas_meteorologicas WHERE modalidad = $1';
  if (soloClasificables) {
    sql += " AND estado IN ('valida', 'incompleta')";
  }
  sql += ' ORDER BY observado_en DESC, id DESC LIMIT 1;';

  const { rows } = await db.query(sql, [modalidad]);
  if (!rows || rows.length === 0) {
    return null;
  }
  return mapearFilaLectura(rows[0], ahoraFn());
}

/**
 * Alias semántico para obtener la última lectura utilizable para clasificación (excluye 'invalida').
 *
 * @param {Object} [opciones]
 * @returns {Promise<Object|null>}
 */
export async function obtenerUltimaLecturaValida(opciones = {}) {
  return obtenerUltimaLecturaRegistrada({
    ...opciones,
    soloClasificables: true,
  });
}

/**
 * Inserta de forma idempotente una lectura meteorológica en PostgreSQL.
 * Si ya existe una lectura para la misma (modalidad, fuente, observado_en),
 * no genera error y recupera la tupla previamente registrada.
 *
 * @param {Object} datosLectura
 * @param {Object} [opciones]
 * @param {Object} [opciones.db=pool]
 * @param {Function} [opciones.ahoraFn=() => Date.now()]
 * @returns {Promise<{ lectura: Object, insertada_nueva: boolean }>}
 */
export async function insertarLecturaMeteorologica(
  datosLectura,
  { db = pool, ahoraFn = () => Date.now() } = {}
) {
  const insertSql = `
    INSERT INTO lecturas_meteorologicas (
      modalidad, fuente, observado_en, intensidad_mm_h, acum_24h_mm,
      acum_72h_mm, horas_validas_24h, horas_validas_72h, estado,
      temperatura, humedad, viento
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12
    )
    ON CONFLICT (modalidad, fuente, observado_en) DO NOTHING
    RETURNING *;
  `;

  const valores = [
    datosLectura.modalidad,
    datosLectura.fuente,
    datosLectura.observado_en, // REGLA CRÍTICA: timestamp devuelto por el proveedor, nunca new Date() local
    datosLectura.intensidad_mm_h ?? null,
    datosLectura.acum_24h_mm ?? null,
    datosLectura.acum_72h_mm ?? null,
    datosLectura.horas_validas_24h ?? null,
    datosLectura.horas_validas_72h ?? null,
    datosLectura.estado,
    datosLectura.temperatura ?? null,
    datosLectura.humedad ?? null,
    datosLectura.viento ?? null,
  ];

  const resultadoInsert = await db.query(insertSql, valores);

  if (resultadoInsert.rowCount === 1 && resultadoInsert.rows[0]) {
    return {
      lectura: mapearFilaLectura(resultadoInsert.rows[0], ahoraFn()),
      insertada_nueva: true,
    };
  }

  // Si no insertó por conflicto UNIQUE (modalidad, fuente, observado_en), recuperar la existente
  const selectExistenteSql = `
    SELECT * FROM lecturas_meteorologicas
    WHERE modalidad = $1 AND fuente = $2 AND observado_en = $3
    LIMIT 1;
  `;
  const resultadoExistente = await db.query(selectExistenteSql, [
    datosLectura.modalidad,
    datosLectura.fuente,
    datosLectura.observado_en,
  ]);

  return {
    lectura: mapearFilaLectura(resultadoExistente.rows[0], ahoraFn()),
    insertada_nueva: false,
  };
}

/**
 * Función orquestadora principal que consulta el proveedor meteorológico, calcula los
 * acumulados retrospectivos, gestiona el caché en memoria (10 a 15 min), persiste
 * en PostgreSQL y aplica la política de resiliencia T5 ante caídas externas.
 *
 * @param {Object} [opciones]
 * @param {Object} [opciones.db=pool] Cliente o Pool de BD
 * @param {Function} [opciones.consultarMeteoFn=consultarOpenMeteo] Función de consulta HTTP a Open-Meteo
 * @param {Function} [opciones.ahoraFn=() => Date.now()] Función de reloj inyectable
 * @param {number} [opciones.ttlMs] TTL del caché en milisegundos (sobrescribe process.env)
 * @param {boolean} [opciones.forzarConsultaExterna=false] Ignorar caché en memoria si es true
 * @returns {Promise<Object>} Resultado con lectura, origen, banderas y estado de error
 */
export async function consultarYRegistrarLecturaReal(opciones = {}) {
  const {
    db = pool,
    consultarMeteoFn = consultarOpenMeteo,
    ahoraFn = () => Date.now(),
    ttlMs,
    forzarConsultaExterna = false,
  } = opciones;

  const ahoraMs = ahoraFn();
  const ttlMinutos = normalizarTtlCacheMinutos(process.env.LECTURAS_CACHE_TTL_MINUTOS);
  const ventanaCacheMs =
    typeof ttlMs === 'number' && Number.isFinite(ttlMs)
      ? ttlMs
      : ttlMinutos * 60_000;

  // Paso 1 — Verificación de Caché en Servidor (Prueba P04)
  if (
    !forzarConsultaExterna &&
    cacheMemoria &&
    ahoraMs - cacheMemoria.guardadoEnMs < ventanaCacheMs
  ) {
    const lecturaActualizada = {
      ...cacheMemoria.lectura,
      antiguedad_minutos: calcularAntiguedadMinutos(
        cacheMemoria.lectura.observado_en,
        ahoraMs
      ),
    };

    return {
      lectura: lecturaActualizada,
      origen_respuesta: 'cache_servidor',
      insertada_nueva: false,
      fallo_api: false,
      error_api: null,
      banderas_calidad: { ...cacheMemoria.banderas_calidad },
    };
  }

  // Paso 2 — Protección contra estampida concurrente (in-flight deduplication)
  if (promesaEnVuelo) {
    const resultadoEnVuelo = await promesaEnVuelo;
    if (resultadoEnVuelo?.lectura) {
      return {
        ...resultadoEnVuelo,
        lectura: {
          ...resultadoEnVuelo.lectura,
          antiguedad_minutos: calcularAntiguedadMinutos(
            resultadoEnVuelo.lectura.observado_en,
            ahoraFn()
          ),
        },
      };
    }
    return resultadoEnVuelo;
  }

  // Definición de la ejecución activa
  const ejecutarConsulta = async () => {
    try {
      // Paso 3 — Consulta a Open-Meteo + Cálculo Puro + Persistencia
      const respuestaApi = await consultarMeteoFn();
      const calculo = calcularAcumuladosYCalidad(respuestaApi);

      const datosLectura = {
        modalidad: 'real',
        fuente: respuestaApi.fuente || 'Open-Meteo',
        observado_en: respuestaApi.observado_en,
        intensidad_mm_h: calculo.intensidad_mm_h,
        acum_24h_mm: calculo.acum_24h_mm,
        acum_72h_mm: calculo.acum_72h_mm,
        horas_validas_24h: calculo.horas_validas_24h,
        horas_validas_72h: calculo.horas_validas_72h,
        estado: calculo.estado,
        temperatura: respuestaApi.actual?.temperatura_c ?? null,
        humedad: respuestaApi.actual?.humedad_pct ?? null,
        viento: respuestaApi.actual?.viento_kmh ?? null,
      };

      const { lectura, insertada_nueva } = await insertarLecturaMeteorologica(
        datosLectura,
        { db, ahoraFn }
      );

      // Guardar en caché solo ante consulta exitosa
      cacheMemoria = {
        lectura,
        banderas_calidad: { ...calculo.banderas_calidad },
        guardadoEnMs: ahoraMs,
      };

      return {
        lectura,
        origen_respuesta: 'open_meteo',
        insertada_nueva,
        fallo_api: false,
        error_api: null,
        banderas_calidad: calculo.banderas_calidad,
      };
    } catch (err) {
      // Paso 4 — Resiliencia ante Caída / Timeout / Respuesta Corrupta de Open-Meteo (Regla T5 y Prueba P03)
      const respaldo = await obtenerUltimaLecturaRegistrada({
        modalidad: 'real',
        soloClasificables: true,
        db,
        ahoraFn,
      });

      let banderasReconstruidas = null;
      if (respaldo) {
        banderasReconstruidas = {
          intensidad_completa: respaldo.intensidad_mm_h !== null,
          acum_24h_completo: respaldo.acum_24h_mm !== null,
          acum_72h_completo: respaldo.acum_72h_mm !== null,
          clasificacion_parcial: respaldo.estado === 'incompleta',
        };
      }

      return {
        lectura: respaldo,
        origen_respuesta: respaldo
          ? 'respaldo_bd_por_fallo_api'
          : 'sin_datos_por_fallo_api',
        insertada_nueva: false,
        fallo_api: true,
        error_api: {
          codigo: err?.codigo || 'ERROR_EXTERNO',
          mensaje:
            err?.message ||
            'Fallo al consultar servicio meteorológico externo',
        },
        banderas_calidad: banderasReconstruidas,
      };
    }
  };

  promesaEnVuelo = ejecutarConsulta();
  try {
    return await promesaEnVuelo;
  } finally {
    promesaEnVuelo = null;
  }
}

export default {
  TTL_CACHE_DEFAULT_MINUTOS,
  TTL_CACHE_MIN_MINUTOS,
  TTL_CACHE_MAX_MINUTOS,
  normalizarTtlCacheMinutos,
  limpiarCacheLecturas,
  calcularAntiguedadMinutos,
  mapearFilaLectura,
  obtenerUltimaLecturaRegistrada,
  obtenerUltimaLecturaValida,
  insertarLecturaMeteorologica,
  consultarYRegistrarLecturaReal,
};
