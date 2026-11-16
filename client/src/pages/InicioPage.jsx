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

const ESCALA_NIVELES_V1 = [
  {
    clave: 'NORMAL',
    titulo: 'Normal',
    criterio: '< 2.5 mm/h · < 10 mm/24h',
    dot: 'bg-[#059669]',
    activoBg: 'bg-[#ECFDF5] border-[#A7F3D0] text-[#065F46]',
  },
  {
    clave: 'PRECAUCION',
    titulo: 'Precaución',
    criterio: '≥ 2.5 mm/h · ≥ 10 mm/24h',
    dot: 'bg-[#B45309]',
    activoBg: 'bg-[#FEF3C7] border-[#FDE68A] text-[#92400E]',
  },
  {
    clave: 'ALERTA',
    titulo: 'Alerta',
    criterio: '≥ 6.5 mm/h o saturación 72h',
    dot: 'bg-[#C2410C]',
    activoBg: 'bg-[#FFEDD5] border-[#FED7AA] text-[#9A3412]',
  },
  {
    clave: 'EMERGENCIA',
    titulo: 'Emergencia',
    criterio: '≥ 12.0 mm/h · ≥ 40 mm/24h',
    dot: 'bg-[#DC2626]',
    activoBg: 'bg-[#FEE2E2] border-[#FECACA] text-[#991B1B]',
  },
];

/**
 * Página principal institucional de PUKARA (Swiss Grid + Claymorphism + Scrollytelling Mobile-First).
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
            inicializadoRef.current[modActual] = true;
            ultimoNivelRef.current[modActual] = nuevoNivel;
          } else if (nivelPrevio && nivelPrevio !== nuevoNivel) {
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

  const handleCambiarModalidad = (nuevaMod) => {
    if (nuevaMod === modalidad) return;
    setMensajeExito(null);
    setModalidad(nuevaMod);
  };

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
  const nivelActivoActual = estado?.nivel_vigente || null;

  return (
    <div id="monitoreo" className="min-h-screen bg-[#F6F8FA] text-[#111C2D] flex flex-col font-sans overflow-x-hidden max-w-full">
      {/* 1. Barra de Navegación Institucional Sticky (Swiss Grid) */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200/80 shadow-xs">
        <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 min-h-[68px] py-2 flex items-center justify-between gap-3">
          {/* Logo y Denominación Institucional */}
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-[#3525CD] text-white flex items-center justify-center shrink-0 shadow-sm clay-pill">
              <svg
                className="w-5 h-5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                <path d="M12 8v4" />
                <path d="M12 16h.01" />
              </svg>
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="display-hero font-extrabold text-lg tracking-tight text-[#111C2D]">
                  PUKARA
                </span>
                <span className="clay-pill text-[11px] font-bold uppercase tracking-wider px-2.5 py-0.5 bg-[#EEF2FF] text-[#3525CD] border border-[#E2DFFF]">
                  Llojeta
                </span>
              </div>
              <p className="text-xs text-[#464555] font-medium hidden sm:block truncate">
                Consulta Informativa de Lluvias · Sector Llojeta
              </p>
            </div>
          </div>

          {/* Enlaces de Navegación Desktop por Capítulos */}
          <nav aria-label="Navegación principal desktop" className="hidden lg:flex items-center gap-1.5 text-sm font-semibold text-[#464555]">
            <a href="#monitoreo" className="px-3 py-2 rounded-full hover:bg-[#F0F3FF] hover:text-[#3525CD] transition-colors">
              Estado en Vivo
            </a>
            <a href="#prevencion" className="px-3 py-2 rounded-full hover:bg-[#F0F3FF] hover:text-[#3525CD] transition-colors">
              01 Guía Preventiva
            </a>
            <a href="#mapa" className="px-3 py-2 rounded-full hover:bg-[#F0F3FF] hover:text-[#3525CD] transition-colors">
              02 Mapa Referencial
            </a>
            <a href="#contactos" className="px-3 py-2 rounded-full hover:bg-[#F0F3FF] hover:text-[#3525CD] transition-colors">
              03 Teléfonos Rápidos
            </a>
            <a href="#historial" className="px-3 py-2 rounded-full hover:bg-[#F0F3FF] hover:text-[#3525CD] transition-colors">
              Historial
            </a>
          </nav>

          {/* Indicador de Conexión y Acceso Administrativo */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            {estaOffline ? (
              <span
                role="status"
                className="clay-pill inline-flex items-center gap-1.5 px-3 py-1.5 text-xs sm:text-sm font-bold bg-[#FEF3C7] text-[#92400E] border border-[#FDE68A]"
              >
                <span className="w-2 h-2 rounded-full bg-[#B45309] animate-pulse" aria-hidden="true" />
                <span>Sin conexión</span>
              </span>
            ) : (
              <span
                role="status"
                className="clay-pill inline-flex items-center gap-1.5 px-3 py-1.5 text-xs sm:text-sm font-bold bg-[#ECFDF5] text-[#065F46] border border-[#A7F3D0]"
              >
                <span className="w-2 h-2 rounded-full bg-[#059669] clay-beacon-pulse" aria-hidden="true" />
                <span className="hidden xs:inline sm:inline">En línea</span>
              </span>
            )}

            <Link
              to="/admin"
              className="clay-btn-secondary clay-interactive min-h-[44px] sm:min-h-[48px] inline-flex items-center justify-center gap-1.5 px-3.5 sm:px-4 py-2 text-xs sm:text-sm font-bold text-[#111C2D] shrink-0"
              title="Acceso administrativo"
            >
              <span>Acceso Admin →</span>
            </Link>
          </div>
        </div>
      </header>

      {/* 2. Sub-barra de Control de Modalidad y Metadatos Operativos */}
      <div className="bg-white/80 border-b border-slate-200/80">
        <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-[#464555] min-w-0">
            <div>
              <span className="font-bold text-[#111C2D]">Sector Llojeta / Bajo Llojeta</span>
              <span className="hidden sm:inline"> · </span>
              <span className="block sm:inline">Macrodistrito Cotahuma, La Paz</span>
            </div>
            <span className="hidden md:inline text-slate-300">|</span>
            <span className="font-mono text-xs sm:text-sm text-[#475569]">
              Lat -16.5235 · Lon -68.1425
            </span>
            {ultimaActualizacion && (
              <>
                <span className="hidden md:inline text-slate-300">|</span>
                <span className="font-mono text-xs sm:text-sm text-[#475569]">
                  Consulta: {ultimaActualizacion.toLocaleTimeString()}
                </span>
              </>
            )}
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between lg:justify-end gap-2.5 w-full lg:w-auto">
            {/* Segmented Pill Switcher de Modalidad (Táctil 48px+) */}
            <div className="grid grid-cols-1 sm:inline-grid sm:grid-cols-2 gap-1 rounded-2xl bg-[#F0F3FF] p-1 text-xs sm:text-sm font-bold border border-[#E2DFFF] w-full sm:w-auto">
              <button
                type="button"
                onClick={() => handleCambiarModalidad('real')}
                className={`min-h-[48px] px-3.5 py-2 rounded-xl transition-all cursor-pointer ${
                  modalidad === 'real'
                    ? 'bg-[#3525CD] text-white shadow-sm'
                    : 'text-[#464555] hover:text-[#111C2D]'
                }`}
              >
                Datos Reales (Open-Meteo)
              </button>
              <button
                type="button"
                onClick={() => handleCambiarModalidad('simulada')}
                className={`min-h-[48px] px-3.5 py-2 rounded-xl transition-all cursor-pointer ${
                  modalidad === 'simulada'
                    ? 'bg-[#111C2D] text-white shadow-sm'
                    : 'text-[#464555] hover:text-[#111C2D]'
                }`}
              >
                Modo Simulación (Demostración)
              </button>
            </div>

            {/* Botón táctil de actualización accesible (>= 48px) */}
            <button
              type="button"
              onClick={() => cargarDatos()}
              disabled={cargando || cargandoAccion}
              aria-label="Actualizar datos meteorológicos"
              className="clay-btn-primary clay-interactive min-h-[48px] min-w-[48px] px-5 py-2 text-sm font-bold disabled:opacity-50 inline-flex items-center justify-center gap-2 shrink-0 cursor-pointer"
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

      {/* 3. Contenedor Principal Scrollytelling sobre Retícula Suiza */}
      <main className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6 sm:space-y-10 pb-24 md:pb-12 w-full flex-1">
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
          nivelActual={estado?.nivel_vigente}
          alCambiarModalidad={handleCambiarModalidad}
          alInyectarEscenario={handleInyectarEscenario}
          alLimpiarSimulacion={handleLimpiarSimulacion}
          cargando={cargando || cargandoAccion}
          ocultarSelector={true}
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
            className="clay-card-sm border border-[#A7F3D0] bg-[#ECFDF5] p-4 text-base text-[#065F46] font-semibold flex items-center gap-2.5 animate-fade-up"
          >
            <span aria-hidden="true">✅</span>
            <span>{mensajeExito}</span>
          </div>
        )}

        {/* Mensaje de error de conexión */}
        {errorConexion && (
          <div
            role="alert"
            className="clay-card-sm border border-[#FECACA] bg-[#FEE2E2] p-4 sm:p-5 text-base text-[#991B1B] space-y-3"
          >
            <p className="font-bold flex items-center gap-2">
              <span aria-hidden="true">⚠️</span> Incidencia de comunicación con la API
            </p>
            <p className="leading-relaxed">{errorConexion}</p>
            <button
              type="button"
              onClick={() => cargarDatos()}
              className="clay-btn-danger clay-interactive min-h-[48px] px-5 py-2 text-sm font-bold cursor-pointer"
            >
              Reintentar consulta
            </button>
          </div>
        )}

        {/* FILA 1 (HERO DIAGNÓSTICO + ESCALA DE 4 NIVELES Y ÁMBITO ESPACIAL) */}
        <section aria-label="Nivel informativo y ámbito espacial" className="grid grid-cols-1 lg:grid-cols-12 gap-5 lg:gap-8 items-start">
          {/* Diagnóstico Principal (Primero en móvil) */}
          <div className="lg:col-span-7">
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

          {/* Columna Derecha: Escala de los 4 Niveles + Ámbito Espacial Llojeta */}
          <div className="lg:col-span-5 clay-card p-5 sm:p-6 flex flex-col justify-between space-y-5 animate-fade-up">
            {/* Escala de 4 Niveles */}
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
                <span className="swiss-chapter-badge">
                  Escala de 4 Niveles
                </span>
                <span className="clay-pill px-2.5 py-0.5 text-xs font-bold bg-[#F0F3FF] text-[#3525CD] border border-[#E2DFFF]">
                  Umbrales v{estado?.version_reglas?.version ?? 1}
                </span>
              </div>

              <ul className="space-y-2">
                {ESCALA_NIVELES_V1.map((item) => {
                  const esVigente = nivelActivoActual === item.clave;
                  return (
                    <li
                      key={item.clave}
                      className={`p-3 rounded-2xl border flex items-center justify-between gap-2 transition-all ${
                        esVigente
                          ? `${item.activoBg} shadow-xs font-bold`
                          : 'bg-[#F9F9FF] border-slate-200/80 text-[#464555]'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className={`w-3 h-3 rounded-full ${item.dot} shrink-0`} aria-hidden="true" />
                        <span className="text-sm sm:text-base font-bold text-[#111C2D]">
                          {item.titulo}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-xs font-mono hidden sm:inline">
                          {item.criterio}
                        </span>
                        {esVigente && (
                          <span className="clay-pill bg-white/95 text-[#111C2D] px-2.5 py-0.5 text-xs font-extrabold border border-black/10">
                            Vigente
                          </span>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>

            {/* Ámbito Espacial Compacto */}
            <div className="space-y-3 pt-2 border-t border-slate-100">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="headline-sm text-base sm:text-lg font-bold text-[#111C2D]">
                  Sector Llojeta / Bajo Llojeta
                </h2>
                <span className="clay-pill px-2.5 py-0.5 text-xs font-bold bg-[#ECFDF5] text-[#065F46] border border-[#A7F3D0]">
                  Sector Piloto Activo
                </span>
              </div>
              <p className="text-xs sm:text-sm text-[#475569] font-mono">
                Lat -16.5235 · Lon -68.1425 (La Paz, BOT)
              </p>

              <div className="grid grid-cols-2 gap-3">
                <div className="clay-card-sm bg-[#F9F9FF] p-3 text-center">
                  <span className="telemetry-num block text-2xl font-extrabold text-[#111C2D]">
                    {(estado?.zonas_referencia || estado?.capas_referencia?.zonas || []).length || 2}
                  </span>
                  <span className="text-xs sm:text-sm text-[#464555] font-medium">
                    Polígonos en cuenca
                  </span>
                </div>
                <div className="clay-card-sm bg-[#F9F9FF] p-3 text-center">
                  <span className="telemetry-num block text-2xl font-extrabold text-[#111C2D]">
                    {(estado?.puntos_referencia || estado?.capas_referencia?.puntos || []).length || 6}
                  </span>
                  <span className="text-xs sm:text-sm text-[#464555] font-medium">
                    Puntos referenciales
                  </span>
                </div>
              </div>

              <a
                href="#mapa"
                className="clay-btn-secondary clay-interactive min-h-[48px] w-full px-4 py-2.5 text-sm sm:text-base font-bold text-[#111C2D] inline-flex items-center justify-center gap-2 text-center"
              >
                <span>Explorar mapa y puntos referenciales ↓</span>
              </a>
            </div>
          </div>
        </section>

        {/* FILA 2: Telemetría Pluviométrica Esencial */}
        <section id="telemetria" aria-label="Telemetría meteorológica">
          <TarjetaLecturaMeteorologica meteorologia={estado?.meteorologia} />
        </section>

        {/* CAPÍTULO 01: Guía de Acción Preventiva */}
        <section id="prevencion" aria-label="Capítulo 01: Recomendaciones preventivas">
          <SeccionRecomendaciones
            nivelVigente={estado?.nivel_vigente || 'NORMAL'}
            estadoSistema={estado?.estado_sistema || 'NORMAL'}
            recomendacionVigente={estado?.recomendacion || estado?.recomendacion_vigente}
            recomendacionesPublicadas={
              estado?.recomendaciones_publicadas || estado?.recomendaciones || []
            }
          />
        </section>

        {/* CAPÍTULO 02: Cartografía de Referencia y Cercanía Haversine */}
        <section id="mapa" aria-label="Capítulo 02: Mapa cartográfico referencial">
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

        {/* CAPÍTULO 03: Teléfonos Rápidos de Emergencia */}
        <section id="contactos" aria-label="Capítulo 03: Contactos rápidos de emergencia">
          <SeccionContactosEmergencia
            contactos={estado?.contactos_emergencia || estado?.contactos || []}
          />
        </section>

        {/* TRAZABILIDAD TÉCNICA SECUNDARIA: Historial y Resumen Espacial */}
        <section id="historial" aria-label="Historial de evaluaciones y detalle de zona" className="space-y-6">
          <HistorialEvaluaciones
            items={historial?.items}
            total={historial?.total}
            modalidad={modalidad}
            alRecargar={() => cargarDatos()}
            cargando={cargando}
          />

          <ResumenZonaPiloto
            zonaPiloto={estado?.zona_piloto}
            capasReferencia={estado?.capas_referencia}
          />
        </section>
      </main>

      {/* 4. Barra de Navegación Inferior Móvil (Mobile Bottom Bar Ergonométrica) */}
      <nav
        aria-label="Navegación móvil inferior"
        className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200/80 px-2 py-1.5 shadow-lg"
      >
        <div className="grid grid-cols-5 gap-1 items-center max-w-md mx-auto">
          <a
            href="#monitoreo"
            className="min-h-[48px] flex flex-col items-center justify-center gap-0.5 rounded-xl text-[#464555] hover:text-[#3525CD] active:bg-[#EEF2FF] py-1 px-1"
          >
            <span className="text-lg leading-none" aria-hidden="true">🌧️</span>
            <span className="text-[11px] font-bold">Estado</span>
          </a>
          <a
            href="#prevencion"
            className="min-h-[48px] flex flex-col items-center justify-center gap-0.5 rounded-xl text-[#464555] hover:text-[#3525CD] active:bg-[#EEF2FF] py-1 px-1"
          >
            <span className="text-lg leading-none" aria-hidden="true">🛡️</span>
            <span className="text-[11px] font-bold">Guía</span>
          </a>
          <a
            href="#mapa"
            className="min-h-[48px] flex flex-col items-center justify-center gap-0.5 rounded-xl text-[#464555] hover:text-[#3525CD] active:bg-[#EEF2FF] py-1 px-1"
          >
            <span className="text-lg leading-none" aria-hidden="true">🗺️</span>
            <span className="text-[11px] font-bold">Mapa</span>
          </a>
          <a
            href="#contactos"
            className="min-h-[48px] flex flex-col items-center justify-center gap-0.5 rounded-xl text-[#991B1B] hover:text-[#DC2626] active:bg-[#FEE2E2] py-1 px-1"
          >
            <span className="text-lg leading-none" aria-hidden="true">📞</span>
            <span className="text-[11px] font-bold">Auxilio</span>
          </a>
          <Link
            to="/admin"
            className="min-h-[48px] flex flex-col items-center justify-center gap-0.5 rounded-xl text-[#464555] hover:text-[#3525CD] active:bg-[#EEF2FF] py-1 px-1"
          >
            <span className="text-lg leading-none" aria-hidden="true">⚙️</span>
            <span className="text-[11px] font-bold">Admin</span>
          </Link>
        </div>
      </nav>
    </div>
  );
}
