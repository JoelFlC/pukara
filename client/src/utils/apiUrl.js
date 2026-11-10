/**
 * @file apiUrl.js
 * @description Utilidad canónica para normalizar y construir URLs de la API de PUKARA.
 * Garantiza que cualquier ruta produzca siempre un único prefijo `/api` (/api/...)
 * evitando colisiones como /api/api/... tanto en desarrollo con proxy de Vite
 * como en producción o entornos con VITE_API_URL / VITE_API_BASE_URL.
 */

/**
 * Normaliza y construye la URL absoluta o relativa hacia un endpoint de la API.
 *
 * @param {string} [ruta=''] Ruta solicitada (ej. '/api/estado', '/estado', '/api/auth/login')
 * @param {string} [baseOverride] Sobrescritura opcional de la base
 * @returns {string} URL normalizada con exactamente un único prefijo `/api`
 */
export function construirUrlApi(ruta = '', baseOverride) {
  const baseRaw =
    baseOverride !== undefined
      ? baseOverride
      : (typeof import.meta !== 'undefined' && import.meta.env
          ? import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL || ''
          : '');

  let base = (baseRaw || '').trim().replace(/\/+$/, '');

  let path = (ruta || '').trim();
  if (!path.startsWith('/')) {
    path = `/${path}`;
  }

  // Si la ruta contiene querystring o hash, separamos para normalizar el pathname
  const [pathname, ...resto] = path.split(/([?#].*)/);
  const sufijo = resto.join('');

  // Remover prefijo /api o /api/ del pathname si ya lo incluye
  let cleanPath = pathname;
  if (cleanPath === '/api' || cleanPath === '/api/') {
    cleanPath = '';
  } else if (cleanPath.startsWith('/api/')) {
    cleanPath = cleanPath.slice(4);
  }

  // Si base termina en /api, se lo removemos para controlar nosotros el prefijo
  if (base.endsWith('/api')) {
    base = base.slice(0, -4);
  } else if (base === '/api') {
    base = '';
  }

  return `${base}/api${cleanPath}${sufijo}`;
}

export default construirUrlApi;

