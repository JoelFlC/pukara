import React from 'react';
import {
  formatearFechaHoraLaPaz,
  formatearAntiguedad,
} from '../utils/formatoTiempo';

const BADGES_NIVEL = {
  NORMAL: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  PRECAUCION: 'bg-amber-100 text-amber-800 border-amber-200',
  ALERTA: 'bg-orange-100 text-orange-800 border-orange-200',
  EMERGENCIA: 'bg-red-100 text-red-800 border-red-200',
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
      className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
        <div>
          <span className="text-[10px] font-bold tracking-wider text-slate-500 uppercase">
            Auditoría de Evaluaciones (GET /api/historial)
          </span>
          <h2 className="text-base font-bold text-slate-900 leading-snug">
            Historial Reciente ({modalidad === 'simulada' ? 'Simulación' : 'Real'})
          </h2>
          <p className="text-xs text-slate-500">
            Registro cronológico inmutable de clasificaciones del motor e histéresis.
          </p>
        </div>

        {alRecargar && (
          <button
            type="button"
            onClick={alRecargar}
            disabled={cargando}
            aria-label="Recargar historial"
            className="min-h-[36px] px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors inline-flex items-center gap-1.5 self-start sm:self-auto disabled:opacity-50"
          >
            <span className={cargando ? 'animate-spin inline-block' : ''} aria-hidden="true">
              🔄
            </span>
            <span>{cargando ? 'Cargando...' : 'Actualizar'}</span>
          </button>
        )}
      </div>

      {(!items || items.length === 0) ? (
        <div className="rounded-xl bg-slate-50 border border-slate-100 p-4 text-center">
          <p className="text-xs text-slate-500">
            No se registran evaluaciones previas en la modalidad {modalidad}.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                <th scope="col" className="pb-2 pr-2">Observado en</th>
                <th scope="col" className="pb-2 px-2">Nivel Calculado</th>
                <th scope="col" className="pb-2 px-2">Nivel Vigente</th>
                <th scope="col" className="pb-2 px-2">Descenso</th>
                <th scope="col" className="pb-2 pl-2 text-right">Versión</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((it) => {
                const badgeCalculado = BADGES_NIVEL[it.nivel_calculado] || 'bg-slate-100 text-slate-700 border-slate-200';
                const badgeVigente = BADGES_NIVEL[it.nivel_vigente] || 'bg-slate-100 text-slate-700 border-slate-200';

                return (
                  <tr key={it.evaluacion_id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-2.5 pr-2">
                      <p className="font-medium text-slate-800 whitespace-nowrap">
                        {formatearFechaHoraLaPaz(it.observado_en)}
                      </p>
                      {it.variables?.intensidad_mm_h !== null && (
                        <p className="text-[10px] text-slate-400 font-mono">
                          {it.variables?.intensidad_mm_h} mm/h · 24h: {it.variables?.acum_24h_mm ?? 'inc'} mm
                        </p>
                      )}
                    </td>
                    <td className="py-2.5 px-2 whitespace-nowrap">
                      <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold border ${badgeCalculado}`}>
                        {it.nivel_calculado}
                      </span>
                    </td>
                    <td className="py-2.5 px-2 whitespace-nowrap">
                      <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold border ${badgeVigente}`}>
                        {it.nivel_vigente}
                      </span>
                    </td>
                    <td className="py-2.5 px-2 whitespace-nowrap font-mono text-[11px] text-slate-600">
                      {it.contador_descenso}/2
                    </td>
                    <td className="py-2.5 pl-2 text-right whitespace-nowrap font-mono text-[11px] text-slate-500">
                      v{it.version_reglas}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {total > items.length && (
            <p className="text-[10px] text-slate-400 text-right font-mono pt-2">
              Mostrando las últimas {items.length} de {total} evaluaciones registradas.
            </p>
          )}
        </div>
      )}
    </section>
  );
}
