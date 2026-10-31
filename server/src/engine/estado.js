/**
 * @file estado.js
 * @description Máquina de estados con histéresis y reglas de transición puras (T1 a T7)
 * para el cálculo del nivel informativo vigente y estado del sistema en PUKARA.
 *
 * MÓDULO 100% PURO: Cero acceso a base de datos, cero llamadas HTTP, cero reloj implícito.
 */

import {
  NIVELES_INFORMATIVOS,
  compararNiveles,
  obtenerNivelMayor,
  clasificarMuestra,
} from './clasificar.js';

/**
 * Estados del sistema canónicos reconocidos por el motor y la plataforma.
 */
export const ESTADOS_SISTEMA = Object.freeze({
  SIN_DATOS: 'SIN_DATOS',
  DATOS_DESACTUALIZADOS: 'DATOS_DESACTUALIZADOS',
  NORMAL: 'NORMAL',
  PRECAUCION: 'PRECAUCION',
  ALERTA: 'ALERTA',
  EMERGENCIA: 'EMERGENCIA',
});

/**
 * Catálogo canónico de reglas de transición de la máquina de estados.
 */
export const REGLAS_TRANSICION = Object.freeze({
  T1_ASCENSO: 'T1_ASCENSO',
  T2_IGUAL_NIVEL: 'T2_IGUAL_NIVEL',
  T3_DESCENSO_PENDIENTE: 'T3_DESCENSO_PENDIENTE',
  T3_DESCENSO_COMPLETADO: 'T3_DESCENSO_COMPLETADO',
  T4_REINICIO_CONTADOR: 'T4_REINICIO_CONTADOR',
  T5_SIN_MUESTRA_VALIDA: 'T5_SIN_MUESTRA_VALIDA',
  T6_VENCIMIENTO: 'T6_VENCIMIENTO',
  T7_RECUPERACION: 'T7_RECUPERACION',
  IGNORADA_NO_INDEPENDIENTE: 'IGNORADA_NO_INDEPENDIENTE',
});

/**
 * Normaliza los parámetros temporales y de histéresis del motor.
 *
 * @param {Object} [parametros={}] Objeto de parámetros o configuración
 * @returns {{ t_max_minutos: number, separacion_minima_minutos: number, muestras_descenso: number }}
 */
export function normalizarParametrosMotor(parametros = {}) {
  const raw =
    parametros && typeof parametros === 'object' && parametros.parametros
      ? parametros.parametros
      : parametros || {};

  const tMax = Number(raw.t_max_minutos);
  const sepMin = Number(raw.separacion_minima_minutos);
  const mDesc = Number(raw.muestras_descenso);

  return {
    t_max_minutos: Number.isFinite(tMax) && tMax > 0 ? tMax : 60,
    separacion_minima_minutos:
      Number.isFinite(sepMin) && sepMin > 0 ? sepMin : 15,
    muestras_descenso:
      Number.isInteger(mDesc) && mDesc >= 2
        ? mDesc
        : Number.isFinite(mDesc) && mDesc >= 2
          ? Math.floor(mDesc)
          : 2,
  };
}

/**
 * Determina si una lectura meteorológica constituye una muestra temporalmente independiente
 * respecto a la última lectura evaluada.
 *
 * @param {string|Date|null|undefined} observadoEnNuevo Marca temporal de la nueva muestra
 * @param {string|Date|null|undefined} observadoEnAnterior Marca temporal de la muestra previa
 * @param {number} [separacionMinimaMinutos=15] Ventana mínima requerida en minutos
 * @returns {{ independiente: boolean, motivo: string, diferencia_minutos: number|null }}
 */
export function esMuestraIndependiente(
  observadoEnNuevo,
  observadoEnAnterior,
  separacionMinimaMinutos = 15
) {
  if (!observadoEnNuevo) {
    return {
      independiente: false,
      motivo: 'FECHA_NUEVA_INVALIDA',
      diferencia_minutos: null,
    };
  }

  const msNuevo =
    observadoEnNuevo instanceof Date
      ? observadoEnNuevo.getTime()
      : Date.parse(observadoEnNuevo);

  if (!Number.isFinite(msNuevo)) {
    return {
      independiente: false,
      motivo: 'FECHA_NUEVA_INVALIDA',
      diferencia_minutos: null,
    };
  }

  if (!observadoEnAnterior) {
    return {
      independiente: true,
      motivo: 'PRIMERA_MUESTRA',
      diferencia_minutos: null,
    };
  }

  const msAnterior =
    observadoEnAnterior instanceof Date
      ? observadoEnAnterior.getTime()
      : Date.parse(observadoEnAnterior);

  if (!Number.isFinite(msAnterior)) {
    return {
      independiente: true,
      motivo: 'PRIMERA_MUESTRA',
      diferencia_minutos: null,
    };
  }

  const diferenciaMinutos = (msNuevo - msAnterior) / 60000;

  if (diferenciaMinutos <= 0) {
    return {
      independiente: false,
      motivo: 'MARCA_NO_POSTERIOR',
      diferencia_minutos: diferenciaMinutos,
    };
  }

  const sepMin =
    Number(separacionMinimaMinutos) > 0 ? Number(separacionMinimaMinutos) : 15;

  if (diferenciaMinutos < sepMin) {
    return {
      independiente: false,
      motivo: 'SEPARACION_INSUFICIENTE',
      diferencia_minutos: diferenciaMinutos,
    };
  }

  return {
    independiente: true,
    motivo: 'INDEPENDIENTE_VALIDA',
    diferencia_minutos: diferenciaMinutos,
  };
}

/**
 * Retorna el estado base cuando el sistema arranca sin evaluaciones previas.
 *
 * @returns {Object} Estado inicial del motor
 */
export function crearEstadoInicialMotor() {
  return {
    estado_sistema: ESTADOS_SISTEMA.SIN_DATOS,
    nivel_vigente: null,
    ultimo_nivel_calculado: null,
    contador_descenso: 0,
    candidato_descenso_maximo: null,
    ultimo_observado_en: null,
  };
}

/**
 * Evalúa si una lectura previa ha superado el tiempo máximo de vigencia (t_max_minutos)
 * produciendo la transición pura T6_VENCIMIENTO.
 *
 * @param {Object|null|undefined} estadoActual Estado actual del motor
 * @param {string|Date} ahoraUtc Marca de tiempo actual inyectada explícitamente
 * @param {Object} [configuracionOParametros={}]
 * @returns {{ vencido: boolean, antiguedad_minutos: number|null, t_max_minutos: number, estado: Object, motivo?: string }}
 */
export function evaluarVencimiento(
  estadoActual,
  ahoraUtc,
  configuracionOParametros = {}
) {
  const params = normalizarParametrosMotor(configuracionOParametros);
  const estado = estadoActual ? { ...estadoActual } : crearEstadoInicialMotor();

  if (!ahoraUtc || !estado.ultimo_observado_en) {
    return {
      vencido: false,
      antiguedad_minutos: null,
      t_max_minutos: params.t_max_minutos,
      estado: { ...estado },
      motivo: !ahoraUtc ? 'SIN_HORA_REFERENCIA' : 'SIN_OBSERVACION_PREVIA',
    };
  }

  const msAhora =
    ahoraUtc instanceof Date ? ahoraUtc.getTime() : Date.parse(ahoraUtc);
  const msObs =
    estado.ultimo_observado_en instanceof Date
      ? estado.ultimo_observado_en.getTime()
      : Date.parse(estado.ultimo_observado_en);

  if (!Number.isFinite(msAhora) || !Number.isFinite(msObs)) {
    return {
      vencido: false,
      antiguedad_minutos: null,
      t_max_minutos: params.t_max_minutos,
      estado: { ...estado },
      motivo: 'FECHA_INVALIDA',
    };
  }

  const antiguedadMinutos = (msAhora - msObs) / 60000;

  if (antiguedadMinutos > params.t_max_minutos) {
    return {
      vencido: true,
      antiguedad_minutos: antiguedadMinutos,
      t_max_minutos: params.t_max_minutos,
      estado: {
        ...estado,
        estado_sistema: ESTADOS_SISTEMA.DATOS_DESACTUALIZADOS,
        transicion: REGLAS_TRANSICION.T6_VENCIMIENTO,
        evaluacion_creada: false,
      },
    };
  }

  return {
    vencido: false,
    antiguedad_minutos: antiguedadMinutos,
    t_max_minutos: params.t_max_minutos,
    estado: { ...estado },
  };
}

/**
 * Ejecuta un ciclo de la máquina de estados con histéresis temporal.
 *
 * @param {Object|null|undefined} estadoActual Estado previo del motor
 * @param {Object|null|undefined} entradaMuestra Muestra meteorológica, clasificada o cruda
 * @param {Object} [configuracionOParametros={}] Configuración de umbrales y parámetros
 * @returns {Object} Nuevo estado resultante y metadatos de transición
 */
export function siguienteEstado(
  estadoActual,
  entradaMuestra,
  configuracionOParametros = {}
) {
  const params = normalizarParametrosMotor(configuracionOParametros);
  const estado = estadoActual ? { ...estadoActual } : crearEstadoInicialMotor();

  // Regla P05: Si cambia la versión de configuración activa, se reinicia el contador de descenso
  const nuevaConfigId =
    configuracionOParametros?.id ??
    configuracionOParametros?.configuracion_id ??
    null;
  const configIdActual = estado?.configuracion_id ?? null;

  if (
    configIdActual !== null &&
    nuevaConfigId !== null &&
    Number(configIdActual) !== Number(nuevaConfigId)
  ) {
    estado.contador_descenso = 0;
    estado.candidato_descenso_maximo = null;
    estado.configuracion_id = Number(nuevaConfigId);
  } else if (nuevaConfigId !== null) {
    estado.configuracion_id = Number(nuevaConfigId);
  }

  // Asegurar candidato_descenso_maximo coherente si proviene de estado persistido con descenso en curso
  if (
    Number(estado.contador_descenso) >= 1 &&
    !estado.candidato_descenso_maximo
  ) {
    estado.candidato_descenso_maximo =
      estado.ultimo_nivel_calculado || estado.nivel_calculado || null;
  }

  // Soporte explícito de evento de vencimiento (T6) inyectado como muestra
  if (
    entradaMuestra &&
    (entradaMuestra.tipo === 'vencimiento' || entradaMuestra.vencimiento === true)
  ) {
    const resVencimiento = evaluarVencimiento(
      estado,
      entradaMuestra.ahora_utc || entradaMuestra.ahoraUtc,
      configuracionOParametros
    );
    if (resVencimiento.vencido) {
      return resVencimiento.estado;
    }
    return {
      ...estado,
      transicion: REGLAS_TRANSICION.T2_IGUAL_NIVEL,
      evaluacion_creada: false,
      detalle_vencimiento: resVencimiento,
    };
  }

  // Caso T5: Ausencia de muestra, fallo de API o muestra catalogada inválida
  if (
    !entradaMuestra ||
    entradaMuestra.fallo_api === true ||
    entradaMuestra.estado === 'invalida' ||
    entradaMuestra.muestra_valida === false
  ) {
    return {
      ...estado,
      transicion: REGLAS_TRANSICION.T5_SIN_MUESTRA_VALIDA,
      evaluacion_creada: false,
      motivo:
        entradaMuestra?.motivo_invalidez ||
        (entradaMuestra?.fallo_api ? 'FALLO_API' : 'MUESTRA_INVALIDA'),
    };
  }

  // Determinar nivel calculado de la muestra (directo o clasificando en memoria)
  let nivelCalculado = entradaMuestra.nivel_calculado ?? null;
  let clasificacionDetalle = null;

  if (!nivelCalculado) {
    const tieneUmbrales =
      configuracionOParametros?.umbrales ||
      Array.isArray(configuracionOParametros);

    if (tieneUmbrales) {
      clasificacionDetalle = clasificarMuestra(
        entradaMuestra,
        configuracionOParametros
      );
      if (
        !clasificacionDetalle.muestra_valida ||
        !clasificacionDetalle.nivel_calculado
      ) {
        return {
          ...estado,
          transicion: REGLAS_TRANSICION.T5_SIN_MUESTRA_VALIDA,
          evaluacion_creada: false,
          motivo:
            clasificacionDetalle.motivo_invalidez ||
            'SIN_VARIABLES_COMPLETAS',
        };
      }
      nivelCalculado = clasificacionDetalle.nivel_calculado;
    } else {
      return {
        ...estado,
        transicion: REGLAS_TRANSICION.T5_SIN_MUESTRA_VALIDA,
        evaluacion_creada: false,
        motivo: 'SIN_NIVEL_CALCULADO_NI_UMBRALES',
      };
    }
  }

  const observadoEn =
    entradaMuestra.observado_en || entradaMuestra.observadoEn || null;

  // Verificación de muestra temporalmente independiente
  if (estado.ultimo_observado_en && observadoEn) {
    const detalleIndependencia = esMuestraIndependiente(
      observadoEn,
      estado.ultimo_observado_en,
      params.separacion_minima_minutos
    );

    if (!detalleIndependencia.independiente) {
      return {
        ...estado,
        transicion: REGLAS_TRANSICION.IGNORADA_NO_INDEPENDIENTE,
        evaluacion_creada: false,
        detalle_independencia: detalleIndependencia,
      };
    }
  }

  const nuevoObservadoEn = observadoEn ?? estado.ultimo_observado_en;

  // Caso T7: Recuperación sin histéresis tras arranque (SIN_DATOS) o vencimiento (DATOS_DESACTUALIZADOS)
  if (
    !estado.nivel_vigente ||
    estado.estado_sistema === ESTADOS_SISTEMA.SIN_DATOS ||
    estado.estado_sistema === ESTADOS_SISTEMA.DATOS_DESACTUALIZADOS
  ) {
    return {
      ...estado,
      nivel_vigente: nivelCalculado,
      estado_sistema: nivelCalculado,
      ultimo_nivel_calculado: nivelCalculado,
      contador_descenso: 0,
      candidato_descenso_maximo: null,
      ultimo_observado_en: nuevoObservadoEn,
      transicion: REGLAS_TRANSICION.T7_RECUPERACION,
      evaluacion_creada: true,
      ...(clasificacionDetalle ? { clasificacion: clasificacionDetalle } : {}),
    };
  }

  // Evaluación con respecto al nivel vigente
  const cmp = compararNiveles(nivelCalculado, estado.nivel_vigente);

  // Regla T1: Ascenso inmediato ante métricas que igualan o superan un nivel superior
  if (cmp > 0) {
    return {
      ...estado,
      nivel_vigente: nivelCalculado,
      estado_sistema: nivelCalculado,
      ultimo_nivel_calculado: nivelCalculado,
      contador_descenso: 0,
      candidato_descenso_maximo: null,
      ultimo_observado_en: nuevoObservadoEn,
      transicion: REGLAS_TRANSICION.T1_ASCENSO,
      evaluacion_creada: true,
      ...(clasificacionDetalle ? { clasificacion: clasificacionDetalle } : {}),
    };
  }

  // Regla T2 / T4: Nivel calculado igual al nivel vigente
  if (cmp === 0) {
    const transicion =
      Number(estado.contador_descenso) > 0
        ? REGLAS_TRANSICION.T4_REINICIO_CONTADOR
        : REGLAS_TRANSICION.T2_IGUAL_NIVEL;

    return {
      ...estado,
      nivel_vigente: estado.nivel_vigente,
      estado_sistema: estado.nivel_vigente,
      ultimo_nivel_calculado: nivelCalculado,
      contador_descenso: 0,
      candidato_descenso_maximo: null,
      ultimo_observado_en: nuevoObservadoEn,
      transicion,
      evaluacion_creada: true,
      ...(clasificacionDetalle ? { clasificacion: clasificacionDetalle } : {}),
    };
  }

  // Regla T3: Descenso con histéresis temporal
  const nuevoContador = (Number(estado.contador_descenso) || 0) + 1;
  const previoInferior =
    Number(estado.contador_descenso) > 0
      ? estado.candidato_descenso_maximo ||
        estado.ultimo_nivel_calculado ||
        null
      : null;

  const nuevoCandidatoMaximo = previoInferior
    ? obtenerNivelMayor(previoInferior, nivelCalculado)
    : nivelCalculado;

  // Primera muestra inferior (o muestras insuficientes para consolidar histéresis)
  if (nuevoContador < params.muestras_descenso) {
    return {
      ...estado,
      nivel_vigente: estado.nivel_vigente,
      estado_sistema: estado.nivel_vigente,
      contador_descenso: nuevoContador,
      candidato_descenso_maximo: nuevoCandidatoMaximo,
      ultimo_nivel_calculado: nivelCalculado,
      ultimo_observado_en: nuevoObservadoEn,
      transicion: REGLAS_TRANSICION.T3_DESCENSO_PENDIENTE,
      evaluacion_creada: true,
      ...(clasificacionDetalle ? { clasificacion: clasificacionDetalle } : {}),
    };
  }

  // Descenso completado: baja hacia el MAYOR de los niveles registrados en la ventana
  return {
    ...estado,
    nivel_vigente: nuevoCandidatoMaximo,
    estado_sistema: nuevoCandidatoMaximo,
    contador_descenso: 0,
    candidato_descenso_maximo: null,
    ultimo_nivel_calculado: nivelCalculado,
    ultimo_observado_en: nuevoObservadoEn,
    transicion: REGLAS_TRANSICION.T3_DESCENSO_COMPLETADO,
    evaluacion_creada: true,
    ...(clasificacionDetalle ? { clasificacion: clasificacionDetalle } : {}),
  };
}

/**
 * Evalúa una secuencia temporal ordenada de muestras aplicando `siguienteEstado`
 * de manera acumulativa y retornando el historial paso a paso y el estado final.
 *
 * @param {Array<Object>} [muestras=[]]
 * @param {Object} [configuracionOParametros={}]
 * @param {Object|null} [estadoInicial=null]
 * @returns {{ estadoFinal: Object, historialPasos: Array<Object> }}
 */
export function ejecutarSecuenciaMuestras(
  muestras = [],
  configuracionOParametros = {},
  estadoInicial = null
) {
  let estadoActual = estadoInicial
    ? { ...estadoInicial }
    : crearEstadoInicialMotor();
  const historialPasos = [];

  for (const muestra of muestras) {
    const siguiente = siguienteEstado(
      estadoActual,
      muestra,
      configuracionOParametros
    );
    historialPasos.push(siguiente);
    estadoActual = siguiente;
  }

  return {
    estadoFinal: estadoActual,
    historialPasos,
  };
}

/**
 * Deriva el estado exacto del sistema al momento de consultar aplicando la Regla T6 (Vencimiento, P15),
 * determinando si se encuentra en SIN_DATOS, DATOS_DESACTUALIZADOS o en el nivel informativo vigente,
 * preservando de forma inmutable el último nivel conocido sin degradar jamás a NORMAL.
 *
 * @param {Object|null|undefined} ultimaEvaluacionOLectura Último estado o evaluación registrada
 * @param {Object} [opciones={}] Opciones de consulta
 * @param {Date|string|number} [opciones.ahora=new Date()] Marca de tiempo de consulta
 * @param {number} [opciones.t_max_minutos=60] Ventana máxima de vigencia en minutos
 * @param {string} [opciones.modalidad='real'] Modalidad evaluada ('real' o 'simulada')
 * @returns {Object} Estado derivado al consultar
 */
export function derivarEstadoAlConsultar(
  ultimaEvaluacionOLectura,
  opciones = {}
) {
  const {
    ahora = new Date(),
    t_max_minutos = 60,
    modalidad = 'real',
  } = opciones;

  const tMax = Number(t_max_minutos) > 0 ? Number(t_max_minutos) : 60;

  // 1. Si no existe evaluación previa, no tiene nivel vigente, o el estado es SIN_DATOS
  if (
    !ultimaEvaluacionOLectura ||
    !ultimaEvaluacionOLectura.nivel_vigente ||
    ultimaEvaluacionOLectura.estado_sistema === ESTADOS_SISTEMA.SIN_DATOS
  ) {
    return {
      estado_sistema: ESTADOS_SISTEMA.SIN_DATOS,
      nivel_vigente: null,
      ultimo_nivel_conocido: null,
      datos_desactualizados: false,
      antiguedad_minutos: null,
      t_max_minutos: tMax,
      observado_en: null,
      modalidad,
      transicion_consulta: 'SIN_MUESTRAS_VALIDAS',
    };
  }

  // 2. Extraer marca temporal de observación
  const marcaObservacion =
    ultimaEvaluacionOLectura.observado_en ??
    ultimaEvaluacionOLectura.ultimo_observado_en;

  // 3. Validar marca temporal
  if (!marcaObservacion) {
    return {
      estado_sistema: ESTADOS_SISTEMA.SIN_DATOS,
      nivel_vigente: null,
      ultimo_nivel_conocido: null,
      datos_desactualizados: false,
      antiguedad_minutos: null,
      t_max_minutos: tMax,
      observado_en: null,
      modalidad,
      transicion_consulta: 'SIN_MUESTRAS_VALIDAS',
    };
  }

  const msAhora =
    ahora instanceof Date
      ? ahora.getTime()
      : typeof ahora === 'number'
        ? ahora
        : Date.parse(ahora);

  const msObs =
    marcaObservacion instanceof Date
      ? marcaObservacion.getTime()
      : typeof marcaObservacion === 'number'
        ? marcaObservacion
        : Date.parse(marcaObservacion);

  if (!Number.isFinite(msObs)) {
    return {
      estado_sistema: ESTADOS_SISTEMA.SIN_DATOS,
      nivel_vigente: null,
      ultimo_nivel_conocido: null,
      datos_desactualizados: false,
      antiguedad_minutos: null,
      t_max_minutos: tMax,
      observado_en: null,
      modalidad,
      transicion_consulta: 'SIN_MUESTRAS_VALIDAS',
    };
  }

  // 4. Calcular antigüedad en minutos con 2 decimales
  const diffMin = (msAhora - msObs) / 60000;
  const antiguedadMinutos = Math.max(0, Math.round(diffMin * 100) / 100);

  const observadoIso = new Date(msObs).toISOString();
  const contadorDescenso = ultimaEvaluacionOLectura.contador_descenso ?? 0;
  const nivelVigente = ultimaEvaluacionOLectura.nivel_vigente;

  // 5. Comparación contra T_max (Regla T6 / P15)
  if (antiguedadMinutos > tMax) {
    // CRÍTICO P15: conservar siempre el último nivel conocido (p. ej. 'EMERGENCIA'), NUNCA degradar a 'NORMAL'
    return {
      estado_sistema: ESTADOS_SISTEMA.DATOS_DESACTUALIZADOS,
      nivel_vigente: nivelVigente,
      ultimo_nivel_conocido: nivelVigente,
      datos_desactualizados: true,
      antiguedad_minutos: antiguedadMinutos,
      t_max_minutos: tMax,
      observado_en: observadoIso,
      contador_descenso: contadorDescenso,
      modalidad,
      transicion_consulta: 'T6_VENCIMIENTO',
    };
  }

  // Muestra vigente
  return {
    estado_sistema: nivelVigente,
    nivel_vigente: nivelVigente,
    ultimo_nivel_conocido: nivelVigente,
    datos_desactualizados: false,
    antiguedad_minutos: antiguedadMinutos,
    t_max_minutos: tMax,
    observado_en: observadoIso,
    contador_descenso: contadorDescenso,
    modalidad,
    transicion_consulta: 'VIGENTE',
  };
}

/**
 * Reinicia el contador de descenso y el candidato de descenso máximo al activarse
 * una nueva versión de la configuración de reglas (Prueba P05).
 *
 * @param {Object|null|undefined} estadoActual Estado previo del motor
 * @param {number|string|null} [nuevaConfiguracionId=null] ID de la nueva versión de configuración
 * @returns {Object} Estado con contador de descenso en 0 y nueva configuración asociada
 */
export function reiniciarContadorPorCambioVersion(
  estadoActual,
  nuevaConfiguracionId = null
) {
  const estado = estadoActual ? { ...estadoActual } : crearEstadoInicialMotor();
  return {
    ...estado,
    contador_descenso: 0,
    candidato_descenso_maximo: null,
    configuracion_id:
      nuevaConfiguracionId !== null && nuevaConfiguracionId !== undefined
        ? Number(nuevaConfiguracionId)
        : null,
  };
}

export default {
  ESTADOS_SISTEMA,
  REGLAS_TRANSICION,
  normalizarParametrosMotor,
  esMuestraIndependiente,
  crearEstadoInicialMotor,
  evaluarVencimiento,
  siguienteEstado,
  ejecutarSecuenciaMuestras,
  derivarEstadoAlConsultar,
  reiniciarContadorPorCambioVersion,
};
