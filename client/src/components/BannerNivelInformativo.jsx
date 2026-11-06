import React from 'react';
import {
  formatearFechaHoraLaPaz,
  formatearAntiguedad,
} from '../utils/formatoTiempo';

/**
 * Paleta visual canónica accesible para los 4 niveles informativos de lluvia.
 */
const ESTILOS_NIVEL = {
  NORMAL: {
    fondo: 'bg-emerald-50 border-emerald-300 text-emerald-950',
    badge: 'bg-emerald-600 text-white',
    icono: '🟢',
    titulo: 'Nivel informativo de lluvia: NORMAL',
    descripcion:
      'Condiciones pluviométricas estándar según los umbrales académicos configurados.',
  },
  PRECAUCION: {
    fondo: 'bg-amber-50 border-amber-300 text-amber-950',
    badge: 'bg-amber-600 text-white',
    icono: '🟡',
    titulo: 'Nivel informativo de lluvia: PRECAUCIÓN',
    descripcion:
      'Precipitación moderada detectada. Se recomienda consultar medidas preventivas generales.',
  },
  ALERTA: {
    fondo: 'bg-orange-50 border-orange-400 text-orange-950',
    badge: 'bg-orange-600 text-white',
    icono: '🟠',
    titulo: 'Nivel informativo de lluvia: ALERTA',
    descripcion:
      'Lluvia intensa o persistente superando umbrales académicos o regla de saturación de cuenca.',
  },
  EMERGENCIA: {
    fondo: 'bg-red-50 border-red-400 text-red-950',
    badge: 'bg-red-700 text-white',
    icono: '🔴',
    titulo: 'Nivel informativo de lluvia: EMERGENCIA',
    descripcion:
      'Precipitación extraordinaria superando umbrales académicos críticos.',
  },
};

/**
 * Componente BannerNivelInformativo
 * Muestra el nivel informativo vigente y estado global para la zona piloto Llojeta,
 * con control riguroso de SIN_DATOS y DATOS_DESACTUALIZADOS (Pruebas P06 y P15).
 *
 * @param {Object} props
 * @param {Object} props.estado Payload completo de GET /api/estado
 */
export default function BannerNivelInformativo({ estado }) {
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

  const fuente = lectura?.fuente || (modalidad === 'simulada' ? 'Simulación Académica' : 'Open-Meteo');
  const observadoEn = lectura?.observado_en;
  const esParcial = clasificacion_parcial || lectura?.estado === 'incompleta';

  // =========================================================================
  // CASO 1: SIN DATOS METEOROLÓGICOS VÁLIDOS (PROHIBIDO degradar a Normal)
  // =========================================================================
  if (estado_sistema === 'SIN_DATOS') {
    return (
      <section
        role="region"
        aria-label="Estado del sistema: Sin datos"
        className="rounded-2xl border-2 border-slate-300 bg-slate-100 p-5 shadow-sm space-y-3"
      >
        <div className="flex items-center gap-2.5">
          <span className="text-xl select-none" aria-hidden="true">
            ⚪
          </span>
          <div>
            <span className="text-[10px] font-bold tracking-wider text-slate-500 uppercase">
              Estado del Sistema (Llojeta)
            </span>
            <h2 className="text-base sm:text-lg font-extrabold text-slate-800 leading-snug">
              Estado: SIN DATOS METEOROLÓGICOS VÁLIDOS
            </h2>
          </div>
        </div>

        <p className="text-xs text-slate-700 leading-relaxed">
          Actualmente no se cuenta con observaciones pluviométricas válidas procesadas para el sector piloto Llojeta. El sistema no asume normalidad por ausencia de datos.
        </p>

        <div className="pt-2 border-t border-slate-200/80 flex flex-wrap gap-2 text-[11px] text-slate-600 font-mono">
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
    const estiloUltimoNivel = ESTILOS_NIVEL[nivel_vigente] || ESTILOS_NIVEL.NORMAL;

    return (
      <section
        role="region"
        aria-label="Estado del sistema: Datos desactualizados"
        className="rounded-2xl border-2 border-amber-500 bg-amber-50/95 p-5 shadow-sm space-y-4"
      >
        <div className="flex items-start gap-3">
          <span className="text-2xl select-none" aria-hidden="true">
            ⏳
          </span>
          <div className="space-y-1">
            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-amber-200 text-amber-950 uppercase tracking-wider">
              Regla T6 · Vencimiento Temporal
            </span>
            <h2 className="text-base sm:text-lg font-extrabold text-amber-950 leading-snug">
              DATOS DESACTUALIZADOS (supera el límite de vigencia T_max)
            </h2>
            <p className="text-xs text-amber-900 leading-relaxed">
              La última lectura disponible tiene una antigüedad de{' '}
              <strong>{formatearAntiguedad(antiguedad_minutos)}</strong>, superando el límite de vigencia configurado de {t_max_minutos} minutos. Se muestra el{' '}
              <strong>último nivel informativo conocido</strong> sin alteración.
            </p>
          </div>
        </div>

        {/* Último nivel conocido */}
        <div className="rounded-xl border border-amber-300 bg-white p-3.5 flex items-center justify-between gap-3">
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
        <div className="text-[11px] text-amber-900/90 space-y-1 pt-1 border-t border-amber-200/80">
          <p>
            <span className="font-semibold">Hora de última observación:</span>{' '}
            {formatearFechaHoraLaPaz(observadoEn)}
          </p>
          <div className="flex flex-wrap gap-2 font-mono text-[10px]">
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
      className={`rounded-2xl border-2 p-5 shadow-sm space-y-4 transition-all ${estilo.fondo}`}
    >
      {/* Encabezado del Nivel */}
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-1.5">
            <span className="text-sm select-none" aria-hidden="true">
              {estilo.icono}
            </span>
            <span className="text-[10px] font-bold tracking-wider uppercase opacity-80">
              Sector Piloto Llojeta / Bajo Llojeta
            </span>
          </div>
          <h2 className="text-lg sm:text-xl font-extrabold tracking-tight leading-snug">
            {estilo.titulo}
          </h2>
          <p className="text-xs leading-relaxed opacity-90 max-w-md">
            {estilo.descripcion}
          </p>
        </div>

        <span
          className={`px-3 py-1.5 rounded-xl text-xs font-black tracking-wider uppercase shrink-0 shadow-xs ${estilo.badge}`}
        >
          {nivel_vigente}
        </span>
      </div>

      {/* Banderas Especiales: Clasificación Parcial y Saturación de Suelo */}
      <div className="space-y-2">
        {esParcial && (
          <div
            role="status"
            className="rounded-xl border border-amber-300 bg-amber-100/90 p-3 text-xs text-amber-950 font-medium leading-relaxed flex items-start gap-2"
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
            className="rounded-xl border border-blue-300 bg-blue-100/90 p-3 text-xs text-blue-950 font-medium leading-relaxed flex items-start gap-2"
          >
            <span aria-hidden="true" className="shrink-0">
              💧
            </span>
            <span>
              Regla de saturación aplicada (acumulado 72h &gt;= 60 mm + intensidad &gt;= 2.5 mm/h).
            </span>
          </div>
        )}
      </div>

      {/* Trazabilidad Obligatoria */}
      <div className="rounded-xl bg-white/70 backdrop-blur-xs p-3 text-xs space-y-1.5 border border-black/5">
        <div className="flex flex-wrap items-center justify-between gap-1 text-[11px] text-slate-700">
          <span>
            <strong className="font-semibold">Hora de observación:</strong>{' '}
            {formatearFechaHoraLaPaz(observadoEn)}
          </span>
          <span className="font-mono text-[10px] bg-slate-200/80 px-2 py-0.5 rounded">
            Antigüedad: {formatearAntiguedad(antiguedad_minutos)}
          </span>
        </div>

        <div className="flex flex-wrap gap-2 text-[10px] text-slate-600 font-mono pt-1 border-t border-slate-200/60">
          <span>Fuente: {fuente}</span>
          <span>·</span>
          <span>Modalidad: {modalidad}</span>
          <span>·</span>
          <span>Versión de configuración: v{version_reglas?.version ?? 1}</span>
          <span>·</span>
          <span>
            Histéresis (contador descenso): {contador_descenso}/2
          </span>
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
    </section>
  );
}

