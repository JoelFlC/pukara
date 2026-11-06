import React from 'react';

/**
 * Escenarios preconfigurados para demostración académica en vivo.
 * Basados en los umbrales oficiales del motor de reglas de PUKARA.
 */
export const ESCENARIOS_DEMOSTRACION = [
  {
    clave: 'NORMAL',
    etiqueta: 'Simular Normal',
    colorBtn: 'bg-emerald-600 hover:bg-emerald-700 text-white',
    payload: {
      intensidad_mm_h: 0.2,
      acum_24h_mm: 1.5,
      acum_72h_mm: 4.0,
      horas_validas_24h: 24,
      horas_validas_72h: 72,
      temperatura: 14.0,
      humedad: 60,
      viento: 5.0,
    },
  },
  {
    clave: 'PRECAUCION',
    etiqueta: 'Simular Precaución',
    colorBtn: 'bg-amber-600 hover:bg-amber-700 text-white',
    payload: {
      intensidad_mm_h: 3.0, // >= 2.5
      acum_24h_mm: 12.0, // >= 10.0
      acum_72h_mm: 18.0,
      horas_validas_24h: 24,
      horas_validas_72h: 72,
      temperatura: 11.0,
      humedad: 75,
      viento: 8.5,
    },
  },
  {
    clave: 'ALERTA',
    etiqueta: 'Simular Alerta',
    colorBtn: 'bg-orange-600 hover:bg-orange-700 text-white',
    payload: {
      intensidad_mm_h: 8.0, // >= 6.5
      acum_24h_mm: 30.0, // >= 25.0
      acum_72h_mm: 65.0, // >= 60.0 (activa además regla de saturación)
      horas_validas_24h: 24,
      horas_validas_72h: 72,
      temperatura: 9.0,
      humedad: 88,
      viento: 14.0,
    },
  },
  {
    clave: 'EMERGENCIA',
    etiqueta: 'Simular Emergencia',
    colorBtn: 'bg-red-600 hover:bg-red-700 text-white',
    payload: {
      intensidad_mm_h: 15.0, // >= 12.0
      acum_24h_mm: 50.0, // >= 40.0
      acum_72h_mm: 100.0, // >= 90.0
      horas_validas_24h: 24,
      horas_validas_72h: 72,
      temperatura: 7.5,
      humedad: 95,
      viento: 22.0,
    },
  },
];

/**
 * Componente BannerModoSimulacion
 * Controla el selector de modalidad ('real' vs 'simulada'), el banner de advertencia
 * de alto contraste y los disparadores de escenarios de simulación aislados (Prueba P11).
 *
 * @param {Object} props
 * @param {string} props.modalidad 'real' o 'simulada'
 * @param {boolean} [props.esSimulacion]
 * @param {Function} props.alCambiarModalidad Callback para conmutar modalidad
 * @param {Function} props.alInyectarEscenario Callback para enviar lectura simulada
 * @param {Function} props.alLimpiarSimulacion Callback para DELETE /api/simulacion
 * @param {boolean} [props.cargando=false]
 */
export default function BannerModoSimulacion({
  modalidad,
  esSimulacion = modalidad === 'simulada',
  alCambiarModalidad,
  alInyectarEscenario,
  alLimpiarSimulacion,
  cargando = false,
}) {
  return (
    <section
      aria-label="Selector de modalidad y control de simulación"
      className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm space-y-3"
    >
      {/* 1. Selector de Modalidad */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        <div>
          <span className="text-[10px] font-bold tracking-wider text-slate-500 uppercase">
            Modo de consulta
          </span>
          <p className="text-xs text-slate-600">
            {esSimulacion
              ? 'Visualizando datos académicos simulados aislados'
              : 'Visualizando lecturas reales de modelo meteorológico'}
          </p>
        </div>

        {/* Conmutador Accesible */}
        <div
          role="group"
          aria-label="Modo de consulta: Datos Reales (Open-Meteo) | Modo Simulación (Demostración)"
          className="inline-flex rounded-xl bg-slate-100 p-1 border border-slate-200 self-start sm:self-auto"
        >
          <button
            type="button"
            onClick={() => alCambiarModalidad('real')}
            disabled={cargando}
            aria-pressed={modalidad === 'real'}
            className={`min-h-[38px] px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              modalidad === 'real'
                ? 'bg-white text-slate-900 shadow-xs border border-slate-200/80'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Datos Reales (Open-Meteo)
          </button>
          <button
            type="button"
            onClick={() => alCambiarModalidad('simulada')}
            disabled={cargando}
            aria-pressed={modalidad === 'simulada'}
            className={`min-h-[38px] px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              modalidad === 'simulada'
                ? 'bg-purple-700 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Modo Simulación (Demostración)
          </button>
        </div>
      </div>

      {/* 2. Banner de Alto Contraste en Modo Simulación (P11) */}
      {esSimulacion && (
        <div
          role="region"
          aria-label="Aviso de modo simulación activa"
          className="rounded-xl border-2 border-purple-600 bg-purple-900 text-purple-50 p-4 space-y-3 shadow-sm animate-in fade-in duration-200"
        >
          <div className="flex items-start gap-2.5">
            <span className="text-lg select-none" aria-hidden="true">
              🧪
            </span>
            <div className="space-y-1">
              <p className="font-extrabold text-xs tracking-wider uppercase text-purple-200">
                Aislamiento de Simulación (Regla P11)
              </p>
              <p className="text-xs font-semibold leading-relaxed text-white">
                MODO SIMULACIÓN ACADÉMICA ACTIVO — Los datos y el nivel mostrados son simulados para demostración y NO alteran el estado meteorológico real.
              </p>
            </div>
          </div>

          {/* 3. Botones rápidos de demostración para los 4 escenarios y limpieza */}
          <div className="pt-1 border-t border-purple-700/60 space-y-2">
            <p className="text-[11px] font-medium text-purple-200">
              Inyectar escenario académico de prueba:
            </p>
            <div className="flex flex-wrap gap-2">
              {ESCENARIOS_DEMOSTRACION.map((esc) => (
                <button
                  key={esc.clave}
                  type="button"
                  onClick={() => alInyectarEscenario(esc.payload)}
                  disabled={cargando}
                  className={`min-h-[44px] px-3 py-2 rounded-xl text-xs font-semibold transition-all shadow-xs disabled:opacity-50 ${esc.colorBtn}`}
                >
                  {esc.etiqueta}
                </button>
              ))}
              <button
                type="button"
                onClick={alLimpiarSimulacion}
                disabled={cargando}
                className="min-h-[44px] px-3 py-2 rounded-xl text-xs font-semibold bg-purple-950 hover:bg-black text-purple-200 border border-purple-500/50 transition-all shadow-xs disabled:opacity-50"
              >
                Limpiar Simulación
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
