/**
 * @file estadoDerivadoYSimulacion.p15.p11.test.js
 * @description Suite de pruebas automatizadas para verificar las reglas oficiales
 * P15 (determinación pura de vigencia y vencimiento ante T_max con DATOS_DESACTUALIZADOS)
 * y P11 (aislamiento estricto entre modo simulación y estado real en PostgreSQL).
 */

import { describe, it, expect, beforeEach, afterEach, afterAll } from 'vitest';
import { pool } from '../src/db/pool.js';
import {
  ESTADOS_SISTEMA,
  derivarEstadoAlConsultar,
} from '../src/engine/estado.js';
import { obtenerConfiguracionVigente } from '../src/services/configuracion.service.js';
import {
  insertarLecturaMeteorologica,
  obtenerUltimaLecturaRegistrada,
} from '../src/services/lecturas.service.js';
import {
  obtenerUltimaEvaluacionPorModalidad,
  registrarYEvaluarLecturaSimulada,
  consultarEstadoPorModalidad,
  limpiarDatosSimulados,
  BANNER_SIMULACION,
} from '../src/services/simulacion.service.js';

/**
 * Limpia quirúrgicamente registros con fecha 2099, fuentes de test o modalidad simulada.
 */
async function limpiarRegistrosPruebaP11() {
  await pool.query(`
    DELETE FROM evaluaciones_nivel
    WHERE lectura_id IN (
      SELECT id FROM lecturas_meteorologicas
      WHERE observado_en >= '2099-01-01T00:00:00.000Z'
         OR fuente LIKE '%test-p11%'
         OR modalidad = 'simulada'
    );
  `);
  await pool.query(`
    DELETE FROM lecturas_meteorologicas
    WHERE observado_en >= '2099-01-01T00:00:00.000Z'
       OR fuente LIKE '%test-p11%'
       OR modalidad = 'simulada';
  `);
}

describe('Motor y Simulación PUKARA: Reglas P15 y P11 (estadoDerivadoYSimulacion.test.js)', () => {
  // ==========================================================================
  // BLOQUE 1: P15 — Pruebas Unitarias Puras de derivarEstadoAlConsultar
  // ==========================================================================
  describe('Bloque 1: Regla P15 — Determinación de Vigencia y Vencimiento (T6)', () => {
    it('1.1. Caso SIN_DATOS: Retorna SIN_DATOS cuando no existe ninguna evaluación o muestra previa', () => {
      const resNull = derivarEstadoAlConsultar(null, {
        ahora: '2026-03-01T12:00:00.000Z',
        t_max_minutos: 60,
      });

      expect(resNull.estado_sistema).toBe(ESTADOS_SISTEMA.SIN_DATOS);
      expect(resNull.nivel_vigente).toBeNull();
      expect(resNull.ultimo_nivel_conocido).toBeNull();
      expect(resNull.datos_desactualizados).toBe(false);
      expect(resNull.antiguedad_minutos).toBeNull();
      expect(resNull.t_max_minutos).toBe(60);
      expect(resNull.observado_en).toBeNull();
      expect(resNull.transicion_consulta).toBe('SIN_MUESTRAS_VALIDAS');

      // Caso cuando estado_sistema es explícitamente SIN_DATOS
      const resSinDatos = derivarEstadoAlConsultar(
        {
          estado_sistema: ESTADOS_SISTEMA.SIN_DATOS,
          nivel_vigente: null,
          observado_en: null,
        },
        { ahora: '2026-03-01T12:00:00.000Z', t_max_minutos: 60 }
      );
      expect(resSinDatos.estado_sistema).toBe(ESTADOS_SISTEMA.SIN_DATOS);
      expect(resSinDatos.nivel_vigente).toBeNull();
    });

    it('1.2. Muestra dentro de vigencia (antigüedad <= T_max): Mantiene estado vigente con datos_desactualizados: false', () => {
      const ultimaEvaluacion = {
        nivel_vigente: ESTADOS_SISTEMA.ALERTA,
        observado_en: '2026-03-01T11:00:00.000Z',
        contador_descenso: 0,
      };

      // Consultada a los 45 minutos (45 min <= 60 min)
      const res = derivarEstadoAlConsultar(ultimaEvaluacion, {
        ahora: '2026-03-01T11:45:00.000Z',
        t_max_minutos: 60,
      });

      expect(res.estado_sistema).toBe(ESTADOS_SISTEMA.ALERTA);
      expect(res.nivel_vigente).toBe(ESTADOS_SISTEMA.ALERTA);
      expect(res.ultimo_nivel_conocido).toBe(ESTADOS_SISTEMA.ALERTA);
      expect(res.datos_desactualizados).toBe(false);
      expect(res.antiguedad_minutos).toBe(45);
      expect(res.t_max_minutos).toBe(60);
      expect(res.observado_en).toBe('2026-03-01T11:00:00.000Z');
      expect(res.transicion_consulta).toBe('VIGENTE');
    });

    it('1.3. Borde exacto de T_max (60 min === 60 min): Se mantiene vigente', () => {
      const ultimaEvaluacion = {
        nivel_vigente: ESTADOS_SISTEMA.EMERGENCIA,
        observado_en: '2026-03-01T11:00:00.000Z',
        contador_descenso: 1,
      };

      // Consultada exactamente a los 60 minutos
      const res = derivarEstadoAlConsultar(ultimaEvaluacion, {
        ahora: '2026-03-01T12:00:00.000Z',
        t_max_minutos: 60,
      });

      expect(res.estado_sistema).toBe(ESTADOS_SISTEMA.EMERGENCIA);
      expect(res.nivel_vigente).toBe(ESTADOS_SISTEMA.EMERGENCIA);
      expect(res.datos_desactualizados).toBe(false);
      expect(res.antiguedad_minutos).toBe(60);
      expect(res.contador_descenso).toBe(1);
      expect(res.transicion_consulta).toBe('VIGENTE');
    });

    it('1.4. Caso oficial P15 (antigüedad > T_max): Transiciona a DATOS_DESACTUALIZADOS y JAMÁS degrada a NORMAL', () => {
      const ultimaEvaluacionEmergencia = {
        nivel_vigente: ESTADOS_SISTEMA.EMERGENCIA,
        observado_en: '2026-03-01T11:00:00.000Z',
        contador_descenso: 0,
      };

      // A los 61 minutos (61 min > 60 min)
      const res61 = derivarEstadoAlConsultar(ultimaEvaluacionEmergencia, {
        ahora: '2026-03-01T12:01:00.000Z',
        t_max_minutos: 60,
      });

      expect(res61.estado_sistema).toBe(ESTADOS_SISTEMA.DATOS_DESACTUALIZADOS);
      expect(res61.datos_desactualizados).toBe(true);
      expect(res61.antiguedad_minutos).toBe(61);
      expect(res61.transicion_consulta).toBe('T6_VENCIMIENTO');
      // Verificación inquebrantable P15: Preserva el último nivel conocido
      expect(res61.nivel_vigente).toBe(ESTADOS_SISTEMA.EMERGENCIA);
      expect(res61.ultimo_nivel_conocido).toBe(ESTADOS_SISTEMA.EMERGENCIA);
      expect(res61.nivel_vigente).not.toBe(ESTADOS_SISTEMA.NORMAL);

      // A los 240 minutos (4 horas después)
      const res240 = derivarEstadoAlConsultar(ultimaEvaluacionEmergencia, {
        ahora: '2026-03-01T15:00:00.000Z',
        t_max_minutos: 60,
      });

      expect(res240.estado_sistema).toBe(ESTADOS_SISTEMA.DATOS_DESACTUALIZADOS);
      expect(res240.datos_desactualizados).toBe(true);
      expect(res240.antiguedad_minutos).toBe(240);
      expect(res240.nivel_vigente).toBe(ESTADOS_SISTEMA.EMERGENCIA);
      expect(res240.ultimo_nivel_conocido).toBe(ESTADOS_SISTEMA.EMERGENCIA);
      expect(res240.nivel_vigente).not.toBe(ESTADOS_SISTEMA.NORMAL);

      // Mismo comportamiento crítico si el nivel previo era ALERTA
      const ultimaEvaluacionAlerta = {
        nivel_vigente: ESTADOS_SISTEMA.ALERTA,
        observado_en: '2026-03-01T11:00:00.000Z',
      };
      const resAlertaVencida = derivarEstadoAlConsultar(ultimaEvaluacionAlerta, {
        ahora: '2026-03-01T12:30:00.000Z',
        t_max_minutos: 60,
      });
      expect(resAlertaVencida.estado_sistema).toBe(ESTADOS_SISTEMA.DATOS_DESACTUALIZADOS);
      expect(resAlertaVencida.nivel_vigente).toBe(ESTADOS_SISTEMA.ALERTA);
      expect(resAlertaVencida.nivel_vigente).not.toBe(ESTADOS_SISTEMA.NORMAL);
    });
  });

  // ==========================================================================
  // BLOQUE 2: P11 — Integración en BD: Aislamiento Simulación vs Estado Real
  // ==========================================================================
  describe('Bloque 2: Regla P11 — Aislamiento Estricto de Modalidad en PostgreSQL', () => {
    beforeEach(async () => {
      await limpiarRegistrosPruebaP11();
    });

    afterEach(async () => {
      await limpiarRegistrosPruebaP11();
    });

    afterAll(async () => {
      await limpiarRegistrosPruebaP11();
    });

    it('2.1. Preparación de un estado REAL activo en PostgreSQL', async () => {
      const configVigente = await obtenerConfiguracionVigente();

      // 1. Insertar lectura real en año 2099
      const { lectura: lecturaReal } = await insertarLecturaMeteorologica({
        modalidad: 'real',
        fuente: 'open-meteo-test-p11',
        observado_en: '2099-01-10T10:00:00.000Z',
        intensidad_mm_h: 7.0,
        acum_24h_mm: 28.0,
        acum_72h_mm: 65.0,
        horas_validas_24h: 24,
        horas_validas_72h: 72,
        estado: 'valida',
      });

      expect(lecturaReal).toBeDefined();
      expect(lecturaReal.modalidad).toBe('real');

      // 2. Insertar evaluación real correspondiente
      const resEval = await pool.query(
        `INSERT INTO evaluaciones_nivel (
           lectura_id, configuracion_id, nivel_calculado, nivel_vigente,
           estado_sistema, contador_descenso, evaluada_en
         ) VALUES ($1, $2, 'ALERTA', 'ALERTA', 'ALERTA', 1, now())
         RETURNING *;`,
        [lecturaReal.id, configVigente.id]
      );

      expect(resEval.rowCount).toBe(1);

      // 3. Verificar consulta de última evaluación real
      const evalReal = await obtenerUltimaEvaluacionPorModalidad({ modalidad: 'real' });
      expect(evalReal).not.toBeNull();
      expect(evalReal.modalidad).toBe('real');
      expect(evalReal.nivel_vigente).toBe('ALERTA');
      expect(evalReal.contador_descenso).toBe(1);
      expect(evalReal.observado_en).toBe('2099-01-10T10:00:00.000Z');
    });

    it('2.2. Carga secuencial de niveles en Modo Simulación sin contaminar el flujo real', async () => {
      const configVigente = await obtenerConfiguracionVigente();

      // 1. Sembrar estado real activo previo
      const { lectura: lecturaReal } = await insertarLecturaMeteorologica({
        modalidad: 'real',
        fuente: 'open-meteo-test-p11',
        observado_en: '2099-01-10T10:00:00.000Z',
        intensidad_mm_h: 7.0,
        acum_24h_mm: 28.0,
        acum_72h_mm: 65.0,
        horas_validas_24h: 24,
        horas_validas_72h: 72,
        estado: 'valida',
      });

      await pool.query(
        `INSERT INTO evaluaciones_nivel (
           lectura_id, configuracion_id, nivel_calculado, nivel_vigente,
           estado_sistema, contador_descenso, evaluada_en
         ) VALUES ($1, $2, 'ALERTA', 'ALERTA', 'ALERTA', 1, now());`,
        [lecturaReal.id, configVigente.id]
      );

      // 2. Inyectar secuencia simulada que recorre los niveles
      // Paso S1: NORMAL (reiniciando secuencia simulada)
      const s1 = await registrarYEvaluarLecturaSimulada({
        observado_en: '2099-01-10T11:00:00.000Z',
        intensidad_mm_h: 0.5,
        acum_24h_mm: 2.0,
        acum_72h_mm: 5.0,
        reiniciar_secuencia: true,
      });
      expect(s1.modalidad).toBe('simulada');
      expect(s1.estado_motor.nivel_vigente).toBe('NORMAL');

      // Paso S2: PRECAUCION
      const s2 = await registrarYEvaluarLecturaSimulada({
        observado_en: '2099-01-10T12:00:00.000Z',
        intensidad_mm_h: 3.0,
        acum_24h_mm: 12.0,
        acum_72h_mm: 30.0,
      });
      expect(s2.estado_motor.nivel_vigente).toBe('PRECAUCION');

      // Paso S3: ALERTA
      const s3 = await registrarYEvaluarLecturaSimulada({
        observado_en: '2099-01-10T13:00:00.000Z',
        intensidad_mm_h: 7.0,
        acum_24h_mm: 26.0,
        acum_72h_mm: 62.0,
      });
      expect(s3.estado_motor.nivel_vigente).toBe('ALERTA');

      // Paso S4: Salto a EMERGENCIA
      const s4 = await registrarYEvaluarLecturaSimulada({
        observado_en: '2099-01-10T14:00:00.000Z',
        intensidad_mm_h: 13.0,
        acum_24h_mm: 42.0,
        acum_72h_mm: 92.0,
      });
      expect(s4.estado_motor.nivel_vigente).toBe('EMERGENCIA');

      // Paso S5: Descenso simulado muestra 1 (PRECAUCION -> mantiene EMERGENCIA, contador = 1)
      const s5 = await registrarYEvaluarLecturaSimulada({
        observado_en: '2099-01-10T15:00:00.000Z',
        intensidad_mm_h: 3.0,
        acum_24h_mm: 15.0,
        acum_72h_mm: 35.0,
      });
      expect(s5.estado_motor.nivel_vigente).toBe('EMERGENCIA');
      expect(s5.estado_motor.contador_descenso).toBe(1);

      // Paso S6: Descenso simulado muestra 2 (NORMAL -> desciende hacia PRECAUCION)
      const s6 = await registrarYEvaluarLecturaSimulada({
        observado_en: '2099-01-10T16:00:00.000Z',
        intensidad_mm_h: 0.5,
        acum_24h_mm: 2.0,
        acum_72h_mm: 5.0,
      });
      expect(s6.estado_motor.nivel_vigente).toBe('PRECAUCION');
      expect(s6.estado_motor.contador_descenso).toBe(0);

      // 3. Consultar estado simulado
      const estadoSimulado = await consultarEstadoPorModalidad({
        modalidad: 'simulada',
        ahora: '2099-01-10T16:15:00.000Z',
      });
      expect(estadoSimulado.es_simulacion).toBe(true);
      expect(estadoSimulado.banner_simulacion).toBe(BANNER_SIMULACION);
      expect(estadoSimulado.nivel_vigente).toBe('PRECAUCION');
      expect(estadoSimulado.modalidad).toBe('simulada');
    });

    it('2.3. Verificación inquebrantable de no contaminación del estado REAL (P11)', async () => {
      const configVigente = await obtenerConfiguracionVigente();

      // Sembrar lectura y evaluación real con fecha 10:00:00Z
      const { lectura: lecturaReal } = await insertarLecturaMeteorologica({
        modalidad: 'real',
        fuente: 'open-meteo-test-p11',
        observado_en: '2099-01-10T10:00:00.000Z',
        intensidad_mm_h: 7.0,
        acum_24h_mm: 28.0,
        acum_72h_mm: 65.0,
        horas_validas_24h: 24,
        horas_validas_72h: 72,
        estado: 'valida',
      });

      await pool.query(
        `INSERT INTO evaluaciones_nivel (
           lectura_id, configuracion_id, nivel_calculado, nivel_vigente,
           estado_sistema, contador_descenso, evaluada_en
         ) VALUES ($1, $2, 'ALERTA', 'ALERTA', 'ALERTA', 1, now());`,
        [lecturaReal.id, configVigente.id]
      );

      // Inyectar lecturas simuladas con fechas POSTERIORES (12:00, 14:00, 16:00) y nivel EMERGENCIA
      await registrarYEvaluarLecturaSimulada({
        observado_en: '2099-01-10T14:00:00.000Z',
        intensidad_mm_h: 15.0,
        acum_24h_mm: 50.0,
        acum_72h_mm: 100.0,
        reiniciar_secuencia: true,
      });

      // COMPROBACIONES CRÍTICAS SOBRE EL ESTADO REAL:
      // A. La última evaluación real NO fue alterada por la simulación
      const evalReal = await obtenerUltimaEvaluacionPorModalidad({ modalidad: 'real' });
      expect(evalReal.modalidad).toBe('real');
      expect(evalReal.nivel_vigente).toBe('ALERTA');
      expect(evalReal.contador_descenso).toBe(1);
      expect(evalReal.observado_en).toBe('2099-01-10T10:00:00.000Z');

      // B. La consulta del estado real conserva su vigencia sin contaminarse de la simulación
      const estadoReal = await consultarEstadoPorModalidad({
        modalidad: 'real',
        ahora: '2099-01-10T10:30:00.000Z',
      });
      expect(estadoReal.es_simulacion).toBe(false);
      expect(estadoReal.banner_simulacion).toBeNull();
      expect(estadoReal.nivel_vigente).toBe('ALERTA');
      expect(estadoReal.contador_descenso).toBe(1);
      expect(estadoReal.observado_en).toBe('2099-01-10T10:00:00.000Z');

      // C. La última lectura meteorológica real registrada NO es la simulada
      const ultimaLecturaReal = await obtenerUltimaLecturaRegistrada({ modalidad: 'real' });
      expect(ultimaLecturaReal.id).toBe(lecturaReal.id);
      expect(ultimaLecturaReal.modalidad).toBe('real');
      expect(ultimaLecturaReal.observado_en).toBe('2099-01-10T10:00:00.000Z');
    });

    it('2.4. Limpieza aislada de simulación: limpiarDatosSimulados elimina solo simuladas y preserva las reales', async () => {
      const configVigente = await obtenerConfiguracionVigente();

      // 1. Crear lectura real
      const { lectura: lecturaReal } = await insertarLecturaMeteorologica({
        modalidad: 'real',
        fuente: 'open-meteo-test-p11',
        observado_en: '2099-01-10T10:00:00.000Z',
        intensidad_mm_h: 7.0,
        acum_24h_mm: 28.0,
        acum_72h_mm: 65.0,
        horas_validas_24h: 24,
        horas_validas_72h: 72,
        estado: 'valida',
      });

      await pool.query(
        `INSERT INTO evaluaciones_nivel (
           lectura_id, configuracion_id, nivel_calculado, nivel_vigente,
           estado_sistema, contador_descenso, evaluada_en
         ) VALUES ($1, $2, 'ALERTA', 'ALERTA', 'ALERTA', 1, now());`,
        [lecturaReal.id, configVigente.id]
      );

      // 2. Crear dos lecturas simuladas
      await registrarYEvaluarLecturaSimulada({
        observado_en: '2099-01-10T11:00:00.000Z',
        intensidad_mm_h: 2.0,
        acum_24h_mm: 10.0,
        acum_72h_mm: 20.0,
        reiniciar_secuencia: true,
      });
      await registrarYEvaluarLecturaSimulada({
        observado_en: '2099-01-10T12:00:00.000Z',
        intensidad_mm_h: 8.0,
        acum_24h_mm: 30.0,
        acum_72h_mm: 70.0,
      });

      // Verificar que existen registros simulados en BD
      const simPrevias = await pool.query(
        "SELECT COUNT(*)::int AS total FROM lecturas_meteorologicas WHERE modalidad = 'simulada';"
      );
      expect(simPrevias.rows[0].total).toBeGreaterThanOrEqual(2);

      // 3. Ejecutar limpieza de datos simulados
      const resLimpieza = await limpiarDatosSimulados();
      expect(resLimpieza.ok).toBe(true);

      // 4. Confirmar que no quedan lecturas ni evaluaciones simuladas
      const simPosteriores = await pool.query(
        "SELECT COUNT(*)::int AS total FROM lecturas_meteorologicas WHERE modalidad = 'simulada';"
      );
      expect(simPosteriores.rows[0].total).toBe(0);

      const evalSimPosteriores = await pool.query(`
        SELECT COUNT(*)::int AS total
        FROM evaluaciones_nivel e
        JOIN lecturas_meteorologicas l ON l.id = e.lectura_id
        WHERE l.modalidad = 'simulada';
      `);
      expect(evalSimPosteriores.rows[0].total).toBe(0);

      // 5. Confirmar que el registro real sigue intacto
      const evalReal = await obtenerUltimaEvaluacionPorModalidad({ modalidad: 'real' });
      expect(evalReal).not.toBeNull();
      expect(evalReal.lectura_id).toBe(lecturaReal.id);
      expect(evalReal.nivel_vigente).toBe('ALERTA');
    });
  });
});
