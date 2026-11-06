/**
 * @file api.js
 * @description Cliente HTTP para la comunicación con la API de PUKARA.
 * Funciona tanto con el proxy local de Vite (/api) como en producción mediante VITE_API_URL.
 */

const API_BASE = (
  import.meta.env.VITE_API_URL ||
  import.meta.env.VITE_API_BASE_URL ||
  ''
).replace(/\/+$/, '');

/**
 * Consulta el estado público integral del sistema PUKARA para la modalidad indicada.
 *
 * @param {string} [modalidad='real'] 'real' o 'simulada'
 * @param {Object} [opciones]
 * @param {AbortSignal} [opciones.signal]
 * @returns {Promise<Object>} Datos del endpoint GET /api/estado
 */
export async function obtenerEstadoSistema(modalidad = 'real', { signal } = {}) {
  const url = `${API_BASE}/api/estado?modalidad=${encodeURIComponent(modalidad)}`;
  const res = await fetch(url, {
    signal,
    headers: {
      Accept: 'application/json',
    },
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(
      errorData.error ||
        `Error del servidor al consultar el estado (${res.status}): ${res.statusText || 'Error inesperado'}`
    );
  }

  return await res.json();
}

/**
 * Alias retrocompatible para consultar el estado del sistema.
 *
 * @param {Object} [opciones]
 * @returns {Promise<Object>}
 */
export async function consultarEstadoSistema(opciones = {}) {
  const modalidad =
    typeof opciones === 'string'
      ? opciones
      : opciones?.modalidad || 'real';
  const signal = opciones?.signal;
  return obtenerEstadoSistema(modalidad, { signal });
}

/**
 * Consulta el historial de evaluaciones del motor de reglas para la modalidad dada.
 *
 * @param {string} [modalidad='real'] 'real' o 'simulada'
 * @param {number} [limite=10] Cantidad máxima de registros
 * @param {Object} [opciones]
 * @param {AbortSignal} [opciones.signal]
 * @returns {Promise<Object>} Datos del endpoint GET /api/historial
 */
export async function obtenerHistorialEvaluaciones(
  modalidad = 'real',
  limite = 10,
  { signal } = {}
) {
  const url = `${API_BASE}/api/historial?modalidad=${encodeURIComponent(modalidad)}&limite=${encodeURIComponent(limite)}`;
  const res = await fetch(url, {
    signal,
    headers: {
      Accept: 'application/json',
    },
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(
      errorData.error ||
        `Error del servidor al consultar el historial (${res.status}): ${res.statusText || 'Error inesperado'}`
    );
  }

  return await res.json();
}

/**
 * Registra y evalúa una lectura meteorológica simulada (Prueba P11).
 *
 * @param {Object} payload Datos de la lectura simulada
 * @param {Object} [opciones]
 * @param {AbortSignal} [opciones.signal]
 * @returns {Promise<Object>} Respuesta del endpoint POST /api/simulacion/lectura
 */
export async function enviarLecturaSimulada(payload, { signal } = {}) {
  const url = `${API_BASE}/api/simulacion/lectura`;
  const res = await fetch(url, {
    method: 'POST',
    signal,
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(
      errorData.error ||
        `Error del servidor al registrar lectura simulada (${res.status}): ${res.statusText || 'Error inesperado'}`
    );
  }

  return await res.json();
}

/**
 * Limpia todas las lecturas y evaluaciones de modalidad simulada (Prueba P11).
 *
 * @param {Object} [opciones]
 * @param {AbortSignal} [opciones.signal]
 * @returns {Promise<Object>} Respuesta del endpoint DELETE /api/simulacion
 */
export async function limpiarSimulacion({ signal } = {}) {
  const url = `${API_BASE}/api/simulacion`;
  const res = await fetch(url, {
    method: 'DELETE',
    signal,
    headers: {
      Accept: 'application/json',
    },
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(
      errorData.error ||
        `Error del servidor al limpiar datos simulados (${res.status}): ${res.statusText || 'Error inesperado'}`
    );
  }

  return await res.json();
}

export default {
  obtenerEstadoSistema,
  consultarEstadoSistema,
  obtenerHistorialEvaluaciones,
  enviarLecturaSimulada,
  limpiarSimulacion,
};
