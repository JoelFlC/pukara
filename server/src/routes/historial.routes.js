/**
 * @file historial.routes.js
 * @description Rutas para consultar el historial de evaluaciones del motor de reglas de PUKARA.
 */

import { Router } from 'express';
import { obtenerHistorialEvaluaciones } from '../services/evaluaciones.service.js';

export const historialRouter = Router();

/**
 * GET /api/historial
 * Consulta el historial de evaluaciones filtrado por modalidad ('real' o 'simulada')
 * con paginación controlada.
 * Query params:
 *  - modalidad: 'real' | 'simulada' (default: 'real')
 *  - limite: número entero entre 1 y 100 (default: 20)
 *  - offset: número entero >= 0 (default: 0)
 */
historialRouter.get('/', async (req, res, next) => {
  try {
    const modalidad = req.query.modalidad || 'real';
    if (modalidad !== 'real' && modalidad !== 'simulada') {
      return res.status(400).json({
        error: `Modalidad inválida: "${modalidad}". Debe ser "real" o "simulada".`,
      });
    }

    const { limite, offset } = req.query;
    const resultado = await obtenerHistorialEvaluaciones({
      modalidad,
      limite,
      offset,
    });

    res.json(resultado);
  } catch (error) {
    next(error);
  }
});

export default historialRouter;
