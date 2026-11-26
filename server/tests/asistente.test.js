/**
 * @file asistente.test.js
 * @description Pruebas de blindaje semántico, cascada LLM (Cloud -> Ollama -> Determinista)
 * y endpoint POST /api/asistente con rate limiting.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import {
  PALABRAS_PROHIBIDAS,
  construirSystemPrompt,
  validarYFiltrarRespuesta,
} from '../src/services/asistenteGuardrails.js';
import { consultarAsistente } from '../src/services/asistenteLlmService.js';
import { limpiarRateLimiterAsistente } from '../src/routes/asistente.js';

describe('Fase 2.5 — Asistente Híbrido con LLM en Cascada y Blindaje (asistente.test.js)', () => {
  beforeEach(() => {
    limpiarRateLimiterAsistente();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    limpiarRateLimiterAsistente();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('1. construirSystemPrompt inyecta contexto vigente y reglas estrictas de dominio', () => {
    const prompt = construirSystemPrompt({
      nivelVigente: 'ALERTA',
      estadoSistema: 'ALERTA',
      antiguedadMinutos: 7,
      esSimulacion: true,
      recomendacionVigente: {
        titulo: 'Monitoreo de taludes',
        contenido: 'Alejarse de quebradas en Llojeta.',
      },
    });

    expect(prompt).toContain('Zorrito');
    expect(prompt).toContain('PUKARA');
    expect(prompt).toContain('nivel informativo de lluvia=ALERTA');
    expect(prompt).toContain('simulación académica');
    expect(prompt).toContain('CENSURA ESTRICTA DE DOMINIO');
    expect(prompt).toContain('Alejarse de quebradas en Llojeta.');
  });

  it('2. validarYFiltrarRespuesta bloquea todas las palabras prohibidas y deja pasar texto seguro', () => {
    const contexto = { nivelVigente: 'PRECAUCION', esSimulacion: false };

    for (const prohibida of PALABRAS_PROHIBIDAS) {
      const res = validarYFiltrarRespuesta(
        `Debes seguir esta ${prohibida} de inmediato.`,
        contexto
      );
      expect(res.bloqueada).toBe(true);
      expect(res.respuesta).toContain('nivel informativo de lluvia');
      expect(res.respuesta.toLowerCase()).not.toContain(prohibida);
    }

    const resVacia = validarYFiltrarRespuesta('   ', contexto);
    expect(resVacia.bloqueada).toBe(true);

    const resValida = validarYFiltrarRespuesta(
      'El nivel informativo de lluvia actual es PRECAUCIÓN en Llojeta. Revisa canaletas y no sustituye canales oficiales.',
      contexto
    );
    expect(resValida.bloqueada).toBe(false);
    expect(resValida.respuesta).toContain('PRECAUCIÓN');
  });

  it('3. Cascada Nivel 1 (Cloud Groq y Gemini): responde con origen "cloud" si la API responde OK', async () => {
    const fetchGroqOk = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content:
                'Hola vecino, el nivel informativo de lluvia en Llojeta es NORMAL. Esta guía no sustituye canales oficiales.',
            },
          },
        ],
      }),
    }));

    const resGroq = await consultarAsistente(
      'Hola, ¿cómo está la lluvia?',
      { nivelVigente: 'NORMAL' },
      {
        fetchFn: fetchGroqOk,
        env: {
          ASISTENTE_PROVEEDOR_CLOUD: 'groq',
          GROQ_API_KEY: 'gsk_test_fake',
          GROQ_MODEL: 'llama-3.1-8b-instant',
        },
      }
    );

    expect(fetchGroqOk).toHaveBeenCalledTimes(1);
    expect(resGroq.origen).toBe('cloud');
    expect(resGroq.proveedor).toBe('groq:llama-3.1-8b-instant');
    expect(resGroq.bloqueada).toBe(false);

    const fetchGeminiOk = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        candidates: [
          {
            content: {
              parts: [
                {
                  text: 'Nivel informativo de lluvia ALERTA en Llojeta. Mantente lejos de quebradas.',
                },
              ],
            },
          },
        ],
      }),
    }));

    const resGemini = await consultarAsistente(
      '¿Qué nivel hay?',
      { nivelVigente: 'ALERTA' },
      {
        fetchFn: fetchGeminiOk,
        env: {
          ASISTENTE_PROVEEDOR_CLOUD: 'gemini',
          GEMINI_API_KEY: 'AIza_test_fake',
          GEMINI_MODEL: 'gemini-2.0-flash-lite',
        },
      }
    );

    expect(resGemini.origen).toBe('cloud');
    expect(resGemini.proveedor).toBe('gemini:gemini-2.0-flash-lite');
    expect(resGemini.bloqueada).toBe(false);
  });

  it('4. Cascada Nivel 2 (Ollama local): hace switch automático si Cloud falla y filtra palabras prohibidas de Ollama', async () => {
    const fetchCloudFallaOllamaProhibida = vi.fn(async (url) => {
      if (String(url).includes('api.groq.com')) {
        throw new Error('Network error / timeout');
      }
      return {
        ok: true,
        json: async () => ({
          message: {
            content: `Es una ${PALABRAS_PROHIBIDAS[0]} hacia una ${PALABRAS_PROHIBIDAS[4]}.`,
          },
        }),
      };
    });

    const res = await consultarAsistente(
      '¿Qué hago?',
      { nivelVigente: 'ALERTA' },
      {
        fetchFn: fetchCloudFallaOllamaProhibida,
        env: {
          ASISTENTE_PROVEEDOR_CLOUD: 'groq',
          GROQ_API_KEY: 'gsk_test_fake',
          OLLAMA_URL: 'http://127.0.0.1:11434',
          OLLAMA_MODEL: 'qwen2.5:0.5b',
        },
      }
    );

    expect(fetchCloudFallaOllamaProhibida).toHaveBeenCalledTimes(2);
    expect(res.origen).toBe('ollama');
    expect(res.proveedor).toBe('qwen2.5:0.5b');
    expect(res.bloqueada).toBe(true);
    expect(res.respuesta).toContain('ALERTA');
  });

  it('5. Cascada Nivel 3 (Determinista): cae al motor determinista del servidor si Cloud y Ollama fallan', async () => {
    const fetchTodoFalla = vi.fn(async () => {
      throw new Error('ECONNREFUSED');
    });

    const resSaludo = await consultarAsistente(
      'Hola Zorrito',
      { nivelVigente: 'PRECAUCION' },
      {
        fetchFn: fetchTodoFalla,
        env: {
          ASISTENTE_PROVEEDOR_CLOUD: 'groq',
          GROQ_API_KEY: 'gsk_test_fake',
          OLLAMA_URL: 'http://127.0.0.1:11434',
          OLLAMA_MODEL: 'qwen2.5:0.5b',
        },
      }
    );

    expect(resSaludo.origen).toBe('determinista');
    expect(resSaludo.bloqueada).toBe(false);
    expect(resSaludo.respuesta).toContain('PRECAUCION');

    const resFueraDominio = await consultarAsistente(
      '¿Quién ganó el partido de fútbol ayer?',
      { nivelVigente: 'NORMAL' },
      {
        fetchFn: fetchTodoFalla,
        env: { ASISTENTE_PROVEEDOR_CLOUD: 'ninguno' },
      }
    );

    expect(resFueraDominio.origen).toBe('determinista');
    expect(resFueraDominio.respuesta).toContain(
      'Solo puedo ayudarte con información preventiva de PUKARA'
    );
  });

  it('6. POST /api/asistente valida entrada (400 vacío), responde 200 con simulación y aplica rate limit (429)', async () => {
    // Aislar la prueba HTTP de servicios externos en vivo (Cloud/Ollama)
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('offline test');
      })
    );

    const resVacio = await request(app)
      .post('/api/asistente')
      .send({ mensaje: '   ' });
    expect(resVacio.status).toBe(400);

    const resOk = await request(app)
      .post('/api/asistente')
      .send({
        mensaje: 'Hola, ¿qué nivel hay?',
        contextoSimulacion: {
          esSimulacion: true,
          nivelVigente: 'EMERGENCIA',
        },
      });
    expect(resOk.status).toBe(200);
    expect(resOk.body).toHaveProperty('respuesta');
    expect(['cloud', 'ollama', 'determinista']).toContain(resOk.body.origen);
    expect(resOk.body.respuesta).toContain('EMERGENCIA');

    // 2 peticiones previas (resVacio + resOk) + 18 = 20 permitidas; la 21 devuelve 429
    for (let i = 0; i < 18; i += 1) {
      const r = await request(app)
        .post('/api/asistente')
        .send({ mensaje: 'Hola' });
      expect(r.status).toBe(200);
    }

    const resLimitado = await request(app)
      .post('/api/asistente')
      .send({ mensaje: 'Hola de nuevo' });
    expect(resLimitado.status).toBe(429);
  });
});
