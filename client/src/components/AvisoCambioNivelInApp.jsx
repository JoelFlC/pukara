import React from 'react';

/**
 * Paleta Pastel Clay semántica de alto contraste AAA por nivel informativo.
 */
const ESTILOS_NIVEL = {
  NORMAL: {
    bg: 'bg-[#ECFDF5]',
    border: 'border-[#A7F3D0]',
    text: 'text-[#065F46]',
    badge: 'bg-[#059669] text-white',
    icono: '🟢',
  },
  PRECAUCION: {
    bg: 'bg-[#FEF3C7]',
    border: 'border-[#FDE68A]',
    text: 'text-[#92400E]',
    badge: 'bg-[#B45309] text-white',
    icono: '🟡',
  },
  ALERTA: {
    bg: 'bg-[#FFEDD5]',
    border: 'border-[#FED7AA]',
    text: 'text-[#9A3412]',
    badge: 'bg-[#C2410C] text-white',
    icono: '🟠',
  },
  EMERGENCIA: {
    bg: 'bg-[#FEE2E2]',
    border: 'border-[#FECACA]',
    text: 'text-[#991B1B]',
    badge: 'bg-[#DC2626] text-white',
    icono: '🔴',
  },
};

/**
 * Componente AvisoCambioNivelInApp (Requisito P06)
 *
 * Muestra un aviso visual destacado dentro de la aplicación ante cambios detectados
 * en el nivel informativo de lluvia mientras la pestaña se mantiene abierta.
 *
 * @param {Object} props
 * @param {Object|null} props.cambioNivel Objeto con información del cambio
 * @param {string} props.cambioNivel.nivelAnterior Nivel previo
 * @param {string} props.cambioNivel.nivelNuevo Nivel resultante
 * @param {string} [props.cambioNivel.modalidad] 'real' o 'simulada'
 * @param {string} [props.cambioNivel.detectadoEn] Marca de tiempo ISO
 * @param {Object} [props.cambioNivel.recomendacion] Recomendación preventiva vigente
 * @param {Function} props.onCerrar Callback ejecutado al cerrar el aviso
 */
export default function AvisoCambioNivelInApp({ cambioNivel, onCerrar }) {
  if (!cambioNivel || !cambioNivel.nivelNuevo) {
    return null;
  }

  const {
    nivelAnterior = 'NORMAL',
    nivelNuevo = 'NORMAL',
    modalidad = 'real',
    recomendacion = null,
  } = cambioNivel;

  const estilos = ESTILOS_NIVEL[nivelNuevo] || ESTILOS_NIVEL.NORMAL;
  const esAscenso =
    nivelNuevo === 'EMERGENCIA' ||
    (nivelNuevo === 'ALERTA' && nivelAnterior !== 'EMERGENCIA') ||
    (nivelNuevo === 'PRECAUCION' && nivelAnterior === 'NORMAL');

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/45 backdrop-blur-xs flex items-center justify-center p-4">
      <aside
        data-testid="aviso-cambio-nivel-inapp"
        role="status"
        aria-live="polite"
        aria-modal="true"
        className={`w-full max-w-lg clay-card border-2 ${estilos.border} ${estilos.bg} p-5 sm:p-6 space-y-4 shadow-2xl animate-fade-up`}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <span className="text-2xl select-none shrink-0 mt-0.5" aria-hidden="true">
              {estilos.icono}
            </span>
            <div className="min-w-0 space-y-1">
              <span
                className={`clay-pill inline-block text-[11px] font-extrabold px-2.5 py-0.5 ${estilos.badge} uppercase tracking-wide`}
              >
                {esAscenso ? '▲ Cambio de nivel' : '▼ Descenso'}
                {modalidad === 'simulada' ? ' · Simulación' : ''}
              </span>
              <h2 className={`headline-sm text-lg font-extrabold ${estilos.text} leading-snug break-words`}>
                Cambio en el nivel informativo de lluvia: de {nivelAnterior} a {nivelNuevo}
              </h2>
            </div>
          </div>
        </div>

        {/* Resumen corto de la recomendación preventiva */}
        {recomendacion && (
          <div className="clay-card-sm bg-white/95 p-3.5 space-y-1">
            <p className="text-base font-bold text-[#111C2D]">
              {recomendacion.titulo || `Recomendación para ${nivelNuevo}`}
            </p>
            <p className="text-sm sm:text-base text-[#1E293B] leading-relaxed">
              {recomendacion.contenido}
            </p>
          </div>
        )}

        {/* Nota breve obligatoria */}
        <p className="text-xs sm:text-sm text-[#1E293B] bg-white/75 p-3 rounded-xl border border-white/90 leading-relaxed">
          Aviso visual dentro de la aplicación (solo mientras la aplicación permanece abierta; no es una notificación remota ni sustituye canales oficiales).
        </p>

        {/* Botón táctil de confirmación */}
        <div className="flex justify-end">
          <button
            type="button"
            onClick={onCerrar}
            className="clay-btn-primary clay-interactive min-h-[48px] w-full sm:w-auto px-6 py-2.5 text-base font-bold inline-flex items-center justify-center gap-2 cursor-pointer"
          >
            <span>✓</span>
            <span>Entendido / Cerrar aviso</span>
          </button>
        </div>
      </aside>
    </div>
  );
}
