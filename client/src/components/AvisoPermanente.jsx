import React from 'react';

/**
 * Componente AvisoPermanente
 * Renderiza de forma obligatoria y permanente el texto legal e informativo canónico
 * definido en la memoria arquitectónica de PUKARA (GEMINI.md).
 */
export default function AvisoPermanente() {
  return (
    <aside
      aria-label="Aviso legal permanente"
      className="rounded-lg border border-amber-300 bg-amber-50/90 p-4 text-xs text-amber-950 shadow-sm"
    >
      <div className="flex items-start gap-2.5">
        <span className="text-base select-none" aria-hidden="true">
          ℹ️
        </span>
        <div className="space-y-1 leading-relaxed">
          <p className="font-semibold uppercase tracking-wider text-amber-900 text-[11px]">
            Aviso Permanente Institucional
          </p>
          <p className="text-amber-900/90">
            Los niveles Normal, Precaución, Alerta y Emergencia son niveles informativos de lluvia: niveles meteorológicos simulados, calculados con umbrales académicos. No sustituyen alertas ni instrucciones de las autoridades oficiales. PUKARA muestra información bajo consulta y no avisa activamente a la población. Ante una emergencia, atienda las indicaciones oficiales y contacte a los servicios de emergencia.
          </p>
        </div>
      </div>
    </aside>
  );
}
