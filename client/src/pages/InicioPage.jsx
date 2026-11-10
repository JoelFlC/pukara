import React, { useState, useEffect, useCallback, useRef } from 'react';
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
import AvisoCambioNivelInApp from '../components/AvisoCambioNivelInApp';
import SeccionRecomendaciones from '../components/SeccionRecomendaciones';
import SeccionContactosEmergencia from '../components/SeccionContactosEmergencia';
import TarjetaLecturaMeteorologica from '../components/TarjetaLecturaMeteorologica';
import HistorialEvaluaciones from '../components/HistorialEvaluaciones';
import ResumenZonaPiloto from '../components/ResumenZonaPiloto';
import MapaReferencial from '../components/MapaReferencial';
import EstadoPwaBanner from '../components/EstadoPwaBanner';
import BannerModoOffline from '../components/BannerModoOffline';
import {
  guardarUltimoEstadoLocal,
  obtenerUltimoEstadoLocal,
} from '../utils/offlineStorage';

/**
 * Página principal institucional de PUKARA (Estilo Bento Desktop + Mobile-First).
 * Conecta con GET /api/estado, GET /api/historial, gestiona el aviso visual in-app (P06)
 * y expone recomendaciones preventivas y contactos de auxilio ciudadano en La Paz.
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
  const [avisoOffline, setAvisoOffline] = useState(null);

  // Estados de conectividad y modo offline resiliente (Requisitos P08 y P10)
  const [sinConexionRed, setSinConexionRed] = useState(
    typeof navigator !== 'undefined' ? !navigator.onLine : false
  );
  const [usandoRespaldoOffline, setUsandoRespaldoOffline] = useState(false);
  const [infoRespaldoOffline, setInfoRespaldoOffline] = useState(null);

  // Estado para el aviso visual in-app de cambio de nivel (P06)
  const [cambioNivelDetectado, setCambioNivelDetectado] = useState(null);
  const ultimoNivelRef = useRef({ real: null, simulada: null });
  const inicializadoRef = useRef({ real: false, simulada: false });

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

        // Detección de cambio de nivel informativo in-app (Requisito P06)
        if (dataEstado && dataEstado.nivel_vigente) {
          const nuevoNivel = dataEstado.nivel_vigente;
          const fueInicializado = inicializadoRef.current[modActual];
          const nivelPrevio = ultimoNivelRef.current[modActual];

          if (!fueInicializado) {
            // Primera carga: registrar referencia base sin disparar alerta
            inicializadoRef.current[modActual] = true;
            ultimoNivelRef.current[modActual] = nuevoNivel;
          } else if (nivelPrevio && nivelPrevio !== nuevoNivel) {
            // Cambio posterior detectado en la misma modalidad: disparar aviso P06
            setCambioNivelDetectado({
              nivelAnterior: nivelPrevio,
              nivelNuevo: nuevoNivel,
              modalidad: modActual,
              detectadoEn: new Date().toISOString(),
              recomendacion:
                dataEstado.recomendacion ||
                dataEstado.recomendacion_vigente ||
                dataEstado.recomendaciones_nivel_vigente?.[0] ||
                null,
            });
            ultimoNivelRef.current[modActual] = nuevoNivel;
          }
        }

        if (dataEstado && modActual === 'real') {
          guardarUltimoEstadoLocal(dataEstado);
          setAvisoOffline(null);
        }

        setUsandoRespaldoOffline(false);
        setInfoRespaldoOffline(null);
        setEstado(dataEstado);
        setHistorial(dataHistorial);
        setUltimaActualizacion(new Date());
      } catch (err) {
        if (err.name !== 'AbortError') {
          // Intentar recuperación desde almacenamiento local offline (P08)
          const respaldoOffline = obtenerUltimoEstadoLocal();
          if (respaldoOffline && respaldoOffline.datos) {
            setEstado(respaldoOffline.datos);
            setAvisoOffline(respaldoOffline.aviso_offline);
            setUsandoRespaldoOffline(true);
            setInfoRespaldoOffline({
              fechaDatoIso:
                respaldoOffline.datos?.meteorologia?.observado_en ||
                respaldoOffline.fecha_dato_iso ||
                respaldoOffline.guardado_en,
              avisoOffline: respaldoOffline.aviso_offline,
              guardadoEnIso: respaldoOffline.guardado_en,
            });
            setErrorConexion(null);
          } else {
            setUsandoRespaldoOffline(false);
            setInfoRespaldoOffline(null);
            setErrorConexion(
              err.message ||
                'No se pudo conectar con el servidor PUKARA. Verifique su conexión o intente nuevamente.'
            );
          }
        }
      } finally {
        setCargando(false);
      }
    },
    [modalidad]
  );

  // Escucha activa de eventos de red online/offline (Requisito P08)
  useEffect(() => {
    const handleOnline = () => {
      setSinConexionRed(false);
      cargarDatos();
    };

    const handleOffline = () => {
      setSinConexionRed(true);
      const respaldoOffline = obtenerUltimoEstadoLocal();
      if (respaldoOffline && respaldoOffline.datos) {
        setEstado(respaldoOffline.datos);
        setAvisoOffline(respaldoOffline.aviso_offline);
        setUsandoRespaldoOffline(true);
        setInfoRespaldoOffline({
          fechaDatoIso:
            respaldoOffline.datos?.meteorologia?.observado_en ||
            respaldoOffline.fecha_dato_iso ||
            respaldoOffline.guardado_en,
          avisoOffline: respaldoOffline.aviso_offline,
          guardadoEnIso: respaldoOffline.guardado_en,
        });
        setErrorConexion(null);
      }
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('online', handleOnline);
      window.addEventListener('offline', handleOffline);
    }

    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
      }
    };
  }, [cargarDatos]);

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

  const estaOffline = usandoRespaldoOffline || sinConexionRed;

  return (
    <div id="monitoreo" className="min-h-screen bg-[#F4F7FB] text-slate-800 flex flex-col font-sans">
      {/* 1. Barra de Navegación Institucional Sticky */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200/80 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          {/* Logo y Denominación Institucional */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#0F172A] text-teal-400 flex items-center justify-center shrink-0 shadow-xs">
              <svg
                className="w-5 h-5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                <path d="M12 8v4" />
                <path d="M12 16h.01" />
              </svg>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-base tracking-tight text-slate-900">
                  PUKARA
                </span>
                <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200/70">
                  Llojeta
                </span>
              </div>
              <p className="text-[11px] text-slate-500 font-medium hidden sm:block">
                Monitoreo Informativo de Lluvias · Sector Llojeta
              </p>
            </div>
          </div>

          {/* Enlaces de Navegación Desktop */}
          <nav aria-label="Navegación principal desktop" className="hidden md:flex items-center gap-6 text-xs font-semibold text-slate-600">
            <a href="#monitoreo" className="hover:text-slate-900 transition-colors">
              Monitoreo
            </a>
            <a href="#telemetria" className="hover:text-slate-900 transition-colors">
              Telemetría
            </a>
            <a href="#prevencion" className="hover:text-slate-900 transition-colors">
              Prevención
            </a>
            <a href="#mapa" className="hover:text-slate-900 transition-colors">
              Mapa Referencial
            </a>
            <a href="#historial" className="hover:text-slate-900 transition-colors">
              Historial
            </a>
          </nav>

          {/* Indicador de Conexión y Acceso Administrativo */}
          <div className="flex items-center gap-3">
            {estaOffline ? (
              <span
                role="status"
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200"
              >
                <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" aria-hidden="true" />
                <span>Sin conexión</span>
              </span>
            ) : (
              <span
                role="status"
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200"
              >
                <span className="w-2 h-2 rounded-full bg-emerald-500" aria-hidden="true" />
                <span>En línea</span>
              </span>
            )}

            <Link
              to="/admin"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 transition-colors shrink-0"
              title="Acceso administrativo"
            >
              <span>Acceso Admin →</span>
            </Link>
          </div>
        </div>
      </header>

      {/* 2. Sub-barra de Control y Metadatos Operativos */}
      <div className="bg-white border-b border-slate-200/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-3 text-xs text-slate-500">
            <div>
              <span className="font-semibold text-slate-800">Sector Llojeta / Bajo Llojeta</span>
              <span className="hidden sm:inline"> · </span>
              <span>Macrodistrito Cotahuma, La Paz</span>
            </div>
            <span className="hidden md:inline text-slate-300">|</span>
            <span className="font-mono text-[11px] text-slate-400">
              Lat -16.5235 · Lon -68.1425
            </span>
            {ultimaActualizacion && (
              <>
                <span className="hidden md:inline text-slate-300">|</span>
                <span className="font-mono text-[11px] text-slate-500">
                  Consulta: {ultimaActualizacion.toLocaleTimeString()}
                </span>
              </>
            )}
          </div>

          <div className="flex items-center justify-between md:justify-end gap-3">
            {/* Segmented Pill Switcher de Modalidad */}
            <div className="inline-flex rounded-xl bg-slate-100 p-0.5 text-xs font-semibold text-slate-600 border border-slate-200/60">
              <button
                type="button"
                onClick={() => handleCambiarModalidad('real')}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  modalidad === 'real'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'hover:text-slate-900'
                }`}
              >
                Datos Reales (Open-Meteo)
              </button>
              <button
                type="button"
                onClick={() => handleCambiarModalidad('simulada')}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  modalidad === 'simulada'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'hover:text-slate-900'
                }`}
              >
                Modo Simulación (Demostración)
              </button>
            </div>

            {/* Botón táctil de actualización accesible (>= 44px) */}
            <button
              type="button"
              onClick={() => cargarDatos()}
              disabled={cargando || cargandoAccion}
              aria-label="Actualizar datos meteorológicos"
              className="min-h-[44px] min-w-[44px] px-3.5 py-2 rounded-xl text-xs font-semibold bg-[#0F172A] text-white hover:bg-slate-800 active:bg-slate-950 disabled:opacity-50 transition-colors inline-flex items-center justify-center gap-2 shadow-sm shrink-0 cursor-pointer"
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
        </div>
      </div>

      {/* 3. Contenedor Principal Bento Layout */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6 pb-24 md:pb-12 w-full flex-1">
        {/* Banner de instalación PWA (Requisito P12) */}
        <EstadoPwaBanner />

        {/* Banner de Consulta con Conectividad Limitada / Modo Avión (P08) */}
        <BannerModoOffline
          activo={estaOffline}
          fechaDatoIso={infoRespaldoOffline?.fechaDatoIso}
          avisoOffline={infoRespaldoOffline?.avisoOffline}
          guardadoEnIso={infoRespaldoOffline?.guardadoEnIso}
          onReintentar={() => cargarDatos()}
        />

        {/* Aviso Permanente Obligatorio (Invariable, no cerrable) */}
        <AvisoPermanente />

        {/* Panel de demostración en modo simulación (P11) */}
        <BannerModoSimulacion
          modalidad={modalidad}
          esSimulacion={modalidad === 'simulada'}
          alCambiarModalidad={handleCambiarModalidad}
          alInyectarEscenario={handleInyectarEscenario}
          alLimpiarSimulacion={handleLimpiarSimulacion}
          cargando={cargando || cargandoAccion}
        />

        {/* Aviso Visual In-App de Cambio de Nivel Informativo (Requisito P06) */}
        <AvisoCambioNivelInApp
          cambioNivel={cambioNivelDetectado}
          onCerrar={() => setCambioNivelDetectado(null)}
        />

        {/* Feedback de Éxito / Alertas temporales */}
        {mensajeExito && (
          <div
            role="status"
            className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3.5 text-xs text-emerald-900 font-medium flex items-center gap-2 shadow-xs"
          >
            <span aria-hidden="true">✅</span>
            <span>{mensajeExito}</span>
          </div>
        )}

        {/* Mensaje de error de conexión */}
        {errorConexion && (
          <div
            role="alert"
            className="rounded-2xl border border-red-200 bg-red-50 p-4 text-xs text-red-900 space-y-2 shadow-sm"
          >
            <p className="font-semibold flex items-center gap-1.5">
              <span>⚠️</span> Incidencia de comunicación con la API
            </p>
            <p className="text-red-800/90 leading-relaxed">{errorConexion}</p>
            <button
              type="button"
              onClick={() => cargarDatos()}
              className="min-h-[44px] px-3.5 py-1.5 rounded-xl bg-red-100 hover:bg-red-200 text-red-900 font-semibold text-xs transition-colors"
            >
              Reintentar consulta
            </button>
          </div>
        )}

        {/* FILA 1 (HERO): Banner Nivel Informativo + Bento Card Resumen Espacial */}
        <section aria-label="Nivel informativo y ámbito espacial" className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div className="lg:col-span-7 xl:col-span-8">
            <BannerNivelInformativo
              estado={estado}
              alInyectarPreset={(nivel, int, a24, a72) =>
                handleInyectarEscenario({
                  intensidad_mm_h: int,
                  acum_24h_mm: a24,
                  acum_72h_mm: a72,
                  observado_en: new Date().toISOString(),
                })
              }
            />
          </div>

          <div className="lg:col-span-5 xl:col-span-4 rounded-2xl border border-slate-200/80 bg-white p-5 md:p-6 shadow-sm flex flex-col justify-between space-y-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-3">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  Ámbito Espacial de Consulta
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-teal-50 text-teal-700 border border-teal-200">
                  Sector Piloto Activo
                </span>
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  Sector Llojeta / Bajo Llojeta
                </h2>
                <p className="text-xs text-slate-500 font-mono mt-0.5">
                  Lat -16.5235 · Lon -68.1425 (La Paz, BOT)
                </p>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                El nivel informativo de lluvia se calcula con una sola consulta meteorológica para toda la zona piloto de Llojeta y no varía espacialmente dentro del sector.
              </p>
              <div className="grid grid-cols-2 gap-2 pt-1">
                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 text-center">
                  <span className="block text-lg font-extrabold text-slate-800">
                    {(estado?.zonas_referencia || estado?.capas_referencia?.zonas || []).length || 2}
                  </span>
                  <span className="text-[10px] text-slate-500 font-medium">
                    Polígonos en cuenca
                  </span>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 text-center">
                  <span className="block text-lg font-extrabold text-slate-800">
                    {(estado?.puntos_referencia || estado?.capas_referencia?.puntos || []).length || 6}
                  </span>
                  <span className="text-[10px] text-slate-500 font-medium">
                    Puntos referenciales
                  </span>
                </div>
              </div>
              <div className="rounded-xl bg-slate-50 border border-slate-200/80 p-3 text-xs text-slate-700 space-y-1">
                <div className="flex items-center gap-1.5 font-semibold text-[11px] text-slate-900">
                  <span>📍</span>
                  <span>Proximidad Haversine en el Dispositivo</span>
                </div>
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  Cálculo ejecutado 100% en el dispositivo móvil. Sus coordenadas GPS jamás se envían ni se almacenan en el servidor.
                </p>
              </div>
            </div>

            <a
              href="#mapa"
              className="w-full py-2.5 px-3 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 font-semibold text-xs text-center transition-colors block mt-2"
            >
              Explorar mapa y puntos referenciales ↓
            </a>
          </div>
        </section>

        {/* FILA 2: Telemetría Pluviométrica */}
        <section id="telemetria" aria-label="Telemetría meteorológica">
          <TarjetaLecturaMeteorologica meteorologia={estado?.meteorologia} />
        </section>

        {/* FILA 3: Recomendaciones Preventivas y Contactos de Emergencia */}
        <section id="prevencion" aria-label="Prevención y auxilio" className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div className="lg:col-span-7">
            <SeccionRecomendaciones
              nivelVigente={estado?.nivel_vigente || 'NORMAL'}
              estadoSistema={estado?.estado_sistema || 'NORMAL'}
              recomendacionVigente={estado?.recomendacion || estado?.recomendacion_vigente}
              recomendacionesPublicadas={
                estado?.recomendaciones_publicadas || estado?.recomendaciones || []
              }
            />
          </div>

          <div id="contactos" className="lg:col-span-5">
            <SeccionContactosEmergencia
              contactos={estado?.contactos_emergencia || estado?.contactos || []}
            />
          </div>
        </section>

        {/* FILA 4: Mapa Referencial Leaflet y Distancias Haversine */}
        <section id="mapa" aria-label="Mapa cartográfico referencial">
          <MapaReferencial
            zonasReferencia={
              estado?.zonas_referencia || estado?.capas_referencia?.zonas || []
            }
            puntosReferencia={
              estado?.puntos_referencia || estado?.capas_referencia?.puntos || []
            }
            coordenadaCentral={
              estado?.coordenada_central ||
              estado?.zona_piloto || {
                latitud: -16.5235,
                longitud: -68.1425,
              }
            }
            nivelVigente={estado?.nivel_vigente || 'NORMAL'}
            modoOffline={estaOffline}
          />
        </section>

        {/* FILA 5: Historial Reciente de Evaluaciones */}
        <section id="historial" aria-label="Historial de evaluaciones">
          <HistorialEvaluaciones
            items={historial?.items}
            total={historial?.total}
            modalidad={modalidad}
            alRecargar={() => cargarDatos()}
            cargando={cargando}
          />
        </section>

        {/* FILA 6: Resumen Detallado de la Zona Piloto Llojeta */}
        <section aria-label="Detalle de zona piloto y capas referenciales">
          <ResumenZonaPiloto
            zonaPiloto={estado?.zona_piloto}
            capasReferencia={estado?.capas_referencia}
          />
        </section>
      </main>

      {/* 4. Barra de Navegación Inferior Móvil (Mobile Bottom Bar) */}
      <nav
        aria-label="Navegación móvil inferior"
        className="md:hidden fixed bottom-0 inset-x-0 bg-white/95 backdrop-blur-md border-t border-slate-200/90 z-40 py-2 px-3 flex items-center justify-around text-xs shadow-lg"
      >
        <a
          href="#monitoreo"
          className="flex flex-col items-center gap-0.5 text-slate-600 hover:text-slate-900 active:text-indigo-600 py-1 px-2"
        >
          <span className="text-base" aria-hidden="true">🌧️</span>
          <span className="text-[10px] font-semibold">Monitoreo</span>
        </a>
        <a
          href="#telemetria"
          className="flex flex-col items-center gap-0.5 text-slate-600 hover:text-slate-900 active:text-indigo-600 py-1 px-2"
        >
          <span className="text-base" aria-hidden="true">📊</span>
          <span className="text-[10px] font-semibold">Telemetría</span>
        </a>
        <a
          href="#prevencion"
          className="flex flex-col items-center gap-0.5 text-slate-600 hover:text-slate-900 active:text-indigo-600 py-1 px-2"
        >
          <span className="text-base" aria-hidden="true">🛡️</span>
          <span className="text-[10px] font-semibold">Prevención</span>
        </a>
        <a
          href="#mapa"
          className="flex flex-col items-center gap-0.5 text-slate-600 hover:text-slate-900 active:text-indigo-600 py-1 px-2"
        >
          <span className="text-base" aria-hidden="true">🗺️</span>
          <span className="text-[10px] font-semibold">Mapa</span>
        </a>
        <Link
          to="/admin"
          className="flex flex-col items-center gap-0.5 text-slate-600 hover:text-slate-900 active:text-indigo-600 py-1 px-2"
        >
          <span className="text-base" aria-hidden="true">⚙️</span>
          <span className="text-[10px] font-semibold">Admin</span>
        </Link>
      </nav>
    </div>
  );
}
