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
 * Panel de Administración Institucional PUKARA (Estilo Bento Desktop + Mobile-First).
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
    // Umbrales
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

  // Carga de datos según la sección activa
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
  const inyectarPreset = async (intensidad, acum24, acum72, nivelNombre) => {
    try {
      setCargando(true);
      const res = await inyectarLecturaSimuladaAdmin({
        intensidad_mm_h: intensidad,
        acum_24h_mm: acum24,
        acum_72h_mm: acum72,
        observado_en: new Date().toISOString(),
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

  // Versión vigente actual para visualización destacada
  const versionVigente = configuraciones.find((c) => c.estado === 'vigente') || configuraciones[0];

  // Filtrado de recomendaciones
  const recomendacionesFiltradas =
    filtroNivelRec === 'TODOS'
      ? recomendaciones
      : recomendaciones.filter((r) => r.nivel === filtroNivelRec);

  // Filtrado de bitácora
  const bitacoraFiltrada =
    filtroBitacora === 'TODAS'
      ? bitacora
      : bitacora.filter((b) => b.entidad === filtroBitacora);

  return (
    <div className="min-h-screen bg-[#F4F7FB] text-slate-800 flex flex-col font-sans">
      {/* 1. Cabecera Superior del Panel Administrativo */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200/80 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          {/* Marca e Identidad Institucional */}
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
                <h1 className="font-extrabold text-base tracking-tight text-slate-900 leading-none">
                  Panel de Administración PUKARA
                </h1>
                <span className="hidden sm:inline-block text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200/80">
                  Consola Administrativa · Rol: Administrador
                </span>
              </div>
              <p className="text-[11px] text-slate-500 font-mono mt-0.5">
                {usuario?.nombre || 'Administrador PUKARA'} · {usuario?.email || 'admin@pukara.bo'}
              </p>
            </div>
          </div>

          {/* Botones de Navegación y Sesión */}
          <div className="flex items-center gap-2.5">
            <Link
              to="/"
              className="min-h-[40px] px-3.5 py-1.5 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition-colors inline-flex items-center gap-1.5 shadow-2xs"
            >
              <span>← Ver Consulta Pública</span>
            </Link>
            <button
              type="button"
              onClick={handleCerrarSesion}
              className="min-h-[40px] px-3.5 py-1.5 rounded-xl bg-red-50 text-red-700 hover:bg-red-100 border border-red-200 text-xs font-semibold transition-colors inline-flex items-center gap-1.5 cursor-pointer"
            >
              <span aria-hidden="true">🚪</span>
              <span>Cerrar sesión</span>
            </button>
          </div>
        </div>
      </header>

      {/* 2. Barra de Navegación Horizontal Deslizable para Móviles */}
      <div className="lg:hidden bg-white border-b border-slate-200/80 px-4 py-2.5 overflow-x-auto">
        <nav aria-label="Secciones móviles" className="flex items-center gap-1.5 min-w-max">
          {SECCIONES.map((sec) => (
            <button
              key={sec.id}
              type="button"
              onClick={() => setSeccionActiva(sec.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all inline-flex items-center gap-1.5 ${
                seccionActiva === sec.id
                  ? 'bg-[#0F172A] text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <span>{sec.icono}</span>
              <span>{sec.label}</span>
            </button>
          ))}
        </nav>
      </div>

      {/* 3. Contenedor Principal Bento Layout con Sidebar Desktop */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6 w-full flex-1">
        {/* Notificaciones globales */}
        {mensajeExito && (
          <div
            role="status"
            className="rounded-2xl border border-emerald-300 bg-emerald-50 p-3.5 text-xs text-emerald-950 font-medium flex items-center gap-2 shadow-xs"
          >
            <span aria-hidden="true">✅</span>
            <span>{mensajeExito}</span>
          </div>
        )}

        {errorGlobal && (
          <div
            role="alert"
            className="rounded-2xl border border-red-300 bg-red-50 p-3.5 text-xs text-red-950 font-medium flex items-center gap-2 shadow-xs"
          >
            <span aria-hidden="true">⚠️</span>
            <span>{errorGlobal}</span>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Sidebar Desktop (col-span-3) */}
          <aside className="hidden lg:block lg:col-span-3 space-y-4 sticky top-24">
            <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm space-y-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block px-2 pb-1">
                Módulos de Configuración
              </span>
              <nav aria-label="Navegación administrativa desktop" className="space-y-1">
                {SECCIONES.map((sec) => {
                  const activa = seccionActiva === sec.id;
                  return (
                    <button
                      key={sec.id}
                      type="button"
                      onClick={() => setSeccionActiva(sec.id)}
                      className={`w-full text-left p-2.5 rounded-xl text-xs font-semibold transition-all flex items-start gap-2.5 cursor-pointer ${
                        activa
                          ? 'bg-[#0F172A] text-white shadow-xs'
                          : 'text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      <span className="text-base shrink-0">{sec.icono}</span>
                      <div className="min-w-0">
                        <span className="block truncate">{sec.label}</span>
                        <span className={`block text-[10px] font-normal truncate ${activa ? 'text-slate-300' : 'text-slate-400'}`}>
                          {sec.desc}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </nav>
            </div>

            <div className="rounded-2xl border border-slate-200/80 bg-slate-50/80 p-4 text-xs text-slate-600 space-y-1.5">
              <span className="font-bold text-slate-900 block text-[11px] uppercase tracking-wider">
                Gobernanza Institucional
              </span>
              <p className="text-[11px] leading-relaxed text-slate-500">
                Toda modificación genera un registro inmutable en la bitácora relacional con autor, fecha, entidad y valores antes/después.
              </p>
            </div>
          </aside>

          {/* Área Principal de Contenido (col-span-9) */}
          <div className="lg:col-span-9 space-y-6">
            {/* ============================================================= */}
            {/* SECCIÓN 1: UMBRALES Y MOTOR (P05/P16) */}
            {/* ============================================================= */}
            {seccionActiva === 'umbrales' && (
              <div className="space-y-6">
                {/* 1.A Tarjeta Destacada: Versión Vigente Actual */}
                <section className="rounded-2xl border border-slate-200/80 bg-white p-5 md:p-6 shadow-sm space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
                    <div>
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                        Parámetros Activos del Motor
                      </span>
                      <h2 className="text-base font-bold text-slate-900">
                        Configuración Vigente v{versionVigente?.version ?? 1}
                      </h2>
                    </div>
                    <span className="px-2.5 py-1 rounded-full text-xs font-bold uppercase bg-emerald-50 text-emerald-700 border border-emerald-200">
                      ✓ Vigente en Motor
                    </span>
                  </div>

                  <p className="text-xs text-slate-600">
                    <strong className="font-semibold text-slate-800">Motivo de versión:</strong>{' '}
                    {versionVigente?.motivo || 'Configuración inicial ratificada'}
                  </p>

                  {/* Matriz 3x3 de Umbrales */}
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-slate-200 text-slate-500 font-semibold uppercase text-[10px]">
                          <th className="py-2.5 px-3">Variable Pluviométrica</th>
                          <th className="py-2.5 px-3 text-amber-800 bg-amber-50/50">PRECAUCIÓN</th>
                          <th className="py-2.5 px-3 text-orange-800 bg-orange-50/50">ALERTA</th>
                          <th className="py-2.5 px-3 text-red-800 bg-red-50/50">EMERGENCIA</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-mono text-xs">
                        <tr>
                          <td className="py-2.5 px-3 font-sans font-semibold text-slate-800">
                            Intensidad Horaria (mm/h)
                          </td>
                          <td className="py-2.5 px-3 font-bold text-amber-900 bg-amber-50/30">
                            {versionVigente?.umbrales?.find((u) => u.variable === 'intensidad_mm_h' && u.nivel === 'PRECAUCION')?.valor ?? formConfig.int_precaucion} mm/h
                          </td>
                          <td className="py-2.5 px-3 font-bold text-orange-900 bg-orange-50/30">
                            {versionVigente?.umbrales?.find((u) => u.variable === 'intensidad_mm_h' && u.nivel === 'ALERTA')?.valor ?? formConfig.int_alerta} mm/h
                          </td>
                          <td className="py-2.5 px-3 font-bold text-red-900 bg-red-50/30">
                            {versionVigente?.umbrales?.find((u) => u.variable === 'intensidad_mm_h' && u.nivel === 'EMERGENCIA')?.valor ?? formConfig.int_emergencia} mm/h
                          </td>
                        </tr>
                        <tr>
                          <td className="py-2.5 px-3 font-sans font-semibold text-slate-800">
                            Acumulado 24 Horas (mm)
                          </td>
                          <td className="py-2.5 px-3 font-bold text-amber-900 bg-amber-50/30">
                            {versionVigente?.umbrales?.find((u) => u.variable === 'acum_24h_mm' && u.nivel === 'PRECAUCION')?.valor ?? formConfig.a24_precaucion} mm
                          </td>
                          <td className="py-2.5 px-3 font-bold text-orange-900 bg-orange-50/30">
                            {versionVigente?.umbrales?.find((u) => u.variable === 'acum_24h_mm' && u.nivel === 'ALERTA')?.valor ?? formConfig.a24_alerta} mm
                          </td>
                          <td className="py-2.5 px-3 font-bold text-red-900 bg-red-50/30">
                            {versionVigente?.umbrales?.find((u) => u.variable === 'acum_24h_mm' && u.nivel === 'EMERGENCIA')?.valor ?? formConfig.a24_emergencia} mm
                          </td>
                        </tr>
                        <tr>
                          <td className="py-2.5 px-3 font-sans font-semibold text-slate-800">
                            Acumulado 72 Horas (mm)
                          </td>
                          <td className="py-2.5 px-3 font-bold text-amber-900 bg-amber-50/30">
                            {versionVigente?.umbrales?.find((u) => u.variable === 'acum_72h_mm' && u.nivel === 'PRECAUCION')?.valor ?? formConfig.a72_precaucion} mm
                          </td>
                          <td className="py-2.5 px-3 font-bold text-orange-900 bg-orange-50/30">
                            {versionVigente?.umbrales?.find((u) => u.variable === 'acum_72h_mm' && u.nivel === 'ALERTA')?.valor ?? formConfig.a72_alerta} mm
                          </td>
                          <td className="py-2.5 px-3 font-bold text-red-900 bg-red-50/30">
                            {versionVigente?.umbrales?.find((u) => u.variable === 'acum_72h_mm' && u.nivel === 'EMERGENCIA')?.valor ?? formConfig.a72_emergencia} mm
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  {/* Parámetros de Histéresis y Saturación de la versión vigente */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1 text-xs">
                    <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                      <span className="text-[10px] text-slate-500 uppercase block font-semibold">T_max Vigencia</span>
                      <span className="font-mono font-bold text-slate-900 text-sm">
                        {versionVigente?.parametros?.t_max_minutos ?? formConfig.t_max_minutos} min
                      </span>
                    </div>
                    <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                      <span className="text-[10px] text-slate-500 uppercase block font-semibold">Descenso Histéresis</span>
                      <span className="font-mono font-bold text-slate-900 text-sm">
                        {versionVigente?.parametros?.muestras_descenso ?? formConfig.muestras_descenso} muestras
                      </span>
                    </div>
                    <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                      <span className="text-[10px] text-slate-500 uppercase block font-semibold">Separación Mínima</span>
                      <span className="font-mono font-bold text-slate-900 text-sm">
                        {versionVigente?.parametros?.separacion_minima_minutos ?? formConfig.separacion_minima_minutos} min
                      </span>
                    </div>
                    <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                      <span className="text-[10px] text-slate-500 uppercase block font-semibold">Saturación Cuenca</span>
                      <span className="font-mono font-bold text-slate-900 text-sm">
                        ≥ {versionVigente?.parametros?.saturacion?.acum_72h_min_mm ?? formConfig.sat_acum_72h}mm / 72h
                      </span>
                    </div>
                  </div>
                </section>

                {/* 1.B Formulario de Nueva Versión Inmutable (P05/P16) */}
                <section className="rounded-2xl border border-slate-200/80 bg-white p-5 md:p-6 shadow-sm space-y-5">
                  <div className="border-b border-slate-100 pb-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                        Reglas P05 y P16
                      </span>
                      <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                        Inmutabilidad Garantizada
                      </span>
                    </div>
                    <h2 className="text-base font-bold text-slate-900 mt-1">
                      Crear Nueva Versión Inmutable de Configuración
                    </h2>
                    <p className="text-xs text-slate-500 leading-relaxed mt-0.5">
                      Las configuraciones son inmutables. Crear una versión nueva no recalcula evaluaciones pasadas y reinicia el contador de descenso de histéresis.
                    </p>
                  </div>

                  {/* Banner de Validación P16 */}
                  {erroresValidacionConfig.length > 0 && (
                    <div
                      role="alert"
                      className="rounded-xl border border-red-300 bg-red-50 p-4 text-xs text-red-950 space-y-2 shadow-xs"
                    >
                      <p className="font-bold flex items-center gap-1.5">
                        <span>🛑</span> Error de Validación Estricta (Regla P16):
                      </p>
                      <ul className="list-disc list-inside space-y-1 pl-1 text-red-900/90 font-mono text-[11px]">
                        {erroresValidacionConfig.map((errStr, idx) => (
                          <li key={idx}>{errStr}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <form onSubmit={handleGuardarConfig} className="space-y-5">
                    {/* Grilla de los 9 Umbrales en 3 Columnas por Variable */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {/* Intensidad Horaria */}
                      <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 space-y-3">
                        <div className="flex items-center justify-between border-b border-slate-200 pb-1.5">
                          <span className="text-xs font-bold text-slate-800 uppercase">
                            Intensidad (mm/h)
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono">P &lt; A &lt; E</span>
                        </div>
                        <div>
                          <label className="text-[11px] font-medium text-slate-600 block mb-1">
                            Precaución (mm/h)
                          </label>
                          <input
                            type="number"
                            step="0.1"
                            value={formConfig.int_precaucion}
                            onChange={(e) => setFormConfig({ ...formConfig, int_precaucion: e.target.value })}
                            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-mono focus:ring-2 focus:ring-slate-900"
                            required
                          />
                        </div>
                        <div>
                          <label className="text-[11px] font-medium text-slate-600 block mb-1">
                            Alerta (mm/h)
                          </label>
                          <input
                            type="number"
                            step="0.1"
                            value={formConfig.int_alerta}
                            onChange={(e) => setFormConfig({ ...formConfig, int_alerta: e.target.value })}
                            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-mono focus:ring-2 focus:ring-slate-900"
                            required
                          />
                        </div>
                        <div>
                          <label className="text-[11px] font-medium text-slate-600 block mb-1">
                            Emergencia (mm/h)
                          </label>
                          <input
                            type="number"
                            step="0.1"
                            value={formConfig.int_emergencia}
                            onChange={(e) => setFormConfig({ ...formConfig, int_emergencia: e.target.value })}
                            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-mono focus:ring-2 focus:ring-slate-900"
                            required
                          />
                        </div>
                      </div>

                      {/* Acumulado 24h */}
                      <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 space-y-3">
                        <div className="flex items-center justify-between border-b border-slate-200 pb-1.5">
                          <span className="text-xs font-bold text-slate-800 uppercase">
                            Acumulado 24h (mm)
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono">P &lt; A &lt; E</span>
                        </div>
                        <div>
                          <label className="text-[11px] font-medium text-slate-600 block mb-1">
                            Precaución (mm)
                          </label>
                          <input
                            type="number"
                            step="0.1"
                            value={formConfig.a24_precaucion}
                            onChange={(e) => setFormConfig({ ...formConfig, a24_precaucion: e.target.value })}
                            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-mono focus:ring-2 focus:ring-slate-900"
                            required
                          />
                        </div>
                        <div>
                          <label className="text-[11px] font-medium text-slate-600 block mb-1">
                            Alerta (mm)
                          </label>
                          <input
                            type="number"
                            step="0.1"
                            value={formConfig.a24_alerta}
                            onChange={(e) => setFormConfig({ ...formConfig, a24_alerta: e.target.value })}
                            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-mono focus:ring-2 focus:ring-slate-900"
                            required
                          />
                        </div>
                        <div>
                          <label className="text-[11px] font-medium text-slate-600 block mb-1">
                            Emergencia (mm)
                          </label>
                          <input
                            type="number"
                            step="0.1"
                            value={formConfig.a24_emergencia}
                            onChange={(e) => setFormConfig({ ...formConfig, a24_emergencia: e.target.value })}
                            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-mono focus:ring-2 focus:ring-slate-900"
                            required
                          />
                        </div>
                      </div>

                      {/* Acumulado 72h */}
                      <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 space-y-3">
                        <div className="flex items-center justify-between border-b border-slate-200 pb-1.5">
                          <span className="text-xs font-bold text-slate-800 uppercase">
                            Acumulado 72h (mm)
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono">24h ≤ 72h</span>
                        </div>
                        <div>
                          <label className="text-[11px] font-medium text-slate-600 block mb-1">
                            Precaución (mm)
                          </label>
                          <input
                            type="number"
                            step="0.1"
                            value={formConfig.a72_precaucion}
                            onChange={(e) => setFormConfig({ ...formConfig, a72_precaucion: e.target.value })}
                            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-mono focus:ring-2 focus:ring-slate-900"
                            required
                          />
                        </div>
                        <div>
                          <label className="text-[11px] font-medium text-slate-600 block mb-1">
                            Alerta (mm)
                          </label>
                          <input
                            type="number"
                            step="0.1"
                            value={formConfig.a72_alerta}
                            onChange={(e) => setFormConfig({ ...formConfig, a72_alerta: e.target.value })}
                            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-mono focus:ring-2 focus:ring-slate-900"
                            required
                          />
                        </div>
                        <div>
                          <label className="text-[11px] font-medium text-slate-600 block mb-1">
                            Emergencia (mm)
                          </label>
                          <input
                            type="number"
                            step="0.1"
                            value={formConfig.a72_emergencia}
                            onChange={(e) => setFormConfig({ ...formConfig, a72_emergencia: e.target.value })}
                            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-mono focus:ring-2 focus:ring-slate-900"
                            required
                          />
                        </div>
                      </div>
                    </div>

                    {/* Parámetros de Histéresis y Saturación */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 rounded-xl border border-slate-200 bg-slate-50/70">
                      <div>
                        <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                          T_max (minutos vigencia)
                        </label>
                        <input
                          type="number"
                          value={formConfig.t_max_minutos}
                          onChange={(e) => setFormConfig({ ...formConfig, t_max_minutos: e.target.value })}
                          className="w-full rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-mono"
                          required
                        />
                      </div>
                      <div>
                        <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                          Separación mínima (minutos)
                        </label>
                        <input
                          type="number"
                          value={formConfig.separacion_minima_minutos}
                          onChange={(e) => setFormConfig({ ...formConfig, separacion_minima_minutos: e.target.value })}
                          className="w-full rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-mono"
                          required
                        />
                      </div>
                      <div>
                        <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                          Muestras para descenso (histéresis)
                        </label>
                        <input
                          type="number"
                          value={formConfig.muestras_descenso}
                          onChange={(e) => setFormConfig({ ...formConfig, muestras_descenso: e.target.value })}
                          className="w-full rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-mono"
                          required
                        />
                      </div>
                    </div>

                    {/* Justificación y Activación */}
                    <div className="space-y-3">
                      <div>
                        <label className="text-xs font-semibold text-slate-700 block uppercase mb-1">
                          Motivo / Justificación Académica
                        </label>
                        <input
                          type="text"
                          value={formConfig.motivo}
                          onChange={(e) => setFormConfig({ ...formConfig, motivo: e.target.value })}
                          placeholder="Ej. Ajuste de umbrales para temporada de lluvias extraordinarias en cuenca Llojeta"
                          className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-xs bg-white"
                          required
                        />
                      </div>

                      <label className="flex items-center gap-2 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          id="check-activar"
                          checked={formConfig.activar}
                          onChange={(e) => setFormConfig({ ...formConfig, activar: e.target.checked })}
                          className="rounded border-slate-300 text-slate-900 focus:ring-slate-900 w-4 h-4"
                        />
                        <span className="text-xs font-medium text-slate-700">
                          Activar inmediatamente al guardar (archiva la versión vigente actual)
                        </span>
                      </label>
                    </div>

                    <button
                      type="submit"
                      disabled={cargando}
                      className="min-h-[44px] px-5 py-2.5 rounded-xl bg-[#0F172A] text-white text-xs font-semibold hover:bg-slate-800 disabled:opacity-50 transition-colors inline-flex items-center gap-2 shadow-sm cursor-pointer"
                    >
                      <span>💾</span>
                      <span>Guardar Nueva Versión</span>
                    </button>
                  </form>
                </section>

                {/* 1.C Historial de Versiones Inmutables */}
                <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm space-y-3">
                  <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Historial de Versiones Inmutables ({configuraciones.length})
                  </h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-slate-200 text-slate-500 font-semibold uppercase text-[10px]">
                          <th className="py-2.5 px-3">Versión</th>
                          <th className="py-2.5 px-3">Estado</th>
                          <th className="py-2.5 px-3">Motivo</th>
                          <th className="py-2.5 px-3">Autor</th>
                          <th className="py-2.5 px-3">Fecha</th>
                          <th className="py-2.5 px-3 text-right">Acción</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                        {configuraciones.map((cfg) => (
                          <tr key={cfg.id} className="hover:bg-slate-50">
                            <td className="py-2.5 px-3 font-bold text-slate-900">v{cfg.version}</td>
                            <td className="py-2.5 px-3">
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                                  cfg.estado === 'vigente'
                                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                    : cfg.estado === 'borrador'
                                    ? 'bg-amber-100 text-amber-800'
                                    : 'bg-slate-100 text-slate-600'
                                }`}
                              >
                                {cfg.estado}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 font-sans text-slate-700 max-w-xs truncate">
                              {cfg.motivo || 'Sin motivo'}
                            </td>
                            <td className="py-2.5 px-3 text-slate-500">{cfg.autor_nombre || 'Sistema'}</td>
                            <td className="py-2.5 px-3 text-slate-500">
                              {new Date(cfg.creada_en).toLocaleDateString()}
                            </td>
                            <td className="py-2.5 px-3 text-right">
                              {cfg.estado === 'borrador' && (
                                <button
                                  type="button"
                                  onClick={() => handleActivarVersion(cfg.id, cfg.version)}
                                  className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-semibold transition-colors cursor-pointer"
                                >
                                  Activar versión
                                </button>
                              )}
                              {cfg.estado === 'vigente' && (
                                <span className="text-[10px] text-emerald-700 font-bold font-sans">
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
                {/* Formulario de Alta de Recomendación */}
                <section className="rounded-2xl border border-slate-200/80 bg-white p-5 md:p-6 shadow-sm space-y-4">
                  <div className="border-b border-slate-100 pb-3">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                      Módulo 3: Comunicación Preventiva
                    </span>
                    <h2 className="text-base font-bold text-slate-900">
                      Publicar / Actualizar Recomendaciones Preventivas Generales
                    </h2>
                  </div>

                  <form onSubmit={handleGuardarRecomendacion} className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="text-xs font-semibold text-slate-700 block mb-1">
                          Nivel Informativo
                        </label>
                        <select
                          value={formRec.nivel}
                          onChange={(e) => setFormRec({ ...formRec, nivel: e.target.value })}
                          className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs bg-white"
                        >
                          <option value="NORMAL">NORMAL</option>
                          <option value="PRECAUCION">PRECAUCION</option>
                          <option value="ALERTA">ALERTA</option>
                          <option value="EMERGENCIA">EMERGENCIA</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-slate-700 block mb-1">
                          Estado Publicación
                        </label>
                        <select
                          value={formRec.estado_publicacion}
                          onChange={(e) => setFormRec({ ...formRec, estado_publicacion: e.target.value })}
                          className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs bg-white"
                        >
                          <option value="publicado">Publicado</option>
                          <option value="borrador">Borrador</option>
                          <option value="archivado">Archivado</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-slate-700 block mb-1">
                          Etiqueta de Origen
                        </label>
                        <select
                          value={formRec.origen}
                          onChange={(e) => setFormRec({ ...formRec, origen: e.target.value })}
                          className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs bg-white"
                        >
                          <option value="demostracion">demostracion</option>
                          <option value="institucional_verificada">institucional_verificada</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-slate-700 block mb-1">
                        Título Descriptivo
                      </label>
                      <input
                        type="text"
                        value={formRec.titulo}
                        onChange={(e) => setFormRec({ ...formRec, titulo: e.target.value })}
                        placeholder="Ej. Medidas preventivas generales para lluvia intensa"
                        className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-xs bg-white"
                        required
                      />
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-slate-700 block mb-1">
                        Contenido de la Recomendación
                      </label>
                      <textarea
                        rows={3}
                        value={formRec.contenido}
                        onChange={(e) => setFormRec({ ...formRec, contenido: e.target.value })}
                        placeholder="Recomendaciones preventivas generales en cuenca Llojeta..."
                        className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-xs bg-white"
                        required
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={cargando}
                      className="min-h-[44px] px-5 py-2 rounded-xl bg-[#0F172A] text-white text-xs font-semibold hover:bg-slate-800 disabled:opacity-50 transition-colors cursor-pointer"
                    >
                      Guardar Recomendación
                    </button>
                  </form>
                </section>

                {/* Listado con Filtros por Nivel */}
                <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                    <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                      Recomendaciones Registradas ({recomendacionesFiltradas.length})
                    </h3>
                    <div className="flex flex-wrap gap-1">
                      {['TODOS', 'NORMAL', 'PRECAUCION', 'ALERTA', 'EMERGENCIA'].map((n) => (
                        <button
                          key={n}
                          type="button"
                          onClick={() => setFiltroNivelRec(n)}
                          className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-colors cursor-pointer ${
                            filtroNivelRec === n
                              ? 'bg-slate-900 text-white'
                              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                          }`}
                        >
                          {n}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2.5">
                    {recomendacionesFiltradas.map((rec) => (
                      <div
                        key={rec.id}
                        className="p-4 rounded-xl border border-slate-200/80 bg-slate-50/70 flex flex-col justify-between gap-2 text-xs"
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-extrabold text-slate-900">{rec.nivel}</span>
                          <span className="font-mono text-[10px] text-slate-500">v{rec.version}</span>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                              rec.estado_publicacion === 'publicado'
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-slate-200 text-slate-700'
                            }`}
                          >
                            {rec.estado_publicacion}
                          </span>
                          <span className="text-[10px] text-amber-800 italic font-medium">
                            [{rec.origen}]
                          </span>
                        </div>
                        <p className="font-bold text-slate-800">{rec.titulo}</p>
                        <p className="text-slate-600 leading-relaxed">{rec.contenido}</p>
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
                <section className="rounded-2xl border border-slate-200/80 bg-white p-5 md:p-6 shadow-sm space-y-4">
                  <h2 className="text-base font-bold text-slate-900 border-b border-slate-100 pb-3">
                    Registrar Contacto de Auxilio Ciudadano
                  </h2>
                  <form onSubmit={handleGuardarContacto} className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="text-xs font-semibold text-slate-700 block mb-1">
                        Nombre / Institución
                      </label>
                      <input
                        type="text"
                        value={formContacto.nombre}
                        onChange={(e) => setFormContacto({ ...formContacto, nombre: e.target.value })}
                        placeholder="Ej. Red 114 — GAMLP"
                        className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs bg-white"
                        required
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-slate-700 block mb-1">
                        Teléfono / Línea
                      </label>
                      <input
                        type="text"
                        value={formContacto.telefono}
                        onChange={(e) => setFormContacto({ ...formContacto, telefono: e.target.value })}
                        placeholder="Ej. 114 / 800-140202"
                        className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs font-mono bg-white"
                        required
                      />
                    </div>
                    <div className="flex items-end">
                      <button
                        type="submit"
                        disabled={cargando}
                        className="w-full min-h-[44px] px-4 py-2 rounded-xl bg-[#0F172A] text-white text-xs font-semibold hover:bg-slate-800 transition-colors cursor-pointer"
                      >
                        Agregar Contacto
                      </button>
                    </div>
                  </form>
                </section>

                <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm space-y-4">
                  <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Contactos de Emergencia Activos ({contactos.length})
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    {contactos.map((c) => (
                      <div
                        key={c.id}
                        className="p-4 rounded-xl border border-slate-200/80 bg-slate-50/70 flex items-center justify-between text-xs"
                      >
                        <div className="space-y-0.5">
                          <p className="font-bold text-slate-900">{c.nombre}</p>
                          <p className="font-mono text-base font-extrabold text-slate-900">{c.telefono}</p>
                          <p className="text-[10px] text-slate-400">{c.fuente || 'Directorio municipal La Paz'}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleToggleContactoActivo(c)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
                            c.activo
                              ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200 border border-emerald-200'
                              : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
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
                <div className="rounded-2xl border border-blue-200 bg-blue-50/90 p-4 text-xs text-blue-900 space-y-1 shadow-2xs">
                  <p className="font-bold flex items-center gap-1.5">
                    <span>ℹ️</span> Regla de Gobernanza Espacial (Salvaguarda Cartográfica):
                  </p>
                  <p className="leading-relaxed text-blue-950">
                    Las geometrías GeoJSON y coordenadas se cargan mediante script y son inmutables desde la interfaz de usuario. Desde este panel solo se administran los atributos descriptivos, procedencia y estado de verificación.
                  </p>
                </div>

                {/* Zonas de Referencia */}
                <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm space-y-4">
                  <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Polígonos de Cuenca / Zonas de Referencia ({capas.zonas?.length || 0})
                  </h3>
                  <div className="space-y-3">
                    {capas.zonas?.map((z) => (
                      <div
                        key={z.id}
                        className="p-4 rounded-xl border border-slate-200/80 bg-slate-50/70 space-y-3 text-xs"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-slate-900 text-sm">{z.nombre}</span>
                          <span className="font-mono text-[10px] text-slate-500">ID: {z.id}</span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="text-[10px] font-semibold text-slate-500 uppercase block mb-1">
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
                              className="w-full rounded-xl border border-slate-300 px-3 py-1.5 text-xs bg-white"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] font-semibold text-slate-500 uppercase block mb-1">
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
                              className="w-full rounded-xl border border-slate-300 px-3 py-1.5 text-xs bg-white"
                            />
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleGuardarZona(z)}
                          className="px-3.5 py-1.5 rounded-xl bg-[#0F172A] text-white text-[11px] font-semibold hover:bg-slate-800 transition-colors cursor-pointer"
                        >
                          Guardar Atributos de Zona
                        </button>
                      </div>
                    ))}
                  </div>
                </section>

                {/* Puntos de Referencia */}
                <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm space-y-4">
                  <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Puntos de Referencia ({capas.puntos?.length || 0})
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    {capas.puntos?.map((p) => (
                      <div
                        key={p.id}
                        className="p-4 rounded-xl border border-slate-200/80 bg-slate-50/70 space-y-3 text-xs"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-slate-900">{p.nombre}</span>
                          <span className="font-mono text-[10px] text-slate-500">
                            [{p.latitud}, {p.longitud}]
                          </span>
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-semibold text-slate-500 uppercase block">
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
                            className="w-full rounded-xl border border-slate-300 px-3 py-1.5 text-xs bg-white"
                          >
                            <option value="sin_verificar">sin_verificar</option>
                            <option value="verificado_por_autoridad">verificado_por_autoridad</option>
                          </select>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleGuardarPunto(p)}
                          className="px-3 py-1 rounded-xl bg-[#0F172A] text-white text-[11px] font-semibold hover:bg-slate-800 transition-colors cursor-pointer"
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
                <section className="rounded-2xl border border-slate-200/80 bg-white p-5 md:p-6 shadow-sm space-y-5">
                  <div className="border-b border-slate-100 pb-3">
                    <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider block">
                      Aislamiento Estricto P11
                    </span>
                    <h2 className="text-base font-bold text-slate-900 mt-0.5">
                      Control de Simulación para Demostración Académica
                    </h2>
                    <p className="text-xs text-slate-500 leading-relaxed mt-0.5">
                      Las lecturas de modalidad simulada se almacenan en un entorno aislado y nunca alteran el estado real ni su contador de descenso.
                    </p>
                  </div>

                  {/* 4 Botones de Demostración Rápida */}
                  <div className="space-y-2">
                    <span className="text-xs font-bold text-slate-700 block uppercase">
                      Presets Rápidos para Defensa
                    </span>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                      <button
                        type="button"
                        onClick={() => inyectarPreset(1.0, 4.0, 10.0, 'NORMAL')}
                        className="p-3.5 rounded-xl border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-emerald-950 font-bold text-xs transition-colors flex flex-col items-center gap-1 cursor-pointer"
                      >
                        <span className="text-lg">🟢</span>
                        <span>Demostrar NORMAL</span>
                        <span className="font-mono text-[10px] font-normal text-emerald-800">1 mm/h · 4 mm</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => inyectarPreset(3.0, 15.0, 30.0, 'PRECAUCIÓN')}
                        className="p-3.5 rounded-xl border border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-950 font-bold text-xs transition-colors flex flex-col items-center gap-1 cursor-pointer"
                      >
                        <span className="text-lg">🟡</span>
                        <span>Demostrar PRECAUCIÓN</span>
                        <span className="font-mono text-[10px] font-normal text-amber-800">3 mm/h · 15 mm</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => inyectarPreset(8.0, 30.0, 65.0, 'ALERTA')}
                        className="p-3.5 rounded-xl border border-orange-300 bg-orange-50 hover:bg-orange-100 text-orange-950 font-bold text-xs transition-colors flex flex-col items-center gap-1 cursor-pointer"
                      >
                        <span className="text-lg">🟠</span>
                        <span>Demostrar ALERTA</span>
                        <span className="font-mono text-[10px] font-normal text-orange-800">8 mm/h · 30 mm</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => inyectarPreset(15.0, 50.0, 100.0, 'EMERGENCIA')}
                        className="p-3.5 rounded-xl border border-red-300 bg-red-50 hover:bg-red-100 text-red-950 font-bold text-xs transition-colors flex flex-col items-center gap-1 cursor-pointer"
                      >
                        <span className="text-lg">🔴</span>
                        <span>Demostrar EMERGENCIA</span>
                        <span className="font-mono text-[10px] font-normal text-red-800">15 mm/h · 50 mm</span>
                      </button>
                    </div>
                  </div>

                  {/* Formulario de Inyección Personalizada */}
                  <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 space-y-3">
                    <span className="text-xs font-bold text-slate-800 block uppercase">
                      Inyección Manual de Métricas Pluviométricas
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="text-[11px] text-slate-600 block mb-1">
                          Intensidad Horaria (mm/h)
                        </label>
                        <input
                          type="number"
                          step="0.1"
                          value={simManual.intensidad}
                          onChange={(e) => setSimManual({ ...simManual, intensidad: e.target.value })}
                          className="w-full rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-mono"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] text-slate-600 block mb-1">
                          Acumulado 24h (mm)
                        </label>
                        <input
                          type="number"
                          step="0.1"
                          value={simManual.acum_24h}
                          onChange={(e) => setSimManual({ ...simManual, acum_24h: e.target.value })}
                          className="w-full rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-mono"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] text-slate-600 block mb-1">
                          Acumulado 72h (mm)
                        </label>
                        <input
                          type="number"
                          step="0.1"
                          value={simManual.acum_72h}
                          onChange={(e) => setSimManual({ ...simManual, acum_72h: e.target.value })}
                          className="w-full rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-mono"
                        />
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2.5 pt-1">
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
                        className="min-h-[40px] px-4 py-2 rounded-xl bg-[#0F172A] text-white text-xs font-semibold hover:bg-slate-800 transition-colors cursor-pointer"
                      >
                        Inyectar Lectura Manual
                      </button>
                      <button
                        type="button"
                        onClick={handleLimpiarSimulacion}
                        className="min-h-[40px] px-4 py-2 rounded-xl bg-red-100 text-red-900 hover:bg-red-200 text-xs font-semibold transition-colors cursor-pointer"
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
              <section className="rounded-2xl border border-slate-200/80 bg-white p-5 md:p-6 shadow-sm space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                  <div>
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                      Auditoría Inmutable
                    </span>
                    <h2 className="text-base font-bold text-slate-900">
                      Bitácora Cronológica de Cambios ({bitacoraFiltrada.length} registros)
                    </h2>
                  </div>

                  {/* Filtro por Entidad */}
                  <div className="flex items-center gap-2">
                    <label className="text-[11px] text-slate-500 font-medium">Filtrar entidad:</label>
                    <select
                      value={filtroBitacora}
                      onChange={(e) => setFiltroBitacora(e.target.value)}
                      className="rounded-xl border border-slate-300 px-2.5 py-1 text-xs bg-white text-slate-700"
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

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 text-slate-500 font-semibold uppercase text-[10px]">
                        <th className="py-2.5 px-3">Fecha / Hora</th>
                        <th className="py-2.5 px-3">Usuario</th>
                        <th className="py-2.5 px-3">Entidad</th>
                        <th className="py-2.5 px-3">Acción</th>
                        <th className="py-2.5 px-3">Resumen de Cambio</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                      {bitacoraFiltrada.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="py-4 text-center text-slate-400 font-sans italic">
                            No se encontraron registros de auditoría para el filtro seleccionado.
                          </td>
                        </tr>
                      ) : (
                        bitacoraFiltrada.map((b) => (
                          <tr key={b.id} className="hover:bg-slate-50">
                            <td className="py-2.5 px-3 text-slate-500 whitespace-nowrap">
                              {new Date(b.ocurrido_en).toLocaleString()}
                            </td>
                            <td className="py-2.5 px-3 font-sans font-medium text-slate-800 whitespace-nowrap">
                              {b.usuario_nombre || 'Sistema'}
                            </td>
                            <td className="py-2.5 px-3 text-slate-600 font-bold">{b.entidad}</td>
                            <td className="py-2.5 px-3">
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                                  b.accion === 'crear'
                                    ? 'bg-blue-100 text-blue-800'
                                    : b.accion === 'activar'
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : b.accion === 'modificar'
                                    ? 'bg-amber-100 text-amber-800'
                                    : 'bg-slate-200 text-slate-700'
                                }`}
                              >
                                {b.accion}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 font-sans text-slate-600 max-w-sm truncate">
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
