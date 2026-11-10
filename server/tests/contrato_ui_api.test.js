/**
 * @file contrato_ui_api.test.js
 * @description Prueba automatizada de contrato entre Frontend (InicioPage y PanelAdministracion) y Backend Express API:
 * - 1. Integridad del paquete completo de consulta pública GET /api/estado (zonas >= 2, puntos >= 6, recomendaciones 4 niveles, contactos >= 1).
 * - 2. Verificación Anti-404 y contrato de autenticación: POST /api/auth/login entrega JWT válido y todas las rutas
 *      del PanelAdministracion responden 200 OK con payload íntegro.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { pool } from '../src/db/pool.js';
import { seed } from '../src/db/seed.js';
import { asegurarUsuarioAdministrador } from '../src/db/seedAdmin.js';
import { limpiarRateLimiterLogin } from '../src/middleware/rateLimit.middleware.js';
import { limpiarDatosSimulados } from '../src/services/simulacion.service.js';

// Mockear Open-Meteo para aislar llamadas externas en pruebas
vi.mock('../src/services/openMeteo.js', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    consultarOpenMeteo: vi.fn().mockResolvedValue({
      fuente: 'Open-Meteo',
      observado_en: '2026-11-06T18:00:00.000Z',
      intervalo_actual_segundos: 900,
      actual: {
        precipitacion_mm: 1.5,
        temperatura_c: 12.0,
        humedad_pct: 78,
        viento_kmh: 8.5,
      },
      serie_horaria: {
        tiempos_utc: Array.from({ length: 80 }, (_, i) =>
          new Date(Date.parse('2026-11-06T18:00:00.000Z') - (79 - i) * 3600000).toISOString()
        ),
        precipitacion_mm: Array.from({ length: 80 }, () => 0.3),
      },
    }),
  };
});

describe('Prueba de Contrato Frontend-Backend y Verificación Anti-404 (contrato_ui_api.test.js)', () => {
  let tokenAdmin = null;

  beforeAll(async () => {
    await seed();
    await asegurarUsuarioAdministrador();
  });

  beforeEach(() => {
    limpiarRateLimiterLogin();
  });

  afterAll(async () => {
    await limpiarDatosSimulados();
    await pool.end();
  });

  // =========================================================================
  // Control 1: Contrato de Consulta Pública (GET /api/estado)
  // =========================================================================
  describe('Control 1: Contrato de Consulta Pública (GET /api/estado)', () => {
    it('1.1. Entrega en una sola llamada zonas_referencia (>=2), puntos_referencia (>=6), 4 recomendaciones y contactos (>=1)', async () => {
      const res = await request(app)
        .get('/api/estado')
        .expect('Content-Type', /json/)
        .expect(200);

      const body = res.body;

      // Estructura general
      expect(body.ok).toBe(true);
      expect(body.modalidad).toBe('real');
      expect(body.nivel_vigente).toBeDefined();
      expect(body.estado_sistema).toBeDefined();

      // Zonas de Referencia (>= 2 en cuenca)
      expect(Array.isArray(body.zonas_referencia)).toBe(true);
      expect(body.zonas_referencia.length).toBeGreaterThanOrEqual(2);
      body.zonas_referencia.forEach((z) => {
        expect(z.id).toBeDefined();
        expect(z.nombre).toBeDefined();
        expect(z.advertencia).toContain('referencia de demostración, no validada');
      });

      // Puntos de Referencia (>= 6 de orientación urbana)
      expect(Array.isArray(body.puntos_referencia)).toBe(true);
      expect(body.puntos_referencia.length).toBeGreaterThanOrEqual(6);
      body.puntos_referencia.forEach((p) => {
        expect(p.id).toBeDefined();
        expect(p.nombre).toBeDefined();
        expect(typeof p.latitud).toBe('number');
        expect(typeof p.longitud).toBe('number');
      });

      // Recomendaciones Publicadas (con los 4 niveles informativos de lluvia)
      expect(Array.isArray(body.recomendaciones_publicadas)).toBe(true);
      expect(body.recomendaciones_publicadas.length).toBeGreaterThanOrEqual(4);
      const nivelesPresentes = body.recomendaciones_publicadas.map((r) => r.nivel);
      expect(nivelesPresentes).toContain('NORMAL');
      expect(nivelesPresentes).toContain('PRECAUCION');
      expect(nivelesPresentes).toContain('ALERTA');
      expect(nivelesPresentes).toContain('EMERGENCIA');

      // Recomendación vigente correspondiente al nivel activo
      expect(body.recomendacion).toBeDefined();
      expect(body.recomendacion).not.toBeNull();
      expect(body.recomendacion.nivel).toBe(body.nivel_vigente);

      // Contactos de Emergencia (>= 1 activo verificado)
      expect(Array.isArray(body.contactos_emergencia)).toBe(true);
      expect(body.contactos_emergencia.length).toBeGreaterThanOrEqual(1);
      body.contactos_emergencia.forEach((c) => {
        expect(c.nombre).toBeDefined();
        expect(c.telefono).toBeDefined();
        expect(c.activo).toBe(true);
      });
    });
  });

  // =========================================================================
  // Control 2: Autenticación Admin y Anti-404 en Rutas del Panel
  // =========================================================================
  describe('Control 2: Autenticación Admin y Verificación Anti-404 en Rutas del Panel', () => {
    it('2.1. POST /api/auth/login con credenciales demo responde 200 OK con JWT válido', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'admin@pukara.bo',
          password: 'PukaraAdmin2026!',
        })
        .expect('Content-Type', /json/)
        .expect(200);

      expect(res.body.ok).toBe(true);
      expect(res.body.token).toBeDefined();
      expect(typeof res.body.token).toBe('string');
      expect(res.body.token.split('.')).toHaveLength(3); // Formato JWT (header.payload.signature)
      expect(res.body.usuario).toBeDefined();
      expect(res.body.usuario.email).toBe('admin@pukara.bo');
      expect(res.body.usuario.rol).toBe('administrador');

      tokenAdmin = res.body.token;
    });

    it('2.2. Todas las rutas de consulta que consume PanelAdministracion.jsx responden 200 OK (nunca 404)', async () => {
      expect(tokenAdmin).not.toBeNull();

      const rutasAdmin = [
        { path: '/api/admin/configuraciones', descripcion: 'Configuraciones y umbrales (P05/P16)' },
        { path: '/api/admin/recomendaciones', descripcion: 'Textos preventivos por nivel' },
        { path: '/api/admin/contactos', descripcion: 'Directorio de emergencias' },
        { path: '/api/admin/capas', descripcion: 'Capas y referencias cartográficas' },
        { path: '/api/admin/bitacora', descripcion: 'Bitácora cronológica de auditoría' },
      ];

      for (const { path: ruta, descripcion } of rutasAdmin) {
        const res = await request(app)
          .get(ruta)
          .set('Authorization', `Bearer ${tokenAdmin}`)
          .expect('Content-Type', /json/);

        // Jamás debe responder 404 (Ruta no encontrada)
        expect(res.status, `La ruta ${ruta} (${descripcion}) no debe retornar 404`).not.toBe(404);
        expect(res.status, `La ruta ${ruta} (${descripcion}) debe responder 200 OK`).toBe(200);
        expect(res.body.ok).toBe(true);
      }
    });
  });

  // =========================================================================
  // Control 3: Inyección Robusta de Escenarios y Presets de Demostración (P11)
  // =========================================================================
  describe('Control 3: Inyección Robusta de Escenarios y Presets de Demostración (P11)', () => {
    it('3.1. Inyecta secuencialmente los 4 niveles (NORMAL -> PRECAUCION -> ALERTA -> EMERGENCIA -> NORMAL) sin error 500 y con aislamiento real', async () => {
      // Obtenemos el estado real base antes de iniciar simulación
      const estadoRealAntes = await request(app).get('/api/estado?modalidad=real').expect(200);
      const nivelRealOriginal = estadoRealAntes.body.nivel_vigente;

      const presets = [
        {
          nivelEsperado: 'NORMAL',
          payload: { intensidad_mm_h: 0.4, acum_24h_mm: 2.0, acum_72h_mm: 6.0, reiniciar_antes: true, modo_preset: true },
        },
        {
          nivelEsperado: 'PRECAUCION',
          payload: { intensidad_mm_h: 3.2, acum_24h_mm: 14.0, acum_72h_mm: 30.0, reiniciar_antes: true, modo_preset: true },
        },
        {
          nivelEsperado: 'ALERTA',
          payload: { intensidad_mm_h: 7.5, acum_24h_mm: 28.0, acum_72h_mm: 64.0, reiniciar_antes: true, modo_preset: true },
        },
        {
          nivelEsperado: 'EMERGENCIA',
          payload: { intensidad_mm_h: 14.5, acum_24h_mm: 48.0, acum_72h_mm: 98.0, reiniciar_antes: true, modo_preset: true },
        },
        {
          nivelEsperado: 'NORMAL',
          payload: { intensidad_mm_h: 0.4, acum_24h_mm: 2.0, acum_72h_mm: 6.0, reiniciar_antes: true, modo_preset: true },
        },
      ];

      for (const { nivelEsperado, payload } of presets) {
        const resInyeccion = await request(app)
          .post('/api/simulacion/lectura')
          .send(payload)
          .expect('Content-Type', /json/);

        expect(resInyeccion.status).toBe(201);
        expect(resInyeccion.body.ok).toBe(true);
        expect(resInyeccion.body.evaluacion.nivel_vigente).toBe(nivelEsperado);

        // Verificamos que GET /api/estado?modalidad=simulada refleja el nivel con recomendación
        const resSim = await request(app)
          .get('/api/estado?modalidad=simulada')
          .expect(200);

        expect(resSim.body.modalidad).toBe('simulada');
        expect(resSim.body.nivel_vigente).toBe(nivelEsperado);
        expect(resSim.body.recomendacion).toBeDefined();
        expect(resSim.body.recomendacion.nivel).toBe(nivelEsperado);

        // Verificamos aislamiento estricto: el flujo real NO fue alterado
        const resReal = await request(app)
          .get('/api/estado?modalidad=real')
          .expect(200);

        expect(resReal.body.modalidad).toBe('real');
        expect(resReal.body.nivel_vigente).toBe(nivelRealOriginal);
      }
    });

    it('3.2. DELETE /api/simulacion limpia los datos simulados y preserva el estado real', async () => {
      const resDelete = await request(app)
        .delete('/api/simulacion')
        .expect('Content-Type', /json/)
        .expect(200);

      expect(resDelete.body.ok).toBe(true);

      const resSim = await request(app)
        .get('/api/estado?modalidad=simulada')
        .expect(200);

      expect(resSim.body.modalidad).toBe('simulada');
      expect(resSim.body.lectura).toBeNull();
      expect(resSim.body.meteorologia?.disponible).toBe(false);
    });
  });
});

