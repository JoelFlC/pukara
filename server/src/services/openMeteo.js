import { ZONA_PILOTO } from '../config/zonaPiloto.js';

/**
 * Error tipado para operaciones y consultas con el servicio Open-Meteo.
 */
export class OpenMeteoError extends Error {
  constructor(mensaje, codigo, detalles = {}) {
    super(mensaje);
    this.name = 'OpenMeteoError';
    this.codigo = codigo; // 'TIMEOUT', 'HTTP_ERROR', 'RESPUESTA_CORRUPTA', 'ERROR_RED'
    this.statusHttp = detalles.statusHttp || null;
    this.detalles = detalles;
  }
}

/**
 * Construye la URL tipada con parámetros canónicos para la consulta de Open-Meteo.
 * @param {Object} [opciones={}]
 * @returns {string}
 */
export function construirUrlOpenMeteo(opciones = {}) {
  const baseUrl = opciones.baseUrl || ZONA_PILOTO.baseUrl;
  const lat = opciones.lat ?? ZONA_PILOTO.latitud;
  const lon = opciones.lon ?? ZONA_PILOTO.longitud;
  const pastDays = opciones.pastDays ?? 4;
  const timezone = opciones.timezone || ZONA_PILOTO.timezone;
  const current =
    opciones.current || 'precipitation,temperature_2m,relative_humidity_2m,wind_speed_10m';
  const hourly = opciones.hourly || 'precipitation';

  const url = new URL(baseUrl);
  url.searchParams.set('latitude', lat.toString());
  url.searchParams.set('longitude', lon.toString());
  url.searchParams.set('current', current);
  url.searchParams.set('hourly', hourly);
  url.searchParams.set('past_days', pastDays.toString());
  url.searchParams.set('timezone', timezone);

  return url.toString();
}

/**
 * Normaliza una cadena de fecha de Open-Meteo a formato ISO 8601 UTC estricto.
 * @param {string} fechaStr Ej: "2026-10-23T22:30"
 * @returns {string} Ej: "2026-10-23T22:30:00.000Z"
 */
export function normalizarFechaIsoUtc(fechaStr) {
  if (typeof fechaStr !== 'string' || !fechaStr.trim()) {
    throw new OpenMeteoError(
      `Cadena de fecha ausente o inválida: ${fechaStr}`,
      'RESPUESTA_CORRUPTA'
    );
  }

  const trimmed = fechaStr.trim();
  let iso = trimmed;

  if (!trimmed.endsWith('Z') && !trimmed.includes('+') && !trimmed.slice(10).includes('-')) {
    if (trimmed.length === 16) {
      iso = `${trimmed}:00.000Z`;
    } else if (trimmed.length === 19) {
      iso = `${trimmed}.000Z`;
    } else {
      iso = `${trimmed}Z`;
    }
  }

  const fecha = new Date(iso);
  if (isNaN(fecha.getTime())) {
    throw new OpenMeteoError(
      `Cadena de fecha no convertible a tiempo válido: ${fechaStr}`,
      'RESPUESTA_CORRUPTA'
    );
  }

  return fecha.toISOString();
}

/**
 * Valida la integridad estructural de la respuesta JSON y normaliza el contrato de datos.
 * Preserva estrictamente los valores nulos (PROHIBIDO asumir 0 mm).
 * @param {Object} data JSON crudo de Open-Meteo
 * @returns {Object} Contrato normalizado de salida
 */
export function validarYNormalizarRespuesta(data) {
  if (!data || typeof data !== 'object') {
    throw new OpenMeteoError(
      'La respuesta de Open-Meteo no es un objeto JSON válido',
      'RESPUESTA_CORRUPTA'
    );
  }

  // Validación de bloque current
  if (!data.current || typeof data.current !== 'object') {
    throw new OpenMeteoError(
      'Respuesta corrupta: falta el bloque "current"',
      'RESPUESTA_CORRUPTA'
    );
  }

  if (!data.current.time) {
    throw new OpenMeteoError(
      'Respuesta corrupta: falta el campo "current.time"',
      'RESPUESTA_CORRUPTA'
    );
  }

  const observadoEn = normalizarFechaIsoUtc(data.current.time);

  // Validación de bloque hourly
  if (!data.hourly || typeof data.hourly !== 'object') {
    throw new OpenMeteoError(
      'Respuesta corrupta: falta el bloque "hourly"',
      'RESPUESTA_CORRUPTA'
    );
  }

  if (!Array.isArray(data.hourly.time) || !Array.isArray(data.hourly.precipitation)) {
    throw new OpenMeteoError(
      'Respuesta corrupta: "hourly.time" o "hourly.precipitation" no son arreglos válidos',
      'RESPUESTA_CORRUPTA'
    );
  }

  if (data.hourly.time.length !== data.hourly.precipitation.length) {
    throw new OpenMeteoError(
      `Respuesta corrupta: longitud dispar entre hourly.time (${data.hourly.time.length}) y hourly.precipitation (${data.hourly.precipitation.length})`,
      'RESPUESTA_CORRUPTA'
    );
  }

  // Normalizar serie horaria preservando nulls
  const tiemposUtc = [];
  const precipitacionMm = [];

  for (let i = 0; i < data.hourly.time.length; i++) {
    tiemposUtc.push(normalizarFechaIsoUtc(data.hourly.time[i]));
    const val = data.hourly.precipitation[i];
    // Preservar nulls sin inventar 0 mm
    precipitacionMm.push(val === null || val === undefined ? null : Number(val));
  }

  return {
    fuente: 'open-meteo',
    observado_en: observadoEn,
    coordenada_consultada: {
      latitud: ZONA_PILOTO.latitud,
      longitud: ZONA_PILOTO.longitud,
    },
    coordenada_modelo: {
      latitud: typeof data.latitude === 'number' ? data.latitude : null,
      longitud: typeof data.longitude === 'number' ? data.longitude : null,
    },
    elevacion_m: typeof data.elevation === 'number' ? data.elevation : null,
    intervalo_actual_segundos:
      typeof data.current.interval === 'number' ? data.current.interval : 900,
    actual: {
      precipitacion_mm:
        data.current.precipitation !== null && data.current.precipitation !== undefined
          ? Number(data.current.precipitation)
          : null,
      temperatura_c:
        data.current.temperature_2m !== null && data.current.temperature_2m !== undefined
          ? Number(data.current.temperature_2m)
          : null,
      humedad_relativa_pct:
        data.current.relative_humidity_2m !== null &&
        data.current.relative_humidity_2m !== undefined
          ? Number(data.current.relative_humidity_2m)
          : null,
      viento_km_h:
        data.current.wind_speed_10m !== null && data.current.wind_speed_10m !== undefined
          ? Number(data.current.wind_speed_10m)
          : null,
    },
    serie_horaria: {
      total_horas: tiemposUtc.length,
      tiempos_utc: tiemposUtc,
      precipitacion_mm: precipitacionMm,
    },
  };
}

/**
 * Consulta la API de Open-Meteo con soporte para timeout por AbortController
 * e inyección opcional de fetchImpl para pruebas unitarias deterministas.
 * @param {Object} [opciones={}]
 * @param {Function} [opciones.fetchImpl] Función fetch alternativa para testing
 * @param {number} [opciones.timeoutMs] Timeout en milisegundos
 * @param {number} [opciones.lat] Latitud personalizada
 * @param {number} [opciones.lon] Longitud personalizada
 * @returns {Promise<Object>} Contrato normalizado
 */
export async function consultarOpenMeteo(opciones = {}) {
  const fetchImpl = opciones.fetchImpl || globalThis.fetch;
  const timeoutMs = opciones.timeoutMs ?? ZONA_PILOTO.timeoutMs;
  const url = construirUrlOpenMeteo(opciones);

  const controller = new AbortController();
  const timer = setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  try {
    const response = await fetchImpl(url, { signal: controller.signal });

    if (!response.ok) {
      throw new OpenMeteoError(
        `Error HTTP al consultar Open-Meteo: ${response.status} ${response.statusText || ''}`.trim(),
        'HTTP_ERROR',
        { statusHttp: response.status }
      );
    }

    const json = await response.json();
    return validarYNormalizarRespuesta(json);
  } catch (err) {
    if (err.name === 'AbortError' || controller.signal.aborted) {
      throw new OpenMeteoError(
        `Timeout al consultar Open-Meteo tras ${timeoutMs}ms`,
        'TIMEOUT',
        { timeoutMs }
      );
    }

    if (err instanceof OpenMeteoError) {
      throw err;
    }

    throw new OpenMeteoError(
      `Falla de red o conexión al contactar Open-Meteo: ${err.message}`,
      'ERROR_RED',
      { errorOriginal: err.message }
    );
  } finally {
    clearTimeout(timer);
  }
}

export default {
  OpenMeteoError,
  construirUrlOpenMeteo,
  normalizarFechaIsoUtc,
  validarYNormalizarRespuesta,
  consultarOpenMeteo,
};
