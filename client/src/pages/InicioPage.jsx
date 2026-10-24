import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { consultarEstadoSistema } from '../services/api';
import AvisoPermanente from '../components/AvisoPermanente';
import TarjetaLecturaMeteorologica from '../components/TarjetaLecturaMeteorologica';
import ResumenZonaPiloto from '../components/ResumenZonaPiloto';

/**
 * Página principal mobile-first de PUKARA (v1).
 * Conecta con GET /api/estado para desplegar condiciones meteorológicas reales,
 * calidad horaria, puntos referenciales y aviso permanente.
 */
export default function InicioPage() {
  const [estado, setEstado] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [errorConexion, setErrorConexion] = useState(null);
  const [ultimaActualizacion, setUltimaActualizacion] = useState(null);

  const cargarEstado = useCallback(async (signal) => {
    try {
      setCargando(true);
      setErrorConexion(null);
      const data = await consultarEstadoSistema({ signal });
      setEstado(data);
      setUltimaActualizacion(new Date());
    } catch (err) {
      if (err.name !== 'AbortError') {
        setErrorConexion(
          err.message ||
            'No se pudo conectar con el servidor PUKARA. Verifique su conexión o intente nuevamente.'
        );
      }
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    cargarEstado(controller.signal);

    return () => {
      controller.abort();
    };
  }, [cargarEstado]);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 p-3 sm:p-4 md:p-6 flex flex-col items-center">
      <main className="w-full max-w-lg mx-auto space-y-4">
        {/* 1. Cabecera principal compacta con botón de recarga */}
        <header className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
            <div className="flex items-center gap-2">
              <span className="text-lg" aria-hidden="true">
                🌧️
              </span>
              <span className="text-xs font-bold tracking-wider text-slate-500 uppercase">
                PUKARA · Monitoreo Informativo
              </span>
            </div>
            <Link
              to="/admin"
              className="text-[11px] font-medium text-slate-400 hover:text-slate-700 transition-colors py-1 px-1.5"
              title="Acceso administrativo"
            >
              Acceso Admin →
            </Link>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h1 className="text-lg sm:text-xl font-bold tracking-tight text-slate-900 leading-snug">
                Sector Llojeta / Bajo Llojeta
              </h1>
              <p className="text-xs text-slate-500">
                Macrodistrito Cotahuma, La Paz · Consulta informativa de lluvias
              </p>
            </div>

            {/* Botón táctil con área mínima accesible (>= 44px) */}
            <button
              type="button"
              onClick={() => cargarEstado()}
              disabled={cargando}
              aria-label="Actualizar datos meteorológicos"
              className="min-h-[44px] min-w-[44px] px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-900 text-white hover:bg-slate-800 active:bg-slate-950 disabled:opacity-50 transition-colors inline-flex items-center justify-center gap-2 shadow-sm shrink-0"
            >
              <span className={cargando ? 'animate-spin inline-block' : ''} aria-hidden="true">
                🔄
              </span>
              <span>{cargando ? 'Consultando...' : 'Actualizar'}</span>
            </button>
          </div>

          {ultimaActualizacion && (
            <p className="text-[10px] text-slate-400 text-right font-mono">
              Consulta local: {ultimaActualizacion.toLocaleTimeString()}
            </p>
          )}
        </header>

        {/* 2. Aviso Permanente Obligatorio (no cerrable) */}
        <AvisoPermanente />

        {/* 3. Mensaje de error de conexión si el backend está caído */}
        {errorConexion && (
          <div
            role="alert"
            className="rounded-xl border border-red-200 bg-red-50 p-4 text-xs text-red-900 space-y-2 shadow-sm"
          >
            <p className="font-semibold flex items-center gap-1.5">
              <span>⚠️</span> Sin comunicación con el servidor local
            </p>
            <p className="text-red-800/90 leading-relaxed">{errorConexion}</p>
            <button
              type="button"
              onClick={() => cargarEstado()}
              className="min-h-[44px] px-3 py-1.5 rounded-lg bg-red-100 hover:bg-red-200 text-red-900 font-medium text-xs transition-colors"
            >
              Reintentar conexión
            </button>
          </div>
        )}

        {/* 4. Nota de estado del sprint v1 */}
        {estado?.clasificacion?.mensaje && (
          <div
            role="note"
            className="rounded-xl border border-blue-100 bg-blue-50/60 p-3.5 text-xs text-blue-950 space-y-1 shadow-xs"
          >
            <div className="flex items-center gap-1.5 font-semibold text-blue-900">
              <span aria-hidden="true">📋</span>
              <span>Fase de Verificación Meteorológica (Semana 1)</span>
            </div>
            <p className="text-blue-900/80 leading-relaxed">
              {estado.clasificacion.mensaje}
            </p>
          </div>
        )}

        {/* 5. Tarjeta de Lectura Meteorológica */}
        <TarjetaLecturaMeteorologica meteorologia={estado?.meteorologia} />

        {/* 6. Resumen de la Zona Piloto y Puntos de Referencia */}
        <ResumenZonaPiloto
          zonaPiloto={estado?.zona_piloto}
          capasReferencia={estado?.capas_referencia}
        />
      </main>
    </div>
  );
}
