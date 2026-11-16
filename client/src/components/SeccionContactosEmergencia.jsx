import React from 'react';

/**
 * Formatea una fecha de verificación a formato legible local.
 *
 * @param {string|Date|null} fecha
 * @returns {string}
 */
function formatearFechaVerificacion(fecha) {
  if (!fecha) return 'Verificación documental pendiente con fuente oficial';
  try {
    const d = new Date(fecha);
    if (isNaN(d.getTime())) {
      return 'Verificación documental pendiente con fuente oficial';
    }
    return d.toLocaleDateString('es-BO', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return 'Verificación documental pendiente con fuente oficial';
  }
}

/**
 * Componente SeccionContactosEmergencia (Capítulo 03 — Asistencia Oficial, Módulo 3)
 *
 * Muestra los teléfonos de asistencia inmediata y servicios de auxilio de La Paz / Cotahuma / Llojeta,
 * con trazabilidad de verificación oficial y enlaces táctiles de ancho completo (54px+) para marcado telefónico.
 *
 * @param {Object} props
 * @param {Array<Object>} [props.contactos=[]] Lista de contactos de emergencia activos
 */
export default function SeccionContactosEmergencia({ contactos = [] }) {
  const contactosActivos = (contactos || []).filter((c) => c.activo !== false);

  return (
    <section
      aria-label="Contactos de asistencia y emergencia"
      className="clay-card p-5 sm:p-7 space-y-5 animate-fade-up"
    >
      <header className="space-y-2 border-b border-slate-100 pb-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="swiss-chapter-badge">
            03 CAPÍTULO TRES — ASISTENCIA OFICIAL
          </span>
          <span className="clay-pill px-3 py-1 text-xs font-bold bg-[#FEE2E2] text-[#991B1B] border border-[#FECACA]">
            Llamada Directa 24/7
          </span>
        </div>
        <h2 className="headline-lg text-2xl sm:text-3xl lg:text-4xl font-bold text-[#111C2D] leading-snug break-words">
          Contactos de Emergencia — La Paz / Cotahuma
        </h2>
        <p className="text-base text-[#464555] leading-relaxed">
          Líneas telefónicas de asistencia directa para el sector Llojeta / Bajo Llojeta.
        </p>
      </header>

      {/* Advertencia institucional destacada */}
      <div className="clay-card-sm border border-[#FECACA] bg-[#FEE2E2] p-4 text-base text-[#991B1B] font-medium flex items-start gap-3">
        <span className="text-xl select-none shrink-0 mt-0.5" aria-hidden="true">
          🚨
        </span>
        <p className="leading-relaxed">
          <strong>Aviso a la población:</strong> Ante una emergencia real en el sector Llojeta / Bajo Llojeta, comuníquese directamente con los servicios oficiales de emergencia.
        </p>
      </div>

      {contactosActivos.length === 0 ? (
        <div className="clay-card-sm bg-[#F9F9FF] p-5 text-center text-base text-[#464555]">
          No hay contactos de emergencia registrados en la base de datos en este momento.
        </div>
      ) : (
        <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {contactosActivos.map((contacto) => {
            const fechaTxt = formatearFechaVerificacion(contacto.verificado_en);
            const tieneFecha = Boolean(contacto.verificado_en);

            return (
              <li
                key={contacto.id}
                className="clay-card-sm clay-interactive bg-[#F9F9FF] p-4 sm:p-5 flex flex-col justify-between gap-4"
              >
                <div className="space-y-1.5 min-w-0">
                  <h3 className="headline-sm font-bold text-[#111C2D] text-base sm:text-lg leading-snug break-words">
                    {contacto.nombre}
                  </h3>
                  <p className="text-sm text-[#464555] break-words">
                    Fuente:{' '}
                    <span className="font-mono text-[#1E293B]">
                      {contacto.fuente || 'Institucional'}
                    </span>
                  </p>
                  <p className="text-xs sm:text-sm text-[#475569] font-mono">
                    {tieneFecha ? `Verificado el: ${fechaTxt}` : fechaTxt}
                  </p>
                </div>

                <a
                  href={`tel:${contacto.telefono}`}
                  className="clay-btn-danger clay-interactive w-full min-h-[54px] px-4 py-3 text-white inline-flex items-center justify-center gap-2.5"
                  title={`Llamar a ${contacto.nombre} (${contacto.telefono})`}
                >
                  <span className="text-lg" aria-hidden="true">📞</span>
                  <span className="telemetry-num text-xl sm:text-2xl font-extrabold tabular-nums">
                    {contacto.telefono}
                  </span>
                </a>
              </li>
            );
          })}
        </ul>
      )}

      <footer className="pt-3 border-t border-slate-100 text-xs sm:text-sm text-[#475569] text-center font-mono">
        PUKARA · Datos de referencia institucional no comercial
      </footer>
    </section>
  );
}
