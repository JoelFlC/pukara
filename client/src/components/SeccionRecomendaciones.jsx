import React from 'react';

const NIVELES_ORDEN = ['NORMAL', 'PRECAUCION', 'ALERTA', 'EMERGENCIA'];

/**
 * Ilustraciones vectoriales amigables y ligeras para reducir la carga de lectura.
 */
function IlustracionPreventiva({ nivel }) {
  if (nivel === 'NORMAL') {
    return (
      <svg className="w-16 h-16" viewBox="0 0 64 64" fill="none" aria-hidden="true">
        <rect width="64" height="64" rx="20" fill="#ECFDF5" />
        <circle cx="45" cy="19" r="7" fill="#FDE68A" />
        <path d="M16 34L32 20L48 34V49H16V34Z" fill="#D1FAE5" stroke="#059669" strokeWidth="2.5" strokeLinejoin="round" />
        <rect x="27" y="38" width="10" height="11" rx="2" fill="#059669" />
        <path d="M13 35L32 18L51 35" stroke="#065F46" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  if (nivel === 'PRECAUCION') {
    return (
      <svg className="w-16 h-16" viewBox="0 0 64 64" fill="none" aria-hidden="true">
        <rect width="64" height="64" rx="20" fill="#FEF3C7" />
        <path d="M16 33C16 23.6 23.2 17 32 17C40.8 17 48 23.6 48 33H16Z" fill="#FDE68A" stroke="#D97706" strokeWidth="2.5" strokeLinejoin="round" />
        <path d="M32 33V45C32 47.2 30.2 49 28 49C26.3 49 25 47.8 24.7 46.3" stroke="#92400E" strokeWidth="2.5" strokeLinecap="round" />
        <path d="M22 14L20 18M42 14L44 18" stroke="#D97706" strokeWidth="2.2" strokeLinecap="round" />
      </svg>
    );
  }
  if (nivel === 'ALERTA') {
    return (
      <svg className="w-16 h-16" viewBox="0 0 64 64" fill="none" aria-hidden="true">
        <rect width="64" height="64" rx="20" fill="#FFEDD5" />
        <path d="M32 15L50 47H14L32 15Z" fill="#FED7AA" stroke="#EA580C" strokeWidth="2.5" strokeLinejoin="round" />
        <path d="M32 27V36" stroke="#9A3412" strokeWidth="3" strokeLinecap="round" />
        <circle cx="32" cy="41.5" r="1.8" fill="#9A3412" />
      </svg>
    );
  }
  return (
    <svg className="w-16 h-16" viewBox="0 0 64 64" fill="none" aria-hidden="true">
      <rect width="64" height="64" rx="20" fill="#FEE2E2" />
      <path d="M32 14L48 21V33C48 42.5 41.2 50 32 52C22.8 50 16 42.5 16 33V21L32 14Z" fill="#FECACA" stroke="#DC2626" strokeWidth="2.5" strokeLinejoin="round" />
      <path d="M26 28.5C27.5 32.5 31.5 36.5 35.5 38L38.2 35.3C38.7 34.8 39.4 34.7 40 35C41.3 35.5 42.7 35.8 44 35.9C44.6 36 45 36.5 45 37.1V41C45 41.6 44.5 42.1 43.9 42C34 41.3 26.7 34 26 24.1C25.9 23.5 26.4 23 27 23H30.9C31.5 23 32 23.4 32.1 24C32.2 25.3 32.5 26.7 33 28C33.3 28.6 33.1 29.3 32.6 29.8L30 32.4" stroke="#991B1B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const ESTILOS_TARJETA_NIVEL = {
  NORMAL: {
    etiquetaCorta: 'NORMAL',
    accionVisual: 'Revisión de hogar',
    pill: 'bg-[#ECFDF5] text-[#065F46] border-[#A7F3D0]',
    bordeActivo: 'border-[#059669] ring-4 ring-[#ECFDF5]',
  },
  PRECAUCION: {
    etiquetaCorta: 'PRECAUCIÓN',
    accionVisual: 'Limpiar desagües',
    pill: 'bg-[#FEF3C7] text-[#92400E] border-[#FDE68A]',
    bordeActivo: 'border-[#D97706] ring-4 ring-[#FEF3C7]',
  },
  ALERTA: {
    etiquetaCorta: 'ALERTA',
    accionVisual: 'Alejarse de cauces',
    pill: 'bg-[#FFEDD5] text-[#9A3412] border-[#FED7AA]',
    bordeActivo: 'border-[#EA580C] ring-4 ring-[#FFEDD5]',
  },
  EMERGENCIA: {
    etiquetaCorta: 'EMERGENCIA',
    accionVisual: 'Llamar al 114 / 119',
    pill: 'bg-[#FEE2E2] text-[#991B1B] border-[#FECACA]',
    bordeActivo: 'border-[#DC2626] ring-4 ring-[#FEE2E2]',
  },
};

/**
 * Componente SeccionRecomendaciones (Capítulo 01 — Guía Preventiva)
 * Diseño visual simplificado con ilustraciones vectoriales amigables,
 * texto mínimo indispensable y tarjetas comparativas claras para todas las edades.
 *
 * @param {Object} props
 * @param {string} [props.nivelVigente='NORMAL'] Nivel informativo vigente
 * @param {string} [props.estadoSistema='NORMAL'] Estado global del sistema
 * @param {Object|null} [props.recomendacionVigente] Recomendación del nivel vigente
 * @param {Array<Object>} [props.recomendacionesPublicadas] Todas las recomendaciones publicadas
 */
export default function SeccionRecomendaciones({
  nivelVigente = 'NORMAL',
  estadoSistema = 'NORMAL',
  recomendacionVigente = null,
  recomendacionesPublicadas = [],
}) {
  const nivelEfectivo = nivelVigente || 'NORMAL';
  const esDatosDesactualizados = estadoSistema === 'DATOS_DESACTUALIZADOS';

  const renderBadgeOrigen = (origen) => {
    if (origen === 'institucional_verificada') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#EEF2FF] text-[#3525CD]">
          <span aria-hidden="true">🏛️</span>
          <span>Origen: Institucional verificada</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#FEF3C7] text-[#92400E]">
        <span aria-hidden="true">🧪</span>
        <span>Origen: Demostración (contenido académico)</span>
      </span>
    );
  };

  const tarjetas = NIVELES_ORDEN.map((nivel) => {
    const encontrada = recomendacionesPublicadas.find((r) => r.nivel === nivel);
    const rec =
      nivel === nivelEfectivo
        ? recomendacionVigente || encontrada || null
        : encontrada || null;
    return { nivel, rec };
  }).filter((item) => item.rec !== null);

  return (
    <section
      aria-label="Recomendaciones preventivas generales"
      className="space-y-5 animate-fade-up"
    >
      {/* Encabezado ligero y claro */}
      <header className="space-y-1.5">
        <span className="swiss-chapter-badge">
          01 CAPÍTULO UNO — GUÍA PREVENTIVA
        </span>

        <h2 className="headline-lg text-2xl sm:text-4xl font-extrabold text-[#111C2D] leading-tight break-words">
          ¿Qué hacer según el nivel de lluvia?
        </h2>

        <p className="text-base text-[#464555] leading-relaxed">
          Recomendaciones Preventivas para {nivelEfectivo}.
        </p>

        {esDatosDesactualizados && (
          <p className="text-sm sm:text-base text-[#92400E] bg-[#FEF3C7] px-4 py-2.5 rounded-2xl border border-[#FDE68A]">
            ⚠️ Basado en el último nivel informativo conocido (supera T_max).
          </p>
        )}
      </header>

      {/* Grilla Visual de 4 Tarjetas con Ilustración + Texto Esencial */}
      {tarjetas.length === 0 ? (
        <div className="clay-card p-6 text-center text-base text-[#464555]">
          No hay recomendaciones vigentes registradas en este momento.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          {tarjetas.map(({ nivel, rec }) => {
            const est = ESTILOS_TARJETA_NIVEL[nivel] || ESTILOS_TARJETA_NIVEL.NORMAL;
            const esVigente = nivel === nivelEfectivo;

            return (
              <article
                key={nivel}
                className={`clay-card clay-interactive p-5 sm:p-6 flex flex-col justify-between gap-4 border-2 transition-all ${
                  esVigente
                    ? `${est.bordeActivo} shadow-lg`
                    : 'border-slate-200/70'
                }`}
              >
                <div className="space-y-3.5">
                  {/* Ilustración + Badge de Nivel */}
                  <div className="flex items-start justify-between gap-3">
                    <IlustracionPreventiva nivel={nivel} />
                    <div className="flex flex-col items-end gap-1.5">
                      <span
                        className={`clay-pill px-3 py-0.5 text-xs font-extrabold border ${est.pill}`}
                      >
                        {est.etiquetaCorta}
                      </span>
                      {esVigente && (
                        <span className="text-[11px] bg-[#111C2D] text-white px-2.5 py-0.5 rounded-full font-extrabold uppercase tracking-wide">
                          (Vigente)
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Acción clave rápida + Título */}
                  <div className="space-y-1">
                    <span className="text-xs font-extrabold uppercase tracking-wider text-[#3525CD] block">
                      {est.accionVisual}
                    </span>
                    <h3 className="headline-sm text-lg font-extrabold text-[#111C2D] leading-snug">
                      {rec.titulo}
                    </h3>
                  </div>

                  {/* Contenido preventivo esencial */}
                  <p className="text-base text-[#1E293B] leading-relaxed">
                    {rec.contenido}
                  </p>
                </div>

                {/* Pie discreto de trazabilidad */}
                <div className="pt-3 border-t border-slate-100 space-y-1.5">
                  <div>{renderBadgeOrigen(rec.origen)}</div>
                  <p className="text-[11px] text-[#475569] font-mono truncate">
                    Versión: v{rec.version || 1}
                    {rec.fuente ? ` · ${rec.fuente}` : ''}
                  </p>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* Recordatorio legal obligatorio compacto */}
      <footer className="text-xs sm:text-sm text-[#475569] px-1 leading-relaxed">
        ℹ️ Recomendaciones preventivas generales de carácter informativo. El sistema no emite instrucciones de desplazamiento ni sustituye a las autoridades competentes.
      </footer>
    </section>
  );
}
