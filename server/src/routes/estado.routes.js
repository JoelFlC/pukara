import { Router } from 'express';
import { obtenerEstadoPublicoV1 } from '../services/estado.service.js';

export const estadoRouter = Router();

/**
 * GET /api/estado
 * Endpoint público principal de PUKARA (v1).
 * Devuelve el estado actual de la lectura meteorológica en Llojeta, metadatos,
 * capas/puntos de referencia de demostración, recomendaciones y contactos.
 */
estadoRouter.get('/', async (req, res, next) => {
  try {
    const estado = await obtenerEstadoPublicoV1();
    res.json(estado);
  } catch (error) {
    next(error);
  }
});

export default estadoRouter;
