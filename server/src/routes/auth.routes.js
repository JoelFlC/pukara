import { Router } from 'express';
import {
  autenticarAdministrador,
  AuthError,
} from '../services/auth.service.js';
import {
  requerirAdministrador,
} from '../middleware/auth.middleware.js';
import { rateLimiterLogin } from '../middleware/rateLimit.middleware.js';

export const authRouter = Router();

/**
 * POST /api/auth/login
 * Inicia sesión administrativa mediante credenciales (email y password).
 * Protegido contra fuerza bruta con limitador de tasa en memoria.
 */
authRouter.post('/login', rateLimiterLogin, async (req, res) => {
  try {
    const resultado = await autenticarAdministrador(req.body);

    // En login exitoso, limpiamos el contador de la clave para no penalizar al usuario
    rateLimiterLogin.resetearClave(req);

    return res.status(200).json({
      ok: true,
      ...resultado,
    });
  } catch (err) {
    if (err instanceof AuthError) {
      return res.status(err.statusCode).json({
        ok: false,
        error: {
          codigo: err.codigo,
          mensaje: err.message,
        },
      });
    }

    console.error('[AUTH-LOGIN] Error interno inesperado:', err);
    return res.status(500).json({
      ok: false,
      error: {
        codigo: 'ERROR_INTERNO',
        mensaje: 'Ocurrió un error interno durante el proceso de autenticación.',
      },
    });
  }
});

/**
 * GET /api/auth/perfil
 * Verifica la vigencia del token y devuelve los datos del usuario autenticado.
 */
authRouter.get('/perfil', requerirAdministrador, (req, res) => {
  return res.status(200).json({
    ok: true,
    usuario: req.usuario,
  });
});

/**
 * GET /api/auth/verificar
 * Alias de verificación de sesión administrativa.
 */
authRouter.get('/verificar', requerirAdministrador, (req, res) => {
  return res.status(200).json({
    ok: true,
    usuario: req.usuario,
  });
});

