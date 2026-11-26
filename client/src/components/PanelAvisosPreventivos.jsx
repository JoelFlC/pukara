import React from 'react';
import { useAvisosNivel } from '../hooks/useAvisosNivel';

const ETIQUETAS_REPRODUCCION = {
  NORMAL: 'Normal',
  PRECAUCION: 'Precaución',
  ALERTA: 'Alerta',
  EMERGENCIA: 'Emergencia',
};

function IconoAltavozCompacto({ activo }) {
  return (
    <svg
      className="w-5 h-5 shrink-0"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
      {activo ? (
        <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
      ) : (
        <>
          <line x1="22" y1="9" x2="16" y2="15" />
          <line x1="16" y1="9" x2="22" y2="15" />
        </>
      )}
    </svg>
  );
}

function IconoSilencio() {
  return (
    <svg
      className="w-4 h-4 shrink-0"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
      <line x1="22" y1="9" x2="16" y2="15" />
      <line x1="16" y1="9" x2="22" y2="15" />
    </svg>
  );
}

function IconoDetener() {
  return (
    <svg
      className="w-4 h-4 shrink-0"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="6" y="6" width="12" height="12" rx="2" />
    </svg>
  );
}

function BarrasSonidoActivas() {
  return (
    <span className="inline-flex items-end gap-0.5 h-3.5 shrink-0" aria-hidden="true">
      <span
        className="w-1 h-3.5 rounded-full bg-current aviso-wave-bar"
        style={{ animationDelay: '0ms' }}
      />
      <span
        className="w-1 h-3.5 rounded-full bg-current aviso-wave-bar"
        style={{ animationDelay: '140ms' }}
      />
      <span
        className="w-1 h-3.5 rounded-full bg-current aviso-wave-bar"
        style={{ animationDelay: '280ms' }}
      />
    </span>
  );
}

/**
 * Barra compacta de avisos sonoros preventivos, vibración y notificaciones del sistema.
 * Pensada para no ocupar espacio ni distraer de la lectura principal.
 *
 * @param {Object} [props]
 * @param {Object|null} [props.controlador=null] Instancia de useAvisosNivel compartida
 */
export default function PanelAvisosPreventivos({ controlador = null }) {
  const controladorLocal = useAvisosNivel();
  const avisos = controlador || controladorLocal;

  const {
    sonidoActivo,
    notificacionesActivas,
    silenciado,
    permisoNotificaciones,
    esContextoSeguro,
    reproduciendoNivel,
    activarAvisosCompletos,
    desactivarAvisosCompletos,
    alternarSilencio,
    detenerSonido,
  } = avisos;

  const handleToggleAvisos = async () => {
    if (sonidoActivo) {
      desactivarAvisosCompletos();
      return;
    }
    await activarAvisosCompletos();
  };

  const mostrarAvisoCompatibilidad =
    sonidoActivo &&
    (!esContextoSeguro ||
      permisoNotificaciones === 'denied' ||
      permisoNotificaciones === 'unsupported');

  let etiquetaEstado = 'Inactivos';
  let claseEstado =
    'bg-[#F0F3FF] text-[#464555] border border-slate-200/80';
  if (sonidoActivo && silenciado) {
    etiquetaEstado = 'Silenciados';
    claseEstado = 'bg-[#FEF3C7] text-[#92400E] border border-[#FDE68A]';
  } else if (sonidoActivo) {
    etiquetaEstado = notificacionesActivas ? 'Activos' : 'Sonido activo';
    claseEstado = 'bg-[#ECFDF5] text-[#065F46] border border-[#A7F3D0]';
  }

  return (
    <section
      data-testid="panel-avisos-preventivos"
      aria-label="Avisos sonoros preventivos"
      className="clay-card-sm bg-white/95 px-4 py-3 space-y-2"
    >
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <button
          type="button"
          role="switch"
          aria-checked={sonidoActivo}
          data-testid="switch-activar-avisos"
          onClick={handleToggleAvisos}
          className="aviso-pressable min-h-[48px] flex-1 sm:flex-initial px-3 py-1.5 rounded-2xl hover:bg-[#F8FAFC] text-base font-bold text-[#111C2D] inline-flex items-center justify-between sm:justify-start gap-3 cursor-pointer"
        >
          <span className="inline-flex items-center gap-2.5 min-w-0">
            <span
              className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                sonidoActivo && !silenciado
                  ? 'bg-[#EEF2FF] text-[#3525CD]'
                  : 'bg-[#F0F3FF] text-[#464555]'
              }`}
            >
              <IconoAltavozCompacto activo={sonidoActivo && !silenciado} />
            </span>
            <span className="text-left leading-snug">
              Avisos sonoros preventivos
            </span>
          </span>

          <span
            data-testid="estado-avisos-badge"
            className={`clay-pill px-2.5 py-0.5 text-xs font-bold shrink-0 ${claseEstado}`}
          >
            {etiquetaEstado}
          </span>

          <span
            aria-hidden="true"
            className={`w-11 h-6 rounded-full p-0.5 flex items-center shrink-0 transition-colors duration-150 ${
              sonidoActivo ? 'bg-[#3525CD]' : 'bg-slate-300'
            }`}
          >
            <span
              className={`w-5 h-5 rounded-full bg-white shadow-xs aviso-switch-thumb ${
                sonidoActivo ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </span>
        </button>

        {(sonidoActivo || reproduciendoNivel) && (
          <div className="flex flex-wrap items-center gap-2">
            {reproduciendoNivel && (
              <span
                role="status"
                aria-live="polite"
                data-testid="feedback-sonido-activo"
                className="clay-pill bg-[#EEF2FF] text-[#3525CD] border border-[#E2DFFF] px-3 py-1.5 text-sm font-bold inline-flex items-center gap-2"
              >
                <BarrasSonidoActivas />
                <span>
                  Sonando: {ETIQUETAS_REPRODUCCION[reproduciendoNivel] || reproduciendoNivel}
                </span>
              </span>
            )}

            {sonidoActivo && (
              <button
                type="button"
                data-testid="btn-silenciar-avisos"
                aria-pressed={silenciado}
                onClick={alternarSilencio}
                className={`aviso-pressable min-h-[48px] px-3.5 py-2 rounded-full text-sm sm:text-base font-bold inline-flex items-center justify-center gap-1.5 border cursor-pointer ${
                  silenciado
                    ? 'bg-[#FEF3C7] text-[#92400E] border-[#FDE68A]'
                    : 'bg-white text-[#111C2D] border-slate-200 hover:bg-[#F0F3FF]'
                }`}
              >
                <IconoSilencio />
                <span>{silenciado ? 'Reactivar' : 'Silenciar'}</span>
              </button>
            )}

            {reproduciendoNivel && (
              <button
                type="button"
                data-testid="btn-detener-sonido"
                onClick={detenerSonido}
                className="aviso-pressable clay-btn-danger min-h-[48px] px-4 py-2 text-sm sm:text-base font-bold inline-flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <IconoDetener />
                <span>Detener sonido</span>
              </button>
            )}
          </div>
        )}
      </div>

      <p className="text-xs sm:text-sm text-[#475569] leading-snug px-1">
        Avisos preventivos locales sobre el nivel informativo de lluvia. No sustituyen alertas oficiales.
        {mostrarAvisoCompatibilidad && (
          <span data-testid="aviso-compatibilidad-notificaciones">
            {' '}
            Sonido y vibración locales activos (las notificaciones del sistema requieren HTTPS/permiso).
          </span>
        )}
      </p>
    </section>
  );
}
