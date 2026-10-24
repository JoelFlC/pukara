import { describe, it, expect, beforeEach, afterEach, afterAll, vi } from 'vitest';
import { pool } from '../src/db/pool.js';
import {
  consultarYRegistrarLecturaReal,
  obtenerUltimaLecturaRegistrada,
  limpiarCacheLecturas,
} from '../src/services/lecturas.service.js';
import { OpenMeteoError } from '../src/services/openMeteo.js';

// Rango controlado de prueba para aislamiento total en BD
const RANGO_PRUEBA_INICIO = '2026-01-15T00:00:00.000Z';
const RANGO_PRUEBA_FIN = '2026-01-16T00:00:00.000Z';

/**
 * Generador auxiliar de respuestas mockeadas de Open-Meteo con 80 horas de serie
 * para asegurar cálculos deterministas y válidos en calcularAcumuladosYCalidad.
 */
function crearRespuestaMeteoMock({
  observadoEn = '2026-01-15T12:00:00.000Z',
  precipitacionActual = 2.0,
  valorHora = 0.5,
  fuente = 'Open-Meteo',
} = {}) {
  const tsAnchor = Math.floor(Date.parse(observadoEn) / 3_600_000) * 3_600_000;
  const tiemposUtc = [];
  const precipitacionMm = [];

  for (let h = 79; h >= 0; h--) {
    const ts = tsAnchor - h * 3_600_000;
    tiemposUtc.push(new Date(ts).toISOString());
    precipitacionMm.push(valorHora);
  }

  return {
    fuente,
    observado_en: observadoEn,
    intervalo_actual_segundos: 900,
    actual: {
      precipitacion_mm: precipitacionActual,
      temperatura_c: 12.4,
      humedad_pct: 75,
      viento_kmh: 8.5,
    },
    serie_horaria: {
      tiempos_utc: tiemposUtc,
      precipitacion_mm: precipitacionMm,
    },
  };
}

describe('Servicio de Lecturas Meteorológicas: Caché, Persistencia y Resiliencia (lecturas.service.js)', () => {
  beforeEach(async () => {
    limpiarCacheLecturas();
    await pool.query(
      'DELETE FROM lecturas_meteorologicas WHERE observado_en >= $1 AND observado_en < $2',
      [RANGO_PRUEBA_INICIO, RANGO_PRUEBA_FIN]
    );
  });

  afterEach(async () => {
    limpiarCacheLecturas();
    await pool.query(
      'DELETE FROM lecturas_meteorologicas WHERE observado_en >= $1 AND observado_en < $2',
      [RANGO_PRUEBA_INICIO, RANGO_PRUEBA_FIN]
    );
  });

  afterAll(async () => {
    await pool.query(
      'DELETE FROM lecturas_meteorologicas WHERE observado_en >= $1 AND observado_en < $2',
      [RANGO_PRUEBA_INICIO, RANGO_PRUEBA_FIN]
    );
    await pool.end();
  });

  it('1. Persistencia inicial con observado_en de la fuente (no hora del servidor)', async () => {
    const ahoraMs = Date.parse('2026-01-15T12:10:00.000Z');
    const mockMeteo = vi.fn().mockResolvedValue(
      crearRespuestaMeteoMock({
        observadoEn: '2026-01-15T12:00:00.000Z',
        precipitacionActual: 2.0,
        valorHora: 0.5,
      })
    );

    const res = await consultarYRegistrarLecturaReal({
      consultarMeteoFn: mockMeteo,
      ahoraFn: () => ahoraMs,
    });

    const dbCount = await pool.query(
      'SELECT COUNT(*) FROM lecturas_meteorologicas WHERE observado_en >= $1 AND observado_en < $2',
      [RANGO_PRUEBA_INICIO, RANGO_PRUEBA_FIN]
    );
    expect(Number(dbCount.rows[0].count)).toBe(1);

    expect(res.insertada_nueva).toBe(true);
    expect(res.origen_respuesta).toBe('open_meteo');
    expect(res.fallo_api).toBe(false);
    expect(res.error_api).toBeNull();
    expect(res.lectura.observado_en).toBe('2026-01-15T12:00:00.000Z');
    expect(res.lectura.antiguedad_minutos).toBe(10);

    // Tipos numéricos estrictos devueltos por el mapeador
    expect(typeof res.lectura.id).toBe('number');
    expect(typeof res.lectura.intensidad_mm_h).toBe('number');
    expect(typeof res.lectura.acum_24h_mm).toBe('number');
    expect(typeof res.lectura.acum_72h_mm).toBe('number');
    expect(res.lectura.intensidad_mm_h).toBe(2.0);
    expect(res.lectura.acum_24h_mm).toBe(12.0);
    expect(res.lectura.acum_72h_mm).toBe(36.0);
  });

  it('2. P04 — Dos consultas en menos de 10 minutos (0 min y 4 min)', async () => {
    const ahoraMs1 = Date.parse('2026-01-15T12:00:00.000Z');
    const mockMeteo = vi.fn().mockResolvedValue(
      crearRespuestaMeteoMock({ observadoEn: '2026-01-15T12:00:00.000Z' })
    );

    // Primera llamada en t = 12:00Z
    const res1 = await consultarYRegistrarLecturaReal({
      consultarMeteoFn: mockMeteo,
      ahoraFn: () => ahoraMs1,
    });

    expect(mockMeteo).toHaveBeenCalledTimes(1);
    expect(res1.insertada_nueva).toBe(true);
    expect(res1.origen_respuesta).toBe('open_meteo');
    expect(res1.lectura.antiguedad_minutos).toBe(0);

    // Segunda llamada en t = 12:04Z (4 minutos después, ventana < 12 min)
    const ahoraMs2 = Date.parse('2026-01-15T12:04:00.000Z');
    const res2 = await consultarYRegistrarLecturaReal({
      consultarMeteoFn: mockMeteo,
      ahoraFn: () => ahoraMs2,
    });

    // Aserción a: consultarMeteoFn NO volvió a ejecutarse
    expect(mockMeteo).toHaveBeenCalledTimes(1);

    // Aserción b: en PostgreSQL sigue existiendo exactamente 1 sola fila
    const countRes = await pool.query(
      'SELECT COUNT(*) FROM lecturas_meteorologicas WHERE observado_en >= $1 AND observado_en < $2',
      [RANGO_PRUEBA_INICIO, RANGO_PRUEBA_FIN]
    );
    expect(Number(countRes.rows[0].count)).toBe(1);

    // Aserción c: origen cache_servidor, insertada_nueva: false y antigüedad actualizada (+4 min)
    expect(res2.origen_respuesta).toBe('cache_servidor');
    expect(res2.insertada_nueva).toBe(false);
    expect(res2.lectura.id).toBe(res1.lectura.id);
    expect(res2.lectura.antiguedad_minutos).toBe(4);
    expect(res2.banderas_calidad).toEqual(res1.banderas_calidad);
  });

  it('3. Expiración del caché tras superar la ventana de 10-15 min + Idempotencia UNIQUE', async () => {
    const ahoraMs1 = Date.parse('2026-01-15T12:00:00.000Z');
    const mockMeteo = vi.fn().mockResolvedValue(
      crearRespuestaMeteoMock({ observadoEn: '2026-01-15T12:00:00.000Z' })
    );

    // Primera llamada en t = 12:00Z
    const res1 = await consultarYRegistrarLecturaReal({
      consultarMeteoFn: mockMeteo,
      ahoraFn: () => ahoraMs1,
    });
    expect(res1.insertada_nueva).toBe(true);

    // Avanzar reloj a t = 12:13Z (13 min > TTL 12 min), pero Open-Meteo aún entrega observado_en = 12:00Z
    const ahoraMs2 = Date.parse('2026-01-15T12:13:00.000Z');
    const res2 = await consultarYRegistrarLecturaReal({
      consultarMeteoFn: mockMeteo,
      ahoraFn: () => ahoraMs2,
    });

    // Se invocó a Open-Meteo por segunda vez debido a caché vencido
    expect(mockMeteo).toHaveBeenCalledTimes(2);

    // NO se duplica la fila en PostgreSQL gracias a ON CONFLICT DO NOTHING
    const countRes = await pool.query(
      'SELECT COUNT(*) FROM lecturas_meteorologicas WHERE observado_en >= $1 AND observado_en < $2',
      [RANGO_PRUEBA_INICIO, RANGO_PRUEBA_FIN]
    );
    expect(Number(countRes.rows[0].count)).toBe(1);

    expect(res2.origen_respuesta).toBe('open_meteo');
    expect(res2.insertada_nueva).toBe(false);
    expect(res2.lectura.id).toBe(res1.lectura.id);
    expect(res2.lectura.observado_en).toBe('2026-01-15T12:00:00.000Z');
    expect(res2.lectura.antiguedad_minutos).toBe(13);
  });

  it('4. Nueva muestra real cuando avanza observado_en tras vencer caché', async () => {
    const ahoraMs1 = Date.parse('2026-01-15T12:00:00.000Z');
    const mockMeteo = vi
      .fn()
      .mockResolvedValueOnce(
        crearRespuestaMeteoMock({ observadoEn: '2026-01-15T12:00:00.000Z' })
      )
      .mockResolvedValueOnce(
        crearRespuestaMeteoMock({ observadoEn: '2026-01-15T12:15:00.000Z' })
      );

    const res1 = await consultarYRegistrarLecturaReal({
      consultarMeteoFn: mockMeteo,
      ahoraFn: () => ahoraMs1,
    });
    expect(res1.insertada_nueva).toBe(true);

    // Avanzar reloj a t = 12:26Z (26 min después, caché vencido) y nueva marca meteorológica 12:15Z
    const ahoraMs2 = Date.parse('2026-01-15T12:26:00.000Z');
    const res2 = await consultarYRegistrarLecturaReal({
      consultarMeteoFn: mockMeteo,
      ahoraFn: () => ahoraMs2,
    });

    // Se inserta una segunda fila en PostgreSQL
    const countRes = await pool.query(
      'SELECT COUNT(*) FROM lecturas_meteorologicas WHERE observado_en >= $1 AND observado_en < $2',
      [RANGO_PRUEBA_INICIO, RANGO_PRUEBA_FIN]
    );
    expect(Number(countRes.rows[0].count)).toBe(2);

    expect(res2.insertada_nueva).toBe(true);
    expect(res2.origen_respuesta).toBe('open_meteo');
    expect(res2.lectura.observado_en).toBe('2026-01-15T12:15:00.000Z');
    expect(res2.lectura.antiguedad_minutos).toBe(11); // 12:26 - 12:15 = 11 min

    // obtenerUltimaLecturaRegistrada entrega la más reciente
    const ultima = await obtenerUltimaLecturaRegistrada();
    expect(ultima.observado_en).toBe('2026-01-15T12:15:00.000Z');
    expect(ultima.id).toBe(res2.lectura.id);
  });

  it('5. P03 — Caída / Timeout de Open-Meteo (T5) existiendo lectura previa válida', async () => {
    // 1. Registrar lectura previa válida en t = 12:00Z
    const ahoraMs1 = Date.parse('2026-01-15T12:00:00.000Z');
    const mockMeteoExitoso = vi.fn().mockResolvedValue(
      crearRespuestaMeteoMock({ observadoEn: '2026-01-15T12:00:00.000Z' })
    );

    const resInicial = await consultarYRegistrarLecturaReal({
      consultarMeteoFn: mockMeteoExitoso,
      ahoraFn: () => ahoraMs1,
    });
    expect(resInicial.insertada_nueva).toBe(true);

    // 2. Avanzar reloj a t = 12:35Z (caché expirado: 35 min > 12 min)
    const ahoraMs2 = Date.parse('2026-01-15T12:35:00.000Z');
    const mockMeteoFalla = vi.fn().mockRejectedValue(
      new OpenMeteoError('Timeout simulado al consultar Open-Meteo', {
        codigo: 'TIMEOUT',
      })
    );

    const resFallo = await consultarYRegistrarLecturaReal({
      consultarMeteoFn: mockMeteoFalla,
      ahoraFn: () => ahoraMs2,
    });

    // Aserción a: NO lanza excepción no controlada y NO inserta fila nueva
    const countRes = await pool.query(
      'SELECT COUNT(*) FROM lecturas_meteorologicas WHERE observado_en >= $1 AND observado_en < $2',
      [RANGO_PRUEBA_INICIO, RANGO_PRUEBA_FIN]
    );
    expect(Number(countRes.rows[0].count)).toBe(1);

    // Aserción b: Metadatos de resiliencia y respaldo
    expect(resFallo.fallo_api).toBe(true);
    expect(resFallo.error_api).toEqual({
      codigo: 'TIMEOUT',
      mensaje: 'Timeout simulado al consultar Open-Meteo',
    });
    expect(resFallo.insertada_nueva).toBe(false);
    expect(resFallo.origen_respuesta).toBe('respaldo_bd_por_fallo_api');

    // Aserción c: Entrega último dato válido con antigüedad recalculada al momento actual (35 min)
    expect(resFallo.lectura).not.toBeNull();
    expect(resFallo.lectura.id).toBe(resInicial.lectura.id);
    expect(resFallo.lectura.observado_en).toBe('2026-01-15T12:00:00.000Z');
    expect(resFallo.lectura.antiguedad_minutos).toBe(35);
    expect(resFallo.banderas_calidad).toEqual({
      intensidad_completa: true,
      acum_24h_completo: true,
      acum_72h_completo: true,
      clasificacion_parcial: false,
    });
  });

  it('6. P03 (borde inicial) — Caída de Open-Meteo cuando la BD está completamente vacía', async () => {
    const ahoraMs = Date.parse('2026-01-15T12:00:00.000Z');
    const mockMeteo503 = vi.fn().mockRejectedValue(
      new OpenMeteoError('Servicio 503 no disponible', {
        codigo: 'HTTP_ERROR',
        statusHttp: 503,
      })
    );

    // Mock limpio de db para simular tabla 100% vacía sin depender de otras filas en PostgreSQL
    const dbVaciaMock = {
      query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
    };

    const res = await consultarYRegistrarLecturaReal({
      db: dbVaciaMock,
      consultarMeteoFn: mockMeteo503,
      ahoraFn: () => ahoraMs,
    });

    expect(res.fallo_api).toBe(true);
    expect(res.lectura).toBeNull();
    expect(res.origen_respuesta).toBe('sin_datos_por_fallo_api');
    expect(res.error_api).toEqual({
      codigo: 'HTTP_ERROR',
      mensaje: 'Servicio 503 no disponible',
    });
    expect(res.insertada_nueva).toBe(false);
    expect(res.banderas_calidad).toBeNull();
  });

  it('7. Deduplicación de peticiones concurrentes simultáneas (Promise.all)', async () => {
    const ahoraMs = Date.parse('2026-01-15T12:00:00.000Z');
    let invocaciones = 0;

    const mockMeteoLento = vi.fn(async () => {
      invocaciones++;
      await new Promise((resolve) => setTimeout(resolve, 25));
      return crearRespuestaMeteoMock({ observadoEn: '2026-01-15T12:00:00.000Z' });
    });

    // Dos peticiones disparadas exactamente en el mismo tick
    const [res1, res2] = await Promise.all([
      consultarYRegistrarLecturaReal({
        consultarMeteoFn: mockMeteoLento,
        ahoraFn: () => ahoraMs,
      }),
      consultarYRegistrarLecturaReal({
        consultarMeteoFn: mockMeteoLento,
        ahoraFn: () => ahoraMs,
      }),
    ]);

    // consultarMeteoFn se invocó una sola vez
    expect(mockMeteoLento).toHaveBeenCalledTimes(1);
    expect(invocaciones).toBe(1);

    // En PostgreSQL solo se insertó una tupla
    const countRes = await pool.query(
      'SELECT COUNT(*) FROM lecturas_meteorologicas WHERE observado_en >= $1 AND observado_en < $2',
      [RANGO_PRUEBA_INICIO, RANGO_PRUEBA_FIN]
    );
    expect(Number(countRes.rows[0].count)).toBe(1);

    // Ambas llamadas recibieron la misma lectura persistida
    expect(res1.lectura.id).toBe(res2.lectura.id);
    expect(res1.lectura.observado_en).toBe('2026-01-15T12:00:00.000Z');
    expect(res2.lectura.observado_en).toBe('2026-01-15T12:00:00.000Z');
    expect(res1.fallo_api).toBe(false);
    expect(res2.fallo_api).toBe(false);
  });
});
