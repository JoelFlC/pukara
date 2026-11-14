/**
 * @file rendimientoApi.s4d4.test.js
 * @description Suite de Integración de Rendimiento y Eficiencia de API para la Semana 4 - Día 4 (S4D4):
 * Certificación de la Prueba Académica P19 en el Backend:
 * - Prueba 1: Tiempo de respuesta de GET /api/estado (< 3000 ms en primera consulta y ráfaga de 10 consultas, p95 < 500 ms en caché).
 * - Prueba 2: Tiempo de respuesta de GET /api/historial y GET /api/salud (< 1000 ms con payload íntegro).
 * - Prueba 3: Eficiencia de payload único para consulta móvil (< 100 KB serializado en UTF-8).
 */

import { describe, it, expect, beforeAll, beforeEach, afterEach, afterAll, vi } from 'vitest';
import { performance } from 'node:perf_hooks';
import request from 'supertest';
import { app } from '../../src/app.js';
import { pool } from '../../src/db/pool.js';
import { limpiarCacheLecturas } from '../../src/services/lecturas.service.js';
import { consultarOpenMeteo } from '../../src/services/openMeteo.js';

vi.mock('../../src/services/openMeteo.js', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    consultarOpenMeteo: vi.fn(),
  };
});

function construirPayloadOpenMeteoBenchmark(
  observadoEnIso = '2026-11-13T18:00:00.000Z',
  precipActual = 2.8,
  precipHoraria = 0.6
) {
  const baseMs = Date.parse(observadoEnIso);
  return {
    fuente: 'Open-Meteo',
    observado_en: observadoEnIso,
    intervalo_actual_segundos: 900,
    actual: {
      precipitacion_mm: precipActual,
      temperatura_c: 12.6,
      humedad_pct: 79,
      viento_kmh: 11.2,
    },
    serie_horaria: {
      tiempos_utc: Array.from({ length: 80 }, (_, idx) =>
        new Date(baseMs - (79 - idx) * 3600000).toISOString()
      ),
      precipitacion_mm: Array.from({ length: 80 }, () => precipHoraria),
    },
  };
}

function calcularPercentil(valoresOrdenados, percentil) {
  if (!valoresOrdenados.length) return 0;
  const idx = Math.min(
    valoresOrdenados.length - 1,
    Math.max(0, Math.ceil((percentil / 100) * valoresOrdenados.length) - 1)
  );
  return valoresOrdenados[idx];
}

async function limpiarEstadoPruebasS4D4() {
  limpiarCacheLecturas();
  await pool.query(`
    DELETE FROM evaluaciones_nivel
    WHERE lectura_id IN (
      SELECT id FROM lecturas_meteorologicas WHERE modalidad = 'simulada'
    );
  `);
  await pool.query("DELETE FROM lecturas_meteorologicas WHERE modalidad = 'simulada';");
  await pool.query("UPDATE configuraciones_reglas SET estado = 'vigente' WHERE version = 1;");
}

describe('SUITE DE RENDIMIENTO Y EFICIENCIA DE API S4D4 — CERTIFICACIÓN P19 (< 3000 ms)', () => {
  beforeAll(async () => {
    await limpiarEstadoPruebasS4D4();
  });

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.mocked(consultarOpenMeteo).mockResolvedValue(
      construirPayloadOpenMeteoBenchmark('2026-11-13T18:00:00.000Z', 2.8, 0.6)
    );
    await limpiarEstadoPruebasS4D4();
  });

  afterEach(async () => {
    await limpiarEstadoPruebasS4D4();
  });

  afterAll(async () => {
    await pool.query('DELETE FROM evaluaciones_nivel;');
    await pool.query('DELETE FROM lecturas_meteorologicas;');
    limpiarCacheLecturas();
  });

  // ===========================================================================
  // PRUEBA 1: P19 — Tiempo de respuesta de GET /api/estado (< 3000 ms y p95 < 500 ms)
  // ===========================================================================
  it('1. P19: GET /api/estado responde con el estado completo en menos de 3000 ms en primera consulta y ráfaga de 10 consultas (p95 < 500 ms con caché activo)', async () => {
    await pool.query('DELETE FROM evaluaciones_nivel;');
    await pool.query('DELETE FROM lecturas_meteorologicas;');
    limpiarCacheLecturas();

    // 1. Primera consulta en frío (ingesta + evaluación + persistencia + ensamblado de respuesta)
    const tInicioPrimera = performance.now();
    const resPrimera = await request(app).get('/api/estado');
    const duracionPrimeraMs = performance.now() - tInicioPrimera;

    expect(resPrimera.status).toBe(200);
    expect(resPrimera.body.ok).toBe(true);
    expect(resPrimera.body.nivel_vigente).toBe('PRECAUCION');
    expect(resPrimera.body.recomendaciones_publicadas).toHaveLength(4);
    expect(resPrimera.body.contactos_emergencia.length).toBeGreaterThanOrEqual(1);
    expect(resPrimera.body.zonas_referencia).toHaveLength(2);
    expect(resPrimera.body.puntos_referencia).toHaveLength(6);
    expect(typeof resPrimera.body.antiguedad_minutos).toBe('number');

    // Meta obligatoria P19: inferior a 3000 ms
    expect(duracionPrimeraMs).toBeLessThan(3000);

    // 2. Ráfaga secuencial de 10 consultas con caché activo
    const tiemposRafagaMs = [];
    for (let i = 0; i < 10; i++) {
      const t0 = performance.now();
      const res = await request(app).get('/api/estado');
      const dt = performance.now() - t0;

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.nivel_vigente).toBe('PRECAUCION');
      expect(dt).toBeLessThan(3000);
      tiemposRafagaMs.push(dt);
    }

    const ordenados = [...tiemposRafagaMs].sort((a, b) => a - b);
    const p95Ms = calcularPercentil(ordenados, 95);

    // Certificación de percentil 95 inferior a 500 ms
    expect(p95Ms).toBeLessThan(500);
  });

  // ===========================================================================
  // PRUEBA 2: P19 — Tiempo de respuesta de GET /api/historial y GET /api/salud (< 1000 ms)
  // ===========================================================================
  it('2. P19: GET /api/historial y GET /api/salud responden en menos de 1000 ms con payload íntegro', async () => {
    // Asegurar que exista al menos una evaluación registrada
    await request(app).get('/api/estado');

    const t0Salud = performance.now();
    const resSalud = await request(app).get('/api/salud');
    const duracionSaludMs = performance.now() - t0Salud;

    expect(resSalud.status).toBe(200);
    expect(resSalud.body.estado).toBe('ok');
    expect(resSalud.body.base_de_datos).toBe('conectado');
    expect(duracionSaludMs).toBeLessThan(1000);

    const t0Historial = performance.now();
    const resHistorial = await request(app).get('/api/historial?limite=10');
    const duracionHistorialMs = performance.now() - t0Historial;

    expect(resHistorial.status).toBe(200);
    expect(resHistorial.body.modalidad).toBe('real');
    expect(Array.isArray(resHistorial.body.items)).toBe(true);
    expect(resHistorial.body.items.length).toBeGreaterThanOrEqual(1);
    expect(duracionHistorialMs).toBeLessThan(1000);
  });

  // ===========================================================================
  // PRUEBA 3: P19 — Eficiencia de payload único para consulta móvil (< 100 KB)
  // ===========================================================================
  it('3. P19: El tamaño serializado en bytes del JSON de GET /api/estado es liviano (< 100 KB) para transferencia rápida en redes móviles', async () => {
    const res = await request(app).get('/api/estado');
    expect(res.status).toBe(200);

    const jsonString = JSON.stringify(res.body);
    const bytesUtf8 = Buffer.byteLength(jsonString, 'utf8');
    const kilobytes = bytesUtf8 / 1024;

    // Debe contener todos los bloques de datos pero pesar menos de 100 KB (102400 bytes)
    expect(bytesUtf8).toBeGreaterThan(500);
    expect(bytesUtf8).toBeLessThan(100 * 1024);
    expect(kilobytes).toBeLessThan(100);
  });
});

