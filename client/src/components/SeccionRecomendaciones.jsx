import React, { useState } from 'react';

const NIVELES_ORDEN = ['NORMAL', 'PRECAUCION', 'ALERTA', 'EMERGENCIA'];

const COLORES_NIVEL = {
  NORMAL: {
    bg: 'bg-[#ECFDF5]',
    border: 'border-[#A7F3D0]',
    text: 'text-[#065F46]',
    badge: 'bg-[#D1FAE5] text-[#065F46] border-[#A7F3D0]',
    icono: '🟢',
  },
  PRECAUCION: {
    bg: 'bg-[#FEF3C7]',
    border: 'border-[#FDE68A]',
    text: 'text-[#92400E]',
    badge: 'bg-[#FEF3C7] text-[#92400E] border-[#FDE68A]',
    icono: '🟡',
  },
  ALERTA: {
    bg: 'bg-[#FFEDD5]',
    border: 'border-[#FED7AA]',
    text: 'text-[#9A3412]',
    badge: 'bg-[#FFEDD5] text-[#9A3412] border-[#FED7AA]',
    icono: '🟠',
  },
  EMERGENCIA: {
    bg: 'bg-[#FEE2E2]',
    border: 'border-[#FECACA]',
    text: 'text-[#991B1B]',
    badge: 'bg-[#FEE2E2] text-[#991B1B] border-[#FECACA]',
    icono: '🔴',
  },
};

/**
 * Componente SeccionRecomendaciones (Capítulo 01 — Guía Preventiva, Módulo 3 y Requisito P06)
 *
 * Presenta las recomendaciones preventivas generales priorizando el nivel vigente,
 * con trazabilidad del origen institucional o de demostración y desglose de los 4 niveles.
 *
 * @param {Object} props
 * @param {string} [props.nivelVigente='NORMAL'] Nivel informativo vigente
 * @param {string} [props.estadoSistema='NORMAL'] Estado global del sistema
 * @param {Object|null} [props.recomendacionVigente] Recomendación del nivel vigente
 * @param {Array<Object>} [props.recomendacionesPublicadas] Todas las recomendaciones publicadas
 */
export default function SeccionRecomendaciones({
  nivelVigente = 'NORMAL',
  estadoSistema = 'NORMAL',
  recomendacionVigente = null,
  recomendacionesPublicadas = [],
}) {
  const [mostrarTodos, setMostrarTodos] = useState(false);

  const nivelEfectivo = nivelVigente || 'NORMAL';
  const esDatosDesactualizados = estadoSistema === 'DATOS_DESACTUALIZADOS';

  const recomActual =
    recomendacionVigente ||
    recomendacionesPublicadas.find((r) => r.nivel === nivelEfectivo) ||
    null;

  const renderBadgeOrigen = (origen) => {
    if (origen === 'institucional_verificada') {
      return (
        <span className="clay-pill inline-flex items-center gap-1.5 px-3 py-1 text-xs font-bold bg-[#EEF2FF] text-[#3525CD] border border-[#E2DFFF]">
          <span aria-hidden="true">🏛️</span>
          <span>Origen: Institucional verificada</span>
        </span>
      );
    }
    return (
      <span className="clay-pill inline-flex items-center gap-1.5 px-3 py-1 text-xs font-bold bg-white/90 text-[#92400E] border border-[#FDE68A]">
        <span aria-hidden="true">🧪</span>
        <span>Origen: Demostración (contenido académico)</span>
      </span>
    );
  };

  const estiloActual = COLORES_NIVEL[nivelEfectivo] || COLORES_NIVEL.NORMAL;

  return (
    <section
      aria-label="Recomendaciones preventivas generales"
      className="clay-card p-5 sm:p-7 space-y-5 animate-fade-up"
    >
      <header className="space-y-2 border-b border-slate-100 pb-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="swiss-chapter-badge">
            01 CAPÍTULO UNO — GUÍA PREVENTIVA
          </span>
          <span
            className={`clay-pill text-xs font-extrabold px-3 py-1 border ${estiloActual.badge}`}
          >
            {esDatosDesactualizados
              ? `Último nivel: ${nivelEfectivo}`
              : `Nivel vigente: ${nivelEfectivo}`}
          </span>
        </div>
        <h2 className="headline-lg text-2xl sm:text-3xl lg:text-4xl font-bold text-[#111C2D] leading-snug break-words">
          Recomendaciones Preventivas para {nivelEfectivo}
        </h2>
        {esDatosDesactualizados && (
          <p className="text-base text-[#92400E] bg-[#FEF3C7] p-3.5 rounded-2xl border border-[#FDE68A]">
            ⚠️ Información basada en el último nivel informativo conocido ante antigüedad de lecturas superior a T_max.
          </p>
        )}
      </header>

      {/* 1. Recomendación destacada para el nivel vigente actual */}
      {recomActual ? (
        <article
          className={`clay-card-sm border-2 ${estiloActual.border} ${estiloActual.bg} p-5 sm:p-6 space-y-3`}
        >
          <div className="flex flex-wrap items-start justify-between gap-2.5">
            <h3 className="headline-sm text-lg sm:text-xl font-extrabold text-[#111C2D] leading-snug">
              {recomActual.titulo}
            </h3>
            {renderBadgeOrigen(recomActual.origen)}
          </div>

          <p className="text-base sm:text-lg text-[#1E293B] leading-relaxed font-medium">
            {recomActual.contenido}
          </p>

          <div className="flex flex-wrap items-center justify-between gap-2 text-xs sm:text-sm text-[#475569] font-mono pt-3 border-t border-black/10">
            <span>Versión: v{recomActual.version || 1}</span>
            {recomActual.fuente && (
              <span>Fuente: {recomActual.fuente}</span>
            )}
          </div>
        </article>
      ) : (
        <div className="clay-card-sm bg-[#F9F9FF] p-5 text-center text-base text-[#464555]">
          No hay una recomendación vigente registrada para este nivel en este momento.
        </div>
      )}

      {/* 2. Acordeón / Despliegue para consultar los otros niveles */}
      <div className="pt-1 space-y-4">
        <button
          type="button"
          onClick={() => setMostrarTodos(!mostrarTodos)}
          className="clay-btn-secondary clay-interactive w-full min-h-[48px] px-4 py-3 text-sm sm:text-base font-bold text-[#111C2D] flex items-center justify-between gap-3 text-left cursor-pointer"
        >
          <span className="leading-snug">
            {mostrarTodos
              ? 'Ocultar recomendaciones de otros niveles'
              : 'Consultar recomendaciones generales de los cuatro niveles (NORMAL, PRECAUCIÓN, ALERTA, EMERGENCIA)'}
          </span>
          <span className="shrink-0" aria-hidden="true">{mostrarTodos ? '▲' : '▼'}</span>
        </button>

        {mostrarTodos && (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 pt-2 border-t border-slate-100">
            {NIVELES_ORDEN.map((nivel) => {
              const recNivel = recomendacionesPublicadas.find(
                (r) => r.nivel === nivel
              );
              if (!recNivel) return null;
              const est = COLORES_NIVEL[nivel] || COLORES_NIVEL.NORMAL;
              const esVigente = nivel === nivelEfectivo;

              return (
                <div
                  key={nivel}
                  className={`clay-card-sm border-2 ${est.border} ${est.bg} p-4 space-y-2.5 flex flex-col justify-between ${
                    esVigente ? 'ring-2 ring-offset-2 ring-[#3525CD]' : ''
                  }`}
                >
                  <div className="space-y-2.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 font-extrabold text-sm text-[#111C2D]">
                        <span aria-hidden="true">{est.icono}</span>
                        <span>Nivel {nivel}</span>
                        {esVigente && (
                          <span className="text-xs bg-[#3525CD] text-white px-2.5 py-0.5 rounded-full font-mono">
                            (Vigente)
                          </span>
                        )}
                      </div>
                    </div>
                    <div>{renderBadgeOrigen(recNivel.origen)}</div>
                    <h4 className="font-bold text-base text-[#111C2D] leading-snug">
                      {recNivel.titulo}
                    </h4>
                    <p className="text-base text-[#1E293B] leading-relaxed">
                      {recNivel.contenido}
                    </p>
                  </div>

                  {recNivel.fuente && (
                    <p className="text-xs text-[#475569] font-mono pt-2 border-t border-black/10">
                      Fuente: {recNivel.fuente} · Versión: v{recNivel.version || 1}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Recordatorio legal obligatorio del Módulo 3 */}
      <footer className="clay-card-sm bg-[#F9F9FF] p-4 text-sm sm:text-base text-[#464555] leading-relaxed">
        <strong className="text-[#111C2D]">Aviso preventivo:</strong> Recomendaciones preventivas generales de carácter informativo. El sistema no emite instrucciones de desplazamiento ni sustituye a las autoridades competentes.
      </footer>
    </section>
  );
}
