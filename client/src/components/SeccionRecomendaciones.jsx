import React, { useState } from 'react';

const NIVELES_ORDEN = ['NORMAL', 'PRECAUCION', 'ALERTA', 'EMERGENCIA'];

const COLORES_NIVEL = {
  NORMAL: {
    bg: 'bg-emerald-50',
    border: 'border-emerald-300',
    text: 'text-emerald-900',
    badge: 'bg-emerald-100 text-emerald-800 border-emerald-300',
    icono: '🟢',
  },
  PRECAUCION: {
    bg: 'bg-amber-50',
    border: 'border-amber-300',
    text: 'text-amber-900',
    badge: 'bg-amber-100 text-amber-800 border-amber-300',
    icono: '🟡',
  },
  ALERTA: {
    bg: 'bg-orange-50',
    border: 'border-orange-300',
    text: 'text-orange-900',
    badge: 'bg-orange-100 text-orange-800 border-orange-300',
    icono: '🟠',
  },
  EMERGENCIA: {
    bg: 'bg-red-50',
    border: 'border-red-300',
    text: 'text-red-900',
    badge: 'bg-red-100 text-red-800 border-red-300',
    icono: '🔴',
  },
};

/**
 * Componente SeccionRecomendaciones (Módulo 3 y Requisito P06)
 *
 * Presenta las recomendaciones preventivas generales priorizando el nivel vigente,
 * con trazabilidad del origen institucional o de demostración y desglose de los 4 niveles.
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
  const [mostrarTodos, setMostrarTodos] = useState(false);

  const nivelEfectivo = nivelVigente || 'NORMAL';
  const esDatosDesactualizados = estadoSistema === 'DATOS_DESACTUALIZADOS';

  // Buscar recomendación vigente en el arreglo si no se pasó directamente
  const recomActual =
    recomendacionVigente ||
    recomendacionesPublicadas.find((r) => r.nivel === nivelEfectivo) ||
    null;

  // Filtrar las recomendaciones de los otros niveles para la vista desplegable
  const otrasRecomendaciones = recomendacionesPublicadas.filter(
    (r) => r.nivel !== nivelEfectivo
  );

  const renderBadgeOrigen = (origen) => {
    if (origen === 'institucional_verificada') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-200">
          <span>🏛️</span>
          <span>Origen: Institucional verificada</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
        <span>🧪</span>
        <span>Origen: Demostración (contenido académico)</span>
      </span>
    );
  };

  const estiloActual = COLORES_NIVEL[nivelEfectivo] || COLORES_NIVEL.NORMAL;

  return (
    <section
      aria-label="Recomendaciones preventivas generales"
      className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-sm space-y-4"
    >
      <header className="space-y-1.5 border-b border-slate-100 pb-3">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[10px] font-bold tracking-wider text-slate-500 uppercase">
            Módulo 3 · Medidas de Prevención
          </span>
          <span
            className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${estiloActual.badge}`}
          >
            {esDatosDesactualizados
              ? `Último nivel: ${nivelEfectivo}`
              : `Nivel vigente: ${nivelEfectivo}`}
          </span>
        </div>
        <h2 className="text-base font-bold text-slate-900 leading-snug">
          Recomendaciones Preventivas para {nivelEfectivo}
        </h2>
        {esDatosDesactualizados && (
          <p className="text-xs text-amber-800 bg-amber-50 p-2 rounded-lg border border-amber-200">
            ⚠️ Información basada en el último nivel informativo conocido ante antigüedad de lecturas superior a T_max.
          </p>
        )}
      </header>

      {/* 1. Recomendación destacada para el nivel vigente actual */}
      {recomActual ? (
        <article
          className={`rounded-2xl border-2 ${estiloActual.border} ${estiloActual.bg} p-4 space-y-2.5 shadow-xs`}
        >
          <div className="flex flex-wrap items-start justify-between gap-2">
            <h3 className="text-sm font-extrabold text-slate-900 leading-snug">
              {recomActual.titulo}
            </h3>
            {renderBadgeOrigen(recomActual.origen)}
          </div>

          <p className="text-xs text-slate-800 leading-relaxed font-medium">
            {recomActual.contenido}
          </p>

          <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] text-slate-500 font-mono pt-2 border-t border-slate-200/60">
            <span>Versión: v{recomActual.version || 1}</span>
            {recomActual.fuente && (
              <span>Fuente: {recomActual.fuente}</span>
            )}
          </div>
        </article>
      ) : (
        <div className="rounded-xl bg-slate-50 border border-slate-200 p-4 text-center text-xs text-slate-500">
          No hay una recomendación vigente registrada para este nivel en este momento.
        </div>
      )}

      {/* 2. Acordeón / Despliegue para consultar los otros niveles */}
      <div className="pt-1">
        <button
          type="button"
          onClick={() => setMostrarTodos(!mostrarTodos)}
          className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-xs font-semibold text-slate-700 transition-colors flex items-center justify-between gap-2"
        >
          <span>
            {mostrarTodos
              ? 'Ocultar recomendaciones de otros niveles'
              : 'Consultar recomendaciones generales de los cuatro niveles (NORMAL, PRECAUCIÓN, ALERTA, EMERGENCIA)'}
          </span>
          <span aria-hidden="true">{mostrarTodos ? '▲' : '▼'}</span>
        </button>

        {mostrarTodos && (
          <div className="mt-3 space-y-3 pt-2 border-t border-slate-100">
            {NIVELES_ORDEN.map((nivel) => {
              const recNivel = recomendacionesPublicadas.find(
                (r) => r.nivel === nivel
              );
              if (!recNivel) return null;
              const est = COLORES_NIVEL[nivel] || COLORES_NIVEL.NORMAL;
              const esVigente = nivel === nivelEfectivo;

              return (
                <div
                  key={nivel}
                  className={`rounded-xl border ${est.border} ${est.bg} p-3.5 space-y-2 text-xs`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 font-bold text-slate-900">
                      <span>{est.icono}</span>
                      <span>Nivel {nivel}</span>
                      {esVigente && (
                        <span className="text-[10px] bg-slate-900 text-white px-2 py-0.5 rounded font-mono">
                          (Vigente)
                        </span>
                      )}
                    </div>
                    {renderBadgeOrigen(recNivel.origen)}
                  </div>
                  <h4 className="font-bold text-slate-800">{recNivel.titulo}</h4>
                  <p className="text-slate-700 leading-relaxed">
                    {recNivel.contenido}
                  </p>
                  {recNivel.fuente && (
                    <p className="text-[10px] text-slate-400 font-mono pt-1 border-t border-slate-200/50">
                      Fuente: {recNivel.fuente} · Versión: v{recNivel.version || 1}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Recordatorio legal obligatorio del Módulo 3 */}
      <footer className="rounded-xl bg-slate-50 p-3 text-[11px] text-slate-500 border border-slate-200/70 leading-relaxed">
        <strong>Aviso preventivo:</strong> Recomendaciones preventivas generales de carácter informativo. El sistema no emite instrucciones de desplazamiento ni sustituye a las autoridades competentes.
      </footer>
    </section>
  );
}

