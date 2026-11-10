import React from 'react';

/**
 * Escenarios preconfigurados para demostración académica en vivo.
 * Basados en los umbrales oficiales del motor de reglas de PUKARA (v1).
 */
export const ESCENARIOS_DEMOSTRACION = [
  {
    clave: 'NORMAL',
    etiqueta: 'Simular Normal',
    dotColor: 'bg-emerald-500',
    estiloBtn:
      'bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-200',
    payload: {
      intensidad_mm_h: 0.4,
      acum_24h_mm: 2.0,
      acum_72h_mm: 6.0,
      temperatura: 15.2,
      humedad: 58,
      viento: 8.5,
      horas_validas_24h: 24,
      horas_validas_72h: 72,
      reiniciar_antes: true,
      modo_preset: true,
    },
  },
  {
    clave: 'PRECAUCION',
    etiqueta: 'Simular Precaución',
    dotColor: 'bg-amber-500',
    estiloBtn:
      'bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200',
    payload: {
      intensidad_mm_h: 3.2,
      acum_24h_mm: 14.0,
      acum_72h_mm: 30.0,
      temperatura: 13.0,
      humedad: 74,
      viento: 12.0,
      horas_validas_24h: 24,
      horas_validas_72h: 72,
      reiniciar_antes: true,
      modo_preset: true,
    },
  },
  {
    clave: 'ALERTA',
    etiqueta: 'Simular Alerta',
    dotColor: 'bg-orange-500',
    estiloBtn:
      'bg-orange-50 hover:bg-orange-100 text-orange-900 border border-orange-200',
    payload: {
      intensidad_mm_h: 7.5,
      acum_24h_mm: 28.0,
      acum_72h_mm: 64.0,
      temperatura: 11.2,
      humedad: 86,
      viento: 18.5,
      horas_validas_24h: 24,
      horas_validas_72h: 72,
      reiniciar_antes: true,
      modo_preset: true,
    },
  },
  {
    clave: 'EMERGENCIA',
    etiqueta: 'Simular Emergencia',
    dotColor: 'bg-red-600',
    estiloBtn:
      'bg-red-50 hover:bg-red-100 text-red-900 border border-red-200',
    payload: {
      intensidad_mm_h: 14.5,
      acum_24h_mm: 48.0,
      acum_72h_mm: 98.0,
      temperatura: 9.5,
      humedad: 94,
      viento: 26.0,
      horas_validas_24h: 24,
      horas_validas_72h: 72,
      reiniciar_antes: true,
      modo_preset: true,
    },
  },
];

/**
 * Componente BannerModoSimulacion
 * Controla la demostración de escenarios académicos simulados con aislamiento estricto (Regla P11).
 *
 * @param {Object} props
 * @param {string} props.modalidad 'real' o 'simulada'
 * @param {boolean} [props.esSimulacion]
 * @param {string} [props.nivelActual] Nivel actualmente vigente en modo simulación
 * @param {Function} props.alCambiarModalidad Callback para conmutar modalidad
 * @param {Function} props.alInyectarEscenario Callback para enviar lectura simulada
 * @param {Function} props.alLimpiarSimulacion Callback para DELETE /api/simulacion
 * @param {boolean} [props.cargando=false]
 * @param {boolean} [props.ocultarSelector=false] Ocultar selector redundante en vistas que ya lo tienen
 */
export default function BannerModoSimulacion({
  modalidad,
  esSimulacion = modalidad === 'simulada',
  nivelActual = null,
  alCambiarModalidad,
  alInyectarEscenario,
  alLimpiarSimulacion,
  cargando = false,
  ocultarSelector = false,
}) {
  // Si se solicita ocultar el selector y no estamos en modo simulación, no renderizar nada
  if (ocultarSelector && !esSimulacion) {
    return null;
  }

  return (
    <section
      aria-label="Selector de modalidad y control de simulación"
      className="space-y-4"
    >
      {/* 1. Selector de Modalidad (solo visible si no está oculto por prop) */}
      {!ocultarSelector && (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div>
            <span className="text-[10px] font-bold tracking-wider text-slate-500 uppercase block">
              Modo de consulta
            </span>
            <p className="text-xs text-slate-600">
              {esSimulacion
                ? 'Visualizando datos académicos simulados aislados'
                : 'Visualizando lecturas reales de modelo meteorológico'}
            </p>
          </div>

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
                  ? 'bg-[#0F172A] text-white shadow-xs'
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
                  ? 'bg-slate-800 text-teal-300 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Modo Simulación (Demostración)
            </button>
          </div>
        </div>
      )}

      {/* 2. Banner Bento Institucional en Modo Simulación (P11) */}
      {esSimulacion && (
        <div
          role="region"
          aria-label="Aviso de modo simulación activa"
          className="rounded-2xl border border-slate-200/90 border-l-4 border-l-slate-900 bg-white p-5 shadow-sm space-y-4"
        >
          {/* Encabezado y Aislamiento */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2.5">
              <span className="text-xl select-none" aria-hidden="true">
                🧪
              </span>
              <div>
                <span className="bg-slate-100 text-slate-800 border border-slate-300 font-bold text-[10px] tracking-wider uppercase px-2.5 py-0.5 rounded-full inline-block">
                  MODO DEMOSTRACIÓN ACADÉMICA ACTIVO (REGLA P11)
                </span>
                <p className="text-xs font-medium text-slate-700 leading-snug mt-1">
                  MODO SIMULACIÓN ACADÉMICA ACTIVO — Los datos y el nivel mostrados son simulados para demostración y NO alteran el estado meteorológico real.
                </p>
              </div>
            </div>
          </div>

          {/* Botones de Escenarios Académicos */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                Inyectar escenario académico de prueba:
              </span>
              <span className="text-[10px] text-slate-400">
                1 clic demuestra el nivel exacto
              </span>
            </div>

            <div className="flex flex-wrap gap-2.5">
              {ESCENARIOS_DEMOSTRACION.map((esc) => {
                const esActivo = nivelActual === esc.clave;
                return (
                  <button
                    key={esc.clave}
                    type="button"
                    onClick={() => alInyectarEscenario(esc.payload)}
                    disabled={cargando}
                    className={`min-h-[44px] px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all shadow-2xs disabled:opacity-50 inline-flex items-center gap-2 cursor-pointer ${
                      esc.estiloBtn
                    } ${
                      esActivo ? 'ring-2 ring-offset-1 ring-slate-900 shadow-sm' : ''
                    }`}
                  >
                    <span
                      className={`w-2.5 h-2.5 rounded-full ${esc.dotColor} shrink-0`}
                      aria-hidden="true"
                    />
                    <span>{esc.etiqueta}</span>
                  </button>
                );
              })}

              <button
                type="button"
                onClick={alLimpiarSimulacion}
                disabled={cargando}
                className="min-h-[44px] px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 transition-all shadow-2xs disabled:opacity-50 inline-flex items-center gap-2 cursor-pointer"
              >
                <span>Limpiar Simulación</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
