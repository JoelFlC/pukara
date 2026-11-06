import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  obtenerEstadoSistema,
  obtenerHistorialEvaluaciones,
  enviarLecturaSimulada,
  limpiarSimulacion,
} from '../services/api';
import AvisoPermanente from '../components/AvisoPermanente';
import BannerModoSimulacion from '../components/BannerModoSimulacion';
import BannerNivelInformativo from '../components/BannerNivelInformativo';
import RecomendacionesNivelVigente from '../components/RecomendacionesNivelVigente';
import TarjetaLecturaMeteorologica from '../components/TarjetaLecturaMeteorologica';
import HistorialEvaluaciones from '../components/HistorialEvaluaciones';
import ResumenZonaPiloto from '../components/ResumenZonaPiloto';

/**
 * Página principal mobile-first de PUKARA (Semana 2 - Día 6).
 * Conecta con GET /api/estado, GET /api/historial y permite la conmutación
 * e inyección de escenarios en modo simulación (Prueba P11) manteniendo aislamiento total.
 */
export default function InicioPage() {
  const [modalidad, setModalidad] = useState('real');
  const [estado, setEstado] = useState(null);
  const [historial, setHistorial] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [cargandoAccion, setCargandoAccion] = useState(false);
  const [errorConexion, setErrorConexion] = useState(null);
  const [mensajeExito, setMensajeExito] = useState(null);
  const [ultimaActualizacion, setUltimaActualizacion] = useState(null);

  /**
   * Carga el estado general del sistema y el historial de evaluaciones para la modalidad activa.
   */
  const cargarDatos = useCallback(
    async (signal, modActual = modalidad) => {
      try {
        setCargando(true);
        setErrorConexion(null);

        const [dataEstado, dataHistorial] = await Promise.all([
          obtenerEstadoSistema(modActual, { signal }),
          obtenerHistorialEvaluaciones(modActual, 10, { signal }).catch(
            (err) => {
              console.warn('Historial no disponible:', err.message);
              return { items: [], total: 0 };
            }
          ),
        ]);

        setEstado(dataEstado);
        setHistorial(dataHistorial);
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
    },
    [modalidad]
  );

  useEffect(() => {
    const controller = new AbortController();
    cargarDatos(controller.signal, modalidad);

    return () => {
      controller.abort();
    };
  }, [cargarDatos, modalidad]);

  /**
   * Conmuta la modalidad activa ('real' vs 'simulada').
   */
  const handleCambiarModalidad = (nuevaMod) => {
    if (nuevaMod === modalidad) return;
    setMensajeExito(null);
    setModalidad(nuevaMod);
  };

  /**
   * Dispara la inyección de un escenario académico en modo simulación (P11).
   */
  const handleInyectarEscenario = async (payload) => {
    try {
      setCargandoAccion(true);
      setErrorConexion(null);
      await enviarLecturaSimulada(payload);
      setMensajeExito('Escenario simulado inyectado y evaluado con éxito.');
      await cargarDatos(undefined, 'simulada');
    } catch (err) {
      setErrorConexion(`Error al inyectar escenario: ${err.message}`);
    } finally {
      setCargandoAccion(false);
      setTimeout(() => setMensajeExito(null), 4000);
    }
  };

  /**
   * Limpia los datos de simulación en base de datos sin tocar datos reales.
   */
  const handleLimpiarSimulacion = async () => {
    try {
      setCargandoAccion(true);
      setErrorConexion(null);
      await limpiarSimulacion();
      setMensajeExito('Datos simulados eliminados de PostgreSQL.');
      await cargarDatos(undefined, 'simulada');
    } catch (err) {
      setErrorConexion(`Error al limpiar simulación: ${err.message}`);
    } finally {
      setCargandoAccion(false);
      setTimeout(() => setMensajeExito(null), 4000);
    }
  };

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
              onClick={() => cargarDatos()}
              disabled={cargando || cargandoAccion}
              aria-label="Actualizar datos meteorológicos"
              className="min-h-[44px] min-w-[44px] px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-900 text-white hover:bg-slate-800 active:bg-slate-950 disabled:opacity-50 transition-colors inline-flex items-center justify-center gap-2 shadow-sm shrink-0"
            >
              <span
                className={cargando ? 'animate-spin inline-block' : ''}
                aria-hidden="true"
              >
                🔄
              </span>
              <span>{cargando ? 'Consultando...' : 'Actualizar'}</span>
            </button>
          </div>

          {ultimaActualizacion && (
            <p className="text-[10px] text-slate-400 text-right font-mono">
              Consulta local: {ultimaActualizacion.toLocaleTimeString()} · Modo:{' '}
              {modalidad}
            </p>
          )}
        </header>

        {/* 2. Aviso Permanente Obligatorio (Invariable, no cerrable) */}
        <AvisoPermanente />

        {/* 3. Selector de Modalidad y Banner de Demostración Simulación (P11) */}
        <BannerModoSimulacion
          modalidad={modalidad}
          esSimulacion={modalidad === 'simulada'}
          alCambiarModalidad={handleCambiarModalidad}
          alInyectarEscenario={handleInyectarEscenario}
          alLimpiarSimulacion={handleLimpiarSimulacion}
          cargando={cargando || cargandoAccion}
        />

        {/* Feedback de Éxito / Alertas temporales */}
        {mensajeExito && (
          <div
            role="status"
            className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-900 font-medium flex items-center gap-2 shadow-xs"
          >
            <span aria-hidden="true">✅</span>
            <span>{mensajeExito}</span>
          </div>
        )}

        {/* Mensaje de error de conexión */}
        {errorConexion && (
          <div
            role="alert"
            className="rounded-xl border border-red-200 bg-red-50 p-4 text-xs text-red-900 space-y-2 shadow-sm"
          >
            <p className="font-semibold flex items-center gap-1.5">
              <span>⚠️</span> Incidencia de comunicación con la API
            </p>
            <p className="text-red-800/90 leading-relaxed">{errorConexion}</p>
            <button
              type="button"
              onClick={() => cargarDatos()}
              className="min-h-[44px] px-3.5 py-1.5 rounded-lg bg-red-100 hover:bg-red-200 text-red-900 font-semibold text-xs transition-colors"
            >
              Reintentar consulta
            </button>
          </div>
        )}

        {/* 4. Banner Global del Nivel Informativo y Estado del Sistema (P06, P15) */}
        <BannerNivelInformativo estado={estado} />

        {/* 5. Recomendaciones Preventivas Generales del Nivel Vigente */}
        <RecomendacionesNivelVigente
          recomendaciones={estado?.recomendaciones_nivel_vigente}
          nivelVigente={estado?.nivel_vigente || 'NORMAL'}
        />

        {/* 6. Tarjeta de Variables Pluviométricas y Complementarias */}
        <TarjetaLecturaMeteorologica meteorologia={estado?.meteorologia} />

        {/* 7. Historial Reciente de Evaluaciones del Motor */}
        <HistorialEvaluaciones
          items={historial?.items}
          total={historial?.total}
          modalidad={modalidad}
          alRecargar={() => cargarDatos()}
          cargando={cargando}
        />

        {/* 8. Resumen de la Zona Piloto Llojeta y Puntos de Orientación */}
        <ResumenZonaPiloto
          zonaPiloto={estado?.zona_piloto}
          capasReferencia={estado?.capas_referencia}
        />

        {/* 9. Contactos de Emergencia y Auxilio Ciudadano en La Paz */}
        {estado?.contactos_emergencia && estado.contactos_emergencia.length > 0 && (
          <section
            aria-label="Contactos de emergencia"
            className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-3"
          >
            <div className="space-y-1 border-b border-slate-100 pb-2.5">
              <span className="text-[10px] font-bold tracking-wider text-slate-500 uppercase">
                Servicios de Emergencia y Auxilio
              </span>
              <h2 className="text-sm font-bold text-slate-900">
                Contactos Rápidos para La Paz / Cotahuma
              </h2>
            </div>
            <ul className="divide-y divide-slate-100 text-xs">
              {estado.contactos_emergencia.map((c) => (
                <li
                  key={c.id}
                  className="py-2.5 flex items-center justify-between gap-3"
                >
                  <div>
                    <p className="font-semibold text-slate-800">{c.nombre}</p>
                    <p className="text-[11px] text-slate-400 font-mono">
                      Fuente: {c.fuente || 'Institucional'}
                    </p>
                  </div>
                  <a
                    href={`tel:${c.telefono}`}
                    className="min-h-[44px] px-3.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-mono font-bold text-xs inline-flex items-center gap-1.5 transition-colors shadow-xs shrink-0"
                    title={`Llamar a ${c.nombre}`}
                  >
                    <span aria-hidden="true">📞</span>
                    <span>{c.telefono}</span>
                  </a>
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>
    </div>
  );
}
