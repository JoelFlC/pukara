import React from 'react';

/**
 * Componente AvisoPermanente
 * Renderiza de forma obligatoria y permanente el texto legal e informativo canónico
 * definido en la memoria arquitectónica de PUKARA (GEMINI.md) con diseño discreto y legible.
 */
export default function AvisoPermanente() {
  return (
    <aside
      data-testid="aviso-permanente"
      aria-label="Aviso legal permanente"
      className="rounded-2xl bg-slate-100/90 border border-slate-200/80 px-4 py-3.5 sm:px-6 sm:py-4 text-xs sm:text-sm text-[#464555] flex items-start gap-3"
    >
      <span
        className="w-7 h-7 rounded-full bg-white text-[#3525CD] border border-slate-200/80 flex items-center justify-center shrink-0 text-sm font-bold select-none mt-0.5"
        aria-hidden="true"
      >
        ℹ️
      </span>
      <div className="space-y-0.5 min-w-0 flex-1">
        <p className="font-bold uppercase tracking-wider text-[#111C2D] text-[11px] sm:text-xs">
          Aviso Permanente Institucional
        </p>
        <p className="text-xs sm:text-sm text-[#464555] leading-relaxed">
          Los niveles Normal, Precaución, Alerta y Emergencia son niveles informativos de lluvia: niveles meteorológicos simulados, calculados con umbrales académicos. No sustituyen alertas ni instrucciones de las autoridades oficiales. PUKARA muestra información bajo consulta y no avisa activamente a la población. Ante una emergencia, atienda las indicaciones oficiales y contacte a los servicios de emergencia.
        </p>
      </div>
    </aside>
  );
}
