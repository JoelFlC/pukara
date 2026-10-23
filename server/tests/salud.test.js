import { describe, it, expect, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { pool } from '../src/db/pool.js';

describe('Integración: GET /api/salud', () => {
  afterAll(async () => {
    // Cerrar el pool de conexiones para liberar recursos
    await pool.end();
  });

  it('debe responder 200 con formato JSON y confirmar conectividad a PostgreSQL', async () => {
    const res = await request(app)
      .get('/api/salud')
      .expect('Content-Type', /json/)
      .expect(200);

    expect(res.body).toHaveProperty('estado', 'ok');
    expect(res.body).toHaveProperty('servicio', 'PUKARA API');
    expect(res.body).toHaveProperty('base_de_datos', 'conectado');
    expect(res.body).toHaveProperty('db_time');
    expect(res.body).toHaveProperty('timestamp');
    expect(new Date(res.body.db_time).getTime()).not.toBeNaN();
  });

  it('debe responder 404 para rutas inexistentes', async () => {
    const res = await request(app)
      .get('/api/ruta-inexistente')
      .expect('Content-Type', /json/)
      .expect(404);

    expect(res.body).toHaveProperty('error', 'Ruta no encontrada');
  });
});
