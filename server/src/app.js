import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { saludRouter } from './routes/salud.routes.js';
import { estadoRouter } from './routes/estado.routes.js';

dotenv.config();

export const app = express();

const corsOrigin = process.env.CORS_ORIGIN || 'http://localhost:5173';

app.use(
  cors({
    origin: corsOrigin,
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

// Manejador global de errores (HTTP 500 sin filtrar stacktraces)
app.use((err, req, res, next) => {
  console.error('Error no controlado en la API:', err.message);
  res.status(500).json({ error: 'Error interno del servidor' });
});

export default app;
