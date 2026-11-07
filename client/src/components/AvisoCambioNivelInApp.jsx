import React from 'react';

/**
 * Paleta de colores y estilos visuales por nivel informativo
 */
const ESTILOS_NIVEL = {
  NORMAL: {
    bg: 'bg-emerald-50',
    border: 'border-emerald-400',
    text: 'text-emerald-950',
    badge: 'bg-emerald-600 text-white',
    icono: '🟢',
  },
  PRECAUCION: {
    bg: 'bg-amber-50',
    border: 'border-amber-400',
    text: 'text-amber-950',
    badge: 'bg-amber-500 text-white',
    icono: '🟡',
  },
  ALERTA: {
    bg: 'bg-orange-50',
    border: 'border-orange-400',
    text: 'text-orange-950',
    badge: 'bg-orange-600 text-white',
    icono: '🟠',
  },
  EMERGENCIA: {
    bg: 'bg-red-50',
    border: 'border-red-500',
    text: 'text-red-950',
    badge: 'bg-red-600 text-white',
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
    <aside
      data-testid="aviso-cambio-nivel-inapp"
      role="status"
      aria-live="polite"
      className={`w-full rounded-2xl border-2 ${estilos.border} ${estilos.bg} p-4 sm:p-5 shadow-md space-y-3 transition-all`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-xl select-none" aria-hidden="true">
            {estilos.icono}
          </span>
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-600 block">
              Aviso Visual In-App · Requisito P06 {modalidad === 'simulada' ? '(Demostración Simulación)' : ''}
            </span>
            <h2 className={`text-sm sm:text-base font-extrabold ${estilos.text} leading-tight`}>
              Cambio en el nivel informativo de lluvia: de {nivelAnterior} a {nivelNuevo}
            </h2>
          </div>
        </div>

        <span
          className={`shrink-0 text-[11px] font-bold px-2.5 py-1 rounded-full ${estilos.badge} shadow-xs uppercase tracking-wide`}
        >
          {esAscenso ? '▲ Nuevo nivel' : '▼ Descenso (histéresis)'}
        </span>
      </div>

      {/* Resumen de la recomendación preventiva general vigente */}
      {recomendacion && (
        <div className="rounded-xl bg-white/90 border border-slate-200/80 p-3 space-y-1">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-bold text-slate-900">
              {recomendacion.titulo || `Recomendación vigente para ${nivelNuevo}`}
            </p>
            {recomendacion.origen && (
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-100 text-slate-700">
                {recomendacion.origen === 'institucional_verificada'
                  ? 'institucional_verificada'
                  : 'demostracion'}
              </span>
            )}
          </div>
          <p className="text-xs text-slate-700 leading-relaxed">
            {recomendacion.contenido}
          </p>
        </div>
      )}

      {/* Nota explícita obligatoria */}
      <p className="text-[11px] text-slate-600 bg-white/60 p-2.5 rounded-lg border border-slate-200/60 leading-relaxed">
        <strong>Nota importante:</strong> Aviso visual dentro de la aplicación (solo mientras la aplicación permanece abierta; no es una notificación remota ni sustituye canales oficiales). Ante emergencias, contacte a los servicios oficiales.
      </p>

      {/* Botón táctil de confirmación */}
      <div className="flex justify-end pt-1">
        <button
          type="button"
          onClick={onCerrar}
          className="min-h-[44px] px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs transition-colors shadow-xs inline-flex items-center justify-center gap-1.5"
        >
          <span>✓</span>
          <span>Entendido / Cerrar aviso</span>
        </button>
      </div>
    </aside>
  );
}

