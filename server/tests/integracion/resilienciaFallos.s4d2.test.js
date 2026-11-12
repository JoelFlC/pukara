/**
 * @file resilienciaFallos.s4d2.test.js
 * @description Suite de integración End-to-End para el Día 2 de la Semana 4 (S4D2):
 * Certificación exhaustiva de:
 *  - Escenario 1 (P02): Series horarias incompletas y valores nulos (Casos 1A, 1B y 1C).
 *  - Escenario 2 (P03 y Transición T5): Indisponibilidad/fallos consecutivos de Open-Meteo
 *    (Timeout/AbortError, HTTP 503 y JSON sin bloque hourly) en medio de histéresis de descenso
 *    (contador_descenso = 1) y posterior consolidación T3 al recuperarse el proveedor.
 *  - Escenario 3 (P11): Aislamiento estricto entre Modo Simulación (NORMAL, PRECAUCION, ALERTA,
 *    EMERGENCIA) y el flujo de Estado Real (ALERTA con contador_descenso = 1).
 */

import { describe, it, expect, beforeAll, beforeEach, afterEach, afterAll, vi } from 'vitest';
import request from 'supertest';
import { app } from '../../src/app.js';
import { pool } from '../../src/db/pool.js';
import { limpiarCacheLecturas } from '../../src/services/lecturas.service.js';
import {
  consultarOpenMeteo,
  OpenMeteoError,
  validarYNormalizarRespuesta,
} from '../../src/services/openMeteo.js';
import { asegurarUsuarioAdministrador } from '../../src/db/seedAdmin.js';

// Mock controlable de consultarOpenMeteo conservando las clases y validadores reales del módulo
vi.mock('../../src/services/openMeteo.js', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    consultarOpenMeteo: vi.fn(),
  };
});

const HORA_MS = 3_600_000;

/**
 * Construye una respuesta normalizada de Open-Meteo con control granular sobre la serie horaria
 * retrospectiva de 72 horas y la precipitación actual.
 *
 * @param {Object} opciones
 * @param {string} opciones.observadoEnIso Marca ISO UTC de observación
 * @param {number|null} opciones.precipActual Precipitación actual instantánea (mm/h)
 * @param {Function} [opciones.generadorHora] Función (kHorasAtras: 0..79) => number|null
 */
function construirPayloadOpenMeteoPersonalizado({
  observadoEnIso,
  precipActual,
  generadorHora = () => 0.1,
}) {
  const tsAncla = Math.floor(Date.parse(observadoEnIso) / HORA_MS) * HORA_MS;
  const tiemposUtc = [];
  const precipitacionMm = [];

  // Generamos 80 horas hacia atrás (k = 79 ... 0) donde k=0 es tsAncla, k=0..23 es ventana 24h y k=0..71 es ventana 72h
  for (let k = 79; k >= 0; k--) {
    const tsHora = tsAncla - k * HORA_MS;
    tiemposUtc.push(new Date(tsHora).toISOString());
    precipitacionMm.push(generadorHora(k));
  }

  return {
    fuente: 'Open-Meteo',
    observado_en: observadoEnIso,
    intervalo_actual_segundos: 900,
    actual: {
      precipitacion_mm: precipActual,
      temperatura_c: 12.8,
      humedad_pct: 76,
      viento_kmh: 10.2,
    },
    serie_horaria: {
      tiempos_utc: tiemposUtc,
      precipitacion_mm: precipitacionMm,
    },
  };
}

/**
 * Limpia lecturas, evaluaciones y caché en memoria dejando la versión 1 vigente intacta.
 */
async function limpiarEstadoPruebas() {
  limpiarCacheLecturas();
  await pool.query('DELETE FROM evaluaciones_nivel;');
  await pool.query('DELETE FROM lecturas_meteorologicas;');
  await pool.query("UPDATE configuraciones_reglas SET estado = 'vigente' WHERE version = 1;");
}

describe('SUITE DE INTEGRACIÓN S4D2 — DATOS FALTANTES (P02), FALLOS DE API (P03/T5) Y AISLAMIENTO SIMULACIÓN VS REAL (P11)', () => {
  beforeAll(async () => {
    await asegurarUsuarioAdministrador({ client: pool });
    await limpiarEstadoPruebas();
  });

  beforeEach(async () => {
    vi.clearAllMocks();
    await limpiarEstadoPruebas();
  });

  afterEach(async () => {
    await limpiarEstadoPruebas();
  });

  afterAll(async () => {
    await limpiarEstadoPruebas();
  });

  // ==========================================================================
  // ESCENARIO 1 — Certificación exhaustiva de P02 (Series horarias incompletas y nulos)
  // ==========================================================================
  describe('Escenario 1 — Certificación exhaustiva de P02 (Series horarias incompletas y valores nulos en integración)', () => {
    it('Caso 1A (Ventana 72h incompleta, 24h e intensidad completas): persiste estado="incompleta" con acum_72h_mm=null y clasifica usando solo intensidad_mm_h y acum_24h_mm', async () => {
      const tsObs = new Date(Date.now() - 10 * 60 * 1000).toISOString();

      // k = 0..23 (ventana 24h): 24 horas válidas con 1.2 mm/h -> acum_24h_mm = 28.8 mm (>= 25 -> ALERTA)
      // k = 24..71 (horas 25 a 72): inyectamos null en k = 30..39 -> horas_validas_72h = 62 (< 72) -> acum_72h_mm = null
      // precipActual = 3.0 mm/h (>= 2.5 -> PRECAUCION)
      vi.mocked(consultarOpenMeteo).mockResolvedValueOnce(
        construirPayloadOpenMeteoPersonalizado({
          observadoEnIso: tsObs,
          precipActual: 3.0,
          generadorHora: (k) => {
            if (k >= 0 && k < 24) return 1.2;
            if (k >= 30 && k < 40) return null;
            return 0.5;
          },
        })
      );

      const res = await request(app).get('/api/estado');

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);

      // Verificación en respuesta HTTP
      expect(res.body.lectura.estado).toBe('incompleta');
      expect(res.body.lectura.intensidad_mm_h).toBe(3.0);
      expect(res.body.lectura.acum_24h_mm).toBe(28.8);
      expect(res.body.lectura.acum_72h_mm).toBeNull();
      expect(res.body.lectura.horas_validas_24h).toBe(24);
      expect(res.body.lectura.horas_validas_72h).toBe(62);

      // Clasifica con el máximo entre intensidad_mm_h (PRECAUCION) y acum_24h_mm (ALERTA) -> ALERTA
      expect(res.body.nivel_calculado).toBe('ALERTA');
      expect(res.body.nivel_vigente).toBe('ALERTA');
      expect(res.body.clasificacion_parcial).toBe(true);
      expect(res.body.meteorologia.banderas_calidad.intensidad_completa).toBe(true);
      expect(res.body.meteorologia.banderas_calidad.acum_24h_completo).toBe(true);
      expect(res.body.meteorologia.banderas_calidad.acum_72h_completo).toBe(false);
      expect(res.body.meteorologia.banderas_calidad.clasificacion_parcial).toBe(true);

      // Verificación directa en PostgreSQL (lecturas_meteorologicas)
      const bdLectura = await pool.query(
        'SELECT estado, intensidad_mm_h, acum_24h_mm, acum_72h_mm, horas_validas_24h, horas_validas_72h FROM lecturas_meteorologicas WHERE id = $1;',
        [res.body.lectura.id]
      );
      expect(bdLectura.rows).toHaveLength(1);
      expect(bdLectura.rows[0].estado).toBe('incompleta');
      expect(Number(bdLectura.rows[0].intensidad_mm_h)).toBe(3.0);
      expect(Number(bdLectura.rows[0].acum_24h_mm)).toBe(28.8);
      expect(bdLectura.rows[0].acum_72h_mm).toBeNull();
      expect(Number(bdLectura.rows[0].horas_validas_24h)).toBe(24);
      expect(Number(bdLectura.rows[0].horas_validas_72h)).toBe(62);
    });

    it('Caso 1B (Ventanas 24h y 72h incompletas, solo intensidad válida): clasifica exclusivamente con intensidad_mm_h y expone estado "incompleta" y clasificacion_parcial en GET /api/estado', async () => {
      const tsObs = new Date(Date.now() - 8 * 60 * 1000).toISOString();

      // Huecos nulos dentro de las primeras 24 horas (k = 5..10 son null) -> tanto 24h como 72h son incompletas
      // Solo intensidad_mm_h = 7.2 mm/h (>= 6.5 -> ALERTA) es válida
      vi.mocked(consultarOpenMeteo).mockResolvedValueOnce(
        construirPayloadOpenMeteoPersonalizado({
          observadoEnIso: tsObs,
          precipActual: 7.2,
          generadorHora: (k) => (k >= 5 && k <= 10 ? null : 0.2),
        })
      );

      const res = await request(app).get('/api/estado');

      expect(res.status).toBe(200);
      expect(res.body.lectura.estado).toBe('incompleta');
      expect(res.body.lectura.intensidad_mm_h).toBe(7.2);
      expect(res.body.lectura.acum_24h_mm).toBeNull();
      expect(res.body.lectura.acum_72h_mm).toBeNull();
      expect(res.body.lectura.horas_validas_24h).toBe(18);
      expect(res.body.lectura.horas_validas_72h).toBe(66);

      // Clasificación exclusiva por intensidad_mm_h (7.2 >= 6.5 -> ALERTA)
      expect(res.body.nivel_calculado).toBe('ALERTA');
      expect(res.body.nivel_vigente).toBe('ALERTA');
      expect(res.body.clasificacion_parcial).toBe(true);
      expect(res.body.meteorologia.lectura.estado).toBe('incompleta');
      expect(res.body.meteorologia.banderas_calidad).toEqual({
        intensidad_completa: true,
        acum_24h_completo: false,
        acum_72h_completo: false,
        clasificacion_parcial: true,
      });
    });

    it('Caso 1C (Muestra totalmente inválida — ninguna variable completa): registra estado="invalida" y NO altera el nivel_vigente ni el contador_descenso de la última evaluación válida', async () => {
      // Paso previo: establecer estado válido en ALERTA con contador_descenso = 1
      const tsValida1 = new Date(Date.now() - 45 * 60 * 1000).toISOString();
      vi.mocked(consultarOpenMeteo).mockResolvedValueOnce(
        construirPayloadOpenMeteoPersonalizado({
          observadoEnIso: tsValida1,
          precipActual: 8.0, // ALERTA
          generadorHora: () => 0.5,
        })
      );
      const res1 = await request(app).get('/api/estado');
      expect(res1.body.nivel_vigente).toBe('ALERTA');
      expect(res1.body.contador_descenso).toBe(0);

      limpiarCacheLecturas();
      const tsValida2 = new Date(Date.now() - 25 * 60 * 1000).toISOString();
      vi.mocked(consultarOpenMeteo).mockResolvedValueOnce(
        construirPayloadOpenMeteoPersonalizado({
          observadoEnIso: tsValida2,
          precipActual: 3.0, // PRECAUCION -> inicia descenso (contador_descenso = 1)
          generadorHora: () => 0.1,
        })
      );
      const res2 = await request(app).get('/api/estado');
      expect(res2.body.nivel_vigente).toBe('ALERTA');
      expect(res2.body.contador_descenso).toBe(1);

      const evalsAntes = await pool.query('SELECT COUNT(*)::int AS total FROM evaluaciones_nivel;');
      expect(evalsAntes.rows[0].total).toBe(2);

      // Ahora llega una muestra totalmente inválida: intensidad_mm_h = null y huecos en 24h y 72h
      limpiarCacheLecturas();
      const tsInvalida = new Date(Date.now() - 5 * 60 * 1000).toISOString();
      vi.mocked(consultarOpenMeteo).mockResolvedValueOnce(
        construirPayloadOpenMeteoPersonalizado({
          observadoEnIso: tsInvalida,
          precipActual: null,
          generadorHora: (k) => (k < 30 ? null : 0.1),
        })
      );

      const resInvalida = await request(app).get('/api/estado');
      expect(resInvalida.status).toBe(200);

      // La lectura se guardó como 'invalida' con las 3 variables en null
      expect(resInvalida.body.lectura.estado).toBe('invalida');
      expect(resInvalida.body.lectura.intensidad_mm_h).toBeNull();
      expect(resInvalida.body.lectura.acum_24h_mm).toBeNull();
      expect(resInvalida.body.lectura.acum_72h_mm).toBeNull();

      // NO se creó una nueva fila en evaluaciones_nivel y se preservan nivel_vigente='ALERTA' y contador_descenso=1
      const evalsDespues = await pool.query('SELECT COUNT(*)::int AS total FROM evaluaciones_nivel;');
      expect(evalsDespues.rows[0].total).toBe(2);
      expect(resInvalida.body.nivel_vigente).toBe('ALERTA');
      expect(resInvalida.body.contador_descenso).toBe(1);
    });
  });

  // ==========================================================================
  // ESCENARIO 2 — Certificación exhaustiva de P03 y Transición T5
  // ==========================================================================
  describe('Escenario 2 — Certificación exhaustiva de P03 y Transición T5 (API Open-Meteo caída en medio de histéresis de descenso)', () => {
    it('Mantiene intactos nivel_vigente="ALERTA" y contador_descenso=1 durante 3 fallos consecutivos de Open-Meteo (Timeout, HTTP 503 y JSON sin hourly) y consolida descenso T3 recién en la segunda muestra válida independiente', async () => {
      // 1. Muestra inicial en ALERTA (hace 50 minutos)
      const tsMuestra1 = new Date(Date.now() - 50 * 60 * 1000).toISOString();
      vi.mocked(consultarOpenMeteo).mockResolvedValueOnce(
        construirPayloadOpenMeteoPersonalizado({
          observadoEnIso: tsMuestra1,
          precipActual: 7.5, // >= 6.5 -> ALERTA
          generadorHora: () => 0.4,
        })
      );

      const resPaso1 = await request(app).get('/api/estado');
      expect(resPaso1.status).toBe(200);
      expect(resPaso1.body.nivel_vigente).toBe('ALERTA');
      expect(resPaso1.body.contador_descenso).toBe(0);

      // 2. Primera muestra independiente de descenso en PRECAUCION (hace 30 minutos)
      limpiarCacheLecturas();
      const tsMuestra2 = new Date(Date.now() - 30 * 60 * 1000).toISOString();
      vi.mocked(consultarOpenMeteo).mockResolvedValueOnce(
        construirPayloadOpenMeteoPersonalizado({
          observadoEnIso: tsMuestra2,
          precipActual: 3.0, // >= 2.5 -> PRECAUCION
          generadorHora: () => 0.1,
        })
      );

      const resPaso2 = await request(app).get('/api/estado');
      expect(resPaso2.status).toBe(200);
      expect(resPaso2.body.nivel_calculado).toBe('PRECAUCION');
      expect(resPaso2.body.nivel_vigente).toBe('ALERTA');
      expect(resPaso2.body.contador_descenso).toBe(1);
      const idUltimaLecturaValida = resPaso2.body.lectura.id;

      const conteoLecturasBase = (
        await pool.query("SELECT COUNT(*)::int AS total FROM lecturas_meteorologicas WHERE modalidad = 'real';")
      ).rows[0].total;
      const conteoEvalsBase = (
        await pool.query(
          `SELECT COUNT(*)::int AS total
           FROM evaluaciones_nivel e
           JOIN lecturas_meteorologicas l ON l.id = e.lectura_id
           WHERE l.modalidad = 'real';`
        )
      ).rows[0].total;
      expect(conteoLecturasBase).toBe(2);
      expect(conteoEvalsBase).toBe(2);

      // 3. Simulación de 3 fallos consecutivos de Open-Meteo tras expirar caché:
      // (a) Timeout de red (ETIMEDOUT / AbortError)
      // (b) Error HTTP 503 Service Unavailable
      // (c) Respuesta JSON malformada sin bloque hourly (validada con validarYNormalizarRespuesta real)
      const fallosConsecutivos = [
        {
          nombre: 'Fallo (a): Timeout de red (ETIMEDOUT / AbortError)',
          fnMock: async () => {
            const abortErr = new Error('The operation was aborted (ETIMEDOUT)');
            abortErr.name = 'AbortError';
            throw new OpenMeteoError('Tiempo de espera agotado al consultar Open-Meteo', {
              codigo: 'TIMEOUT',
              causaOriginal: abortErr,
            });
          },
        },
        {
          nombre: 'Fallo (b): Error HTTP 503 Service Unavailable',
          fnMock: async () => {
            throw new OpenMeteoError('Respuesta HTTP no exitosa de Open-Meteo', {
              codigo: 'HTTP_ERROR',
              statusHttp: 503,
            });
          },
        },
        {
          nombre: 'Fallo (c): Respuesta JSON malformada sin bloque hourly',
          fnMock: async () => {
            // Invoca el validador real con un JSON sin bloque hourly para disparar RESPUESTA_CORRUPTA real
            return validarYNormalizarRespuesta({
              latitude: -16.525,
              longitude: -68.142,
              current: {
                time: new Date().toISOString(),
                interval: 900,
                precipitation: 2.8,
              },
              // Bloque hourly ausente deliberadamente
            });
          },
        },
      ];

      for (const fallo of fallosConsecutivos) {
        limpiarCacheLecturas();
        vi.mocked(consultarOpenMeteo).mockImplementationOnce(fallo.fnMock);

        const resFallo = await request(app).get('/api/estado');

        // 3.1. GET /api/estado responde 200 OK entregando la última lectura válida con su antiguedad_minutos
        expect(resFallo.status, fallo.nombre).toBe(200);
        expect(resFallo.body.ok, fallo.nombre).toBe(true);
        expect(resFallo.body.meteorologia.fallo_api_reciente, fallo.nombre).toBe(true);
        expect(resFallo.body.meteorologia.origen_respuesta, fallo.nombre).toBe(
          'respaldo_bd_por_fallo_api'
        );
        expect(resFallo.body.lectura.id, fallo.nombre).toBe(idUltimaLecturaValida);
        expect(typeof resFallo.body.antiguedad_minutos, fallo.nombre).toBe('number');
        expect(resFallo.body.antiguedad_minutos, fallo.nombre).toBeGreaterThanOrEqual(29);

        // 3.2. Cumplimiento estricto de T5: nivel_vigente sigue en ALERTA y contador_descenso sigue en 1
        expect(resFallo.body.nivel_vigente, fallo.nombre).toBe('ALERTA');
        expect(resFallo.body.contador_descenso, fallo.nombre).toBe(1);

        // 3.3. Ninguna fila nueva insertada en lecturas_meteorologicas ni en evaluaciones_nivel
        const lecturasActual = (
          await pool.query("SELECT COUNT(*)::int AS total FROM lecturas_meteorologicas WHERE modalidad = 'real';")
        ).rows[0].total;
        const evalsActual = (
          await pool.query(
            `SELECT COUNT(*)::int AS total
             FROM evaluaciones_nivel e
             JOIN lecturas_meteorologicas l ON l.id = e.lectura_id
             WHERE l.modalidad = 'real';`
          )
        ).rows[0].total;
        expect(lecturasActual, fallo.nombre).toBe(2);
        expect(evalsActual, fallo.nombre).toBe(2);

        const ultimaEvalBD = await pool.query(
          'SELECT nivel_vigente, contador_descenso FROM evaluaciones_nivel ORDER BY id DESC LIMIT 1;'
        );
        expect(ultimaEvalBD.rows[0].nivel_vigente, fallo.nombre).toBe('ALERTA');
        expect(Number(ultimaEvalBD.rows[0].contador_descenso), fallo.nombre).toBe(1);
      }

      // 4. Restaurar Open-Meteo con la segunda muestra independiente en PRECAUCION (hace 10 minutos)
      limpiarCacheLecturas();
      const tsMuestra3 = new Date(Date.now() - 10 * 60 * 1000).toISOString();
      vi.mocked(consultarOpenMeteo).mockResolvedValueOnce(
        construirPayloadOpenMeteoPersonalizado({
          observadoEnIso: tsMuestra3,
          precipActual: 2.8, // PRECAUCION (segunda muestra consecutiva independiente)
          generadorHora: () => 0.1,
        })
      );

      const resRecuperacion = await request(app).get('/api/estado');
      expect(resRecuperacion.status).toBe(200);
      expect(resRecuperacion.body.meteorologia.fallo_api_reciente).toBe(false);
      expect(resRecuperacion.body.meteorologia.origen_respuesta).toBe('open_meteo');

      // Recién aquí completa la transición T3 bajando a PRECAUCION con contador_descenso = 0
      expect(resRecuperacion.body.nivel_calculado).toBe('PRECAUCION');
      expect(resRecuperacion.body.nivel_vigente).toBe('PRECAUCION');
      expect(resRecuperacion.body.contador_descenso).toBe(0);
    });
  });

  // ==========================================================================
  // ESCENARIO 3 — Certificación exhaustiva de P11 (Aislamiento Simulación vs Real)
  // ==========================================================================
  describe('Escenario 3 — Certificación exhaustiva de P11 (Aislamiento total entre Modo Simulación y Estado Real)', () => {
    it('Inyecta secuencialmente los 4 niveles en modalidad="simulada" sin alterar jamás el estado real en ALERTA con contador_descenso = 1', async () => {
      // 1. Preparar el estado real en ALERTA con contador_descenso = 1
      const tsReal1 = new Date(Date.now() - 40 * 60 * 1000).toISOString();
      vi.mocked(consultarOpenMeteo).mockResolvedValueOnce(
        construirPayloadOpenMeteoPersonalizado({
          observadoEnIso: tsReal1,
          precipActual: 8.0, // ALERTA
          generadorHora: () => 0.5,
        })
      );
      await request(app).get('/api/estado');

      limpiarCacheLecturas();
      const tsReal2 = new Date(Date.now() - 20 * 60 * 1000).toISOString();
      vi.mocked(consultarOpenMeteo).mockResolvedValueOnce(
        construirPayloadOpenMeteoPersonalizado({
          observadoEnIso: tsReal2,
          precipActual: 3.0, // PRECAUCION -> deja nivel_vigente = 'ALERTA', contador_descenso = 1
          generadorHora: () => 0.1,
        })
      );
      const resRealBase = await request(app).get('/api/estado');
      expect(resRealBase.status).toBe(200);
      expect(resRealBase.body.nivel_vigente).toBe('ALERTA');
      expect(resRealBase.body.contador_descenso).toBe(1);
      const evalRealBaseId = resRealBase.body.evaluacion.evaluacion_id;

      // 2. Inyectar secuencialmente los 4 niveles informativos en Modo Simulación
      const escenariosSimulados = [
        {
          nivelEsperado: 'NORMAL',
          payload: {
            intensidad_mm_h: 0.4,
            acum_24h_mm: 2.0,
            acum_72h_mm: 5.0,
            observado_en: '2026-03-12T12:00:00.000Z',
            reiniciar_antes: true,
          },
        },
        {
          nivelEsperado: 'PRECAUCION',
          payload: {
            intensidad_mm_h: 3.2,
            acum_24h_mm: 12.0,
            acum_72h_mm: 28.0,
            observado_en: '2026-03-12T12:30:00.000Z',
            reiniciar_antes: false,
          },
        },
        {
          nivelEsperado: 'ALERTA',
          payload: {
            intensidad_mm_h: 7.5,
            acum_24h_mm: 28.0,
            acum_72h_mm: 65.0,
            observado_en: '2026-03-12T13:00:00.000Z',
            reiniciar_antes: false,
          },
        },
        {
          nivelEsperado: 'EMERGENCIA',
          payload: {
            intensidad_mm_h: 14.0,
            acum_24h_mm: 48.0,
            acum_72h_mm: 98.0,
            observado_en: '2026-03-12T13:30:00.000Z',
            reiniciar_antes: false,
          },
        },
      ];

      for (const paso of escenariosSimulados) {
        const resInyeccion = await request(app)
          .post('/api/simulacion/lectura')
          .send(paso.payload);

        expect(resInyeccion.status).toBe(201);
        expect(resInyeccion.body.modalidad).toBe('simulada');
        expect(resInyeccion.body.lectura.modalidad).toBe('simulada');
        expect(resInyeccion.body.evaluacion.nivel_vigente).toBe(paso.nivelEsperado);

        // Comprobar GET /api/estado?modalidad=simulada
        const resEstadoSim = await request(app).get(
          `/api/estado?modalidad=simulada&ahora=${encodeURIComponent(paso.payload.observado_en)}`
        );
        expect(resEstadoSim.status).toBe(200);
        expect(resEstadoSim.body.modalidad).toBe('simulada');
        expect(resEstadoSim.body.es_simulacion).toBe(true);
        expect(resEstadoSim.body.nivel_vigente).toBe(paso.nivelEsperado);

        // Comprobar simultáneamente que GET /api/estado (modalidad real por defecto) sigue intacto
        const resEstadoReal = await request(app).get('/api/estado');
        expect(resEstadoReal.status).toBe(200);
        expect(resEstadoReal.body.modalidad).toBe('real');
        expect(resEstadoReal.body.es_simulacion).toBe(false);
        expect(resEstadoReal.body.nivel_vigente).toBe('ALERTA');
        expect(resEstadoReal.body.contador_descenso).toBe(1);
        expect(resEstadoReal.body.evaluacion.evaluacion_id).toBe(evalRealBaseId);
      }

      // 3. Verificar en PostgreSQL el etiquetado de modalidad = 'simulada' y la inmutabilidad de las filas reales
      const lecturasSimBD = await pool.query(
        "SELECT id, modalidad FROM lecturas_meteorologicas WHERE modalidad = 'simulada';"
      );
      expect(lecturasSimBD.rows).toHaveLength(4);
      for (const fila of lecturasSimBD.rows) {
        expect(fila.modalidad).toBe('simulada');
      }

      const evalRealBD = await pool.query(
        `SELECT e.id, e.nivel_vigente, e.contador_descenso
         FROM evaluaciones_nivel e
         JOIN lecturas_meteorologicas l ON l.id = e.lectura_id
         WHERE l.modalidad = 'real'
         ORDER BY l.observado_en DESC, e.id DESC
         LIMIT 1;`
      );
      expect(evalRealBD.rows).toHaveLength(1);
      expect(Number(evalRealBD.rows[0].id)).toBe(evalRealBaseId);
      expect(evalRealBD.rows[0].nivel_vigente).toBe('ALERTA');
      expect(Number(evalRealBD.rows[0].contador_descenso)).toBe(1);

      // 4. Limpiar simulaciones y verificar que el estado real permanece intacto
      const resDeleteSim = await request(app).delete('/api/simulacion');
      expect(resDeleteSim.status).toBe(200);
      expect(resDeleteSim.body.lecturas_eliminadas).toBe(4);

      const resRealPostLimpieza = await request(app).get('/api/estado');
      expect(resRealPostLimpieza.status).toBe(200);
      expect(resRealPostLimpieza.body.nivel_vigente).toBe('ALERTA');
      expect(resRealPostLimpieza.body.contador_descenso).toBe(1);
    });
  });
});

