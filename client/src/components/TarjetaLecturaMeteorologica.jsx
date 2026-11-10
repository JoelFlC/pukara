import React from 'react';
import {
  formatearFechaHoraLaPaz,
  formatearAntiguedad,
} from '../utils/formatoTiempo';

/**
 * Componente TarjetaLecturaMeteorologica
 * Grilla Bento de Telemetría Pluviométrica y Atmosférica de Llojeta
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
        className="rounded-2xl border border-slate-200/80 bg-white p-5 md:p-6 shadow-sm space-y-3"
      >
        <div className="flex items-center gap-2">
          <span className="h-3 w-3 rounded-full bg-slate-400" />
          <h2 className="text-sm font-bold tracking-tight text-slate-800 uppercase">
            Estado: SIN DATOS METEOROLÓGICOS REGISTRADOS
          </h2>
        </div>
        <p className="text-xs text-slate-600 leading-relaxed">
          Actualmente no se dispone de una lectura meteorológica válida almacenada en el sistema. El servicio se actualizará cuando se reciban nuevas observaciones.
        </p>
        <p className="text-[11px] text-slate-400 font-mono">
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
      className="space-y-4"
    >
      {/* 1. Barra de Trazabilidad y Estado de Fuente */}
      <div className="rounded-xl border border-slate-200/80 bg-white px-4 py-3 shadow-2xs flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
            <span className="h-1.5 w-1.5 rounded-full bg-blue-500" aria-hidden="true" />
            Fuente: Open-Meteo (modelo meteorológico)
          </span>
          <span className="text-slate-500">
            Obs: <strong>{formatearFechaHoraLaPaz(lectura.observado_en)}</strong>
          </span>
        </div>

        <div className="flex items-center gap-3 font-mono text-[11px] text-slate-500">
          <span>Antigüedad: {formatearAntiguedad(lectura.antiguedad_minutos)}</span>
          <span>·</span>
          <span>Origen: {origen_respuesta}</span>
        </div>

        {fallo_api_reciente && (
          <div
            role="status"
            className="w-full rounded-lg border border-amber-200 bg-amber-50 p-2 text-xs text-amber-900 leading-snug"
          >
            ⚠️ Servicio externo no disponible en este momento; mostrando última lectura válida almacenada y su antigüedad real.
          </div>
        )}
      </div>

      {/* 2. Grilla Bento de 6 Tarjetas de Telemetría */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3.5">
        {/* Tarjeta 1: Intensidad Horaria */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm flex flex-col justify-between hover:border-slate-300 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
              Intensidad (1h)
            </span>
            <span className="text-base" aria-hidden="true">
              ⚡
            </span>
          </div>
          <div className="my-2">
            {lectura.intensidad_mm_h !== null ? (
              <p className="text-2xl font-black text-slate-900 font-mono tracking-tight">
                {lectura.intensidad_mm_h}
                <span className="text-xs font-semibold text-slate-500 ml-1">mm/h</span>
              </p>
            ) : (
              <p className="text-xs font-semibold text-amber-700">Sin dato</p>
            )}
          </div>
          <span className="text-[10px] text-slate-400">Tasa horaria instantánea</span>
        </div>

        {/* Tarjeta 2: Acumulado 24 Horas */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm flex flex-col justify-between hover:border-slate-300 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
              Acumulado 24h
            </span>
            <span className="text-base" aria-hidden="true">
              ⏱️
            </span>
          </div>
          <div className="my-2">
            {lectura.acum_24h_mm !== null ? (
              <p className="text-2xl font-black text-slate-900 font-mono tracking-tight">
                {lectura.acum_24h_mm}
                <span className="text-xs font-semibold text-slate-500 ml-1">mm</span>
              </p>
            ) : (
              <p className="text-xs font-semibold text-amber-700 leading-tight">
                Acumulado incompleto ({lectura.horas_validas_24h ?? 0}/24 h)
              </p>
            )}
          </div>
          <span className="text-[10px] text-slate-400">
            {lectura.horas_validas_24h ?? 0}/24 horas válidas
          </span>
        </div>

        {/* Tarjeta 3: Acumulado 72 Horas (Saturación) */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm flex flex-col justify-between hover:border-slate-300 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
              Acumulado 72h
            </span>
            <span className="text-base" aria-hidden="true">
              🌊
            </span>
          </div>
          <div className="my-2">
            {lectura.acum_72h_mm !== null ? (
              <p className="text-2xl font-black text-slate-900 font-mono tracking-tight">
                {lectura.acum_72h_mm}
                <span className="text-xs font-semibold text-slate-500 ml-1">mm</span>
              </p>
            ) : (
              <p className="text-xs font-semibold text-amber-700 leading-tight">
                Acumulado incompleto ({lectura.horas_validas_72h ?? 0}/72 h)
              </p>
            )}
          </div>
          <span className="text-[10px] text-slate-400">
            {lectura.horas_validas_72h ?? 0}/72 horas válidas · Umbral: 60mm
          </span>
        </div>

        {/* Tarjeta 4: Temperatura */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm flex flex-col justify-between hover:border-slate-300 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
              Temperatura
            </span>
            <span className="text-base" aria-hidden="true">
              🌡️
            </span>
          </div>
          <div className="my-2">
            <p className="text-2xl font-black text-slate-900 font-mono tracking-tight">
              {lectura.temperatura !== null ? lectura.temperatura : 'N/D'}
              <span className="text-xs font-semibold text-slate-500 ml-1">°C</span>
            </p>
          </div>
          <span className="text-[10px] text-slate-400">Ambiente en cuenca Llojeta</span>
        </div>

        {/* Tarjeta 5: Humedad Relativa */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm flex flex-col justify-between hover:border-slate-300 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
              Humedad
            </span>
            <span className="text-base" aria-hidden="true">
              💧
            </span>
          </div>
          <div className="my-2">
            <p className="text-2xl font-black text-slate-900 font-mono tracking-tight">
              {lectura.humedad !== null ? lectura.humedad : 'N/D'}
              <span className="text-xs font-semibold text-slate-500 ml-1">%</span>
            </p>
          </div>
          <span className="text-[10px] text-slate-400">Humedad relativa del aire</span>
        </div>

        {/* Tarjeta 6: Viento */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm flex flex-col justify-between hover:border-slate-300 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
              Viento (10m)
            </span>
            <span className="text-base" aria-hidden="true">
              💨
            </span>
          </div>
          <div className="my-2">
            <p className="text-2xl font-black text-slate-900 font-mono tracking-tight">
              {lectura.viento !== null ? lectura.viento : 'N/D'}
              <span className="text-xs font-semibold text-slate-500 ml-1">km/h</span>
            </p>
          </div>
          <span className="text-[10px] text-slate-400">Velocidad media estimada</span>
        </div>
      </div>

      {/* 3. Aviso de Calidad Parcial de Datos si corresponde */}
      {esParcial && (
        <div
          role="note"
          className="rounded-xl border border-amber-200 bg-amber-50/90 p-3 text-xs text-amber-950 leading-relaxed flex items-start gap-2 shadow-2xs"
        >
          <span className="font-bold shrink-0">⚠️ Nota de calidad de datos:</span>
          <span>
            La serie horaria contiene horas faltantes o nulas. Por rigor metodológico de PUKARA, los acumulados incompletos no se asumen como cero mm.
          </span>
        </div>
      )}

      {/* 4. Nota Metodológica al pie */}
      <footer className="text-[11px] text-slate-400 leading-normal px-1">
        ℹ️ {nota_modelo || 'Datos provenientes de modelo meteorológico (Open-Meteo), no equivalen a mediciones de estación pluviométrica local.'}
      </footer>
    </section>
  );
}
