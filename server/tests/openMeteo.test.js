import { describe, it, expect } from 'vitest';
import {
  OpenMeteoError,
  construirUrlOpenMeteo,
  normalizarFechaIsoUtc,
  validarYNormalizarRespuesta,
  consultarOpenMeteo,
} from '../src/services/openMeteo.js';

describe('Servicio Open-Meteo: Construcción de URL y Normalización', () => {
  it('1. Construcción correcta de URL con coordenadas y parámetros canónicos', () => {
    const urlStr = construirUrlOpenMeteo();
    const url = new URL(urlStr);

    expect(url.origin).toBe('https://api.open-meteo.com');
    expect(url.pathname).toBe('/v1/forecast');
    expect(url.searchParams.get('latitude')).toBe('-16.5235');
    expect(url.searchParams.get('longitude')).toBe('-68.1425');
    expect(url.searchParams.get('past_days')).toBe('4');
    expect(url.searchParams.get('timezone')).toBe('UTC');
    expect(url.searchParams.get('current')).toBe(
      'precipitation,temperature_2m,relative_humidity_2m,wind_speed_10m'
    );
    expect(url.searchParams.get('hourly')).toBe('precipitation');
  });

  it('2. Respuesta válida normalizada: convierte tiempo a ISO UTC y preserva nulls en hourly', () => {
    const mockJson = {
      latitude: -16.52,
      longitude: -68.14,
      elevation: 3650,
      current: {
        time: '2026-10-23T22:30',
        interval: 900,
        precipitation: 1.5,
        temperature_2m: 13.2,
        relative_humidity_2m: 78,
        wind_speed_10m: 10.4,
      },
      hourly: {
        time: ['2026-10-23T21:00', '2026-10-23T22:00', '2026-10-23T23:00'],
        precipitation: [0.0, null, 2.4],
      },
    };

    const normalizado = validarYNormalizarRespuesta(mockJson);

    expect(normalizado.fuente).toBe('open-meteo');
    expect(normalizado.observado_en).toBe('2026-10-23T22:30:00.000Z');
    expect(normalizado.intervalo_actual_segundos).toBe(900);
    expect(normalizado.coordenada_modelo.latitud).toBe(-16.52);
    expect(normalizado.coordenada_modelo.longitud).toBe(-68.14);
    expect(normalizado.elevacion_m).toBe(3650);
    expect(normalizado.actual.precipitacion_mm).toBe(1.5);
    expect(normalizado.actual.temperatura_c).toBe(13.2);

    // CRÍTICO: El índice 1 debe preservar estrictamente null y NO convertirse en 0
    expect(normalizado.serie_horaria.total_horas).toBe(3);
    expect(normalizado.serie_horaria.precipitacion_mm[0]).toBe(0.0);
    expect(normalizado.serie_horaria.precipitacion_mm[1]).toBeNull();
    expect(normalizado.serie_horaria.precipitacion_mm[2]).toBe(2.4);
    expect(normalizado.serie_horaria.tiempos_utc[0]).toBe('2026-10-23T21:00:00.000Z');
  });

  it('3. Control de Timeout con AbortController: arroja OpenMeteoError con código TIMEOUT', async () => {
    // Mock de fetch que respeta signal pero tarda más que el timeout configurado
    const fetchLento = (url, { signal }) =>
      new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          resolve({
            ok: true,
            json: async () => ({}),
          });
        }, 150);

        signal.addEventListener('abort', () => {
          clearTimeout(timer);
          const err = new Error('Operación cancelada por timeout');
          err.name = 'AbortError';
          reject(err);
        });
      });

    await expect(
      consultarOpenMeteo({
        fetchImpl: fetchLento,
        timeoutMs: 30,
      })
    ).rejects.toThrowError(OpenMeteoError);

    try {
      await consultarOpenMeteo({
        fetchImpl: fetchLento,
        timeoutMs: 30,
      });
    } catch (err) {
      expect(err).toBeInstanceOf(OpenMeteoError);
      expect(err.codigo).toBe('TIMEOUT');
      expect(err.detalles.timeoutMs).toBe(30);
    }
  });

  it('4. Control de Errores HTTP (502 / 429): arroja OpenMeteoError con código HTTP_ERROR y status', async () => {
    // Caso 502 Bad Gateway
    const fetch502 = async () => ({
      ok: false,
      status: 502,
      statusText: 'Bad Gateway',
    });

    try {
      await consultarOpenMeteo({ fetchImpl: fetch502 });
      expect.fail('Debió arrojar error para 502');
    } catch (err) {
      expect(err).toBeInstanceOf(OpenMeteoError);
      expect(err.codigo).toBe('HTTP_ERROR');
      expect(err.statusHttp).toBe(502);
    }

    // Caso 429 Too Many Requests
    const fetch429 = async () => ({
      ok: false,
      status: 429,
      statusText: 'Too Many Requests',
    });

    try {
      await consultarOpenMeteo({ fetchImpl: fetch429 });
      expect.fail('Debió arrojar error para 429');
    } catch (err) {
      expect(err).toBeInstanceOf(OpenMeteoError);
      expect(err.codigo).toBe('HTTP_ERROR');
      expect(err.statusHttp).toBe(429);
    }
  });

  it('5. Control de Respuestas Corruptas: valida payloads anómalos con código RESPUESTA_CORRUPTA', () => {
    // 5.1 JSON sin bloque hourly
    const sinHourly = {
      current: { time: '2026-10-23T22:30', interval: 900 },
    };
    expect(() => validarYNormalizarRespuesta(sinHourly)).toThrowError(OpenMeteoError);
    try {
      validarYNormalizarRespuesta(sinHourly);
    } catch (err) {
      expect(err.codigo).toBe('RESPUESTA_CORRUPTA');
    }

    // 5.2 Arreglos hourly.time y hourly.precipitation de distinta longitud
    const longitudDispar = {
      current: { time: '2026-10-23T22:30', interval: 900 },
      hourly: {
        time: ['2026-10-23T21:00', '2026-10-23T22:00'],
        precipitation: [1.2],
      },
    };
    expect(() => validarYNormalizarRespuesta(longitudDispar)).toThrowError(OpenMeteoError);
    try {
      validarYNormalizarRespuesta(longitudDispar);
    } catch (err) {
      expect(err.codigo).toBe('RESPUESTA_CORRUPTA');
    }

    // 5.3 current.time con fecha inválida
    const fechaInvalida = {
      current: { time: 'cadena-no-fecha', interval: 900 },
      hourly: {
        time: ['2026-10-23T21:00'],
        precipitation: [0.0],
      },
    };
    expect(() => validarYNormalizarRespuesta(fechaInvalida)).toThrowError(OpenMeteoError);
    try {
      validarYNormalizarRespuesta(fechaInvalida);
    } catch (err) {
      expect(err.codigo).toBe('RESPUESTA_CORRUPTA');
    }
  });
});
