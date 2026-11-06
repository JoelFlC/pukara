/**
 * @file validarConfiguracion.js
 * @description Módulo de validación pura para la verificación de coherencia matemática,
 * orden estricto de niveles y parámetros del motor de reglas de PUKARA (Prueba P16).
 *
 * MÓDULO 100% PURO: Cero llamadas a base de datos, cero red, cero reloj implícito.
 */

export const VARIABLES_OBLIGATORIAS = Object.freeze([
  'intensidad_mm_h',
  'acum_24h_mm',
  'acum_72h_mm',
]);

export const NIVELES_OBLIGATORIOS = Object.freeze([
  'PRECAUCION',
  'ALERTA',
  'EMERGENCIA',
]);

/**
 * Error tipado para configuraciones de reglas y umbrales matemáticamente inválidos.
 */
export class ConfiguracionInvalidaError extends Error {
  constructor(
    mensaje = 'La configuración de reglas es inválida',
    errores = []
  ) {
    super(mensaje);
    this.name = 'ConfiguracionInvalidaError';
    this.statusCode = 400;
    this.codigo = 'CONFIGURACION_REGLAS_INVALIDA';
    this.errores = Array.isArray(errores) ? errores : [];
  }
}

/**
 * Valida la coherencia de los 9 umbrales académicos obligatorios (P16).
 *
 * @param {Array<Object>|Object|null|undefined} umbralesEntrada
 * @returns {{ valida: boolean, errores: Array<Object>, umbrales_normalizados: Object|null, umbrales_lista: Array<Object>|null }}
 */
export function validarUmbralesConfiguracion(umbralesEntrada) {
  const errores = [];

  if (!umbralesEntrada || typeof umbralesEntrada !== 'object') {
    return {
      valida: false,
      errores: [
        {
          codigo: 'UMBRALES_INCOMPLETOS',
          campo: 'umbrales',
          mensaje:
            'Se requiere un conjunto de umbrales válido (array u objeto anidado).',
        },
      ],
      umbrales_normalizados: null,
      umbrales_lista: null,
    };
  }

  // Mapa temporal para recolección y detección de duplicados
  const mapaValores = {};
  for (const v of VARIABLES_OBLIGATORIAS) {
    mapaValores[v] = {};
  }

  if (Array.isArray(umbralesEntrada)) {
    // Si viene como lista plana
    if (umbralesEntrada.length !== 9) {
      errores.push({
        codigo: 'CANTIDAD_UMBRALES_INVALIDA',
        campo: 'umbrales',
        mensaje: `Se requieren exactamente 9 umbrales obligatorios (3 variables x 3 niveles). Recibidos: ${umbralesEntrada.length}.`,
      });
    }

    const combinacionesVistas = new Set();

    for (let i = 0; i < umbralesEntrada.length; i++) {
      const u = umbralesEntrada[i];
      if (!u || typeof u !== 'object') {
        errores.push({
          codigo: 'UMBRAL_MALFORMADO',
          campo: `umbrales[${i}]`,
          mensaje: 'Elemento de umbral inválido en la lista.',
        });
        continue;
      }

      const { variable, nivel, valor } = u;

      if (!VARIABLES_OBLIGATORIAS.includes(variable)) {
        errores.push({
          codigo: 'VARIABLE_DESCONOCIDA',
          campo: `umbrales[${i}].variable`,
          mensaje: `Variable "${variable}" no permitida. Debe ser una de: ${VARIABLES_OBLIGATORIAS.join(', ')}.`,
        });
        continue;
      }

      if (!NIVELES_OBLIGATORIOS.includes(nivel)) {
        errores.push({
          codigo: 'NIVEL_DESCONOCIDO',
          campo: `umbrales[${i}].nivel`,
          mensaje: `Nivel "${nivel}" no permitido. Debe ser uno de: ${NIVELES_OBLIGATORIOS.join(', ')}.`,
        });
        continue;
      }

      const clave = `${variable}:${nivel}`;
      if (combinacionesVistas.has(clave)) {
        errores.push({
          codigo: 'UMBRAL_DUPLICADO',
          campo: `${variable}.${nivel}`,
          mensaje: `Combinación duplicada de variable y nivel: ${variable} - ${nivel}.`,
        });
      }
      combinacionesVistas.add(clave);

      mapaValores[variable][nivel] = valor;
    }
  } else {
    // Si viene como mapa anidado { variable: { nivel: valor } }
    for (const variable of Object.keys(umbralesEntrada)) {
      if (!VARIABLES_OBLIGATORIAS.includes(variable)) {
        errores.push({
          codigo: 'VARIABLE_DESCONOCIDA',
          campo: variable,
          mensaje: `Variable "${variable}" no reconocida.`,
        });
        continue;
      }
      const nivelesObj = umbralesEntrada[variable];
      if (!nivelesObj || typeof nivelesObj !== 'object') {
        errores.push({
          codigo: 'UMBRAL_MALFORMADO',
          campo: variable,
          mensaje: `El bloque de umbrales para "${variable}" debe ser un objeto.`,
        });
        continue;
      }
      for (const nivel of Object.keys(nivelesObj)) {
        if (!NIVELES_OBLIGATORIOS.includes(nivel)) {
          errores.push({
            codigo: 'NIVEL_DESCONOCIDO',
            campo: `${variable}.${nivel}`,
            mensaje: `Nivel "${nivel}" no reconocido.`,
          });
          continue;
        }
        mapaValores[variable][nivel] = nivelesObj[nivel];
      }
    }
  }

  // 1. Validar presencia de las 9 combinaciones obligatorias
  for (const v of VARIABLES_OBLIGATORIAS) {
    for (const n of NIVELES_OBLIGATORIOS) {
      if (
        mapaValores[v][n] === undefined ||
        mapaValores[v][n] === null ||
        mapaValores[v][n] === ''
      ) {
        errores.push({
          codigo: 'UMBRALES_INCOMPLETOS',
          campo: `${v}.${n}`,
          mensaje: `Falta definir el umbral obligatorio para la variable "${v}" en nivel "${n}".`,
        });
      }
    }
  }

  // 2. Validar que los valores sean números finitos y no negativos
  const mapaNormalizado = {};
  const listaNormalizada = [];

  for (const v of VARIABLES_OBLIGATORIAS) {
    mapaNormalizado[v] = {};
    for (const n of NIVELES_OBLIGATORIOS) {
      const valRaw = mapaValores[v][n];
      if (valRaw === undefined || valRaw === null || valRaw === '') {
        continue; // Ya se reportó en UMBRALES_INCOMPLETOS
      }

      if (typeof valRaw === 'boolean') {
        errores.push({
          codigo: 'VALOR_NO_NUMERICO',
          campo: `${v}.${n}`,
          mensaje: `El umbral para ${v} en nivel ${n} no puede ser un booleano.`,
        });
        continue;
      }

      const num = Number(valRaw);
      if (!Number.isFinite(num) || Number.isNaN(num)) {
        errores.push({
          codigo: 'VALOR_NO_NUMERICO',
          campo: `${v}.${n}`,
          mensaje: `El umbral para ${v} en nivel ${n} debe ser un número finito válido.`,
        });
      } else if (num < 0) {
        errores.push({
          codigo: 'VALOR_NEGATIVO',
          campo: `${v}.${n}`,
          mensaje: `El umbral para ${v} en nivel ${n} no puede ser negativo (valor: ${num}).`,
        });
      } else {
        const valRedondeado = Math.round(num * 100) / 100;
        mapaNormalizado[v][n] = valRedondeado;
        listaNormalizada.push({
          variable: v,
          nivel: n,
          valor: valRedondeado,
        });
      }
    }
  }

  // 3. Orden estricto creciente por variable (PRECAUCION < ALERTA < EMERGENCIA)
  for (const v of VARIABLES_OBLIGATORIAS) {
    const p = mapaNormalizado[v]?.PRECAUCION;
    const a = mapaNormalizado[v]?.ALERTA;
    const e = mapaNormalizado[v]?.EMERGENCIA;

    if (p !== undefined && a !== undefined && p >= a) {
      errores.push({
        codigo: 'ORDEN_NIVELES_INVALIDO',
        campo: v,
        mensaje: `En ${v}, el umbral de PRECAUCION (${p}) debe ser estrictamente menor que ALERTA (${a}).`,
      });
    }

    if (a !== undefined && e !== undefined && a >= e) {
      errores.push({
        codigo: 'ORDEN_NIVELES_INVALIDO',
        campo: v,
        mensaje: `En ${v}, el umbral de ALERTA (${a}) debe ser estrictamente menor que EMERGENCIA (${e}).`,
      });
    }
  }

  // 4. Coherencia entre ventanas de acumulación 24h y 72h (acum_24h_mm[nivel] <= acum_72h_mm[nivel])
  for (const n of NIVELES_OBLIGATORIOS) {
    const val24 = mapaNormalizado.acum_24h_mm?.[n];
    const val72 = mapaNormalizado.acum_72h_mm?.[n];

    if (val24 !== undefined && val72 !== undefined && val24 > val72) {
      errores.push({
        codigo: 'COHERENCIA_24H_72H_INVALIDA',
        campo: `acum_24h_mm.${n}`,
        mensaje: `El acumulado de 24 horas en nivel ${n} (${val24} mm) no puede ser mayor al de 72 horas (${val72} mm).`,
      });
    }
  }

  const esValida = errores.length === 0;

  return {
    valida: esValida,
    errores,
    umbrales_normalizados: esValida ? mapaNormalizado : null,
    umbrales_lista: esValida ? listaNormalizada : null,
  };
}

/**
 * Valida los parámetros del motor de reglas y saturación de suelo.
 *
 * @param {Object} [parametrosEntrada={}]
 * @returns {{ valida: boolean, errores: Array<Object>, parametros_normalizados: Object }}
 */
export function validarParametrosMotor(parametrosEntrada = {}) {
  const errores = [];
  const p = parametrosEntrada || {};

  // 1. t_max_minutos (default 60, debe ser > 0)
  let tMax = 60;
  if (p.t_max_minutos !== undefined && p.t_max_minutos !== null) {
    const num = Number(p.t_max_minutos);
    if (!Number.isFinite(num) || num <= 0) {
      errores.push({
        codigo: 'PARAMETRO_T_MAX_INVALIDO',
        campo: 'parametros.t_max_minutos',
        mensaje: 't_max_minutos debe ser un número positivo mayor a 0.',
      });
    } else {
      tMax = num;
    }
  }

  // 2. separacion_minima_minutos (default 15, debe ser > 0)
  let sepMin = 15;
  if (
    p.separacion_minima_minutos !== undefined &&
    p.separacion_minima_minutos !== null
  ) {
    const num = Number(p.separacion_minima_minutos);
    if (!Number.isFinite(num) || num <= 0) {
      errores.push({
        codigo: 'PARAMETRO_SEPARACION_INVALIDO',
        campo: 'parametros.separacion_minima_minutos',
        mensaje:
          'separacion_minima_minutos debe ser un número positivo mayor a 0.',
      });
    } else {
      sepMin = num;
    }
  }

  // 3. muestras_descenso (default 2, entero >= 1)
  let mDesc = 2;
  if (p.muestras_descenso !== undefined && p.muestras_descenso !== null) {
    const num = Number(p.muestras_descenso);
    if (!Number.isInteger(num) || num < 1) {
      errores.push({
        codigo: 'PARAMETRO_MUESTRAS_DESCENSO_INVALIDO',
        campo: 'parametros.muestras_descenso',
        mensaje:
          'muestras_descenso debe ser un número entero mayor o igual a 1.',
      });
    } else {
      mDesc = num;
    }
  }

  // 4. saturacion
  const sat = p.saturacion || {};
  const satHabilitada =
    sat.habilitada === undefined ? true : Boolean(sat.habilitada);

  let satAcum72 = 60;
  if (sat.acum_72h_min_mm !== undefined && sat.acum_72h_min_mm !== null) {
    const num = Number(sat.acum_72h_min_mm);
    if (!Number.isFinite(num) || num < 0) {
      errores.push({
        codigo: 'PARAMETRO_SATURACION_INVALIDO',
        campo: 'parametros.saturacion.acum_72h_min_mm',
        mensaje:
          'saturacion.acum_72h_min_mm debe ser un número mayor o igual a 0.',
      });
    } else {
      satAcum72 = num;
    }
  }

  let satIntensidad = 2.5;
  if (sat.intensidad_min_mm_h !== undefined && sat.intensidad_min_mm_h !== null) {
    const num = Number(sat.intensidad_min_mm_h);
    if (!Number.isFinite(num) || num < 0) {
      errores.push({
        codigo: 'PARAMETRO_SATURACION_INVALIDO',
        campo: 'parametros.saturacion.intensidad_min_mm_h',
        mensaje:
          'saturacion.intensidad_min_mm_h debe ser un número mayor o igual a 0.',
      });
    } else {
      satIntensidad = num;
    }
  }

  let satNivelMinimo = 'ALERTA';
  if (sat.nivel_minimo !== undefined && sat.nivel_minimo !== null) {
    if (!NIVELES_OBLIGATORIOS.includes(sat.nivel_minimo)) {
      errores.push({
        codigo: 'PARAMETRO_SATURACION_INVALIDO',
        campo: 'parametros.saturacion.nivel_minimo',
        mensaje: `saturacion.nivel_minimo debe ser uno de: ${NIVELES_OBLIGATORIOS.join(', ')}.`,
      });
    } else {
      satNivelMinimo = sat.nivel_minimo;
    }
  }

  const parametrosNormalizados = {
    t_max_minutos: tMax,
    separacion_minima_minutos: sepMin,
    muestras_descenso: mDesc,
    saturacion: {
      habilitada: satHabilitada,
      acum_72h_min_mm: satAcum72,
      intensidad_min_mm_h: satIntensidad,
      nivel_minimo: satNivelMinimo,
    },
  };

  return {
    valida: errores.length === 0,
    errores,
    parametros_normalizados: parametrosNormalizados,
  };
}

/**
 * Valida de forma integral la configuración completa de umbrales y parámetros.
 *
 * @param {Object} [configuracion={}]
 * @param {Array<Object>|Object} configuracion.umbrales
 * @param {Object} [configuracion.parametros={}]
 * @returns {{ valida: boolean, errores: Array<Object>, umbrales_normalizados: Object|null, umbrales_lista: Array<Object>|null, parametros_normalizados: Object }}
 */
export function validarConfiguracionCompleta({
  umbrales,
  parametros = {},
} = {}) {
  const valUmbrales = validarUmbralesConfiguracion(umbrales);
  const valParametros = validarParametrosMotor(parametros);

  const errores = [...valUmbrales.errores, ...valParametros.errores];

  return {
    valida: errores.length === 0,
    errores,
    umbrales_normalizados: valUmbrales.umbrales_normalizados,
    umbrales_lista: valUmbrales.umbrales_lista,
    parametros_normalizados: valParametros.parametros_normalizados,
  };
}

export default {
  VARIABLES_OBLIGATORIAS,
  NIVELES_OBLIGATORIOS,
  ConfiguracionInvalidaError,
  validarUmbralesConfiguracion,
  validarParametrosMotor,
  validarConfiguracionCompleta,
};
