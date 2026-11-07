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
  actualizarRecomendacionAdmin,
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
  { id: 'umbrales', label: '1. Umbrales y Reglas (P05/P16)', icono: '⚙️' },
  { id: 'recomendaciones', label: '2. Textos Preventivos', icono: '📝' },
  { id: 'contactos', label: '3. Contactos de Emergencia', icono: '📞' },
  { id: 'capas', label: '4. Capas y Referencias', icono: '🗺️' },
  { id: 'simulacion', label: '5. Modo Demostración', icono: '🧪' },
  { id: 'bitacora', label: '6. Bitácora de Cambios', icono: '📜' },
];

export default function PanelAdministracion({ alCerrarSesion }) {
  const [seccionActiva, setSeccionActiva] = useState('umbrales');
  const [usuario, setUsuario] = useState(obtenerUsuarioAdmin());
  const [mensajeExito, setMensajeExito] = useState(null);
  const [errorGlobal, setErrorGlobal] = useState(null);

  // Estados de datos por sección
  const [configuraciones, setConfiguraciones] = useState([]);
  const [recomendaciones, setRecomendaciones] = useState([]);
  const [contactos, setContactos] = useState([]);
  const [capas, setCapas] = useState({ zonas: [], puntos: [] });
  const [bitacora, setBitacora] = useState([]);
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

  // Carga de datos según la pestaña activa
  useEffect(() => {
    cargarDatosSeccion(seccionActiva);
  }, [seccionActiva]);

  const cargarDatosSeccion = async (seccion) => {
    try {
      setCargando(true);
      setErrorGlobal(null);
      if (seccion === 'umbrales') {
        const datos = await obtenerConfiguracionesAdmin();
        setConfiguraciones(datos);
      } else if (seccion === 'recomendaciones') {
        const datos = await obtenerRecomendacionesAdmin();
        setRecomendaciones(datos);
      } else if (seccion === 'contactos') {
        const datos = await obtenerContactosAdmin();
        setContactos(datos);
      } else if (seccion === 'capas') {
        const datos = await obtenerCapasAdmin();
        setCapas(datos);
      } else if (seccion === 'bitacora') {
        const datos = await obtenerBitacoraAdmin({ limite: 50 });
        setBitacora(datos);
      }
    } catch (err) {
      setErrorGlobal(err.message || 'Error cargando datos de la sección');
    } finally {
      setCargando(false);
    }
  };

  // -------------------------------------------------------------------------
  // Handlers: Configuraciones y Umbrales
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

  return (
    <div className="min-h-screen bg-slate-100 text-slate-800 p-3 sm:p-4 md:p-6 flex flex-col items-center">
      <main className="w-full max-w-5xl mx-auto space-y-4">
        {/* Cabecera del Panel */}
        <header className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-xs space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <span className="text-xl" aria-hidden="true">
                🛡️
              </span>
              <div>
                <h1 className="text-lg sm:text-xl font-bold tracking-tight text-slate-900 leading-tight">
                  Panel de Administración PUKARA
                </h1>
                <p className="text-xs text-slate-500 font-mono">
                  {usuario?.nombre || 'Administrador'} · {usuario?.email || 'admin@pukara.bo'} ({usuario?.rol || 'administrador'})
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Link
                to="/"
                className="min-h-[40px] px-3.5 py-1.5 rounded-xl border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors inline-flex items-center gap-1.5"
              >
                <span>🌐</span>
                <span>Consulta Pública</span>
              </Link>
              <button
                type="button"
                onClick={handleCerrarSesion}
                className="min-h-[40px] px-3.5 py-1.5 rounded-xl bg-red-50 text-red-700 hover:bg-red-100 border border-red-200 text-xs font-semibold transition-colors inline-flex items-center gap-1.5"
              >
                <span>🚪</span>
                <span>Cerrar sesión</span>
              </button>
            </div>
          </div>

          {/* Selector de pestañas */}
          <nav
            aria-label="Secciones del panel de administración"
            className="flex flex-wrap gap-1.5 pt-1"
          >
            {SECCIONES.map((sec) => (
              <button
                key={sec.id}
                type="button"
                onClick={() => setSeccionActiva(sec.id)}
                className={`min-h-[40px] px-3 py-2 rounded-xl text-xs font-semibold transition-all inline-flex items-center gap-1.5 ${
                  seccionActiva === sec.id
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'bg-slate-50 text-slate-600 hover:bg-slate-200/80 hover:text-slate-900'
                }`}
              >
                <span>{sec.icono}</span>
                <span>{sec.label}</span>
              </button>
            ))}
          </nav>
        </header>

        {/* Notificaciones globales */}
        {mensajeExito && (
          <div
            role="status"
            className="rounded-xl border border-emerald-300 bg-emerald-50 p-3.5 text-xs text-emerald-950 font-medium flex items-center gap-2 shadow-xs"
          >
            <span aria-hidden="true">✅</span>
            <span>{mensajeExito}</span>
          </div>
        )}

        {errorGlobal && (
          <div
            role="alert"
            className="rounded-xl border border-red-300 bg-red-50 p-3.5 text-xs text-red-950 font-medium flex items-center gap-2 shadow-xs"
          >
            <span aria-hidden="true">⚠️</span>
            <span>{errorGlobal}</span>
          </div>
        )}

        {/* ================================================================= */}
        {/* SECCIÓN 1: UMBRALES Y REGLAS (P05/P16) */}
        {/* ================================================================= */}
        {seccionActiva === 'umbrales' && (
          <div className="space-y-4">
            {/* Formulario de nueva versión */}
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
              <div className="border-b border-slate-100 pb-2">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                  Reglas P05 y P16
                </span>
                <h2 className="text-base font-bold text-slate-900">
                  Crear Nueva Versión Inmutable de Configuración
                </h2>
                <p className="text-xs text-slate-500">
                  Las configuraciones son inmutables. Modificar valores crea una nueva versión en bitácora y reinicia el contador de descenso de histéresis.
                </p>
              </div>

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

              <form onSubmit={handleGuardarConfig} className="space-y-4">
                {/* Grilla de los 9 Umbrales */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {/* Intensidad Horaria */}
                  <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/70 space-y-2.5">
                    <span className="text-xs font-bold text-slate-700 block uppercase">
                      Intensidad (mm/h)
                    </span>
                    <div>
                      <label className="text-[11px] text-slate-500 block">Precaución</label>
                      <input
                        type="number"
                        step="0.1"
                        value={formConfig.int_precaucion}
                        onChange={(e) => setFormConfig({ ...formConfig, int_precaucion: e.target.value })}
                        className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-mono"
                        required
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-slate-500 block">Alerta</label>
                      <input
                        type="number"
                        step="0.1"
                        value={formConfig.int_alerta}
                        onChange={(e) => setFormConfig({ ...formConfig, int_alerta: e.target.value })}
                        className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-mono"
                        required
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-slate-500 block">Emergencia</label>
                      <input
                        type="number"
                        step="0.1"
                        value={formConfig.int_emergencia}
                        onChange={(e) => setFormConfig({ ...formConfig, int_emergencia: e.target.value })}
                        className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-mono"
                        required
                      />
                    </div>
                  </div>

                  {/* Acumulado 24h */}
                  <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/70 space-y-2.5">
                    <span className="text-xs font-bold text-slate-700 block uppercase">
                      Acumulado 24 horas (mm)
                    </span>
                    <div>
                      <label className="text-[11px] text-slate-500 block">Precaución</label>
                      <input
                        type="number"
                        step="0.1"
                        value={formConfig.a24_precaucion}
                        onChange={(e) => setFormConfig({ ...formConfig, a24_precaucion: e.target.value })}
                        className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-mono"
                        required
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-slate-500 block">Alerta</label>
                      <input
                        type="number"
                        step="0.1"
                        value={formConfig.a24_alerta}
                        onChange={(e) => setFormConfig({ ...formConfig, a24_alerta: e.target.value })}
                        className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-mono"
                        required
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-slate-500 block">Emergencia</label>
                      <input
                        type="number"
                        step="0.1"
                        value={formConfig.a24_emergencia}
                        onChange={(e) => setFormConfig({ ...formConfig, a24_emergencia: e.target.value })}
                        className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-mono"
                        required
                      />
                    </div>
                  </div>

                  {/* Acumulado 72h */}
                  <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/70 space-y-2.5">
                    <span className="text-xs font-bold text-slate-700 block uppercase">
                      Acumulado 72 horas (mm)
                    </span>
                    <div>
                      <label className="text-[11px] text-slate-500 block">Precaución</label>
                      <input
                        type="number"
                        step="0.1"
                        value={formConfig.a72_precaucion}
                        onChange={(e) => setFormConfig({ ...formConfig, a72_precaucion: e.target.value })}
                        className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-mono"
                        required
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-slate-500 block">Alerta</label>
                      <input
                        type="number"
                        step="0.1"
                        value={formConfig.a72_alerta}
                        onChange={(e) => setFormConfig({ ...formConfig, a72_alerta: e.target.value })}
                        className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-mono"
                        required
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-slate-500 block">Emergencia</label>
                      <input
                        type="number"
                        step="0.1"
                        value={formConfig.a72_emergencia}
                        onChange={(e) => setFormConfig({ ...formConfig, a72_emergencia: e.target.value })}
                        className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-mono"
                        required
                      />
                    </div>
                  </div>
                </div>

                {/* Parámetros Temporales y Saturación */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3.5 rounded-xl border border-slate-200 bg-slate-50/70">
                  <div>
                    <label className="text-[11px] font-semibold text-slate-700 block">T_max (minutos vigencia)</label>
                    <input
                      type="number"
                      value={formConfig.t_max_minutos}
                      onChange={(e) => setFormConfig({ ...formConfig, t_max_minutos: e.target.value })}
                      className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-mono"
                      required
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-slate-700 block">Separación mínima (min)</label>
                    <input
                      type="number"
                      value={formConfig.separacion_minima_minutos}
                      onChange={(e) => setFormConfig({ ...formConfig, separacion_minima_minutos: e.target.value })}
                      className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-mono"
                      required
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-slate-700 block">Muestras para descenso</label>
                    <input
                      type="number"
                      value={formConfig.muestras_descenso}
                      onChange={(e) => setFormConfig({ ...formConfig, muestras_descenso: e.target.value })}
                      className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-mono"
                      required
                    />
                  </div>
                </div>

                {/* Motivo y Checkbox de activación */}
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-slate-700 block uppercase">Motivo / Justificación Académica</label>
                  <input
                    type="text"
                    value={formConfig.motivo}
                    onChange={(e) => setFormConfig({ ...formConfig, motivo: e.target.value })}
                    placeholder="Ej. Ajuste de umbral de intensidad para temporada de tormentas en cuenca Llojeta"
                    className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-xs"
                    required
                  />
                  <div className="flex items-center gap-2 pt-1">
                    <input
                      type="checkbox"
                      id="check-activar"
                      checked={formConfig.activar}
                      onChange={(e) => setFormConfig({ ...formConfig, activar: e.target.checked })}
                      className="rounded border-slate-300 text-slate-900 focus:ring-slate-900"
                    />
                    <label htmlFor="check-activar" className="text-xs font-medium text-slate-700">
                      Activar inmediatamente al guardar (archiva la versión vigente actual)
                    </label>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={cargando}
                  className="min-h-[44px] px-5 py-2.5 rounded-xl bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 disabled:opacity-50 transition-colors inline-flex items-center gap-2"
                >
                  <span>💾</span>
                  <span>Guardar Nueva Versión</span>
                </button>
              </form>
            </section>

            {/* Historial de versiones */}
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-3">
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
                        <td className="py-2.5 px-3 font-sans text-slate-700 max-w-xs truncate">{cfg.motivo || 'Sin motivo'}</td>
                        <td className="py-2.5 px-3 text-slate-500">{cfg.autor_nombre || 'Sistema'}</td>
                        <td className="py-2.5 px-3 text-slate-500">{new Date(cfg.creada_en).toLocaleDateString()}</td>
                        <td className="py-2.5 px-3 text-right">
                          {cfg.estado === 'borrador' && (
                            <button
                              type="button"
                              onClick={() => handleActivarVersion(cfg.id, cfg.version)}
                              className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-semibold transition-colors"
                            >
                              Activar
                            </button>
                          )}
                          {cfg.estado === 'vigente' && (
                            <span className="text-[10px] text-emerald-700 font-bold font-sans">✓ En uso</span>
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

        {/* ================================================================= */}
        {/* SECCIÓN 2: TEXTOS PREVENTIVOS */}
        {/* ================================================================= */}
        {seccionActiva === 'recomendaciones' && (
          <div className="space-y-4">
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
              <h2 className="text-base font-bold text-slate-900 border-b border-slate-100 pb-2">
                Publicar / Actualizar Recomendaciones Preventivas Generales
              </h2>

              <form onSubmit={handleGuardarRecomendacion} className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-slate-700 block">Nivel Informativo</label>
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
                    <label className="text-xs font-semibold text-slate-700 block">Estado Publicación</label>
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
                    <label className="text-xs font-semibold text-slate-700 block">Origen</label>
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
                  <label className="text-xs font-semibold text-slate-700 block">Título Descriptivo</label>
                  <input
                    type="text"
                    value={formRec.titulo}
                    onChange={(e) => setFormRec({ ...formRec, titulo: e.target.value })}
                    placeholder="Ej. Medidas preventivas generales para lluvia intensa"
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs"
                    required
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700 block">Contenido de la Recomendación</label>
                  <textarea
                    rows={3}
                    value={formRec.contenido}
                    onChange={(e) => setFormRec({ ...formRec, contenido: e.target.value })}
                    placeholder="Recomendaciones preventivas generales en cuenca..."
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs"
                    required
                  />
                </div>

                <button
                  type="submit"
                  disabled={cargando}
                  className="min-h-[44px] px-5 py-2 rounded-xl bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 disabled:opacity-50 transition-colors"
                >
                  Guardar Recomendación
                </button>
              </form>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-3">
              <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Listado de Recomendaciones ({recomendaciones.length})
              </h3>
              <div className="space-y-2">
                {recomendaciones.map((rec) => (
                  <div key={rec.id} className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 flex flex-col sm:flex-row justify-between gap-3 text-xs">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900">{rec.nivel}</span>
                        <span className="font-mono text-[10px] text-slate-500">v{rec.version}</span>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${rec.estado_publicacion === 'publicado' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-700'}`}>
                          {rec.estado_publicacion}
                        </span>
                        <span className="text-[10px] text-amber-800 italic">[{rec.origen}]</span>
                      </div>
                      <p className="font-semibold text-slate-800">{rec.titulo}</p>
                      <p className="text-slate-600 leading-relaxed">{rec.contenido}</p>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>
        )}

        {/* ================================================================= */}
        {/* SECCIÓN 3: CONTACTOS DE EMERGENCIA */}
        {/* ================================================================= */}
        {seccionActiva === 'contactos' && (
          <div className="space-y-4">
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
              <h2 className="text-base font-bold text-slate-900 border-b border-slate-100 pb-2">
                Registrar Contacto de Emergencia
              </h2>
              <form onSubmit={handleGuardarContacto} className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700 block">Nombre / Institución</label>
                  <input
                    type="text"
                    value={formContacto.nombre}
                    onChange={(e) => setFormContacto({ ...formContacto, nombre: e.target.value })}
                    placeholder="Ej. Red de Emergencias 114"
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs"
                    required
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 block">Teléfono / Línea</label>
                  <input
                    type="text"
                    value={formContacto.telefono}
                    onChange={(e) => setFormContacto({ ...formContacto, telefono: e.target.value })}
                    placeholder="Ej. 114 / 800-140202"
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs font-mono"
                    required
                  />
                </div>
                <div className="flex items-end">
                  <button
                    type="submit"
                    disabled={cargando}
                    className="w-full min-h-[44px] px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 transition-colors"
                  >
                    Agregar Contacto
                  </button>
                </div>
              </form>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-3">
              <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Contactos Disponibles ({contactos.length})
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {contactos.map((c) => (
                  <div key={c.id} className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-between text-xs">
                    <div>
                      <p className="font-bold text-slate-900">{c.nombre}</p>
                      <p className="font-mono text-sm text-slate-700 font-bold">{c.telefono}</p>
                      <p className="text-[10px] text-slate-400">{c.fuente || 'Directorio municipal'}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleToggleContactoActivo(c)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                        c.activo ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200' : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
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

        {/* ================================================================= */}
        {/* SECCIÓN 4: CAPAS Y REFERENCIAS CARTOGRÁFICAS */}
        {/* ================================================================= */}
        {seccionActiva === 'capas' && (
          <div className="space-y-4">
            <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-xs text-blue-900 space-y-1">
              <p className="font-bold flex items-center gap-1.5">
                <span>ℹ️</span> Regla de Gobernanza Espacial:
              </p>
              <p className="leading-relaxed">
                Las geometrías y coordenadas se cargan mediante script. Desde este panel solo se administran los atributos descriptivos, procedencia y estado de verificación.
              </p>
            </div>

            {/* Zonas de Referencia */}
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-3">
              <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Polígonos de Cuenca / Zonas de Referencia ({capas.zonas?.length || 0})
              </h3>
              <div className="space-y-3">
                {capas.zonas?.map((z) => (
                  <div key={z.id} className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-900 text-sm">{z.nombre}</span>
                      <span className="font-mono text-[10px] text-slate-500">ID: {z.id}</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] text-slate-500 uppercase block">Fuente</label>
                        <input
                          type="text"
                          value={z.fuente || ''}
                          onChange={(e) => {
                            const actualizadas = capas.zonas.map((item) => item.id === z.id ? { ...item, fuente: e.target.value } : item);
                            setCapas({ ...capas, zonas: actualizadas });
                          }}
                          className="w-full rounded border border-slate-300 px-2 py-1 text-xs bg-white"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-slate-500 uppercase block">Advertencia de Demostración</label>
                        <input
                          type="text"
                          value={z.advertencia || ''}
                          onChange={(e) => {
                            const actualizadas = capas.zonas.map((item) => item.id === z.id ? { ...item, advertencia: e.target.value } : item);
                            setCapas({ ...capas, zonas: actualizadas });
                          }}
                          className="w-full rounded border border-slate-300 px-2 py-1 text-xs bg-white"
                        />
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleGuardarZona(z)}
                      className="px-3 py-1.5 rounded-lg bg-slate-900 text-white text-[11px] font-semibold hover:bg-slate-800 transition-colors"
                    >
                      Guardar Atributos de Zona
                    </button>
                  </div>
                ))}
              </div>
            </section>

            {/* Puntos de Referencia */}
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-3">
              <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Puntos de Orientación Urbana ({capas.puntos?.length || 0})
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {capas.puntos?.map((p) => (
                  <div key={p.id} className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-900">{p.nombre}</span>
                      <span className="font-mono text-[10px] text-slate-500">[{p.latitud}, {p.longitud}]</span>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] text-slate-500 uppercase block">Estado Verificación</label>
                      <select
                        value={p.estado_verificacion}
                        onChange={(e) => {
                          const actualizados = capas.puntos.map((item) => item.id === p.id ? { ...item, estado_verificacion: e.target.value } : item);
                          setCapas({ ...capas, puntos: actualizados });
                        }}
                        className="w-full rounded border border-slate-300 px-2 py-1 text-xs bg-white"
                      >
                        <option value="sin_verificar">sin_verificar</option>
                        <option value="verificado_por_autoridad">verificado_por_autoridad</option>
                      </select>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleGuardarPunto(p)}
                      className="px-3 py-1 rounded-lg bg-slate-900 text-white text-[11px] font-semibold hover:bg-slate-800 transition-colors"
                    >
                      Guardar Punto
                    </button>
                  </div>
                ))}
              </div>
            </section>
          </div>
        )}

        {/* ================================================================= */}
        {/* SECCIÓN 5: MODO DEMOSTRACIÓN / SIMULACIÓN */}
        {/* ================================================================= */}
        {seccionActiva === 'simulacion' && (
          <div className="space-y-4">
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
              <div className="border-b border-slate-100 pb-2">
                <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider">
                  Aislamiento Estricto P11
                </span>
                <h2 className="text-base font-bold text-slate-900">
                  Control de Simulación para Demostración Académica
                </h2>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Las lecturas de modalidad simulada se almacenan aparte y nunca alteran el estado real ni su contador de descenso.
                </p>
              </div>

              {/* Botones de Preseteo Rápido */}
              <div className="space-y-2">
                <span className="text-xs font-bold text-slate-700 block uppercase">
                  Presets Rápidos para Defensa
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <button
                    type="button"
                    onClick={() => inyectarPreset(1.0, 4.0, 10.0, 'NORMAL')}
                    className="p-3 rounded-xl border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-emerald-950 font-bold text-xs transition-colors flex flex-col items-center gap-1"
                  >
                    <span>🟢</span>
                    <span>Nivel NORMAL</span>
                    <span className="font-mono text-[10px] font-normal text-emerald-800">1 mm/h · 4 mm</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => inyectarPreset(3.0, 15.0, 30.0, 'PRECAUCIÓN')}
                    className="p-3 rounded-xl border border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-950 font-bold text-xs transition-colors flex flex-col items-center gap-1"
                  >
                    <span>🟡</span>
                    <span>Nivel PRECAUCIÓN</span>
                    <span className="font-mono text-[10px] font-normal text-amber-800">3 mm/h · 15 mm</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => inyectarPreset(8.0, 30.0, 65.0, 'ALERTA')}
                    className="p-3 rounded-xl border border-orange-300 bg-orange-50 hover:bg-orange-100 text-orange-950 font-bold text-xs transition-colors flex flex-col items-center gap-1"
                  >
                    <span>🟠</span>
                    <span>Nivel ALERTA</span>
                    <span className="font-mono text-[10px] font-normal text-orange-800">8 mm/h · 30 mm</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => inyectarPreset(15.0, 50.0, 100.0, 'EMERGENCIA')}
                    className="p-3 rounded-xl border border-red-300 bg-red-50 hover:bg-red-100 text-red-950 font-bold text-xs transition-colors flex flex-col items-center gap-1"
                  >
                    <span>🔴</span>
                    <span>Nivel EMERGENCIA</span>
                    <span className="font-mono text-[10px] font-normal text-red-800">15 mm/h · 50 mm</span>
                  </button>
                </div>
              </div>

              {/* Inyección Manual */}
              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-3">
                <span className="text-xs font-bold text-slate-700 block uppercase">
                  Inyección Manual de Métricas Pluviométricas
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="text-[11px] text-slate-500 block">Intensidad Horaria (mm/h)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={simManual.intensidad}
                      onChange={(e) => setSimManual({ ...simManual, intensidad: e.target.value })}
                      className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-500 block">Acumulado 24h (mm)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={simManual.acum_24h}
                      onChange={(e) => setSimManual({ ...simManual, acum_24h: e.target.value })}
                      className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-500 block">Acumulado 72h (mm)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={simManual.acum_72h}
                      onChange={(e) => setSimManual({ ...simManual, acum_72h: e.target.value })}
                      className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-mono"
                    />
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => inyectarPreset(Number(simManual.intensidad), Number(simManual.acum_24h), Number(simManual.acum_72h), 'Manual')}
                    className="min-h-[40px] px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 transition-colors"
                  >
                    Inyectar Lectura Manual
                  </button>
                  <button
                    type="button"
                    onClick={handleLimpiarSimulacion}
                    className="min-h-[40px] px-4 py-2 rounded-xl bg-red-100 text-red-900 hover:bg-red-200 text-xs font-semibold transition-colors"
                  >
                    🧹 Limpiar Datos de Simulación
                  </button>
                </div>
              </div>
            </section>
          </div>
        )}

        {/* ================================================================= */}
        {/* SECCIÓN 6: BITÁCORA DE CAMBIOS */}
        {/* ================================================================= */}
        {seccionActiva === 'bitacora' && (
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
            <div className="border-b border-slate-100 pb-2">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                Auditoría Inmutable
              </span>
              <h2 className="text-base font-bold text-slate-900">
                Bitácora Cronológica de Cambios ({bitacora.length} registros)
              </h2>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500 font-semibold uppercase text-[10px]">
                    <th className="py-2 px-2.5">Fecha / Hora</th>
                    <th className="py-2 px-2.5">Usuario</th>
                    <th className="py-2 px-2.5">Entidad</th>
                    <th className="py-2 px-2.5">Acción</th>
                    <th className="py-2 px-2.5">Resumen de Cambio</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                  {bitacora.map((b) => (
                    <tr key={b.id} className="hover:bg-slate-50">
                      <td className="py-2 px-2.5 text-slate-500 whitespace-nowrap">
                        {new Date(b.ocurrido_en).toLocaleString()}
                      </td>
                      <td className="py-2 px-2.5 font-sans font-medium text-slate-800 whitespace-nowrap">
                        {b.usuario_nombre || 'Sistema'}
                      </td>
                      <td className="py-2 px-2.5 text-slate-600 font-bold">{b.entidad}</td>
                      <td className="py-2 px-2.5">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          b.accion === 'crear' ? 'bg-blue-100 text-blue-800' :
                          b.accion === 'activar' ? 'bg-emerald-100 text-emerald-800' :
                          b.accion === 'modificar' ? 'bg-amber-100 text-amber-800' : 'bg-slate-200 text-slate-700'
                        }`}>
                          {b.accion}
                        </span>
                      </td>
                      <td className="py-2 px-2.5 font-sans text-slate-600 max-w-sm truncate">
                        {b.valor_nuevo ? JSON.stringify(b.valor_nuevo).substring(0, 80) + '...' : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        <AvisoPermanente />
      </main>
    </div>
  );
}

