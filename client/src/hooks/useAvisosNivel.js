import { useState, useEffect, useCallback, useRef } from 'react';
import {
  PERFILES_SONIDO,
  soportaAudioWeb,
  desbloquearAudioWeb,
  reproducirAvisoSonoro,
  detenerAvisoSonoro,
} from '../utils/audioAvisos';
import {
  soportaVibracion,
  vibrarPorNivel,
  detenerVibracion,
  esContextoSeguroNotificaciones,
  soportaNotificaciones,
  obtenerEstadoPermisoNotificaciones,
  solicitarPermisoNotificaciones,
  mostrarNotificacionNivel,
} from '../utils/notificacionesAvisos';

export const CLAVE_PREFERENCIAS_AVISOS = 'pukara_avisos_prefs';

export const PREFERENCIAS_INICIALES = {
  sonidoActivo: false,
  notificacionesActivas: false,
  silenciado: false,
};

export const NIVELES_CON_AVISO = ['PRECAUCION', 'ALERTA', 'EMERGENCIA'];

function obtenerStorage() {
  if (typeof window !== 'undefined' && window.localStorage) {
    return window.localStorage;
  }
  if (typeof globalThis !== 'undefined' && globalThis.localStorage) {
    return globalThis.localStorage;
  }
  return null;
}

/**
 * Lee las preferencias persistidas del usuario de forma segura.
 * @returns {{ sonidoActivo: boolean, notificacionesActivas: boolean, silenciado: boolean }}
 */
export function leerPreferenciasAvisos() {
  const storage = obtenerStorage();
  if (!storage) {
    return { ...PREFERENCIAS_INICIALES };
  }

  try {
    const raw = storage.getItem(CLAVE_PREFERENCIAS_AVISOS);
    if (!raw) {
      return { ...PREFERENCIAS_INICIALES };
    }
    const parsed = JSON.parse(raw);
    return {
      sonidoActivo: Boolean(parsed?.sonidoActivo),
      notificacionesActivas: Boolean(parsed?.notificacionesActivas),
      silenciado: Boolean(parsed?.silenciado),
    };
  } catch {
    return { ...PREFERENCIAS_INICIALES };
  }
}

/**
 * Persiste las preferencias de avisos en localStorage (`pukara_avisos_prefs`).
 * @param {Object} prefs
 */
export function guardarPreferenciasAvisos(prefs) {
  const storage = obtenerStorage();
  if (!storage) {
    return null;
  }

  const normalizado = {
    sonidoActivo: Boolean(prefs?.sonidoActivo),
    notificacionesActivas: Boolean(prefs?.notificacionesActivas),
    silenciado: Boolean(prefs?.silenciado),
  };

  try {
    storage.setItem(CLAVE_PREFERENCIAS_AVISOS, JSON.stringify(normalizado));
    return normalizado;
  } catch {
    return null;
  }
}

/**
 * Determina de forma pura si un cambio de nivel debe disparar un aviso preventivo.
 */
export function debeDispararAvisoPorCambio({
  nivelAnterior,
  nivelNuevo,
  esCargaInicial,
  silenciado,
}) {
  if (esCargaInicial || silenciado || !nivelNuevo) {
    return false;
  }
  if (!nivelAnterior || nivelAnterior === nivelNuevo) {
    return false;
  }
  return NIVELES_CON_AVISO.includes(nivelNuevo);
}

/**
 * Hook de orquestación para avisos sonoros sintetizados, vibración y notificaciones del sistema.
 *
 * @param {Object} [params]
 * @param {string|null} [params.nivelActual=null]
 * @param {'real'|'simulada'} [params.modalidad='real']
 * @param {boolean} [params.estadoCargado=false]
 * @param {string|null} [params.fechaHora=null]
 */
export function useAvisosNivel({
  nivelActual = null,
  modalidad = 'real',
  estadoCargado = false,
  fechaHora = null,
} = {}) {
  const [preferencias, setPreferencias] = useState(() =>
    leerPreferenciasAvisos()
  );
  const [permisoNotificaciones, setPermisoNotificaciones] = useState(() =>
    obtenerEstadoPermisoNotificaciones()
  );
  const [reproduciendoNivel, setReproduciendoNivel] = useState(null);
  const [ultimoAvisoEmitido, setUltimoAvisoEmitido] = useState(null);

  const inicializadoPorModalidadRef = useRef({ real: false, simulada: false });
  const ultimoNivelPorModalidadRef = useRef({ real: null, simulada: null });
  const timerReproduccionRef = useRef(null);

  const actualizarPreferencias = useCallback((actualizador) => {
    setPreferencias((prev) => {
      const siguiente =
        typeof actualizador === 'function' ? actualizador(prev) : actualizador;
      guardarPreferenciasAvisos(siguiente);
      return siguiente;
    });
  }, []);

  const limpiarTimerReproduccion = useCallback(() => {
    if (timerReproduccionRef.current !== null) {
      clearTimeout(timerReproduccionRef.current);
      timerReproduccionRef.current = null;
    }
  }, []);

  const iniciarIndicadorReproduccion = useCallback(
    (nivel, duracionMs) => {
      limpiarTimerReproduccion();
      setReproduciendoNivel(nivel);
      const espera = Number.isFinite(duracionMs) ? duracionMs + 80 : 1200;
      timerReproduccionRef.current = setTimeout(() => {
        setReproduciendoNivel(null);
        timerReproduccionRef.current = null;
      }, espera);
    },
    [limpiarTimerReproduccion]
  );

  const detenerSonido = useCallback(() => {
    limpiarTimerReproduccion();
    detenerAvisoSonoro();
    detenerVibracion();
    setReproduciendoNivel(null);
  }, [limpiarTimerReproduccion]);

  const emitirAvisoNivel = useCallback(
    async (
      nivel,
      {
        forzarSonido = false,
        incluirNotificacion = true,
        esSimulacion = modalidad === 'simulada',
      } = {}
    ) => {
      const clave = typeof nivel === 'string' ? nivel.toUpperCase() : '';
      if (!PERFILES_SONIDO[clave]) {
        return;
      }

      const debeSonar =
        forzarSonido || (preferencias.sonidoActivo && !preferencias.silenciado);

      if (debeSonar) {
        await desbloquearAudioWeb();
        const resAudio = await reproducirAvisoSonoro(clave);
        if (resAudio.reproducido) {
          iniciarIndicadorReproduccion(clave, resAudio.duracionMs);
        } else {
          // Incluso sin AudioContext real, dar breve feedback visual al probar
          if (forzarSonido) {
            iniciarIndicadorReproduccion(
              clave,
              PERFILES_SONIDO[clave].duracionMs
            );
          }
        }
      }

      if (forzarSonido || (!preferencias.silenciado && (preferencias.sonidoActivo || preferencias.notificacionesActivas))) {
        vibrarPorNivel(clave);
      }

      if (
        incluirNotificacion &&
        !preferencias.silenciado &&
        preferencias.notificacionesActivas &&
        obtenerEstadoPermisoNotificaciones() === 'granted'
      ) {
        await mostrarNotificacionNivel(clave, { esSimulacion, fechaHora });
      }

      setUltimoAvisoEmitido({
        nivel: clave,
        esSimulacion,
        emitidoEn: new Date().toISOString(),
      });
    },
    [
      fechaHora,
      iniciarIndicadorReproduccion,
      modalidad,
      preferencias.notificacionesActivas,
      preferencias.silenciado,
      preferencias.sonidoActivo,
    ]
  );

  // Detectar cambios reales de nivel sin disparar en la carga inicial
  useEffect(() => {
    if (!estadoCargado || !nivelActual) {
      return;
    }

    const mod = modalidad === 'simulada' ? 'simulada' : 'real';
    const yaInicializado = inicializadoPorModalidadRef.current[mod];
    const nivelPrevio = ultimoNivelPorModalidadRef.current[mod];

    if (!yaInicializado) {
      inicializadoPorModalidadRef.current[mod] = true;
      ultimoNivelPorModalidadRef.current[mod] = nivelActual;
      return;
    }

    if (nivelPrevio !== nivelActual) {
      ultimoNivelPorModalidadRef.current[mod] = nivelActual;

      if (
        debeDispararAvisoPorCambio({
          nivelAnterior: nivelPrevio,
          nivelNuevo: nivelActual,
          esCargaInicial: false,
          silenciado: preferencias.silenciado,
        })
      ) {
        emitirAvisoNivel(nivelActual, {
          forzarSonido: false,
          incluirNotificacion: true,
          esSimulacion: mod === 'simulada',
        });
      }
    }
  }, [
    emitirAvisoNivel,
    estadoCargado,
    modalidad,
    nivelActual,
    preferencias.silenciado,
  ]);

  // Limpiar audio y timers al desmontar
  useEffect(() => {
    return () => {
      limpiarTimerReproduccion();
      detenerAvisoSonoro();
    };
  }, [limpiarTimerReproduccion]);

  const activarSonido = useCallback(async () => {
    await desbloquearAudioWeb();
    actualizarPreferencias((prev) => ({
      ...prev,
      sonidoActivo: true,
      silenciado: false,
    }));
  }, [actualizarPreferencias]);

  const desactivarSonido = useCallback(() => {
    detenerSonido();
    actualizarPreferencias((prev) => ({
      ...prev,
      sonidoActivo: false,
    }));
  }, [actualizarPreferencias, detenerSonido]);

  const alternarSilencio = useCallback(() => {
    actualizarPreferencias((prev) => {
      const nuevoSilenciado = !prev.silenciado;
      if (nuevoSilenciado) {
        detenerSonido();
      }
      return {
        ...prev,
        silenciado: nuevoSilenciado,
      };
    });
  }, [actualizarPreferencias, detenerSonido]);

  const activarNotificaciones = useCallback(async () => {
    const permiso = await solicitarPermisoNotificaciones();
    setPermisoNotificaciones(permiso);
    const habilitadas = permiso === 'granted';
    actualizarPreferencias((prev) => ({
      ...prev,
      notificacionesActivas: habilitadas,
    }));
    return permiso;
  }, [actualizarPreferencias]);

  const desactivarNotificaciones = useCallback(() => {
    actualizarPreferencias((prev) => ({
      ...prev,
      notificacionesActivas: false,
    }));
  }, [actualizarPreferencias]);

  const activarAvisosCompletos = useCallback(async () => {
    await desbloquearAudioWeb();
    const permiso = await solicitarPermisoNotificaciones();
    setPermisoNotificaciones(permiso);
    actualizarPreferencias((prev) => ({
      ...prev,
      sonidoActivo: true,
      silenciado: false,
      notificacionesActivas: permiso === 'granted',
    }));
    return permiso;
  }, [actualizarPreferencias]);

  const desactivarAvisosCompletos = useCallback(() => {
    detenerSonido();
    actualizarPreferencias({
      sonidoActivo: false,
      notificacionesActivas: false,
      silenciado: false,
    });
  }, [actualizarPreferencias, detenerSonido]);

  const probarAviso = useCallback(
    async (nivel) => {
      await emitirAvisoNivel(nivel, {
        forzarSonido: true,
        incluirNotificacion: true,
        esSimulacion: true,
      });
    },
    [emitirAvisoNivel]
  );

  const marcarModalidadInicializada = useCallback(
    (mod = 'simulada') => {
      const claveMod = mod === 'simulada' ? 'simulada' : 'real';
      if (!inicializadoPorModalidadRef.current[claveMod]) {
        inicializadoPorModalidadRef.current[claveMod] = true;
        ultimoNivelPorModalidadRef.current[claveMod] =
          nivelActual || 'NORMAL';
      }
    },
    [nivelActual]
  );

  return {
    sonidoActivo: preferencias.sonidoActivo,
    notificacionesActivas: preferencias.notificacionesActivas,
    silenciado: preferencias.silenciado,
    permisoNotificaciones,
    esContextoSeguro: esContextoSeguroNotificaciones(),
    soportaAudio: soportaAudioWeb(),
    soportaVibracion: soportaVibracion(),
    soportaNotificaciones: soportaNotificaciones(),
    reproduciendoNivel,
    ultimoAvisoEmitido,
    activarSonido,
    desactivarSonido,
    alternarSilencio,
    activarNotificaciones,
    desactivarNotificaciones,
    activarAvisosCompletos,
    desactivarAvisosCompletos,
    probarAviso,
    detenerSonido,
    marcarModalidadInicializada,
  };
}

export default useAvisosNivel;
