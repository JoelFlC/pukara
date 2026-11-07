/**
 * @file recomendaciones.p06.test.js
 * @description Suite de pruebas automatizadas para el Módulo 3 y la Regla P06:
 * - 1. Contrato completo de GET /api/estado (recomendación vigente, recomendaciones de los 4 niveles y contactos)
 * - 2. Escenario P06 en API: Cambio de nivel meteorológico actualiza automáticamente la recomendación entregada
 * - 3. Reflejo dinámico en la consulta pública de cambios administrativos en recomendaciones (origen institucional)
 */

import { describe, it, expect, beforeAll, beforeEach, afterEach, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { pool } from '../src/db/pool.js';
import { seed } from '../src/db/seed.js';
import { asegurarUsuarioAdministrador } from '../src/db/seedAdmin.js';
import { limpiarRateLimiterLogin } from '../src/middleware/rateLimit.middleware.js';
import { limpiarDatosSimulados } from '../src/services/simulacion.service.js';

/**
 * Restaura el estado de la base de datos a su configuración inicial v1,
 * eliminando recomendaciones agregadas en pruebas y limpiando simulaciones.
 */
async function restaurarEstadoBD() {
  await limpiarDatosSimulados();

  // 1. Limpiar bitácora de recomendaciones de prueba
  await pool.query(`
    DELETE FROM bitacora_cambios
    WHERE entidad = 'recomendaciones_preventivas'
      AND (valor_nuevo::text LIKE '%Test%' OR valor_nuevo::text LIKE '%P06%');
  `);

  // 2. Limpiar recomendaciones con versión > 1
  await pool.query('DELETE FROM recomendaciones_preventivas WHERE version > 1;');

  // 3. Restaurar las 4 recomendaciones semilla en estado 'publicado' y 'demostracion'
  await pool.query(`
    UPDATE recomendaciones_preventivas
    SET estado_publicacion = 'publicado',
        origen = 'demostracion'
    WHERE version = 1;
  `);
}

describe('Semana 3 - Día 3 (Fase B): Recomendaciones, Contactos y Regla P06 (recomendaciones.p06.test.js)', () => {
  let adminToken;
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@pukara.bo';
  const adminPassword = process.env.ADMIN_PASSWORD || 'PukaraAdmin2026!';

  beforeAll(async () => {
    await seed();
    await asegurarUsuarioAdministrador();
  });

  beforeEach(async () => {
    limpiarRateLimiterLogin();
    await restaurarEstadoBD();

    // Obtener token administrativo para pruebas del bloque 3
    const resLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: adminEmail, password: adminPassword });

    expect(resLogin.status).toBe(200);
    adminToken = resLogin.body.token;
  });

  afterEach(async () => {
    limpiarRateLimiterLogin();
    await restaurarEstadoBD();
  });

  afterAll(async () => {
    await restaurarEstadoBD();
  });

  // =========================================================================
  // BLOQUE 1: Contrato completo de GET /api/estado (Módulo 3)
  // =========================================================================
  describe('Bloque 1: Contrato Completo de GET /api/estado para el Módulo 3', () => {
    it('1.1. Devuelve en una sola llamada la recomendación del nivel vigente, el listado de los 4 niveles y los contactos activos', async () => {
      const res = await request(app).get('/api/estado');

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);

      // 1. Recomendación correspondiente al nivel vigente actual
      expect(res.body).toHaveProperty('recomendacion');
      expect(res.body).toHaveProperty('recomendacion_vigente');
      const recomVigente = res.body.recomendacion || res.body.recomendacion_vigente;
      expect(recomVigente).not.toBeNull();
      expect(recomVigente.nivel).toBe(res.body.nivel_vigente || 'NORMAL');
      expect(typeof recomVigente.titulo).toBe('string');
      expect(typeof recomVigente.contenido).toBe('string');
      expect(['demostracion', 'institucional_verificada']).toContain(recomVigente.origen);

      // 2. Recomendaciones publicadas para los 4 niveles en orden lógico
      expect(res.body).toHaveProperty('recomendaciones_publicadas');
      expect(Array.isArray(res.body.recomendaciones_publicadas)).toBe(true);
      expect(res.body.recomendaciones_publicadas.length).toBeGreaterThanOrEqual(4);

      const nivelesRecibidos = res.body.recomendaciones_publicadas.map((r) => r.nivel);
      expect(nivelesRecibidos).toContain('NORMAL');
      expect(nivelesRecibidos).toContain('PRECAUCION');
      expect(nivelesRecibidos).toContain('ALERTA');
      expect(nivelesRecibidos).toContain('EMERGENCIA');

      // Cada recomendación debe tener etiqueta de origen y versión
      for (const r of res.body.recomendaciones_publicadas) {
        expect(['demostracion', 'institucional_verificada']).toContain(r.origen);
        expect(typeof r.version).toBe('number');
        expect(r.version).toBeGreaterThanOrEqual(1);
        expect(r.estado_publicacion).toBe('publicado');
      }

      // 3. Contactos de emergencia activos con fuentes y trazabilidad
      expect(res.body).toHaveProperty('contactos_emergencia');
      expect(Array.isArray(res.body.contactos_emergencia)).toBe(true);
      expect(res.body.contactos_emergencia.length).toBeGreaterThanOrEqual(3);

      for (const c of res.body.contactos_emergencia) {
        expect(typeof c.nombre).toBe('string');
        expect(typeof c.telefono).toBe('string');
        expect(c.telefono.length).toBeGreaterThanOrEqual(3);
        expect(c.activo).toBe(true);
      }
    });
  });

  // =========================================================================
  // BLOQUE 2: Escenario P06 en API — Cambio de nivel actualiza la recomendación
  // =========================================================================
  describe('Bloque 2: Escenario P06 en API — Cambio de Nivel y Actualización de Recomendación', () => {
    it('2.1. Inyecta muestra NORMAL y devuelve recomendación de NORMAL; luego eleva a ALERTA y entrega recomendación de ALERTA', async () => {
      // 1. Inyectar lectura simulada de nivel NORMAL
      const resSimNormal = await request(app)
        .post('/api/simulacion/lectura')
        .send({
          observado_en: '2026-10-23T20:00:00.000Z',
          intensidad_mm_h: 0.5,
          acum_24h_mm: 2.0,
          acum_72h_mm: 5.0,
        });

      expect(resSimNormal.status).toBe(201);

      // 2. Consultar GET /api/estado?modalidad=simulada
      const resEstadoNormal = await request(app).get('/api/estado?modalidad=simulada');
      expect(resEstadoNormal.status).toBe(200);
      expect(resEstadoNormal.body.nivel_vigente).toBe('NORMAL');

      const recomNormal = resEstadoNormal.body.recomendacion || resEstadoNormal.body.recomendacion_vigente;
      expect(recomNormal).toBeDefined();
      expect(recomNormal.nivel).toBe('NORMAL');
      expect(recomNormal.contenido).toContain('canaletas y desagües');

      // 3. Enviar lectura posterior que eleva a ALERTA (P01 / P06)
      const resSimAlerta = await request(app)
        .post('/api/simulacion/lectura')
        .send({
          observado_en: '2026-10-23T20:15:00.000Z',
          intensidad_mm_h: 7.0, // Umbral ALERTA >= 6.5 mm/h
          acum_24h_mm: 26.0,    // Umbral ALERTA >= 25.0 mm
          acum_72h_mm: 62.0,    // Umbral ALERTA >= 60.0 mm
        });

      expect(resSimAlerta.status).toBe(201);

      // 4. Consultar GET /api/estado?modalidad=simulada y verificar actualización automática
      const resEstadoAlerta = await request(app).get('/api/estado?modalidad=simulada');
      expect(resEstadoAlerta.status).toBe(200);
      expect(resEstadoAlerta.body.nivel_vigente).toBe('ALERTA');

      const recomAlerta = resEstadoAlerta.body.recomendacion || resEstadoAlerta.body.recomendacion_vigente;
      expect(recomAlerta).toBeDefined();
      expect(recomAlerta.nivel).toBe('ALERTA');
      expect(recomAlerta.contenido).toContain('mochila de emergencia');
      expect(recomAlerta.origen).toBe('demostracion');
    });
  });

  // =========================================================================
  // BLOQUE 3: Reflejo de cambios administrativos en la consulta pública
  // =========================================================================
  describe('Bloque 3: Reflejo de Cambios Administrativos en la Consulta Pública', () => {
    it('3.1. Publicación de nueva recomendación con origen institucional_verificada se refleja inmediatamente en GET /api/estado', async () => {
      // 1. Establecer estado en ALERTA mediante simulación
      await request(app)
        .post('/api/simulacion/lectura')
        .send({
          observado_en: '2026-10-23T21:00:00.000Z',
          intensidad_mm_h: 8.0,
          acum_24h_mm: 30.0,
          acum_72h_mm: 65.0,
        });

      // 2. Administrador crea y publica una nueva versión para ALERTA con origen institucional_verificada
      const nuevoTitulo = 'Protocolo Institucional Preventivo GAMLP Test P06';
      const nuevoContenido = 'Monitoreo visual del cauce y despeje de bajantes pluviales.';
      const nuevaFuente = 'Secretaría Municipal de Gestión Integral de Riesgos';

      const resAdmin = await request(app)
        .post('/api/admin/recomendaciones')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          nivel: 'ALERTA',
          titulo: nuevoTitulo,
          contenido: nuevoContenido,
          origen: 'institucional_verificada',
          fuente: nuevaFuente,
          estado_publicacion: 'publicado',
        });

      expect(resAdmin.status).toBe(201);
      expect(resAdmin.body.ok).toBe(true);
      expect(resAdmin.body.recomendacion.origen).toBe('institucional_verificada');

      // 3. La siguiente consulta pública a GET /api/estado entrega la nueva recomendación con origen institucional_verificada
      const resPublica = await request(app).get('/api/estado?modalidad=simulada');
      expect(resPublica.status).toBe(200);
      expect(resPublica.body.nivel_vigente).toBe('ALERTA');

      const recomVigente = resPublica.body.recomendacion || resPublica.body.recomendacion_vigente;
      expect(recomVigente.titulo).toBe(nuevoTitulo);
      expect(recomVigente.contenido).toBe(nuevoContenido);
      expect(recomVigente.origen).toBe('institucional_verificada');
      expect(recomVigente.fuente).toBe(nuevaFuente);
      expect(recomVigente.version).toBeGreaterThan(1);
    });
  });
});
