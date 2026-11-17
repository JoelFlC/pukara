/**
 * @file pwaRegister.js
 * @description Helpers para registro del Service Worker y gestión del ciclo de vida PWA
 * (Requisito P12, modo standalone y evento beforeinstallprompt de Android/Chrome).
 */

let promptDiferido = null;
let capturaInicializada = false;
const suscriptoresPrompt = new Set();

function notificarSuscriptores(listo) {
  suscriptoresPrompt.forEach((cb) => {
    try {
      cb(listo);
    } catch {}
  });
}

/**
 * Detecta si la aplicación está ejecutándose actualmente como PWA instalada en modo standalone.
 *
 * @returns {boolean}
 */
export function esModoStandalone() {
  if (typeof window === 'undefined') {
    return false;
  }

  const enDisplayMode = Boolean(
    window.matchMedia?.('(display-mode: standalone)')?.matches
  );
  const enNavigatorIos = Boolean(window.navigator?.standalone);

  return enDisplayMode || enNavigatorIos;
}

/**
 * Detecta de forma segura el tipo de dispositivo del navegador para adaptar
 * la guía de instalación móvil cuando beforeinstallprompt no está disponible (iOS / HTTP LAN).
 *
 * @returns {'ios' | 'android' | 'desktop'}
 */
export function detectarPlataformaMovil() {
  if (typeof navigator === 'undefined') {
    return 'desktop';
  }
  const ua = (navigator.userAgent || '').toLowerCase();
  const esIos =
    /iphone|ipad|ipod/.test(ua) ||
    (ua.includes('mac') && typeof document !== 'undefined' && 'ontouchend' in document);
  if (esIos) return 'ios';
  if (/android/.test(ua)) return 'android';
  return 'desktop';
}

/**
 * Indica si el navegador ya entregó un prompt nativo beforeinstallprompt listo para disparar.
 *
 * @returns {boolean}
 */
export function hayPromptInstalacionDisponible() {
  return Boolean(promptDiferido);
}

/**
 * Registra de forma temprana los listeners globales `beforeinstallprompt` y `appinstalled`
 * para no perder el evento antes de que React monte la interfaz.
 */
export function iniciarCapturaPromptInstalacion() {
  if (typeof window === 'undefined' || capturaInicializada) {
    return;
  }
  capturaInicializada = true;

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    promptDiferido = e;
    notificarSuscriptores(true);
  });

  window.addEventListener('appinstalled', () => {
    promptDiferido = null;
    notificarSuscriptores(false);
  });
}

/**
 * Registra el Service Worker de forma segura si el navegador lo soporta.
 *
 * @returns {Promise<ServiceWorkerRegistration|null>}
 */
export async function registrarServiceWorker() {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return null;
  }

  // En desarrollo VitePWA (devOptions.enabled) inyecta dev-sw.js automáticamente
  if (import.meta.env?.DEV) {
    return null;
  }

  try {
    const registro = await navigator.serviceWorker.register('/sw.js', {
      scope: '/',
    });
    return registro;
  } catch (err) {
    // En entornos sin HTTPS puede fallar sin comprometer el render
    console.debug('Service Worker no registrado:', err.message);
    return null;
  }
}

/**
 * Configura la suscripción al evento beforeinstallprompt de Android/Chrome.
 * Si el evento ya se capturó antes de montar el componente, notifica de inmediato.
 *
 * @param {Function} [alEstarListo] Callback invocado cuando la app es elegible para instalación
 * @returns {Function} Función para remover la suscripción
 */
export function configurarPromptInstalacion(alEstarListo) {
  if (typeof window === 'undefined') {
    return () => {};
  }

  iniciarCapturaPromptInstalacion();

  if (typeof alEstarListo === 'function') {
    suscriptoresPrompt.add(alEstarListo);
    if (promptDiferido) {
      alEstarListo(true);
    }
  }

  return () => {
    if (typeof alEstarListo === 'function') {
      suscriptoresPrompt.delete(alEstarListo);
    }
  };
}

/**
 * Dispara el prompt nativo de instalación si está disponible.
 *
 * @returns {Promise<boolean>} true si el usuario aceptó la instalación
 */
export async function dispararPromptInstalacion() {
  if (!promptDiferido) {
    return false;
  }

  try {
    promptDiferido.prompt();
    const eleccion = await promptDiferido.userChoice;
    if (eleccion?.outcome === 'accepted') {
      promptDiferido = null;
      notificarSuscriptores(false);
      return true;
    }
    return false;
  } catch (err) {
    console.warn('Error al disparar prompt de instalación:', err.message);
    promptDiferido = null;
    notificarSuscriptores(false);
    return false;
  }
}

export default {
  esModoStandalone,
  detectarPlataformaMovil,
  hayPromptInstalacionDisponible,
  iniciarCapturaPromptInstalacion,
  registrarServiceWorker,
  configurarPromptInstalacion,
  dispararPromptInstalacion,
};

