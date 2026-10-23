import { describe, it, expect } from 'vitest';
import {
  OpenMeteoError,
  construirUrlOpenMeteo,
  normalizarMarcaIsoUtc,
  normalizarFechaIsoUtc,
  validarYNormalizarRespuesta,
  consultarOpenMeteo,
} from '../src/services/openMeteo.js';
import { obtenerConfigZonaPiloto } from '../src/config/zonaPiloto.js';

describe('Servicio Open-Meteo: Configuración de Zona Piloto', () => {
  it('debe retornar la configuración de Llojeta con números finitos y dentro de rango geográfico', () => {
    const config = obtenerConfigZonaPiloto();
    expect(config.nombre).toBe(
      'Sector Llojeta / Bajo Llojeta (Macrodistrito Cotahuma, La Paz)'
    );
    expect(config.latitud).toBe(-16.5235);
    expect(config.longitud).toBe(-68.1425);
    expect(config.latitud).toBeGreaterThanOrEqual(-90);
    expect(config.latitud).toBeLessThanOrEqual(90);
    expect(config.longitud).toBeGreaterThanOrEqual(-180);
    expect(config.longitud).toBeLessThanOrEqual(180);
  });
});

describe('Servicio Open-Meteo: Construcción de URL y Normalización', () => {
  it('1. Construcción correcta de URL con coordenadas y parámetros canónicos', () => {
    const urlStr = construirUrlOpenMeteo();
    const url = new URL(urlStr);

    expect(url.origin).toBe('https://api.open-meteo.com');
    expect(url.pathname).toBe('/v1/forecast');
    expect(url.searchParams.get('latitude')).toBe('-16.5235');
    expect(url.searchParams.get('longitude')).toBe('-68.1425');
    expect(url.searchParams.get('past_days')).toBe('4');
    expect(url.searchParams.get('forecast_days')).toBe('1');
    expect(url.searchParams.get('timezone')).toBe('UTC');
    expect(url.searchParams.get('current')).toBe(
      'precipitation,temperature_2m,relative_humidity_2m,wind_speed_10m'
    );
    expect(url.searchParams.get('hourly')).toBe('precipitation');
  });

  it('2. Normalización válida y preservación estricta de null en hourly', () => {
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

    const normalizado = validarYNormalizarRespuesta(mockJson, {
      latitud: -16.5235,
      longitud: -68.1425,
    });

    expect(normalizado.fuente).toBe('Open-Meteo');
    expect(normalizado.observado_en).toBe('2026-10-23T22:30:00.000Z');
    expect(normalizado.intervalo_actual_segundos).toBe(900);
    expect(normalizado.coordenada_consultada.latitud).toBe(-16.5235);
    expect(normalizado.coordenada_consultada.longitud).toBe(-68.1425);
    expect(normalizado.coordenada_modelo.latitud).toBe(-16.52);
    expect(normalizado.coordenada_modelo.longitud).toBe(-68.14);
    expect(normalizado.coordenada_modelo.elevacion_m).toBe(3650);
    expect(normalizado.actual.precipitacion_mm).toBe(1.5);
    expect(normalizado.actual.temperatura_c).toBe(13.2);
    expect(normalizado.actual.humedad_pct).toBe(78);
    expect(normalizado.actual.viento_kmh).toBe(10.4);

    // CRÍTICO: El índice 1 debe preservar estrictamente null y NO convertirse en 0
    expect(normalizado.serie_horaria.precipitacion_mm.length).toBe(3);
    expect(normalizado.serie_horaria.precipitacion_mm[0]).toBe(0.0);
    expect(normalizado.serie_horaria.precipitacion_mm[1]).toBeNull();
    expect(normalizado.serie_horaria.precipitacion_mm[2]).toBe(2.4);
    expect(normalizado.serie_horaria.tiempos_utc[0]).toBe('2026-10-23T21:00:00.000Z');
  });

  it('3. Timeout controlado (TIMEOUT): un fetchImpl lento aborta al superar timeoutMs: 25', async () => {
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
        timeoutMs: 25,
      })
    ).rejects.toThrowError(OpenMeteoError);

    try {
      await consultarOpenMeteo({
        fetchImpl: fetchLento,
        timeoutMs: 25,
      });
    } catch (err) {
      expect(err).toBeInstanceOf(OpenMeteoError);
      expect(err.codigo).toBe('TIMEOUT');
      expect(err.causaOriginal).toBeDefined();
    }
  });

  it('4. Fallo de red (RED_ERROR): fetchImpl que rechaza con TypeError("fetch failed")', async () => {
    const fetchFallaRed = async () => {
      throw new TypeError('fetch failed');
    };

    try {
      await consultarOpenMeteo({ fetchImpl: fetchFallaRed });
      expect.fail('Debió arrojar error de red');
    } catch (err) {
      expect(err).toBeInstanceOf(OpenMeteoError);
      expect(err.codigo).toBe('RED_ERROR');
      expect(err.causaOriginal).toBeDefined();
    }
  });

  it('5. Error HTTP (HTTP_ERROR): respuesta con ok: false y status: 503 / 502 / 429', async () => {
    // Caso 503 Service Unavailable
    const fetch503 = async () => ({
      ok: false,
      status: 503,
      statusText: 'Service Unavailable',
    });

    try {
      await consultarOpenMeteo({ fetchImpl: fetch503 });
      expect.fail('Debió arrojar error para 503');
    } catch (err) {
      expect(err).toBeInstanceOf(OpenMeteoError);
      expect(err.codigo).toBe('HTTP_ERROR');
      expect(err.statusHttp).toBe(503);
    }

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
  });

  it('6. Respuestas corruptas (RESPUESTA_CORRUPTA): payloads anómalos y body no-JSON', async () => {
    // 6.a Falta bloque hourly
    const sinHourly = {
      current: { time: '2026-10-23T22:30', interval: 900 },
    };
    expect(() => validarYNormalizarRespuesta(sinHourly)).toThrowError(OpenMeteoError);
    try {
      validarYNormalizarRespuesta(sinHourly);
    } catch (err) {
      expect(err.codigo).toBe('RESPUESTA_CORRUPTA');
    }

    // 6.b hourly.time y hourly.precipitation de distinta longitud
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

    // 6.c current.time inválido ("fecha-invalida")
    const fechaInvalida = {
      current: { time: 'fecha-invalida', interval: 900 },
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

    // 6.d Body no-JSON (ej. HTML de error o texto corrupto)
    const fetchNoJson = async () => ({
      ok: true,
      json: async () => {
        throw new SyntaxError('Unexpected token < in JSON at position 0');
      },
    });

    try {
      await consultarOpenMeteo({ fetchImpl: fetchNoJson });
      expect.fail('Debió arrojar error para body no-JSON');
    } catch (err) {
      expect(err).toBeInstanceOf(OpenMeteoError);
      expect(err.codigo).toBe('RESPUESTA_CORRUPTA');
      expect(err.causaOriginal).toBeDefined();
    }
  });

  it('7. Helper normalizarMarcaIsoUtc: formatea ISO UTC o arroja RESPUESTA_CORRUPTA', () => {
    expect(normalizarMarcaIsoUtc('2026-10-23T22:45')).toBe('2026-10-23T22:45:00.000Z');
    expect(normalizarMarcaIsoUtc('2026-10-23T22:45Z')).toBe('2026-10-23T22:45:00.000Z');
    expect(normalizarFechaIsoUtc('2026-10-23T22:00')).toBe('2026-10-23T22:00:00.000Z');

    expect(() => normalizarMarcaIsoUtc('')).toThrowError(OpenMeteoError);
    expect(() => normalizarMarcaIsoUtc(null)).toThrowError(OpenMeteoError);
    expect(() => normalizarMarcaIsoUtc('invalido')).toThrowError(OpenMeteoError);
  });
});
