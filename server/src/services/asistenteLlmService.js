/**
 * @file asistenteLlmService.js
 * @description Orquestador en cascada de 3 niveles para el Asistente Preventivo "Zorrito":
 *   Nivel 1: Cloud API (Groq o Gemini)
 *   Nivel 2: Ollama Local (qwen2.5:0.5b / 1.5b)
 *   Nivel 3: Fallback Determinista del Servidor
 * Aplica el mismo blindaje semántico de salida a ambos LLMs.
 */

import {
  construirSystemPrompt,
  validarYFiltrarRespuesta,
  responderDeterministaServidor,
} from './asistenteGuardrails.js';

export const MAX_LONGITUD_MENSAJE_USUARIO = 300;

async function fetchConTimeout(url, init, timeoutMs, fetchFn) {
  const controller = new AbortController();
  const timeout = Math.max(200, Number(timeoutMs) || 4000);
  const timerId = setTimeout(() => controller.abort(), timeout);

  try {
    return await fetchFn(url, {
      ...init,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timerId);
  }
}

async function consultarGroq({
  mensaje,
  systemPrompt,
  apiKey,
  model,
  timeoutMs,
  fetchFn,
}) {
  const res = await fetchConTimeout(
    'https://api.groq.com/openai/v1/chat/completions',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        max_tokens: 180,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: mensaje },
        ],
      }),
    },
    timeoutMs,
    fetchFn
  );

  if (!res.ok) {
    throw new Error(`Groq HTTP ${res.status}`);
  }

  const data = await res.json();
  const texto = data?.choices?.[0]?.message?.content;
  if (typeof texto !== 'string' || !texto.trim()) {
    throw new Error('Groq sin contenido');
  }
  return texto;
}

async function consultarGemini({
  mensaje,
  systemPrompt,
  apiKey,
  model,
  timeoutMs,
  fetchFn,
}) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    model
  )}:generateContent?key=${encodeURIComponent(apiKey)}`;

  const res = await fetchConTimeout(
    url,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: systemPrompt }],
        },
        contents: [
          {
            role: 'user',
            parts: [{ text: mensaje }],
          },
        ],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 180,
        },
      }),
    },
    timeoutMs,
    fetchFn
  );

  if (!res.ok) {
    throw new Error(`Gemini HTTP ${res.status}`);
  }

  const data = await res.json();
  const texto = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (typeof texto !== 'string' || !texto.trim()) {
    throw new Error('Gemini sin contenido');
  }
  return texto;
}

async function consultarOllama({
  mensaje,
  systemPrompt,
  ollamaUrl,
  model,
  timeoutMs,
  fetchFn,
}) {
  const baseUrl = String(ollamaUrl || 'http://127.0.0.1:11434').replace(
    /\/+$/,
    ''
  );
  const res = await fetchConTimeout(
    `${baseUrl}/api/chat`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        stream: false,
        options: {
          temperature: 0.2,
          num_predict: 180,
        },
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: mensaje },
        ],
      }),
    },
    timeoutMs,
    fetchFn
  );

  if (!res.ok) {
    throw new Error(`Ollama HTTP ${res.status}`);
  }

  const data = await res.json();
  const texto = data?.message?.content;
  if (typeof texto !== 'string' || !texto.trim()) {
    throw new Error('Ollama sin contenido');
  }
  return texto;
}

/**
 * Orquesta la consulta al asistente preventivo en cascada:
 * Cloud (Groq / Gemini) -> Ollama local -> Fallback determinista del servidor.
 *
 * @param {string} mensajeUsuario
 * @param {Object} [contextoEstado={}]
 * @param {Object} [opciones={}]
 * @returns {Promise<{ respuesta: string, origen: 'cloud'|'ollama'|'determinista', proveedor: string, bloqueada: boolean }>}
 */
export async function consultarAsistente(
  mensajeUsuario,
  contextoEstado = {},
  opciones = {}
) {
  const fetchFn = opciones.fetchFn || globalThis.fetch;
  const env = opciones.env || process.env;

  if (typeof mensajeUsuario !== 'string') {
    const err = new Error('El campo "mensaje" debe ser una cadena de texto.');
    err.statusCode = 400;
    throw err;
  }

  const mensajeLimpio = mensajeUsuario.replace(/\s+/g, ' ').trim();
  if (!mensajeLimpio) {
    const err = new Error('El mensaje no puede estar vacío.');
    err.statusCode = 400;
    throw err;
  }

  if (mensajeLimpio.length > MAX_LONGITUD_MENSAJE_USUARIO) {
    const err = new Error(
      `El mensaje supera el máximo permitido de ${MAX_LONGITUD_MENSAJE_USUARIO} caracteres.`
    );
    err.statusCode = 400;
    throw err;
  }

  const systemPrompt = construirSystemPrompt(contextoEstado);

  const proveedorCloud = String(
    env.ASISTENTE_PROVEEDOR_CLOUD || 'groq'
  )
    .trim()
    .toLowerCase();
  const timeoutCloudMs = Number(env.ASISTENTE_TIMEOUT_CLOUD_MS) || 4000;
  const timeoutOllamaMs = Number(env.ASISTENTE_TIMEOUT_OLLAMA_MS) || 6000;

  // Nivel 1: Proveedor Cloud gratuito ultrarrápido (Groq o Gemini)
  if (typeof fetchFn === 'function' && proveedorCloud !== 'ninguno') {
    const groqKey = String(env.GROQ_API_KEY || '').trim();
    const groqModel = String(env.GROQ_MODEL || 'llama-3.1-8b-instant').trim();
    const geminiKey = String(env.GEMINI_API_KEY || '').trim();
    const geminiModel = String(
      env.GEMINI_MODEL || 'gemini-2.0-flash-lite'
    ).trim();

    if (proveedorCloud === 'groq' && groqKey) {
      try {
        const textoCloud = await consultarGroq({
          mensaje: mensajeLimpio,
          systemPrompt,
          apiKey: groqKey,
          model: groqModel,
          timeoutMs: timeoutCloudMs,
          fetchFn,
        });
        const filtrado = validarYFiltrarRespuesta(textoCloud, contextoEstado);
        return {
          respuesta: filtrado.respuesta,
          origen: 'cloud',
          proveedor: `groq:${groqModel}`,
          bloqueada: filtrado.bloqueada,
        };
      } catch {
        // Fallback inmediato a Ollama local
      }
    } else if (proveedorCloud === 'gemini' && geminiKey) {
      try {
        const textoCloud = await consultarGemini({
          mensaje: mensajeLimpio,
          systemPrompt,
          apiKey: geminiKey,
          model: geminiModel,
          timeoutMs: timeoutCloudMs,
          fetchFn,
        });
        const filtrado = validarYFiltrarRespuesta(textoCloud, contextoEstado);
        return {
          respuesta: filtrado.respuesta,
          origen: 'cloud',
          proveedor: `gemini:${geminiModel}`,
          bloqueada: filtrado.bloqueada,
        };
      } catch {
        // Fallback inmediato a Ollama local
      }
    }
  }

  // Nivel 2: Ollama local (100% sin internet en servidor local)
  const ollamaUrl = String(env.OLLAMA_URL || 'http://127.0.0.1:11434').trim();
  const ollamaModel = String(env.OLLAMA_MODEL || 'qwen2.5:0.5b').trim();

  if (typeof fetchFn === 'function' && ollamaUrl && ollamaModel) {
    try {
      const textoOllama = await consultarOllama({
        mensaje: mensajeLimpio,
        systemPrompt,
        ollamaUrl,
        model: ollamaModel,
        timeoutMs: timeoutOllamaMs,
        fetchFn,
      });
      const filtrado = validarYFiltrarRespuesta(textoOllama, contextoEstado);
      return {
        respuesta: filtrado.respuesta,
        origen: 'ollama',
        proveedor: ollamaModel,
        bloqueada: filtrado.bloqueada,
      };
    } catch {
      // Fallback final determinista en servidor
    }
  }

  // Nivel 3: Fallback Determinista del Servidor
  const textoDeterminista = responderDeterministaServidor(
    mensajeLimpio,
    contextoEstado
  );
  const filtrado = validarYFiltrarRespuesta(textoDeterminista, contextoEstado);

  return {
    respuesta: filtrado.respuesta,
    origen: 'determinista',
    proveedor: 'pukara-determinista',
    bloqueada: filtrado.bloqueada,
  };
}

export default {
  MAX_LONGITUD_MENSAJE_USUARIO,
  consultarAsistente,
};
