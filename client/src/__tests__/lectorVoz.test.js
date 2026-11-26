/**
 * @file lectorVoz.test.js
 * @description Suite unitaria para el motor de lectura por voz síncrono (Web Speech API / TTS offline).
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  MENSAJE_ERROR_SIN_VOCES_ESCRITORIO,
  seleccionarVozEspanol,
  soportaLecturaVoz,
  estaLeyendo,
  obtenerIdLecturaActiva,
  obtenerUtteranceActiva,
  obtenerErrorLecturaVoz,
  suscribirEstadoLectura,
  detenerLectura,
  leerTexto,
  reiniciarEstadoLectorVoz,
} from '../utils/lectorVoz.js';

describe('Motor de Lectura por Voz Offline (lectorVoz.js)', () => {
  const originalSpeechSynthesis = globalThis.speechSynthesis;
  const originalUtterance = globalThis.SpeechSynthesisUtterance;

  beforeEach(() => {
    reiniciarEstadoLectorVoz();
    delete globalThis.speechSynthesis;
    delete globalThis.SpeechSynthesisUtterance;
  });

  afterEach(() => {
    reiniciarEstadoLectorVoz();
    if (originalSpeechSynthesis !== undefined) {
      globalThis.speechSynthesis = originalSpeechSynthesis;
    } else {
      delete globalThis.speechSynthesis;
    }
    if (originalUtterance !== undefined) {
      globalThis.SpeechSynthesisUtterance = originalUtterance;
    } else {
      delete globalThis.SpeechSynthesisUtterance;
    }
    vi.restoreAllMocks();
  });

  it('1. Degrada de forma segura sin speechSynthesis sin lanzar excepciones', () => {
    expect(soportaLecturaVoz()).toBe(false);
    expect(estaLeyendo()).toBe(false);
    expect(seleccionarVozEspanol([])).toBeNull();

    const res = leerTexto('Hola Llojeta');
    expect(res).toEqual({ iniciado: false, motivo: 'tts_no_soportado' });
    expect(() => detenerLectura()).not.toThrow();
  });

  it('2. Prioriza voces naturales en español latinoamericano / Bolivia sobre voces robóticas o en inglés', () => {
    const voces = [
      { name: 'English US', lang: 'en-US', localService: true },
      { name: 'eSpeak Spanish', lang: 'es-ES', localService: true },
      { name: 'Google español', lang: 'es-419', localService: false },
      { name: 'Sabina Natural', lang: 'es-MX', localService: true },
      { name: 'Voz Local Bolivia', lang: 'es-BO', localService: true },
    ];

    const elegida = seleccionarVozEspanol(voces);
    expect(elegida?.lang).toBe('es-BO');

    const sinBolivia = voces.filter((v) => v.lang !== 'es-BO');
    const elegidaLatam = seleccionarVozEspanol(sinBolivia);
    expect(['es-419', 'es-MX']).toContain(elegidaLatam?.lang);
    expect(elegidaLatam?.name).not.toContain('eSpeak');
  });

  it('3. Ejecuta speak() síncronamente con el clic del usuario, cancela lectura previa y retiene utteranceActiva', () => {
    const instancias = [];
    const ordenLlamadas = [];
    const cancelMock = vi.fn(() => {
      ordenLlamadas.push('cancel');
    });
    const resumeMock = vi.fn(() => {
      ordenLlamadas.push('resume');
    });
    const speakMock = vi.fn((utt) => {
      ordenLlamadas.push('speak');
      instancias.push(utt);
    });

    class MockUtterance {
      constructor(text) {
        this.text = text;
        this.voice = null;
        this.lang = '';
        this.rate = 1;
        this.pitch = 1;
        this.volume = 1;
        this.onstart = null;
        this.onend = null;
        this.onerror = null;
      }
    }

    globalThis.SpeechSynthesisUtterance = MockUtterance;
    globalThis.speechSynthesis = {
      speaking: false,
      pending: false,
      paused: true,
      cancel: cancelMock,
      resume: resumeMock,
      speak: speakMock,
      getVoices: () => [
        { name: 'Google español', lang: 'es-419', localService: true },
      ],
      addEventListener: vi.fn(),
    };

    const eventos = [];
    const desuscribir = suscribirEstadoLectura((st) => eventos.push(st));

    const onEndPrimero = vi.fn();
    const res1 = leerTexto('Primer aviso preventivo', {
      id: 'estado-1',
      onEnd: onEndPrimero,
    });

    expect(res1.iniciado).toBe(true);
    expect(obtenerUtteranceActiva()).toBe(instancias[0]);
    expect(resumeMock).toHaveBeenCalledTimes(1);
    expect(speakMock).toHaveBeenCalledTimes(1);
    expect(instancias[0].rate).toBe(0.97);
    expect(instancias[0].pitch).toBe(1.05);
    instancias[0].onstart?.();

    // Segunda lectura: cancela y llama a speak() inmediatamente en el mismo tick (Android Chrome)
    globalThis.speechSynthesis.speaking = true;
    const onEndSegundo = vi.fn();
    leerTexto('Segundo aviso preventivo', {
      id: 'estado-2',
      onEnd: onEndSegundo,
    });

    expect(cancelMock).toHaveBeenCalledTimes(1);
    expect(speakMock).toHaveBeenCalledTimes(2);
    expect(ordenLlamadas).toEqual(['resume', 'speak', 'cancel', 'resume', 'speak']);
    expect(obtenerIdLecturaActiva()).toBe('estado-2');

    // Evento tardío del primer utterance no afecta al segundo
    instancias[0].onend?.();
    expect(onEndPrimero).not.toHaveBeenCalled();
    expect(estaLeyendo()).toBe(true);

    // Finalizar segundo utterance libera utteranceActiva
    instancias[1].onstart?.();
    instancias[1].onend?.();
    expect(onEndSegundo).toHaveBeenCalledTimes(1);
    expect(estaLeyendo()).toBe(false);
    expect(obtenerUtteranceActiva()).toBeNull();

    desuscribir();
    expect(eventos.length).toBeGreaterThanOrEqual(2);
  });

  it('4. Cuando getVoices() está vacío ejecuta speak() inmediatamente con lang "es-ES" y maneja onerror limpio', () => {
    const instancias = [];
    const speakMock = vi.fn((utt) => {
      instancias.push(utt);
    });

    class MockUtterance {
      constructor(text) {
        this.text = text;
        this.voice = null;
        this.lang = '';
      }
    }

    globalThis.SpeechSynthesisUtterance = MockUtterance;
    globalThis.speechSynthesis = {
      speaking: false,
      pending: false,
      paused: false,
      cancel: vi.fn(),
      speak: speakMock,
      getVoices: () => [],
      addEventListener: vi.fn(),
    };

    const onError = vi.fn();
    const res = leerTexto('Lectura inmediata sin caché previa', {
      id: 'estado-inmediato',
      onError,
    });

    // Sin bloqueos ni timeouts: speak() se invoca en el acto
    expect(res.iniciado).toBe(true);
    expect(speakMock).toHaveBeenCalledTimes(1);
    expect(instancias[0].voice).toBeNull();
    expect(instancias[0].lang).toBe('es-ES');

    // Si el navegador dispara onerror, limpia estado y expone el mensaje amigable
    instancias[0].onerror?.({ error: 'synthesis-unavailable' });
    expect(onError).toHaveBeenCalledTimes(1);
    expect(estaLeyendo()).toBe(false);
    expect(obtenerUtteranceActiva()).toBeNull();
    expect(obtenerErrorLecturaVoz()).toBe(MENSAJE_ERROR_SIN_VOCES_ESCRITORIO);
  });

  it('5. detenerLectura() cancela speechSynthesis y limpia el estado activo', () => {
    const cancelMock = vi.fn();
    class MockUtterance {
      constructor(text) {
        this.text = text;
      }
    }

    globalThis.SpeechSynthesisUtterance = MockUtterance;
    globalThis.speechSynthesis = {
      speaking: false,
      pending: false,
      paused: false,
      cancel: cancelMock,
      speak: vi.fn(),
      getVoices: () => [{ name: 'Google español', lang: 'es-419' }],
    };

    leerTexto('Lectura en curso', { id: 'guia' });
    expect(estaLeyendo()).toBe(true);

    detenerLectura();
    expect(cancelMock).toHaveBeenCalled();
    expect(estaLeyendo()).toBe(false);
    expect(obtenerIdLecturaActiva()).toBeNull();
    expect(obtenerUtteranceActiva()).toBeNull();
  });
});
