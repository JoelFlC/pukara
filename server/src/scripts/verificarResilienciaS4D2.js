/**
 * @file verificarResilienciaS4D2.js
 * @description Script reproducible de auditoría para el Día 2 de la Semana 4 (S4D2):
 * Demuestra y certifica de extremo a extremo contra PostgreSQL:
 *  - P02 (Datos faltantes / series incompletas: Casos 1A, 1B y 1C).
 *  - P03 y Transición T5 (Fallos consecutivos de Open-Meteo: Timeout, HTTP 503, JSON sin hourly
 *    en medio de histéresis con contador_descenso = 1 y consolidación posterior T3).
 *  - P11 (Aislamiento total entre Modo Simulación en los 4 niveles y el Estado Real).
 *
 * Restaura la base de datos a su estado limpio inicial al finalizar.
 */

import { pool } from '../db/pool.js';
import { limpiarCacheLecturas } from '../services/lecturas.service.js';
import { obtenerEstadoActualSistema } from '../services/estado.service.js';
import {
  registrarYEvaluarLecturaSimulada,
  limpiarDatosSimulados,
} from '../services/simulacion.service.js';
import {
  OpenMeteoError,
  validarYNormalizarRespuesta,
} from '../services/openMeteo.js';

const HORA_MS = 3_600_000;

function construirPayloadMeteo({ observadoEnIso, precipActual, generadorHora = () => 0.1 }) {
  const tsAncla = Math.floor(Date.parse(observadoEnIso) / HORA_MS) * HORA_MS;
  const tiemposUtc = [];
  const precipitacionMm = [];

  for (let k = 79; k >= 0; k--) {
    tiemposUtc.push(new Date(tsAncla - k * HORA_MS).toISOString());
    precipitacionMm.push(generadorHora(k));
  }

  return {
    fuente: 'Open-Meteo',
    observado_en: observadoEnIso,
    intervalo_actual_segundos: 900,
    actual: {
      precipitacion_mm: precipActual,
      temperatura_c: 13.0,
      humedad_pct: 74,
      viento_kmh: 9.0,
    },
    serie_horaria: {
      tiempos_utc: tiemposUtc,
      precipitacion_mm: precipitacionMm,
    },
  };
}

async function limpiarBaseDatos() {
  limpiarCacheLecturas();
  await pool.query('DELETE FROM evaluaciones_nivel;');
  await pool.query('DELETE FROM lecturas_meteorologicas;');
  await pool.query("UPDATE configuraciones_reglas SET estado = 'vigente' WHERE version = 1;");
}

async function ejecutarAuditoriaResiliencia() {
  const filasTabla = [];

  const registrarPaso = ({
    id,
    prueba,
    estadoInicial,
    perturbacion,
    nivelVigente,
    contadorDescenso,
    estadoLectura,
    ok,
  }) => {
    filasTabla.push({
      id,
      prueba,
      estadoInicial,
      perturbacion,
      nivelVigente: String(nivelVigente),
      contadorDescenso: String(contadorDescenso),
      estadoLectura: String(estadoLectura),
      resultado: ok ? '[PASS]' : '[FAIL]',
    });
    if (!ok) {
      throw new Error(
        `Fallo en ${id} (${prueba}): nivel=${nivelVigente}, contador=${contadorDescenso}, lectura=${estadoLectura}`
      );
    }
  };

  try {
    await limpiarBaseDatos();

    console.log('====================================================================================================================');
    console.log(' PUKARA — Auditoría Reproducible de Datos Faltantes (P02), Fallos de API (P03/T5) y Aislamiento (P11) [S4D2]');
    console.log(` Fecha/Hora UTC : ${new Date().toISOString()}`);
    console.log('====================================================================================================================\n');

    // ========================================================================
    // BLOQUE 1: P02 (Casos 1A, 1B y 1C)
    // ========================================================================
    // Caso 1A: 72h incompleta (horas_validas_72h = 62), 24h (28.8 mm -> ALERTA) e intensidad (3.0 -> PRECAUCION) completas
    limpiarCacheLecturas();
    const ts1A = new Date(Date.now() - 55 * 60 * 1000).toISOString();
    const estado1A = await obtenerEstadoActualSistema({
      modalidad: 'real',
      forzarConsultaExterna: true,
      consultarMeteoFn: async () =>
        construirPayloadMeteo({
          observadoEnIso: ts1A,
          precipActual: 3.0,
          generadorHora: (k) => (k >= 0 && k < 24 ? 1.2 : k >= 30 && k < 40 ? null : 0.4),
        }),
    });

    registrarPaso({
      id: 'S4D2-01',
      prueba: 'P02 (Caso 1A)',
      estadoInicial: 'SIN_DATOS',
      perturbacion: 'Huecos en 72h (62/72h), 24h=28.8mm, int=3.0',
      nivelVigente: estado1A.nivel_vigente,
      contadorDescenso: estado1A.contador_descenso,
      estadoLectura: `${estado1A.lectura?.estado} (72h=null)`,
      ok:
        estado1A.lectura?.estado === 'incompleta' &&
        estado1A.lectura?.acum_72h_mm === null &&
        estado1A.lectura?.acum_24h_mm === 28.8 &&
        estado1A.nivel_vigente === 'ALERTA' &&
        estado1A.clasificacion_parcial === true,
    });

    // Caso 1B: 24h y 72h incompletas, solo intensidad válida (2.8 mm/h -> PRECAUCION; como viene de ALERTA sube contador_descenso a 1)
    limpiarCacheLecturas();
    const ts1B = new Date(Date.now() - 35 * 60 * 1000).toISOString();
    const estado1B = await obtenerEstadoActualSistema({
      modalidad: 'real',
      forzarConsultaExterna: true,
      consultarMeteoFn: async () =>
        construirPayloadMeteo({
          observadoEnIso: ts1B,
          precipActual: 2.8,
          generadorHora: (k) => (k >= 4 && k <= 9 ? null : 0.2),
        }),
    });

    registrarPaso({
      id: 'S4D2-02',
      prueba: 'P02 (Caso 1B)',
      estadoInicial: 'ALERTA (cnt=0)',
      perturbacion: 'Huecos en 24h y 72h, solo int=2.8mm/h (PREC)',
      nivelVigente: estado1B.nivel_vigente,
      contadorDescenso: estado1B.contador_descenso,
      estadoLectura: `${estado1B.lectura?.estado} (24h/72h=null)`,
      ok:
        estado1B.lectura?.estado === 'incompleta' &&
        estado1B.lectura?.acum_24h_mm === null &&
        estado1B.lectura?.acum_72h_mm === null &&
        estado1B.nivel_vigente === 'ALERTA' &&
        estado1B.contador_descenso === 1 &&
        estado1B.clasificacion_parcial === true,
    });

    // Caso 1C: Muestra totalmente inválida (intensidad = null y huecos en 24h/72h) -> estado='invalida', preserva ALERTA (cnt=1)
    limpiarCacheLecturas();
    const ts1C = new Date(Date.now() - 20 * 60 * 1000).toISOString();
    const estado1C = await obtenerEstadoActualSistema({
      modalidad: 'real',
      forzarConsultaExterna: true,
      consultarMeteoFn: async () =>
        construirPayloadMeteo({
          observadoEnIso: ts1C,
          precipActual: null,
          generadorHora: (k) => (k < 25 ? null : 0.1),
        }),
    });

    registrarPaso({
      id: 'S4D2-03',
      prueba: 'P02 (Caso 1C)',
      estadoInicial: 'ALERTA (cnt=1)',
      perturbacion: 'Muestra sin variables completas (todas null)',
      nivelVigente: estado1C.nivel_vigente,
      contadorDescenso: estado1C.contador_descenso,
      estadoLectura: estado1C.lectura?.estado,
      ok:
        estado1C.lectura?.estado === 'invalida' &&
        estado1C.nivel_vigente === 'ALERTA' &&
        estado1C.contador_descenso === 1,
    });

    // ========================================================================
    // BLOQUE 2: P03 y Transición T5 (3 Fallos de Open-Meteo en histéresis cnt=1)
    // ========================================================================
    // Fallo (a): Timeout de red (ETIMEDOUT / AbortError)
    limpiarCacheLecturas();
    const estadoFalloA = await obtenerEstadoActualSistema({
      modalidad: 'real',
      forzarConsultaExterna: true,
      consultarMeteoFn: async () => {
        const err = new Error('ETIMEDOUT');
        err.name = 'AbortError';
        throw new OpenMeteoError('Timeout al consultar Open-Meteo', {
          codigo: 'TIMEOUT',
          causaOriginal: err,
        });
      },
    });

    registrarPaso({
      id: 'S4D2-04',
      prueba: 'P03 / T5 (a)',
      estadoInicial: 'ALERTA (cnt=1)',
      perturbacion: 'Fallo API Open-Meteo: Timeout / AbortError',
      nivelVigente: estadoFalloA.nivel_vigente,
      contadorDescenso: estadoFalloA.contador_descenso,
      estadoLectura: `respaldo (${estadoFalloA.antiguedad_minutos}m)`,
      ok:
        estadoFalloA.meteorologia?.fallo_api_reciente === true &&
        estadoFalloA.nivel_vigente === 'ALERTA' &&
        estadoFalloA.contador_descenso === 1,
    });

    // Fallo (b): Error HTTP 503 Service Unavailable
    limpiarCacheLecturas();
    const estadoFalloB = await obtenerEstadoActualSistema({
      modalidad: 'real',
      forzarConsultaExterna: true,
      consultarMeteoFn: async () => {
        throw new OpenMeteoError('HTTP 503 Service Unavailable', {
          codigo: 'HTTP_ERROR',
          statusHttp: 503,
        });
      },
    });

    registrarPaso({
      id: 'S4D2-05',
      prueba: 'P03 / T5 (b)',
      estadoInicial: 'ALERTA (cnt=1)',
      perturbacion: 'Fallo API Open-Meteo: HTTP 503 Unavailable',
      nivelVigente: estadoFalloB.nivel_vigente,
      contadorDescenso: estadoFalloB.contador_descenso,
      estadoLectura: `respaldo (${estadoFalloB.antiguedad_minutos}m)`,
      ok:
        estadoFalloB.meteorologia?.fallo_api_reciente === true &&
        estadoFalloB.nivel_vigente === 'ALERTA' &&
        estadoFalloB.contador_descenso === 1,
    });

    // Fallo (c): JSON malformado sin bloque hourly
    limpiarCacheLecturas();
    const estadoFalloC = await obtenerEstadoActualSistema({
      modalidad: 'real',
      forzarConsultaExterna: true,
      consultarMeteoFn: async () =>
        validarYNormalizarRespuesta({
          latitude: -16.525,
          longitude: -68.142,
          current: { time: new Date().toISOString(), interval: 900, precipitation: 1.0 },
        }),
    });

    registrarPaso({
      id: 'S4D2-06',
      prueba: 'P03 / T5 (c)',
      estadoInicial: 'ALERTA (cnt=1)',
      perturbacion: 'Fallo API Open-Meteo: JSON sin bloque hourly',
      nivelVigente: estadoFalloC.nivel_vigente,
      contadorDescenso: estadoFalloC.contador_descenso,
      estadoLectura: `respaldo (${estadoFalloC.antiguedad_minutos}m)`,
      ok:
        estadoFalloC.meteorologia?.fallo_api_reciente === true &&
        estadoFalloC.nivel_vigente === 'ALERTA' &&
        estadoFalloC.contador_descenso === 1,
    });

    // ========================================================================
    // BLOQUE 3: P11 (Aislamiento Simulación vs Real mientras Real está en ALERTA cnt=1)
    // ========================================================================
    const nivelesSim = [
      { nivel: 'NORMAL', int: 0.3, a24: 1.5, a72: 4.0, ts: '2026-03-12T10:00:00.000Z', reset: true },
      { nivel: 'PRECAUCION', int: 3.0, a24: 11.0, a72: 26.0, ts: '2026-03-12T10:30:00.000Z', reset: false },
      { nivel: 'ALERTA', int: 7.0, a24: 26.0, a72: 62.0, ts: '2026-03-12T11:00:00.000Z', reset: false },
      { nivel: 'EMERGENCIA', int: 13.5, a24: 44.0, a72: 94.0, ts: '2026-03-12T11:30:00.000Z', reset: false },
    ];

    for (const item of nivelesSim) {
      await registrarYEvaluarLecturaSimulada(
        {
          intensidad_mm_h: item.int,
          acum_24h_mm: item.a24,
          acum_72h_mm: item.a72,
          observado_en: item.ts,
          reiniciar_antes: item.reset,
        },
        { db: pool }
      );
    }

    const estadoSimFinal = await obtenerEstadoActualSistema({
      modalidad: 'simulada',
      ahora: '2026-03-12T11:35:00.000Z',
    });
    const estadoRealParalelo = await obtenerEstadoActualSistema({
      modalidad: 'real',
      forzarConsultaExterna: false,
      consultarMeteoFn: async () => {
        throw new OpenMeteoError('Sin llamada externa durante verificación de aislamiento P11', {
          codigo: 'TIMEOUT',
        });
      },
    });

    registrarPaso({
      id: 'S4D2-07',
      prueba: 'P11 (Sim vs Real)',
      estadoInicial: 'Real=ALERTA(cnt=1)',
      perturbacion: 'Inyección 4 niveles simulados (hasta EMERG)',
      nivelVigente: `Real:${estadoRealParalelo.nivel_vigente} / Sim:${estadoSimFinal.nivel_vigente}`,
      contadorDescenso: `Real:${estadoRealParalelo.contador_descenso} / Sim:${estadoSimFinal.contador_descenso}`,
      estadoLectura: 'aislada',
      ok:
        estadoSimFinal.nivel_vigente === 'EMERGENCIA' &&
        estadoRealParalelo.nivel_vigente === 'ALERTA' &&
        estadoRealParalelo.contador_descenso === 1,
    });

    await limpiarDatosSimulados({ db: pool });

    // ========================================================================
    // BLOQUE 4: Recuperación de Open-Meteo -> 2da muestra independiente consolida T3
    // ========================================================================
    limpiarCacheLecturas();
    const tsRecuperacion = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const estadoRecuperado = await obtenerEstadoActualSistema({
      modalidad: 'real',
      forzarConsultaExterna: true,
      consultarMeteoFn: async () =>
        construirPayloadMeteo({
          observadoEnIso: tsRecuperacion,
          precipActual: 2.9, // 2da muestra independiente en PRECAUCION -> consolida descenso T3
          generadorHora: () => 0.1,
        }),
    });

    registrarPaso({
      id: 'S4D2-08',
      prueba: 'P03 / T3 (Recup.)',
      estadoInicial: 'ALERTA (cnt=1)',
      perturbacion: '2da muestra válida independiente en PRECAUCION',
      nivelVigente: estadoRecuperado.nivel_vigente,
      contadorDescenso: estadoRecuperado.contador_descenso,
      estadoLectura: estadoRecuperado.lectura?.estado,
      ok:
        estadoRecuperado.meteorologia?.fallo_api_reciente === false &&
        estadoRecuperado.nivel_vigente === 'PRECAUCION' &&
        estadoRecuperado.contador_descenso === 0 &&
        estadoRecuperado.lectura?.estado === 'valida',
    });

    // Impresión de tabla resumen
    console.log(
      'ID      | Prueba            | Estado Inicial     | Perturbación Aplicada                        | Nivel Vigente            | Cnt Descenso    | Lectura              | Estado'
    );
    console.log(
      '--------+-------------------+--------------------+----------------------------------------------+--------------------------+-----------------+----------------------+-------'
    );
    for (const f of filasTabla) {
      console.log(
        `${f.id.padEnd(7)} | ${f.prueba.padEnd(17)} | ${f.estadoInicial.padEnd(18)} | ${f.perturbacion.padEnd(44)} | ${f.nivelVigente.padEnd(24)} | ${f.contadorDescenso.padEnd(15)} | ${f.estadoLectura.padEnd(20)} | ${f.resultado}`
      );
    }
    console.log(
      '-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------'
    );
    console.log(
      `Resultado Global S4D2: ${filasTabla.length}/${filasTabla.length} escenarios certificados con [PASS]. Base de datos restaurada a estado limpio.\n`
    );
  } finally {
    await limpiarBaseDatos();
    await pool.end();
  }
}

ejecutarAuditoriaResiliencia().catch((err) => {
  console.error(`\n[FAIL] Error en auditoría de resiliencia S4D2: ${err.message}`);
  process.exit(1);
});
