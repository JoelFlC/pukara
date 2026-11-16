import React from 'react';
import {
  formatearFechaHoraLaPaz,
} from '../utils/formatoTiempo';

const BADGES_NIVEL = {
  NORMAL: 'bg-[#ECFDF5] text-[#065F46] border-[#A7F3D0]',
  PRECAUCION: 'bg-[#FEF3C7] text-[#92400E] border-[#FDE68A]',
  ALERTA: 'bg-[#FFEDD5] text-[#9A3412] border-[#FED7AA]',
  EMERGENCIA: 'bg-[#FEE2E2] text-[#991B1B] border-[#FECACA]',
};

/**
 * Componente HistorialEvaluaciones
 * Despliega la traza histórica reciente de evaluaciones emitidas por el motor de reglas
 * (GET /api/historial) para la modalidad seleccionada.
 *
 * @param {Object} props
 * @param {Array<Object>} [props.items=[]] Lista de evaluaciones históricas
 * @param {number} [props.total=0] Total en base de datos
 * @param {string} [props.modalidad='real'] 'real' o 'simulada'
 * @param {Function} [props.alRecargar] Callback para actualizar el historial
 * @param {boolean} [props.cargando=false]
 */
export default function HistorialEvaluaciones({
  items = [],
  total = 0,
  modalidad = 'real',
  alRecargar,
  cargando = false,
}) {
  return (
    <section
      aria-label="Historial de evaluaciones del motor de reglas"
      className="clay-card p-5 sm:p-6 space-y-4 animate-fade-up"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
        <div className="space-y-1">
          <span className="swiss-chapter-badge text-[#475569]">
            Auditoría de Evaluaciones (GET /api/historial)
          </span>
          <h2 className="headline-md text-xl sm:text-2xl font-bold text-[#111C2D] leading-snug">
            Historial Reciente ({modalidad === 'simulada' ? 'Simulación' : 'Real'})
          </h2>
          <p className="text-base text-[#464555]">
            Registro cronológico inmutable de clasificaciones del motor e histéresis.
          </p>
        </div>

        {alRecargar && (
          <button
            type="button"
            onClick={alRecargar}
            disabled={cargando}
            aria-label="Recargar historial"
            className="clay-btn-secondary clay-interactive min-h-[48px] px-4 py-2 text-sm font-bold inline-flex items-center justify-center gap-2 self-start sm:self-auto disabled:opacity-50 cursor-pointer"
          >
            <span className={cargando ? 'animate-spin inline-block' : ''} aria-hidden="true">
              🔄
            </span>
            <span>{cargando ? 'Cargando...' : 'Actualizar'}</span>
          </button>
        )}
      </div>

      {(!items || items.length === 0) ? (
        <div className="clay-card-sm bg-[#F9F9FF] p-5 text-center">
          <p className="text-base text-[#464555]">
            No se registran evaluaciones previas en la modalidad {modalidad}.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200/80">
          <table className="w-full text-left text-sm">
            <thead className="bg-[#F0F3FF]">
              <tr className="border-b border-slate-200 text-xs font-extrabold text-[#475569] uppercase tracking-wider">
                <th scope="col" className="py-3 px-3.5">Observado en</th>
                <th scope="col" className="py-3 px-3">Nivel Calculado</th>
                <th scope="col" className="py-3 px-3">Nivel Vigente</th>
                <th scope="col" className="py-3 px-3">Descenso</th>
                <th scope="col" className="py-3 px-3.5 text-right">Versión</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {items.map((it) => {
                const badgeCalculado = BADGES_NIVEL[it.nivel_calculado] || 'bg-slate-100 text-slate-700 border-slate-200';
                const badgeVigente = BADGES_NIVEL[it.nivel_vigente] || 'bg-slate-100 text-slate-700 border-slate-200';

                return (
                  <tr key={it.evaluacion_id} className="hover:bg-[#F9F9FF] transition-colors">
                    <td className="py-3 px-3.5">
                      <p className="font-semibold text-[#111C2D] whitespace-nowrap">
                        {formatearFechaHoraLaPaz(it.observado_en)}
                      </p>
                      {it.variables?.intensidad_mm_h !== null && (
                        <p className="text-xs text-[#475569] font-mono">
                          {it.variables?.intensidad_mm_h} mm/h · 24h: {it.variables?.acum_24h_mm ?? 'inc'} mm
                        </p>
                      )}
                    </td>
                    <td className="py-3 px-3 whitespace-nowrap">
                      <span className={`clay-pill inline-block px-2.5 py-0.5 text-xs font-bold border ${badgeCalculado}`}>
                        {it.nivel_calculado}
                      </span>
                    </td>
                    <td className="py-3 px-3 whitespace-nowrap">
                      <span className={`clay-pill inline-block px-2.5 py-0.5 text-xs font-bold border ${badgeVigente}`}>
                        {it.nivel_vigente}
                      </span>
                    </td>
                    <td className="py-3 px-3 whitespace-nowrap font-mono text-sm font-semibold text-[#1E293B]">
                      {it.contador_descenso}/2
                    </td>
                    <td className="py-3 px-3.5 text-right whitespace-nowrap font-mono text-sm text-[#475569]">
                      v{it.version_reglas}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {total > items.length && (
            <p className="text-xs text-[#475569] text-right font-mono p-3 bg-[#F9F9FF] border-t border-slate-100">
              Mostrando las últimas {items.length} de {total} evaluaciones registradas.
            </p>
          )}
        </div>
      )}
    </section>
  );
}
