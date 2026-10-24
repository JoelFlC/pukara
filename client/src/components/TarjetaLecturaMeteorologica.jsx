import React from 'react';
import {
  formatearFechaHoraLaPaz,
  formatearAntiguedad,
} from '../utils/formatoTiempo';

/**
 * Componente TarjetaLecturaMeteorologica
 * Despliega los datos de precipitación y variables atmosféricas de Llojeta
 * con trazabilidad explícita de procedencia, horas de observación y control de calidad.
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
        className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-3"
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
      className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4"
    >
      {/* 1. Encabezado de Trazabilidad */}
      <div className="space-y-2 border-b border-slate-100 pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
            Fuente: Open-Meteo (modelo meteorológico) · Modalidad: Lectura real
          </span>
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 text-slate-700">
            Antigüedad: {formatearAntiguedad(lectura.antiguedad_minutos)}
          </span>
        </div>

        <div className="text-xs text-slate-600 space-y-0.5">
          <p>
            <span className="font-semibold text-slate-700">Hora de observación del dato:</span>{' '}
            {formatearFechaHoraLaPaz(lectura.observado_en)}
          </p>
          <p className="text-[11px] text-slate-400 font-mono truncate">
            Origen en servidor: {origen_respuesta}
          </p>
        </div>

        {/* Banner de aviso si hubo fallo reciente en el servicio externo */}
        {fallo_api_reciente && (
          <div
            role="status"
            className="rounded-lg border border-amber-200 bg-amber-50 p-2.5 text-xs text-amber-900 leading-snug"
          >
            ⚠️ No se pudo actualizar con el servicio externo en este momento; mostrando última lectura válida almacenada y su antigüedad real.
          </div>
        )}
      </div>

      {/* 2. Grilla Principal de Precipitación (3 Tarjetas) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* Intensidad Horaria */}
        <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 flex flex-col justify-between">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
            Intensidad (última hora)
          </span>
          <div className="my-1.5">
            {lectura.intensidad_mm_h !== null ? (
              <span className="text-xl md:text-2xl font-bold text-slate-900 font-mono">
                {lectura.intensidad_mm_h}{' '}
                <span className="text-xs font-normal text-slate-500">mm/h</span>
              </span>
            ) : (
              <span className="text-sm font-semibold text-amber-700">
                Incompleto / Sin dato
              </span>
            )}
          </div>
          <span className="text-[10px] text-slate-400">Tasa horaria actual</span>
        </div>

        {/* Acumulado 24 Horas */}
        <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 flex flex-col justify-between">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
            Acumulado 24 horas
          </span>
          <div className="my-1.5">
            {lectura.acum_24h_mm !== null ? (
              <span className="text-xl md:text-2xl font-bold text-slate-900 font-mono">
                {lectura.acum_24h_mm}{' '}
                <span className="text-xs font-normal text-slate-500">mm</span>
              </span>
            ) : (
              <span className="text-xs font-semibold text-amber-700 leading-snug">
                Acumulado incompleto ({lectura.horas_validas_24h ?? 0}/24 h)
              </span>
            )}
          </div>
          <span className="text-[10px] text-slate-500">
            {lectura.horas_validas_24h ?? 0}/24 horas válidas
          </span>
        </div>

        {/* Acumulado 72 Horas */}
        <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 flex flex-col justify-between">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
            Acumulado 72 horas
          </span>
          <div className="my-1.5">
            {lectura.acum_72h_mm !== null ? (
              <span className="text-xl md:text-2xl font-bold text-slate-900 font-mono">
                {lectura.acum_72h_mm}{' '}
                <span className="text-xs font-normal text-slate-500">mm</span>
              </span>
            ) : (
              <span className="text-xs font-semibold text-amber-700 leading-snug">
                Acumulado incompleto ({lectura.horas_validas_72h ?? 0}/72 h)
              </span>
            )}
          </div>
          <span className="text-[10px] text-slate-500">
            {lectura.horas_validas_72h ?? 0}/72 horas válidas
          </span>
        </div>
      </div>

      {/* 3. Aviso de Calidad Parcial de Datos */}
      {esParcial && (
        <div
          role="note"
          className="rounded-lg border border-amber-200/80 bg-amber-50/70 p-2.5 text-xs text-amber-900 leading-relaxed"
        >
          <span className="font-semibold">Nota de calidad de datos:</span> La serie horaria contiene horas faltantes o nulas. Por rigor metodológico de PUKARA, los acumulados incompletos no se asumen como cero mm.
        </div>
      )}

      {/* 4. Variables Complementarias */}
      <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-100 text-center">
        <div className="p-2 rounded-lg bg-slate-50 border border-slate-100">
          <span className="text-[10px] font-medium text-slate-400 uppercase block">Temperatura</span>
          <span className="text-sm font-semibold text-slate-800 font-mono">
            {lectura.temperatura !== null ? `${lectura.temperatura} °C` : 'N/D'}
          </span>
        </div>
        <div className="p-2 rounded-lg bg-slate-50 border border-slate-100">
          <span className="text-[10px] font-medium text-slate-400 uppercase block">Humedad</span>
          <span className="text-sm font-semibold text-slate-800 font-mono">
            {lectura.humedad !== null ? `${lectura.humedad} %` : 'N/D'}
          </span>
        </div>
        <div className="p-2 rounded-lg bg-slate-50 border border-slate-100">
          <span className="text-[10px] font-medium text-slate-400 uppercase block">Viento (10m)</span>
          <span className="text-sm font-semibold text-slate-800 font-mono">
            {lectura.viento !== null ? `${lectura.viento} km/h` : 'N/D'}
          </span>
        </div>
      </div>

      {/* 5. Nota Metodológica al pie */}
      <footer className="pt-2 text-[11px] text-slate-400 leading-normal border-t border-slate-100">
        ℹ️ {nota_modelo || 'Datos provenientes de modelo meteorológico (Open-Meteo), no equivalen a mediciones de estación pluviométrica local.'}
      </footer>
    </section>
  );
}
