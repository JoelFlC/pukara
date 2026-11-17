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

const TINTE_NAVBAR_POR_NIVEL = {
  NORMAL: 'bg-[#ECFDF5]/80 border-[#A7F3D0]/70',
  PRECAUCION: 'bg-[#FEF3C7]/80 border-[#FDE68A]/80',
  ALERTA: 'bg-[#FFEDD5]/80 border-[#FED7AA]/80',
  EMERGENCIA: 'bg-[#FEE2E2]/80 border-[#FECACA]/80',
};

/**
 * Página principal institucional de PUKARA (Swiss Grid + Claymorphism + Scrollytelling Mobile-First).
 * Diseño simplificado para lectura inmediata por personas jóvenes y adultos mayores,
 * con degradado pastel suave, Hero destacado e integración visual con el navbar.
 */
export default function InicioPage() {
  const [modalidad, setModalidad] = useState('real');
  const [estado, setEstado] = useState(null);
  const [historial, setHistorial] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [cargandoAccion, setCargandoAccion] = useState(false);
  const [errorConexion, setErrorConexion] = useState(null);
  const [mensajeExito, setMensajeExito] = useState(null);

  const [sinConexionRed, setSinConexionRed] = useState(
    typeof navigator !== 'undefined' ? !navigator.onLine : false
  );
  const [usandoRespaldoOffline, setUsandoRespaldoOffline] = useState(false);
  const [infoRespaldoOffline, setInfoRespaldoOffline] = useState(null);

  const [cambioNivelDetectado, setCambioNivelDetectado] = useState(null);
  const ultimoNivelRef = useRef({ real: null, simulada: null });
  const inicializadoRef = useRef({ real: false, simulada: false });

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
        }

        setUsandoRespaldoOffline(false);
        setInfoRespaldoOffline(null);
        setEstado(dataEstado);
        setHistorial(dataHistorial);
      } catch (err) {
        if (err.name !== 'AbortError') {
          const respaldoOffline = obtenerUltimoEstadoLocal();
          if (respaldoOffline && respaldoOffline.datos) {
            setEstado(respaldoOffline.datos);
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
  const tinteNavbar =
    TINTE_NAVBAR_POR_NIVEL[estado?.nivel_vigente] ||
    'bg-[#F7F9FF]/90 border-indigo-100/80';

  return (
    <div
      id="monitoreo"
      className="min-h-screen bg-gradient-to-b from-[#F7F9FF] via-[#F2F6FC] to-[#F5FAF8] text-[#111C2D] flex flex-col font-sans overflow-x-hidden max-w-full"
    >
      {/* 1. Cinta Superior Institucional Oscura */}
      <div className="bg-[#111C2D] text-white text-[11px] font-bold tracking-wider uppercase py-1.5 px-4 text-center">
        • MONITOREO PREVENTIVO ACTIVO · SECTOR LLOJETA — COTAHUMA •
      </div>

      {/* 2. Header Unificado e Integrado Cromáticamente con el Hero Banner */}
      <header className={`sticky top-0 z-30 backdrop-blur-md border-b shadow-2xs transition-colors ${tinteNavbar}`}>
        <div className="max-w-[1520px] w-[95%] mx-auto px-4 sm:px-6 lg:px-10 py-2.5 flex flex-wrap items-center justify-between gap-3">
          {/* Izquierda: Logo e Identidad */}
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
                {estaOffline ? (
                  <span
                    role="status"
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-white/90 text-[#92400E] border border-[#FDE68A]"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-[#B45309] animate-pulse" aria-hidden="true" />
                    <span>Sin conexión</span>
                  </span>
                ) : (
                  <span
                    role="status"
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-white/90 text-[#065F46] border border-[#A7F3D0]"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-[#059669] clay-beacon-pulse" aria-hidden="true" />
                    <span>En línea</span>
                  </span>
                )}
              </div>
              <p className="text-xs text-[#464555] font-medium truncate">
                Sector Llojeta · Cotahuma
              </p>
            </div>
          </div>

          {/* Centro: Píldoras de Navegación por Capítulos */}
          <nav aria-label="Navegación principal desktop" className="hidden xl:flex items-center gap-1.5 text-sm font-bold">
            <a
              href="#monitoreo"
              className="px-4 py-2 rounded-full bg-[#3525CD] text-white shadow-xs transition-colors"
            >
              Estado en Vivo
            </a>
            <a
              href="#prevencion"
              className="px-4 py-2 rounded-full text-[#1E293B] hover:bg-white/80 hover:text-[#3525CD] transition-colors"
            >
              Guía de Lluvia
            </a>
            <a
              href="#mapa"
              className="px-4 py-2 rounded-full text-[#1E293B] hover:bg-white/80 hover:text-[#3525CD] transition-colors"
            >
              Mapa y Puntos
            </a>
            <a
              href="#contactos"
              className="px-4 py-2 rounded-full text-[#1E293B] hover:bg-white/80 hover:text-[#3525CD] transition-colors"
            >
              Teléfonos
            </a>
          </nav>

          {/* Derecha: Conmutador Compacto + Auxilio + Admin */}
          <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
            <div className="inline-flex rounded-full bg-white/80 p-1 border border-black/10 shadow-2xs">
              <button
                type="button"
                onClick={() => handleCambiarModalidad('real')}
                className={`min-h-[40px] px-3 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
                  modalidad === 'real'
                    ? 'bg-[#3525CD] text-white shadow-xs'
                    : 'text-[#464555] hover:text-[#111C2D]'
                }`}
              >
                Datos Reales (Open-Meteo)
              </button>
              <button
                type="button"
                onClick={() => handleCambiarModalidad('simulada')}
                className={`min-h-[40px] px-3 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
                  modalidad === 'simulada'
                    ? 'bg-[#111C2D] text-white shadow-xs'
                    : 'text-[#464555] hover:text-[#111C2D]'
                }`}
              >
                Modo Simulación (Demostración)
              </button>
            </div>

            <a
              href="#contactos"
              className="clay-btn-danger clay-interactive min-h-[44px] px-4 py-2 text-xs sm:text-sm font-extrabold hidden sm:inline-flex items-center justify-center gap-1.5 shrink-0"
            >
              <span aria-hidden="true">📞</span>
              <span>AUXILIO 114 / 119</span>
            </a>

            <Link
              to="/admin"
              className="min-h-[44px] inline-flex items-center justify-center px-3.5 py-2 rounded-full text-xs sm:text-sm font-bold bg-white/90 hover:bg-white text-[#111C2D] border border-black/10 transition-colors shrink-0"
              title="Acceso administrativo"
            >
              <span>Acceso Admin →</span>
            </Link>
          </div>
        </div>
      </header>

      {/* 3. Contenedor Principal Amplio sobre Degradado Pastel Suave */}
      <main className="max-w-[1520px] w-[95%] mx-auto px-4 sm:px-6 lg:px-10 py-6 sm:py-8 space-y-8 sm:space-y-12 pb-24 md:pb-12 flex-1">
        <EstadoPwaBanner />

        <BannerModoOffline
          activo={estaOffline}
          fechaDatoIso={infoRespaldoOffline?.fechaDatoIso}
          avisoOffline={infoRespaldoOffline?.avisoOffline}
          guardadoEnIso={infoRespaldoOffline?.guardadoEnIso}
          onReintentar={() => cargarDatos()}
        />

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

        <AvisoCambioNivelInApp
          cambioNivel={cambioNivelDetectado}
          onCerrar={() => setCambioNivelDetectado(null)}
        />

        {mensajeExito && (
          <div
            role="status"
            className="clay-card-sm border border-[#A7F3D0] bg-[#ECFDF5] p-4 text-base text-[#065F46] font-semibold flex items-center gap-2.5 animate-fade-up"
          >
            <span aria-hidden="true">✅</span>
            <span>{mensajeExito}</span>
          </div>
        )}

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

        {/* HERO PRINCIPAL DESTACADO CON BOTÓN DISCRETO DE ACTUALIZACIÓN */}
        <section aria-label="Nivel informativo vigente y escala">
          <BannerNivelInformativo
            estado={estado}
            alActualizar={() => cargarDatos()}
            cargando={cargando || cargandoAccion}
            alInyectarPreset={(nivel, int, a24, a72) =>
              handleInyectarEscenario({
                intensidad_mm_h: int,
                acum_24h_mm: a24,
                acum_72h_mm: a72,
                observado_en: new Date().toISOString(),
              })
            }
          />
        </section>

        {/* FILA DE 3 TARJETAS CLAVE DE LLUVIA */}
        <section id="telemetria" aria-label="Telemetría meteorológica">
          <TarjetaLecturaMeteorologica meteorologia={estado?.meteorologia} />
        </section>

        {/* CAPÍTULO 01: GUÍA DE LLUVIA SIMPLIFICADA CON ILUSTRACIONES */}
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

        {/* CAPÍTULO 02: MAPA CON PUNTOS/ZONAS EN MODAL AMPLIABLE */}
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

        {/* CAPÍTULO 03: TELÉFONOS RÁPIDOS DE EMERGENCIA */}
        <section id="contactos" aria-label="Capítulo 03: Contactos rápidos de emergencia">
          <SeccionContactosEmergencia
            contactos={estado?.contactos_emergencia || estado?.contactos || []}
          />
        </section>

        {/* AVISO PERMANENTE OBLIGATORIO Y TRAZABILIDAD OPCIONAL DESPLEGABLE */}
        <section id="historial" aria-label="Aviso legal permanente y trazabilidad" className="space-y-4">
          <AvisoPermanente />

          <details className="clay-card p-5 sm:p-6 group">
            <summary className="text-base font-bold text-[#111C2D] hover:text-[#3525CD] cursor-pointer select-none flex items-center justify-between gap-3">
              <span>Ver historial de evaluaciones y detalle técnico de la zona piloto</span>
              <span className="text-sm text-[#475569] transition-transform group-open:rotate-180" aria-hidden="true">
                ▼
              </span>
            </summary>

            <div className="mt-6 space-y-6">
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
            </div>
          </details>
        </section>
      </main>

      {/* 4. Pie de Página Institucional de 4 Columnas */}
      <footer className="bg-white/90 border-t border-slate-200/80 py-10 pb-28 md:pb-12">
        <div className="max-w-[1520px] w-[95%] mx-auto px-4 sm:px-6 lg:px-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 text-sm text-[#464555]">
          <div className="space-y-2.5">
            <div className="flex items-center gap-2">
              <span className="display-hero font-extrabold text-base text-[#111C2D]">PUKARA</span>
              <span className="text-xs font-bold text-[#3525CD] bg-[#EEF2FF] px-2 py-0.5 rounded-full">
                Llojeta
              </span>
            </div>
            <p className="leading-relaxed">
              Plataforma comunitaria de consulta informativa de lluvias intensas para vecinos del sector Llojeta / Bajo Llojeta.
            </p>
            <p className="text-xs text-[#475569]">
              Carrera de Informática · UMSA (INF-266)
            </p>
          </div>

          <div className="space-y-2">
            <h3 className="font-extrabold text-xs uppercase tracking-wider text-[#111C2D]">
              Líneas de Emergencia
            </h3>
            <ul className="space-y-1.5">
              <li><a href="tel:114" className="hover:text-[#3525CD]"><strong>114</strong> · Emergencias GAMLP</a></li>
              <li><a href="tel:119" className="hover:text-[#3525CD]"><strong>119</strong> · Bomberos Antofagasta</a></li>
              <li><a href="tel:110" className="hover:text-[#3525CD]"><strong>110</strong> · Radio Patrullas</a></li>
              <li><a href="tel:115" className="hover:text-[#3525CD]"><strong>115</strong> · Defensa Civil</a></li>
            </ul>
          </div>

          <div className="space-y-2">
            <h3 className="font-extrabold text-xs uppercase tracking-wider text-[#111C2D]">
              Sectores de Referencia
            </h3>
            <ul className="space-y-1.5">
              <li>Bajo Llojeta · Av. Los Sargentos</li>
              <li>Llojeta Central · Pasajahuira</li>
              <li>Santa Rosa de Llojeta</li>
              <li>Macrodistrito Cotahuma</li>
            </ul>
          </div>

          <div className="space-y-2.5">
            <h3 className="font-extrabold text-xs uppercase tracking-wider text-[#111C2D]">
              Ámbito Piloto Cotahuma
            </h3>
            <p className="leading-relaxed">
              Consulta meteorológica simulada y referencial bajo demanda. No sustituye alertas de autoridades oficiales.
            </p>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono bg-[#F4F6FB] border border-slate-200 text-[#111C2D]">
              📍 Sector Llojeta (-16.5235, -68.1425)
            </span>
          </div>
        </div>
      </footer>

      {/* 5. Barra de Navegación Inferior Móvil */}
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
