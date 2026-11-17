import React from 'react';
import {
  formatearFechaHoraLaPaz,
  formatearAntiguedad,
} from '../utils/formatoTiempo';

/**
 * Componente TarjetaLecturaMeteorologica
 * Presenta las 3 lecturas pluviométricas rectoras en tarjetas grandes y limpias
 * (Lluvia Actual 1h, Acumulada 24h y Saturación 72h) y agrupa las variables atmosféricas
 * complementarias en una barra compacta inferior para cero fatiga visual.
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
        className="clay-card p-6 sm:p-7 space-y-3 animate-fade-up"
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
      {fallo_api_reciente && (
        <div
          role="status"
          className="clay-card-sm border border-[#FDE68A] bg-[#FEF3C7] p-4 text-base text-[#92400E] leading-snug"
        >
          ⚠️ Servicio externo no disponible en este momento; mostrando última lectura válida almacenada y su antigüedad real.
        </div>
      )}

      {/* 1. Tres Tarjetas Principales de Lluvia (Protagonistas, limpias y legibles) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Tarjeta 1: Lluvia Actual 1 Hora */}
        <article className="clay-card clay-interactive p-6 sm:p-7 flex flex-col justify-between gap-4">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs sm:text-sm font-extrabold text-[#475569] uppercase tracking-wider">
              LLUVIA ACTUAL · 1 HORA
            </span>
            <span
              className="w-9 h-9 rounded-full bg-[#EEF2FF] text-[#3525CD] flex items-center justify-center text-lg shrink-0"
              aria-hidden="true"
            >
              ⚡
            </span>
          </div>

          <div className="space-y-1.5">
            {lectura.intensidad_mm_h !== null ? (
              <p className="telemetry-num text-4xl sm:text-[44px] font-extrabold tabular-nums text-[#111C2D] tracking-tight">
                {lectura.intensidad_mm_h}
                <span className="text-lg sm:text-xl font-bold text-[#475569] ml-1.5">mm/h</span>
              </p>
            ) : (
              <p className="text-xl font-extrabold text-[#92400E]">Sin dato</p>
            )}
            <p className="text-base text-[#464555]">
              Precipitación registrada en la última hora
            </p>
          </div>

          <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center gap-2 text-xs sm:text-sm">
            <span className="clay-pill px-3 py-1 font-bold bg-[#ECFDF5] text-[#065F46] border border-[#A7F3D0]">
              Lectura activa
            </span>
            <span className="text-[#475569] font-medium">
              Antigüedad: {formatearAntiguedad(lectura.antiguedad_minutos)}
            </span>
          </div>
        </article>

        {/* Tarjeta 2: Lluvia Acumulada 24 Horas */}
        <article className="clay-card clay-interactive p-6 sm:p-7 flex flex-col justify-between gap-4">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs sm:text-sm font-extrabold text-[#475569] uppercase tracking-wider">
              LLUVIA ACUMULADA · 24 HORAS
            </span>
            <span
              className="w-9 h-9 rounded-full bg-[#ECFDF5] text-[#059669] flex items-center justify-center text-lg shrink-0"
              aria-hidden="true"
            >
              ⏱️
            </span>
          </div>

          <div className="space-y-1.5">
            {lectura.acum_24h_mm !== null ? (
              <p className="telemetry-num text-4xl sm:text-[44px] font-extrabold tabular-nums text-[#111C2D] tracking-tight">
                {lectura.acum_24h_mm}
                <span className="text-lg sm:text-xl font-bold text-[#475569] ml-1.5">mm</span>
              </p>
            ) : (
              <p className="text-lg sm:text-xl font-extrabold text-[#92400E] leading-snug">
                Acumulado incompleto ({lectura.horas_validas_24h ?? 0}/24 h)
              </p>
            )}
            <p className="text-base text-[#464555]">
              Agua acumulada en las últimas 24 horas
            </p>
          </div>

          <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center gap-2 text-xs sm:text-sm">
            <span className="clay-pill px-3 py-1 font-bold bg-[#F0F3FF] text-[#3525CD] border border-[#E2DFFF]">
              {lectura.horas_validas_24h ?? 0}/24 horas válidas
            </span>
          </div>
        </article>

        {/* Tarjeta 3: Saturación de Cuenca 72 Horas */}
        <article className="clay-card clay-interactive p-6 sm:p-7 flex flex-col justify-between gap-4">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs sm:text-sm font-extrabold text-[#475569] uppercase tracking-wider">
              SATURACIÓN DE CUENCA · 72 HORAS
            </span>
            <span
              className="w-9 h-9 rounded-full bg-[#EEF2FF] text-[#3525CD] flex items-center justify-center text-lg shrink-0"
              aria-hidden="true"
            >
              🌊
            </span>
          </div>

          <div className="space-y-1.5">
            {lectura.acum_72h_mm !== null ? (
              <p className="telemetry-num text-4xl sm:text-[44px] font-extrabold tabular-nums text-[#111C2D] tracking-tight">
                {lectura.acum_72h_mm}
                <span className="text-lg sm:text-xl font-bold text-[#475569] ml-1.5">mm</span>
              </p>
            ) : (
              <p className="text-lg sm:text-xl font-extrabold text-[#92400E] leading-snug">
                Acumulado incompleto ({lectura.horas_validas_72h ?? 0}/72 h)
              </p>
            )}
            <p className="text-base text-[#464555]">
              Agua acumulada en 3 días (umbral 60mm)
            </p>
          </div>

          <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center gap-2 text-xs sm:text-sm">
            <span className="clay-pill px-3 py-1 font-bold bg-[#F0F3FF] text-[#3525CD] border border-[#E2DFFF]">
              {lectura.horas_validas_72h ?? 0}/72 horas válidas · Umbral: 60mm
            </span>
          </div>
        </article>
      </div>

      {/* 2. Barra Compacta de Variables Secundarias y Procedencia */}
      <div className="clay-card-sm bg-white/85 px-5 py-3.5 flex flex-wrap items-center justify-between gap-3 text-sm text-[#464555]">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 font-medium text-[#111C2D]">
          <span>
            🌡️ Temp: <strong>{lectura.temperatura !== null ? lectura.temperatura : 'N/D'} °C</strong>
          </span>
          <span>
            💧 Humedad: <strong>{lectura.humedad !== null ? lectura.humedad : 'N/D'} %</strong>
          </span>
          <span>
            💨 Viento: <strong>{lectura.viento !== null ? lectura.viento : 'N/D'} km/h</strong>
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs sm:text-sm text-[#475569]">
          <span className="font-semibold text-[#3525CD]">
            Fuente: Open-Meteo (modelo meteorológico)
          </span>
          <span>·</span>
          <span>Obs: {formatearFechaHoraLaPaz(lectura.observado_en)}</span>
          <span>·</span>
          <span className="font-mono">Origen: {origen_respuesta}</span>
        </div>
      </div>

      {/* 3. Aviso de Calidad Parcial de Datos si corresponde */}
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

      {/* 4. Nota Metodológica discreta */}
      <footer className="text-xs sm:text-sm text-[#475569] leading-relaxed px-1">
        ℹ️ {nota_modelo || 'Datos provenientes de modelo meteorológico (Open-Meteo), no equivalen a mediciones de estación pluviométrica local.'}
      </footer>
    </section>
  );
}
