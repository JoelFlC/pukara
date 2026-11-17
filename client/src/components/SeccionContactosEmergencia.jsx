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

const TEMAS_TARJETA_CONTACTO = [
  'bg-[#DC2626] hover:bg-[#B91C1C] shadow-[0_14px_28px_-6px_rgba(220,38,38,0.35)]',
  'bg-[#3525CD] hover:bg-[#4F46E5] shadow-[0_14px_28px_-6px_rgba(53,37,205,0.35)]',
  'bg-[#059669] hover:bg-[#047857] shadow-[0_14px_28px_-6px_rgba(5,150,105,0.35)]',
  'bg-[#1E293B] hover:bg-[#0F172A] shadow-[0_14px_28px_-6px_rgba(17,28,45,0.35)]',
];

/**
 * Componente SeccionContactosEmergencia (Capítulo 03 — Asistencia Oficial, Módulo 3)
 *
 * Muestra tarjetas sólidas de alto contraste para marcado telefónico en un solo toque,
 * pensadas especialmente para adultos mayores en el sector Llojeta / Cotahuma.
 *
 * @param {Object} props
 * @param {Array<Object>} [props.contactos=[]] Lista de contactos de emergencia activos
 */
export default function SeccionContactosEmergencia({ contactos = [] }) {
  const contactosActivos = (contactos || []).filter((c) => c.activo !== false);

  return (
    <section
      aria-label="Contactos de asistencia y emergencia"
      className="space-y-6 animate-fade-up"
    >
      {/* Encabezado Editorial Suizo directo sobre el lienzo */}
      <header className="space-y-2">
        <span className="swiss-chapter-badge">
          03 CAPÍTULO TRES — ASISTENCIA OFICIAL
        </span>
        <h2 className="headline-lg text-2xl sm:text-4xl font-extrabold text-[#111C2D] leading-tight break-words">
          Teléfonos Rápidos de Emergencia
        </h2>
        <p className="text-base sm:text-lg text-[#464555] leading-relaxed max-w-4xl">
          <strong className="text-[#111C2D]">Contactos de Emergencia — La Paz / Cotahuma</strong> · Llamada directa con un solo toque desde cualquier teléfono celular o fijo.
        </p>
      </header>

      {/* Tarjetas Sólidas de Color para Llamada Directa */}
      {contactosActivos.length === 0 ? (
        <div className="clay-card p-6 text-center text-base text-[#464555]">
          No hay contactos de emergencia registrados en la base de datos en este momento.
        </div>
      ) : (
        <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {contactosActivos.map((contacto, idx) => {
            const fechaTxt = formatearFechaVerificacion(contacto.verificado_en);
            const tieneFecha = Boolean(contacto.verificado_en);
            const temaColor = TEMAS_TARJETA_CONTACTO[idx % TEMAS_TARJETA_CONTACTO.length];

            return (
              <li
                key={contacto.id}
                className={`rounded-3xl p-6 text-white flex flex-col justify-between gap-5 transition-all clay-interactive ${temaColor}`}
              >
                <div className="space-y-3 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className="w-11 h-11 rounded-2xl bg-white/20 flex items-center justify-center text-xl shrink-0"
                      aria-hidden="true"
                    >
                      📞
                    </span>
                    <span className="bg-white/20 text-white px-3 py-1 rounded-full text-[11px] font-extrabold uppercase tracking-wider">
                      LLAMADA DIRECTA 24/7
                    </span>
                  </div>

                  <div>
                    <p className="telemetry-num text-4xl sm:text-5xl font-extrabold tracking-tight text-white tabular-nums">
                      {contacto.telefono}
                    </p>
                    <h3 className="headline-sm font-bold text-white text-lg sm:text-xl leading-snug mt-1 break-words">
                      {contacto.nombre}
                    </h3>
                  </div>

                  <div className="text-xs sm:text-sm text-white/85 space-y-0.5">
                    <p className="break-words">
                      Fuente: {contacto.fuente || 'Institucional'}
                    </p>
                    <p className="font-mono text-xs text-white/80">
                      {tieneFecha ? `Verificado el: ${fechaTxt}` : fechaTxt}
                    </p>
                  </div>
                </div>

                <a
                  href={`tel:${contacto.telefono}`}
                  className="min-h-[54px] w-full rounded-2xl bg-white/15 hover:bg-white/25 border border-white/25 px-4 py-3 text-base font-bold text-white inline-flex items-center justify-between gap-2 transition-colors"
                  title={`Llamar a ${contacto.nombre} (${contacto.telefono})`}
                >
                  <span>Toca para llamar ahora</span>
                  <span aria-hidden="true">→</span>
                </a>
              </li>
            );
          })}
        </ul>
      )}

      {/* Advertencia institucional obligatoria */}
      <div className="rounded-2xl bg-[#FEE2E2] border border-[#FECACA] px-5 py-4 text-base text-[#991B1B] font-medium flex items-start gap-3">
        <span className="text-xl select-none shrink-0 mt-0.5" aria-hidden="true">
          🚨
        </span>
        <p className="leading-relaxed">
          <strong>Aviso a la población:</strong> Ante una emergencia real en el sector Llojeta / Bajo Llojeta, comuníquese directamente con los servicios oficiales de emergencia.
        </p>
      </div>
    </section>
  );
}
