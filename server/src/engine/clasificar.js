/**
 * @file clasificar.js
 * @description Motor funcional puro para la clasificación de muestras meteorológicas
 * en niveles informativos de lluvia según umbrales académicos y reglas de saturación de suelo.
 *
 * REGLAS ARQUITECTÓNICAS (Pure Functions First):
 * - Cero llamadas de red / HTTP.
 * - Cero acceso a base de datos.
 * - Cero lectura de variables de entorno.
 * - Cero uso del reloj del sistema (sin Date.now() ni new Date()).
 */

/**
 * Estados canónicos del nivel informativo de lluvia.
 */
export const NIVELES_INFORMATIVOS = Object.freeze({
  NORMAL: 'NORMAL',
  PRECAUCION: 'PRECAUCION',
  ALERTA: 'ALERTA',
  EMERGENCIA: 'EMERGENCIA',
});

/**
 * Jerarquía numérica estricta para la comparación y ordenamiento de niveles informativos.
 */
export const ORDEN_NIVELES = Object.freeze({
  NORMAL: 0,
  PRECAUCION: 1,
  ALERTA: 2,
  EMERGENCIA: 3,
});

/**
 * Variables meteorológicas evaluadas por el motor de clasificación.
 */
export const VARIABLES_METEOROLOGICAS = Object.freeze([
  'intensidad_mm_h',
  'acum_24h_mm',
  'acum_72h_mm',
]);

/**
 * Compara dos niveles informativos según su jerarquía numérica estricta.
 *
 * @param {string} nivelA
 * @param {string} nivelB
 * @returns {number} > 0 si nivelA > nivelB, < 0 si nivelA < nivelB, 0 si son iguales
 * @throws {Error} Si alguno de los niveles no pertenece a los estados canónicos
 */
export function compararNiveles(nivelA, nivelB) {
  if (nivelA === undefined || nivelA === null || !(nivelA in ORDEN_NIVELES)) {
    throw new Error(
      `Nivel inválido: '${nivelA}'. Debe ser uno de: ${Object.keys(ORDEN_NIVELES).join(', ')}`
    );
  }
  if (nivelB === undefined || nivelB === null || !(nivelB in ORDEN_NIVELES)) {
    throw new Error(
      `Nivel inválido: '${nivelB}'. Debe ser uno de: ${Object.keys(ORDEN_NIVELES).join(', ')}`
    );
  }

  return ORDEN_NIVELES[nivelA] - ORDEN_NIVELES[nivelB];
}

/**
 * Retorna el nivel de mayor jerarquía entre dos niveles informativos.
 *
 * @param {string} nivelA
 * @param {string} nivelB
 * @returns {string} El nivel con mayor peso
 */
export function obtenerNivelMayor(nivelA, nivelB) {
  const diff = compararNiveles(nivelA, nivelB);
  return diff >= 0 ? nivelA : nivelB;
}

/**
 * Normaliza y valida un conjunto de umbrales a un mapa indexado por variable y nivel.
 * Acepta tanto un array de registros relacionales como un objeto anidado.
 *
 * @param {Array<Object>|Object} umbralesEntrada
 * @returns {Object} Mapa normalizado con números flotantes finitos >= 0
 * @throws {Error} Si faltan umbrales obligatorios o los valores son inválidos
 */
export function normalizarMapaUmbrales(umbralesEntrada) {
  if (!umbralesEntrada || typeof umbralesEntrada !== 'object') {
    throw new Error('Umbrales inválidos o no proporcionados');
  }

  const fuente = Array.isArray(umbralesEntrada)
    ? umbralesEntrada
    : (Array.isArray(umbralesEntrada.umbrales)
        ? umbralesEntrada.umbrales
        : (umbralesEntrada.umbrales && typeof umbralesEntrada.umbrales === 'object'
            ? umbralesEntrada.umbrales
            : umbralesEntrada));

  const mapa = {};
  for (const v of VARIABLES_METEOROLOGICAS) {
    mapa[v] = {};
  }

  const nivelesRequeridos = ['PRECAUCION', 'ALERTA', 'EMERGENCIA'];

  if (Array.isArray(fuente)) {
    for (const item of fuente) {
      if (!item || typeof item !== 'object') continue;
      const { variable, nivel, valor } = item;
      if (
        VARIABLES_METEOROLOGICAS.includes(variable) &&
        nivelesRequeridos.includes(nivel)
      ) {
        if (
          valor !== null &&
          valor !== undefined &&
          valor !== '' &&
          typeof valor !== 'boolean'
        ) {
          const num = Number(valor);
          if (Number.isFinite(num) && num >= 0) {
            mapa[variable][nivel] = num;
          }
        }
      }
    }
  } else if (typeof fuente === 'object') {
    for (const v of VARIABLES_METEOROLOGICAS) {
      const objVar = fuente[v];
      if (objVar && typeof objVar === 'object') {
        for (const nivel of nivelesRequeridos) {
          const val = objVar[nivel];
          if (
            val !== null &&
            val !== undefined &&
            val !== '' &&
            typeof val !== 'boolean'
          ) {
            const num = Number(val);
            if (Number.isFinite(num) && num >= 0) {
              mapa[v][nivel] = num;
            }
          }
        }
      }
    }
  } else {
    throw new Error('Formato de umbrales no reconocido');
  }

  // Verificar que estén presentes los 9 umbrales obligatorios y sean válidos
  for (const v of VARIABLES_METEOROLOGICAS) {
    for (const nivel of nivelesRequeridos) {
      const val = mapa[v][nivel];
      if (typeof val !== 'number' || !Number.isFinite(val) || val < 0) {
        throw new Error(
          `Umbral faltante o inválido para la variable '${v}' y nivel '${nivel}'. Se requieren los 9 umbrales con valores numéricos >= 0.`
        );
      }
    }
  }

  return mapa;
}

/**
 * Clasifica el valor numérico de una sola variable meteorológica contra sus umbrales.
 * Aplica estrictamente la regla P01 ("o más", >=).
 *
 * @param {number} valor Valor numérico finito >= 0
 * @param {Object} umbralesVariable Objeto con umbrales { PRECAUCION, ALERTA, EMERGENCIA }
 * @returns {string} Nivel informativo resultante ('NORMAL', 'PRECAUCION', 'ALERTA', 'EMERGENCIA')
 */
export function clasificarVariableIndividual(valor, umbralesVariable) {
  if (
    valor === null ||
    valor === undefined ||
    valor === '' ||
    typeof valor === 'boolean' ||
    typeof Number(valor) !== 'number' ||
    !Number.isFinite(Number(valor)) ||
    Number(valor) < 0
  ) {
    throw new Error(
      `Valor de variable meteorológica inválido: '${valor}'. Debe ser un número finito >= 0.`
    );
  }

  if (!umbralesVariable || typeof umbralesVariable !== 'object') {
    throw new Error('Umbrales de variable no proporcionados o inválidos');
  }

  const { PRECAUCION, ALERTA, EMERGENCIA } = umbralesVariable;
  const p = Number(PRECAUCION);
  const a = Number(ALERTA);
  const e = Number(EMERGENCIA);

  if (!Number.isFinite(p) || !Number.isFinite(a) || !Number.isFinite(e)) {
    throw new Error(
      'Los umbrales de la variable deben contener valores numéricos finitos para PRECAUCION, ALERTA y EMERGENCIA'
    );
  }

  const v = Number(valor);

  if (v >= e) {
    return NIVELES_INFORMATIVOS.EMERGENCIA;
  }
  if (v >= a) {
    return NIVELES_INFORMATIVOS.ALERTA;
  }
  if (v >= p) {
    return NIVELES_INFORMATIVOS.PRECAUCION;
  }
  return NIVELES_INFORMATIVOS.NORMAL;
}

/**
 * Determina si una variable dentro de una muestra meteorológica es completa y válida
 * para participar en la clasificación (Regla P02: jamás asumir cero ante datos faltantes).
 *
 * @param {Object} muestra
 * @param {string} nombreVariable Nombre de la variable ('intensidad_mm_h', 'acum_24h_mm', 'acum_72h_mm')
 * @returns {boolean}
 */
export function esVariableCompleta(muestra, nombreVariable) {
  if (!muestra || typeof muestra !== 'object') {
    return false;
  }
  if (!VARIABLES_METEOROLOGICAS.includes(nombreVariable)) {
    return false;
  }

  const val = muestra[nombreVariable];
  if (
    val === null ||
    val === undefined ||
    val === '' ||
    typeof val === 'boolean'
  ) {
    return false;
  }

  const num = Number(val);
  if (!Number.isFinite(num) || num < 0) {
    return false;
  }

  if (nombreVariable === 'acum_24h_mm') {
    if (
      muestra.horas_validas_24h !== undefined &&
      muestra.horas_validas_24h !== null
    ) {
      if (Number(muestra.horas_validas_24h) !== 24) {
        return false;
      }
    }
  }

  if (nombreVariable === 'acum_72h_mm') {
    if (
      muestra.horas_validas_72h !== undefined &&
      muestra.horas_validas_72h !== null
    ) {
      if (Number(muestra.horas_validas_72h) !== 72) {
        return false;
      }
    }
  }

  return true;
}

/**
 * Clasifica una muestra meteorológica evaluando sus variables completas contra
 * los umbrales ratificados y aplicando la regla de saturación de suelo (P17).
 *
 * @param {Object} muestra Objeto con lecturas/acumulados meteorológicos
 * @param {Object} [configuracionReglas={}] Configuración con umbrales y parámetros
 * @returns {Object} Resultado cerrado de clasificación
 */
export function clasificarMuestra(muestra, configuracionReglas = {}) {
  // a) Validación de muestra y disponibilidad de variables completas
  if (!muestra || typeof muestra !== 'object' || muestra.estado === 'invalida') {
    return {
      muestra_valida: false,
      nivel_calculado: null,
      nivel_base_variables: null,
      clasificacion_parcial: false,
      regla_saturacion_aplicada: false,
      variables_evaluadas: {},
      variables_excluidas: [...VARIABLES_METEOROLOGICAS],
      motivo_invalidez: 'SIN_VARIABLES_COMPLETAS',
    };
  }

  const variablesCompletas = VARIABLES_METEOROLOGICAS.filter((v) =>
    esVariableCompleta(muestra, v)
  );

  if (variablesCompletas.length === 0) {
    return {
      muestra_valida: false,
      nivel_calculado: null,
      nivel_base_variables: null,
      clasificacion_parcial: false,
      regla_saturacion_aplicada: false,
      variables_evaluadas: {},
      variables_excluidas: [...VARIABLES_METEOROLOGICAS],
      motivo_invalidez: 'SIN_VARIABLES_COMPLETAS',
    };
  }

  // Normalizar los umbrales de evaluación
  const umbralesCrudos = configuracionReglas?.umbrales ?? configuracionReglas;
  const mapaUmbrales = normalizarMapaUmbrales(umbralesCrudos);

  // b) Evaluación individual de variables completas y registro de excluidas
  const variables_evaluadas = {};
  const variables_excluidas = [];

  for (const variable of VARIABLES_METEOROLOGICAS) {
    if (esVariableCompleta(muestra, variable)) {
      const valor = Number(muestra[variable]);
      const nivelVariable = clasificarVariableIndividual(
        valor,
        mapaUmbrales[variable]
      );
      variables_evaluadas[variable] = {
        valor,
        nivel: nivelVariable,
      };
    } else {
      variables_excluidas.push(variable);
    }
  }

  // c) Determinar el nivel base tomando el máximo jerárquico de las variables evaluadas
  const nombresEvaluadas = Object.keys(variables_evaluadas);
  let nivel_base = variables_evaluadas[nombresEvaluadas[0]].nivel;
  for (let i = 1; i < nombresEvaluadas.length; i++) {
    const nivelVar = variables_evaluadas[nombresEvaluadas[i]].nivel;
    nivel_base = obtenerNivelMayor(nivel_base, nivelVar);
  }

  // d) Regla de Saturación del Suelo (P17)
  const DEFECTO_SATURACION = {
    habilitada: true,
    acum_72h_min_mm: 60,
    intensidad_min_mm_h: 2.5,
    nivel_minimo: NIVELES_INFORMATIVOS.ALERTA,
  };

  const satConfig = configuracionReglas?.parametros?.saturacion;
  const saturacion = {
    habilitada:
      satConfig?.habilitada !== undefined
        ? Boolean(satConfig.habilitada)
        : DEFECTO_SATURACION.habilitada,
    acum_72h_min_mm:
      satConfig?.acum_72h_min_mm !== undefined &&
      Number.isFinite(Number(satConfig.acum_72h_min_mm))
        ? Number(satConfig.acum_72h_min_mm)
        : DEFECTO_SATURACION.acum_72h_min_mm,
    intensidad_min_mm_h:
      satConfig?.intensidad_min_mm_h !== undefined &&
      Number.isFinite(Number(satConfig.intensidad_min_mm_h))
        ? Number(satConfig.intensidad_min_mm_h)
        : DEFECTO_SATURACION.intensidad_min_mm_h,
    nivel_minimo: satConfig?.nivel_minimo || DEFECTO_SATURACION.nivel_minimo,
  };

  let regla_saturacion_aplicada = false;
  let nivel_calculado = nivel_base;

  if (
    saturacion.habilitada !== false &&
    'acum_72h_mm' in variables_evaluadas &&
    'intensidad_mm_h' in variables_evaluadas
  ) {
    const cumpleSaturacion =
      variables_evaluadas.acum_72h_mm.valor >= saturacion.acum_72h_min_mm &&
      variables_evaluadas.intensidad_mm_h.valor >= saturacion.intensidad_min_mm_h;

    if (cumpleSaturacion) {
      regla_saturacion_aplicada = true;
      nivel_calculado = obtenerNivelMayor(nivel_base, saturacion.nivel_minimo);
    }
  }

  // e) Trazabilidad de clasificación parcial si se omitieron variables
  const clasificacion_parcial = variables_excluidas.length > 0;

  // f) Retorno con contrato cerrado
  return {
    muestra_valida: true,
    nivel_calculado,
    nivel_base_variables: nivel_base,
    clasificacion_parcial,
    regla_saturacion_aplicada,
    variables_evaluadas,
    variables_excluidas,
  };
}

export default {
  NIVELES_INFORMATIVOS,
  ORDEN_NIVELES,
  VARIABLES_METEOROLOGICAS,
  compararNiveles,
  obtenerNivelMayor,
  normalizarMapaUmbrales,
  clasificarVariableIndividual,
  esVariableCompleta,
  clasificarMuestra,
};
