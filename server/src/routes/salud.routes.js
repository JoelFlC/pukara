import { Router } from 'express';
import { pool } from '../db/pool.js';

export const saludRouter = Router();

saludRouter.get('/', async (req, res) => {
  try {
    const result = await pool.query('SELECT NOW() as db_time;');
    return res.status(200).json({
      estado: 'ok',
      servicio: 'PUKARA API',
      timestamp: new Date().toISOString(),
      base_de_datos: 'conectado',
      db_time: result.rows[0].db_time,
    });
  } catch (error) {
    return res.status(503).json({
      estado: 'error',
      servicio: 'PUKARA API',
      timestamp: new Date().toISOString(),
      base_de_datos: 'desconectado',
      error: error.message,
    });
  }
});

export default saludRouter;
