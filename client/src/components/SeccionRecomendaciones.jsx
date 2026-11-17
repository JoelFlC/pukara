import React from 'react';

const NIVELES_ORDEN = ['NORMAL', 'PRECAUCION', 'ALERTA', 'EMERGENCIA'];

const ESTILOS_TARJETA_NIVEL = {
  NORMAL: {
    etiquetaCorta: 'VERDE · NORMAL',
    pill: 'bg-[#ECFDF5] text-[#065F46] border-[#A7F3D0]',
    bordeActivo: 'border-[#059669] ring-4 ring-[#ECFDF5]',
    icono: '🟢',
  },
  PRECAUCION: {
    etiquetaCorta: 'AMARILLO · PRECAUCIÓN',
    pill: 'bg-[#FEF3C7] text-[#92400E] border-[#FDE68A]',
    bordeActivo: 'border-[#D97706] ring-4 ring-[#FEF3C7]',
    icono: '🟡',
  },
  ALERTA: {
    etiquetaCorta: 'NARANJA · ALERTA',
    pill: 'bg-[#FFEDD5] text-[#9A3412] border-[#FED7AA]',
    bordeActivo: 'border-[#EA580C] ring-4 ring-[#FFEDD5]',
    icono: '🟠',
  },
  EMERGENCIA: {
    etiquetaCorta: 'ROJO · EMERGENCIA',
    pill: 'bg-[#FEE2E2] text-[#991B1B] border-[#FECACA]',
    bordeActivo: 'border-[#DC2626] ring-4 ring-[#FEE2E2]',
    icono: '🔴',
  },
};

/**
 * Componente SeccionRecomendaciones (Capítulo 01 — Guía Preventiva, Módulo 3 y Requisito P06)
 *
 * Presenta las recomendaciones preventivas generales directamente en 4 tarjetas verticales
 * por color (una por nivel) sobre el lienzo limpio para lectura inmediata sin clics extra.
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
  const nivelEfectivo = nivelVigente || 'NORMAL';
  const esDatosDesactualizados = estadoSistema === 'DATOS_DESACTUALIZADOS';

  const renderBadgeOrigen = (origen) => {
    if (origen === 'institucional_verificada') {
      return (
        <span className="clay-pill inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold bg-[#EEF2FF] text-[#3525CD] border border-[#E2DFFF]">
          <span aria-hidden="true">🏛️</span>
          <span>Origen: Institucional verificada</span>
        </span>
      );
    }
    return (
      <span className="clay-pill inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold bg-[#FEF3C7] text-[#92400E] border border-[#FDE68A]">
        <span aria-hidden="true">🧪</span>
        <span>Origen: Demostración (contenido académico)</span>
      </span>
    );
  };

  // Construir la grilla de tarjetas priorizando recomendacionVigente para el nivel actual
  const tarjetas = NIVELES_ORDEN.map((nivel) => {
    const encontrada = recomendacionesPublicadas.find((r) => r.nivel === nivel);
    const rec =
      nivel === nivelEfectivo
        ? recomendacionVigente || encontrada || null
        : encontrada || null;
    return { nivel, rec };
  }).filter((item) => item.rec !== null);

  return (
    <section
      aria-label="Recomendaciones preventivas generales"
      className="space-y-6 animate-fade-up"
    >
      {/* Encabezado Editorial Suizo directo sobre el lienzo */}
      <header className="space-y-2">
        <div className="flex flex-wrap items-center gap-3">
          <span className="swiss-chapter-badge">
            01 CAPÍTULO UNO — GUÍA PREVENTIVA
          </span>
          <span className="clay-pill px-3 py-0.5 text-xs font-bold bg-white text-[#111C2D] border border-slate-200">
            {esDatosDesactualizados
              ? `Último nivel: ${nivelEfectivo}`
              : `Nivel vigente: ${nivelEfectivo}`}
          </span>
        </div>

        <h2 className="headline-lg text-2xl sm:text-4xl font-extrabold text-[#111C2D] leading-tight break-words">
          ¿Qué hacer según el nivel de lluvia?
        </h2>

        <p className="text-base sm:text-lg text-[#464555] leading-relaxed max-w-4xl">
          <strong className="text-[#111C2D]">
            Recomendaciones Preventivas para {nivelEfectivo}
          </strong>{' '}
          — Pautas preventivas claras y directas para cada hogar del sector Llojeta.
        </p>

        {esDatosDesactualizados && (
          <p className="text-base text-[#92400E] bg-[#FEF3C7] p-3.5 rounded-2xl border border-[#FDE68A]">
            ⚠️ Información basada en el último nivel informativo conocido ante antigüedad de lecturas superior a T_max.
          </p>
        )}
      </header>

      {/* Grilla Directa de las 4 Tarjetas Verticales por Color */}
      {tarjetas.length === 0 ? (
        <div className="clay-card p-6 text-center text-base text-[#464555]">
          No hay recomendaciones vigentes registradas en este momento.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {tarjetas.map(({ nivel, rec }) => {
            const est = ESTILOS_TARJETA_NIVEL[nivel] || ESTILOS_TARJETA_NIVEL.NORMAL;
            const esVigente = nivel === nivelEfectivo;

            return (
              <article
                key={nivel}
                className={`clay-card clay-interactive p-6 flex flex-col justify-between gap-4 border-2 transition-all ${
                  esVigente
                    ? `${est.bordeActivo} shadow-lg`
                    : 'border-slate-200/70'
                }`}
              >
                <div className="space-y-3.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span
                      className={`clay-pill inline-flex items-center gap-1.5 px-3 py-1 text-xs font-extrabold border ${est.pill}`}
                    >
                      <span aria-hidden="true">{est.icono}</span>
                      <span>{est.etiquetaCorta}</span>
                    </span>
                    {esVigente && (
                      <span className="text-[11px] bg-[#111C2D] text-white px-2.5 py-0.5 rounded-full font-extrabold uppercase tracking-wide">
                        (Vigente)
                      </span>
                    )}
                  </div>

                  <h3 className="headline-sm text-lg sm:text-xl font-extrabold text-[#111C2D] leading-snug">
                    {rec.titulo}
                  </h3>

                  <p className="text-base text-[#1E293B] leading-relaxed">
                    {rec.contenido}
                  </p>
                </div>

                <div className="pt-3 border-t border-slate-100 space-y-2">
                  <div>{renderBadgeOrigen(rec.origen)}</div>
                  <div className="text-xs text-[#475569] font-mono flex flex-wrap items-center justify-between gap-1">
                    <span>Versión: v{rec.version || 1}</span>
                    {rec.fuente && <span className="truncate">{rec.fuente}</span>}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* Recordatorio legal obligatorio del Módulo 3 */}
      <footer className="rounded-2xl bg-white/80 border border-slate-200/80 px-5 py-3.5 text-sm text-[#464555] leading-relaxed">
        <strong className="text-[#111C2D]">Aviso preventivo:</strong> Recomendaciones preventivas generales de carácter informativo. El sistema no emite instrucciones de desplazamiento ni sustituye a las autoridades competentes.
      </footer>
    </section>
  );
}
