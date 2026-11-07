/**
 * @file haversine.js
 * @description Módulo puro para cálculo de distancia geodésica mediante la fórmula de Haversine (Requisito P18).
 * Cumple con la directriz de GEMINI.md:
 * - El cálculo se realiza 100% en el dispositivo/cliente (sin enviar el GPS del usuario al servidor ni a la red).
 * - La distancia se rotula de forma obligatoria como:
 *   "distancia aproximada en línea recta (no es recomendación de ruta ni indica seguridad)".
 */

export const LEYENDA_DISTANCIA_HAVERSINE =
  'distancia aproximada en línea recta (no es recomendación de ruta ni indica seguridad)';

export const RADIO_TIERRA_KM_DEFAULT = 6371;

/**
 * Valida si un par de coordenadas (latitud, longitud) representan valores geográficos válidos.
 *
 * @param {*} latitud
 * @param {*} longitud
 * @returns {boolean}
 */
export function esCoordenadaValida(latitud, longitud) {
  if (
    latitud === null ||
    latitud === undefined ||
    typeof latitud === 'boolean' ||
    longitud === null ||
    longitud === undefined ||
    typeof longitud === 'boolean'
  ) {
    return false;
  }

  if (typeof latitud === 'string' && latitud.trim() === '') {
    return false;
  }
  if (typeof longitud === 'string' && longitud.trim() === '') {
    return false;
  }

  const lat = Number(latitud);
  const lon = Number(longitud);

  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return false;
  }

  return lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180;
}

/**
 * Extrae latitud y longitud de un objeto coordenada genérico ({ latitud, longitud } o { lat, lng } o { lat, lon }).
 *
 * @param {Object} coord
 * @returns {{ lat: number, lon: number } | null}
 */
function extraerCoordenadas(coord) {
  if (!coord || typeof coord !== 'object') {
    return null;
  }

  const rawLat = coord.latitud !== undefined ? coord.latitud : coord.lat;
  const rawLon =
    coord.longitud !== undefined
      ? coord.longitud
      : coord.lng !== undefined
        ? coord.lng
        : coord.lon;

  if (!esCoordenadaValida(rawLat, rawLon)) {
    return null;
  }

  return {
    lat: Number(rawLat),
    lon: Number(rawLon),
  };
}

/**
 * Calcula la distancia ortodrómica entre dos puntos mediante la fórmula exacta de Haversine.
 *
 * @param {Object} origen { latitud, longitud } o { lat, lng }
 * @param {Object} destino { latitud, longitud } o { lat, lng }
 * @param {Object} [opciones={}]
 * @param {number} [opciones.radioTierraKm=6371] Radio medio de la Tierra en km
 * @returns {{
 *   metros: number,
 *   kilometros: number,
 *   distanciaCorta: string,
 *   textoFormateado: string,
 *   leyenda: string
 * }}
 * @throws {TypeError} Si alguna coordenada es inválida
 */
export function distanciaHaversine(origen, destino, opciones = {}) {
  const coord1 = extraerCoordenadas(origen);
  const coord2 = extraerCoordenadas(destino);

  if (!coord1 || !coord2) {
    throw new TypeError(
      'Coordenadas geográficas inválidas para el cálculo Haversine'
    );
  }

  const R_KM =
    typeof opciones.radioTierraKm === 'number' && opciones.radioTierraKm > 0
      ? opciones.radioTierraKm
      : RADIO_TIERRA_KM_DEFAULT;

  const lat1Rad = (coord1.lat * Math.PI) / 180;
  const lon1Rad = (coord1.lon * Math.PI) / 180;
  const lat2Rad = (coord2.lat * Math.PI) / 180;
  const lon2Rad = (coord2.lon * Math.PI) / 180;

  const dLat = lat2Rad - lat1Rad;
  const dLon = lon2Rad - lon1Rad;

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1Rad) * Math.cos(lat2Rad) * Math.sin(dLon / 2) ** 2;

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(Math.max(0, 1 - a)));

  const distanciaKm = R_KM * c;
  const distanciaMetros = distanciaKm * 1000;
  const metrosRedondeados = Math.round(distanciaMetros);

  const distanciaCorta =
    metrosRedondeados < 1000
      ? `${metrosRedondeados} m`
      : `${Number(distanciaKm.toFixed(2))} km`;

  const textoFormateado = `${distanciaCorta} (${LEYENDA_DISTANCIA_HAVERSINE})`;

  return {
    metros: metrosRedondeados,
    kilometros: Number(distanciaKm.toFixed(3)),
    distanciaCorta,
    textoFormateado,
    leyenda: LEYENDA_DISTANCIA_HAVERSINE,
  };
}

/**
 * Enriquece una lista de puntos de referencia con su distancia calculada en el cliente
 * respecto a la ubicación del usuario, sin emitir peticiones de red.
 *
 * @param {Object|null} ubicacionUsuario { latitud, longitud } o { lat, lng }
 * @param {Array<Object>} [puntosReferencia=[]]
 * @returns {Array<Object>} Copia de los puntos con propiedad `distancia`
 */
export function calcularDistanciasAPuntos(ubicacionUsuario, puntosReferencia = []) {
  if (!Array.isArray(puntosReferencia)) {
    return [];
  }

  const coordUsuario = extraerCoordenadas(ubicacionUsuario);

  if (!coordUsuario) {
    return puntosReferencia.map((punto) => ({
      ...punto,
      distancia: null,
    }));
  }

  return puntosReferencia.map((punto) => {
    try {
      const coordPunto = extraerCoordenadas({
        latitud: punto?.latitud,
        longitud: punto?.longitud,
      });

      if (!coordPunto) {
        return {
          ...punto,
          distancia: null,
        };
      }

      const calculo = distanciaHaversine(coordUsuario, coordPunto);
      return {
        ...punto,
        distancia: calculo,
      };
    } catch {
      return {
        ...punto,
        distancia: null,
      };
    }
  });
}

export default {
  LEYENDA_DISTANCIA_HAVERSINE,
  RADIO_TIERRA_KM_DEFAULT,
  esCoordenadaValida,
  distanciaHaversine,
  calcularDistanciasAPuntos,
};

