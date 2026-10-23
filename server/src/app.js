import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { saludRouter } from './routes/salud.routes.js';

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

// Manejador para rutas no encontradas
app.use((req, res) => {
  res.status(404).json({ error: 'Ruta no encontrada' });
});

export default app;
