/**
 * @file pwaRegister.js
 * @description Helpers para registro del Service Worker y gestión del ciclo de vida PWA
 * (Requisito P12, modo standalone y evento beforeinstallprompt de Android/Chrome).
 */

let promptDiferido = null;

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
 * Registra el Service Worker de forma segura si el navegador lo soporta.
 *
 * @returns {Promise<ServiceWorkerRegistration|null>}
 */
export async function registrarServiceWorker() {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return null;
  }

  try {
    const registro = await navigator.serviceWorker.register('/sw.js', {
      scope: '/',
    });
    return registro;
  } catch (err) {
    // En entornos de desarrollo o tests locales sin HTTPS puede fallar sin comprometer el render
    console.debug('Service Worker no registrado:', err.message);
    return null;
  }
}

/**
 * Configura el listener del evento beforeinstallprompt de Android/Chrome.
 *
 * @param {Function} [alEstarListo] Callback invocado cuando la app es elegible para instalación
 * @returns {Function} Función para remover el listener
 */
export function configurarPromptInstalacion(alEstarListo) {
  if (typeof window === 'undefined') {
    return () => {};
  }

  const manejador = (e) => {
    // Prevenir el banner automático intrusivo del navegador para controlarlo en la UI
    e.preventDefault();
    promptDiferido = e;

    if (typeof alEstarListo === 'function') {
      alEstarListo(true);
    }
  };

  window.addEventListener('beforeinstallprompt', manejador);

  return () => {
    window.removeEventListener('beforeinstallprompt', manejador);
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
    promptDiferido = null;
    return eleccion.outcome === 'accepted';
  } catch (err) {
    console.warn('Error al disparar prompt de instalación:', err.message);
    promptDiferido = null;
    return false;
  }
}

export default {
  esModoStandalone,
  registrarServiceWorker,
  configurarPromptInstalacion,
  dispararPromptInstalacion,
};

