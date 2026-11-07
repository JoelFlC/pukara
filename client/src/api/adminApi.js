/**
 * @file adminApi.js
 * @description Cliente de API para autenticación y operaciones del panel de administración en PUKARA.
 */

const API_BASE = (
  import.meta.env.VITE_API_URL ||
  import.meta.env.VITE_API_BASE_URL ||
  ''
).replace(/\/+$/, '');

const TOKEN_KEY = 'pukara_admin_token';
const USER_KEY = 'pukara_admin_user';

function obtenerAlmacenamiento() {
  if (typeof window !== 'undefined' && window.localStorage) {
    return window.localStorage;
  }
  if (typeof globalThis !== 'undefined' && globalThis.localStorage) {
    return globalThis.localStorage;
  }
  return null;
}

/**
 * Obtiene el token JWT almacenado en localStorage.
 * @returns {string|null}
 */
export function obtenerTokenAdmin() {
  const storage = obtenerAlmacenamiento();
  return storage ? storage.getItem(TOKEN_KEY) : null;
}

/**
 * Guarda el token JWT en localStorage.
 * @param {string} token
 */
export function guardarTokenAdmin(token) {
  const storage = obtenerAlmacenamiento();
  if (storage) {
    storage.setItem(TOKEN_KEY, token);
  }
}

/**
 * Obtiene el usuario autenticado almacenado en localStorage.
 * @returns {Object|null}
 */
export function obtenerUsuarioAdmin() {
  const storage = obtenerAlmacenamiento();
  if (!storage) return null;
  const raw = storage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * Guarda los datos del usuario en localStorage.
 * @param {Object} usuario
 */
export function guardarUsuarioAdmin(usuario) {
  const storage = obtenerAlmacenamiento();
  if (storage) {
    storage.setItem(USER_KEY, JSON.stringify(usuario));
  }
}

/**
 * Cierra la sesión administrativa eliminando los datos de localStorage.
 */
export function logoutAdmin() {
  const storage = obtenerAlmacenamiento();
  if (storage) {
    storage.removeItem(TOKEN_KEY);
    storage.removeItem(USER_KEY);
  }
}

/**
 * Helper interno para peticiones autenticadas con Bearer token.
 *
 * @param {string} endpoint
 * @param {RequestInit} [opciones={}]
 * @returns {Promise<any>}
 */
async function fetchAutenticado(endpoint, opciones = {}) {
  const token = obtenerTokenAdmin();
  const headers = {
    Accept: 'application/json',
    ...(opciones.headers || {}),
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  if (opciones.body && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  const res = await fetch(`${API_BASE}${endpoint}`, {
    ...opciones,
    headers,
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const errorObj = new Error(
      data.error?.mensaje ||
        data.error ||
        data.message ||
        `Error del servidor (${res.status})`
    );
    errorObj.status = res.status;
    errorObj.codigo = data.error?.codigo || 'ERROR_PETICION';
    errorObj.detalles = data.error?.detalles || [];
    throw errorObj;
  }

  return data;
}

// ===========================================================================
// 1. AUTENTICACIÓN
// ===========================================================================

/**
 * Inicia sesión administrativa con email y password.
 *
 * @param {string} email
 * @param {string} password
 * @returns {Promise<{ ok: boolean, token: string, usuario: Object }>}
 */
export async function loginAdmin(email, password) {
  const res = await fetch(`${API_BASE}/api/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({ email, password }),
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const err = new Error(
      data.error?.mensaje ||
        data.error ||
        'Error de autenticación'
    );
    err.status = res.status;
    err.codigo = data.error?.codigo || 'ERROR_LOGIN';
    throw err;
  }

  if (data.token) {
    guardarTokenAdmin(data.token);
  }
  if (data.usuario) {
    guardarUsuarioAdmin(data.usuario);
  }

  return data;
}

/**
 * Verifica la validez del token actual del administrador.
 * @returns {Promise<{ ok: boolean, usuario: Object }>}
 */
export async function verificarSesionAdmin() {
  return await fetchAutenticado('/api/auth/verificar');
}

// ===========================================================================
// 2. CONFIGURACIONES Y UMBRALES (P05 / P16)
// ===========================================================================

export async function obtenerConfiguracionesAdmin() {
  const data = await fetchAutenticado('/api/admin/configuraciones');
  return data.versiones || [];
}

export async function crearConfiguracionAdmin(payload) {
  return await fetchAutenticado('/api/admin/configuraciones', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function activarConfiguracionAdmin(id, motivo = null) {
  return await fetchAutenticado(`/api/admin/configuraciones/${id}/activar`, {
    method: 'POST',
    body: JSON.stringify({ motivo }),
  });
}

// ===========================================================================
// 3. RECOMENDACIONES PREVENTIVAS
// ===========================================================================

export async function obtenerRecomendacionesAdmin() {
  const data = await fetchAutenticado('/api/admin/recomendaciones');
  return data.recomendaciones || [];
}

export async function crearRecomendacionAdmin(payload) {
  return await fetchAutenticado('/api/admin/recomendaciones', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function actualizarRecomendacionAdmin(id, payload) {
  return await fetchAutenticado(`/api/admin/recomendaciones/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

// ===========================================================================
// 4. CONTACTOS DE EMERGENCIA
// ===========================================================================

export async function obtenerContactosAdmin() {
  const data = await fetchAutenticado('/api/admin/contactos');
  return data.contactos || [];
}

export async function crearContactoAdmin(payload) {
  return await fetchAutenticado('/api/admin/contactos', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function actualizarContactoAdmin(id, payload) {
  return await fetchAutenticado(`/api/admin/contactos/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

// ===========================================================================
// 5. CAPAS Y PUNTOS DE REFERENCIA CARTOGRÁFICA
// ===========================================================================

export async function obtenerCapasAdmin() {
  return await fetchAutenticado('/api/admin/capas');
}

export async function actualizarZonaAdmin(id, payload) {
  return await fetchAutenticado(`/api/admin/zonas/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export async function actualizarPuntoAdmin(id, payload) {
  return await fetchAutenticado(`/api/admin/puntos/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

// ===========================================================================
// 6. BITÁCORA DE CAMBIOS
// ===========================================================================

export async function obtenerBitacoraAdmin(params = {}) {
  const query = new URLSearchParams();
  if (params.limite) query.set('limite', String(params.limite));
  if (params.entidad) query.set('entidad', params.entidad);

  const qs = query.toString() ? `?${query.toString()}` : '';
  const data = await fetchAutenticado(`/api/admin/bitacora${qs}`);
  return data.registros || [];
}

// ===========================================================================
// 7. SIMULACIÓN ADMINISTRATIVA (CON BITÁCORA)
// ===========================================================================

export async function inyectarLecturaSimuladaAdmin(payload) {
  return await fetchAutenticado('/api/admin/simulacion/lectura', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function limpiarSimulacionAdmin() {
  return await fetchAutenticado('/api/admin/simulacion', {
    method: 'DELETE',
  });
}

export default {
  obtenerTokenAdmin,
  guardarTokenAdmin,
  obtenerUsuarioAdmin,
  guardarUsuarioAdmin,
  logoutAdmin,
  loginAdmin,
  verificarSesionAdmin,
  obtenerConfiguracionesAdmin,
  crearConfiguracionAdmin,
  activarConfiguracionAdmin,
  obtenerRecomendacionesAdmin,
  crearRecomendacionAdmin,
  actualizarRecomendacionAdmin,
  obtenerContactosAdmin,
  crearContactoAdmin,
  actualizarContactoAdmin,
  obtenerCapasAdmin,
  actualizarZonaAdmin,
  actualizarPuntoAdmin,
  obtenerBitacoraAdmin,
  inyectarLecturaSimuladaAdmin,
  limpiarSimulacionAdmin,
};

