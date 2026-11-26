/**
 * @file audioAvisos.test.js
 * @description Suite de pruebas unitarias para el motor de audio sintetizado offline (Web Audio API).
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  PERFILES_SONIDO,
  soportaAudioWeb,
  desbloquearAudioWeb,
  reproducirAvisoSonoro,
  detenerAvisoSonoro,
  reiniciarContextoAudio,
} from '../utils/audioAvisos.js';

function crearMockAudioContext(estadoInicial = 'running') {
  const osciladores = [];
  const ganancias = [];
  const filtros = [];
  const compresores = [];

  class MockAudioContext {
    constructor() {
      this.state = estadoInicial;
      this.currentTime = 10;
      this.destination = { kind: 'destination' };
      this.resume = vi.fn(async () => {
        this.state = 'running';
      });
    }

    createOscillator() {
      const osc = {
        type: 'sine',
        frequency: {
          value: 440,
          setValueAtTime: vi.fn((val) => {
            osc.frequency.value = val;
          }),
          exponentialRampToValueAtTime: vi.fn((val) => {
            osc.frequency.value = val;
          }),
        },
        connect: vi.fn(),
        disconnect: vi.fn(),
        start: vi.fn(),
        stop: vi.fn(),
      };
      osciladores.push(osc);
      return osc;
    }

    createGain() {
      const gainNode = {
        gain: {
          value: 1,
          setValueAtTime: vi.fn((val) => {
            gainNode.gain.value = val;
          }),
          linearRampToValueAtTime: vi.fn((val) => {
            gainNode.gain.value = val;
          }),
          exponentialRampToValueAtTime: vi.fn((val) => {
            gainNode.gain.value = val;
          }),
          cancelScheduledValues: vi.fn(),
        },
        connect: vi.fn(),
        disconnect: vi.fn(),
      };
      ganancias.push(gainNode);
      return gainNode;
    }

    createBiquadFilter() {
      const filter = {
        type: 'lowpass',
        frequency: {
          value: 1000,
          setValueAtTime: vi.fn((val) => {
            filter.frequency.value = val;
          }),
        },
        Q: {
          value: 1,
          setValueAtTime: vi.fn((val) => {
            filter.Q.value = val;
          }),
        },
        connect: vi.fn(),
        disconnect: vi.fn(),
      };
      filtros.push(filter);
      return filter;
    }

    createDynamicsCompressor() {
      const comp = {
        threshold: { setValueAtTime: vi.fn() },
        knee: { setValueAtTime: vi.fn() },
        ratio: { setValueAtTime: vi.fn() },
        attack: { setValueAtTime: vi.fn() },
        release: { setValueAtTime: vi.fn() },
        connect: vi.fn(),
        disconnect: vi.fn(),
      };
      compresores.push(comp);
      return comp;
    }
  }

  return {
    MockAudioContext,
    osciladores,
    ganancias,
    filtros,
    compresores,
  };
}

describe('Motor de Audio Sintetizado Offline (audioAvisos.js)', () => {
  const originalAudioContext = globalThis.AudioContext;
  const originalWebkitAudioContext = globalThis.webkitAudioContext;

  beforeEach(() => {
    reiniciarContextoAudio();
    delete globalThis.AudioContext;
    delete globalThis.webkitAudioContext;
  });

  afterEach(() => {
    reiniciarContextoAudio();
    if (originalAudioContext !== undefined) {
      globalThis.AudioContext = originalAudioContext;
    } else {
      delete globalThis.AudioContext;
    }
    if (originalWebkitAudioContext !== undefined) {
      globalThis.webkitAudioContext = originalWebkitAudioContext;
    } else {
      delete globalThis.webkitAudioContext;
    }
    vi.restoreAllMocks();
  });

  it('1. Define los 4 perfiles sonoros canónicos diferenciados por nivel', () => {
    expect(Object.keys(PERFILES_SONIDO)).toEqual([
      'NORMAL',
      'PRECAUCION',
      'ALERTA',
      'EMERGENCIA',
    ]);

    expect(PERFILES_SONIDO.NORMAL.tipoOnda).toBe('sine');
    expect(PERFILES_SONIDO.NORMAL.pasos).toHaveLength(2);
    expect(PERFILES_SONIDO.NORMAL.volumen).toBe(0.18);

    expect(PERFILES_SONIDO.PRECAUCION.pasos).toHaveLength(2);
    expect(PERFILES_SONIDO.PRECAUCION.volumen).toBe(0.25);

    expect(PERFILES_SONIDO.ALERTA.tipoOnda).toBe('triangle');
    expect(PERFILES_SONIDO.ALERTA.pasos).toHaveLength(3);
    expect(PERFILES_SONIDO.ALERTA.volumen).toBe(0.32);

    expect(PERFILES_SONIDO.EMERGENCIA.tipoOnda).toBe('sawtooth');
    expect(PERFILES_SONIDO.EMERGENCIA.pasos).toHaveLength(4);
    expect(PERFILES_SONIDO.EMERGENCIA.frecuenciaCorteLowpass).toBe(3400);
    expect(PERFILES_SONIDO.EMERGENCIA.usarCompresor).toBe(true);
    expect(PERFILES_SONIDO.EMERGENCIA.volumen).toBe(0.52);
    expect(PERFILES_SONIDO.EMERGENCIA.duracionMs).toBe(3000);
  });

  it('2. Degrada silenciosamente sin lanzar errores cuando AudioContext no está disponible', async () => {
    expect(soportaAudioWeb()).toBe(false);
    await expect(desbloquearAudioWeb()).resolves.toBe(false);

    const res = await reproducirAvisoSonoro('ALERTA');
    expect(res).toEqual({ reproducido: false, motivo: 'audio_no_soportado' });
    expect(() => detenerAvisoSonoro()).not.toThrow();
  });

  it('3. Rechaza niveles desconocidos sin lanzar excepciones', async () => {
    const { MockAudioContext } = crearMockAudioContext();
    globalThis.AudioContext = MockAudioContext;

    const res = await reproducirAvisoSonoro('INEXISTENTE');
    expect(res).toEqual({ reproducido: false, motivo: 'nivel_no_soportado' });
  });

  it('4. Reproduce NORMAL, PRECAUCION y ALERTA con osciladores y envolventes ADSR correctas', async () => {
    const { MockAudioContext, osciladores, ganancias } =
      crearMockAudioContext('suspended');
    globalThis.AudioContext = MockAudioContext;

    expect(soportaAudioWeb()).toBe(true);

    // NORMAL (2 notas sine)
    const resNormal = await reproducirAvisoSonoro('NORMAL');
    expect(resNormal).toMatchObject({
      reproducido: true,
      nivel: 'NORMAL',
      duracionMs: 360,
    });
    expect(osciladores).toHaveLength(2);
    expect(osciladores[0].type).toBe('sine');
    expect(osciladores[0].frequency.setValueAtTime).toHaveBeenCalledWith(
      523.25,
      10
    );
    expect(osciladores[1].frequency.setValueAtTime).toHaveBeenCalledWith(
      659.25,
      10.17
    );

    // Verificar envolvente ADSR en la ganancia de nota
    const gananciaNota = ganancias[1];
    expect(gananciaNota.gain.setValueAtTime).toHaveBeenCalled();
    expect(gananciaNota.gain.linearRampToValueAtTime).toHaveBeenCalled();
    expect(gananciaNota.gain.exponentialRampToValueAtTime).toHaveBeenCalled();

    // PRECAUCION (+2 osciladores => total 4)
    const resPrec = await reproducirAvisoSonoro('PRECAUCION');
    expect(resPrec.reproducido).toBe(true);
    expect(osciladores).toHaveLength(4);

    // ALERTA (+3 osciladores => total 7)
    const resAlerta = await reproducirAvisoSonoro('ALERTA');
    expect(resAlerta.reproducido).toBe(true);
    expect(osciladores).toHaveLength(7);
    expect(osciladores[4].type).toBe('triangle');
    expect(osciladores[5].frequency.setValueAtTime).toHaveBeenCalledWith(
      880,
      10.42
    );
  });

  it('5. Reproduce EMERGENCIA con alarma dual WEA (853/960 Hz), sirena ascendente, filtro lowpass 3400 Hz y limitador compresor', async () => {
    const { MockAudioContext, osciladores, filtros, compresores } =
      crearMockAudioContext();
    globalThis.webkitAudioContext = MockAudioContext;

    const res = await reproducirAvisoSonoro('EMERGENCIA');
    expect(res).toMatchObject({
      reproducido: true,
      nivel: 'EMERGENCIA',
      duracionMs: 3000,
    });

    // 4 fases x 2 osciladores simultáneos (alarma dual WEA + sirena dual ascendente)
    expect(osciladores).toHaveLength(8);
    expect(osciladores[0].frequency.setValueAtTime).toHaveBeenCalledWith(853, 10);
    expect(osciladores[1].frequency.setValueAtTime).toHaveBeenCalledWith(960, 10);
    expect(osciladores[1].type).toBe('square');

    // Barridos ascendentes de sirena hasta 1560 Hz y 1680 Hz
    expect(
      osciladores[2].frequency.exponentialRampToValueAtTime
    ).toHaveBeenCalledWith(1560, expect.any(Number));
    expect(
      osciladores[6].frequency.exponentialRampToValueAtTime
    ).toHaveBeenCalledWith(1680, expect.any(Number));

    expect(filtros).toHaveLength(1);
    expect(filtros[0].type).toBe('lowpass');
    expect(filtros[0].frequency.setValueAtTime).toHaveBeenCalledWith(3400, 10);
    expect(filtros[0].Q.setValueAtTime).toHaveBeenCalledWith(2.2, 10);
    expect(compresores).toHaveLength(1);

    // Verificar que detenerAvisoSonoro detenga los 8 osciladores duales
    detenerAvisoSonoro();
    for (const osc of osciladores) {
      expect(osc.stop).toHaveBeenCalled();
      expect(osc.disconnect).toHaveBeenCalled();
    }
  });

  it('6. detenerAvisoSonoro() detiene y desconecta los osciladores activos sin errores', async () => {
    const { MockAudioContext, osciladores } = crearMockAudioContext();
    globalThis.AudioContext = MockAudioContext;

    await reproducirAvisoSonoro('ALERTA');
    expect(osciladores).toHaveLength(3);

    detenerAvisoSonoro();

    for (const osc of osciladores) {
      expect(osc.stop).toHaveBeenCalled();
      expect(osc.disconnect).toHaveBeenCalled();
    }
    expect(() => detenerAvisoSonoro()).not.toThrow();
  });
});
