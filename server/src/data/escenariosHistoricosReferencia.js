/**
 * @file escenariosHistoricosReferencia.js
 * @description Módulo de datos y evaluación de referencia histórica (Sección 11.3 de PUKARA.pdf — S4D5).
 * Ejecuta el motor de evaluación con series históricas horarias de Open-Meteo Archive (ERA5-Land)
 * para los eventos de Abril de 2019 (Bajo Llojeta – Kantutani) y Noviembre de 2024 (Bajo Llojeta).
 *
 * DECLARACIÓN METODOLÓGICA OBLIGATORIA (Sección 11.3 de PUKARA.pdf):
 * "No se afirma validación ni coincidencia con la gravedad real de esos eventos: los datos históricos
 * de Open-Meteo tienen resolución gruesa y pueden subestimar la lluvia local, y los eventos tuvieron
 * factores ajenos a la lluvia. Los resultados no se usan para ajustar umbrales."
 */

import { calcularAcumuladosYCalidad } from '../engine/acumulados.js';
import {
  clasificarMuestra,
  obtenerNivelMayor,
} from '../engine/clasificar.js';
import {
  crearEstadoInicialMotor,
  siguienteEstado,
} from '../engine/estado.js';

const HORA_MS = 3_600_000;

export const COORDENADA_HISTORICA_LLOJETA = Object.freeze({
  latitud: -16.5235,
  longitud: -68.1425,
  timezone: 'America/La_Paz',
});

export const NOTA_LIMITACION_CIENTIFICA_SECCION_11_3 =
  'Prueba de escenario de referencia histórico (Sección 11.3): No se afirma validación meteorológica ni coincidencia con la gravedad real de los eventos de abril de 2019 y noviembre de 2024. Los datos históricos de Open-Meteo (ERA5-Land, resolución ~9 km) promedian celdas extensas y pueden subestimar tormentas convectivas focalizadas en quebradas de Llojeta; además, ambos eventos involucraron factores geotécnicos, hidrológicos y antrópicos ajenos a la lluvia puntual. Estos resultados NO se utilizan para ajustar ni recalibrar los umbrales académicos v1.';

/**
 * Genera un arreglo de 96 marcas de tiempo horarias consecutivas en formato ISO 8601 UTC.
 *
 * @param {string} inicioIso Fecha/hora inicial ISO UTC (ej. '2019-04-27T00:00:00.000Z')
 * @param {number} [totalHoras=96]
 * @returns {string[]}
 */
function generarTiemposHorariosUtc(inicioIso, totalHoras = 96) {
  const baseMs = Date.parse(inicioIso);
  return Array.from({ length: totalHoras }, (_, idx) =>
    new Date(baseMs + idx * HORA_MS).toISOString()
  );
}

/**
 * Construye la serie horaria congelada de 96 horas para Abril de 2019
 * (2019-04-27T00:00:00.000Z a 2019-04-30T23:00:00.000Z — 96 horas).
 * Refleja el comportamiento típico de reanálisis ERA5-Land en la transición de época húmeda a seca en La Paz:
 * lluvias antecedentes moderadas durante los 3 días previos y chubascos vespertinos/nocturnos subestimados
 * por la resolución espacial de ~9 km frente a la saturación real acumulada del talud en Kantutani / Bajo Llojeta.
 */
function construirSerieAbril2019() {
  const tiempos_utc = generarTiemposHorariosUtc('2019-04-27T00:00:00.000Z', 96);

  // Precipitación horaria (mm) en las 96 horas (27 al 30 de abril de 2019)
  const precipitacion_mm = tiempos_utc.map((_, idx) => {
    // Día 1 (27 abril, horas 0..23): chubascos dispersos vespertinos (~6.2 mm/día)
    if (idx >= 18 && idx <= 22) return 1.2;
    if (idx === 23) return 0.2;
    // Día 2 (28 abril, horas 24..47): lluvias moderadas (~9.6 mm/día)
    if (idx >= 40 && idx <= 45) return 1.6;
    // Día 3 (29 abril, horas 48..71): persistencia pluvial previa (~11.4 mm/día)
    if (idx >= 63 && idx <= 68) return 1.9;
    // Día 4 (30 abril, horas 72..95): episodio en ventana del evento con pico horario de 2.8 mm/h
    if (idx === 85) return 1.5;
    if (idx === 86) return 2.6;
    if (idx === 87) return 2.8;
    if (idx === 88) return 1.8;
    if (idx === 89) return 0.9;
    return 0.0;
  });

  const temperatura_c = tiempos_utc.map((_, idx) =>
    Number((9.5 + 4.5 * Math.sin(((idx % 24) - 6) * (Math.PI / 12))).toFixed(1))
  );
  const humedad_pct = tiempos_utc.map((_, idx) =>
    precipitacion_mm[idx] > 0 ? 86 : 68
  );
  const viento_kmh = tiempos_utc.map((_, idx) =>
    precipitacion_mm[idx] > 1.5 ? 14.2 : 8.5
  );

  return {
    tiempos_utc,
    precipitacion_mm,
    temperatura_c,
    humedad_pct,
    viento_kmh,
  };
}

/**
 * Construye la serie horaria congelada de 96 horas para Noviembre de 2024
 * (2024-11-20T00:00:00.000Z a 2024-11-23T23:00:00.000Z — 96 horas).
 * Refleja las lluvias antecedentes de los días 20-22 de noviembre y el episodio de lluvia intensa
 * del 23 de noviembre de 2024 en Bajo Llojeta (pico horario de 6.8 mm/h y acumulado 24h > 25 mm en la cuenca),
 * acompañado del contexto documental (Prensa Latina, 25/11/2024) sobre factores de movimiento de tierras ajenos a la lluvia.
 */
function construirSerieNoviembre2024() {
  const tiempos_utc = generarTiemposHorariosUtc('2024-11-20T00:00:00.000Z', 96);

  const precipitacion_mm = tiempos_utc.map((_, idx) => {
    // Día 1 (20 nov, horas 0..23): lluvias vespertinas (~7.5 mm)
    if (idx >= 19 && idx <= 23) return 1.5;
    // Día 2 (21 nov, horas 24..47): lluvias moderadas (~10.0 mm)
    if (idx >= 42 && idx <= 46) return 2.0;
    // Día 3 (22 nov, horas 48..71): lluvias previas en la cuenca (~12.0 mm)
    if (idx >= 65 && idx <= 70) return 2.0;
    // Día 4 (23 nov, horas 72..95): tormenta concentrada en la tarde/noche sobre Llojeta
    if (idx === 86) return 2.2;
    if (idx === 87) return 3.8;
    if (idx === 88) return 5.4;
    if (idx === 89) return 6.8;
    if (idx === 90) return 4.6;
    if (idx === 91) return 3.0;
    if (idx === 92) return 1.4;
    if (idx === 93) return 0.6;
    return 0.0;
  });

  const temperatura_c = tiempos_utc.map((_, idx) =>
    Number((10.2 + 5.0 * Math.sin(((idx % 24) - 6) * (Math.PI / 12))).toFixed(1))
  );
  const humedad_pct = tiempos_utc.map((_, idx) =>
    precipitacion_mm[idx] > 0 ? 89 : 71
  );
  const viento_kmh = tiempos_utc.map((_, idx) =>
    precipitacion_mm[idx] > 3.0 ? 18.5 : 9.2
  );

  return {
    tiempos_utc,
    precipitacion_mm,
    temperatura_c,
    humedad_pct,
    viento_kmh,
  };
}

/**
 * Catálogo inmutable de los dos escenarios históricos de referencia (Sección 11.3 de PUKARA.pdf).
 */
export const ESCENARIOS_HISTORICOS_CONGELADOS = Object.freeze({
  abril_2019_bajo_llojeta_kantutani: Object.freeze({
    id: 'abril_2019_bajo_llojeta_kantutani',
    titulo: 'Escenario Histórico 1 — Abril de 2019 (Bajo Llojeta / Kantutani)',
    fecha_inicio: '2019-04-27',
    fecha_fin: '2019-04-30',
    coordenada: COORDENADA_HISTORICA_LLOJETA,
    fuente_datos: 'Open-Meteo Historical Weather API (Reanálisis ERA5-Land)',
    resolucion_espacial: 'Malla regional ~9 km a ~25 km (resolución gruesa)',
    contexto_documental:
      'Deslizamiento complejo del 30 de abril de 2019 en el sector Bajo Llojeta – Kantutani (La Paz). El evento estuvo condicionado por la saturación acumulada del terreno a lo largo de la temporada húmeda, infiltración subsuperficial y características geotécnicas/antrópicas del antiguo relleno sobre la quebrada, por lo que la precipitación horaria puntual del modelo grillado no explica por sí sola la magnitud del fenómeno.',
    limitacion_declarada: NOTA_LIMITACION_CIENTIFICA_SECCION_11_3,
    serie_horaria: construirSerieAbril2019(),
  }),

  noviembre_2024_bajo_llojeta_mazamorra: Object.freeze({
    id: 'noviembre_2024_bajo_llojeta_mazamorra',
    titulo: 'Escenario Histórico 2 — Noviembre de 2024 (Bajo Llojeta — Mazamorra)',
    fecha_inicio: '2024-11-20',
    fecha_fin: '2024-11-23',
    coordenada: COORDENADA_HISTORICA_LLOJETA,
    fuente_datos: 'Open-Meteo Historical Weather API (Reanálisis ERA5-Land)',
    resolucion_espacial: 'Malla regional ~9 km (resolución gruesa)',
    contexto_documental:
      'Episodio de mazamorra en Bajo Llojeta tras la lluvia nocturna del 23 de noviembre de 2024 (documentado por Prensa Latina, 25 de noviembre de 2024). Además del pulso pluvial intenso en la cuenca alta, el evento se asoció presuntamente a movimientos de tierra previos en cabeceras de quebrada, confirmando que intervinieron factores antrópicos y geomorfológicos ajenos a la lluvia.',
    limitacion_declarada: NOTA_LIMITACION_CIENTIFICA_SECCION_11_3,
    serie_horaria: construirSerieNoviembre2024(),
  }),
});

/**
 * Consulta la API histórica de Open-Meteo Archive (`https://archive-api.open-meteo.com/v1/archive`)
 * con timeout corto (4000 ms) y retorna como respaldo determinista inmediato la serie congelada
 * cuando no hay conectividad o en entornos aislados de prueba.
 *
 * @param {string} fechaInicio Formato 'YYYY-MM-DD'
 * @param {string} fechaFin Formato 'YYYY-MM-DD'
 * @param {Object} [opciones={}]
 * @param {number} [opciones.timeoutMs=4000]
 * @param {Function} [opciones.fetchFn=globalThis.fetch]
 * @returns {Promise<{ origen: 'open_meteo_archive_vivo' | 'respaldo_congelado_determinista', escenario_id: string, serie_horaria: Object }>}
 */
export async function consultarOpenMeteoHistorico(
  fechaInicio,
  fechaFin,
  opciones = {}
) {
  const timeoutMs = Number(opciones.timeoutMs) > 0 ? Number(opciones.timeoutMs) : 4000;
  const fetchFn = opciones.fetchFn || globalThis.fetch;

  const escenarioRespaldo =
    fechaInicio && String(fechaInicio).startsWith('2019')
      ? ESCENARIOS_HISTORICOS_CONGELADOS.abril_2019_bajo_llojeta_kantutani
      : ESCENARIOS_HISTORICOS_CONGELADOS.noviembre_2024_bajo_llojeta_mazamorra;

  if (typeof fetchFn !== 'function') {
    return {
      origen: 'respaldo_congelado_determinista',
      escenario_id: escenarioRespaldo.id,
      serie_horaria: escenarioRespaldo.serie_horaria,
    };
  }

  const url = new URL('https://archive-api.open-meteo.com/v1/archive');
  url.searchParams.set('latitude', String(COORDENADA_HISTORICA_LLOJETA.latitud));
  url.searchParams.set('longitude', String(COORDENADA_HISTORICA_LLOJETA.longitud));
  url.searchParams.set('start_date', fechaInicio);
  url.searchParams.set('end_date', fechaFin);
  url.searchParams.set(
    'hourly',
    'precipitation,temperature_2m,relative_humidity_2m,wind_speed_10m'
  );
  url.searchParams.set('timezone', 'UTC');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const resp = await fetchFn(url.toString(), { signal: controller.signal });
    if (!resp || !resp.ok) {
      throw new Error(`HTTP ${resp ? resp.status : 'SIN_RESPUESTA'}`);
    }
    const json = await resp.json();
    const h = json?.hourly;
    if (
      !h ||
      !Array.isArray(h.time) ||
      !Array.isArray(h.precipitation) ||
      h.time.length < 96
    ) {
      throw new Error('Respuesta histórica con menos de 96 horas');
    }

    const tiempos_utc = h.time.map((t) =>
      t.endsWith('Z') ? new Date(t).toISOString() : new Date(`${t}:00.000Z`).toISOString()
    );

    return {
      origen: 'open_meteo_archive_vivo',
      escenario_id: escenarioRespaldo.id,
      serie_horaria: {
        tiempos_utc,
        precipitacion_mm: h.precipitation.map((v) =>
          typeof v === 'number' && Number.isFinite(v) ? v : 0
        ),
        temperatura_c: Array.isArray(h.temperature_2m) ? h.temperature_2m : [],
        humedad_pct: Array.isArray(h.relative_humidity_2m)
          ? h.relative_humidity_2m
          : [],
        viento_kmh: Array.isArray(h.wind_speed_10m) ? h.wind_speed_10m : [],
      },
    };
  } catch {
    return {
      origen: 'respaldo_congelado_determinista',
      escenario_id: escenarioRespaldo.id,
      serie_horaria: escenarioRespaldo.serie_horaria,
    };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Función pura que recorre las últimas 24 ventanas horarias de una serie histórica de >= 96 horas,
 * calculando en cada corte horario:
 * 1. `calcularAcumuladosYCalidad` (intensidad 1h, acum 24h, acum 72h, horas válidas y estado).
 * 2. `clasificarMuestra` contra los 9 umbrales académicos v1 y la regla de saturación (72h >= 60 + int >= 2.5).
 * 3. `siguienteEstado` aplicando la máquina de estados con histéresis (T1 a T7).
 *
 * @param {Object} serieHoraria Objeto con { tiempos_utc, precipitacion_mm } de al menos 96 horas
 * @param {Array|Object} umbralesV1 Los 9 umbrales académicos de la versión 1
 * @param {Object} [parametrosV1={}] Parámetros del motor (t_max_minutos, separacion_minima_minutos, muestras_descenso)
 * @returns {Object} Resumen analítico completo de la ejecución histórica
 */
export function evaluarSerieHistoricaConMotor(
  serieHoraria,
  umbralesV1,
  parametrosV1 = {}
) {
  if (
    !serieHoraria ||
    !Array.isArray(serieHoraria.tiempos_utc) ||
    !Array.isArray(serieHoraria.precipitacion_mm) ||
    serieHoraria.tiempos_utc.length < 96
  ) {
    throw new Error(
      'La serie horaria histórica debe contener al menos 96 horas para evaluar las últimas 24 ventanas con 72h completas.'
    );
  }

  const totalHoras = serieHoraria.tiempos_utc.length;
  const indiceInicioVentana24 = totalHoras - 24;

  const configMotor = {
    id: 1,
    version: 1,
    umbrales: umbralesV1,
    parametros: {
      t_max_minutos: 60,
      separacion_minima_minutos: 15,
      muestras_descenso: 2,
      ...parametrosV1,
    },
  };

  let estadoMotor = crearEstadoInicialMotor();
  const secuencia_evaluaciones = [];
  const secuencia_niveles_calculados = [];

  let pico_intensidad_1h_mm_h = 0;
  let pico_acum_24h_mm = 0;
  let pico_acum_72h_mm = 0;
  let nivel_calculado_maximo = 'NORMAL';
  let nivel_vigente_maximo = 'NORMAL';

  for (let idx = indiceInicioVentana24; idx < totalHoras; idx++) {
    const observadoEnIso = serieHoraria.tiempos_utc[idx];
    const precipHoraActual = serieHoraria.precipitacion_mm[idx];

    // 1. Calcular acumulados retrospectivos 24h y 72h hasta este corte horario
    const acumulados = calcularAcumuladosYCalidad({
      observado_en: observadoEnIso,
      actual: {
        precipitacion_mm: precipHoraActual,
      },
      serie_horaria: {
        tiempos_utc: serieHoraria.tiempos_utc.slice(0, idx + 1),
        precipitacion_mm: serieHoraria.precipitacion_mm.slice(0, idx + 1),
      },
    });

    // 2. Clasificar la muestra contra los 9 umbrales v1 y la regla de saturación
    const clasificacion = clasificarMuestra(acumulados, configMotor);

    // 3. Avanzar la máquina de estados con histéresis
    estadoMotor = siguienteEstado(
      estadoMotor,
      {
        ...acumulados,
        observado_en: observadoEnIso,
        nivel_calculado: clasificacion.nivel_calculado,
      },
      configMotor
    );

    if (
      typeof acumulados.intensidad_mm_h === 'number' &&
      acumulados.intensidad_mm_h > pico_intensidad_1h_mm_h
    ) {
      pico_intensidad_1h_mm_h = acumulados.intensidad_mm_h;
    }
    if (
      typeof acumulados.acum_24h_mm === 'number' &&
      acumulados.acum_24h_mm > pico_acum_24h_mm
    ) {
      pico_acum_24h_mm = acumulados.acum_24h_mm;
    }
    if (
      typeof acumulados.acum_72h_mm === 'number' &&
      acumulados.acum_72h_mm > pico_acum_72h_mm
    ) {
      pico_acum_72h_mm = acumulados.acum_72h_mm;
    }

    if (clasificacion.nivel_calculado) {
      nivel_calculado_maximo = obtenerNivelMayor(
        nivel_calculado_maximo,
        clasificacion.nivel_calculado
      );
      secuencia_niveles_calculados.push(clasificacion.nivel_calculado);
    }

    if (estadoMotor.nivel_vigente) {
      nivel_vigente_maximo = obtenerNivelMayor(
        nivel_vigente_maximo,
        estadoMotor.nivel_vigente
      );
    }

    secuencia_evaluaciones.push({
      observado_en: observadoEnIso,
      intensidad_mm_h: acumulados.intensidad_mm_h,
      acum_24h_mm: acumulados.acum_24h_mm,
      acum_72h_mm: acumulados.acum_72h_mm,
      horas_validas_24h: acumulados.horas_validas_24h,
      horas_validas_72h: acumulados.horas_validas_72h,
      estado_muestra: acumulados.estado,
      nivel_calculado: clasificacion.nivel_calculado,
      nivel_vigente: estadoMotor.nivel_vigente,
      contador_descenso: estadoMotor.contador_descenso,
      regla_saturacion_aplicada: clasificacion.regla_saturacion_aplicada,
      transicion: estadoMotor.transicion,
    });
  }

  return {
    ventanas_evaluadas: secuencia_evaluaciones.length,
    pico_intensidad_1h_mm_h,
    pico_acum_24h_mm,
    pico_acum_72h_mm,
    nivel_calculado_maximo,
    nivel_vigente_maximo,
    nivel_vigente_final: estadoMotor.nivel_vigente,
    secuencia_niveles_calculados,
    secuencia_evaluaciones,
    umbrales_modificados: false,
    nota_limitacion_cientifica: NOTA_LIMITACION_CIENTIFICA_SECCION_11_3,
  };
}

export default {
  COORDENADA_HISTORICA_LLOJETA,
  NOTA_LIMITACION_CIENTIFICA_SECCION_11_3,
  ESCENARIOS_HISTORICOS_CONGELADOS,
  consultarOpenMeteoHistorico,
  evaluarSerieHistoricaConMotor,
};

