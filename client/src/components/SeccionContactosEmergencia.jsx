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
 * Componente SeccionContactosEmergencia (Módulo 3)
 *
 * Muestra los teléfonos de asistencia inmediata y servicios de auxilio de La Paz / Cotahuma / Llojeta,
 * con trazabilidad de verificación oficial y enlaces táctiles para marcado telefónico.
 *
 * @param {Object} props
 * @param {Array<Object>} [props.contactos=[]] Lista de contactos de emergencia activos
 */
export default function SeccionContactosEmergencia({ contactos = [] }) {
  const contactosActivos = (contactos || []).filter((c) => c.activo !== false);

  return (
    <section
      aria-label="Contactos de asistencia y emergencia"
      className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-sm space-y-4"
    >
      <header className="space-y-1.5 border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2">
          <span className="text-base" aria-hidden="true">
            📞
          </span>
          <span className="text-[10px] font-bold tracking-wider text-slate-500 uppercase">
            Módulo 3 · Servicios de Auxilio Ciudadano
          </span>
        </div>
        <h2 className="text-base font-bold text-slate-900 leading-snug">
          Contactos de Emergencia — La Paz / Cotahuma
        </h2>
        <p className="text-xs text-slate-500 leading-relaxed">
          Líneas telefónicas de asistencia directa para el sector Llojeta / Bajo Llojeta.
        </p>
      </header>

      {/* Advertencia institucional destacada */}
      <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-950 font-medium flex items-start gap-2 shadow-xs">
        <span className="text-base select-none shrink-0" aria-hidden="true">
          🚨
        </span>
        <p className="leading-relaxed">
          <strong>Aviso a la población:</strong> Ante una emergencia real en el sector Llojeta / Bajo Llojeta, comuníquese directamente con los servicios oficiales de emergencia.
        </p>
      </div>

      {contactosActivos.length === 0 ? (
        <div className="rounded-xl bg-slate-50 border border-slate-200 p-4 text-center text-xs text-slate-500">
          No hay contactos de emergencia registrados en la base de datos en este momento.
        </div>
      ) : (
        <ul className="divide-y divide-slate-100 text-xs">
          {contactosActivos.map((contacto) => {
            const fechaTxt = formatearFechaVerificacion(contacto.verificado_en);
            const tieneFecha = Boolean(contacto.verificado_en);

            return (
              <li
                key={contacto.id}
                className="py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 first:pt-1 last:pb-1"
              >
                <div className="space-y-0.5">
                  <h3 className="font-bold text-slate-900 text-sm">
                    {contacto.nombre}
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Fuente: <span className="font-mono text-slate-600">{contacto.fuente || 'Institucional'}</span>
                  </p>
                  <p className="text-[10px] text-slate-400 font-mono">
                    {tieneFecha ? `Verificado el: ${fechaTxt}` : fechaTxt}
                  </p>
                </div>

                <a
                  href={`tel:${contacto.telefono}`}
                  className="min-h-[44px] min-w-[44px] px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 active:bg-slate-950 text-white font-mono font-bold text-xs inline-flex items-center justify-center gap-2 transition-colors shadow-xs shrink-0 self-start sm:self-center"
                  title={`Llamar a ${contacto.nombre} (${contacto.telefono})`}
                >
                  <span aria-hidden="true">📞</span>
                  <span>{contacto.telefono}</span>
                </a>
              </li>
            );
          })}
        </ul>
      )}

      <footer className="pt-2 border-t border-slate-100 text-[10px] text-slate-400 text-center font-mono">
        PUKARA · Datos de referencia institucional no comercial
      </footer>
    </section>
  );
}

