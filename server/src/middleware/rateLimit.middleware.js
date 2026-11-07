/**
 * @file rateLimit.middleware.js
 * @description Limitador de tasa de peticiones en memoria para el endpoint de login.
 * Implementado sin dependencias externas pesadas, con limpieza automática de ventanas expiradas.
 */

/**
 * Obtiene la dirección IP del cliente a partir de la petición Express.
 *
 * @param {import('express').Request} req
 * @returns {string}
 */
export function obtenerIpCliente(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.length > 0) {
    return forwarded.split(',')[0].trim();
  }
  return req.ip || req.socket?.remoteAddress || '127.0.0.1';
}

/**
 * Genera una clave de identificación única para el rate limiter combinando IP y email opcional.
 *
 * @param {import('express').Request} req
 * @returns {string}
 */
export function construirClaveRateLimit(req) {
  const ip = obtenerIpCliente(req);
  const email =
    typeof req.body?.email === 'string'
      ? req.body.email.trim().toLowerCase()
      : '*';
  return `${ip}::${email}`;
}

/**
 * Fábrica para instanciar limitadores de login configurables.
 *
 * @param {Object} [opciones={}]
 * @param {number} [opciones.windowMs] Ventana de tiempo en milisegundos (por defecto 15 min)
 * @param {number} [opciones.maxIntentos] Cantidad máxima permitida de intentos (por defecto 5)
 * @returns {import('express').RequestHandler & { limpiar: () => void, resetearClave: (req: any) => void }}
 */
export function crearRateLimiterLogin(opciones = {}) {
  const windowMs =
    Number(opciones.windowMs) ||
    Number(process.env.LOGIN_RATE_LIMIT_WINDOW_MS) ||
    15 * 60 * 1000;

  const maxIntentos =
    Number(opciones.maxIntentos) ||
    Number(process.env.LOGIN_RATE_LIMIT_MAX) ||
    5;

  // Almacenamiento en memoria: Map<clave, { count: number, primerIntento: number }>
  const intentos = new Map();

  const middleware = (req, res, next) => {
    const clave = construirClaveRateLimit(req);
    const ahora = Date.now();

    const registro = intentos.get(clave);

    if (!registro || ahora - registro.primerIntento > windowMs) {
      // Primera petición o ventana expirada: iniciar nuevo ciclo
      intentos.set(clave, { count: 1, primerIntento: ahora });
      return next();
    }

    // Ventana aún vigente
    if (registro.count >= maxIntentos) {
      const segundosRestantes = Math.max(
        1,
        Math.ceil((registro.primerIntento + windowMs - ahora) / 1000)
      );

      res.setHeader('Retry-After', String(segundosRestantes));
      return res.status(429).json({
        ok: false,
        error: {
          codigo: 'DEMASIADOS_INTENTOS',
          mensaje:
            'Demasiados intentos de inicio de sesión. Intente nuevamente más tarde.',
        },
      });
    }

    registro.count += 1;
    return next();
  };

  middleware.limpiar = () => {
    intentos.clear();
  };

  middleware.resetearClave = (req) => {
    const clave = typeof req === 'string' ? req : construirClaveRateLimit(req);
    intentos.delete(clave);
  };

  return middleware;
}

/**
 * Instancia singleton por defecto para el endpoint de login.
 */
export const rateLimiterLogin = crearRateLimiterLogin();

/**
 * Restablece el almacén de intentos del limitador por defecto (ideal para before/afterEach en tests).
 */
export function limpiarRateLimiterLogin() {
  rateLimiterLogin.limpiar();
}

