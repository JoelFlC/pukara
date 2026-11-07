import { verificarTokenAcceso, AuthError } from '../services/auth.service.js';

/**
 * Extrae el token Bearer del encabezado Authorization de la petición HTTP.
 *
 * @param {import('express').Request} req
 * @returns {string|null} Token extraído o null si no existe o no tiene formato válido
 */
export function extraerTokenBearer(req) {
  const authHeader = req?.headers?.authorization;
  if (!authHeader || typeof authHeader !== 'string') {
    return null;
  }

  const match = authHeader.match(/^Bearer\s+(\S+)$/i);
  return match ? match[1] : null;
}

/**
 * Middleware que exige la presencia de un token JWT Bearer válido.
 * Si es válido, inyecta `req.usuario` con el payload decodificado.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
export function requerirAutenticacion(req, res, next) {
  const token = extraerTokenBearer(req);

  if (!token) {
    return res.status(401).json({
      ok: false,
      error: {
        codigo: 'TOKEN_FALTANTE',
        mensaje: 'Se requiere token de autenticación Bearer.',
      },
    });
  }

  try {
    const payload = verificarTokenAcceso(token);
    req.usuario = payload;
    return next();
  } catch (err) {
    if (err instanceof AuthError) {
      return res.status(err.statusCode || 401).json({
        ok: false,
        error: {
          codigo: err.codigo,
          mensaje: err.message,
        },
      });
    }

    return res.status(401).json({
      ok: false,
      error: {
        codigo: 'TOKEN_INVALIDO',
        mensaje: 'Token de autenticación inválido.',
      },
    });
  }
}

/**
 * Genera un middleware que restringe el acceso a los roles especificados.
 *
 * @param  {...string} rolesPermitidos Lista de nombres de rol permitidos
 * @returns {import('express').RequestHandler}
 */
export function requerirRol(...rolesPermitidos) {
  return (req, res, next) => {
    if (!req.usuario) {
      return res.status(401).json({
        ok: false,
        error: {
          codigo: 'TOKEN_FALTANTE',
          mensaje: 'Se requiere autenticación previa para verificar permisos de rol.',
        },
      });
    }

    if (!rolesPermitidos.includes(req.usuario.rol)) {
      return res.status(403).json({
        ok: false,
        error: {
          codigo: 'ROL_INSUFICIENTE',
          mensaje:
            'No tiene permisos suficientes para acceder a este recurso de administración.',
        },
      });
    }

    return next();
  };
}

/**
 * Middleware compuesto para rutas administrativas restringidas a rol 'administrador'.
 */
export const requerirAdministrador = [
  requerirAutenticacion,
  requerirRol('administrador'),
];

