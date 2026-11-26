/**
 * @file audioAvisos.js
 * @description Motor de audio sintetizado 100% offline mediante Web Audio API
 * para avisos sonoros preventivos diferenciados por nivel informativo de lluvia.
 * No depende de archivos de audio externos ni emite alertas oficiales.
 */

export const PERFILES_SONIDO = {
  NORMAL: {
    clave: 'NORMAL',
    etiqueta: 'Normal',
    descripcion: 'Dos notas armónicas cálidas ascendentes',
    tipoOnda: 'sine',
    volumen: 0.18,
    frecuenciaCorteLowpass: null,
    usarCompresor: false,
    duracionMs: 360,
    pasos: [
      { inicioMs: 0, duracionMs: 140, frecuenciaHz: 523.25 },
      { inicioMs: 170, duracionMs: 190, frecuenciaHz: 659.25 },
    ],
  },
  PRECAUCION: {
    clave: 'PRECAUCION',
    etiqueta: 'Precaución',
    descripcion: 'Doble pulso amigable de atención moderada',
    tipoOnda: 'triangle',
    volumen: 0.25,
    frecuenciaCorteLowpass: 1800,
    usarCompresor: false,
    duracionMs: 820,
    pasos: [
      { inicioMs: 0, duracionMs: 260, frecuenciaHz: 587.33 },
      { inicioMs: 420, duracionMs: 340, frecuenciaHz: 698.46 },
    ],
  },
  ALERTA: {
    clave: 'ALERTA',
    etiqueta: 'Alerta',
    descripcion: 'Secuencia rítmica de tres pulsos alternados',
    tipoOnda: 'triangle',
    volumen: 0.32,
    frecuenciaCorteLowpass: 2400,
    usarCompresor: false,
    duracionMs: 1400,
    pasos: [
      { inicioMs: 0, duracionMs: 280, frecuenciaHz: 660 },
      { inicioMs: 420, duracionMs: 280, frecuenciaHz: 880 },
      { inicioMs: 840, duracionMs: 440, frecuenciaHz: 660 },
    ],
  },
  EMERGENCIA: {
    clave: 'EMERGENCIA',
    etiqueta: 'Emergencia',
    descripcion:
      'Alarma preventiva dual WEA (853/960 Hz) y sirena ascendente de alta prioridad',
    tipoOnda: 'sawtooth',
    volumen: 0.52,
    frecuenciaCorteLowpass: 3400,
    resonanciaLowpassQ: 2.2,
    usarCompresor: true,
    duracionMs: 3000,
    pasos: [
      {
        inicioMs: 0,
        duracionMs: 620,
        frecuenciaHz: 853,
        frecuenciaSecundariaHz: 960,
        tipoOnda: 'sawtooth',
        tipoOndaSecundaria: 'square',
      },
      {
        inicioMs: 700,
        duracionMs: 660,
        frecuenciaHz: 780,
        frecuenciaFinHz: 1560,
        frecuenciaSecundariaHz: 788,
        frecuenciaSecundariaFinHz: 1576,
        tipoOnda: 'sawtooth',
        tipoOndaSecundaria: 'sawtooth',
      },
      {
        inicioMs: 1440,
        duracionMs: 620,
        frecuenciaHz: 853,
        frecuenciaSecundariaHz: 960,
        tipoOnda: 'sawtooth',
        tipoOndaSecundaria: 'square',
      },
      {
        inicioMs: 2140,
        duracionMs: 820,
        frecuenciaHz: 820,
        frecuenciaFinHz: 1680,
        frecuenciaSecundariaHz: 828,
        frecuenciaSecundariaFinHz: 1696,
        tipoOnda: 'sawtooth',
        tipoOndaSecundaria: 'sawtooth',
      },
    ],
  },
};

let contextoAudioInstancia = null;
let nodosActivos = [];
let gananciaMaestraActiva = null;

function obtenerConstructorAudioContext() {
  if (typeof window !== 'undefined') {
    const ctorWindow = window.AudioContext || window.webkitAudioContext;
    if (typeof ctorWindow === 'function') {
      return ctorWindow;
    }
  }
  if (typeof globalThis !== 'undefined') {
    const ctorGlobal = globalThis.AudioContext || globalThis.webkitAudioContext;
    if (typeof ctorGlobal === 'function') {
      return ctorGlobal;
    }
  }
  return null;
}

function obtenerOCrearContextoAudio() {
  const AudioCtx = obtenerConstructorAudioContext();
  if (!AudioCtx) {
    return null;
  }

  if (
    contextoAudioInstancia &&
    contextoAudioInstancia.state !== 'closed'
  ) {
    return contextoAudioInstancia;
  }

  try {
    contextoAudioInstancia = new AudioCtx();
    return contextoAudioInstancia;
  } catch {
    return null;
  }
}

/**
 * Indica si el entorno soporta Web Audio API sin lanzar excepciones.
 * @returns {boolean}
 */
export function soportaAudioWeb() {
  return obtenerConstructorAudioContext() !== null;
}

/**
 * Inicializa de forma perezosa y desbloquea el AudioContext tras un gesto del usuario.
 * @returns {Promise<boolean>}
 */
export async function desbloquearAudioWeb() {
  const ctx = obtenerOCrearContextoAudio();
  if (!ctx) {
    return false;
  }

  try {
    if (ctx.state === 'suspended' && typeof ctx.resume === 'function') {
      await ctx.resume();
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Detiene de inmediato cualquier aviso sonoro en reproducción y libera los nodos activos.
 */
export function detenerAvisoSonoro() {
  const ctx = contextoAudioInstancia;

  if (gananciaMaestraActiva && ctx) {
    try {
      const ahora = Number.isFinite(ctx.currentTime) ? ctx.currentTime : 0;
      if (typeof gananciaMaestraActiva.gain?.cancelScheduledValues === 'function') {
        gananciaMaestraActiva.gain.cancelScheduledValues(ahora);
      }
      if (typeof gananciaMaestraActiva.gain?.setValueAtTime === 'function') {
        const valorActual = Math.max(0.0001, gananciaMaestraActiva.gain.value || 0.0001);
        gananciaMaestraActiva.gain.setValueAtTime(valorActual, ahora);
      }
      if (typeof gananciaMaestraActiva.gain?.exponentialRampToValueAtTime === 'function') {
        gananciaMaestraActiva.gain.exponentialRampToValueAtTime(0.0001, ahora + 0.02);
      }
    } catch {
      // Silencioso si el nodo ya finalizó
    }
  }

  for (const nodo of nodosActivos) {
    try {
      if (typeof nodo.stop === 'function') {
        nodo.stop();
      }
    } catch {
      // Ignorar si ya fue detenido
    }
    try {
      if (typeof nodo.disconnect === 'function') {
        nodo.disconnect();
      }
    } catch {
      // Ignorar errores de desconexión
    }
  }

  nodosActivos = [];
  gananciaMaestraActiva = null;
}

/**
 * Reproduce un aviso sonoro preventivo sintetizado para el nivel indicado.
 *
 * @param {string} nivel 'NORMAL' | 'PRECAUCION' | 'ALERTA' | 'EMERGENCIA'
 * @returns {Promise<{reproducido: boolean, nivel?: string, duracionMs?: number, motivo?: string}>}
 */
export async function reproducirAvisoSonoro(nivel) {
  const clave = typeof nivel === 'string' ? nivel.toUpperCase() : '';
  const perfil = PERFILES_SONIDO[clave];

  if (!perfil) {
    return { reproducido: false, motivo: 'nivel_no_soportado' };
  }

  detenerAvisoSonoro();

  const ctx = obtenerOCrearContextoAudio();
  if (!ctx) {
    return { reproducido: false, motivo: 'audio_no_soportado' };
  }

  try {
    if (ctx.state === 'suspended' && typeof ctx.resume === 'function') {
      await ctx.resume();
    }

    const ahora = Number.isFinite(ctx.currentTime) ? ctx.currentTime : 0;
    const gananciaMaestra = ctx.createGain();
    gananciaMaestra.gain.setValueAtTime(1, ahora);
    gananciaMaestraActiva = gananciaMaestra;

    let nodoDestino = ctx.destination;

    if (perfil.usarCompresor && typeof ctx.createDynamicsCompressor === 'function') {
      const compresor = ctx.createDynamicsCompressor();
      if (compresor.threshold?.setValueAtTime) {
        compresor.threshold.setValueAtTime(-8, ahora);
      }
      if (compresor.knee?.setValueAtTime) {
        compresor.knee.setValueAtTime(10, ahora);
      }
      if (compresor.ratio?.setValueAtTime) {
        compresor.ratio.setValueAtTime(12, ahora);
      }
      if (compresor.attack?.setValueAtTime) {
        compresor.attack.setValueAtTime(0.003, ahora);
      }
      if (compresor.release?.setValueAtTime) {
        compresor.release.setValueAtTime(0.12, ahora);
      }
      compresor.connect(ctx.destination);
      nodosActivos.push(compresor);
      nodoDestino = compresor;
    }

    if (
      perfil.frecuenciaCorteLowpass &&
      typeof ctx.createBiquadFilter === 'function'
    ) {
      const filtro = ctx.createBiquadFilter();
      filtro.type = 'lowpass';
      if (filtro.frequency?.setValueAtTime) {
        filtro.frequency.setValueAtTime(perfil.frecuenciaCorteLowpass, ahora);
      } else if (filtro.frequency) {
        filtro.frequency.value = perfil.frecuenciaCorteLowpass;
      }
      if (perfil.resonanciaLowpassQ) {
        if (filtro.Q?.setValueAtTime) {
          filtro.Q.setValueAtTime(perfil.resonanciaLowpassQ, ahora);
        } else if (filtro.Q) {
          filtro.Q.value = perfil.resonanciaLowpassQ;
        }
      }
      filtro.connect(nodoDestino);
      nodosActivos.push(filtro);
      nodoDestino = filtro;
    }

    gananciaMaestra.connect(nodoDestino);
    nodosActivos.push(gananciaMaestra);

    const programarOscilador = ({
      tipoOnda,
      frecuenciaInicioHz,
      frecuenciaFinHz,
      volumenPaso,
      tInicio,
      tAtaque,
      tFinSostenido,
      tFin,
    }) => {
      const osc = ctx.createOscillator();
      const gananciaPaso = ctx.createGain();

      osc.type = tipoOnda;
      if (osc.frequency?.setValueAtTime) {
        osc.frequency.setValueAtTime(frecuenciaInicioHz, tInicio);
        if (
          frecuenciaFinHz &&
          frecuenciaFinHz > 0 &&
          typeof osc.frequency.exponentialRampToValueAtTime === 'function'
        ) {
          osc.frequency.exponentialRampToValueAtTime(frecuenciaFinHz, tFin);
        }
      } else if (osc.frequency) {
        osc.frequency.value = frecuenciaInicioHz;
      }

      gananciaPaso.gain.setValueAtTime(0.0001, tInicio);
      gananciaPaso.gain.linearRampToValueAtTime(volumenPaso, tAtaque);
      gananciaPaso.gain.setValueAtTime(volumenPaso, tFinSostenido);
      gananciaPaso.gain.exponentialRampToValueAtTime(0.0001, tFin);

      osc.connect(gananciaPaso);
      gananciaPaso.connect(gananciaMaestra);

      osc.start(tInicio);
      osc.stop(tFin + 0.02);

      nodosActivos.push(osc, gananciaPaso);
    };

    for (const paso of perfil.pasos) {
      const tInicio = ahora + paso.inicioMs / 1000;
      const duracionSeg = paso.duracionMs / 1000;
      const tAtaque = tInicio + Math.min(0.025, duracionSeg * 0.2);
      const tFinSostenido = tInicio + Math.max(0.04, duracionSeg - 0.045);
      const tFin = tInicio + duracionSeg;
      const tieneSecundaria = Boolean(paso.frecuenciaSecundariaHz);
      const volumenPorVoz = tieneSecundaria ? perfil.volumen * 0.56 : perfil.volumen;

      programarOscilador({
        tipoOnda: paso.tipoOnda || perfil.tipoOnda,
        frecuenciaInicioHz: paso.frecuenciaHz,
        frecuenciaFinHz: paso.frecuenciaFinHz,
        volumenPaso: volumenPorVoz,
        tInicio,
        tAtaque,
        tFinSostenido,
        tFin,
      });

      if (tieneSecundaria) {
        programarOscilador({
          tipoOnda: paso.tipoOndaSecundaria || paso.tipoOnda || perfil.tipoOnda,
          frecuenciaInicioHz: paso.frecuenciaSecundariaHz,
          frecuenciaFinHz: paso.frecuenciaSecundariaFinHz,
          volumenPaso: volumenPorVoz,
          tInicio,
          tAtaque,
          tFinSostenido,
          tFin,
        });
      }
    }

    return {
      reproducido: true,
      nivel: perfil.clave,
      duracionMs: perfil.duracionMs,
    };
  } catch {
    detenerAvisoSonoro();
    return { reproducido: false, motivo: 'error_reproduccion' };
  }
}

/**
 * Reinicia la instancia interna del AudioContext (utilidad para aislamiento en tests).
 */
export function reiniciarContextoAudio() {
  detenerAvisoSonoro();
  contextoAudioInstancia = null;
}

export default {
  PERFILES_SONIDO,
  soportaAudioWeb,
  desbloquearAudioWeb,
  reproducirAvisoSonoro,
  detenerAvisoSonoro,
  reiniciarContextoAudio,
};
