/**
 * @file acumulados.js
 * @description Motor funcional puro para el cálculo de acumulados de lluvia (1h, 24h, 72h)
 * y determinación determinista de calidad de datos para el proyecto PUKARA.
 *
 * REGLAS ARQUITECTÓNICAS (Pure Functions First):
 * - Cero llamadas de red / HTTP.
 * - Cero acceso a base de datos.
 * - Cero lectura de variables de entorno.
 * - Cero uso del reloj del sistema (sin Date.now() ni new Date() sin argumentos).
 */

const HORA_MS = 3_600_000;

/**
 * Redondea un número a 2 decimales para evitar artefactos de punto flotante IEEE-754.
 * @param {number} n
 * @returns {number}
 */
function redondear2(n) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/**
 * Trunca un timestamp o cadena de fecha hacia abajo a la hora cerrada en punto UTC.
 * @param {number | string | Date} fecha
 * @returns {number} Timestamp en milisegundos UTC correspondiente a la hora cerrada en punto
 */
export function truncarAHoraUtc(fecha) {
  const ts = typeof fecha === 'number' ? fecha : Date.parse(fecha);
  if (Number.isNaN(ts)) {
    return NaN;
  }
  return Math.floor(ts / HORA_MS) * HORA_MS;
}

/**
 * Calcula los acumulados de precipitación en ventanas retrospectivas de 24h y 72h,
 * evalúa la intensidad actual y determina el estado de calidad de la muestra.
 *
 * @param {Object} entrada
 * @param {string} entrada.observado_en Cadena ISO 8601 UTC obligatoria
 * @param {Object} [entrada.actual] Datos actuales instantáneos
 * @param {number|null} [entrada.actual.precipitacion_mm] Precipitación instantánea en mm
 * @param {Object} [entrada.serie_horaria] Series horarias
 * @param {string[]} [entrada.serie_horaria.tiempos_utc] Marcas de tiempo ISO UTC
 * @param {(number|null)[]} [entrada.serie_horaria.precipitacion_mm] Precipitaciones horarias
 * @returns {Object} Contrato normalizado de acumulados y calidad
 */
export function calcularAcumuladosYCalidad(entrada) {
  const RETORNO_INVALIDA_POR_DEFECTO = {
    intensidad_mm_h: null,
    acum_24h_mm: null,
    acum_72h_mm: null,
    horas_validas_24h: 0,
    horas_validas_72h: 0,
    estado: 'invalida',
    banderas_calidad: {
      intensidad_completa: false,
      acum_24h_completo: false,
      acum_72h_completo: false,
      clasificacion_parcial: false,
    },
  };

  // 1. Validación estricta de estructura y observado_en
  if (!entrada || typeof entrada !== 'object' || typeof entrada.observado_en !== 'string') {
    return RETORNO_INVALIDA_POR_DEFECTO;
  }

  const tsObservado = Date.parse(entrada.observado_en);
  if (Number.isNaN(tsObservado)) {
    return RETORNO_INVALIDA_POR_DEFECTO;
  }

  // 2. Ancla horaria cerrada (tsHoraAncla)
  const tsHoraAncla = Math.floor(tsObservado / HORA_MS) * HORA_MS;

  // Construcción del mapa horario indexado por milisegundos UTC
  const mapaHorario = new Map();
  const serie = entrada.serie_horaria;

  if (
    serie &&
    typeof serie === 'object' &&
    Array.isArray(serie.tiempos_utc) &&
    Array.isArray(serie.precipitacion_mm) &&
    serie.tiempos_utc.length === serie.precipitacion_mm.length
  ) {
    const len = serie.tiempos_utc.length;
    for (let i = 0; i < len; i++) {
      const tIso = serie.tiempos_utc[i];
      const ts = typeof tIso === 'string' ? Date.parse(tIso) : NaN;
      if (!Number.isNaN(ts)) {
        // Solo indexar si es menor o igual a tsHoraAncla (ignora pronóstico futuro)
        if (ts <= tsHoraAncla) {
          mapaHorario.set(ts, serie.precipitacion_mm[i]);
        }
      }
    }
  }

  // 3. Cálculo de ventana de 24 horas hacia atrás desde tsHoraAncla
  let horasValidas24 = 0;
  let suma24 = 0;

  for (let k = 0; k < 24; k++) {
    const tsEsperado = tsHoraAncla - k * HORA_MS;
    if (mapaHorario.has(tsEsperado)) {
      const v = mapaHorario.get(tsEsperado);
      if (typeof v === 'number' && Number.isFinite(v) && v >= 0) {
        horasValidas24++;
        suma24 += v;
      }
    }
  }

  const acum24Completo = horasValidas24 === 24;
  const acum24Mm = acum24Completo ? redondear2(suma24) : null;

  // 4. Cálculo de ventana de 72 horas hacia atrás desde tsHoraAncla
  let horasValidas72 = 0;
  let suma72 = 0;

  for (let k = 0; k < 72; k++) {
    const tsEsperado = tsHoraAncla - k * HORA_MS;
    if (mapaHorario.has(tsEsperado)) {
      const v = mapaHorario.get(tsEsperado);
      if (typeof v === 'number' && Number.isFinite(v) && v >= 0) {
        horasValidas72++;
        suma72 += v;
      }
    }
  }

  const acum72Completo = horasValidas72 === 72;
  const acum72Mm = acum72Completo ? redondear2(suma72) : null;

  // 5. Evaluación de intensidad_mm_h (última hora / estimación actual)
  const pActual = entrada.actual?.precipitacion_mm;
  let intensidadMmH = null;
  let intensidadCompleta = false;

  if (typeof pActual === 'number' && Number.isFinite(pActual) && pActual >= 0) {
    intensidadMmH = redondear2(pActual);
    intensidadCompleta = true;
  }

  // 6. Determinación del estado de calidad de la muestra
  let estado = 'incompleta';
  if (intensidadCompleta && acum24Completo && acum72Completo) {
    estado = 'valida';
  } else if (!intensidadCompleta && !acum24Completo && !acum72Completo) {
    estado = 'invalida';
  } else {
    estado = 'incompleta';
  }

  const clasificacionParcial = estado === 'incompleta';

  return {
    intensidad_mm_h: intensidadMmH,
    acum_24h_mm: acum24Mm,
    acum_72h_mm: acum72Mm,
    horas_validas_24h: horasValidas24,
    horas_validas_72h: horasValidas72,
    estado,
    banderas_calidad: {
      intensidad_completa: intensidadCompleta,
      acum_24h_completo: acum24Completo,
      acum_72h_completo: acum72Completo,
      clasificacion_parcial: clasificacionParcial,
    },
  };
}

export default {
  calcularAcumuladosYCalidad,
  truncarAHoraUtc,
};
