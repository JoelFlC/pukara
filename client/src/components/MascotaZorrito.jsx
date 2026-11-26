import React, { useState, useEffect } from 'react';
import {
  PREGUNTAS_FRECUENTES,
  MENSAJES_CONTEXTO,
  resolverEstadoVisualZorrito,
  buscarRespuestaPorConsulta,
} from '../data/asistenteZorritoData';
import {
  suscribirEstadoLectura,
  leerTexto,
  detenerLectura,
  estaLeyendo,
} from '../utils/lectorVoz';
import { consultarAsistenteApi } from '../services/api';
import BotonLeerVoz from './BotonLeerVoz';
import ChecklistFamiliar from './ChecklistFamiliar';

const ETIQUETA_ORIGEN_RESPUESTA = {
  cloud: {
    texto: 'En línea',
    clase: 'bg-[#ECFDF5] text-[#065F46] border border-[#A7F3D0]',
  },
  ollama: {
    texto: 'Local',
    clase: 'bg-[#EEF2FF] text-[#3525CD] border border-[#E2DFFF]',
  },
  determinista: {
    texto: 'Local',
    clase: 'bg-[#EEF2FF] text-[#3525CD] border border-[#E2DFFF]',
  },
  offline: {
    texto: 'Sin conexión',
    clase: 'bg-[#FEF3C7] text-[#92400E] border border-[#FDE68A]',
  },
};

/**
 * Orquesta la consulta libre del Zorrito con fallback automático hacia el motor determinista offline.
 *
 * @param {Object} params
 * @param {string} params.mensaje
 * @param {Object} params.contextoActual
 * @param {Function} [params.consultarApiFn]
 * @returns {Promise<{ respuesta: string, origen: 'cloud'|'ollama'|'determinista'|'offline' }>}
 */
export async function enviarConsultaAsistenteZorrito({
  mensaje,
  contextoActual = {},
  consultarApiFn = consultarAsistenteApi,
}) {
  const textoLimpio = typeof mensaje === 'string' ? mensaje.trim() : '';
  if (!textoLimpio) {
    const localVacio = buscarRespuestaPorConsulta('', contextoActual);
    return {
      respuesta: localVacio.respuesta,
      origen: 'offline',
    };
  }

  if (contextoActual.estaOffline) {
    const resOffline = buscarRespuestaPorConsulta(textoLimpio, contextoActual);
    return {
      respuesta: resOffline.respuesta,
      origen: 'offline',
    };
  }

  const contextoSimulacion = contextoActual.esSimulacion
    ? {
        esSimulacion: true,
        nivelVigente: contextoActual.nivelVigente || 'NORMAL',
        recomendacionVigente: contextoActual.recomendacionVigente || null,
      }
    : null;

  try {
    const data = await consultarApiFn(textoLimpio, contextoSimulacion);
    if (data && typeof data.respuesta === 'string' && data.respuesta.trim()) {
      return {
        respuesta: data.respuesta,
        origen: data.origen || 'determinista',
      };
    }
  } catch {
    // Caída silenciosa al motor determinista local mejorado
  }

  const fallbackLocal = buscarRespuestaPorConsulta(textoLimpio, contextoActual);
  return {
    respuesta: fallbackLocal.respuesta,
    origen: 'offline',
  };
}

function AvatarZorritoFallback({ alt }) {
  return (
    <svg
      role="img"
      aria-label={alt}
      className="w-full h-full p-2"
      viewBox="0 0 64 64"
      fill="none"
    >
      <circle cx="32" cy="32" r="28" fill="#FFEDD5" />
      <path d="M16 18L24 30L14 34L16 18Z" fill="#EA580C" />
      <path d="M48 18L40 30L50 34L48 18Z" fill="#EA580C" />
      <path d="M18 32C18 23 24 18 32 18C40 18 46 23 46 32C46 42 39 49 32 49C25 49 18 42 18 32Z" fill="#F97316" />
      <path d="M22 36C22 43 27 48 32 48C37 48 42 43 42 36C38 38 35 38 32 37C29 38 26 38 22 36Z" fill="#FFF7ED" />
      <circle cx="26.5" cy="31" r="2.2" fill="#111C2D" />
      <circle cx="37.5" cy="31" r="2.2" fill="#111C2D" />
      <circle cx="32" cy="38" r="2.5" fill="#111C2D" />
    </svg>
  );
}

/**
 * Mascota interactiva "Zorrito" de PUKARA estilo Duolingo + Asistente Preventivo Híbrido
 * (Cloud -> Ollama -> Determinista offline), lectura por voz TTS y Checklist Familiar offline.
 */
export default function MascotaZorrito({
  nivelVigente = 'NORMAL',
  estadoSistema = 'NORMAL',
  estaOffline = false,
  esSimulacion = false,
  recomendacionVigente = null,
  avisosControlador = null,
  abiertoInicialmente = false,
  pestanaInicial = 'asistente',
  esBienvenidaInicial = true,
  leyendoVozInicial = false,
  pensandoInicial = false,
  origenInicial = null,
}) {
  const [esBienvenida, setEsBienvenida] = useState(Boolean(esBienvenidaInicial));
  const [faseSaludo, setFaseSaludo] = useState(() =>
    esBienvenidaInicial ? 'centro' : 'finalizado'
  );
  const [recienAterrizado, setRecienAterrizado] = useState(false);
  const [leyendoVoz, setLeyendoVoz] = useState(
    () => Boolean(leyendoVozInicial) || estaLeyendo()
  );
  const [checklistCelebracion, setChecklistCelebracion] = useState(false);
  const [indiceMensaje, setIndiceMensaje] = useState(0);
  const [burbujaVisible, setBurbujaVisible] = useState(true);
  const [panelAbierto, setPanelAbierto] = useState(Boolean(abiertoInicialmente));
  const [pestanaActiva, setPestanaActiva] = useState(pestanaInicial);
  const [errorImagen, setErrorImagen] = useState(false);
  const [consultaInput, setConsultaInput] = useState('');
  const [pensando, setPensando] = useState(Boolean(pensandoInicial));
  const [origenRespuesta, setOrigenRespuesta] = useState(origenInicial);
  const [mensajeFeedbackChecklist, setMensajeFeedbackChecklist] = useState('');

  const contextoActual = {
    nivelVigente,
    estadoSistema,
    estaOffline,
    esSimulacion,
    recomendacionVigente,
  };

  const [faqSeleccionadaId, setFaqSeleccionadaId] = useState('nivel-actual');
  const [respuestaManual, setRespuestaManual] = useState(null);

  useEffect(() => {
    return suscribirEstadoLectura(({ leyendo }) => {
      setLeyendoVoz(Boolean(leyendo));
    });
  }, []);

  useEffect(() => {
    if (!esBienvenida || faseSaludo === 'finalizado') return undefined;

    if (faseSaludo === 'centro') {
      const timerCentro = setTimeout(() => {
        setFaseSaludo('regresando');
      }, 3600);
      return () => clearTimeout(timerCentro);
    }

    const timerRegreso = setTimeout(() => {
      setFaseSaludo('finalizado');
      setEsBienvenida(false);
      setRecienAterrizado(true);
    }, 680);
    return () => clearTimeout(timerRegreso);
  }, [esBienvenida, faseSaludo]);

  useEffect(() => {
    if (!recienAterrizado) return undefined;
    const timer = setTimeout(() => {
      setRecienAterrizado(false);
    }, 450);
    return () => clearTimeout(timer);
  }, [recienAterrizado]);

  useEffect(() => {
    setIndiceMensaje((prev) => prev + 1);
    setBurbujaVisible(true);
    setErrorImagen(false);
  }, [nivelVigente, estadoSistema, estaOffline, esSimulacion]);

  const estadoVisual = resolverEstadoVisualZorrito({
    nivelVigente,
    estadoSistema,
    estaOffline,
    esSimulacion,
    leyendoVoz,
    esBienvenida,
    checklistCelebracion,
    indice: indiceMensaje,
  });

  const faqActual =
    PREGUNTAS_FRECUENTES.find((f) => f.id === faqSeleccionadaId) ||
    PREGUNTAS_FRECUENTES[0];

  const respuestaMostrada =
    respuestaManual !== null
      ? respuestaManual
      : faqActual.responder(contextoActual);

  const badgeOrigen = origenRespuesta
    ? ETIQUETA_ORIGEN_RESPUESTA[origenRespuesta] || ETIQUETA_ORIGEN_RESPUESTA.offline
    : null;

  const esModoEmergencia = String(nivelVigente || '').toUpperCase() === 'EMERGENCIA';
  const esEscenaBienvenidaCentro =
    estadoVisual.modoVisual === 'saludo_libre' &&
    faseSaludo !== 'finalizado' &&
    !panelAbierto;

  let claseBotonMascota = `zorrito-entrada zorrito-idle-duolingo ${
    recienAterrizado ? 'zorrito-aterrizaje' : ''
  } w-[96px] h-[96px] sm:w-[110px] sm:h-[110px] rounded-3xl bg-white/95 border-2 border-[#3525CD]/20 shadow-xl p-1.5`;

  if (estadoVisual.modoVisual === 'saludo_libre') {
    claseBotonMascota = `${
      faseSaludo === 'regresando'
        ? 'zorrito-regreso-esquina'
        : 'zorrito-saludo-duolingo'
    } w-[176px] h-[176px] sm:w-[220px] sm:h-[220px] md:w-[248px] md:h-[248px] bg-transparent border-0 shadow-none p-0`;
  } else if (estadoVisual.modoVisual === 'presentando_cartel') {
    claseBotonMascota =
      'zorrito-salir-cuadro zorrito-presentando w-[164px] h-[164px] sm:w-[196px] sm:h-[196px] md:w-[216px] md:h-[216px] bg-transparent border-0 shadow-none p-0';
  } else if (estadoVisual.modoVisual === 'loco_alerta') {
    claseBotonMascota = `zorrito-alerta-loco ${
      esModoEmergencia ? 'zorrito-emergencia-loco' : ''
    } w-[164px] h-[164px] sm:w-[196px] sm:h-[196px] md:w-[216px] md:h-[216px] bg-transparent border-0 shadow-none p-0`;
  }

  const handleSeleccionarFaq = (faq) => {
    setFaqSeleccionadaId(faq.id);
    setRespuestaManual(null);
    setOrigenRespuesta(estaOffline ? 'offline' : 'determinista');
  };

  const handleEnviarConsulta = async (e) => {
    e.preventDefault();
    if (pensando) return;

    const mensaje = consultaInput.trim();
    if (!mensaje) {
      const vacio = buscarRespuestaPorConsulta('', contextoActual);
      setRespuestaManual(vacio.respuesta);
      setOrigenRespuesta('offline');
      return;
    }

    setPensando(true);
    try {
      const resultado = await enviarConsultaAsistenteZorrito({
        mensaje,
        contextoActual,
      });
      setRespuestaManual(resultado.respuesta);
      setOrigenRespuesta(resultado.origen);
      setConsultaInput('');
    } finally {
      setPensando(false);
    }
  };

  const handleCambioChecklist = ({ completo, accion }) => {
    if (completo) {
      setChecklistCelebracion(true);
      setMensajeFeedbackChecklist(MENSAJES_CONTEXTO.checklistCompleto);
      setTimeout(() => setChecklistCelebracion(false), 6000);
      return;
    }
    setChecklistCelebracion(false);
    if (accion === 'marcado') {
      setMensajeFeedbackChecklist(MENSAJES_CONTEXTO.checklistProgreso);
    } else if (accion === 'reiniciado') {
      setMensajeFeedbackChecklist('Lista reiniciada para revisar paso a paso.');
    } else {
      setMensajeFeedbackChecklist('');
    }
  };

  const handleLeerBurbuja = () => {
    if (leyendoVoz) {
      detenerLectura();
      return;
    }
    leerTexto(estadoVisual.mensaje, { id: 'zorrito-burbuja' });
  };

  const finalizarBienvenidaYAbrir = () => {
    setFaseSaludo('finalizado');
    setEsBienvenida(false);
    setPanelAbierto(true);
  };

  const iniciarRegresoDesdeBurbuja = () => {
    if (esEscenaBienvenidaCentro) {
      setFaseSaludo('regresando');
      return;
    }
    setBurbujaVisible(false);
  };

  const bloqueBurbuja = burbujaVisible && !panelAbierto && (
    <aside
      data-testid="zorrito-burbuja"
      role="status"
      aria-live="polite"
      className={`pointer-events-auto zorrito-burbuja clay-card-sm bg-white/95 backdrop-blur-md border border-[#3525CD]/15 p-3.5 sm:p-4 max-w-[300px] sm:max-w-[360px] shadow-xl space-y-2.5 transition-opacity duration-300 ${
        faseSaludo === 'regresando' && esEscenaBienvenidaCentro
          ? 'opacity-0'
          : 'opacity-100'
      }`}
    >
      {esEscenaBienvenidaCentro && (
        <p className="headline-sm text-base sm:text-lg font-extrabold text-[#3525CD] leading-tight">
          ¡Bienvenido a PUKARA!
        </p>
      )}
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm sm:text-base font-medium text-[#111C2D] leading-snug">
          {estadoVisual.mensaje}
        </p>
        <button
          type="button"
          onClick={iniciarRegresoDesdeBurbuja}
          aria-label="Cerrar mensaje de Zorrito"
          className="min-w-[36px] min-h-[36px] rounded-full text-[#475569] hover:bg-slate-100 flex items-center justify-center text-sm font-bold shrink-0 cursor-pointer"
        >
          ✕
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {avisosControlador && !avisosControlador.sonidoActivo && (
          <button
            type="button"
            data-testid="btn-zorrito-activar-sonido"
            onClick={() => avisosControlador.activarAvisosCompletos?.()}
            className="aviso-pressable min-h-[40px] px-3 py-1.5 rounded-full bg-[#ECFDF5] hover:bg-[#D1FAE5] text-[#065F46] border border-[#A7F3D0] text-sm font-bold cursor-pointer"
          >
            Activar sonido
          </button>
        )}
        <button
          type="button"
          data-testid="btn-zorrito-leer-burbuja"
          onClick={handleLeerBurbuja}
          className="aviso-pressable min-h-[40px] px-3 py-1.5 rounded-full bg-[#EEF2FF] hover:bg-[#E2DFFF] text-[#3525CD] text-sm font-bold cursor-pointer"
        >
          {leyendoVoz ? 'Detener voz' : 'Escuchar'}
        </button>
        <button
          type="button"
          data-testid="btn-zorrito-abrir-panel"
          onClick={finalizarBienvenidaYAbrir}
          className="aviso-pressable min-h-[40px] px-3.5 py-1.5 rounded-full bg-[#3525CD] hover:bg-[#4F46E5] text-white text-sm font-bold cursor-pointer"
        >
          Abrir asistente
        </button>
      </div>
    </aside>
  );

  const botonZorrito = (
    <button
      type="button"
      data-testid="btn-mascota-zorrito"
      data-modo-visual={estadoVisual.modoVisual}
      aria-label="Abrir asistente preventivo Zorrito"
      aria-expanded={panelAbierto}
      onClick={() => {
        if (esEscenaBienvenidaCentro) {
          finalizarBienvenidaYAbrir();
          return;
        }
        setPanelAbierto((prev) => !prev);
      }}
      className={`pointer-events-auto zorrito-squish relative flex items-center justify-center cursor-pointer ${claseBotonMascota}`}
    >
      {estadoVisual.modoVisual === 'loco_alerta' && (
        <span
          aria-hidden="true"
          className={`absolute -inset-2 rounded-full blur-md pointer-events-none ${
            esModoEmergencia
              ? 'zorrito-aura-emergencia animate-pulse'
              : 'zorrito-aura-alerta animate-pulse'
          }`}
        />
      )}
      {estadoVisual.sinCuadro && (
        <span
          aria-hidden="true"
          className="zorrito-sombra-suelo absolute bottom-1 inset-x-[16%] h-4 rounded-full pointer-events-none"
        />
      )}
      {errorImagen ? (
        <AvatarZorritoFallback alt={estadoVisual.alt} />
      ) : (
        <img
          key={`${estadoVisual.spriteClave}-${estadoVisual.modoVisual}`}
          data-testid="img-mascota-zorrito"
          src={estadoVisual.imagen}
          alt={estadoVisual.alt}
          onError={() => setErrorImagen(true)}
          className={`zorrito-sprite-swap relative z-10 w-full h-full object-contain select-none pointer-events-none ${
            estadoVisual.sinCuadro ? 'zorrito-transparente-sombra' : ''
          }`}
        />
      )}
    </button>
  );

  return (
    <>
      {esEscenaBienvenidaCentro ? (
        /* Escena de Bienvenida: aparece disparado desde abajo hacia el centro y regresa a su esquina */
        <div
          data-testid="zorrito-escena-bienvenida"
          style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 86px)' }}
          className="pointer-events-none fixed inset-x-0 md:!bottom-10 z-40 flex flex-col items-center justify-end gap-2 px-4"
        >
          {bloqueBurbuja}
          {botonZorrito}
        </div>
      ) : (
        /* Widget Flotante Esquina Inferior Derecha (respeta barra móvil y safe-area) */
        <div
          data-testid="widget-mascota-zorrito"
          style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 78px)' }}
          className="pointer-events-none fixed right-3 sm:right-5 md:!bottom-6 md:right-6 z-40 flex flex-col items-end gap-2.5 max-w-[calc(100vw-24px)]"
        >
          {bloqueBurbuja}

          {/* Control rápido de 1 toque si está sonando una sirena preventiva */}
          {avisosControlador?.reproduciendoNivel && !panelAbierto && (
            <button
              type="button"
              data-testid="btn-zorrito-detener-sonido"
              onClick={() => avisosControlador.detenerSonido?.()}
              className="pointer-events-auto aviso-pressable clay-btn-danger min-h-[44px] px-4 py-2 text-sm font-bold inline-flex items-center gap-2 shadow-lg cursor-pointer"
            >
              <span>Detener sonido</span>
            </button>
          )}

          {botonZorrito}
        </div>
      )}

      {/* Drawer / Popover del Asistente Preventivo */}
      {panelAbierto && (
        <div className="fixed inset-0 z-50 bg-slate-900/35 backdrop-blur-xs flex items-end md:items-end justify-center md:justify-end md:p-6">
          <section
            data-testid="panel-asistente-zorrito"
            role="dialog"
            aria-modal="true"
            aria-label="Asistente Preventivo Zorrito"
            className="zorrito-burbuja w-full md:w-[460px] max-h-[88vh] bg-[#F6F8FA] rounded-t-3xl md:rounded-3xl border border-slate-200/90 shadow-2xl flex flex-col overflow-hidden"
          >
            {/* Cabecera del Asistente */}
            <header className="bg-white border-b border-slate-200/80 px-5 py-4 flex items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-12 h-12 rounded-2xl bg-[#EEF2FF] border border-[#E2DFFF] p-1 shrink-0 flex items-center justify-center">
                  {errorImagen ? (
                    <AvatarZorritoFallback alt={estadoVisual.alt} />
                  ) : (
                    <img
                      src={estadoVisual.imagen}
                      alt={estadoVisual.alt}
                      onError={() => setErrorImagen(true)}
                      className="w-full h-full object-contain"
                    />
                  )}
                </div>
                <div className="min-w-0">
                  <h2 className="headline-md text-lg sm:text-xl font-bold text-[#111C2D] leading-tight">
                    Asistente Preventivo Zorrito
                  </h2>
                  <p className="text-sm text-[#464555] truncate">
                    Guía híbrida · Nivel informativo: {nivelVigente}
                  </p>
                </div>
              </div>

              <button
                type="button"
                data-testid="btn-cerrar-asistente"
                aria-label="Cerrar asistente Zorrito"
                onClick={() => setPanelAbierto(false)}
                className="aviso-pressable min-w-[48px] min-h-[48px] rounded-full bg-[#F0F3FF] hover:bg-[#E7EEFF] text-[#111C2D] font-bold flex items-center justify-center cursor-pointer"
              >
                ✕
              </button>
            </header>

            {/* Pestañas >= 48px */}
            <div
              role="tablist"
              aria-label="Secciones del asistente Zorrito"
              className="grid grid-cols-2 gap-2 p-3 bg-white/85 border-b border-slate-200/70 shrink-0"
            >
              <button
                type="button"
                role="tab"
                data-testid="tab-asistente-voz"
                aria-selected={pestanaActiva === 'asistente'}
                onClick={() => setPestanaActiva('asistente')}
                className={`aviso-pressable min-h-[48px] px-3 py-2 rounded-2xl text-base font-bold cursor-pointer ${
                  pestanaActiva === 'asistente'
                    ? 'bg-[#3525CD] text-white shadow-sm'
                    : 'bg-[#F0F3FF] text-[#111C2D] hover:bg-[#E7EEFF]'
                }`}
              >
                Asistente y Voz
              </button>
              <button
                type="button"
                role="tab"
                data-testid="tab-checklist-familiar"
                aria-selected={pestanaActiva === 'checklist'}
                onClick={() => setPestanaActiva('checklist')}
                className={`aviso-pressable min-h-[48px] px-3 py-2 rounded-2xl text-base font-bold cursor-pointer ${
                  pestanaActiva === 'checklist'
                    ? 'bg-[#3525CD] text-white shadow-sm'
                    : 'bg-[#F0F3FF] text-[#111C2D] hover:bg-[#E7EEFF]'
                }`}
              >
                Checklist Familiar
              </button>
            </div>

            {/* Cuerpo con scroll interno */}
            <div className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1">
              {pestanaActiva === 'asistente' ? (
                <div role="tabpanel" aria-label="Asistente y Voz" className="space-y-4">
                  {/* Recomendación compacta del Zorrito para activar avisos sonoros */}
                  {avisosControlador && (
                    <div
                      data-testid="zorrito-recomendacion-avisos"
                      className="rounded-2xl bg-[#EEF2FF]/75 border border-[#3525CD]/15 px-3.5 py-2.5 flex items-center justify-between gap-3"
                    >
                      <span className="text-sm sm:text-base font-semibold text-[#111C2D] leading-snug">
                        {!avisosControlador.sonidoActivo
                          ? 'Te recomiendo activar los avisos sonoros'
                          : avisosControlador.silenciado
                            ? 'Avisos sonoros silenciados'
                            : 'Avisos sonoros preventivos activos'}
                      </span>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={Boolean(avisosControlador.sonidoActivo)}
                        aria-label="Activar o desactivar avisos sonoros preventivos"
                        data-testid="zorrito-switch-avisos"
                        onClick={() =>
                          avisosControlador.sonidoActivo
                            ? avisosControlador.desactivarAvisosCompletos?.()
                            : avisosControlador.activarAvisosCompletos?.()
                        }
                        className="aviso-pressable min-h-[44px] px-1 flex items-center shrink-0 cursor-pointer"
                      >
                        <span
                          aria-hidden="true"
                          className={`w-11 h-6 rounded-full p-0.5 flex items-center transition-colors duration-150 ${
                            avisosControlador.sonidoActivo
                              ? 'bg-[#3525CD]'
                              : 'bg-slate-300'
                          }`}
                        >
                          <span
                            className={`w-5 h-5 rounded-full bg-white shadow-xs aviso-switch-thumb ${
                              avisosControlador.sonidoActivo
                                ? 'translate-x-5'
                                : 'translate-x-0'
                            }`}
                          />
                        </span>
                      </button>
                    </div>
                  )}

                  {/* Respuesta activa del Zorrito */}
                  <div className="clay-card p-4 space-y-3 bg-white">
                    {pensando ? (
                      <div
                        role="status"
                        data-testid="zorrito-pensando"
                        className="flex items-center gap-2.5 text-base font-semibold text-[#3525CD] py-1"
                      >
                        <span
                          className="w-2.5 h-2.5 rounded-full bg-[#3525CD] animate-pulse shrink-0"
                          aria-hidden="true"
                        />
                        <span>Zorrito está pensando...</span>
                      </div>
                    ) : (
                      <>
                        {badgeOrigen && (
                          <div className="flex justify-end">
                            <span
                              data-testid="badge-origen-asistente"
                              className={`clay-pill px-2.5 py-0.5 text-xs font-bold ${badgeOrigen.clase}`}
                            >
                              {badgeOrigen.texto}
                            </span>
                          </div>
                        )}
                        <p
                          data-testid="respuesta-zorrito"
                          className="text-base text-[#111C2D] leading-relaxed"
                        >
                          {respuestaMostrada}
                        </p>
                      </>
                    )}

                    <BotonLeerVoz
                      idLectura="respuesta-zorrito"
                      texto={respuestaMostrada}
                      etiqueta="Escuchar respuesta"
                      etiquetaDetener="Detener voz"
                      ocultarSiNoSoporta={false}
                    />
                  </div>

                  {/* Buscador / Chat híbrido */}
                  <form onSubmit={handleEnviarConsulta} className="flex gap-2">
                    <label htmlFor="input-consulta-zorrito" className="sr-only">
                      Escribe tu saludo o consulta preventiva
                    </label>
                    <input
                      id="input-consulta-zorrito"
                      data-testid="input-consulta-zorrito"
                      type="text"
                      maxLength={300}
                      disabled={pensando}
                      value={consultaInput}
                      onChange={(e) => setConsultaInput(e.target.value)}
                      placeholder="Saluda o pregunta sobre Llojeta (ej. hola, lluvia, gps)..."
                      className="clay-input flex-1 px-3.5 text-base min-w-0 disabled:opacity-60"
                    />
                    <button
                      type="submit"
                      disabled={pensando}
                      className="aviso-pressable min-h-[48px] px-4 rounded-2xl bg-[#3525CD] hover:bg-[#4F46E5] text-white text-base font-bold shrink-0 disabled:opacity-60 cursor-pointer"
                    >
                      Consultar
                    </button>
                  </form>

                  {/* Chips de Preguntas Frecuentes */}
                  <div className="space-y-2">
                    <p className="text-sm font-bold text-[#464555]">
                      Preguntas frecuentes:
                    </p>
                    <div className="flex flex-col gap-2">
                      {PREGUNTAS_FRECUENTES.map((faq) => {
                        const activa =
                          respuestaManual === null && faqSeleccionadaId === faq.id;
                        return (
                          <button
                            key={faq.id}
                            type="button"
                            data-testid={`faq-chip-${faq.id}`}
                            onClick={() => handleSeleccionarFaq(faq)}
                            className={`aviso-pressable min-h-[48px] w-full px-4 py-2.5 rounded-2xl border text-left text-base font-semibold cursor-pointer ${
                              activa
                                ? 'bg-[#EEF2FF] border-[#3525CD]/40 text-[#3525CD]'
                                : 'bg-white border-slate-200 text-[#111C2D] hover:bg-[#F0F3FF]'
                            }`}
                          >
                            {faq.pregunta}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              ) : (
                <div role="tabpanel" aria-label="Checklist Familiar" className="space-y-3">
                  {mensajeFeedbackChecklist && (
                    <div
                      role="status"
                      className="rounded-2xl bg-[#ECFDF5] border border-[#A7F3D0] px-4 py-3 text-base font-semibold text-[#065F46]"
                    >
                      {mensajeFeedbackChecklist}
                    </div>
                  )}
                  <ChecklistFamiliar onCambioProgreso={handleCambioChecklist} />
                </div>
              )}
            </div>

            {/* Pie informativo */}
            <footer className="bg-white border-t border-slate-200/80 px-5 py-3 text-sm text-[#464555] shrink-0">
              Asistente informativo preventivo. No sustituye alertas ni indicaciones de autoridades oficiales.
            </footer>
          </section>
        </div>
      )}
    </>
  );
}
