/**
 * @file lectorVoz.js
 * @description Motor de lectura por voz amigable 100% offline mediante Web Speech API
 * (window.speechSynthesis), con ejecución síncrona al gesto del usuario para Android Chrome
 * y protección contra Garbage Collection en Chromium de escritorio.
 */

export const MENSAJE_ERROR_SIN_VOCES_ESCRITORIO =
  'Tu navegador de escritorio no tiene voces instaladas; la lectura por voz funciona en Android o habilitando voces del sistema.';

let leyendoActivo = false;
let idLecturaActiva = null;
let errorLecturaActual = null;
let secuenciaLectura = 0;
let vocesDisponibles = [];
let listenerVoicesRegistrado = false;
let utteranceActiva = null;
const suscriptoresEstado = new Set();

function obtenerSpeechSynthesis() {
  if (typeof window !== 'undefined' && window.speechSynthesis) {
    return window.speechSynthesis;
  }
  if (typeof globalThis !== 'undefined' && globalThis.speechSynthesis) {
    return globalThis.speechSynthesis;
  }
  return null;
}

function obtenerUtteranceCtor() {
  if (
    typeof window !== 'undefined' &&
    typeof window.SpeechSynthesisUtterance === 'function'
  ) {
    return window.SpeechSynthesisUtterance;
  }
  if (
    typeof globalThis !== 'undefined' &&
    typeof globalThis.SpeechSynthesisUtterance === 'function'
  ) {
    return globalThis.SpeechSynthesisUtterance;
  }
  return null;
}

function notificarEstado() {
  const snapshot = {
    leyendo: leyendoActivo,
    idActivo: idLecturaActiva,
    errorMensaje: errorLecturaActual,
  };
  for (const cb of suscriptoresEstado) {
    try {
      cb(snapshot);
    } catch {
      // Ignorar errores de suscriptores externos
    }
  }
}

function actualizarCacheVoces(synth) {
  if (!synth || typeof synth.getVoices !== 'function') {
    return;
  }
  try {
    const lista = synth.getVoices();
    if (Array.isArray(lista) && lista.length > 0) {
      vocesDisponibles = lista;
    }
  } catch {
    // Ignorar errores en entornos restringidos
  }
}

function asegurarListenerVoces(synth) {
  if (!synth || listenerVoicesRegistrado) {
    return;
  }
  listenerVoicesRegistrado = true;

  actualizarCacheVoces(synth);

  const onVoicesChanged = () => {
    actualizarCacheVoces(synth);
  };

  try {
    if (typeof synth.addEventListener === 'function') {
      synth.addEventListener('voiceschanged', onVoicesChanged);
    } else if ('onvoiceschanged' in synth) {
      const prev = synth.onvoiceschanged;
      synth.onvoiceschanged = (...args) => {
        onVoicesChanged();
        if (typeof prev === 'function') {
          prev.apply(synth, args);
        }
      };
    }
  } catch {
    // Silencioso si el entorno no soporta eventos
  }
}

// Precarga pasiva al inicializar el módulo en navegador
asegurarListenerVoces(obtenerSpeechSynthesis());

/**
 * Puntúa y selecciona la voz en español más natural y cercana disponible en el dispositivo.
 * Prioriza variantes latinoamericanas/Bolivia y voces naturales sobre motores robóticos.
 *
 * @param {Array<SpeechSynthesisVoice>} [voces]
 * @returns {SpeechSynthesisVoice|null}
 */
export function seleccionarVozEspanol(voces = null) {
  const synth = obtenerSpeechSynthesis();
  let lista = Array.isArray(voces) ? voces : vocesDisponibles;

  if (
    (!lista || lista.length === 0) &&
    synth &&
    typeof synth.getVoices === 'function'
  ) {
    try {
      lista = synth.getVoices() || [];
      if (Array.isArray(lista) && lista.length > 0) {
        vocesDisponibles = lista;
      }
    } catch {
      lista = [];
    }
  }

  if (!Array.isArray(lista) || lista.length === 0) {
    return null;
  }

  const vocesEspanol = lista.filter((v) => {
    const lang = String(v?.lang || '').toLowerCase();
    return lang === 'es' || lang.startsWith('es-') || lang.startsWith('es_');
  });

  if (vocesEspanol.length === 0) {
    return null;
  }

  const puntuarVoz = (voz) => {
    const lang = String(voz?.lang || '')
      .toLowerCase()
      .replace('_', '-');
    const nombre = String(voz?.name || '').toLowerCase();
    let puntos = 0;

    if (lang === 'es-bo') puntos += 160;
    else if (lang === 'es-419') puntos += 115;
    else if (lang === 'es-mx') puntos += 100;
    else if (lang === 'es-us') puntos += 95;
    else if (
      lang === 'es-pe' ||
      lang === 'es-co' ||
      lang === 'es-ar' ||
      lang === 'es-cl'
    ) {
      puntos += 90;
    } else if (lang === 'es-es') {
      puntos += 70;
    } else {
      puntos += 50;
    }

    if (
      /google español|google spanish|paulina|sabina|m[oó]nica|elena|paloma|dalia|sof[ií]a|camila|natural|neural|enhanced|premium/.test(
        nombre
      )
    ) {
      puntos += 45;
    }

    if (voz?.localService === true) {
      puntos += 15;
    }

    if (/espeak|festival|mbrola|robot/.test(nombre)) {
      puntos -= 60;
    }

    return puntos;
  };

  let mejorVoz = vocesEspanol[0];
  let mejorPuntaje = puntuarVoz(mejorVoz);

  for (let i = 1; i < vocesEspanol.length; i += 1) {
    const candidato = vocesEspanol[i];
    const puntaje = puntuarVoz(candidato);
    if (puntaje > mejorPuntaje) {
      mejorPuntaje = puntaje;
      mejorVoz = candidato;
    }
  }

  return mejorVoz;
}

/**
 * Indica si Web Speech API (speechSynthesis) está disponible en el entorno actual.
 * @returns {boolean}
 */
export function soportaLecturaVoz() {
  return obtenerSpeechSynthesis() !== null && obtenerUtteranceCtor() !== null;
}

/**
 * Indica si el motor de voz se encuentra leyendo actualmente.
 * @returns {boolean}
 */
export function estaLeyendo() {
  return leyendoActivo;
}

/**
 * Devuelve el identificador del bloque que se está leyendo actualmente (o null).
 * @returns {string|null}
 */
export function obtenerIdLecturaActiva() {
  return idLecturaActiva;
}

/**
 * Devuelve la referencia retenida de SpeechSynthesisUtterance activa (útil contra GC en Chromium).
 * @returns {SpeechSynthesisUtterance|null}
 */
export function obtenerUtteranceActiva() {
  return utteranceActiva;
}

/**
 * Devuelve el último mensaje amigable de error TTS (o null).
 * @returns {string|null}
 */
export function obtenerErrorLecturaVoz() {
  return errorLecturaActual;
}

/**
 * Suscribe un callback a los cambios de estado de lectura en curso.
 * @param {(estado: { leyendo: boolean, idActivo: string|null, errorMensaje: string|null }) => void} callback
 * @returns {() => void} Función para desuscribir
 */
export function suscribirEstadoLectura(callback) {
  if (typeof callback !== 'function') {
    return () => {};
  }
  suscriptoresEstado.add(callback);
  return () => {
    suscriptoresEstado.delete(callback);
  };
}

/**
 * Detiene limpiamente cualquier lectura en curso sin lanzar errores.
 */
export function detenerLectura() {
  secuenciaLectura += 1;
  utteranceActiva = null;

  const synth = obtenerSpeechSynthesis();
  if (synth && typeof synth.cancel === 'function') {
    try {
      synth.cancel();
    } catch {
      // Silencioso en entornos sin soporte completo
    }
  }

  const cambio =
    leyendoActivo || idLecturaActiva !== null || errorLecturaActual !== null;
  leyendoActivo = false;
  idLecturaActiva = null;
  errorLecturaActual = null;
  if (cambio) {
    notificarEstado();
  }
}

/**
 * Lee en voz alta el texto proporcionado de forma 100% síncrona con el clic del usuario
 * (requisito estricto en Android Chrome) manteniendo referencia persistente contra GC.
 *
 * @param {string} texto
 * @param {Object} [opciones]
 * @param {string|null} [opciones.id=null]
 * @param {Function} [opciones.onStart]
 * @param {Function} [opciones.onEnd]
 * @param {Function} [opciones.onError]
 * @param {number} [opciones.rate=0.97]
 * @param {number} [opciones.pitch=1.05]
 * @returns {{ iniciado: boolean, motivo?: string, vozSeleccionada?: string|null }}
 */
export function leerTexto(
  texto,
  {
    id = null,
    onStart = null,
    onEnd = null,
    onError = null,
    rate = 0.97,
    pitch = 1.05,
  } = {}
) {
  const textoLimpio = typeof texto === 'string' ? texto.trim() : '';
  if (!textoLimpio) {
    return { iniciado: false, motivo: 'texto_vacio' };
  }

  const synth = obtenerSpeechSynthesis();
  const UtteranceCtor = obtenerUtteranceCtor();
  if (!synth || !UtteranceCtor || typeof synth.speak !== 'function') {
    return { iniciado: false, motivo: 'tts_no_soportado' };
  }

  asegurarListenerVoces(synth);

  if (
    (synth.speaking || synth.pending || leyendoActivo || utteranceActiva) &&
    typeof synth.cancel === 'function'
  ) {
    try {
      synth.cancel();
    } catch {
      // Ignorar errores de cancelación
    }
  }

  secuenciaLectura += 1;
  const turnoActual = secuenciaLectura;

  try {
    const utterance = new UtteranceCtor(textoLimpio);
    const voz = seleccionarVozEspanol();

    if (voz) {
      utterance.voice = voz;
      utterance.lang = voz.lang || 'es-BO';
    } else {
      utterance.lang = 'es-ES';
    }

    utterance.rate = Math.min(1.15, Math.max(0.8, Number(rate) || 0.97));
    utterance.pitch = Math.min(1.25, Math.max(0.8, Number(pitch) || 1.05));
    utterance.volume = 1;

    // Retener referencia a nivel de módulo hasta onend/onerror contra GC de Chromium
    utteranceActiva = utterance;
    leyendoActivo = true;
    idLecturaActiva = id;
    errorLecturaActual = null;
    notificarEstado();

    utterance.onstart = () => {
      if (turnoActual !== secuenciaLectura) return;
      leyendoActivo = true;
      idLecturaActiva = id;
      errorLecturaActual = null;
      notificarEstado();
      if (typeof onStart === 'function') onStart();
    };

    utterance.onend = () => {
      if (turnoActual !== secuenciaLectura) return;
      utteranceActiva = null;
      leyendoActivo = false;
      idLecturaActiva = null;
      notificarEstado();
      if (typeof onEnd === 'function') onEnd();
    };

    utterance.onerror = (evento) => {
      if (turnoActual !== secuenciaLectura) return;
      utteranceActiva = null;
      leyendoActivo = false;
      idLecturaActiva = null;
      errorLecturaActual = MENSAJE_ERROR_SIN_VOCES_ESCRITORIO;
      notificarEstado();
      if (typeof onError === 'function') onError(evento);
    };

    if (synth.paused === true && typeof synth.resume === 'function') {
      try {
        synth.resume();
      } catch {
        // Ignorar si resume falla
      }
    }

    synth.speak(utterance);

    return {
      iniciado: true,
      vozSeleccionada: voz?.name || null,
    };
  } catch (err) {
    utteranceActiva = null;
    leyendoActivo = false;
    idLecturaActiva = null;
    errorLecturaActual = MENSAJE_ERROR_SIN_VOCES_ESCRITORIO;
    notificarEstado();
    if (typeof onError === 'function') onError(err);
    return { iniciado: false, motivo: 'error_reproduccion' };
  }
}

/**
 * Reinicia el estado interno del módulo (utilidad para aislamiento en pruebas).
 */
export function reiniciarEstadoLectorVoz() {
  detenerLectura();
  vocesDisponibles = [];
  listenerVoicesRegistrado = false;
  suscriptoresEstado.clear();
}

export default {
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
};
