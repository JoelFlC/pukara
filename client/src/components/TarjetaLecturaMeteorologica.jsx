import React from 'react';
import {
  formatearFechaHoraLaPaz,
  formatearAntiguedad,
} from '../utils/formatoTiempo';

/**
 * Componente TarjetaLecturaMeteorologica
 * Grilla Suiza + Claymorfismo de Telemetría Pluviométrica y Atmosférica de Llojeta
 * con trazabilidad explícita de procedencia (Open-Meteo), horas de observación y control de calidad.
 *
 * @param {Object} props
 * @param {Object} [props.meteorologia] Bloque de meteorología proveniente de GET /api/estado
 */
export default function TarjetaLecturaMeteorologica({ meteorologia }) {
  // Caso 1: Sin datos meteorológicos disponibles
  if (!meteorologia || !meteorologia.disponible || !meteorologia.lectura) {
    return (
      <section
        aria-label="Estado meteorológico sin datos"
        className="clay-card p-5 sm:p-7 space-y-3 animate-fade-up"
      >
        <div className="flex items-center gap-2.5">
          <span className="h-3 w-3 rounded-full bg-slate-400 shrink-0" />
          <h2 className="headline-md text-lg sm:text-xl font-bold tracking-tight text-[#111C2D] uppercase">
            Estado: SIN DATOS METEOROLÓGICOS REGISTRADOS
          </h2>
        </div>
        <p className="text-base text-[#464555] leading-relaxed">
          Actualmente no se dispone de una lectura meteorológica válida almacenada en el sistema. El servicio se actualizará cuando se reciban nuevas observaciones.
        </p>
        <p className="text-sm text-[#475569] font-mono">
          Origen: {meteorologia?.origen_respuesta || 'sin_datos'}
        </p>
      </section>
    );
  }

  // Caso 2: Lectura disponible
  const { lectura, origen_respuesta, fallo_api_reciente, banderas_calidad, nota_modelo } =
    meteorologia;

  const esParcial =
    lectura.estado === 'incompleta' || banderas_calidad?.clasificacion_parcial === true;

  return (
    <section
      aria-label="Lectura meteorológica en Llojeta"
      className="space-y-4 animate-fade-up"
    >
      {/* 1. Barra de Trazabilidad y Estado de Fuente */}
      <div className="clay-card-sm px-4 py-3.5 sm:px-5 flex flex-wrap items-center justify-between gap-3 text-sm sm:text-base">
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="clay-pill inline-flex items-center gap-2 px-3 py-1 text-xs sm:text-sm font-bold bg-[#EEF2FF] text-[#3525CD] border border-[#E2DFFF]">
            <span className="h-2 w-2 rounded-full bg-[#3525CD]" aria-hidden="true" />
            Fuente: Open-Meteo (modelo meteorológico)
          </span>
          <span className="text-[#464555]">
            Obs: <strong className="text-[#111C2D]">{formatearFechaHoraLaPaz(lectura.observado_en)}</strong>
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 font-mono text-xs sm:text-sm text-[#475569]">
          <span>Antigüedad: {formatearAntiguedad(lectura.antiguedad_minutos)}</span>
          <span>·</span>
          <span>Origen: {origen_respuesta}</span>
        </div>

        {fallo_api_reciente && (
          <div
            role="status"
            className="w-full rounded-xl border border-[#FDE68A] bg-[#FEF3C7] p-3 text-sm sm:text-base text-[#92400E] leading-snug"
          >
            ⚠️ Servicio externo no disponible en este momento; mostrando última lectura válida almacenada y su antigüedad real.
          </div>
        )}
      </div>

      {/* 2. Tres Tarjetas Principales de Lluvia (Protagonistas en Móvil y Desktop) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Tarjeta 1: Intensidad Horaria */}
        <div className="clay-card clay-interactive p-5 sm:p-6 flex flex-col justify-between gap-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs sm:text-sm font-extrabold text-[#475569] uppercase tracking-wider">
              Intensidad (1h)
            </span>
            <span className="text-xl" aria-hidden="true">
              ⚡
            </span>
          </div>
          <div className="my-1">
            {lectura.intensidad_mm_h !== null ? (
              <p className="telemetry-num text-3xl sm:text-[40px] lg:text-[44px] font-extrabold tabular-nums text-[#111C2D] tracking-tight">
                {lectura.intensidad_mm_h}
                <span className="text-base sm:text-lg font-bold text-[#475569] ml-1.5">mm/h</span>
              </p>
            ) : (
              <p className="text-base font-bold text-[#92400E]">Sin dato</p>
            )}
          </div>
          <span className="text-sm text-[#464555]">Tasa horaria instantánea</span>
        </div>

        {/* Tarjeta 2: Acumulado 24 Horas */}
        <div className="clay-card clay-interactive p-5 sm:p-6 flex flex-col justify-between gap-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs sm:text-sm font-extrabold text-[#475569] uppercase tracking-wider">
              Acumulado 24h
            </span>
            <span className="text-xl" aria-hidden="true">
              ⏱️
            </span>
          </div>
          <div className="my-1">
            {lectura.acum_24h_mm !== null ? (
              <p className="telemetry-num text-3xl sm:text-[40px] lg:text-[44px] font-extrabold tabular-nums text-[#111C2D] tracking-tight">
                {lectura.acum_24h_mm}
                <span className="text-base sm:text-lg font-bold text-[#475569] ml-1.5">mm</span>
              </p>
            ) : (
              <p className="text-base font-bold text-[#92400E] leading-snug">
                Acumulado incompleto ({lectura.horas_validas_24h ?? 0}/24 h)
              </p>
            )}
          </div>
          <span className="text-sm text-[#464555]">
            {lectura.horas_validas_24h ?? 0}/24 horas válidas
          </span>
        </div>

        {/* Tarjeta 3: Acumulado 72 Horas (Saturación) */}
        <div className="clay-card clay-interactive p-5 sm:p-6 flex flex-col justify-between gap-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs sm:text-sm font-extrabold text-[#475569] uppercase tracking-wider">
              Acumulado 72h
            </span>
            <span className="text-xl" aria-hidden="true">
              🌊
            </span>
          </div>
          <div className="my-1">
            {lectura.acum_72h_mm !== null ? (
              <p className="telemetry-num text-3xl sm:text-[40px] lg:text-[44px] font-extrabold tabular-nums text-[#111C2D] tracking-tight">
                {lectura.acum_72h_mm}
                <span className="text-base sm:text-lg font-bold text-[#475569] ml-1.5">mm</span>
              </p>
            ) : (
              <p className="text-base font-bold text-[#92400E] leading-snug">
                Acumulado incompleto ({lectura.horas_validas_72h ?? 0}/72 h)
              </p>
            )}
          </div>
          <span className="text-sm text-[#464555]">
            {lectura.horas_validas_72h ?? 0}/72 horas válidas · Umbral: 60mm
          </span>
        </div>
      </div>

      {/* 3. Tres Variables Atmosféricas Complementarias (Compactas y centradas en móvil) */}
      <div className="grid grid-cols-3 gap-2 sm:gap-4">
        {/* Temperatura */}
        <div className="clay-card-sm bg-[#F9F9FF] p-3 sm:p-4 flex flex-col items-center sm:items-start justify-between text-center sm:text-left">
          <div className="flex items-center justify-center sm:justify-between w-full gap-1">
            <span className="text-[11px] sm:text-xs font-extrabold text-[#475569] uppercase tracking-wider truncate">
              Temperatura
            </span>
            <span className="text-base hidden sm:inline" aria-hidden="true">
              🌡️
            </span>
          </div>
          <p className="telemetry-num text-xl sm:text-2xl font-extrabold tabular-nums text-[#111C2D] my-1">
            {lectura.temperatura !== null ? lectura.temperatura : 'N/D'}
            <span className="text-xs sm:text-sm font-semibold text-[#475569] ml-0.5">°C</span>
          </p>
          <span className="text-xs text-[#464555] hidden sm:inline">Ambiente en cuenca Llojeta</span>
        </div>

        {/* Humedad */}
        <div className="clay-card-sm bg-[#F9F9FF] p-3 sm:p-4 flex flex-col items-center sm:items-start justify-between text-center sm:text-left">
          <div className="flex items-center justify-center sm:justify-between w-full gap-1">
            <span className="text-[11px] sm:text-xs font-extrabold text-[#475569] uppercase tracking-wider truncate">
              Humedad
            </span>
            <span className="text-base hidden sm:inline" aria-hidden="true">
              💧
            </span>
          </div>
          <p className="telemetry-num text-xl sm:text-2xl font-extrabold tabular-nums text-[#111C2D] my-1">
            {lectura.humedad !== null ? lectura.humedad : 'N/D'}
            <span className="text-xs sm:text-sm font-semibold text-[#475569] ml-0.5">%</span>
          </p>
          <span className="text-xs text-[#464555] hidden sm:inline">Humedad relativa del aire</span>
        </div>

        {/* Viento */}
        <div className="clay-card-sm bg-[#F9F9FF] p-3 sm:p-4 flex flex-col items-center sm:items-start justify-between text-center sm:text-left">
          <div className="flex items-center justify-center sm:justify-between w-full gap-1">
            <span className="text-[11px] sm:text-xs font-extrabold text-[#475569] uppercase tracking-wider truncate">
              Viento (10m)
            </span>
            <span className="text-base hidden sm:inline" aria-hidden="true">
              💨
            </span>
          </div>
          <p className="telemetry-num text-xl sm:text-2xl font-extrabold tabular-nums text-[#111C2D] my-1">
            {lectura.viento !== null ? lectura.viento : 'N/D'}
            <span className="text-xs sm:text-sm font-semibold text-[#475569] ml-0.5">km/h</span>
          </p>
          <span className="text-xs text-[#464555] hidden sm:inline">Velocidad media estimada</span>
        </div>
      </div>

      {/* 4. Aviso de Calidad Parcial de Datos si corresponde */}
      {esParcial && (
        <div
          role="note"
          className="clay-card-sm border border-[#FDE68A] bg-[#FEF3C7] p-4 text-base text-[#92400E] leading-relaxed flex flex-col sm:flex-row sm:items-start gap-2"
        >
          <span className="font-bold shrink-0">⚠️ Nota de calidad de datos:</span>
          <span>
            La serie horaria contiene horas faltantes o nulas. Por rigor metodológico de PUKARA, los acumulados incompletos no se asumen como cero mm.
          </span>
        </div>
      )}

      {/* 5. Nota Metodológica al pie */}
      <footer className="text-sm text-[#475569] leading-relaxed px-1">
        ℹ️ {nota_modelo || 'Datos provenientes de modelo meteorológico (Open-Meteo), no equivalen a mediciones de estación pluviométrica local.'}
      </footer>
    </section>
  );
}
