import React from 'react';
import {
  formatearFechaHoraLaPaz,
  formatearAntiguedad,
} from '../utils/formatoTiempo';

/**
 * Paleta visual Bento accesible para los 4 niveles informativos de lluvia.
 */
const ESTILOS_NIVEL = {
  NORMAL: {
    fondo: 'bg-white border-slate-200/80 border-l-4 border-l-emerald-500',
    badge: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
    dot: 'bg-emerald-500',
    icono: '🟢',
    titulo: 'Nivel informativo de lluvia: NORMAL',
    descripcion:
      'Condiciones pluviométricas estándar según los umbrales académicos configurados.',
  },
  PRECAUCION: {
    fondo: 'bg-white border-slate-200/80 border-l-4 border-l-amber-500',
    badge: 'bg-amber-50 text-amber-800 border border-amber-200',
    dot: 'bg-amber-500',
    icono: '🟡',
    titulo: 'Nivel informativo de lluvia: PRECAUCIÓN',
    descripcion:
      'Precipitación moderada detectada. Se recomienda consultar medidas preventivas generales.',
  },
  ALERTA: {
    fondo: 'bg-white border-slate-200/80 border-l-4 border-l-orange-500',
    badge: 'bg-orange-50 text-orange-800 border border-orange-200',
    dot: 'bg-orange-500',
    icono: '🟠',
    titulo: 'Nivel informativo de lluvia: ALERTA',
    descripcion:
      'Lluvia intensa o persistente superando umbrales académicos o regla de saturación de cuenca.',
  },
  EMERGENCIA: {
    fondo: 'bg-white border-slate-200/80 border-l-4 border-l-red-600',
    badge: 'bg-red-50 text-red-800 border border-red-200',
    dot: 'bg-red-600',
    icono: '🔴',
    titulo: 'Nivel informativo de lluvia: EMERGENCIA',
    descripcion:
      'Precipitación extraordinaria superando umbrales académicos críticos.',
  },
};

/**
 * Componente BannerNivelInformativo
 * Tarjeta Hero Bento del nivel informativo vigente y estado global de la zona piloto Llojeta,
 * con control riguroso de SIN_DATOS y DATOS_DESACTUALIZADOS (Pruebas P06 y P15),
 * barra de saturación pluvial 72h / 60 mm y presets de simulación rápida en 1 clic.
 *
 * @param {Object} props
 * @param {Object} props.estado Payload completo de GET /api/estado
 * @param {Function} [props.alInyectarPreset] Callback opcional para simulación en 1 clic
 */
export default function BannerNivelInformativo({ estado, alInyectarPreset }) {
  if (!estado) return null;

  const {
    estado_sistema,
    nivel_vigente,
    nivel_calculado,
    contador_descenso = 0,
    clasificacion_parcial = false,
    regla_saturacion_aplicada = false,
    antiguedad_minutos,
    datos_desactualizados = false,
    t_max_minutos = 60,
    version_reglas,
    lectura,
    modalidad = 'real',
  } = estado;

  const fuente =
    lectura?.fuente ||
    (modalidad === 'simulada' ? 'Simulación Académica' : 'Open-Meteo');
  const observadoEn = lectura?.observado_en;
  const esParcial = clasificacion_parcial || lectura?.estado === 'incompleta';

  // Acumulado 72h para la barra de saturación frente al umbral crítico de 60 mm
  const acum72h = Number(lectura?.acum_72h_mm || 0);
  const porcentajeSaturacion = Math.min(100, Math.round((acum72h / 60) * 100));

  // =========================================================================
  // CASO 1: SIN DATOS METEOROLÓGICOS VÁLIDOS (PROHIBIDO degradar a Normal)
  // =========================================================================
  if (estado_sistema === 'SIN_DATOS') {
    return (
      <section
        role="region"
        aria-label="Estado del sistema: Sin datos"
        className="rounded-2xl border border-slate-200/80 border-l-4 border-l-slate-400 bg-white p-5 md:p-6 shadow-sm space-y-4"
      >
        <div className="flex items-center gap-2.5">
          <span className="text-xl select-none" aria-hidden="true">
            ⚪
          </span>
          <div>
            <span className="text-[10px] font-bold tracking-wider text-slate-500 uppercase">
              Sector Piloto Llojeta / Bajo Llojeta
            </span>
            <h2 className="text-base sm:text-lg font-bold text-slate-900 leading-snug">
              Estado: SIN DATOS METEOROLÓGICOS VÁLIDOS
            </h2>
          </div>
        </div>

        <p className="text-xs text-slate-600 leading-relaxed">
          Actualmente no se cuenta con observaciones pluviométricas válidas procesadas para el sector piloto Llojeta. El sistema no asume normalidad por ausencia de datos.
        </p>

        <div className="pt-2 border-t border-slate-100 flex flex-wrap gap-2 text-[11px] text-slate-500 font-mono">
          <span>Modalidad: {modalidad}</span>
          <span>·</span>
          <span>Versión de configuración: v{version_reglas?.version ?? 1}</span>
        </div>
      </section>
    );
  }

  // =========================================================================
  // CASO 2: DATOS DESACTUALIZADOS (supera T_max, PROHIBIDO degradar a Normal)
  // =========================================================================
  if (estado_sistema === 'DATOS_DESACTUALIZADOS' || datos_desactualizados) {
    const estiloUltimoNivel =
      ESTILOS_NIVEL[nivel_vigente] || ESTILOS_NIVEL.NORMAL;

    return (
      <section
        role="region"
        aria-label="Estado del sistema: Datos desactualizados"
        className="rounded-2xl border border-amber-300 border-l-4 border-l-amber-500 bg-white p-5 md:p-6 shadow-sm space-y-4"
      >
        <div className="flex items-start gap-3">
          <span className="text-2xl select-none" aria-hidden="true">
            ⏳
          </span>
          <div className="space-y-1">
            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-900 border border-amber-200 uppercase tracking-wider">
              Regla T6 · Vencimiento Temporal
            </span>
            <h2 className="text-base sm:text-lg font-bold text-slate-900 leading-snug">
              DATOS DESACTUALIZADOS (supera el límite de vigencia T_max)
            </h2>
            <p className="text-xs text-slate-600 leading-relaxed">
              La última lectura disponible tiene una antigüedad de{' '}
              <strong>{formatearAntiguedad(antiguedad_minutos)}</strong>, superando el límite de vigencia configurado de {t_max_minutos} minutos. Se muestra el{' '}
              <strong>último nivel informativo conocido</strong> sin alteración.
            </p>
          </div>
        </div>

        {/* Último nivel conocido */}
        <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-3.5 flex items-center justify-between gap-3">
          <div>
            <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
              Último nivel informativo conocido
            </span>
            <p className="text-sm sm:text-base font-bold text-slate-900">
              {nivel_vigente || 'No disponible'}
            </p>
          </div>
          <span
            className={`px-3 py-1 rounded-full text-xs font-bold shrink-0 ${estiloUltimoNivel.badge}`}
          >
            {nivel_vigente}
          </span>
        </div>

        {/* Trazabilidad completa */}
        <div className="text-[11px] text-slate-500 space-y-1 pt-2 border-t border-slate-100">
          <p>
            <span className="font-semibold text-slate-700">Hora de última observación:</span>{' '}
            {formatearFechaHoraLaPaz(observadoEn)}
          </p>
          <div className="flex flex-wrap gap-2 font-mono text-[10px] text-slate-500">
            <span>Fuente: {fuente}</span>
            <span>·</span>
            <span>Modalidad: {modalidad}</span>
            <span>·</span>
            <span>Versión de configuración: v{version_reglas?.version ?? 1}</span>
          </div>
        </div>
      </section>
    );
  }

  // =========================================================================
  // CASO 3: NIVELES INFORMATIVOS VIGENTES (NORMAL, PRECAUCION, ALERTA, EMERGENCIA)
  // =========================================================================
  const estilo = ESTILOS_NIVEL[nivel_vigente] || ESTILOS_NIVEL.NORMAL;

  return (
    <section
      role="region"
      aria-label={`Nivel informativo vigente: ${nivel_vigente}`}
      className={`rounded-2xl border p-5 md:p-6 shadow-sm space-y-5 transition-all ${estilo.fondo}`}
    >
      {/* Encabezado Bento Hero */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <span
              className={`h-2.5 w-2.5 rounded-full ${estilo.dot}`}
              aria-hidden="true"
            />
            <span className="text-[11px] font-bold tracking-wider text-slate-500 uppercase">
              Sector Piloto Llojeta / Bajo Llojeta
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight text-slate-900 leading-snug">
            {estilo.titulo}
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed max-w-xl">
            {estilo.descripcion}
          </p>
        </div>

        <div className="flex items-center sm:flex-col sm:items-end gap-2 shrink-0">
          <span
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black tracking-wider uppercase shadow-2xs ${estilo.badge}`}
          >
            <span className="text-sm" aria-hidden="true">
              {estilo.icono}
            </span>
            <span>{nivel_vigente}</span>
          </span>
          <span className="text-[10px] font-mono text-slate-400">
            Reglas v{version_reglas?.version ?? 1} · Histéresis: {contador_descenso}/2
          </span>
        </div>
      </div>

      {/* Banderas Especiales: Clasificación Parcial y Saturación de Suelo */}
      {(esParcial || regla_saturacion_aplicada) && (
        <div className="space-y-2">
          {esParcial && (
            <div
              role="status"
              className="rounded-xl border border-amber-200 bg-amber-50/90 p-3 text-xs text-amber-950 font-medium leading-relaxed flex items-start gap-2"
            >
              <span aria-hidden="true" className="shrink-0">
                ⚠️
              </span>
              <span>
                Clasificación parcial: una o más ventanas de acumulación (24h/72h) tienen horas faltantes y fueron excluidas del cálculo.
              </span>
            </div>
          )}

          {regla_saturacion_aplicada && (
            <div
              role="status"
              className="rounded-xl border border-blue-200 bg-blue-50/90 p-3 text-xs text-blue-950 font-medium leading-relaxed flex items-start gap-2"
            >
              <span aria-hidden="true" className="shrink-0">
                💧
              </span>
              <span>
                Regla de saturación aplicada (acumulado 72h &gt;= 60mm + intensidad &gt;= 2.5 mm/h).
              </span>
            </div>
          )}
        </div>
      )}

      {/* Medidor Visual de Saturación de Suelo (72h frente a 60mm) */}
      <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="font-semibold text-slate-700 flex items-center gap-1.5">
            <span>🌧️</span>
            <span>Índice de Saturación de Suelo (Ventana 72h)</span>
          </span>
          <span className="font-mono text-slate-600 font-bold">
            {acum72h.toFixed(1)} / 60.0mm ({porcentajeSaturacion}%)
          </span>
        </div>
        <div className="w-full h-2.5 rounded-full bg-slate-200 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              acum72h >= 60
                ? 'bg-red-500'
                : acum72h >= 40
                  ? 'bg-orange-500'
                  : acum72h >= 20
                    ? 'bg-amber-400'
                    : 'bg-emerald-400'
            }`}
            style={{ width: `${porcentajeSaturacion}%` }}
          />
        </div>
        <p className="text-[10px] text-slate-500 leading-tight">
          Umbral de saturación de cuenca: 60mm acumulados en 72 horas. Si se supera con lluvia en curso (≥ 2.5 mm/h), el nivel informativo asciende automáticamente a ALERTA o superior.
        </p>
      </div>

      {/* Trazabilidad Obligatoria */}
      <div className="rounded-xl bg-slate-50/90 border border-slate-200/80 p-3 text-xs space-y-1.5">
        <div className="flex flex-wrap items-center justify-between gap-1 text-[11px] text-slate-700">
          <span>
            <strong className="font-semibold text-slate-900">Hora de observación:</strong>{' '}
            {formatearFechaHoraLaPaz(observadoEn)}
          </span>
          <span className="font-mono text-[10px] bg-white border border-slate-200 px-2 py-0.5 rounded text-slate-600">
            Antigüedad: {formatearAntiguedad(antiguedad_minutos)}
          </span>
        </div>

        <div className="flex flex-wrap gap-2 text-[10px] text-slate-500 font-mono pt-1.5 border-t border-slate-200/60">
          <span>Fuente: {fuente}</span>
          <span>·</span>
          <span>Modalidad: {modalidad}</span>
          <span>·</span>
          <span>Versión de configuración: v{version_reglas?.version ?? 1}</span>
          <span>·</span>
          <span>Histéresis (contador descenso): {contador_descenso}/2</span>
          {nivel_calculado && nivel_calculado !== nivel_vigente && (
            <>
              <span>·</span>
              <span className="font-semibold text-slate-800">
                Último nivel instantáneo: {nivel_calculado}
              </span>
            </>
          )}
        </div>
      </div>

      {/* Simulador Rápido de Escenarios Académicos (1 Clic) */}
      {alInyectarPreset && (
        <div className="pt-2 border-t border-slate-100 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
              🧪 Simulador de Escenarios Académicos (Demostración en 1 Clic)
            </span>
            <span className="text-[10px] text-indigo-600 font-medium">
              Aislamiento P11
            </span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <button
              type="button"
              onClick={() => alInyectarPreset('NORMAL', 1.0, 4.0, 10.0)}
              className="px-2.5 py-1.5 rounded-xl border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 text-emerald-900 font-bold text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <span>🟢</span>
              <span>Normal</span>
            </button>
            <button
              type="button"
              onClick={() => alInyectarPreset('PRECAUCION', 3.0, 15.0, 30.0)}
              className="px-2.5 py-1.5 rounded-xl border border-amber-200 bg-amber-50 hover:bg-amber-100 text-amber-900 font-bold text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <span>🟡</span>
              <span>Precaución</span>
            </button>
            <button
              type="button"
              onClick={() => alInyectarPreset('ALERTA', 8.0, 30.0, 65.0)}
              className="px-2.5 py-1.5 rounded-xl border border-orange-200 bg-orange-50 hover:bg-orange-100 text-orange-900 font-bold text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <span>🟠</span>
              <span>Alerta</span>
            </button>
            <button
              type="button"
              onClick={() => alInyectarPreset('EMERGENCIA', 15.0, 50.0, 100.0)}
              className="px-2.5 py-1.5 rounded-xl border border-red-200 bg-red-50 hover:bg-red-100 text-red-900 font-bold text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <span>🔴</span>
              <span>Emergencia</span>
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
