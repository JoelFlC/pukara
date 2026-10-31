/**
 * @file simulacion.routes.js
 * @description Rutas para la gestión de lecturas y evaluaciones simuladas en PUKARA.
 * Proporciona endpoints para registrar lecturas simuladas y limpiar datos de simulación
 * garantizando aislamiento absoluto de los datos reales (Prueba P11).
 */

import { Router } from 'express';
import {
  registrarYEvaluarLecturaSimulada,
  limpiarDatosSimulados,
} from '../services/simulacion.service.js';

export const simulacionRouter = Router();

/**
 * POST /api/simulacion/lectura
 * Registra una lectura meteorológica simulada y la evalúa contra las reglas vigentes.
 */
simulacionRouter.post('/lectura', async (req, res, next) => {
  try {
    const datos = req.body || {};
    const resultado = await registrarYEvaluarLecturaSimulada(datos);
    res.status(201).json(resultado);
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/simulacion
 * Limpia todas las lecturas y evaluaciones de modalidad simulada sin alterar datos reales.
 */
simulacionRouter.delete('/', async (req, res, next) => {
  try {
    const resultado = await limpiarDatosSimulados();
    res.json(resultado);
  } catch (error) {
    next(error);
  }
});

export default simulacionRouter;
