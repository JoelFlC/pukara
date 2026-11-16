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
      className="clay-card border-l-4 border-l-[#3525CD] bg-[#FFFFFF] px-4 py-4 sm:px-6 sm:py-5 text-base text-[#111C2D] flex items-start gap-3.5 animate-fade-up"
    >
      <span
        className="w-9 h-9 rounded-full bg-[#EEF2FF] text-[#3525CD] flex items-center justify-center shrink-0 text-lg font-bold select-none mt-0.5 clay-pill"
        aria-hidden="true"
      >
        ℹ️
      </span>
      <div className="space-y-1 min-w-0 flex-1">
        <p className="swiss-chapter-badge text-[#3525CD]">
          Aviso Permanente Institucional
        </p>
        <p className="text-base text-[#1E293B] leading-relaxed">
          Los niveles Normal, Precaución, Alerta y Emergencia son niveles informativos de lluvia: niveles meteorológicos simulados, calculados con umbrales académicos. No sustituyen alertas ni instrucciones de las autoridades oficiales. PUKARA muestra información bajo consulta y no avisa activamente a la población. Ante una emergencia, atienda las indicaciones oficiales y contacte a los servicios de emergencia.
        </p>
      </div>
    </aside>
  );
}
