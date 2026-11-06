import { describe, it, expect, beforeEach, afterEach, afterAll, vi } from 'vitest';
import request from 'supertest';
import { app, parsearOrigenesCors } from '../src/app.js';
import { construirOpcionesPool } from '../src/db/pool.js';
import {
  normalizarParametrosReglas,
  obtenerConfiguracionVigente,
  PARAMETROS_DEFECTO_S1,
} from '../src/services/configuracion.service.js';
import { pool } from '../src/db/pool.js';
import { limpiarCacheLecturas } from '../src/services/lecturas.service.js';

// Mockear Open-Meteo para evitar peticiones reales de red y aislar la BD
vi.mock('../src/services/openMeteo.js', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    consultarOpenMeteo: vi.fn().mockResolvedValue({
      fuente: 'Open-Meteo',
      observado_en: '2026-01-15T12:00:00.000Z',
      intervalo_actual_segundos: 900,
      actual: {
        precipitacion_mm: 1.0,
        temperatura_c: 12.0,
        humedad_pct: 70,
        viento_kmh: 8.0,
      },
      serie_horaria: {
        tiempos_utc: Array.from({ length: 80 }, (_, i) =>
          new Date(Date.parse('2026-01-15T12:00:00.000Z') - (79 - i) * 3600000).toISOString()
        ),
        precipitacion_mm: Array.from({ length: 80 }, () => 0.5),
      },
    }),
  };
});

describe('S1D7 - Fase A: Parámetros y Preparación Cloud / Pre-Despliegue', () => {
  beforeEach(async () => {
    limpiarCacheLecturas();
    await pool.query('DELETE FROM evaluaciones_nivel;');
    await pool.query('DELETE FROM lecturas_meteorologicas;');
  });

  afterEach(async () => {
    limpiarCacheLecturas();
    await pool.query('DELETE FROM evaluaciones_nivel;');
    await pool.query('DELETE FROM lecturas_meteorologicas;');
  });

  afterAll(async () => {
    limpiarCacheLecturas();
    await pool.query('DELETE FROM evaluaciones_nivel;');
    await pool.query('DELETE FROM lecturas_meteorologicas;');
  });

  describe('Helper construirOpcionesPool', () => {
    it('genera opciones con ssl=false para PostgreSQL local por defecto', () => {
      const opciones = construirOpcionesPool({
        DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/pukara_db',
      });
      expect(opciones.ssl).toBe(false);
      expect(opciones.max).toBe(10);
      expect(opciones.idleTimeoutMillis).toBe(30000);
      expect(opciones.connectionTimeoutMillis).toBe(10000);
    });

    it('activa ssl cuando DB_SSL="true" explícitamente', () => {
      const opciones = construirOpcionesPool({
        DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/pukara_db',
        DB_SSL: 'true',
      });
      expect(opciones.ssl).toEqual({ rejectUnauthorized: false });
    });

    it('detecta URLs gestionadas en la nube (Neon / Supabase / Render / sslmode=require)', () => {
      const urlsCloud = [
        'postgresql://user:pass@ep-cool-fog-123.us-east-2.aws.neon.tech/neondb?sslmode=require',
        'postgresql://postgres:pass@db.xyz.supabase.co:5432/postgres',
        'postgresql://pukara_user:pass@dpg-abc-a.oregon-postgres.render.com/pukara_db',
        'postgresql://user:pass@remotehost:5432/db?sslmode=require',
      ];

      for (const url of urlsCloud) {
        const opciones = construirOpcionesPool({ DATABASE_URL: url });
        expect(opciones.ssl).toEqual({ rejectUnauthorized: false });
      }
    });

    it('respeta DB_SSL="false" incluso si la URL sugiere cloud', () => {
      const opciones = construirOpcionesPool({
        DATABASE_URL: 'postgresql://user:pass@ep-cool-fog.neon.tech/neondb',
        DB_SSL: 'false',
      });
      expect(opciones.ssl).toBe(false);
    });
  });

  describe('Helper parsearOrigenesCors y Middleware CORS', () => {
    it('normaliza múltiples orígenes limpiando espacios y barras finales', () => {
      const resultado = parsearOrigenesCors(
        ' http://localhost:5173/ , https://pukara.vercel.app/ , https://preview.pukara.app '
      );
      expect(resultado).toEqual([
        'http://localhost:5173',
        'https://pukara.vercel.app',
        'https://preview.pukara.app',
      ]);
    });

    it('asigna origen por defecto ante valores nulos o vacíos', () => {
      expect(parsearOrigenesCors(null)).toEqual(['http://localhost:5173']);
      expect(parsearOrigenesCors('')).toEqual(['http://localhost:5173']);
    });

    it('permite peticiones sin cabecera Origin (curl, healthchecks de Render)', async () => {
      const res = await request(app).get('/api/salud');
      expect(res.status).toBe(200);
      expect(res.body.estado).toBe('ok');
    });

    it('rechaza peticiones con Origin no autorizado retornando 403 limpio', async () => {
      const res = await request(app)
        .get('/api/salud')
        .set('Origin', 'https://sitio-malicioso-no-autorizado.com');
      expect(res.status).toBe(403);
      expect(res.body.error).toContain('Origen no permitido por política CORS');
    });
  });

  describe('Servicio de Configuración y Normalización de Parámetros', () => {
    it('normaliza parámetros asignando los valores ratificados de Semana 1 si faltan campos', () => {
      const normalizado = normalizarParametrosReglas({});
      expect(normalizado).toEqual({
        t_max_minutos: 60,
        separacion_minima_minutos: 15,
        muestras_descenso: 2,
        saturacion: {
          habilitada: true,
          acum_72h_min_mm: 60,
          intensidad_min_mm_h: 2.5,
          nivel_minimo: 'ALERTA',
        },
      });
    });

    it('obtiene la configuración vigente real de la base de datos con sus 9 umbrales', async () => {
      const configVigente = await obtenerConfiguracionVigente({ db: pool });
      expect(configVigente).not.toBeNull();
      expect(configVigente.version).toBe(1);
      expect(configVigente.estado).toBe('vigente');
      expect(configVigente.parametros.t_max_minutos).toBe(60);
      expect(configVigente.parametros.separacion_minima_minutos).toBe(15);
      expect(configVigente.parametros.muestras_descenso).toBe(2);
      expect(configVigente.parametros.saturacion.habilitada).toBe(true);

      // Verificación de los 9 umbrales obligatorios
      expect(configVigente.umbrales).toHaveLength(9);
      for (const u of configVigente.umbrales) {
        expect(typeof u.valor).toBe('number');
        expect(Number.isFinite(u.valor)).toBe(true);
      }
    });

    it('retorna null si no existe ninguna configuración en estado vigente', async () => {
      const dbMock = {
        query: async () => ({ rows: [] }),
      };
      const config = await obtenerConfiguracionVigente({ db: dbMock });
      expect(config).toBeNull();
    });
  });

  describe('Integración con GET /api/estado', () => {
    it('incluye el bloque informativo parametros_vigentes_resumen sin alterar propiedades v1', async () => {
      const res = await request(app).get('/api/estado');
      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(res.body).toHaveProperty('parametros_vigentes_resumen');
      expect(res.body.parametros_vigentes_resumen).toEqual({
        version_reglas: 1,
        t_max_minutos: 60,
        separacion_minima_minutos: 15,
      });

      // Asegurar que las propiedades requeridas de S1D6 se mantienen íntegras
      expect(res.body).toHaveProperty('zona_piloto');
      expect(res.body).toHaveProperty('aviso_permanente');
      expect(res.body).toHaveProperty('meteorologia');
      expect(res.body).toHaveProperty('capas_referencia');
      expect(res.body).toHaveProperty('recomendaciones_publicadas');
      expect(res.body).toHaveProperty('contactos_emergencia');
    });
  });
});
