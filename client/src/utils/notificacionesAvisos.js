/**
 * @file notificacionesAvisos.js
 * @description Módulo encapsulado de vibración háptica y notificaciones del sistema
 * (Notification API + Service Worker) para avisos preventivos locales de PUKARA.
 */

export const PATRONES_VIBRACION = {
  NORMAL: [100],
  PRECAUCION: [200, 100, 200],
  ALERTA: [300, 150, 300, 150, 300],
  EMERGENCIA: [500, 150, 500, 150, 500, 150, 500],
};

const ETIQUETAS_NIVEL = {
  NORMAL: 'NORMAL',
  PRECAUCION: 'PRECAUCIÓN',
  ALERTA: 'ALERTA',
  EMERGENCIA: 'EMERGENCIA',
};

const RESUMEN_PREVENTIVO_NIVEL = {
  NORMAL: 'Condiciones habituales de lluvia en el sector Llojeta.',
  PRECAUCION:
    'Precipitación moderada en Llojeta. Revise desagües y medidas preventivas generales.',
  ALERTA:
    'Lluvia intensa o suelo saturado en Llojeta. Mantenga distancia de quebradas y revise recomendaciones preventivas.',
  EMERGENCIA:
    'Lluvia crítica según umbrales académicos. Atienda indicaciones de autoridades y tenga a mano teléfonos 114 / 119.',
};

const LEYENDA_OFICIAL_OBLIGATORIA =
  'No sustituye alertas ni instrucciones oficiales.';

function obtenerNavigator() {
  if (typeof navigator !== 'undefined') {
    return navigator;
  }
  if (typeof globalThis !== 'undefined' && globalThis.navigator) {
    return globalThis.navigator;
  }
  return null;
}

function obtenerNotificationCtor() {
  if (typeof window !== 'undefined' && typeof window.Notification === 'function') {
    return window.Notification;
  }
  if (typeof globalThis !== 'undefined' && typeof globalThis.Notification === 'function') {
    return globalThis.Notification;
  }
  return null;
}

/**
 * Indica si el navegador soporta vibración háptica (`navigator.vibrate`).
 * @returns {boolean}
 */
export function soportaVibracion() {
  const nav = obtenerNavigator();
  return Boolean(nav && typeof nav.vibrate === 'function');
}

/**
 * Ejecuta el patrón háptico diferenciado para el nivel informativo.
 * @param {string} nivel
 * @returns {boolean}
 */
export function vibrarPorNivel(nivel) {
  const nav = obtenerNavigator();
  if (!nav || typeof nav.vibrate !== 'function') {
    return false;
  }

  const clave = typeof nivel === 'string' ? nivel.toUpperCase() : '';
  const patron = PATRONES_VIBRACION[clave];
  if (!patron) {
    return false;
  }

  try {
    return Boolean(nav.vibrate(patron));
  } catch {
    return false;
  }
}

/**
 * Detiene cualquier vibración en curso de forma segura.
 */
export function detenerVibracion() {
  const nav = obtenerNavigator();
  if (nav && typeof nav.vibrate === 'function') {
    try {
      nav.vibrate(0);
    } catch {
      // Ignorar si falla en entorno restringido
    }
  }
}

/**
 * Verifica si la página corre en un contexto seguro (HTTPS o localhost) donde
 * los navegadores móviles habilitan Notification API.
 * @returns {boolean}
 */
export function esContextoSeguroNotificaciones() {
  if (typeof window !== 'undefined' && typeof window.isSecureContext === 'boolean') {
    return window.isSecureContext;
  }
  return true;
}

/**
 * Indica si Notification API está disponible en el entorno actual.
 * @returns {boolean}
 */
export function soportaNotificaciones() {
  return obtenerNotificationCtor() !== null && esContextoSeguroNotificaciones();
}

/**
 * Devuelve el estado actual de permisos: 'granted' | 'denied' | 'default' | 'unsupported'.
 * @returns {'granted' | 'denied' | 'default' | 'unsupported'}
 */
export function obtenerEstadoPermisoNotificaciones() {
  if (!esContextoSeguroNotificaciones()) {
    return 'unsupported';
  }
  const NotifCtor = obtenerNotificationCtor();
  if (!NotifCtor) {
    return 'unsupported';
  }

  const permiso = NotifCtor.permission;
  if (permiso === 'granted' || permiso === 'denied' || permiso === 'default') {
    return permiso;
  }
  return 'default';
}

/**
 * Solicita permiso de notificaciones al navegador tras una acción explícita del usuario.
 * @returns {Promise<'granted' | 'denied' | 'default' | 'unsupported'>}
 */
export async function solicitarPermisoNotificaciones() {
  const estadoActual = obtenerEstadoPermisoNotificaciones();
  if (estadoActual === 'unsupported') {
    return 'unsupported';
  }
  if (estadoActual === 'granted' || estadoActual === 'denied') {
    return estadoActual;
  }

  const NotifCtor = obtenerNotificationCtor();
  if (!NotifCtor || typeof NotifCtor.requestPermission !== 'function') {
    return 'unsupported';
  }

  try {
    const resultado = await NotifCtor.requestPermission();
    if (resultado === 'granted' || resultado === 'denied' || resultado === 'default') {
      return resultado;
    }
    return obtenerEstadoPermisoNotificaciones();
  } catch {
    return 'denied';
  }
}

/**
 * Construye el título y las opciones de la notificación del sistema cumpliendo
 * estrictamente la semántica obligatoria de PUKARA.
 *
 * @param {string} nivel
 * @param {Object} [opciones]
 * @param {boolean} [opciones.esSimulacion=false]
 * @param {string|null} [opciones.fechaHora=null]
 * @returns {{ titulo: string, opciones: Object }}
 */
export function construirContenidoNotificacion(
  nivel,
  { esSimulacion = false, fechaHora = null } = {}
) {
  const clave =
    typeof nivel === 'string' && ETIQUETAS_NIVEL[nivel.toUpperCase()]
      ? nivel.toUpperCase()
      : 'NORMAL';
  const etiqueta = ETIQUETAS_NIVEL[clave];
  const sufijoSimulacion = esSimulacion ? ' [Simulación]' : '';

  const titulo = `PUKARA — Nivel informativo: ${etiqueta}${sufijoSimulacion}`;
  const resumen = RESUMEN_PREVENTIVO_NIVEL[clave];
  const parteFecha = fechaHora ? ` Lectura: ${fechaHora}.` : '';
  const body = `Nivel informativo de lluvia: ${etiqueta}. ${resumen}${parteFecha} ${LEYENDA_OFICIAL_OBLIGATORIA}`;

  return {
    titulo,
    opciones: {
      body,
      icon: '/pwa-192x192.png',
      badge: '/pwa-192x192.png',
      tag: 'pukara-nivel-informativo',
      renotify: true,
      vibrate: PATRONES_VIBRACION[clave],
      data: {
        nivel: clave,
        esSimulacion: Boolean(esSimulacion),
        url: '/',
      },
    },
  };
}

async function obtenerRegistroServiceWorkerConTimeout(timeoutMs = 1500) {
  const nav = obtenerNavigator();
  if (!nav || !nav.serviceWorker || !nav.serviceWorker.ready) {
    return null;
  }

  let timerId = null;
  try {
    const registro = await Promise.race([
      Promise.resolve(nav.serviceWorker.ready),
      new Promise((resolve) => {
        timerId = setTimeout(() => resolve(null), timeoutMs);
      }),
    ]);
    return registro || null;
  } catch {
    return null;
  } finally {
    if (timerId !== null) {
      clearTimeout(timerId);
    }
  }
}

/**
 * Muestra una notificación de nivel informativo usando ServiceWorkerRegistration.showNotification
 * cuando está disponible (Android PWA) o Notification como fallback web.
 *
 * @param {string} nivel
 * @param {Object} [params]
 * @param {boolean} [params.esSimulacion=false]
 * @param {string|null} [params.fechaHora=null]
 * @returns {Promise<{mostrada: boolean, canal: string|null, motivo?: string}>}
 */
export async function mostrarNotificacionNivel(
  nivel,
  { esSimulacion = false, fechaHora = null } = {}
) {
  const permiso = obtenerEstadoPermisoNotificaciones();
  if (permiso === 'unsupported') {
    return { mostrada: false, canal: null, motivo: 'no_soportado' };
  }
  if (permiso !== 'granted') {
    return { mostrada: false, canal: null, motivo: `permiso_${permiso}` };
  }

  const { titulo, opciones } = construirContenidoNotificacion(nivel, {
    esSimulacion,
    fechaHora,
  });

  try {
    const registro = await obtenerRegistroServiceWorkerConTimeout();
    if (registro && typeof registro.showNotification === 'function') {
      await registro.showNotification(titulo, opciones);
      return { mostrada: true, canal: 'service_worker' };
    }
  } catch {
    // Continuar con fallback de Notification directo
  }

  try {
    const NotifCtor = obtenerNotificationCtor();
    if (NotifCtor) {
      new NotifCtor(titulo, opciones);
      return { mostrada: true, canal: 'notification_api' };
    }
  } catch {
    return { mostrada: false, canal: null, motivo: 'error_notificacion' };
  }

  return { mostrada: false, canal: null, motivo: 'no_soportado' };
}

export default {
  PATRONES_VIBRACION,
  soportaVibracion,
  vibrarPorNivel,
  detenerVibracion,
  esContextoSeguroNotificaciones,
  soportaNotificaciones,
  obtenerEstadoPermisoNotificaciones,
  solicitarPermisoNotificaciones,
  construirContenidoNotificacion,
  mostrarNotificacionNivel,
};
