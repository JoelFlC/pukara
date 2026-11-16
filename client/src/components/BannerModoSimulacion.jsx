import React from 'react';

/**
 * Escenarios preconfigurados para demostración académica en vivo.
 * Basados en los umbrales oficiales del motor de reglas de PUKARA (v1).
 */
export const ESCENARIOS_DEMOSTRACION = [
  {
    clave: 'NORMAL',
    etiqueta: 'Simular Normal',
    dotColor: 'bg-[#059669]',
    estiloBtn:
      'bg-[#ECFDF5] hover:bg-[#D1FAE5] text-[#065F46] border border-[#A7F3D0]',
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
    dotColor: 'bg-[#B45309]',
    estiloBtn:
      'bg-[#FEF3C7] hover:bg-[#FDE68A]/70 text-[#92400E] border border-[#FDE68A]',
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
    dotColor: 'bg-[#C2410C]',
    estiloBtn:
      'bg-[#FFEDD5] hover:bg-[#FED7AA]/70 text-[#9A3412] border border-[#FED7AA]',
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
    dotColor: 'bg-[#DC2626]',
    estiloBtn:
      'bg-[#FEE2E2] hover:bg-[#FECACA]/70 text-[#991B1B] border border-[#FECACA]',
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
  if (ocultarSelector && !esSimulacion) {
    return null;
  }

  return (
    <section
      aria-label="Selector de modalidad y control de simulación"
      className="space-y-4 animate-fade-up"
    >
      {/* 1. Selector de Modalidad (solo visible si no está oculto por prop) */}
      {!ocultarSelector && (
        <div className="clay-card p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="min-w-0">
            <span className="swiss-chapter-badge block">
              Modo de consulta
            </span>
            <p className="text-base text-[#464555] mt-0.5">
              {esSimulacion
                ? 'Visualizando datos académicos simulados aislados'
                : 'Visualizando lecturas reales de modelo meteorológico'}
            </p>
          </div>

          <div
            role="group"
            aria-label="Modo de consulta: Datos Reales (Open-Meteo) | Modo Simulación (Demostración)"
            className="grid grid-cols-1 sm:inline-grid sm:grid-cols-2 gap-1.5 rounded-2xl bg-[#F0F3FF] p-1.5 border border-slate-200/80 w-full sm:w-auto"
          >
            <button
              type="button"
              onClick={() => alCambiarModalidad('real')}
              disabled={cargando}
              aria-pressed={modalidad === 'real'}
              className={`min-h-[48px] px-4 py-2 rounded-xl text-sm font-bold transition-all cursor-pointer ${
                modalidad === 'real'
                  ? 'bg-[#3525CD] text-white shadow-sm'
                  : 'text-[#464555] hover:text-[#111C2D] hover:bg-white/60'
              }`}
            >
              Datos Reales (Open-Meteo)
            </button>
            <button
              type="button"
              onClick={() => alCambiarModalidad('simulada')}
              disabled={cargando}
              aria-pressed={modalidad === 'simulada'}
              className={`min-h-[48px] px-4 py-2 rounded-xl text-sm font-bold transition-all cursor-pointer ${
                modalidad === 'simulada'
                  ? 'bg-[#111C2D] text-white shadow-sm'
                  : 'text-[#464555] hover:text-[#111C2D] hover:bg-white/60'
              }`}
            >
              Modo Simulación (Demostración)
            </button>
          </div>
        </div>
      )}

      {/* 2. Banner Institucional en Modo Simulación (P11) */}
      {esSimulacion && (
        <div
          role="region"
          aria-label="Aviso de modo simulación activa"
          className="clay-card border-l-4 border-l-[#3525CD] bg-[#FFFFFF] p-5 sm:p-6 space-y-4"
        >
          {/* Encabezado y Aislamiento */}
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 border-b border-slate-100 pb-4">
            <div className="flex items-start gap-3 min-w-0">
              <span
                className="w-10 h-10 rounded-full bg-[#EEF2FF] text-[#3525CD] flex items-center justify-center text-xl shrink-0 clay-pill select-none"
                aria-hidden="true"
              >
                🧪
              </span>
              <div className="min-w-0 space-y-1.5">
                <span className="clay-pill bg-[#EEF2FF] text-[#3525CD] border border-[#E2DFFF] font-extrabold text-xs tracking-wider uppercase px-3 py-1 inline-block">
                  MODO DEMOSTRACIÓN ACADÉMICA ACTIVO (REGLA P11)
                </span>
                <p className="text-base font-medium text-[#111C2D] leading-relaxed">
                  MODO SIMULACIÓN ACADÉMICA ACTIVO — Los datos y el nivel mostrados son simulados para demostración y NO alteran el estado meteorológico real.
                </p>
              </div>
            </div>
          </div>

          {/* Botones de Escenarios Académicos (Grid 2 cols móvil -> 4 cols desktop) */}
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm font-bold text-[#111C2D] uppercase tracking-wider">
                Inyectar escenario académico de prueba:
              </span>
              <span className="text-sm text-[#464555]">
                1 clic demuestra el nivel exacto
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {ESCENARIOS_DEMOSTRACION.map((esc) => {
                const esActivo = nivelActual === esc.clave;
                return (
                  <button
                    key={esc.clave}
                    type="button"
                    onClick={() => alInyectarEscenario(esc.payload)}
                    disabled={cargando}
                    className={`clay-pill clay-interactive min-h-[48px] w-full px-3 py-2.5 text-sm font-bold disabled:opacity-50 inline-flex items-center justify-center gap-2 cursor-pointer ${
                      esc.estiloBtn
                    } ${
                      esActivo ? 'ring-2 ring-offset-2 ring-[#3525CD]' : ''
                    }`}
                  >
                    <span
                      className={`w-2.5 h-2.5 rounded-full ${esc.dotColor} shrink-0`}
                      aria-hidden="true"
                    />
                    <span className="truncate">{esc.etiqueta}</span>
                  </button>
                );
              })}
            </div>

            <div className="pt-1 flex justify-end">
              <button
                type="button"
                onClick={alLimpiarSimulacion}
                disabled={cargando}
                className="clay-btn-secondary clay-interactive min-h-[48px] w-full sm:w-auto px-5 py-2.5 text-sm font-bold disabled:opacity-50 inline-flex items-center justify-center gap-2 cursor-pointer"
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
