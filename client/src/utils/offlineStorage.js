/**
 * @file offlineStorage.js
 * @description Módulo de persistencia local y leyenda offline determinista (Sección 9.4 y Requisito P08).
 * Permite almacenar y recuperar el último estado válido de GET /api/estado para garantizar
 * disponibilidad inmediata en modo avión o pérdida de conectividad, rotulado obligatoriamente como:
 * "Datos del [fecha y hora], no actualizados".
 */

export const CLAVE_ULTIMO_ESTADO_OFFLINE = 'pukara_ultimo_estado_almacenado_v1';

/**
 * Obtiene de forma segura la instancia de localStorage en cualquier entorno (Browser / SSR / Node / Vitest).
 *
 * @returns {Storage|null}
 */
function obtenerStorage() {
  if (typeof window !== 'undefined' && window.localStorage) {
    return window.localStorage;
  }
  if (typeof globalThis !== 'undefined' && globalThis.localStorage) {
    return globalThis.localStorage;
  }
  return null;
}

/**
 * Convierte una marca temporal ISO en una cadena legible en español ('DD/MM/YYYY HH:mm' en hora local de La Paz).
 *
 * @param {string|Date|null|undefined} fechaIso
 * @returns {string} Fecha y hora legible o 'fecha desconocida' si es inválida
 */
export function formatearFechaHoraOffline(fechaIso) {
  if (!fechaIso) {
    return 'fecha desconocida';
  }

  const d = typeof fechaIso === 'string' ? new Date(fechaIso) : fechaIso;
  if (!(d instanceof Date) || Number.isNaN(d.getTime())) {
    return 'fecha desconocida';
  }

  try {
    const opciones = {
      timeZone: 'America/La_Paz',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    };

    return new Intl.DateTimeFormat('es-BO', opciones).format(d);
  } catch {
    // Fallback estándar en entornos sin datos IANA completos
    const pad = (n) => String(n).padStart(2, '0');
    return `${pad(d.getUTCDate())}/${pad(d.getUTCMonth() + 1)}/${d.getUTCFullYear()} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
  }
}

/**
 * Construye el aviso textual obligatorio para datos visualizados sin conexión (GEMINI.md Sección 5 y 9.4).
 *
 * @param {string|Date|null|undefined} fechaIso
 * @returns {string} "Datos del [fecha y hora], no actualizados"
 */
export function construirAvisoDatosNoActualizados(fechaIso) {
  return `Datos del ${formatearFechaHoraOffline(fechaIso)}, no actualizados`;
}

/**
 * Guarda en localStorage el último estado exitoso del sistema recibido del backend.
 *
 * @param {Object} datosEstado
 * @returns {Object|null} Objeto empaquetado guardado o null si los datos son inválidos
 */
export function guardarUltimoEstadoLocal(datosEstado) {
  if (!datosEstado || typeof datosEstado !== 'object') {
    return null;
  }

  // Evitar persistir respuestas de error
  if (datosEstado.ok === false && !datosEstado.nivel_vigente && !datosEstado.estado_sistema) {
    return null;
  }

  const storage = obtenerStorage();
  if (!storage) {
    return null;
  }

  const fechaReferencia =
    datosEstado.lectura?.observado_en ||
    datosEstado.meteorologia?.observado_en ||
    datosEstado.meteorologia?.lectura?.observado_en ||
    datosEstado.evaluacion?.evaluada_en ||
    datosEstado.observado_en ||
    datosEstado.consultado_en ||
    new Date().toISOString();

  const paquete = {
    datos: datosEstado,
    fecha_dato_iso: fechaReferencia,
    guardado_en_iso: new Date().toISOString(),
    aviso_offline: construirAvisoDatosNoActualizados(fechaReferencia),
  };

  try {
    storage.setItem(CLAVE_ULTIMO_ESTADO_OFFLINE, JSON.stringify(paquete));
    return paquete;
  } catch (err) {
    console.warn('No se pudo guardar el estado en localStorage:', err.message);
    return null;
  }
}

/**
 * Recupera de forma segura el último estado persistido en localStorage.
 *
 * @returns {Object|null} Objeto con { datos, fecha_dato_iso, guardado_en_iso, aviso_offline } o null
 */
export function obtenerUltimoEstadoLocal() {
  const storage = obtenerStorage();
  if (!storage) {
    return null;
  }

  try {
    const raw = storage.getItem(CLAVE_ULTIMO_ESTADO_OFFLINE);
    if (!raw) {
      return null;
    }

    const parseado = JSON.parse(raw);
    if (!parseado || typeof parseado !== 'object' || !parseado.datos) {
      return null;
    }

    return parseado;
  } catch (err) {
    console.warn('Registro offline corrupto en localStorage:', err.message);
    return null;
  }
}

/**
 * Limpia el último estado guardado en localStorage.
 */
export function limpiarUltimoEstadoLocal() {
  const storage = obtenerStorage();
  if (storage) {
    try {
      storage.removeItem(CLAVE_ULTIMO_ESTADO_OFFLINE);
    } catch {}
  }
}

export default {
  CLAVE_ULTIMO_ESTADO_OFFLINE,
  formatearFechaHoraOffline,
  construirAvisoDatosNoActualizados,
  guardarUltimoEstadoLocal,
  obtenerUltimoEstadoLocal,
  limpiarUltimoEstadoLocal,
};

