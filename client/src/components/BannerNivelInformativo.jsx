import React from 'react';
import {
  formatearFechaHoraLaPaz,
  formatearAntiguedad,
} from '../utils/formatoTiempo';

/**
 * Paleta Pastel Clay destacada para el Hero Banner según el nivel informativo vigente.
 */
const ESTILOS_NIVEL = {
  NORMAL: {
    heroSurface:
      'bg-gradient-to-br from-[#D1FAE5]/85 via-[#ECFDF5] to-[#FFFFFF] border-2 border-[#6EE7B7] shadow-[0_22px_48px_-14px_rgba(5,150,105,0.20)]',
    pill: 'bg-white/90 text-[#065F46] border border-[#6EE7B7]',
    dot: 'bg-[#059669]',
    icono: '🟢',
    titulo: 'Nivel informativo de lluvia: NORMAL',
    titularHumano: 'Todo tranquilo hoy en Llojeta.',
    descripcionHumana:
      'Las precipitaciones acumuladas se mantienen en condiciones habituales y estables en el sector Llojeta / Bajo Llojeta.',
  },
  PRECAUCION: {
    heroSurface:
      'bg-gradient-to-br from-[#FDE68A]/70 via-[#FEF3C7]/85 to-[#FFFFFF] border-2 border-[#FBBF24] shadow-[0_22px_48px_-14px_rgba(217,119,6,0.22)]',
    pill: 'bg-white/90 text-[#92400E] border border-[#FBBF24]',
    dot: 'bg-[#B45309]',
    icono: '🟡',
    titulo: 'Nivel informativo de lluvia: PRECAUCIÓN',
    titularHumano: 'Lluvia moderada hoy en Llojeta.',
    descripcionHumana:
      'Se registra precipitación moderada en la zona. Revise las medidas preventivas generales para proteger su vivienda.',
  },
  ALERTA: {
    heroSurface:
      'bg-gradient-to-br from-[#FED7AA]/75 via-[#FFEDD5]/85 to-[#FFFFFF] border-2 border-[#FB923C] shadow-[0_22px_48px_-14px_rgba(234,88,12,0.22)]',
    pill: 'bg-white/90 text-[#9A3412] border border-[#FB923C]',
    dot: 'bg-[#C2410C]',
    icono: '🟠',
    titulo: 'Nivel informativo de lluvia: ALERTA',
    titularHumano: 'Lluvia intensa hoy en Llojeta.',
    descripcionHumana:
      'Lluvia fuerte o humedad acumulada en los últimos días. Mantenga distancia de quebradas y consulte las recomendaciones preventivas.',
  },
  EMERGENCIA: {
    heroSurface:
      'bg-gradient-to-br from-[#FECACA]/80 via-[#FEE2E2]/85 to-[#FFFFFF] border-2 border-[#F87171] shadow-[0_22px_48px_-14px_rgba(220,38,38,0.24)]',
    pill: 'bg-white/90 text-[#991B1B] border border-[#F87171]',
    dot: 'bg-[#DC2626]',
    icono: '🔴',
    titulo: 'Nivel informativo de lluvia: EMERGENCIA',
    titularHumano: 'Lluvia extraordinaria en Llojeta.',
    descripcionHumana:
      'Precipitación crítica registrada según los umbrales académicos. Atienda las indicaciones de las autoridades y tenga a mano los teléfonos de auxilio.',
  },
};

const ESCALA_4_FASES = [
  {
    clave: 'NORMAL',
    etiqueta: 'Verde - Nivel Normal',
    resumen: 'Condiciones habituales en Llojeta',
    dot: 'bg-[#059669]',
    filaActiva: 'bg-[#ECFDF5] border-[#6EE7B7] text-[#065F46]',
  },
  {
    clave: 'PRECAUCION',
    etiqueta: 'Amarillo - Nivel Precaución',
    resumen: 'Lluvia moderada, limpiar canaletas',
    dot: 'bg-[#D97706]',
    filaActiva: 'bg-[#FEF3C7] border-[#FBBF24] text-[#92400E]',
  },
  {
    clave: 'ALERTA',
    etiqueta: 'Naranja - Nivel Alerta',
    resumen: 'Lluvia fuerte o suelo saturado',
    dot: 'bg-[#EA580C]',
    filaActiva: 'bg-[#FFEDD5] border-[#FB923C] text-[#9A3412]',
  },
  {
    clave: 'EMERGENCIA',
    etiqueta: 'Rojo - Nivel Emergencia',
    resumen: 'Lluvia crítica, contactar al 114 / 119',
    dot: 'bg-[#DC2626]',
    filaActiva: 'bg-[#FEE2E2] border-[#F87171] text-[#991B1B]',
  },
];

/**
 * Componente BannerNivelInformativo
 * Gran tarjeta Hero destacada por el color pastel del nivel vigente,
 * con botón compacto de actualización en la esquina superior derecha y escala de 4 fases integrada.
 *
 * @param {Object} props
 * @param {Object} props.estado Payload completo de GET /api/estado
 * @param {Function} [props.alInyectarPreset] Callback opcional para simulación en 1 clic
 * @param {Function} [props.alActualizar] Callback discreto para refrescar datos desde la esquina del banner
 * @param {boolean} [props.cargando=false] Estado de carga de actualización
 */
export default function BannerNivelInformativo({
  estado,
  alInyectarPreset,
  alActualizar,
  cargando = false,
}) {
  if (!estado) return null;

  const {
    estado_sistema,
    nivel_vigente,
    nivel_calculado,
    contador_descenso = 0,
    clasificacion_parcial = false,
    regla_saturacion_aplicada = false,
    antiguedad_minutos,
    datos_desactualizados = false,
    t_max_minutos = 60,
    version_reglas,
    lectura,
    modalidad = 'real',
  } = estado;

  const fuente =
    lectura?.fuente ||
    (modalidad === 'simulada' ? 'Simulación Académica' : 'Open-Meteo');
  const observadoEn = lectura?.observado_en;
  const esParcial = clasificacion_parcial || lectura?.estado === 'incompleta';

  const acum72h = Number(lectura?.acum_72h_mm || 0);
  const porcentajeSaturacion = Math.min(100, Math.round((acum72h / 60) * 100));

  const botonActualizarDiscreto = alActualizar ? (
    <button
      type="button"
      onClick={alActualizar}
      disabled={cargando}
      aria-label="Actualizar datos meteorológicos"
      title={cargando ? 'Consultando datos...' : 'Actualizar lectura'}
      className="w-10 h-10 rounded-full bg-white/90 hover:bg-white text-[#111C2D] border border-black/10 shadow-xs flex items-center justify-center transition-all hover:scale-105 active:scale-95 disabled:opacity-50 cursor-pointer shrink-0"
    >
      <svg
        className={`w-4 h-4 ${cargando ? 'animate-spin' : ''}`}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" />
        <path d="M21 3v5h-5" />
      </svg>
    </button>
  ) : null;

  // =========================================================================
  // CASO 1: SIN DATOS METEOROLÓGICOS VÁLIDOS (PROHIBIDO degradar a Normal)
  // =========================================================================
  if (estado_sistema === 'SIN_DATOS') {
    return (
      <section
        role="region"
        aria-label="Estado del sistema: Sin datos"
        className="relative rounded-[28px] border-2 border-slate-200 bg-gradient-to-br from-slate-100/90 via-white to-white p-6 sm:p-8 lg:p-10 shadow-sm animate-fade-up"
      >
        {botonActualizarDiscreto && (
          <div className="absolute top-4 right-4 sm:top-6 sm:right-6">
            {botonActualizarDiscreto}
          </div>
        )}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-10 items-center">
          <div className="lg:col-span-7 space-y-4 pr-10 sm:pr-0">
            <span className="clay-pill inline-flex items-center gap-2 px-3.5 py-1.5 text-xs sm:text-sm font-bold bg-white text-[#475569] border border-slate-200">
              <span aria-hidden="true">⚪</span>
              <span>Sector Piloto Llojeta / Bajo Llojeta</span>
            </span>
            <h1 className="display-hero text-3xl sm:text-4xl lg:text-[48px] font-extrabold text-[#111C2D] leading-[1.1] tracking-tight break-words">
              Estado: SIN DATOS METEOROLÓGICOS VÁLIDOS
            </h1>
            <p className="text-lg sm:text-xl text-[#464555] leading-relaxed">
              Actualmente no se cuenta con observaciones pluviométricas válidas procesadas para el sector piloto Llojeta. El sistema no asume normalidad por ausencia de datos.
            </p>
            <div className="pt-2 flex flex-wrap gap-3 text-sm text-[#475569] font-mono">
              <span>Modalidad: {modalidad}</span>
              <span>·</span>
              <span>Versión de configuración: v{version_reglas?.version ?? 1}</span>
            </div>
          </div>

          <div className="lg:col-span-5 bg-white/90 rounded-3xl p-6 border border-slate-200/80 space-y-2 text-center">
            <p className="text-xs font-extrabold uppercase tracking-wider text-[#475569]">
              Escala Informativa en Espera
            </p>
            <p className="text-base text-[#464555] leading-relaxed">
              En cuanto se reciba una lectura válida de lluvia, se activará el indicador correspondiente de las 4 fases.
            </p>
          </div>
        </div>
      </section>
    );
  }

  // =========================================================================
  // CASO 2: DATOS DESACTUALIZADOS (supera T_max, PROHIBIDO degradar a Normal)
  // =========================================================================
  if (estado_sistema === 'DATOS_DESACTUALIZADOS' || datos_desactualizados) {
    const estiloUltimoNivel =
      ESTILOS_NIVEL[nivel_vigente] || ESTILOS_NIVEL.PRECAUCION;

    return (
      <section
        role="region"
        aria-label="Estado del sistema: Datos desactualizados"
        className="relative rounded-[28px] border-2 border-[#FBBF24] bg-gradient-to-br from-[#FEF3C7]/90 via-[#FFFBEB] to-white p-6 sm:p-8 lg:p-10 shadow-md animate-fade-up"
      >
        {botonActualizarDiscreto && (
          <div className="absolute top-4 right-4 sm:top-6 sm:right-6">
            {botonActualizarDiscreto}
          </div>
        )}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-10 items-center">
          <div className="lg:col-span-7 space-y-4 pr-10 sm:pr-0">
            <span className="clay-pill inline-flex items-center gap-2 px-3.5 py-1.5 text-xs sm:text-sm font-extrabold bg-white text-[#92400E] border border-[#FBBF24] uppercase tracking-wider">
              <span aria-hidden="true">⏳</span>
              <span>Regla T6 · Vencimiento Temporal</span>
            </span>
            <h1 className="display-hero text-2xl sm:text-4xl font-extrabold text-[#111C2D] leading-tight tracking-tight break-words">
              DATOS DESACTUALIZADOS (supera el límite de vigencia T_max)
            </h1>
            <p className="text-base sm:text-lg text-[#1E293B] leading-relaxed">
              La última lectura disponible tiene una antigüedad de{' '}
              <strong className="text-[#111C2D]">{formatearAntiguedad(antiguedad_minutos)}</strong>, superando el límite de vigencia configurado de {t_max_minutos} minutos. Se muestra el{' '}
              <strong className="text-[#111C2D]">último nivel informativo conocido</strong> sin alteración.
            </p>

            <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-[#475569] pt-1">
              <span>
                <strong className="text-[#111C2D]">Última observación:</strong> {formatearFechaHoraLaPaz(observadoEn)}
              </span>
              <span className="font-mono">Fuente: {fuente}</span>
              <span className="font-mono">Modalidad: {modalidad}</span>
              <span className="font-mono">Versión de configuración: v{version_reglas?.version ?? 1}</span>
            </div>
          </div>

          <div className="lg:col-span-5 bg-white/90 rounded-3xl p-6 border border-[#FDE68A] space-y-3">
            <span className="text-xs font-extrabold text-[#92400E] uppercase tracking-wider block">
              Último nivel informativo conocido
            </span>
            <div className="flex items-center justify-between gap-3 bg-[#FFFBEB] rounded-2xl p-4 border border-[#FDE68A]">
              <span className="headline-md text-2xl font-extrabold text-[#111C2D]">
                {nivel_vigente || 'No disponible'}
              </span>
              <span className={`clay-pill px-3.5 py-1 text-sm font-extrabold ${estiloUltimoNivel.pill}`}>
                {nivel_vigente}
              </span>
            </div>
          </div>
        </div>
      </section>
    );
  }

  // =========================================================================
  // CASO 3: NIVELES INFORMATIVOS VIGENTES (Hero Destacado por Color Pastel)
  // =========================================================================
  const estilo = ESTILOS_NIVEL[nivel_vigente] || ESTILOS_NIVEL.NORMAL;

  return (
    <section
      role="region"
      aria-label={`Nivel informativo vigente: ${nivel_vigente}`}
      className={`relative rounded-[28px] p-6 sm:p-8 lg:p-10 animate-fade-up transition-all ${estilo.heroSurface}`}
    >
      {/* Botón discreto de actualización en esquina superior derecha */}
      {botonActualizarDiscreto && (
        <div className="absolute top-4 right-4 sm:top-6 sm:right-6 z-10">
          {botonActualizarDiscreto}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-7 lg:gap-10 items-center">
        {/* Columna Izquierda: Diagnóstico Humano y Sencillo */}
        <div className="lg:col-span-7 space-y-5 min-w-0 pr-10 lg:pr-0">
          <div className="flex flex-wrap items-center gap-2.5">
            <span
              className={`clay-pill inline-flex items-center gap-2 px-4 py-1.5 text-xs sm:text-sm font-extrabold uppercase tracking-wider ${estilo.pill}`}
            >
              <span className={`w-2.5 h-2.5 rounded-full ${estilo.dot} clay-beacon-pulse`} aria-hidden="true" />
              <span>{estilo.titulo}</span>
            </span>
            <span className="text-xs sm:text-sm font-semibold text-[#1E293B]">
              Sector Piloto Llojeta / Bajo Llojeta
            </span>
          </div>

          <h1 className="display-hero text-3xl sm:text-5xl lg:text-[56px] font-extrabold text-[#111C2D] leading-[1.06] tracking-tight break-words">
            {estilo.titularHumano}
          </h1>

          <p className="text-lg sm:text-xl text-[#1E293B] leading-relaxed max-w-2xl">
            {estilo.descripcionHumana}
          </p>

          {/* Banderas Especiales si corresponden */}
          {(esParcial || regla_saturacion_aplicada) && (
            <div className="space-y-2">
              {esParcial && (
                <div
                  role="status"
                  className="rounded-2xl border border-[#FDE68A] bg-white/95 px-4 py-3 text-sm sm:text-base text-[#92400E] font-medium flex items-start gap-2.5"
                >
                  <span aria-hidden="true" className="shrink-0">⚠️</span>
                  <span>
                    Clasificación parcial: una o más ventanas de acumulación (24h/72h) tienen horas faltantes y fueron excluidas del cálculo.
                  </span>
                </div>
              )}

              {regla_saturacion_aplicada && (
                <div
                  role="status"
                  className="rounded-2xl border border-[#E2DFFF] bg-white/95 px-4 py-3 text-sm sm:text-base text-[#3525CD] font-medium flex items-start gap-2.5"
                >
                  <span aria-hidden="true" className="shrink-0">💧</span>
                  <span>
                    Regla de saturación aplicada (acumulado 72h &gt;= 60mm + intensidad &gt;= 2.5 mm/h).
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Fila limpia de trazabilidad ciudadana */}
          <div className="flex flex-wrap items-center gap-3 pt-1">
            <span className="clay-pill inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs sm:text-sm font-bold bg-white/90 text-[#3525CD] border border-black/5">
              <span aria-hidden="true">🛡️</span>
              <span>Fuente: {fuente}</span>
            </span>
            <span className="text-sm text-[#1E293B]">
              Actualizado: <strong className="text-[#111C2D]">{formatearFechaHoraLaPaz(observadoEn)}</strong>
            </span>
            <span className="clay-pill px-3 py-1 text-xs sm:text-sm font-bold bg-white/85 text-[#1E293B] border border-black/5">
              Antigüedad: {formatearAntiguedad(antiguedad_minutos)}
            </span>
          </div>

          {/* Detalles Técnicos Secundarios y Simulador Rápido agrupados limpiamente */}
          <details className="pt-2 border-t border-black/10 group">
            <summary className="text-sm font-bold text-[#111C2D] hover:text-[#3525CD] cursor-pointer select-none inline-flex items-center gap-2 py-1.5">
              <span>Ver detalles técnicos y simulador académico</span>
              <span className="text-xs transition-transform group-open:rotate-180" aria-hidden="true">▼</span>
            </summary>

            <div className="mt-3 space-y-4 rounded-2xl bg-white/90 border border-black/5 p-4">
              <div className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                  <span className="font-bold text-[#111C2D]">
                    Saturación de Suelo (Ventana 72h frente a 60mm)
                  </span>
                  <span className="font-mono font-bold text-[#1E293B] tabular-nums">
                    {acum72h.toFixed(1)} / 60.0mm ({porcentajeSaturacion}%)
                  </span>
                </div>
                <div className="w-full h-2.5 rounded-full bg-slate-200 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      acum72h >= 60
                        ? 'bg-[#DC2626]'
                        : acum72h >= 40
                          ? 'bg-[#C2410C]'
                          : acum72h >= 20
                            ? 'bg-[#D97706]'
                            : 'bg-[#059669]'
                    }`}
                    style={{ width: `${porcentajeSaturacion}%` }}
                  />
                </div>
              </div>

              <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs sm:text-sm text-[#475569] font-mono">
                <span>Modalidad: {modalidad}</span>
                <span>·</span>
                <span>Versión de configuración: v{version_reglas?.version ?? 1}</span>
                <span>·</span>
                <span>Histéresis (contador descenso): {contador_descenso}/2</span>
                {nivel_calculado && nivel_calculado !== nivel_vigente && (
                  <>
                    <span>·</span>
                    <span className="font-bold text-[#111C2D]">
                      Último nivel instantáneo: {nivel_calculado}
                    </span>
                  </>
                )}
              </div>

              {alInyectarPreset && (
                <div className="pt-2 border-t border-slate-200/70 space-y-2">
                  <span className="text-xs font-extrabold uppercase tracking-wider text-[#475569] block">
                    🧪 Simulador rápido (Aislamiento P11)
                  </span>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <button
                      type="button"
                      onClick={() => alInyectarPreset('NORMAL', 0.4, 2.0, 6.0)}
                      className="clay-pill clay-interactive min-h-[48px] px-3 py-2 border border-[#A7F3D0] bg-[#ECFDF5] text-[#065F46] font-bold text-sm inline-flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <span aria-hidden="true">🟢</span>
                      <span>Normal</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => alInyectarPreset('PRECAUCION', 3.2, 14.0, 30.0)}
                      className="clay-pill clay-interactive min-h-[48px] px-3 py-2 border border-[#FDE68A] bg-[#FEF3C7] text-[#92400E] font-bold text-sm inline-flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <span aria-hidden="true">🟡</span>
                      <span>Precaución</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => alInyectarPreset('ALERTA', 7.5, 28.0, 64.0)}
                      className="clay-pill clay-interactive min-h-[48px] px-3 py-2 border border-[#FED7AA] bg-[#FFEDD5] text-[#9A3412] font-bold text-sm inline-flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <span aria-hidden="true">🟠</span>
                      <span>Alerta</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => alInyectarPreset('EMERGENCIA', 14.5, 48.0, 98.0)}
                      className="clay-pill clay-interactive min-h-[48px] px-3 py-2 border border-[#FECACA] bg-[#FEE2E2] text-[#991B1B] font-bold text-sm inline-flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <span aria-hidden="true">🔴</span>
                      <span>Emergencia</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </details>
        </div>

        {/* Columna Derecha: Escala Informativa de Lluvia sobre Tarjeta Blanca Traslúcida */}
        <div className="lg:col-span-5 bg-white/85 backdrop-blur-xs rounded-3xl p-5 sm:p-6 border border-white/90 shadow-sm space-y-3 lg:mt-4">
          <div className="flex items-center justify-between gap-2 pb-1">
            <span className="text-xs font-extrabold uppercase tracking-wider text-[#475569]">
              ESCALA INFORMATIVA DE LLUVIA
            </span>
            <span className="text-xs font-bold text-[#475569] bg-[#F4F6FB] px-2.5 py-0.5 rounded-full border border-slate-200/80">
              4 fases
            </span>
          </div>

          <ul className="space-y-2.5">
            {ESCALA_4_FASES.map((fase) => {
              const esActivo = nivel_vigente === fase.clave;
              return (
                <li
                  key={fase.clave}
                  className={`rounded-2xl border p-3.5 flex items-center justify-between gap-3 transition-all ${
                    esActivo
                      ? `${fase.filaActiva} shadow-xs border-2`
                      : 'bg-[#F8FAFC] border-slate-200/60 text-[#464555]'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span
                      className={`w-7 h-7 rounded-full ${fase.dot} text-white flex items-center justify-center text-xs font-extrabold shrink-0`}
                      aria-hidden="true"
                    >
                      {esActivo ? '✓' : ''}
                    </span>
                    <div className="min-w-0">
                      <p className="font-bold text-sm sm:text-base text-[#111C2D] leading-snug">
                        {fase.etiqueta}
                      </p>
                      <p className="text-xs sm:text-sm opacity-90 truncate">
                        {fase.resumen}
                      </p>
                    </div>
                  </div>

                  {esActivo && (
                    <span className="shrink-0 bg-white text-[#111C2D] px-2.5 py-1 rounded-lg text-[11px] font-extrabold uppercase tracking-wide border border-black/10 shadow-2xs">
                      ACTIVO AHORA
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </section>
  );
}
