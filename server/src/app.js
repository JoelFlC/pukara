import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { saludRouter } from './routes/salud.routes.js';
import { estadoRouter } from './routes/estado.routes.js';

dotenv.config();

export const app = express();

// Soporte de proxy inverso en hosting cloud (Render, Railway, etc.)
app.set('trust proxy', 1);

/**
 * Convierte una cadena de orígenes separados por comas en un arreglo limpio de URLs sin barras finales.
 *
 * @param {string|undefined|null} valorCorsOrigin
 * @returns {string[]} Lista de orígenes normalizados
 */
export function parsearOrigenesCors(valorCorsOrigin) {
  if (!valorCorsOrigin || typeof valorCorsOrigin !== 'string') {
    return ['http://localhost:5173'];
  }

  const origenes = valorCorsOrigin
    .split(',')
    .map((o) => o.trim().replace(/\/+$/, ''))
    .filter((o) => o.length > 0);

  return origenes.length > 0 ? origenes : ['http://localhost:5173'];
}

const origenesPermitidos = parsearOrigenesCors(process.env.CORS_ORIGIN);

app.use(
  cors({
    origin: (origin, callback) => {
      // Peticiones sin cabecera Origin (curl, healthchecks de Render/Railway, Postman)
      if (!origin) {
        return callback(null, true);
      }

      const origenNormalizado = origin.trim().replace(/\/+$/, '');
      if (origenesPermitidos.includes(origenNormalizado)) {
        return callback(null, true);
      }

      return callback(new Error(`Origen ${origin} no permitido por política CORS`));
    },
    credentials: true,
  })
);

app.use(express.json());

// Montaje de rutas
app.use('/api/salud', saludRouter);
app.use('/api/estado', estadoRouter);

// Manejador para rutas no encontradas
app.use((req, res) => {
  res.status(404).json({ error: 'Ruta no encontrada' });
});

// Manejador global de errores (captura limpia de rechazo CORS y HTTP 500 para fallas imprevistas)
app.use((err, req, res, next) => {
  if (err && err.message && err.message.includes('CORS')) {
    return res.status(403).json({ error: 'Origen no permitido por política CORS' });
  }
  console.error('Error no controlado en la API:', err.message);
  res.status(500).json({ error: 'Error interno del servidor' });
});

export default app;
