import React from 'react';

/**
 * Componente ResumenZonaPiloto
 * Muestra los metadatos espaciales del sector piloto Llojeta y un listado compacto
 * de puntos de referencia cartográfica de orientación urbana.
 *
 * REGLAS SEMÁNTICAS ESTRICTAS:
 * - Prohibición estricta de botones de navegación asistida ni enlaces externos a servicios cartográficos.
 * - Todos los puntos se rotulan como "referencia de demostración, no validada".
 */
export default function ResumenZonaPiloto({ zonaPiloto, capasReferencia }) {
  const puntos = capasReferencia?.puntos || [];
  const zonas = capasReferencia?.zonas || [];

  return (
    <section
      aria-label="Zona piloto y referencias cartográficas"
      className="clay-card p-5 sm:p-6 space-y-5 animate-fade-up"
    >
      {/* 1. Encabezado de la Zona Piloto */}
      <div className="space-y-2 border-b border-slate-100 pb-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="swiss-chapter-badge text-[#475569]">
            Ámbito Espacial de Consulta
          </span>
          <span className="clay-pill px-3 py-1 text-xs font-bold bg-[#ECFDF5] text-[#065F46] border border-[#A7F3D0]">
            Sector Piloto Activo
          </span>
        </div>
        <h2 className="headline-md text-xl sm:text-2xl font-bold text-[#111C2D] leading-snug break-words">
          {zonaPiloto?.nombre ||
            'Sector Llojeta / Bajo Llojeta (Macrodistrito Cotahuma, La Paz)'}
        </h2>
        <p className="text-sm text-[#475569] font-mono break-words">
          Coordenada central de consulta: Lat {zonaPiloto?.latitud_central ?? -16.5235}, Lon{' '}
          {zonaPiloto?.longitud_central ?? -68.1425}
        </p>
        <p className="text-base text-[#464555] leading-relaxed pt-1">
          {zonaPiloto?.nota_alcance ||
            'El nivel informativo se calcula con una sola consulta para toda la zona piloto y no varía espacialmente.'}
        </p>
      </div>

      {/* 2. Zonas de delimitación referencial */}
      {zonas.length > 0 && (
        <div className="space-y-2.5">
          <h3 className="text-sm font-extrabold text-[#111C2D] uppercase tracking-wider">
            Polígonos Delimitados en Cuenca ({zonas.length})
          </h3>
          <ul className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {zonas.map((z) => (
              <li
                key={z.id}
                className="clay-card-sm p-3.5 bg-[#F9F9FF] flex flex-col gap-1"
              >
                <span className="font-bold text-base text-[#111C2D]">{z.nombre}</span>
                <span className="text-xs sm:text-sm text-[#92400E] italic">
                  {z.advertencia || 'referencia de demostración, no validada'}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* 3. Puntos de Referencia Cartográfica para Orientación */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-extrabold text-[#111C2D] uppercase tracking-wider">
            Puntos Referenciales de Orientación Urbana ({puntos.length})
          </h3>
          <span className="clay-pill text-xs text-[#92400E] font-bold bg-[#FEF3C7] px-3 py-1 border border-[#FDE68A]">
            {capasReferencia?.leyenda_obligatoria || 'referencia de demostración, no validada'}
          </span>
        </div>

        {puntos.length === 0 ? (
          <p className="text-base text-[#475569] italic">
            No se han cargado puntos de referencia aún.
          </p>
        ) : (
          <ul className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
            {puntos.map((p) => (
              <li
                key={p.id}
                className="clay-card-sm bg-[#F9F9FF] p-3.5 flex items-start justify-between gap-2.5"
              >
                <div className="space-y-0.5 min-w-0">
                  <p className="font-bold text-base text-[#111C2D] break-words">{p.nombre}</p>
                  <p className="text-xs sm:text-sm text-[#475569] font-mono">
                    Lat {p.latitud.toFixed(4)}, Lon {p.longitud.toFixed(4)}
                  </p>
                </div>
                <span className="clay-pill shrink-0 text-xs px-2.5 py-0.5 bg-white text-[#475569] font-mono border border-slate-200">
                  {p.tipo || 'referencia'}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <footer className="pt-3 text-sm text-[#475569] border-t border-slate-100 leading-relaxed">
        Los puntos y polígonos son hitos urbanos de referencia cartográfica; no sustituyen las instrucciones de las autoridades oficiales.
      </footer>
    </section>
  );
}
