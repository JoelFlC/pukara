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
      className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4"
    >
      <div className="space-y-1 border-b border-slate-100 pb-3">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[10px] font-bold tracking-wider text-slate-500 uppercase">
            Medidas Preventivas Generales
          </span>
          <span className="text-[10px] font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
            Nivel: {nivelVigente}
          </span>
        </div>
        <h2 className="text-base font-bold text-slate-900 leading-snug">
          Recomendaciones Preventivas para {nivelVigente}
        </h2>
        <p className="text-xs text-slate-500 leading-relaxed">
          Pautas y consejos generales ante el nivel meteorológico informado. No constituyen instrucciones de evacuación ni reemplazan las indicaciones de las autoridades oficiales.
        </p>
      </div>

      {(!recomendaciones || recomendaciones.length === 0) ? (
        <div className="rounded-xl bg-slate-50 border border-slate-100 p-4 text-center">
          <p className="text-xs text-slate-500">
            No hay recomendaciones específicas publicadas para este nivel informativo en este momento.
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {recomendaciones.map((rec) => {
            const esVerificada = rec.origen === 'institucional_verificada';

            return (
              <li
                key={rec.id}
                className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 space-y-2 text-xs transition-all hover:bg-slate-50"
              >
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-bold text-slate-900 text-sm leading-snug">
                    {rec.titulo}
                  </h3>
                  <span
                    className={`shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded border ${
                      esVerificada
                        ? 'bg-blue-50 text-blue-700 border-blue-200'
                        : 'bg-amber-50 text-amber-800 border-amber-200'
                    }`}
                  >
                    {esVerificada
                      ? 'institucional_verificada'
                      : 'demostracion'}
                  </span>
                </div>

                <p className="text-slate-700 leading-relaxed whitespace-pre-line">
                  {rec.contenido}
                </p>

                {rec.fuente && (
                  <p className="text-[10px] text-slate-400 font-mono pt-1 border-t border-slate-200/50">
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
