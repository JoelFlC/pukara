import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import AvisoPermanente from './AvisoPermanente';
import {
  logoutAdmin,
  obtenerUsuarioAdmin,
  obtenerConfiguracionesAdmin,
  crearConfiguracionAdmin,
  activarConfiguracionAdmin,
  obtenerRecomendacionesAdmin,
  crearRecomendacionAdmin,
  obtenerContactosAdmin,
  crearContactoAdmin,
  actualizarContactoAdmin,
  obtenerCapasAdmin,
  actualizarZonaAdmin,
  actualizarPuntoAdmin,
  obtenerBitacoraAdmin,
  inyectarLecturaSimuladaAdmin,
  limpiarSimulacionAdmin,
} from '../api/adminApi';

const SECCIONES = [
  { id: 'umbrales', label: '1. Umbrales y Reglas (P05/P16)', icono: '⚙️', desc: 'Configuraciones, umbrales e histéresis' },
  { id: 'recomendaciones', label: '2. Textos Preventivos', icono: '📝', desc: 'Recomendaciones por nivel pluvial' },
  { id: 'contactos', label: '3. Contactos de Emergencia', icono: '📞', desc: 'Directorio de auxilio ciudadano' },
  { id: 'capas', label: '4. Capas y Referencias', icono: '🗺️', desc: 'Salvaguarda de zonas y puntos' },
  { id: 'simulacion', label: '5. Modo Demostración', icono: '🧪', desc: 'Inyección de escenarios aislados (P11)' },
  { id: 'bitacora', label: '6. Bitácora de Cambios', icono: '📜', desc: 'Auditoría inmutable de acciones' },
];

/**
 * Panel de Administración Institucional PUKARA (Swiss Grid + Claymorphism Mobile-First).
 * Control integral de configuración de umbrales, recomendaciones, contactos, capas y auditoría.
 */
export default function PanelAdministracion({ alCerrarSesion }) {
  const [seccionActiva, setSeccionActiva] = useState('umbrales');
  const [usuario] = useState(obtenerUsuarioAdmin());
  const [mensajeExito, setMensajeExito] = useState(null);
  const [errorGlobal, setErrorGlobal] = useState(null);

  // Estados de datos por sección
  const [configuraciones, setConfiguraciones] = useState([]);
  const [recomendaciones, setRecomendaciones] = useState([]);
  const [contactos, setContactos] = useState([]);
  const [capas, setCapas] = useState({ zonas: [], puntos: [] });
  const [bitacora, setBitacora] = useState([]);
  const [filtroBitacora, setFiltroBitacora] = useState('TODAS');
  const [filtroNivelRec, setFiltroNivelRec] = useState('TODOS');
  const [cargando, setCargando] = useState(false);

  // Estado del formulario de nueva configuración (P05/P16)
  const [formConfig, setFormConfig] = useState({
    motivo: '',
    activar: true,
    t_max_minutos: 60,
    separacion_minima_minutos: 15,
    muestras_descenso: 2,
    sat_habilitada: true,
    sat_acum_72h: 60,
    sat_intensidad: 2.5,
    sat_nivel: 'ALERTA',
    int_precaucion: 2.5,
    int_alerta: 6.5,
    int_emergencia: 12.0,
    a24_precaucion: 10.0,
    a24_alerta: 25.0,
    a24_emergencia: 40.0,
    a72_precaucion: 25.0,
    a72_alerta: 60.0,
    a72_emergencia: 90.0,
  });
  const [erroresValidacionConfig, setErroresValidacionConfig] = useState([]);

  // Estado de formulario de recomendaciones
  const [formRec, setFormRec] = useState({
    nivel: 'NORMAL',
    titulo: '',
    contenido: '',
    estado_publicacion: 'publicado',
    origen: 'demostracion',
    fuente: '',
  });

  // Estado de formulario de contactos
  const [formContacto, setFormContacto] = useState({
    nombre: '',
    telefono: '',
    fuente: '',
    activo: true,
  });

  // Estado de simulación manual
  const [simManual, setSimManual] = useState({
    intensidad: 5.0,
    acum_24h: 20.0,
    acum_72h: 45.0,
  });

  const mostrarExito = (msg) => {
    setMensajeExito(msg);
    setTimeout(() => setMensajeExito(null), 5000);
  };

  const handleCerrarSesion = () => {
    logoutAdmin();
    if (alCerrarSesion) alCerrarSesion();
  };

  useEffect(() => {
    cargarDatosSeccion(seccionActiva);
  }, [seccionActiva]);

  const cargarDatosSeccion = async (seccion) => {
    try {
      setCargando(true);
      setErrorGlobal(null);
      if (seccion === 'umbrales') {
        const datos = await obtenerConfiguracionesAdmin();
        setConfiguraciones(datos || []);
      } else if (seccion === 'recomendaciones') {
        const datos = await obtenerRecomendacionesAdmin();
        setRecomendaciones(datos || []);
      } else if (seccion === 'contactos') {
        const datos = await obtenerContactosAdmin();
        setContactos(datos || []);
      } else if (seccion === 'capas') {
        const datos = await obtenerCapasAdmin();
        setCapas(datos || { zonas: [], puntos: [] });
      } else if (seccion === 'bitacora') {
        const datos = await obtenerBitacoraAdmin({ limite: 50 });
        setBitacora(datos || []);
      }
    } catch (err) {
      setErrorGlobal(err.message || 'Error cargando datos de la sección');
    } finally {
      setCargando(false);
    }
  };

  // -------------------------------------------------------------------------
  // Handlers: Umbrales y Reglas (P05/P16)
  // -------------------------------------------------------------------------
  const handleGuardarConfig = async (e) => {
    e.preventDefault();
    setErroresValidacionConfig([]);
    setErrorGlobal(null);

    const payload = {
      motivo: formConfig.motivo || 'Actualización de umbrales desde panel administrativo',
      activar: Boolean(formConfig.activar),
      parametros: {
        t_max_minutos: Number(formConfig.t_max_minutos),
        separacion_minima_minutos: Number(formConfig.separacion_minima_minutos),
        muestras_descenso: Number(formConfig.muestras_descenso),
        saturacion: {
          habilitada: Boolean(formConfig.sat_habilitada),
          acum_72h_min_mm: Number(formConfig.sat_acum_72h),
          intensidad_min_mm_h: Number(formConfig.sat_intensidad),
          nivel_minimo: formConfig.sat_nivel,
        },
      },
      umbrales: [
        { variable: 'intensidad_mm_h', nivel: 'PRECAUCION', valor: Number(formConfig.int_precaucion) },
        { variable: 'intensidad_mm_h', nivel: 'ALERTA', valor: Number(formConfig.int_alerta) },
        { variable: 'intensidad_mm_h', nivel: 'EMERGENCIA', valor: Number(formConfig.int_emergencia) },
        { variable: 'acum_24h_mm', nivel: 'PRECAUCION', valor: Number(formConfig.a24_precaucion) },
        { variable: 'acum_24h_mm', nivel: 'ALERTA', valor: Number(formConfig.a24_alerta) },
        { variable: 'acum_24h_mm', nivel: 'EMERGENCIA', valor: Number(formConfig.a24_emergencia) },
        { variable: 'acum_72h_mm', nivel: 'PRECAUCION', valor: Number(formConfig.a72_precaucion) },
        { variable: 'acum_72h_mm', nivel: 'ALERTA', valor: Number(formConfig.a72_alerta) },
        { variable: 'acum_72h_mm', nivel: 'EMERGENCIA', valor: Number(formConfig.a72_emergencia) },
      ],
    };

    try {
      setCargando(true);
      const res = await crearConfiguracionAdmin(payload);
      mostrarExito(`Nueva versión v${res.configuracion?.version} guardada ${formConfig.activar ? 'y activada como vigente' : 'en borrador'}.`);
      await cargarDatosSeccion('umbrales');
    } catch (err) {
      if (err.detalles && err.detalles.length > 0) {
        setErroresValidacionConfig(
          err.detalles.map((d) => (typeof d === 'string' ? d : d.mensaje || d.codigo))
        );
      } else {
        setErrorGlobal(err.message || 'Error validando la configuración');
      }
    } finally {
      setCargando(false);
    }
  };

  const handleActivarVersion = async (id, version) => {
    if (!window.confirm(`¿Confirmar activación de la versión v${version} como vigente? Se archivará la versión actual.`)) {
      return;
    }
    try {
      setCargando(true);
      await activarConfiguracionAdmin(id, `Activación manual de v${version}`);
      mostrarExito(`Versión v${version} activada exitosamente como vigente.`);
      await cargarDatosSeccion('umbrales');
    } catch (err) {
      setErrorGlobal(err.message || 'Error activando la versión');
    } finally {
      setCargando(false);
    }
  };

  // -------------------------------------------------------------------------
  // Handlers: Recomendaciones Preventivas
  // -------------------------------------------------------------------------
  const handleGuardarRecomendacion = async (e) => {
    e.preventDefault();
    try {
      setCargando(true);
      await crearRecomendacionAdmin(formRec);
      mostrarExito(`Nueva recomendación para nivel ${formRec.nivel} creada exitosamente.`);
      setFormRec({
        nivel: 'NORMAL',
        titulo: '',
        contenido: '',
        estado_publicacion: 'publicado',
        origen: 'demostracion',
        fuente: '',
      });
      await cargarDatosSeccion('recomendaciones');
    } catch (err) {
      setErrorGlobal(err.message || 'Error al guardar recomendación');
    } finally {
      setCargando(false);
    }
  };

  // -------------------------------------------------------------------------
  // Handlers: Contactos de Emergencia
  // -------------------------------------------------------------------------
  const handleGuardarContacto = async (e) => {
    e.preventDefault();
    try {
      setCargando(true);
      await crearContactoAdmin(formContacto);
      mostrarExito(`Contacto ${formContacto.nombre} registrado exitosamente.`);
      setFormContacto({ nombre: '', telefono: '', fuente: '', activo: true });
      await cargarDatosSeccion('contactos');
    } catch (err) {
      setErrorGlobal(err.message || 'Error al guardar contacto');
    } finally {
      setCargando(false);
    }
  };

  const handleToggleContactoActivo = async (contacto) => {
    try {
      setCargando(true);
      await actualizarContactoAdmin(contacto.id, { activo: !contacto.activo });
      mostrarExito(`Contacto ${contacto.nombre} marcado como ${!contacto.activo ? 'activo' : 'inactivo'}.`);
      await cargarDatosSeccion('contactos');
    } catch (err) {
      setErrorGlobal(err.message || 'Error al actualizar contacto');
    } finally {
      setCargando(false);
    }
  };

  // -------------------------------------------------------------------------
  // Handlers: Capas y Referencias
  // -------------------------------------------------------------------------
  const handleGuardarZona = async (zona) => {
    try {
      setCargando(true);
      await actualizarZonaAdmin(zona.id, {
        nombre: zona.nombre,
        fuente: zona.fuente,
        fecha_dato: zona.fecha_dato,
        vigente_hasta: zona.vigente_hasta,
        verificada: Boolean(zona.verificada),
        advertencia: zona.advertencia,
      });
      mostrarExito(`Zona ${zona.nombre} actualizada exitosamente.`);
      await cargarDatosSeccion('capas');
    } catch (err) {
      setErrorGlobal(err.message || 'Error al actualizar zona');
    } finally {
      setCargando(false);
    }
  };

  const handleGuardarPunto = async (punto) => {
    try {
      setCargando(true);
      await actualizarPuntoAdmin(punto.id, {
        nombre: punto.nombre,
        tipo: punto.tipo,
        fuente: punto.fuente,
        estado_verificacion: punto.estado_verificacion,
        activo: Boolean(punto.activo),
      });
      mostrarExito(`Punto ${punto.nombre} actualizado exitosamente.`);
      await cargarDatosSeccion('capas');
    } catch (err) {
      setErrorGlobal(err.message || 'Error al actualizar punto');
    } finally {
      setCargando(false);
    }
  };

  // -------------------------------------------------------------------------
  // Handlers: Modo Demostración
  // -------------------------------------------------------------------------
  const inyectarPreset = async (intensidad, acum24, acum72, nivelNombre, opciones = {}) => {
    try {
      setCargando(true);
      const res = await inyectarLecturaSimuladaAdmin({
        intensidad_mm_h: intensidad,
        acum_24h_mm: acum24,
        acum_72h_mm: acum72,
        observado_en: new Date().toISOString(),
        reiniciar_antes: opciones.reiniciar_antes ?? true,
        modo_preset: opciones.modo_preset ?? true,
      });
      mostrarExito(`Escenario ${nivelNombre} inyectado (nivel calculado: ${res.evaluacion?.nivel_calculado}, nivel vigente: ${res.evaluacion?.nivel_vigente}).`);
    } catch (err) {
      setErrorGlobal(err.message || 'Error al inyectar escenario simulado');
    } finally {
      setCargando(false);
    }
  };

  const handleLimpiarSimulacion = async () => {
    try {
      setCargando(true);
      await limpiarSimulacionAdmin();
      mostrarExito('Datos simulados limpiados exitosamente. El flujo real permanece intacto.');
    } catch (err) {
      setErrorGlobal(err.message || 'Error al limpiar simulación');
    } finally {
      setCargando(false);
    }
  };

  const versionVigente = configuraciones.find((c) => c.estado === 'vigente') || configuraciones[0];

  const recomendacionesFiltradas =
    filtroNivelRec === 'TODOS'
      ? recomendaciones
      : recomendaciones.filter((r) => r.nivel === filtroNivelRec);

  const bitacoraFiltrada =
    filtroBitacora === 'TODAS'
      ? bitacora
      : bitacora.filter((b) => b.entidad === filtroBitacora);

  return (
    <div className="min-h-screen bg-[#F6F8FA] text-[#111C2D] flex flex-col font-sans overflow-x-hidden max-w-full">
      {/* 1. Cabecera Superior del Panel Administrativo */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200/80 shadow-xs">
        <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 py-3 flex flex-wrap items-center justify-between gap-3">
          {/* Marca e Identidad Institucional */}
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-[#3525CD] text-white flex items-center justify-center shrink-0 clay-pill shadow-sm">
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
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="headline-sm font-extrabold text-base sm:text-lg tracking-tight text-[#111C2D] leading-snug">
                  Panel de Administración PUKARA
                </h1>
                <span className="hidden sm:inline-block clay-pill text-[11px] font-bold uppercase tracking-wider px-2.5 py-0.5 bg-[#EEF2FF] text-[#3525CD] border border-[#E2DFFF]">
                  Consola Administrativa · Rol: Administrador
                </span>
              </div>
              <p className="text-xs sm:text-sm text-[#475569] font-mono mt-0.5 truncate">
                {usuario?.nombre || 'Administrador PUKARA'} · {usuario?.email || 'admin@pukara.bo'}
              </p>
            </div>
          </div>

          {/* Botones de Navegación y Sesión */}
          <div className="flex flex-wrap items-center gap-2.5">
            <Link
              to="/"
              className="clay-btn-secondary clay-interactive min-h-[48px] px-4 py-2 text-xs sm:text-sm font-bold text-[#111C2D] inline-flex items-center justify-center gap-1.5"
            >
              <span>← Ver Consulta Pública</span>
            </Link>
            <button
              type="button"
              onClick={handleCerrarSesion}
              className="clay-pill clay-interactive min-h-[48px] px-4 py-2 bg-[#FEE2E2] text-[#991B1B] hover:bg-[#FECACA] border border-[#FECACA] text-xs sm:text-sm font-bold inline-flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <span aria-hidden="true">🚪</span>
              <span>Cerrar sesión</span>
            </button>
          </div>
        </div>
      </header>

      {/* 2. Barra de Navegación Horizontal Deslizable para Móviles */}
      <div className="lg:hidden bg-white/90 border-b border-slate-200/80 px-4 py-2.5">
        <nav aria-label="Secciones móviles" className="flex overflow-x-auto pb-2 gap-2 no-scrollbar">
          {SECCIONES.map((sec) => (
            <button
              key={sec.id}
              type="button"
              onClick={() => setSeccionActiva(sec.id)}
              className={`clay-pill min-h-[48px] px-4 py-2 text-sm font-bold transition-all inline-flex items-center gap-2 shrink-0 cursor-pointer ${
                seccionActiva === sec.id
                  ? 'bg-[#3525CD] text-white'
                  : 'bg-[#F0F3FF] text-[#464555] hover:text-[#111C2D]'
              }`}
            >
              <span aria-hidden="true">{sec.icono}</span>
              <span className="whitespace-nowrap">{sec.label}</span>
            </button>
          ))}
        </nav>
      </div>

      {/* 3. Contenedor Principal Swiss Grid con Sidebar Desktop */}
      <main className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6 w-full flex-1">
        {/* Notificaciones globales */}
        {mensajeExito && (
          <div
            role="status"
            className="clay-card-sm border border-[#A7F3D0] bg-[#ECFDF5] p-4 text-base text-[#065F46] font-semibold flex items-center gap-2.5 animate-fade-up"
          >
            <span aria-hidden="true">✅</span>
            <span>{mensajeExito}</span>
          </div>
        )}

        {errorGlobal && (
          <div
            role="alert"
            className="clay-card-sm border border-[#FECACA] bg-[#FEE2E2] p-4 text-base text-[#991B1B] font-semibold flex items-center gap-2.5"
          >
            <span aria-hidden="true">⚠️</span>
            <span>{errorGlobal}</span>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Sidebar Desktop (col-span-3) */}
          <aside className="hidden lg:block lg:col-span-3 space-y-4 sticky top-24">
            <div className="clay-card p-4 space-y-2">
              <span className="swiss-chapter-badge px-2 pb-1">
                Módulos de Configuración
              </span>
              <nav aria-label="Navegación administrativa desktop" className="space-y-1.5">
                {SECCIONES.map((sec) => {
                  const activa = seccionActiva === sec.id;
                  return (
                    <button
                      key={sec.id}
                      type="button"
                      onClick={() => setSeccionActiva(sec.id)}
                      className={`w-full min-h-[48px] text-left p-3 rounded-2xl text-sm font-bold transition-all flex items-start gap-2.5 cursor-pointer ${
                        activa
                          ? 'bg-[#3525CD] text-white shadow-sm'
                          : 'text-[#1E293B] hover:bg-[#F0F3FF]'
                      }`}
                    >
                      <span className="text-base shrink-0 mt-0.5" aria-hidden="true">{sec.icono}</span>
                      <div className="min-w-0">
                        <span className="block truncate">{sec.label}</span>
                        <span className={`block text-xs font-normal truncate ${activa ? 'text-indigo-100' : 'text-[#475569]'}`}>
                          {sec.desc}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </nav>
            </div>

            <div className="clay-card-sm bg-[#F9F9FF] p-4 text-sm text-[#464555] space-y-1.5">
              <span className="font-extrabold text-[#111C2D] block text-xs uppercase tracking-wider">
                Gobernanza Institucional
              </span>
              <p className="text-sm leading-relaxed text-[#464555]">
                Toda modificación genera un registro inmutable en la bitácora relacional con autor, fecha, entidad y valores antes/después.
              </p>
            </div>
          </aside>

          {/* Área Principal de Contenido (col-span-9) */}
          <div className="lg:col-span-9 space-y-6 min-w-0">
            {/* ============================================================= */}
            {/* SECCIÓN 1: UMBRALES Y MOTOR (P05/P16) */}
            {/* ============================================================= */}
            {seccionActiva === 'umbrales' && (
              <div className="space-y-6">
                {/* 1.A Tarjeta Destacada: Versión Vigente Actual */}
                <section className="clay-card p-5 sm:p-6 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-4">
                    <div>
                      <span className="swiss-chapter-badge">
                        Parámetros Activos del Motor
                      </span>
                      <h2 className="headline-md text-xl font-bold text-[#111C2D] mt-1">
                        Configuración Vigente v{versionVigente?.version ?? 1}
                      </h2>
                    </div>
                    <span className="clay-pill px-3.5 py-1 text-xs font-extrabold uppercase bg-[#ECFDF5] text-[#065F46] border border-[#A7F3D0]">
                      ✓ Vigente en Motor
                    </span>
                  </div>

                  <p className="text-base text-[#464555]">
                    <strong className="font-bold text-[#111C2D]">Motivo de versión:</strong>{' '}
                    {versionVigente?.motivo || 'Configuración inicial ratificada'}
                  </p>

                  {/* Matriz 3x3 de Umbrales */}
                  <div className="overflow-x-auto rounded-xl border border-slate-200/80">
                    <table className="w-full text-left text-sm border-collapse">
                      <thead>
                        <tr className="border-b border-slate-200 text-[#475569] font-extrabold uppercase text-xs bg-[#F0F3FF]">
                          <th className="py-3 px-3.5">Variable Pluviométrica</th>
                          <th className="py-3 px-3 text-[#92400E] bg-[#FEF3C7]/70">PRECAUCIÓN</th>
                          <th className="py-3 px-3 text-[#9A3412] bg-[#FFEDD5]/70">ALERTA</th>
                          <th className="py-3 px-3 text-[#991B1B] bg-[#FEE2E2]/70">EMERGENCIA</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-mono text-sm bg-white">
                        <tr>
                          <td className="py-3 px-3.5 font-sans font-bold text-[#111C2D]">
                            Intensidad Horaria (mm/h)
                          </td>
                          <td className="py-3 px-3 font-bold text-[#92400E] bg-[#FEF3C7]/35">
                            {versionVigente?.umbrales?.find((u) => u.variable === 'intensidad_mm_h' && u.nivel === 'PRECAUCION')?.valor ?? formConfig.int_precaucion} mm/h
                          </td>
                          <td className="py-3 px-3 font-bold text-[#9A3412] bg-[#FFEDD5]/35">
                            {versionVigente?.umbrales?.find((u) => u.variable === 'intensidad_mm_h' && u.nivel === 'ALERTA')?.valor ?? formConfig.int_alerta} mm/h
                          </td>
                          <td className="py-3 px-3 font-bold text-[#991B1B] bg-[#FEE2E2]/35">
                            {versionVigente?.umbrales?.find((u) => u.variable === 'intensidad_mm_h' && u.nivel === 'EMERGENCIA')?.valor ?? formConfig.int_emergencia} mm/h
                          </td>
                        </tr>
                        <tr>
                          <td className="py-3 px-3.5 font-sans font-bold text-[#111C2D]">
                            Acumulado 24 Horas (mm)
                          </td>
                          <td className="py-3 px-3 font-bold text-[#92400E] bg-[#FEF3C7]/35">
                            {versionVigente?.umbrales?.find((u) => u.variable === 'acum_24h_mm' && u.nivel === 'PRECAUCION')?.valor ?? formConfig.a24_precaucion} mm
                          </td>
                          <td className="py-3 px-3 font-bold text-[#9A3412] bg-[#FFEDD5]/35">
                            {versionVigente?.umbrales?.find((u) => u.variable === 'acum_24h_mm' && u.nivel === 'ALERTA')?.valor ?? formConfig.a24_alerta} mm
                          </td>
                          <td className="py-3 px-3 font-bold text-[#991B1B] bg-[#FEE2E2]/35">
                            {versionVigente?.umbrales?.find((u) => u.variable === 'acum_24h_mm' && u.nivel === 'EMERGENCIA')?.valor ?? formConfig.a24_emergencia} mm
                          </td>
                        </tr>
                        <tr>
                          <td className="py-3 px-3.5 font-sans font-bold text-[#111C2D]">
                            Acumulado 72 Horas (mm)
                          </td>
                          <td className="py-3 px-3 font-bold text-[#92400E] bg-[#FEF3C7]/35">
                            {versionVigente?.umbrales?.find((u) => u.variable === 'acum_72h_mm' && u.nivel === 'PRECAUCION')?.valor ?? formConfig.a72_precaucion} mm
                          </td>
                          <td className="py-3 px-3 font-bold text-[#9A3412] bg-[#FFEDD5]/35">
                            {versionVigente?.umbrales?.find((u) => u.variable === 'acum_72h_mm' && u.nivel === 'ALERTA')?.valor ?? formConfig.a72_alerta} mm
                          </td>
                          <td className="py-3 px-3 font-bold text-[#991B1B] bg-[#FEE2E2]/35">
                            {versionVigente?.umbrales?.find((u) => u.variable === 'acum_72h_mm' && u.nivel === 'EMERGENCIA')?.valor ?? formConfig.a72_emergencia} mm
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  {/* Parámetros de Histéresis y Saturación de la versión vigente */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-1">
                    <div className="clay-card-sm bg-[#F9F9FF] p-3.5">
                      <span className="text-xs text-[#475569] uppercase block font-bold">T_max Vigencia</span>
                      <span className="font-mono font-extrabold text-[#111C2D] text-base">
                        {versionVigente?.parametros?.t_max_minutos ?? formConfig.t_max_minutos} min
                      </span>
                    </div>
                    <div className="clay-card-sm bg-[#F9F9FF] p-3.5">
                      <span className="text-xs text-[#475569] uppercase block font-bold">Descenso Histéresis</span>
                      <span className="font-mono font-extrabold text-[#111C2D] text-base">
                        {versionVigente?.parametros?.muestras_descenso ?? formConfig.muestras_descenso} muestras
                      </span>
                    </div>
                    <div className="clay-card-sm bg-[#F9F9FF] p-3.5">
                      <span className="text-xs text-[#475569] uppercase block font-bold">Separación Mínima</span>
                      <span className="font-mono font-extrabold text-[#111C2D] text-base">
                        {versionVigente?.parametros?.separacion_minima_minutos ?? formConfig.separacion_minima_minutos} min
                      </span>
                    </div>
                    <div className="clay-card-sm bg-[#F9F9FF] p-3.5">
                      <span className="text-xs text-[#475569] uppercase block font-bold">Saturación Cuenca</span>
                      <span className="font-mono font-extrabold text-[#111C2D] text-base">
                        ≥ {versionVigente?.parametros?.saturacion?.acum_72h_min_mm ?? formConfig.sat_acum_72h}mm / 72h
                      </span>
                    </div>
                  </div>
                </section>

                {/* 1.B Formulario de Nueva Versión Inmutable (P05/P16) */}
                <section className="clay-card p-5 sm:p-6 space-y-5">
                  <div className="border-b border-slate-100 pb-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="swiss-chapter-badge">
                        Reglas P05 y P16
                      </span>
                      <span className="clay-pill text-xs font-bold text-[#3525CD] bg-[#EEF2FF] px-3 py-1 border border-[#E2DFFF]">
                        Inmutabilidad Garantizada
                      </span>
                    </div>
                    <h2 className="headline-md text-xl font-bold text-[#111C2D] mt-1.5">
                      Crear Nueva Versión Inmutable de Configuración
                    </h2>
                    <p className="text-base text-[#464555] leading-relaxed mt-1">
                      Las configuraciones son inmutables. Crear una versión nueva no recalcula evaluaciones pasadas y reinicia el contador de descenso de histéresis.
                    </p>
                  </div>

                  {/* Banner de Validación P16 */}
                  {erroresValidacionConfig.length > 0 && (
                    <div
                      role="alert"
                      className="clay-card-sm border border-[#FECACA] bg-[#FEE2E2] p-4 text-sm sm:text-base text-[#991B1B] space-y-2"
                    >
                      <p className="font-bold flex items-center gap-2">
                        <span aria-hidden="true">🛑</span> Error de Validación Estricta (Regla P16):
                      </p>
                      <ul className="list-disc list-inside space-y-1 pl-1 font-mono text-sm">
                        {erroresValidacionConfig.map((errStr, idx) => (
                          <li key={idx}>{errStr}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <form onSubmit={handleGuardarConfig} className="space-y-5">
                    {/* Grilla de los 9 Umbrales */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {/* Intensidad Horaria */}
                      <div className="clay-card-sm p-4 bg-[#F9F9FF] space-y-3">
                        <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                          <span className="text-sm font-extrabold text-[#111C2D] uppercase">
                            Intensidad (mm/h)
                          </span>
                          <span className="text-xs text-[#475569] font-mono">P &lt; A &lt; E</span>
                        </div>
                        <div>
                          <label className="text-sm font-semibold text-[#1E293B] block mb-1">
                            Precaución (mm/h)
                          </label>
                          <input
                            type="number"
                            step="0.1"
                            value={formConfig.int_precaucion}
                            onChange={(e) => setFormConfig({ ...formConfig, int_precaucion: e.target.value })}
                            className="clay-input w-full px-3.5 py-2 text-base font-mono"
                            required
                          />
                        </div>
                        <div>
                          <label className="text-sm font-semibold text-[#1E293B] block mb-1">
                            Alerta (mm/h)
                          </label>
                          <input
                            type="number"
                            step="0.1"
                            value={formConfig.int_alerta}
                            onChange={(e) => setFormConfig({ ...formConfig, int_alerta: e.target.value })}
                            className="clay-input w-full px-3.5 py-2 text-base font-mono"
                            required
                          />
                        </div>
                        <div>
                          <label className="text-sm font-semibold text-[#1E293B] block mb-1">
                            Emergencia (mm/h)
                          </label>
                          <input
                            type="number"
                            step="0.1"
                            value={formConfig.int_emergencia}
                            onChange={(e) => setFormConfig({ ...formConfig, int_emergencia: e.target.value })}
                            className="clay-input w-full px-3.5 py-2 text-base font-mono"
                            required
                          />
                        </div>
                      </div>

                      {/* Acumulado 24h */}
                      <div className="clay-card-sm p-4 bg-[#F9F9FF] space-y-3">
                        <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                          <span className="text-sm font-extrabold text-[#111C2D] uppercase">
                            Acumulado 24h (mm)
                          </span>
                          <span className="text-xs text-[#475569] font-mono">P &lt; A &lt; E</span>
                        </div>
                        <div>
                          <label className="text-sm font-semibold text-[#1E293B] block mb-1">
                            Precaución (mm)
                          </label>
                          <input
                            type="number"
                            step="0.1"
                            value={formConfig.a24_precaucion}
                            onChange={(e) => setFormConfig({ ...formConfig, a24_precaucion: e.target.value })}
                            className="clay-input w-full px-3.5 py-2 text-base font-mono"
                            required
                          />
                        </div>
                        <div>
                          <label className="text-sm font-semibold text-[#1E293B] block mb-1">
                            Alerta (mm)
                          </label>
                          <input
                            type="number"
                            step="0.1"
                            value={formConfig.a24_alerta}
                            onChange={(e) => setFormConfig({ ...formConfig, a24_alerta: e.target.value })}
                            className="clay-input w-full px-3.5 py-2 text-base font-mono"
                            required
                          />
                        </div>
                        <div>
                          <label className="text-sm font-semibold text-[#1E293B] block mb-1">
                            Emergencia (mm)
                          </label>
                          <input
                            type="number"
                            step="0.1"
                            value={formConfig.a24_emergencia}
                            onChange={(e) => setFormConfig({ ...formConfig, a24_emergencia: e.target.value })}
                            className="clay-input w-full px-3.5 py-2 text-base font-mono"
                            required
                          />
                        </div>
                      </div>

                      {/* Acumulado 72h */}
                      <div className="clay-card-sm p-4 bg-[#F9F9FF] space-y-3">
                        <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                          <span className="text-sm font-extrabold text-[#111C2D] uppercase">
                            Acumulado 72h (mm)
                          </span>
                          <span className="text-xs text-[#475569] font-mono">24h ≤ 72h</span>
                        </div>
                        <div>
                          <label className="text-sm font-semibold text-[#1E293B] block mb-1">
                            Precaución (mm)
                          </label>
                          <input
                            type="number"
                            step="0.1"
                            value={formConfig.a72_precaucion}
                            onChange={(e) => setFormConfig({ ...formConfig, a72_precaucion: e.target.value })}
                            className="clay-input w-full px-3.5 py-2 text-base font-mono"
                            required
                          />
                        </div>
                        <div>
                          <label className="text-sm font-semibold text-[#1E293B] block mb-1">
                            Alerta (mm)
                          </label>
                          <input
                            type="number"
                            step="0.1"
                            value={formConfig.a72_alerta}
                            onChange={(e) => setFormConfig({ ...formConfig, a72_alerta: e.target.value })}
                            className="clay-input w-full px-3.5 py-2 text-base font-mono"
                            required
                          />
                        </div>
                        <div>
                          <label className="text-sm font-semibold text-[#1E293B] block mb-1">
                            Emergencia (mm)
                          </label>
                          <input
                            type="number"
                            step="0.1"
                            value={formConfig.a72_emergencia}
                            onChange={(e) => setFormConfig({ ...formConfig, a72_emergencia: e.target.value })}
                            className="clay-input w-full px-3.5 py-2 text-base font-mono"
                            required
                          />
                        </div>
                      </div>
                    </div>

                    {/* Parámetros de Histéresis y Saturación */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 clay-card-sm bg-[#F9F9FF]">
                      <div>
                        <label className="text-sm font-bold text-[#111C2D] block mb-1">
                          T_max (minutos vigencia)
                        </label>
                        <input
                          type="number"
                          value={formConfig.t_max_minutos}
                          onChange={(e) => setFormConfig({ ...formConfig, t_max_minutos: e.target.value })}
                          className="clay-input w-full px-3.5 py-2 text-base font-mono"
                          required
                        />
                      </div>
                      <div>
                        <label className="text-sm font-bold text-[#111C2D] block mb-1">
                          Separación mínima (minutos)
                        </label>
                        <input
                          type="number"
                          value={formConfig.separacion_minima_minutos}
                          onChange={(e) => setFormConfig({ ...formConfig, separacion_minima_minutos: e.target.value })}
                          className="clay-input w-full px-3.5 py-2 text-base font-mono"
                          required
                        />
                      </div>
                      <div>
                        <label className="text-sm font-bold text-[#111C2D] block mb-1">
                          Muestras para descenso (histéresis)
                        </label>
                        <input
                          type="number"
                          value={formConfig.muestras_descenso}
                          onChange={(e) => setFormConfig({ ...formConfig, muestras_descenso: e.target.value })}
                          className="clay-input w-full px-3.5 py-2 text-base font-mono"
                          required
                        />
                      </div>
                    </div>

                    {/* Justificación y Activación */}
                    <div className="space-y-3">
                      <div>
                        <label className="text-sm font-bold text-[#111C2D] block uppercase mb-1">
                          Motivo / Justificación Académica
                        </label>
                        <input
                          type="text"
                          value={formConfig.motivo}
                          onChange={(e) => setFormConfig({ ...formConfig, motivo: e.target.value })}
                          placeholder="Ej. Ajuste de umbrales para temporada de lluvias extraordinarias en cuenca Llojeta"
                          className="clay-input w-full px-4 py-2.5 text-base"
                          required
                        />
                      </div>

                      <label className="flex items-center gap-3 cursor-pointer select-none min-h-[48px]">
                        <input
                          type="checkbox"
                          id="check-activar"
                          checked={formConfig.activar}
                          onChange={(e) => setFormConfig({ ...formConfig, activar: e.target.checked })}
                          className="rounded border-slate-300 text-[#3525CD] focus:ring-[#3525CD] w-5 h-5"
                        />
                        <span className="text-sm sm:text-base font-semibold text-[#1E293B]">
                          Activar inmediatamente al guardar (archiva la versión vigente actual)
                        </span>
                      </label>
                    </div>

                    <button
                      type="submit"
                      disabled={cargando}
                      className="clay-btn-primary clay-interactive min-h-[50px] w-full sm:w-auto px-6 py-3 text-base font-bold disabled:opacity-50 inline-flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <span aria-hidden="true">💾</span>
                      <span>Guardar Nueva Versión</span>
                    </button>
                  </form>
                </section>

                {/* 1.C Historial de Versiones Inmutables */}
                <section className="clay-card p-5 sm:p-6 space-y-4">
                  <h3 className="text-sm font-extrabold text-[#111C2D] uppercase tracking-wider">
                    Historial de Versiones Inmutables ({configuraciones.length})
                  </h3>
                  <div className="overflow-x-auto rounded-xl border border-slate-200/80">
                    <table className="w-full text-left text-sm border-collapse">
                      <thead className="bg-[#F0F3FF]">
                        <tr className="border-b border-slate-200 text-[#475569] font-extrabold uppercase text-xs">
                          <th className="py-3 px-3.5">Versión</th>
                          <th className="py-3 px-3">Estado</th>
                          <th className="py-3 px-3">Motivo</th>
                          <th className="py-3 px-3">Autor</th>
                          <th className="py-3 px-3">Fecha</th>
                          <th className="py-3 px-3.5 text-right">Acción</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-mono text-xs sm:text-sm bg-white">
                        {configuraciones.map((cfg) => (
                          <tr key={cfg.id} className="hover:bg-[#F9F9FF]">
                            <td className="py-3 px-3.5 font-bold text-[#111C2D]">v{cfg.version}</td>
                            <td className="py-3 px-3">
                              <span
                                className={`clay-pill px-2.5 py-0.5 text-xs font-bold uppercase ${
                                  cfg.estado === 'vigente'
                                    ? 'bg-[#ECFDF5] text-[#065F46] border border-[#A7F3D0]'
                                    : cfg.estado === 'borrador'
                                    ? 'bg-[#FEF3C7] text-[#92400E] border border-[#FDE68A]'
                                    : 'bg-slate-100 text-[#475569]'
                                }`}
                              >
                                {cfg.estado}
                              </span>
                            </td>
                            <td className="py-3 px-3 font-sans text-[#1E293B] max-w-xs truncate">
                              {cfg.motivo || 'Sin motivo'}
                            </td>
                            <td className="py-3 px-3 text-[#475569]">{cfg.autor_nombre || 'Sistema'}</td>
                            <td className="py-3 px-3 text-[#475569]">
                              {new Date(cfg.creada_en).toLocaleDateString()}
                            </td>
                            <td className="py-3 px-3.5 text-right">
                              {cfg.estado === 'borrador' && (
                                <button
                                  type="button"
                                  onClick={() => handleActivarVersion(cfg.id, cfg.version)}
                                  className="min-h-[38px] px-3 py-1.5 rounded-full bg-[#059669] hover:bg-[#065F46] text-white text-xs font-bold transition-colors cursor-pointer"
                                >
                                  Activar versión
                                </button>
                              )}
                              {cfg.estado === 'vigente' && (
                                <span className="text-xs text-[#065F46] font-bold font-sans">
                                  ✓ En uso
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              </div>
            )}

            {/* ============================================================= */}
            {/* SECCIÓN 2: TEXTOS PREVENTIVOS (MÓDULO 3) */}
            {/* ============================================================= */}
            {seccionActiva === 'recomendaciones' && (
              <div className="space-y-6">
                <section className="clay-card p-5 sm:p-6 space-y-5">
                  <div className="border-b border-slate-100 pb-4">
                    <span className="swiss-chapter-badge">
                      Módulo 3: Comunicación Preventiva
                    </span>
                    <h2 className="headline-md text-xl font-bold text-[#111C2D] mt-1">
                      Publicar / Actualizar Recomendaciones Preventivas Generales
                    </h2>
                  </div>

                  <form onSubmit={handleGuardarRecomendacion} className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div>
                        <label className="text-sm font-bold text-[#111C2D] block mb-1">
                          Nivel Informativo
                        </label>
                        <select
                          value={formRec.nivel}
                          onChange={(e) => setFormRec({ ...formRec, nivel: e.target.value })}
                          className="clay-input w-full px-3.5 py-2 text-base"
                        >
                          <option value="NORMAL">NORMAL</option>
                          <option value="PRECAUCION">PRECAUCION</option>
                          <option value="ALERTA">ALERTA</option>
                          <option value="EMERGENCIA">EMERGENCIA</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-sm font-bold text-[#111C2D] block mb-1">
                          Estado Publicación
                        </label>
                        <select
                          value={formRec.estado_publicacion}
                          onChange={(e) => setFormRec({ ...formRec, estado_publicacion: e.target.value })}
                          className="clay-input w-full px-3.5 py-2 text-base"
                        >
                          <option value="publicado">Publicado</option>
                          <option value="borrador">Borrador</option>
                          <option value="archivado">Archivado</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-sm font-bold text-[#111C2D] block mb-1">
                          Etiqueta de Origen
                        </label>
                        <select
                          value={formRec.origen}
                          onChange={(e) => setFormRec({ ...formRec, origen: e.target.value })}
                          className="clay-input w-full px-3.5 py-2 text-base"
                        >
                          <option value="demostracion">demostracion</option>
                          <option value="institucional_verificada">institucional_verificada</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="text-sm font-bold text-[#111C2D] block mb-1">
                        Título Descriptivo
                      </label>
                      <input
                        type="text"
                        value={formRec.titulo}
                        onChange={(e) => setFormRec({ ...formRec, titulo: e.target.value })}
                        placeholder="Ej. Medidas preventivas generales para lluvia intensa"
                        className="clay-input w-full px-4 py-2.5 text-base"
                        required
                      />
                    </div>

                    <div>
                      <label className="text-sm font-bold text-[#111C2D] block mb-1">
                        Contenido de la Recomendación
                      </label>
                      <textarea
                        rows={3}
                        value={formRec.contenido}
                        onChange={(e) => setFormRec({ ...formRec, contenido: e.target.value })}
                        placeholder="Recomendaciones preventivas generales en cuenca Llojeta..."
                        className="clay-input w-full px-4 py-3 text-base"
                        required
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={cargando}
                      className="clay-btn-primary clay-interactive min-h-[50px] w-full sm:w-auto px-6 py-3 text-base font-bold disabled:opacity-50 cursor-pointer"
                    >
                      Guardar Recomendación
                    </button>
                  </form>
                </section>

                {/* Listado con Filtros por Nivel */}
                <section className="clay-card p-5 sm:p-6 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
                    <h3 className="text-sm font-extrabold text-[#111C2D] uppercase tracking-wider">
                      Recomendaciones Registradas ({recomendacionesFiltradas.length})
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {['TODOS', 'NORMAL', 'PRECAUCION', 'ALERTA', 'EMERGENCIA'].map((n) => (
                        <button
                          key={n}
                          type="button"
                          onClick={() => setFiltroNivelRec(n)}
                          className={`clay-pill min-h-[40px] px-3.5 py-1.5 text-xs font-bold transition-colors cursor-pointer ${
                            filtroNivelRec === n
                              ? 'bg-[#3525CD] text-white'
                              : 'bg-[#F0F3FF] text-[#464555] hover:text-[#111C2D]'
                          }`}
                        >
                          {n}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-3">
                    {recomendacionesFiltradas.map((rec) => (
                      <div
                        key={rec.id}
                        className="clay-card-sm p-4 bg-[#F9F9FF] flex flex-col justify-between gap-2"
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-extrabold text-sm text-[#111C2D]">{rec.nivel}</span>
                          <span className="font-mono text-xs text-[#475569]">v{rec.version}</span>
                          <span
                            className={`clay-pill px-2.5 py-0.5 text-xs font-bold uppercase ${
                              rec.estado_publicacion === 'publicado'
                                ? 'bg-[#ECFDF5] text-[#065F46]'
                                : 'bg-slate-200 text-[#475569]'
                            }`}
                          >
                            {rec.estado_publicacion}
                          </span>
                          <span className="text-xs text-[#92400E] italic font-semibold">
                            [{rec.origen}]
                          </span>
                        </div>
                        <p className="font-bold text-base text-[#111C2D]">{rec.titulo}</p>
                        <p className="text-base text-[#464555] leading-relaxed">{rec.contenido}</p>
                      </div>
                    ))}
                  </div>
                </section>
              </div>
            )}

            {/* ============================================================= */}
            {/* SECCIÓN 3: CONTACTOS DE EMERGENCIA */}
            {/* ============================================================= */}
            {seccionActiva === 'contactos' && (
              <div className="space-y-6">
                <section className="clay-card p-5 sm:p-6 space-y-4">
                  <h2 className="headline-md text-xl font-bold text-[#111C2D] border-b border-slate-100 pb-4">
                    Registrar Contacto de Auxilio Ciudadano
                  </h2>
                  <form onSubmit={handleGuardarContacto} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div>
                      <label className="text-sm font-bold text-[#111C2D] block mb-1">
                        Nombre / Institución
                      </label>
                      <input
                        type="text"
                        value={formContacto.nombre}
                        onChange={(e) => setFormContacto({ ...formContacto, nombre: e.target.value })}
                        placeholder="Ej. Red 114 — GAMLP"
                        className="clay-input w-full px-3.5 py-2 text-base"
                        required
                      />
                    </div>
                    <div>
                      <label className="text-sm font-bold text-[#111C2D] block mb-1">
                        Teléfono / Línea
                      </label>
                      <input
                        type="text"
                        value={formContacto.telefono}
                        onChange={(e) => setFormContacto({ ...formContacto, telefono: e.target.value })}
                        placeholder="Ej. 114 / 800-140202"
                        className="clay-input w-full px-3.5 py-2 text-base font-mono"
                        required
                      />
                    </div>
                    <div className="flex items-end sm:col-span-2 lg:col-span-1">
                      <button
                        type="submit"
                        disabled={cargando}
                        className="clay-btn-primary clay-interactive w-full min-h-[48px] px-4 py-2.5 text-base font-bold cursor-pointer"
                      >
                        Agregar Contacto
                      </button>
                    </div>
                  </form>
                </section>

                <section className="clay-card p-5 sm:p-6 space-y-4">
                  <h3 className="text-sm font-extrabold text-[#111C2D] uppercase tracking-wider">
                    Contactos de Emergencia Activos ({contactos.length})
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {contactos.map((c) => (
                      <div
                        key={c.id}
                        className="clay-card-sm p-4 bg-[#F9F9FF] flex items-center justify-between gap-3"
                      >
                        <div className="space-y-0.5 min-w-0">
                          <p className="font-bold text-base text-[#111C2D] break-words">{c.nombre}</p>
                          <p className="telemetry-num text-xl font-extrabold text-[#111C2D]">{c.telefono}</p>
                          <p className="text-xs text-[#475569]">{c.fuente || 'Directorio municipal La Paz'}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleToggleContactoActivo(c)}
                          className={`clay-pill min-h-[44px] px-4 py-1.5 text-sm font-bold transition-colors shrink-0 cursor-pointer ${
                            c.activo
                              ? 'bg-[#ECFDF5] text-[#065F46] hover:bg-[#D1FAE5] border border-[#A7F3D0]'
                              : 'bg-slate-200 text-[#475569] hover:bg-slate-300'
                          }`}
                        >
                          {c.activo ? 'Activo' : 'Inactivo'}
                        </button>
                      </div>
                    ))}
                  </div>
                </section>
              </div>
            )}

            {/* ============================================================= */}
            {/* SECCIÓN 4: CAPAS Y REFERENCIAS CARTOGRÁFICAS */}
            {/* ============================================================= */}
            {seccionActiva === 'capas' && (
              <div className="space-y-6">
                <div className="clay-card-sm border border-[#E2DFFF] bg-[#EEF2FF] p-4 sm:p-5 text-base text-[#111C2D] space-y-1">
                  <p className="font-bold flex items-center gap-2 text-[#3525CD]">
                    <span aria-hidden="true">ℹ️</span> Regla de Gobernanza Espacial (Salvaguarda Cartográfica):
                  </p>
                  <p className="leading-relaxed text-[#1E293B]">
                    Las geometrías GeoJSON y coordenadas se cargan mediante script y son inmutables desde la interfaz de usuario. Desde este panel solo se administran los atributos descriptivos, procedencia y estado de verificación.
                  </p>
                </div>

                {/* Zonas de Referencia */}
                <section className="clay-card p-5 sm:p-6 space-y-4">
                  <h3 className="text-sm font-extrabold text-[#111C2D] uppercase tracking-wider">
                    Polígonos de Cuenca / Zonas de Referencia ({capas.zonas?.length || 0})
                  </h3>
                  <div className="space-y-4">
                    {capas.zonas?.map((z) => (
                      <div
                        key={z.id}
                        className="clay-card-sm p-4 bg-[#F9F9FF] space-y-3"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="font-bold text-[#111C2D] text-base">{z.nombre}</span>
                          <span className="font-mono text-xs text-[#475569]">ID: {z.id}</span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="text-xs font-bold text-[#475569] uppercase block mb-1">
                              Fuente
                            </label>
                            <input
                              type="text"
                              value={z.fuente || ''}
                              onChange={(e) => {
                                const actualizadas = capas.zonas.map((item) =>
                                  item.id === z.id ? { ...item, fuente: e.target.value } : item
                                );
                                setCapas({ ...capas, zonas: actualizadas });
                              }}
                              className="clay-input w-full px-3.5 py-2 text-sm sm:text-base"
                            />
                          </div>
                          <div>
                            <label className="text-xs font-bold text-[#475569] uppercase block mb-1">
                              Advertencia de Demostración
                            </label>
                            <input
                              type="text"
                              value={z.advertencia || ''}
                              onChange={(e) => {
                                const actualizadas = capas.zonas.map((item) =>
                                  item.id === z.id ? { ...item, advertencia: e.target.value } : item
                                );
                                setCapas({ ...capas, zonas: actualizadas });
                              }}
                              className="clay-input w-full px-3.5 py-2 text-sm sm:text-base"
                            />
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleGuardarZona(z)}
                          className="clay-btn-primary clay-interactive min-h-[48px] w-full sm:w-auto px-5 py-2 text-sm font-bold cursor-pointer"
                        >
                          Guardar Atributos de Zona
                        </button>
                      </div>
                    ))}
                  </div>
                </section>

                {/* Puntos de Referencia */}
                <section className="clay-card p-5 sm:p-6 space-y-4">
                  <h3 className="text-sm font-extrabold text-[#111C2D] uppercase tracking-wider">
                    Puntos de Referencia ({capas.puntos?.length || 0})
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {capas.puntos?.map((p) => (
                      <div
                        key={p.id}
                        className="clay-card-sm p-4 bg-[#F9F9FF] space-y-3"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="font-bold text-base text-[#111C2D]">{p.nombre}</span>
                          <span className="font-mono text-xs text-[#475569]">
                            [{p.latitud}, {p.longitud}]
                          </span>
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs font-bold text-[#475569] uppercase block">
                            Estado Verificación
                          </label>
                          <select
                            value={p.estado_verificacion}
                            onChange={(e) => {
                              const actualizados = capas.puntos.map((item) =>
                                item.id === p.id ? { ...item, estado_verificacion: e.target.value } : item
                              );
                              setCapas({ ...capas, puntos: actualizados });
                            }}
                            className="clay-input w-full px-3.5 py-2 text-sm sm:text-base"
                          >
                            <option value="sin_verificar">sin_verificar</option>
                            <option value="verificado_por_autoridad">verificado_por_autoridad</option>
                          </select>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleGuardarPunto(p)}
                          className="clay-btn-primary clay-interactive min-h-[48px] w-full sm:w-auto px-5 py-2 text-sm font-bold cursor-pointer"
                        >
                          Guardar Punto
                        </button>
                      </div>
                    ))}
                  </div>
                </section>
              </div>
            )}

            {/* ============================================================= */}
            {/* SECCIÓN 5: MODO DEMOSTRACIÓN / SIMULACIÓN (P11) */}
            {/* ============================================================= */}
            {seccionActiva === 'simulacion' && (
              <div className="space-y-6">
                <section className="clay-card p-5 sm:p-6 space-y-5">
                  <div className="border-b border-slate-100 pb-4">
                    <span className="swiss-chapter-badge">
                      Aislamiento Estricto P11
                    </span>
                    <h2 className="headline-md text-xl font-bold text-[#111C2D] mt-1">
                      Control de Simulación para Demostración Académica
                    </h2>
                    <p className="text-base text-[#464555] leading-relaxed mt-1">
                      Las lecturas de modalidad simulada se almacenan en un entorno aislado y nunca alteran el estado real ni su contador de descenso.
                    </p>
                  </div>

                  {/* 4 Botones de Demostración Rápida */}
                  <div className="space-y-3">
                    <span className="text-sm font-extrabold text-[#111C2D] block uppercase">
                      Presets Rápidos para Defensa
                    </span>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <button
                        type="button"
                        onClick={() => inyectarPreset(0.4, 2.0, 6.0, 'NORMAL')}
                        className="clay-card-sm clay-interactive min-h-[76px] p-3.5 border border-[#A7F3D0] bg-[#ECFDF5] hover:bg-[#D1FAE5] text-[#065F46] font-bold text-sm flex flex-col items-center justify-center gap-1 cursor-pointer"
                      >
                        <span className="w-2.5 h-2.5 rounded-full bg-[#059669]" aria-hidden="true" />
                        <span>Demostrar NORMAL</span>
                        <span className="font-mono text-xs font-normal">0.4 mm/h · 2.0 mm</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => inyectarPreset(3.2, 14.0, 30.0, 'PRECAUCIÓN')}
                        className="clay-card-sm clay-interactive min-h-[76px] p-3.5 border border-[#FDE68A] bg-[#FEF3C7] hover:bg-[#FDE68A]/70 text-[#92400E] font-bold text-sm flex flex-col items-center justify-center gap-1 cursor-pointer"
                      >
                        <span className="w-2.5 h-2.5 rounded-full bg-[#B45309]" aria-hidden="true" />
                        <span>Demostrar PRECAUCIÓN</span>
                        <span className="font-mono text-xs font-normal">3.2 mm/h · 14.0 mm</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => inyectarPreset(7.5, 28.0, 64.0, 'ALERTA')}
                        className="clay-card-sm clay-interactive min-h-[76px] p-3.5 border border-[#FED7AA] bg-[#FFEDD5] hover:bg-[#FED7AA]/70 text-[#9A3412] font-bold text-sm flex flex-col items-center justify-center gap-1 cursor-pointer"
                      >
                        <span className="w-2.5 h-2.5 rounded-full bg-[#C2410C]" aria-hidden="true" />
                        <span>Demostrar ALERTA</span>
                        <span className="font-mono text-xs font-normal">7.5 mm/h · 28.0 mm</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => inyectarPreset(14.5, 48.0, 98.0, 'EMERGENCIA')}
                        className="clay-card-sm clay-interactive min-h-[76px] p-3.5 border border-[#FECACA] bg-[#FEE2E2] hover:bg-[#FECACA]/70 text-[#991B1B] font-bold text-sm flex flex-col items-center justify-center gap-1 cursor-pointer"
                      >
                        <span className="w-2.5 h-2.5 rounded-full bg-[#DC2626]" aria-hidden="true" />
                        <span>Demostrar EMERGENCIA</span>
                        <span className="font-mono text-xs font-normal">14.5 mm/h · 48.0 mm</span>
                      </button>
                    </div>
                  </div>

                  {/* Formulario de Inyección Personalizada */}
                  <div className="clay-card-sm p-4 sm:p-5 bg-[#F9F9FF] space-y-4">
                    <span className="text-sm font-extrabold text-[#111C2D] block uppercase">
                      Inyección Manual de Métricas Pluviométricas
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div>
                        <label className="text-sm font-semibold text-[#1E293B] block mb-1">
                          Intensidad Horaria (mm/h)
                        </label>
                        <input
                          type="number"
                          step="0.1"
                          value={simManual.intensidad}
                          onChange={(e) => setSimManual({ ...simManual, intensidad: e.target.value })}
                          className="clay-input w-full px-3.5 py-2 text-base font-mono"
                        />
                      </div>
                      <div>
                        <label className="text-sm font-semibold text-[#1E293B] block mb-1">
                          Acumulado 24h (mm)
                        </label>
                        <input
                          type="number"
                          step="0.1"
                          value={simManual.acum_24h}
                          onChange={(e) => setSimManual({ ...simManual, acum_24h: e.target.value })}
                          className="clay-input w-full px-3.5 py-2 text-base font-mono"
                        />
                      </div>
                      <div>
                        <label className="text-sm font-semibold text-[#1E293B] block mb-1">
                          Acumulado 72h (mm)
                        </label>
                        <input
                          type="number"
                          step="0.1"
                          value={simManual.acum_72h}
                          onChange={(e) => setSimManual({ ...simManual, acum_72h: e.target.value })}
                          className="clay-input w-full px-3.5 py-2 text-base font-mono"
                        />
                      </div>
                    </div>

                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-1">
                      <button
                        type="button"
                        onClick={() =>
                          inyectarPreset(
                            Number(simManual.intensidad),
                            Number(simManual.acum_24h),
                            Number(simManual.acum_72h),
                            'Manual'
                          )
                        }
                        className="clay-btn-primary clay-interactive min-h-[48px] px-5 py-2.5 text-sm sm:text-base font-bold cursor-pointer"
                      >
                        Inyectar Lectura Manual
                      </button>
                      <button
                        type="button"
                        onClick={handleLimpiarSimulacion}
                        className="clay-pill clay-interactive min-h-[48px] px-5 py-2.5 bg-[#FEE2E2] text-[#991B1B] hover:bg-[#FECACA] border border-[#FECACA] text-sm sm:text-base font-bold cursor-pointer"
                      >
                        🧹 Limpiar Datos de Simulación
                      </button>
                    </div>
                  </div>
                </section>
              </div>
            )}

            {/* ============================================================= */}
            {/* SECCIÓN 6: BITÁCORA DE CAMBIOS (AUDITORÍA) */}
            {/* ============================================================= */}
            {seccionActiva === 'bitacora' && (
              <section className="clay-card p-5 sm:p-6 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
                  <div>
                    <span className="swiss-chapter-badge">
                      Auditoría Inmutable
                    </span>
                    <h2 className="headline-md text-xl font-bold text-[#111C2D] mt-1">
                      Bitácora Cronológica de Cambios ({bitacoraFiltrada.length} registros)
                    </h2>
                  </div>

                  {/* Filtro por Entidad */}
                  <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                    <label className="text-sm text-[#475569] font-semibold">Filtrar entidad:</label>
                    <select
                      value={filtroBitacora}
                      onChange={(e) => setFiltroBitacora(e.target.value)}
                      className="clay-input px-3.5 py-2 text-sm sm:text-base"
                    >
                      <option value="TODAS">Todas las entidades</option>
                      <option value="configuraciones_reglas">configuraciones_reglas</option>
                      <option value="umbrales">umbrales</option>
                      <option value="recomendaciones_preventivas">recomendaciones_preventivas</option>
                      <option value="contactos_emergencia">contactos_emergencia</option>
                      <option value="zonas_referencia">zonas_referencia</option>
                      <option value="puntos_referencia">puntos_referencia</option>
                    </select>
                  </div>
                </div>

                <div className="overflow-x-auto rounded-xl border border-slate-200/80">
                  <table className="w-full text-left text-sm border-collapse">
                    <thead className="bg-[#F0F3FF]">
                      <tr className="border-b border-slate-200 text-[#475569] font-extrabold uppercase text-xs">
                        <th className="py-3 px-3.5">Fecha / Hora</th>
                        <th className="py-3 px-3">Usuario</th>
                        <th className="py-3 px-3">Entidad</th>
                        <th className="py-3 px-3">Acción</th>
                        <th className="py-3 px-3.5">Resumen de Cambio</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-mono text-xs sm:text-sm bg-white">
                      {bitacoraFiltrada.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="py-6 text-center text-[#475569] font-sans italic">
                            No se encontraron registros de auditoría para el filtro seleccionado.
                          </td>
                        </tr>
                      ) : (
                        bitacoraFiltrada.map((b) => (
                          <tr key={b.id} className="hover:bg-[#F9F9FF]">
                            <td className="py-3 px-3.5 text-[#475569] whitespace-nowrap">
                              {new Date(b.ocurrido_en).toLocaleString()}
                            </td>
                            <td className="py-3 px-3 font-sans font-semibold text-[#111C2D] whitespace-nowrap">
                              {b.usuario_nombre || 'Sistema'}
                            </td>
                            <td className="py-3 px-3 text-[#1E293B] font-bold">{b.entidad}</td>
                            <td className="py-3 px-3">
                              <span
                                className={`clay-pill px-2.5 py-0.5 text-xs font-bold uppercase ${
                                  b.accion === 'crear'
                                    ? 'bg-[#EEF2FF] text-[#3525CD]'
                                    : b.accion === 'activar'
                                    ? 'bg-[#ECFDF5] text-[#065F46]'
                                    : b.accion === 'modificar'
                                    ? 'bg-[#FEF3C7] text-[#92400E]'
                                    : 'bg-slate-200 text-[#475569]'
                                }`}
                              >
                                {b.accion}
                              </span>
                            </td>
                            <td className="py-3 px-3.5 font-sans text-[#464555] max-w-sm truncate">
                              {b.valor_nuevo ? JSON.stringify(b.valor_nuevo).substring(0, 90) + '...' : '-'}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </section>
            )}
          </div>
        </div>

        {/* Aviso Permanente Inamovible al pie de la consola */}
        <AvisoPermanente />
      </main>
    </div>
  );
}
