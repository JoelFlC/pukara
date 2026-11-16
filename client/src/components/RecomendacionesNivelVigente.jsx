import React from 'react';

/**
 * Componente RecomendacionesNivelVigente
 * Muestra las recomendaciones preventivas generales asociadas al nivel vigente de lluvia,
 * con trazabilidad explícita del origen del contenido (Prueba de Control Legal y Semántico).
 *
 * @param {Object} props
 * @param {Array<Object>} [props.recomendaciones] Lista de recomendaciones para el nivel vigente
 * @param {string} [props.nivelVigente='NORMAL'] Nivel informativo actual
 */
export default function RecomendacionesNivelVigente({
  recomendaciones = [],
  nivelVigente = 'NORMAL',
}) {
  return (
    <section
      aria-label="Recomendaciones preventivas generales"
      className="clay-card p-5 sm:p-6 space-y-4 animate-fade-up"
    >
      <div className="space-y-1.5 border-b border-slate-100 pb-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="swiss-chapter-badge">
            Medidas Preventivas Generales
          </span>
          <span className="clay-pill text-xs font-bold text-[#111C2D] bg-[#F0F3FF] px-3 py-1 border border-[#E2DFFF]">
            Nivel: {nivelVigente}
          </span>
        </div>
        <h2 className="headline-md text-xl sm:text-2xl font-bold text-[#111C2D] leading-snug">
          Recomendaciones Preventivas para {nivelVigente}
        </h2>
        <p className="text-base text-[#464555] leading-relaxed">
          Pautas y consejos generales ante el nivel meteorológico informado. No sustituyen las indicaciones de las autoridades oficiales.
        </p>
      </div>

      {(!recomendaciones || recomendaciones.length === 0) ? (
        <div className="clay-card-sm bg-[#F9F9FF] p-5 text-center">
          <p className="text-base text-[#464555]">
            No hay recomendaciones específicas publicadas para este nivel informativo en este momento.
          </p>
        </div>
      ) : (
        <ul className="space-y-3.5">
          {recomendaciones.map((rec) => {
            const esVerificada = rec.origen === 'institucional_verificada';

            return (
              <li
                key={rec.id}
                className="clay-card-sm bg-[#F9F9FF] p-4 sm:p-5 space-y-2.5 transition-all"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <h3 className="headline-sm font-bold text-[#111C2D] text-lg leading-snug">
                    {rec.titulo}
                  </h3>
                  <span
                    className={`clay-pill shrink-0 text-xs font-bold px-3 py-1 border ${
                      esVerificada
                        ? 'bg-[#EEF2FF] text-[#3525CD] border-[#E2DFFF]'
                        : 'bg-[#FEF3C7] text-[#92400E] border-[#FDE68A]'
                    }`}
                  >
                    {esVerificada
                      ? 'institucional_verificada'
                      : 'demostracion'}
                  </span>
                </div>

                <p className="text-base text-[#1E293B] leading-relaxed whitespace-pre-line">
                  {rec.contenido}
                </p>

                {rec.fuente && (
                  <p className="text-xs sm:text-sm text-[#475569] font-mono pt-2 border-t border-slate-200/70">
                    Fuente de referencia: {rec.fuente}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
