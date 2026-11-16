import React from 'react';
import {
  formatearFechaHoraLaPaz,
  formatearAntiguedad,
} from '../utils/formatoTiempo';

/**
 * Paleta Pastel Clay con contraste WCAG AAA para los 4 niveles informativos de lluvia.
 */
const ESTILOS_NIVEL = {
  NORMAL: {
    fondo: 'bg-[#ECFDF5] border-[#A7F3D0]',
    badge: 'bg-[#D1FAE5] text-[#065F46] border border-[#A7F3D0]',
    dot: 'bg-[#059669]',
    acento: 'text-[#065F46]',
    icono: '🟢',
    titulo: 'Nivel informativo de lluvia: NORMAL',
    descripcion:
      'Condiciones pluviométricas estándar según los umbrales académicos configurados.',
  },
  PRECAUCION: {
    fondo: 'bg-[#FEF3C7] border-[#FDE68A]',
    badge: 'bg-white/90 text-[#92400E] border border-[#FDE68A]',
    dot: 'bg-[#B45309]',
    acento: 'text-[#92400E]',
    icono: '🟡',
    titulo: 'Nivel informativo de lluvia: PRECAUCIÓN',
    descripcion:
      'Precipitación moderada detectada. Se recomienda consultar medidas preventivas generales.',
  },
  ALERTA: {
    fondo: 'bg-[#FFEDD5] border-[#FED7AA]',
    badge: 'bg-white/90 text-[#9A3412] border border-[#FED7AA]',
    dot: 'bg-[#C2410C]',
    acento: 'text-[#9A3412]',
    icono: '🟠',
    titulo: 'Nivel informativo de lluvia: ALERTA',
    descripcion:
      'Lluvia intensa o persistente superando umbrales académicos o regla de saturación de cuenca.',
  },
  EMERGENCIA: {
    fondo: 'bg-[#FEE2E2] border-[#FECACA]',
    badge: 'bg-white/90 text-[#991B1B] border border-[#FECACA]',
    dot: 'bg-[#DC2626]',
    acento: 'text-[#991B1B]',
    icono: '🔴',
    titulo: 'Nivel informativo de lluvia: EMERGENCIA',
    descripcion:
      'Precipitación extraordinaria superando umbrales académicos críticos.',
  },
};

/**
 * Componente BannerNivelInformativo
 * Tarjeta Hero Diagnóstico (Swiss Grid + Pastel Clay) del nivel informativo vigente y estado global
 * de la zona piloto Llojeta, con control riguroso de SIN_DATOS y DATOS_DESACTUALIZADOS (P06 y P15),
 * barra de saturación pluvial 72h / 60mm y presets de simulación rápida en 1 clic.
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
        className="clay-card border-2 border-slate-200 bg-white p-5 sm:p-7 space-y-4 animate-fade-up"
      >
        <div className="flex items-start gap-3 min-w-0">
          <span className="text-2xl select-none shrink-0 mt-0.5" aria-hidden="true">
            ⚪
          </span>
          <div className="min-w-0 space-y-1">
            <span className="swiss-chapter-badge text-[#475569]">
              Sector Piloto Llojeta / Bajo Llojeta
            </span>
            <h2 className="headline-lg text-2xl sm:text-3xl font-extrabold text-[#111C2D] leading-snug break-words">
              Estado: SIN DATOS METEOROLÓGICOS VÁLIDOS
            </h2>
          </div>
        </div>

        <p className="text-base text-[#464555] leading-relaxed">
          Actualmente no se cuenta con observaciones pluviométricas válidas procesadas para el sector piloto Llojeta. El sistema no asume normalidad por ausencia de datos.
        </p>

        <div className="pt-3 border-t border-slate-100 flex flex-wrap gap-2 text-sm text-[#475569] font-mono">
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
        className="clay-card border-2 border-[#FDE68A] bg-[#FEF3C7]/85 p-5 sm:p-7 space-y-4 animate-fade-up"
      >
        <div className="flex items-start gap-3 min-w-0">
          <span className="text-2xl select-none shrink-0 mt-0.5" aria-hidden="true">
            ⏳
          </span>
          <div className="space-y-1.5 min-w-0">
            <span className="clay-pill inline-flex items-center px-3 py-1 text-xs font-extrabold bg-white/90 text-[#92400E] border border-[#FDE68A] uppercase tracking-wider">
              Regla T6 · Vencimiento Temporal
            </span>
            <h2 className="headline-lg text-2xl sm:text-3xl font-extrabold text-[#111C2D] leading-snug break-words">
              DATOS DESACTUALIZADOS (supera el límite de vigencia T_max)
            </h2>
            <p className="text-base text-[#1E293B] leading-relaxed">
              La última lectura disponible tiene una antigüedad de{' '}
              <strong>{formatearAntiguedad(antiguedad_minutos)}</strong>, superando el límite de vigencia configurado de {t_max_minutos} minutos. Se muestra el{' '}
              <strong>último nivel informativo conocido</strong> sin alteración.
            </p>
          </div>
        </div>

        {/* Último nivel conocido */}
        <div className="clay-card-sm bg-white/95 p-4 flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <span className="text-xs font-bold text-[#475569] uppercase tracking-wider block">
              Último nivel informativo conocido
            </span>
            <p className="headline-md text-xl font-extrabold text-[#111C2D]">
              {nivel_vigente || 'No disponible'}
            </p>
          </div>
          <span
            className={`clay-pill px-4 py-1.5 text-sm font-extrabold shrink-0 ${estiloUltimoNivel.badge}`}
          >
            {nivel_vigente}
          </span>
        </div>

        {/* Trazabilidad completa */}
        <div className="text-sm text-[#464555] space-y-1.5 pt-2 border-t border-[#FDE68A]">
          <p>
            <strong className="font-semibold text-[#111C2D]">Hora de última observación:</strong>{' '}
            {formatearFechaHoraLaPaz(observadoEn)}
          </p>
          <div className="flex flex-wrap gap-x-3 gap-y-1 font-mono text-xs text-[#475569]">
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
      className={`clay-card border-2 p-5 sm:p-7 space-y-5 transition-all animate-fade-up ${estilo.fondo}`}
    >
      {/* Encabezado Hero Diagnóstico */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3.5">
        <div className="space-y-2 min-w-0">
          <div className="flex flex-wrap items-center gap-2.5">
            <span
              className={`h-3 w-3 rounded-full ${estilo.dot} clay-beacon-pulse shrink-0`}
              aria-hidden="true"
            />
            <span className="swiss-chapter-badge text-[#464555]">
              Sector Piloto Llojeta / Bajo Llojeta
            </span>
          </div>
          <h2 className="display-hero text-[28px] sm:text-4xl lg:text-[42px] leading-tight tracking-tight break-words text-[#111C2D]">
            {estilo.titulo}
          </h2>
          <p className="text-base sm:text-lg text-[#1E293B] leading-relaxed max-w-2xl">
            {estilo.descripcion}
          </p>
        </div>

        <div className="flex flex-wrap sm:flex-col items-center sm:items-end gap-2 shrink-0">
          <span
            className={`clay-pill inline-flex items-center gap-2 px-4 py-2 text-sm font-extrabold tracking-wider uppercase ${estilo.badge}`}
          >
            <span className="text-base" aria-hidden="true">
              {estilo.icono}
            </span>
            <span>{nivel_vigente}</span>
          </span>
          <span className="text-xs font-mono font-semibold text-[#475569] bg-white/70 px-2.5 py-1 rounded-full">
            Reglas v{version_reglas?.version ?? 1} · Histéresis: {contador_descenso}/2
          </span>
        </div>
      </div>

      {/* Banderas Especiales: Clasificación Parcial y Saturación de Suelo */}
      {(esParcial || regla_saturacion_aplicada) && (
        <div className="space-y-2.5">
          {esParcial && (
            <div
              role="status"
              className="clay-card-sm border border-[#FDE68A] bg-white/95 p-3.5 text-base text-[#92400E] font-medium leading-relaxed flex items-start gap-2.5"
            >
              <span aria-hidden="true" className="shrink-0 mt-0.5">
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
              className="clay-card-sm border border-[#E2DFFF] bg-white/95 p-3.5 text-base text-[#3525CD] font-medium leading-relaxed flex items-start gap-2.5"
            >
              <span aria-hidden="true" className="shrink-0 mt-0.5">
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
      <div className="clay-card-sm bg-white/90 p-4 space-y-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm sm:text-base">
          <span className="font-bold text-[#111C2D] flex items-center gap-2">
            <span aria-hidden="true">🌧️</span>
            <span>Índice de Saturación de Suelo (Ventana 72h)</span>
          </span>
          <span className="font-mono text-[#1E293B] font-extrabold tabular-nums">
            {acum72h.toFixed(1)} / 60.0mm ({porcentajeSaturacion}%)
          </span>
        </div>
        <div className="w-full h-3 rounded-full bg-slate-200/80 overflow-hidden shadow-inner">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              acum72h >= 60
                ? 'bg-[#DC2626]'
                : acum72h >= 40
                  ? 'bg-[#C2410C]'
                  : acum72h >= 20
                    ? 'bg-[#D97706]'
                    : 'bg-[#059669]'
            }`}
            style={{ width: `${porcentajeSaturacion}%` }}
          />
        </div>
        <p className="text-sm text-[#464555] leading-relaxed">
          Umbral de saturación de cuenca: 60mm acumulados en 72 horas. Si se supera con lluvia en curso (≥ 2.5 mm/h), el nivel informativo asciende automáticamente a ALERTA o superior.
        </p>
      </div>

      {/* Trazabilidad Obligatoria */}
      <div className="clay-card-sm bg-white/90 p-4 text-sm space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2 text-[#1E293B]">
          <span className="text-base">
            <strong className="font-bold text-[#111C2D]">Hora de observación:</strong>{' '}
            {formatearFechaHoraLaPaz(observadoEn)}
          </span>
          <span className="clay-pill font-mono text-xs font-bold bg-[#F0F3FF] border border-slate-200/80 px-3 py-1 text-[#111C2D]">
            Antigüedad: {formatearAntiguedad(antiguedad_minutos)}
          </span>
        </div>

        <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs sm:text-sm text-[#475569] font-mono pt-2 border-t border-slate-200/70">
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
              <span className="font-bold text-[#111C2D]">
                Último nivel instantáneo: {nivel_calculado}
              </span>
            </>
          )}
        </div>
      </div>

      {/* Simulador Rápido de Escenarios Académicos (1 Clic) */}
      {alInyectarPreset && (
        <div className="pt-2 border-t border-black/10 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs sm:text-sm font-extrabold uppercase tracking-wider text-[#1E293B]">
              🧪 Simulador de Escenarios Académicos (Demostración en 1 Clic)
            </span>
            <span className="text-xs font-bold text-[#3525CD] bg-white/80 px-2.5 py-0.5 rounded-full">
              Aislamiento P11
            </span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <button
              type="button"
              onClick={() => alInyectarPreset('NORMAL', 0.4, 2.0, 6.0)}
              className="clay-pill clay-interactive min-h-[48px] px-3 py-2 border border-[#A7F3D0] bg-white/95 hover:bg-[#D1FAE5] text-[#065F46] font-bold text-sm inline-flex items-center justify-center gap-2 cursor-pointer"
            >
              <span aria-hidden="true">🟢</span>
              <span>Normal</span>
            </button>
            <button
              type="button"
              onClick={() => alInyectarPreset('PRECAUCION', 3.2, 14.0, 30.0)}
              className="clay-pill clay-interactive min-h-[48px] px-3 py-2 border border-[#FDE68A] bg-white/95 hover:bg-[#FEF3C7] text-[#92400E] font-bold text-sm inline-flex items-center justify-center gap-2 cursor-pointer"
            >
              <span aria-hidden="true">🟡</span>
              <span>Precaución</span>
            </button>
            <button
              type="button"
              onClick={() => alInyectarPreset('ALERTA', 7.5, 28.0, 64.0)}
              className="clay-pill clay-interactive min-h-[48px] px-3 py-2 border border-[#FED7AA] bg-white/95 hover:bg-[#FFEDD5] text-[#9A3412] font-bold text-sm inline-flex items-center justify-center gap-2 cursor-pointer"
            >
              <span aria-hidden="true">🟠</span>
              <span>Alerta</span>
            </button>
            <button
              type="button"
              onClick={() => alInyectarPreset('EMERGENCIA', 14.5, 48.0, 98.0)}
              className="clay-pill clay-interactive min-h-[48px] px-3 py-2 border border-[#FECACA] bg-white/95 hover:bg-[#FEE2E2] text-[#991B1B] font-bold text-sm inline-flex items-center justify-center gap-2 cursor-pointer"
            >
              <span aria-hidden="true">🔴</span>
              <span>Emergencia</span>
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
