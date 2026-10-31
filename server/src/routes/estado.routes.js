import { Router } from 'express';
import {
  obtenerEstadoActualSistema,
  obtenerEstadoPublicoV1,
} from '../services/estado.service.js';

export const estadoRouter = Router();

/**
 * GET /api/estado
 * Endpoint público principal de PUKARA.
 * Acepta query param opcional: ?modalidad=real|simulada (default 'real').
 */
estadoRouter.get('/', async (req, res, next) => {
  try {
    const modalidad = req.query.modalidad || 'real';
    if (modalidad !== 'real' && modalidad !== 'simulada') {
      return res.status(400).json({
        error: `Modalidad inválida: "${modalidad}". Debe ser "real" o "simulada".`,
      });
    }

    const estado = await obtenerEstadoActualSistema({ modalidad });
    res.json(estado);
  } catch (error) {
    next(error);
  }
});

export default estadoRouter;

