import { describe, it, expect, beforeEach, afterEach, afterAll, vi } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { pool } from '../src/db/pool.js';
import { seedCapas } from '../src/db/seedCapas.js';
import { limpiarCacheLecturas } from '../src/services/lecturas.service.js';
import { AVISO_PERMANENTE_OFICIAL } from '../src/services/estado.service.js';
import { OpenMeteoError, consultarOpenMeteo } from '../src/services/openMeteo.js';

// Mockear el cliente Open-Meteo para aislar completamente las pruebas HTTP sin tocar internet
vi.mock('../src/services/openMeteo.js', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    consultarOpenMeteo: vi.fn(),
  };
});

const RANGO_PRUEBA_INICIO = '2026-01-15T00:00:00.000Z';
const RANGO_PRUEBA_FIN = '2026-01-16T00:00:00.000Z';

function crearRespuestaMeteoMock({
  observadoEn = '2026-01-15T18:00:00.000Z',
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

describe('Rutas HTTP: GET /api/estado (v1)', () => {
  beforeEach(async () => {
    limpiarCacheLecturas();
    vi.clearAllMocks();
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

  it('1. Debe ejecutar seedCapas() dos veces y mantener exactamente 2 zonas y 6 puntos sin duplicados', async () => {
    // Primera y segunda ejecución para comprobar idempotencia
    await seedCapas();
    await seedCapas();

    const resZonas = await pool.query(
      'SELECT * FROM zonas_referencia ORDER BY id ASC;'
    );
    expect(resZonas.rows.length).toBe(2);
    for (const z of resZonas.rows) {
      expect(z.verificada).toBe(false);
      expect(z.advertencia).toBe('referencia de demostración, no validada');
      expect(z.geometria).toHaveProperty('type', 'Polygon');
      expect(Array.isArray(z.geometria.coordinates)).toBe(true);
    }

    const resPuntos = await pool.query(
      'SELECT * FROM puntos_referencia ORDER BY id ASC;'
    );
    expect(resPuntos.rows.length).toBe(6);
    for (const p of resPuntos.rows) {
      expect(p.estado_verificacion).toBe('sin_verificar');
      expect(p.activo).toBe(true);
      expect(Number(p.latitud)).toBeLessThanOrEqual(90);
      expect(Number(p.latitud)).toBeGreaterThanOrEqual(-90);
      expect(Number(p.longitud)).toBeLessThanOrEqual(180);
      expect(Number(p.longitud)).toBeGreaterThanOrEqual(-180);
    }

    const resContactos = await pool.query(
      'SELECT * FROM contactos_emergencia ORDER BY id ASC;'
    );
    expect(resContactos.rows.length).toBeGreaterThanOrEqual(3);
  });

  it('2. GET /api/estado debe responder HTTP 200 con payload v1 completo, aviso permanente, zonas y puntos numéricos', async () => {
    limpiarCacheLecturas();
    const fechaObs = '2026-01-15T18:00:00.000Z';
    consultarOpenMeteo.mockResolvedValueOnce(
      crearRespuestaMeteoMock({
        observadoEn: fechaObs,
        precipitacionActual: 3.5,
      })
    );

    const res = await request(app)
      .get('/api/estado')
      .expect('Content-Type', /json/)
      .expect(200);

    expect(res.body.ok).toBe(true);
    expect(res.body.version_esquema_api).toBe('v1');
    expect(res.body.modalidad).toBe('real');
    expect(res.body.aviso_permanente).toBe(AVISO_PERMANENTE_OFICIAL);
    expect(res.body.zona_piloto.nombre).toBe(
      'Sector Llojeta / Bajo Llojeta (Macrodistrito Cotahuma, La Paz)'
    );
    expect(res.body.zona_piloto.latitud_central).toBe(-16.5235);
    expect(res.body.zona_piloto.longitud_central).toBe(-68.1425);
    expect(res.body.estado_operativo).toBe('LECTURA_DISPONIBLE_V1');
    expect(res.body.clasificacion.estado_motor).toBe(
      'PENDIENTE_MOTOR_SEMANA_2'
    );

    // Meteorología
    expect(res.body.meteorologia.disponible).toBe(true);
    expect(res.body.meteorologia.origen_respuesta).toBe('open_meteo');
    expect(res.body.meteorologia.fallo_api_reciente).toBe(false);
    expect(res.body.meteorologia.lectura).not.toBeNull();
    expect(res.body.meteorologia.lectura.observado_en).toBe(fechaObs);
    expect(typeof res.body.meteorologia.lectura.antiguedad_minutos).toBe(
      'number'
    );
    expect(res.body.meteorologia.lectura.intensidad_mm_h).toBe(3.5);

    // Capas de referencia
    expect(res.body.capas_referencia.leyenda_obligatoria).toBe(
      'referencia de demostración, no validada'
    );
    expect(res.body.capas_referencia.zonas.length).toBe(2);
    expect(res.body.capas_referencia.zonas[0].geometria.type).toBe('Polygon');
    expect(res.body.capas_referencia.puntos.length).toBe(6);
    for (const p of res.body.capas_referencia.puntos) {
      expect(typeof p.latitud).toBe('number');
      expect(typeof p.longitud).toBe('number');
      expect(typeof p.id).toBe('number');
      expect(p.estado_verificacion).toBe('sin_verificar');
    }

    // Contactos y recomendaciones
    expect(Array.isArray(res.body.contactos_emergencia)).toBe(true);
    expect(res.body.contactos_emergencia.length).toBeGreaterThanOrEqual(3);
    expect(Array.isArray(res.body.recomendaciones_publicadas)).toBe(true);
    expect(res.body.recomendaciones_publicadas.length).toBe(4);
  });

  it('3. GET /api/estado ante fallo de Open-Meteo (TIMEOUT) debe responder HTTP 200 con respaldo de BD y fallo_api_reciente: true', async () => {
    limpiarCacheLecturas();
    const fechaPrevia = '2026-01-15T18:00:00.000Z';

    // 1. Registrar primero una lectura previa válida en BD
    consultarOpenMeteo.mockResolvedValueOnce(
      crearRespuestaMeteoMock({
        observadoEn: fechaPrevia,
        precipitacionActual: 2.0,
      })
    );
    await request(app).get('/api/estado').expect(200);

    // 2. Limpiar caché en memoria para forzar consulta externa en la siguiente petición
    limpiarCacheLecturas();

    // 3. Simular que ahora Open-Meteo falla con TIMEOUT
    consultarOpenMeteo.mockRejectedValueOnce(
      new OpenMeteoError('Timeout simulado en Open-Meteo', {
        codigo: 'TIMEOUT',
      })
    );

    const res = await request(app)
      .get('/api/estado')
      .expect('Content-Type', /json/)
      .expect(200);

    expect(res.body.ok).toBe(true);
    expect(res.body.meteorologia.fallo_api_reciente).toBe(true);
    expect(res.body.meteorologia.origen_respuesta).toBe(
      'respaldo_bd_por_fallo_api'
    );
    expect(res.body.meteorologia.lectura).not.toBeNull();
    expect(res.body.meteorologia.lectura.observado_en).toBe(fechaPrevia);
    expect(typeof res.body.meteorologia.lectura.antiguedad_minutos).toBe(
      'number'
    );
    expect(res.body.estado_operativo).toBe('LECTURA_DISPONIBLE_V1');
  });
});
