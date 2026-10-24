/**
 * @file api.js
 * @description Cliente HTTP para la comunicación con la API de PUKARA.
 */

const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api';

/**
 * Consulta el estado público integral del sistema PUKARA (v1).
 *
 * @param {Object} [opciones]
 * @param {AbortSignal} [opciones.signal]
 * @returns {Promise<Object>} Datos del endpoint GET /api/estado
 */
export async function consultarEstadoSistema({ signal } = {}) {
  const res = await fetch(`${API_BASE}/estado`, {
    signal,
    headers: {
      Accept: 'application/json',
    },
  });

  if (!res.ok) {
    throw new Error(
      `Error del servidor al consultar el estado (${res.status}): ${res.statusText || 'Error inesperado'}`
    );
  }

  return await res.json();
}

export default {
  consultarEstadoSistema,
};
