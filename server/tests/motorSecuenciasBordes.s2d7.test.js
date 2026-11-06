/**
 * @file motorSecuenciasBordes.s2d7.test.js
 * @description Suite integral de secuencias largas y casos borde combinados del motor de reglas de PUKARA.
 * Certifica:
 * - Secuencia temporal multihas de 12 horas con transiciones T1, T2, T3, T4, T5, T7 y saturación P17.
 * - Casos límite de T_max al milisegundo y recuperación T7 tras DATOS_DESACTUALIZADOS (P15).
 * - Manejo riguroso de series con huecos horarios (P02), exclusión de variables incompletas y exposición E2E.
 */

import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { pool } from '../src/db/pool.js';
import {
  ESTADOS_SISTEMA,
  REGLAS_TRANSICION,
  crearEstadoInicialMotor,
  siguienteEstado,
  ejecutarSecuenciaMuestras,
  derivarEstadoAlConsultar,
} from '../src/engine/estado.js';
import {
  clasificarMuestra,
  NIVELES_INFORMATIVOS,
} from '../src/engine/clasificar.js';
import { calcularAcumuladosYCalidad } from '../src/engine/acumulados.js';
import {
  limpiarCacheLecturas,
  insertarLecturaMeteorologica,
} from '../src/services/lecturas.service.js';
import { evaluarLecturaConConfiguracionVigente } from '../src/services/evaluaciones.service.js';
import { consultarOpenMeteo } from '../src/services/openMeteo.js';

// Mockear el cliente Open-Meteo para aislar completamente las pruebas HTTP sin llamadas a internet
vi.mock('../src/services/openMeteo.js', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    consultarOpenMeteo: vi.fn(),
  };
});

/**
 * Configuración canónica académica V1 de PUKARA para funciones puras.
 */
const CONFIG_ACADEMICA_V1 = Object.freeze({
  id: 1,
  version: 1,
  umbrales: {
    intensidad_mm_h: { PRECAUCION: 2.5, ALERTA: 6.5, EMERGENCIA: 12.0 },
    acum_24h_mm: { PRECAUCION: 10.0, ALERTA: 25.0, EMERGENCIA: 40.0 },
    acum_72h_mm: { PRECAUCION: 25.0, ALERTA: 60.0, EMERGENCIA: 90.0 },
  },
  parametros: {
    t_max_minutos: 60,
    separacion_minima_minutos: 15,
    muestras_descenso: 2,
    saturacion: {
      habilitada: true,
      acum_72h_min_mm: 60,
      intensidad_min_mm_h: 2.5,
      nivel_minimo: 'ALERTA',
    },
  },
});

/**
 * Limpia registros temporales de prueba y garantiza que la configuración v1 permanezca vigente.
 */
async function limpiarBD() {
  limpiarCacheLecturas();
  await pool.query('DELETE FROM evaluaciones_nivel;');
  await pool.query('DELETE FROM lecturas_meteorologicas;');
  await pool.query(
    "UPDATE configuraciones_reglas SET estado = 'vigente' WHERE version = 1;"
  );
}

describe('Semana 2 - Día 7 (Fase A): Secuencias Largas y Casos Borde del Motor (motorSecuenciasBordes.s2d7.test.js)', () => {
  beforeEach(async () => {
    await limpiarBD();
    vi.clearAllMocks();
  });

  afterAll(async () => {
    await limpiarBD();
  });

  // ==========================================================================
  // BLOQUE 1: Secuencia Larga de 12 Horas Simulada Paso a Paso
  // ==========================================================================
  describe('Bloque 1: Secuencia Larga de 12 Horas Simulada Paso a Paso (T1, T2, T3, T4, T5, T7 y Saturación P17)', () => {
    it('ejecuta paso a paso la tormenta completa de 12 horas en Llojeta con ascensos, saturación, fallos, repuntes y descensos escalonados', () => {
      // ----------------------------------------------------------------------
      // Paso 0: Arranque del sistema sin evaluaciones previas
      // ----------------------------------------------------------------------
      const estado0 = crearEstadoInicialMotor();
      expect(estado0.estado_sistema).toBe(ESTADOS_SISTEMA.SIN_DATOS);
      expect(estado0.nivel_vigente).toBeNull();
      expect(estado0.contador_descenso).toBe(0);
      expect(estado0.candidato_descenso_maximo).toBeNull();

      // ----------------------------------------------------------------------
      // Paso 1: 08:00Z - Lluvia leve (1.0 mm/h, 24h: 4.0 mm, 72h: 10.0 mm)
      // Recuperación directa T7 -> NORMAL sin histéresis
      // ----------------------------------------------------------------------
      const m1 = {
        observado_en: '2026-03-10T08:00:00.000Z',
        intensidad_mm_h: 1.0,
        acum_24h_mm: 4.0,
        acum_72h_mm: 10.0,
        horas_validas_24h: 24,
        horas_validas_72h: 72,
      };
      const estado1 = siguienteEstado(estado0, m1, CONFIG_ACADEMICA_V1);
      expect(estado1.transicion).toBe(REGLAS_TRANSICION.T7_RECUPERACION);
      expect(estado1.nivel_vigente).toBe(NIVELES_INFORMATIVOS.NORMAL);
      expect(estado1.estado_sistema).toBe(NIVELES_INFORMATIVOS.NORMAL);
      expect(estado1.ultimo_nivel_calculado).toBe(NIVELES_INFORMATIVOS.NORMAL);
      expect(estado1.contador_descenso).toBe(0);
      expect(estado1.evaluacion_creada).toBe(true);

      // ----------------------------------------------------------------------
      // Paso 2: 09:00Z - Ascenso a PRECAUCIÓN (3.0 mm/h >= 2.5 mm/h)
      // Ascenso inmediato T1
      // ----------------------------------------------------------------------
      const m2 = {
        observado_en: '2026-03-10T09:00:00.000Z',
        intensidad_mm_h: 3.0,
        acum_24h_mm: 12.0,
        acum_72h_mm: 28.0,
        horas_validas_24h: 24,
        horas_validas_72h: 72,
      };
      const estado2 = siguienteEstado(estado1, m2, CONFIG_ACADEMICA_V1);
      expect(estado2.transicion).toBe(REGLAS_TRANSICION.T1_ASCENSO);
      expect(estado2.nivel_vigente).toBe(NIVELES_INFORMATIVOS.PRECAUCION);
      expect(estado2.ultimo_nivel_calculado).toBe(NIVELES_INFORMATIVOS.PRECAUCION);
      expect(estado2.contador_descenso).toBe(0);
      expect(estado2.evaluacion_creada).toBe(true);

      // ----------------------------------------------------------------------
      // Paso 3: 09:08Z - Muestra NO independiente (separación 8 min < 15 min)
      // Muestra ignorada
      // ----------------------------------------------------------------------
      const m3 = {
        observado_en: '2026-03-10T09:08:00.000Z',
        intensidad_mm_h: 0.0,
        acum_24h_mm: 12.0,
        acum_72h_mm: 28.0,
        horas_validas_24h: 24,
        horas_validas_72h: 72,
      };
      const estado3 = siguienteEstado(estado2, m3, CONFIG_ACADEMICA_V1);
      expect(estado3.transicion).toBe(REGLAS_TRANSICION.IGNORADA_NO_INDEPENDIENTE);
      expect(estado3.nivel_vigente).toBe(NIVELES_INFORMATIVOS.PRECAUCION);
      expect(estado3.contador_descenso).toBe(0);
      expect(estado3.evaluacion_creada).toBe(false);
      expect(estado3.ultimo_observado_en).toBe('2026-03-10T09:00:00.000Z');

      // ----------------------------------------------------------------------
      // Paso 4: 10:00Z - Regla de saturación P17 (intensidad: 2.6 mm/h + acum_72h: 60.0 mm)
      // Sube a ALERTA por saturación forzada de suelo (T1)
      // ----------------------------------------------------------------------
      const m4 = {
        observado_en: '2026-03-10T10:00:00.000Z',
        intensidad_mm_h: 2.6,
        acum_24h_mm: 15.0,
        acum_72h_mm: 60.0,
        horas_validas_24h: 24,
        horas_validas_72h: 72,
      };
      const estado4 = siguienteEstado(estado3, m4, CONFIG_ACADEMICA_V1);
      expect(estado4.transicion).toBe(REGLAS_TRANSICION.T1_ASCENSO);
      expect(estado4.nivel_vigente).toBe(NIVELES_INFORMATIVOS.ALERTA);
      expect(estado4.clasificacion?.regla_saturacion_aplicada).toBe(true);
      expect(estado4.contador_descenso).toBe(0);
      expect(estado4.evaluacion_creada).toBe(true);

      // ----------------------------------------------------------------------
      // Paso 5: 11:00Z - Salto brusco a EMERGENCIA (intensidad: 13.5 mm/h >= 12.0 mm/h)
      // Ascenso inmediato T1
      // ----------------------------------------------------------------------
      const m5 = {
        observado_en: '2026-03-10T11:00:00.000Z',
        intensidad_mm_h: 13.5,
        acum_24h_mm: 35.0,
        acum_72h_mm: 75.0,
        horas_validas_24h: 24,
        horas_validas_72h: 72,
      };
      const estado5 = siguienteEstado(estado4, m5, CONFIG_ACADEMICA_V1);
      expect(estado5.transicion).toBe(REGLAS_TRANSICION.T1_ASCENSO);
      expect(estado5.nivel_vigente).toBe(NIVELES_INFORMATIVOS.EMERGENCIA);
      expect(estado5.contador_descenso).toBe(0);
      expect(estado5.evaluacion_creada).toBe(true);

      // ----------------------------------------------------------------------
      // Paso 6: 12:00Z - Primera muestra inferior (intensidad 7.0 mm/h -> calculado ALERTA)
      // Descenso pendiente (muestra 1 de 2, mantiene EMERGENCIA)
      // ----------------------------------------------------------------------
      const m6 = {
        observado_en: '2026-03-10T12:00:00.000Z',
        intensidad_mm_h: 7.0,
        acum_24h_mm: 20.0,
        acum_72h_mm: 40.0,
        horas_validas_24h: 24,
        horas_validas_72h: 72,
      };
      const estado6 = siguienteEstado(estado5, m6, CONFIG_ACADEMICA_V1);
      expect(estado6.transicion).toBe(REGLAS_TRANSICION.T3_DESCENSO_PENDIENTE);
      expect(estado6.nivel_vigente).toBe(NIVELES_INFORMATIVOS.EMERGENCIA);
      expect(estado6.ultimo_nivel_calculado).toBe(NIVELES_INFORMATIVOS.ALERTA);
      expect(estado6.candidato_descenso_maximo).toBe(NIVELES_INFORMATIVOS.ALERTA);
      expect(estado6.contador_descenso).toBe(1);
      expect(estado6.evaluacion_creada).toBe(true);

      // ----------------------------------------------------------------------
      // Paso 7: 12:30Z - Fallo de API / muestra inválida
      // T5 sin alterar estado ni contador de descenso
      // ----------------------------------------------------------------------
      const m7 = {
        observado_en: '2026-03-10T12:30:00.000Z',
        fallo_api: true,
      };
      const estado7 = siguienteEstado(estado6, m7, CONFIG_ACADEMICA_V1);
      expect(estado7.transicion).toBe(REGLAS_TRANSICION.T5_SIN_MUESTRA_VALIDA);
      expect(estado7.nivel_vigente).toBe(NIVELES_INFORMATIVOS.EMERGENCIA);
      expect(estado7.candidato_descenso_maximo).toBe(NIVELES_INFORMATIVOS.ALERTA);
      expect(estado7.contador_descenso).toBe(1);
      expect(estado7.evaluacion_creada).toBe(false);

      // ----------------------------------------------------------------------
      // Paso 8: 13:00Z - Repunte a EMERGENCIA (intensidad: 12.0 mm/h)
      // T4 reinicio de contador a 0 y mantiene EMERGENCIA
      // ----------------------------------------------------------------------
      const m8 = {
        observado_en: '2026-03-10T13:00:00.000Z',
        intensidad_mm_h: 12.0,
        acum_24h_mm: 25.0,
        acum_72h_mm: 50.0,
        horas_validas_24h: 24,
        horas_validas_72h: 72,
      };
      const estado8 = siguienteEstado(estado7, m8, CONFIG_ACADEMICA_V1);
      expect(estado8.transicion).toBe(REGLAS_TRANSICION.T4_REINICIO_CONTADOR);
      expect(estado8.nivel_vigente).toBe(NIVELES_INFORMATIVOS.EMERGENCIA);
      expect(estado8.ultimo_nivel_calculado).toBe(NIVELES_INFORMATIVOS.EMERGENCIA);
      expect(estado8.contador_descenso).toBe(0);
      expect(estado8.candidato_descenso_maximo).toBeNull();
      expect(estado8.evaluacion_creada).toBe(true);

      // ----------------------------------------------------------------------
      // Paso 9: 14:00Z - Nueva primera muestra inferior (intensidad: 3.5 mm/h -> PRECAUCIÓN)
      // T3 descenso pendiente (muestra 1 de 2)
      // ----------------------------------------------------------------------
      const m9 = {
        observado_en: '2026-03-10T14:00:00.000Z',
        intensidad_mm_h: 3.5,
        acum_24h_mm: 12.0,
        acum_72h_mm: 20.0,
        horas_validas_24h: 24,
        horas_validas_72h: 72,
      };
      const estado9 = siguienteEstado(estado8, m9, CONFIG_ACADEMICA_V1);
      expect(estado9.transicion).toBe(REGLAS_TRANSICION.T3_DESCENSO_PENDIENTE);
      expect(estado9.nivel_vigente).toBe(NIVELES_INFORMATIVOS.EMERGENCIA);
      expect(estado9.ultimo_nivel_calculado).toBe(NIVELES_INFORMATIVOS.PRECAUCION);
      expect(estado9.candidato_descenso_maximo).toBe(NIVELES_INFORMATIVOS.PRECAUCION);
      expect(estado9.contador_descenso).toBe(1);
      expect(estado9.evaluacion_creada).toBe(true);

      // ----------------------------------------------------------------------
      // Paso 10: 15:00Z - Segunda muestra inferior consecutiva (NORMAL, 0.5 mm/h)
      // T3 descenso completado hacia el MAYOR de los dos calculados (PRECAUCIÓN, no a NORMAL)
      // ----------------------------------------------------------------------
      const m10 = {
        observado_en: '2026-03-10T15:00:00.000Z',
        intensidad_mm_h: 0.5,
        acum_24h_mm: 2.0,
        acum_72h_mm: 5.0,
        horas_validas_24h: 24,
        horas_validas_72h: 72,
      };
      const estado10 = siguienteEstado(estado9, m10, CONFIG_ACADEMICA_V1);
      expect(estado10.transicion).toBe(REGLAS_TRANSICION.T3_DESCENSO_COMPLETADO);
      expect(estado10.nivel_vigente).toBe(NIVELES_INFORMATIVOS.PRECAUCION);
      expect(estado10.estado_sistema).toBe(NIVELES_INFORMATIVOS.PRECAUCION);
      expect(estado10.ultimo_nivel_calculado).toBe(NIVELES_INFORMATIVOS.NORMAL);
      expect(estado10.contador_descenso).toBe(0);
      expect(estado10.candidato_descenso_maximo).toBeNull();
      expect(estado10.evaluacion_creada).toBe(true);

      // ----------------------------------------------------------------------
      // Paso 11: 16:00Z y 17:00Z - Dos muestras consecutivas NORMAL
      // 16:00Z -> contador 1 manteniendo PRECAUCIÓN; 17:00Z -> desciende a NORMAL
      // ----------------------------------------------------------------------
      const m11 = {
        observado_en: '2026-03-10T16:00:00.000Z',
        intensidad_mm_h: 0.2,
        acum_24h_mm: 1.0,
        acum_72h_mm: 3.0,
        horas_validas_24h: 24,
        horas_validas_72h: 72,
      };
      const estado11 = siguienteEstado(estado10, m11, CONFIG_ACADEMICA_V1);
      expect(estado11.transicion).toBe(REGLAS_TRANSICION.T3_DESCENSO_PENDIENTE);
      expect(estado11.nivel_vigente).toBe(NIVELES_INFORMATIVOS.PRECAUCION);
      expect(estado11.candidato_descenso_maximo).toBe(NIVELES_INFORMATIVOS.NORMAL);
      expect(estado11.contador_descenso).toBe(1);

      const m12 = {
        observado_en: '2026-03-10T17:00:00.000Z',
        intensidad_mm_h: 0.1,
        acum_24h_mm: 0.5,
        acum_72h_mm: 2.0,
        horas_validas_24h: 24,
        horas_validas_72h: 72,
      };
      const estado12 = siguienteEstado(estado11, m12, CONFIG_ACADEMICA_V1);
      expect(estado12.transicion).toBe(REGLAS_TRANSICION.T3_DESCENSO_COMPLETADO);
      expect(estado12.nivel_vigente).toBe(NIVELES_INFORMATIVOS.NORMAL);
      expect(estado12.estado_sistema).toBe(NIVELES_INFORMATIVOS.NORMAL);
      expect(estado12.contador_descenso).toBe(0);
      expect(estado12.candidato_descenso_maximo).toBeNull();
    });

    it('verifica consistencia idéntica ejecutando la secuencia acumulativa mediante ejecutarSecuenciaMuestras', () => {
      const secuencia = [
        {
          observado_en: '2026-03-10T08:00:00.000Z',
          intensidad_mm_h: 1.0,
          acum_24h_mm: 4.0,
          acum_72h_mm: 10.0,
          horas_validas_24h: 24,
          horas_validas_72h: 72,
        },
        {
          observado_en: '2026-03-10T09:00:00.000Z',
          intensidad_mm_h: 3.0,
          acum_24h_mm: 12.0,
          acum_72h_mm: 28.0,
          horas_validas_24h: 24,
          horas_validas_72h: 72,
        },
        {
          observado_en: '2026-03-10T11:00:00.000Z',
          intensidad_mm_h: 13.5,
          acum_24h_mm: 35.0,
          acum_72h_mm: 75.0,
          horas_validas_24h: 24,
          horas_validas_72h: 72,
        },
      ];

      const { estadoFinal, historialPasos } = ejecutarSecuenciaMuestras(
        secuencia,
        CONFIG_ACADEMICA_V1
      );

      expect(historialPasos).toHaveLength(3);
      expect(historialPasos[0].transicion).toBe(REGLAS_TRANSICION.T7_RECUPERACION);
      expect(historialPasos[1].transicion).toBe(REGLAS_TRANSICION.T1_ASCENSO);
      expect(historialPasos[2].transicion).toBe(REGLAS_TRANSICION.T1_ASCENSO);
      expect(estadoFinal.nivel_vigente).toBe(NIVELES_INFORMATIVOS.EMERGENCIA);
    });
  });

  // ==========================================================================
  // BLOQUE 2: Casos Borde Exactos de T_max y Recuperación (T6 y T7 — Prueba P15)
  // ==========================================================================
  describe('Bloque 2: Casos Borde Exactos de T_max y Recuperación (T6 y T7 — Prueba P15)', () => {
    const evaluacionAlerta = {
      id: 50,
      nivel_vigente: NIVELES_INFORMATIVOS.ALERTA,
      estado_sistema: NIVELES_INFORMATIVOS.ALERTA,
      observado_en: '2026-03-10T10:00:00.000Z',
      contador_descenso: 0,
    };

    it('2.1. A los 59 min 59 s (< 60 min) la muestra sigue plenamente vigente', () => {
      const res = derivarEstadoAlConsultar(evaluacionAlerta, {
        ahora: '2026-03-10T10:59:59.000Z',
        t_max_minutos: 60,
        modalidad: 'real',
      });

      expect(res.estado_sistema).toBe(NIVELES_INFORMATIVOS.ALERTA);
      expect(res.nivel_vigente).toBe(NIVELES_INFORMATIVOS.ALERTA);
      expect(res.datos_desactualizados).toBe(false);
      expect(res.transicion_consulta).toBe('VIGENTE');
      expect(res.antiguedad_minutos).toBe(59.98);
    });

    it('2.2. A los exactos 60 min (60.00 min === 60 min) el límite superior se considera aún vigente', () => {
      const res = derivarEstadoAlConsultar(evaluacionAlerta, {
        ahora: '2026-03-10T11:00:00.000Z',
        t_max_minutos: 60,
        modalidad: 'real',
      });

      expect(res.estado_sistema).toBe(NIVELES_INFORMATIVOS.ALERTA);
      expect(res.nivel_vigente).toBe(NIVELES_INFORMATIVOS.ALERTA);
      expect(res.datos_desactualizados).toBe(false);
      expect(res.transicion_consulta).toBe('VIGENTE');
      expect(res.antiguedad_minutos).toBe(60.0);
    });

    it('2.3. A los 61 min (> 60 min) transiciona a DATOS_DESACTUALIZADOS conservando ALERTA sin degradar a NORMAL (P15)', () => {
      const res = derivarEstadoAlConsultar(evaluacionAlerta, {
        ahora: '2026-03-10T11:01:00.000Z',
        t_max_minutos: 60,
        modalidad: 'real',
      });

      expect(res.estado_sistema).toBe(ESTADOS_SISTEMA.DATOS_DESACTUALIZADOS);
      expect(res.datos_desactualizados).toBe(true);
      expect(res.nivel_vigente).toBe(NIVELES_INFORMATIVOS.ALERTA);
      expect(res.ultimo_nivel_conocido).toBe(NIVELES_INFORMATIVOS.ALERTA);
      expect(res.transicion_consulta).toBe('T6_VENCIMIENTO');
      expect(res.antiguedad_minutos).toBe(61.0);
      expect(res.estado_sistema).not.toBe(NIVELES_INFORMATIVOS.NORMAL);
    });

    it('2.4. Recuperación directa T7: primera muestra válida tras DATOS_DESACTUALIZADOS fija nivel sin exigir histéresis previa', () => {
      const estadoVencido = {
        estado_sistema: ESTADOS_SISTEMA.DATOS_DESACTUALIZADOS,
        nivel_vigente: NIVELES_INFORMATIVOS.ALERTA,
        ultimo_nivel_calculado: NIVELES_INFORMATIVOS.ALERTA,
        contador_descenso: 1,
        ultimo_observado_en: '2026-03-10T10:00:00.000Z',
      };

      const muestraRecuperacion = {
        observado_en: '2026-03-10T12:00:00.000Z',
        intensidad_mm_h: 0.5,
        acum_24h_mm: 1.0,
        acum_72h_mm: 2.0,
        horas_validas_24h: 24,
        horas_validas_72h: 72,
      };

      const resRecuperacion = siguienteEstado(
        estadoVencido,
        muestraRecuperacion,
        CONFIG_ACADEMICA_V1
      );

      expect(resRecuperacion.transicion).toBe(REGLAS_TRANSICION.T7_RECUPERACION);
      expect(resRecuperacion.nivel_vigente).toBe(NIVELES_INFORMATIVOS.NORMAL);
      expect(resRecuperacion.estado_sistema).toBe(NIVELES_INFORMATIVOS.NORMAL);
      expect(resRecuperacion.contador_descenso).toBe(0);
      expect(resRecuperacion.candidato_descenso_maximo).toBeNull();
      expect(resRecuperacion.evaluacion_creada).toBe(true);
    });
  });

  // ==========================================================================
  // BLOQUE 3: Auditoría de Regla de No Conversión de Nulos + Integración E2E
  // ==========================================================================
  describe('Bloque 3: Auditoría de Regla de No Conversión de Nulos + Integración E2E del Esqueleto (P02)', () => {
    it('3.1. calcularAcumuladosYCalidad detecta 1 hora nula en 72h, marca incompleta y jamás asume 0 mm', () => {
      const anclaIso = '2026-03-10T12:00:00.000Z';
      const tsAncla = Date.parse(anclaIso);
      const tiemposUtc = [];
      const precipitacionMm = [];

      for (let h = 79; h >= 0; h--) {
        const ts = tsAncla - h * 3_600_000;
        tiemposUtc.push(new Date(ts).toISOString());

        if (h === 0) {
          precipitacionMm.push(3.0);
        } else if (h < 24) {
          precipitacionMm.push(9.0 / 23);
        } else if (h === 50) {
          precipitacionMm.push(null);
        } else if (h < 72) {
          precipitacionMm.push(1.0);
        } else {
          precipitacionMm.push(0);
        }
      }

      const res = calcularAcumuladosYCalidad({
        observado_en: anclaIso,
        actual: { precipitacion_mm: 3.0 },
        serie_horaria: {
          tiempos_utc: tiemposUtc,
          precipitacion_mm: precipitacionMm,
        },
      });

      expect(res.estado).toBe('incompleta');
      expect(res.intensidad_mm_h).toBe(3.0);
      expect(res.acum_24h_mm).toBe(12.0);
      expect(res.horas_validas_24h).toBe(24);
      // CRÍTICO P02: jamás asumir 0 mm ante horas nulas
      expect(res.acum_72h_mm).toBeNull();
      expect(res.horas_validas_72h).toBe(71);
      expect(res.banderas_calidad.acum_24h_completo).toBe(true);
      expect(res.banderas_calidad.acum_72h_completo).toBe(false);
      expect(res.banderas_calidad.clasificacion_parcial).toBe(true);

      // Clasificación en memoria con ventana 72h excluida
      const resClasif = clasificarMuestra(res, CONFIG_ACADEMICA_V1);
      expect(resClasif.muestra_valida).toBe(true);
      expect(resClasif.nivel_calculado).toBe(NIVELES_INFORMATIVOS.PRECAUCION);
      expect(resClasif.clasificacion_parcial).toBe(true);
      expect(resClasif.variables_excluidas).toContain('acum_72h_mm');
    });

    it('3.2. Integración E2E en BD: lectura con acumulado 72h nulo se persiste con null y GET /api/estado expone clasificacion_parcial sin convertir a 0', async () => {
      // Simular fallo de Open-Meteo para forzar resiliencia T5 sobre base de datos
      consultarOpenMeteo.mockRejectedValue(new Error('Fallo simulado de red hacia Open-Meteo'));

      // 1. Insertar lectura con ventana 72h nula e incompleta
      const fechaReciente = new Date(Date.now() - 5 * 60 * 1000).toISOString();
      const { lectura } = await insertarLecturaMeteorologica({
        modalidad: 'real',
        fuente: 'test-s2d7-borde',
        observado_en: fechaReciente,
        intensidad_mm_h: 3.0,
        acum_24h_mm: 12.0,
        acum_72h_mm: null, // Nulo estricto en BD
        horas_validas_24h: 24,
        horas_validas_72h: 71,
        estado: 'incompleta',
      });

      expect(lectura.id).toBeDefined();
      expect(lectura.acum_72h_mm).toBeNull();

      // 2. Evaluar contra configuración vigente
      const resEval = await evaluarLecturaConConfiguracionVigente(lectura);
      expect(resEval.evaluacion.nivel_calculado).toBe(NIVELES_INFORMATIVOS.PRECAUCION);
      expect(resEval.clasificacion.clasificacion_parcial).toBe(true);

      // 3. Consultar endpoint HTTP público GET /api/estado
      const resHttp = await request(app)
        .get('/api/estado?modalidad=real')
        .expect('Content-Type', /json/)
        .expect(200);

      expect(resHttp.body.ok).toBe(true);
      expect(resHttp.body.clasificacion_parcial).toBe(true);
      expect(resHttp.body.nivel_calculado).toBe(NIVELES_INFORMATIVOS.PRECAUCION);
      expect(resHttp.body.nivel_vigente).toBe(NIVELES_INFORMATIVOS.PRECAUCION);

      // Verificación inquebrantable de no conversión a 0 mm
      expect(resHttp.body.lectura.acum_72h_mm).toBeNull();
      expect(resHttp.body.lectura.horas_validas_72h).toBe(71);
      expect(resHttp.body.meteorologia.lectura.acum_72h_mm).toBeNull();
      expect(resHttp.body.meteorologia.banderas_calidad.clasificacion_parcial).toBe(true);
    });
  });
});
