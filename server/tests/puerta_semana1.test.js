import { describe, it, expect, beforeEach, afterEach, afterAll, vi } from 'vitest';
import request from 'supertest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { app, parsearOrigenesCors } from '../src/app.js';
import { construirOpcionesPool } from '../src/db/pool.js';
import { obtenerConfiguracionVigente } from '../src/services/configuracion.service.js';
import { pool } from '../src/db/pool.js';
import { limpiarCacheLecturas } from '../src/services/lecturas.service.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '../..');

// Mockear Open-Meteo para aislar completamente las pruebas HTTP sin tocar red externa
vi.mock('../src/services/openMeteo.js', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    consultarOpenMeteo: vi.fn().mockResolvedValue({
      fuente: 'Open-Meteo',
      observado_en: '2026-01-15T12:00:00.000Z',
      intervalo_actual_segundos: 900,
      actual: {
        precipitacion_mm: 1.5,
        temperatura_c: 12.0,
        humedad_pct: 75,
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

/**
 * Obtiene recursivamente todas las rutas de archivos con extensiones dadas.
 */
function listarArchivosRecursivo(dir, extensiones = ['.js', '.jsx']) {
  let resultados = [];
  if (!fs.existsSync(dir)) return resultados;

  const entradas = fs.readdirSync(dir, { withFileTypes: true });
  for (const entrada of entradas) {
    const rutaCompleta = path.join(dir, entrada.name);
    if (entrada.isDirectory()) {
      if (entrada.name !== 'node_modules' && entrada.name !== 'dist' && entrada.name !== '.git') {
        resultados = resultados.concat(listarArchivosRecursivo(rutaCompleta, extensiones));
      }
    } else if (extensiones.some((ext) => entrada.name.endsWith(ext))) {
      resultados.push(rutaCompleta);
    }
  }
  return resultados;
}

/**
 * Elimina comentarios de bloque y de línea para auditar estrictamente código ejecutable y cadenas.
 */
function removerComentarios(codigo) {
  return codigo
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*/g, '');
}

describe('PUERTA DE CALIDAD SEMANA 1 (S1D7 - Fase B)', () => {
  beforeEach(async () => {
    limpiarCacheLecturas();
    await pool.query('DELETE FROM lecturas_meteorologicas;');
  });

  afterEach(async () => {
    limpiarCacheLecturas();
    await pool.query('DELETE FROM lecturas_meteorologicas;');
  });

  afterAll(async () => {
    limpiarCacheLecturas();
    await pool.query('DELETE FROM lecturas_meteorologicas;');
  });

  // --------------------------------------------------------------------------
  // CONTROL 1: Detección automática de SSL para nube vs. local
  // --------------------------------------------------------------------------
  describe('Control 1: Soporte Dual Local / Cloud SSL (pool.js)', () => {
    it('configura ssl: false para conexión local estándar en localhost', () => {
      const opciones = construirOpcionesPool({
        DATABASE_URL: 'postgresql://postgres:pass@localhost:5432/pukara_db',
      });
      expect(opciones.ssl).toBe(false);
      expect(opciones.max).toBe(10);
      expect(opciones.idleTimeoutMillis).toBe(30000);
      expect(opciones.connectionTimeoutMillis).toBe(10000);
    });

    it('activa ssl para bases gestionadas en Neon (con o sin sslmode=require)', () => {
      const opciones = construirOpcionesPool({
        DATABASE_URL:
          'postgresql://user:pass@ep-cool-cloud.us-east-2.aws.neon.tech/neondb?sslmode=require',
      });
      expect(opciones.ssl).toEqual({ rejectUnauthorized: false });
    });

    it('activa ssl para bases gestionadas en Supabase y Render', () => {
      const opcionesSupabase = construirOpcionesPool({
        DATABASE_URL: 'postgresql://postgres:pass@db.xyz.supabase.co:5432/postgres',
      });
      expect(opcionesSupabase.ssl).toEqual({ rejectUnauthorized: false });

      const opcionesRender = construirOpcionesPool({
        DATABASE_URL: 'postgresql://pukara_user:pass@dpg-abc-a.oregon-postgres.render.com/pukara_db',
      });
      expect(opcionesRender.ssl).toEqual({ rejectUnauthorized: false });
    });

    it('activa ssl cuando se fuerza explícitamente mediante DB_SSL="true"', () => {
      const opciones = construirOpcionesPool({
        DATABASE_URL: 'postgresql://postgres:pass@127.0.0.1:5432/pukara_db',
        DB_SSL: 'true',
      });
      expect(opciones.ssl).toEqual({ rejectUnauthorized: false });
    });
  });

  // --------------------------------------------------------------------------
  // CONTROL 2: CORS multi-origen
  // --------------------------------------------------------------------------
  describe('Control 2: CORS Multi-Origen y Seguridad de Red', () => {
    it('normaliza múltiples orígenes permitidos sin barras finales', () => {
      const lista = parsearOrigenesCors(
        'http://localhost:5173/,https://pukara.vercel.app/, https://pukara-preview.onrender.com'
      );
      expect(lista).toEqual([
        'http://localhost:5173',
        'https://pukara.vercel.app',
        'https://pukara-preview.onrender.com',
      ]);
    });

    it('responde cabecera access-control-allow-origin para orígenes autorizados', async () => {
      const res = await request(app)
        .get('/api/salud')
        .set('Origin', 'http://localhost:5173');
      expect(res.status).toBe(200);
      expect(res.headers['access-control-allow-origin']).toBe('http://localhost:5173');
    });

    it('rechaza orígenes no autorizados devolviendo HTTP 403 limpio', async () => {
      const res = await request(app)
        .get('/api/salud')
        .set('Origin', 'https://atacante-externo.xyz');
      expect(res.status).toBe(403);
      expect(res.body.error).toContain('Origen no permitido por política CORS');
    });

    it('permite peticiones sin cabecera Origin (curl, healthchecks de Render)', async () => {
      const res = await request(app).get('/api/salud');
      expect(res.status).toBe(200);
      expect(res.body.estado).toBe('ok');
    });
  });

  // --------------------------------------------------------------------------
  // CONTROL 3: Ratificación de parámetros vigentes en base de datos
  // --------------------------------------------------------------------------
  describe('Control 3: Parámetros Ratificados en Base de Datos (Semana 1)', () => {
    it('obtiene la configuración vigente v1 con parámetros temporales exactos y 9 umbrales', async () => {
      const config = await obtenerConfiguracionVigente({ db: pool });
      expect(config).not.toBeNull();
      expect(config.version).toBe(1);
      expect(config.estado).toBe('vigente');

      // Parámetros temporales y de histéresis ratificados
      expect(config.parametros.t_max_minutos).toBe(60);
      expect(config.parametros.separacion_minima_minutos).toBe(15);
      expect(config.parametros.muestras_descenso).toBe(2);

      // Bloque de saturación de suelo
      expect(config.parametros.saturacion).toEqual({
        habilitada: true,
        acum_72h_min_mm: 60,
        intensidad_min_mm_h: 2.5,
        nivel_minimo: 'ALERTA',
      });

      // Exactamente los 9 umbrales académicos de las 3 variables
      expect(config.umbrales).toHaveLength(9);
      const variables = new Set(config.umbrales.map((u) => u.variable));
      expect(variables).toEqual(new Set(['intensidad_mm_h', 'acum_24h_mm', 'acum_72h_mm']));

      for (const u of config.umbrales) {
        expect(['PRECAUCION', 'ALERTA', 'EMERGENCIA']).toContain(u.nivel);
        expect(typeof u.valor).toBe('number');
        expect(u.valor).toBeGreaterThan(0);
      }
    });
  });

  // --------------------------------------------------------------------------
  // CONTROL 4: Auditoría semántica estática sobre código fuente (Lista Negra)
  // --------------------------------------------------------------------------
  describe('Control 4: Auditoría Semántica Estática sobre Código Fuente (/server/src y /client/src)', () => {
    const TERMINOS_PROHIBIDOS = [
      'alerta oficial',
      'orden de evacuación',
      'ruta segura',
      'zona segura',
      'refugio verificado',
      'maps.google.com',
      'waze.com',
    ];

    it('certifica que ningún archivo ejecutable de frontend o backend use términos de la Lista Negra', () => {
      const directoriosAuditar = [
        path.join(REPO_ROOT, 'server/src'),
        path.join(REPO_ROOT, 'client/src'),
      ];

      const archivos = directoriosAuditar.flatMap((dir) => listarArchivosRecursivo(dir));
      expect(archivos.length).toBeGreaterThan(10);

      const violaciones = [];

      for (const archivo of archivos) {
        const contenido = fs.readFileSync(archivo, 'utf-8');
        const codigoLimpio = removerComentarios(contenido).toLowerCase();

        for (const termino of TERMINOS_PROHIBIDOS) {
          if (codigoLimpio.includes(termino)) {
            violaciones.push({
              archivo: path.relative(REPO_ROOT, archivo),
              termino,
            });
          }
        }
      }

      expect(violaciones).toEqual([]);
    });
  });

  // --------------------------------------------------------------------------
  // CONTROL 5: Verificación de Aviso Permanente y respuesta íntegra de /api/estado
  // --------------------------------------------------------------------------
  describe('Control 5: Aviso Permanente y Consistencia de Capas en GET /api/estado', () => {
    it('entrega el Aviso Permanente obligatorio con semántica rigurosa y sin duplicados en capas', async () => {
      const res = await request(app).get('/api/estado');
      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);

      // 1. Aviso permanente
      const aviso = res.body.aviso_permanente;
      expect(typeof aviso).toBe('string');
      expect(aviso).toContain('niveles informativos de lluvia');
      expect(aviso).toContain('umbrales académicos');
      expect(aviso).toContain('No sustituyen alertas ni instrucciones de las autoridades oficiales');
      expect(aviso).toContain('PUKARA muestra información bajo consulta y no avisa activamente a la población');

      // 2. Capas geográficas de referencia (2 zonas y 6 puntos)
      expect(res.body.capas_referencia.zonas).toHaveLength(2);
      expect(res.body.capas_referencia.puntos).toHaveLength(6);
      expect(res.body.capas_referencia.leyenda_obligatoria).toBe(
        'referencia de demostración, no validada'
      );

      // 3. Resumen de parámetros vigentes
      expect(res.body.parametros_vigentes_resumen).toEqual({
        version_reglas: 1,
        t_max_minutos: 60,
        separacion_minima_minutos: 15,
      });
    });
  });
});
