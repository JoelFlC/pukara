import React from 'react';

/**
 * Componente AvisoPermanente
 * Renderiza de forma obligatoria y permanente el texto legal e informativo canónico
 * definido en la memoria arquitectónica de PUKARA (GEMINI.md).
 */
export default function AvisoPermanente() {
  return (
    <aside
      data-testid="aviso-permanente"
      aria-label="Aviso legal permanente"
      className="bg-slate-100/90 border border-slate-200 border-l-4 border-l-[#0F172A] rounded-xl px-4 py-3 text-xs md:text-sm text-slate-700 flex items-start gap-3 shadow-2xs"
    >
      <span className="text-base select-none shrink-0 mt-0.5" aria-hidden="true">
        ℹ️
      </span>
      <div className="space-y-0.5 leading-relaxed">
        <p className="font-bold uppercase tracking-wider text-slate-900 text-[10px] md:text-xs">
          Aviso Permanente Institucional
        </p>
        <p className="text-slate-700 leading-snug">
          Los niveles Normal, Precaución, Alerta y Emergencia son niveles informativos de lluvia: niveles meteorológicos simulados, calculados con umbrales académicos. No sustituyen alertas ni instrucciones de las autoridades oficiales. PUKARA muestra información bajo consulta y no avisa activamente a la población. Ante una emergencia, atienda las indicaciones oficiales y contacte a los servicios de emergencia.
        </p>
      </div>
    </aside>
  );
}
