import React from 'react';

/**
 * Componente ResumenZonaPiloto
 * Muestra los metadatos espaciales del sector piloto Llojeta y un listado compacto
 * de puntos de referencia cartográfica de orientación urbana.
 *
 * REGLAS SEMÁNTICAS ESTRICTAS:
 * - NO contiene botones de "Cómo llegar" ni enlaces a Google Maps/Waze.
 * - Todos los puntos se rotulan como "referencia de demostración, no validada".
 */
export default function ResumenZonaPiloto({ zonaPiloto, capasReferencia }) {
  const puntos = capasReferencia?.puntos || [];
  const zonas = capasReferencia?.zonas || [];

  return (
    <section
      aria-label="Zona piloto y referencias cartográficas"
      className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4"
    >
      {/* 1. Encabezado de la Zona Piloto */}
      <div className="space-y-1.5 border-b border-slate-100 pb-3">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
            Ámbito Espacial de Consulta
          </span>
          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            Sector Piloto Activo
          </span>
        </div>
        <h2 className="text-base font-bold text-slate-900 leading-snug">
          {zonaPiloto?.nombre ||
            'Sector Llojeta / Bajo Llojeta (Macrodistrito Cotahuma, La Paz)'}
        </h2>
        <p className="text-xs text-slate-500 font-mono">
          Coordenada central de consulta: Lat {zonaPiloto?.latitud_central ?? -16.5235}, Lon{' '}
          {zonaPiloto?.longitud_central ?? -68.1425}
        </p>
        <p className="text-xs text-slate-600 leading-relaxed pt-1">
          {zonaPiloto?.nota_alcance ||
            'El nivel informativo se calcula con una sola consulta para toda la zona piloto y no varía espacialmente.'}
        </p>
      </div>

      {/* 2. Zonas de delimitación referencial */}
      {zonas.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
            Polígonos Delimitados en Cuenca ({zonas.length})
          </h3>
          <ul className="space-y-1.5">
            {zonas.map((z) => (
              <li
                key={z.id}
                className="text-xs p-2.5 rounded-lg bg-slate-50 border border-slate-100 flex flex-col gap-0.5"
              >
                <span className="font-semibold text-slate-800">{z.nombre}</span>
                <span className="text-[11px] text-amber-800 italic">
                  {z.advertencia || 'referencia de demostración, no validada'}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* 3. Puntos de Referencia Cartográfica para Orientación */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
            Puntos Referenciales de Orientación Urbana ({puntos.length})
          </h3>
          <span className="text-[10px] text-amber-800 font-medium bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
            {capasReferencia?.leyenda_obligatoria || 'referencia de demostración, no validada'}
          </span>
        </div>

        {puntos.length === 0 ? (
          <p className="text-xs text-slate-400 italic">
            No se han cargado puntos de referencia aún.
          </p>
        ) : (
          <ul className="divide-y divide-slate-100 text-xs">
            {puntos.map((p) => (
              <li key={p.id} className="py-2 flex items-start justify-between gap-2">
                <div className="space-y-0.5">
                  <p className="font-medium text-slate-800">{p.nombre}</p>
                  <p className="text-[11px] text-slate-400 font-mono">
                    Lat {p.latitud.toFixed(4)}, Lon {p.longitud.toFixed(4)}
                  </p>
                </div>
                <span className="shrink-0 text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-mono">
                  {p.tipo || 'referencia'}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <footer className="pt-2 text-[11px] text-slate-400 border-t border-slate-100">
        Los puntos y polígonos son hitos urbanos de referencia cartográfica; no implican vías seguras ni sustituyen las instrucciones de las autoridades oficiales.
      </footer>
    </section>
  );
}
