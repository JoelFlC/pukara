import { obtenerConfigZonaPiloto } from '../config/zonaPiloto.js';

/**
 * Error tipado para operaciones y consultas con el servicio Open-Meteo.
 */
export class OpenMeteoError extends Error {
  /**
   * @param {string} mensaje
   * @param {Object} [opciones={}]
   * @param {'TIMEOUT' | 'RED_ERROR' | 'HTTP_ERROR' | 'RESPUESTA_CORRUPTA'} opciones.codigo
   * @param {number|null} [opciones.statusHttp=null]
   * @param {Error|null} [opciones.causaOriginal=null]
   */
  constructor(mensaje, { codigo, statusHttp = null, causaOriginal = null } = {}) {
    super(mensaje);
    this.name = 'OpenMeteoError';
    this.codigo = codigo;
    this.statusHttp = statusHttp;
    this.causaOriginal = causaOriginal;
  }
}

/**
 * Normaliza una cadena de fecha de Open-Meteo a formato canónico ISO 8601 UTC exacto.
 * @param {string} tiempoStr Ej: "2026-10-23T22:45"
 * @returns {string} Ej: "2026-10-23T22:45:00.000Z"
 */
export function normalizarMarcaIsoUtc(tiempoStr) {
  if (typeof tiempoStr !== 'string' || !tiempoStr.trim()) {
    throw new OpenMeteoError('Cadena de fecha ausente o vacía', {
      codigo: 'RESPUESTA_CORRUPTA',
    });
  }

  const trimmed = tiempoStr.trim();
  let cadenaConZona = trimmed;

  // Si no termina en 'Z' ni tiene offset explícito (+HH:MM o -HH:MM), agregar 'Z'
  const tieneZona =
    trimmed.endsWith('Z') ||
    /[+-]\d{2}(:\d{2})?$/.test(trimmed) ||
    (trimmed.length > 19 && (trimmed.includes('+') || trimmed.slice(10).includes('-')));

  if (!tieneZona) {
    cadenaConZona = `${trimmed}Z`;
  }

  const fecha = new Date(cadenaConZona);
  if (Number.isNaN(fecha.getTime())) {
    throw new OpenMeteoError(`Cadena de fecha no convertible a fecha válida: ${tiempoStr}`, {
      codigo: 'RESPUESTA_CORRUPTA',
    });
  }

  return fecha.toISOString();
}

// Alias de retrocompatibilidad
export const normalizarFechaIsoUtc = normalizarMarcaIsoUtc;

/**
 * Construye la URL tipada con parámetros canónicos para la consulta de Open-Meteo.
 * @param {Object} [opciones={}]
 * @returns {string}
 */
export function construirUrlOpenMeteo(opciones = {}) {
  const baseUrl =
    opciones.baseUrl || process.env.OPEN_METEO_BASE_URL || 'https://api.open-meteo.com/v1/forecast';

  const configZona = obtenerConfigZonaPiloto();
  const latitud = opciones.latitud ?? opciones.lat ?? configZona.latitud;
  const longitud = opciones.longitud ?? opciones.lon ?? configZona.longitud;

  const pastDays = opciones.pastDays ?? 4;
  const forecastDays = opciones.forecastDays ?? 1;

  const url = new URL(baseUrl);
  url.searchParams.set('latitude', String(latitud));
  url.searchParams.set('longitude', String(longitud));
  url.searchParams.set(
    'current',
    'precipitation,temperature_2m,relative_humidity_2m,wind_speed_10m'
  );
  url.searchParams.set('hourly', 'precipitation');
  url.searchParams.set('past_days', String(pastDays));
  url.searchParams.set('forecast_days', String(forecastDays));
  url.searchParams.set('timezone', 'UTC');

  return url.toString();
}

/**
 * Valida que un valor numérico sea finito o nulo/indefinido (convertible a null).
 * @param {*} val
 * @param {string} campo
 * @returns {number|null}
 */
function validarNumeroOColapsarNull(val, campo) {
  if (val === null || val === undefined) {
    return null;
  }
  if (typeof val === 'number' && Number.isFinite(val)) {
    return val;
  }
  throw new OpenMeteoError(`Valor no numérico en campo "${campo}": ${val}`, {
    codigo: 'RESPUESTA_CORRUPTA',
  });
}

/**
 * Valida la integridad estructural de la respuesta JSON y normaliza el contrato de datos.
 * @param {Object} data JSON crudo de Open-Meteo
 * @param {Object} coords Coordenadas consultadas
 * @returns {Object} Contrato normalizado
 */
export function validarYNormalizarRespuesta(data, coords = {}) {
  if (!data || typeof data !== 'object' || Array.isArray(data) || data.error === true) {
    throw new OpenMeteoError('Respuesta corrupta o con indicador de error de Open-Meteo', {
      codigo: 'RESPUESTA_CORRUPTA',
    });
  }

  // Validación de bloque current
  if (
    !data.current ||
    typeof data.current !== 'object' ||
    Array.isArray(data.current) ||
    typeof data.current.time !== 'string'
  ) {
    throw new OpenMeteoError('Respuesta corrupta: bloque current ausente o inválido', {
      codigo: 'RESPUESTA_CORRUPTA',
    });
  }

  if (data.current.interval !== undefined && data.current.interval !== null) {
    if (typeof data.current.interval !== 'number' || !Number.isFinite(data.current.interval) || data.current.interval <= 0) {
      throw new OpenMeteoError(
        `Respuesta corrupta: current.interval inválido (${data.current.interval})`,
        { codigo: 'RESPUESTA_CORRUPTA' }
      );
    }
  }

  // Validación de bloque hourly
  if (
    !data.hourly ||
    typeof data.hourly !== 'object' ||
    Array.isArray(data.hourly) ||
    !Array.isArray(data.hourly.time) ||
    !Array.isArray(data.hourly.precipitation) ||
    data.hourly.time.length === 0 ||
    data.hourly.time.length !== data.hourly.precipitation.length
  ) {
    throw new OpenMeteoError(
      'Respuesta corrupta: bloque hourly ausente, vacío o con longitud dispar',
      { codigo: 'RESPUESTA_CORRUPTA' }
    );
  }

  const observadoEn = normalizarMarcaIsoUtc(data.current.time);

  // Normalizar serie horaria validando tipos de datos
  const tiemposUtc = [];
  const precipitacionMm = [];

  for (let i = 0; i < data.hourly.time.length; i++) {
    tiemposUtc.push(normalizarMarcaIsoUtc(data.hourly.time[i]));

    const v = data.hourly.precipitation[i];
    if (v === null || v === undefined) {
      precipitacionMm.push(null);
    } else if (typeof v === 'number' && Number.isFinite(v)) {
      precipitacionMm.push(v);
    } else {
      throw new OpenMeteoError(
        `Respuesta corrupta: valor no numérico en hourly.precipitation[${i}]: ${v}`,
        { codigo: 'RESPUESTA_CORRUPTA' }
      );
    }
  }

  // Validar variables de current
  const precipActual = validarNumeroOColapsarNull(
    data.current.precipitation,
    'current.precipitation'
  );
  const tempActual = validarNumeroOColapsarNull(
    data.current.temperature_2m,
    'current.temperature_2m'
  );
  const humActual = validarNumeroOColapsarNull(
    data.current.relative_humidity_2m,
    'current.relative_humidity_2m'
  );
  const vientoActual = validarNumeroOColapsarNull(
    data.current.wind_speed_10m,
    'current.wind_speed_10m'
  );

  return {
    fuente: 'Open-Meteo',
    coordenada_consultada: {
      latitud: coords.latitud ?? null,
      longitud: coords.longitud ?? null,
    },
    coordenada_modelo: {
      latitud: typeof data.latitude === 'number' ? data.latitude : null,
      longitud: typeof data.longitude === 'number' ? data.longitude : null,
      elevacion_m: typeof data.elevation === 'number' ? data.elevation : null,
    },
    observado_en: observadoEn,
    intervalo_actual_segundos: data.current.interval ?? null,
    actual: {
      precipitacion_mm: precipActual,
      temperatura_c: tempActual,
      humedad_pct: humActual,
      viento_kmh: vientoActual,
    },
    serie_horaria: {
      tiempos_utc: tiemposUtc,
      precipitacion_mm: precipitacionMm,
    },
    unidades: {
      actual: data.current_units ?? null,
      horaria: data.hourly_units ?? null,
    },
  };
}

/**
 * Consulta la API de Open-Meteo con soporte para timeout por AbortController
 * e inyección opcional de fetchImpl para pruebas unitarias deterministas.
 * @param {Object} [opciones={}]
 * @returns {Promise<Object>} Contrato normalizado de salida
 */
export async function consultarOpenMeteo(opciones = {}) {
  const fetchImpl = opciones.fetchImpl || globalThis.fetch;
  const configZona = obtenerConfigZonaPiloto();
  const latitud = opciones.latitud ?? opciones.lat ?? configZona.latitud;
  const longitud = opciones.longitud ?? opciones.lon ?? configZona.longitud;

  const limiteMs = Number(
    opciones.timeoutMs ?? process.env.OPEN_METEO_TIMEOUT_MS ?? 8000
  );

  const url = construirUrlOpenMeteo({
    ...opciones,
    latitud,
    longitud,
  });

  const controller = new AbortController();
  const timer = setTimeout(() => {
    controller.abort();
  }, limiteMs);

  try {
    let response;
    try {
      response = await fetchImpl(url, {
        method: 'GET',
        headers: { Accept: 'application/json' },
        signal: controller.signal,
      });
    } catch (err) {
      if (err.name === 'AbortError' || controller.signal.aborted) {
        throw new OpenMeteoError('Tiempo de espera agotado al consultar Open-Meteo', {
          codigo: 'TIMEOUT',
          causaOriginal: err,
        });
      }
      throw new OpenMeteoError('Error de red al conectar con Open-Meteo', {
        codigo: 'RED_ERROR',
        causaOriginal: err,
      });
    }

    if (!response.ok) {
      throw new OpenMeteoError('Respuesta HTTP no exitosa de Open-Meteo', {
        codigo: 'HTTP_ERROR',
        statusHttp: response.status,
      });
    }

    let json;
    try {
      json = await response.json();
    } catch (jsonErr) {
      throw new OpenMeteoError('Cuerpo de respuesta no es un JSON válido', {
        codigo: 'RESPUESTA_CORRUPTA',
        causaOriginal: jsonErr,
      });
    }

    return validarYNormalizarRespuesta(json, { latitud, longitud });
  } finally {
    clearTimeout(timer);
  }
}

export default {
  OpenMeteoError,
  normalizarMarcaIsoUtc,
  normalizarFechaIsoUtc,
  construirUrlOpenMeteo,
  validarYNormalizarRespuesta,
  consultarOpenMeteo,
};
