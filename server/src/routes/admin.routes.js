import { Router } from 'express';
import {
  requerirAutenticacion,
  requerirRol,
} from '../middleware/auth.middleware.js';

export const adminRouter = Router();

// Aplica autenticación y autorización de rol 'administrador' a todas las rutas de administración
adminRouter.use(requerirAutenticacion, requerirRol('administrador'));

/**
 * GET /api/admin/resumen
 * Endpoint base de verificación de privilegios y resumen administrativo.
 */
adminRouter.get('/resumen', (req, res) => {
  return res.status(200).json({
    ok: true,
    mensaje: 'Acceso de administración verificado',
    usuario: req.usuario,
    aviso:
      'Los niveles Normal, Precaución, Alerta y Emergencia son niveles informativos de lluvia calculados con umbrales académicos.',
  });
});

