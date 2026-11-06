/**
 * @file clasificar.p01.p17.test.js
 * @description Suite de pruebas unitarias exhaustivas para el motor de clasificación pura
 * de PUKARA, certificando las reglas de comparación P01 (valores límite "o más"),
 * P17 (saturación de suelo 72h + intensidad) y P02 (manejo riguroso de variables incompletas).
 */

import { describe, it, expect } from 'vitest';
import {
  NIVELES_INFORMATIVOS,
  ORDEN_NIVELES,
  VARIABLES_METEOROLOGICAS,
  compararNiveles,
  obtenerNivelMayor,
  normalizarMapaUmbrales,
  clasificarVariableIndividual,
  esVariableCompleta,
  clasificarMuestra,
} from '../src/engine/clasificar.js';
import { calcularAcumuladosYCalidad } from '../src/engine/acumulados.js';

/**
 * Fixture canónico con los 9 umbrales académicos y parámetros ratificados en Semana 1.
 */
const CONFIG_ACADEMICA_V1 = Object.freeze({
  umbrales: {
    intensidad_mm_h: { PRECAUCION: 2.5, ALERTA: 6.5, EMERGENCIA: 12.0 },
    acum_24h_mm: { PRECAUCION: 10.0, ALERTA: 25.0, EMERGENCIA: 40.0 },
    acum_72h_mm: { PRECAUCION: 25.0, ALERTA: 60.0, EMERGENCIA: 90.0 },
  },
  parametros: {
    saturacion: {
      habilitada: true,
      acum_72h_min_mm: 60,
      intensidad_min_mm_h: 2.5,
      nivel_minimo: 'ALERTA',
    },
  },
});

/**
 * Fixture en formato relacional de base de datos con cadenas numéricas de PostgreSQL.
 */
const UMBRALES_DB_STRINGS = Object.freeze([
  { variable: 'intensidad_mm_h', nivel: 'PRECAUCION', valor: '2.50' },
  { variable: 'intensidad_mm_h', nivel: 'ALERTA', valor: '6.50' },
  { variable: 'intensidad_mm_h', nivel: 'EMERGENCIA', valor: '12.00' },
  { variable: 'acum_24h_mm', nivel: 'PRECAUCION', valor: '10.00' },
  { variable: 'acum_24h_mm', nivel: 'ALERTA', valor: '25.00' },
  { variable: 'acum_24h_mm', nivel: 'EMERGENCIA', valor: '40.00' },
  { variable: 'acum_72h_mm', nivel: 'PRECAUCION', valor: '25.00' },
  { variable: 'acum_72h_mm', nivel: 'ALERTA', valor: '60.00' },
  { variable: 'acum_72h_mm', nivel: 'EMERGENCIA', valor: '90.00' },
]);

describe('Motor de Clasificación PUKARA: Reglas P01, P17 y P02 (clasificar.js)', () => {
  // ==========================================================================
  // BLOQUE 1: P01 — Valores Límite Exactos (Comparación >= "o más")
  // ==========================================================================
  describe('Bloque 1: Regla P01 — Valores Límite Exactos (>= "o más")', () => {
    it('1.1. Clasifica como NORMAL valores en 0.0 y estrictamente debajo del límite de PRECAUCION', () => {
      // Caso 0 mm absoluto
      const mCero = {
        intensidad_mm_h: 0,
        acum_24h_mm: 0,
        acum_72h_mm: 0,
        horas_validas_24h: 24,
        horas_validas_72h: 72,
      };
      const rCero = clasificarMuestra(mCero, CONFIG_ACADEMICA_V1);
      expect(rCero.muestra_valida).toBe(true);
      expect(rCero.nivel_calculado).toBe(NIVELES_INFORMATIVOS.NORMAL);
      expect(rCero.nivel_base_variables).toBe(NIVELES_INFORMATIVOS.NORMAL);
      expect(rCero.clasificacion_parcial).toBe(false);
      expect(rCero.regla_saturacion_aplicada).toBe(false);

      // Justo una centésima/décima por debajo de Precaución (2.49 < 2.5, 9.99 < 10.0, 24.99 < 25.0)
      const mSubPrecaucion = {
        intensidad_mm_h: 2.49,
        acum_24h_mm: 9.99,
        acum_72h_mm: 24.99,
        horas_validas_24h: 24,
        horas_validas_72h: 72,
      };
      const rSub = clasificarMuestra(mSubPrecaucion, CONFIG_ACADEMICA_V1);
      expect(rSub.nivel_calculado).toBe(NIVELES_INFORMATIVOS.NORMAL);
      expect(rSub.nivel_base_variables).toBe(NIVELES_INFORMATIVOS.NORMAL);
    });

    it('1.2. Clasifica como PRECAUCION exactamente al alcanzar el umbral (>= "o más")', () => {
      // Intensidad exacta 2.5 mm/h
      const mIntensidad = {
        intensidad_mm_h: 2.5,
        acum_24h_mm: 0,
        acum_72h_mm: 0,
        horas_validas_24h: 24,
        horas_validas_72h: 72,
      };
      const rInt = clasificarMuestra(mIntensidad, CONFIG_ACADEMICA_V1);
      expect(rInt.nivel_calculado).toBe(NIVELES_INFORMATIVOS.PRECAUCION);
      expect(rInt.variables_evaluadas.intensidad_mm_h.nivel).toBe(NIVELES_INFORMATIVOS.PRECAUCION);

      // Acumulado 24h exacto 10.0 mm
      const m24h = {
        intensidad_mm_h: 0,
        acum_24h_mm: 10.0,
        acum_72h_mm: 10.0,
        horas_validas_24h: 24,
        horas_validas_72h: 72,
      };
      const r24 = clasificarMuestra(m24h, CONFIG_ACADEMICA_V1);
      expect(r24.nivel_calculado).toBe(NIVELES_INFORMATIVOS.PRECAUCION);
      expect(r24.variables_evaluadas.acum_24h_mm.nivel).toBe(NIVELES_INFORMATIVOS.PRECAUCION);

      // Acumulado 72h exacto 25.0 mm
      const m72h = {
        intensidad_mm_h: 0,
        acum_24h_mm: 0,
        acum_72h_mm: 25.0,
        horas_validas_24h: 24,
        horas_validas_72h: 72,
      };
      const r72 = clasificarMuestra(m72h, CONFIG_ACADEMICA_V1);
      expect(r72.nivel_calculado).toBe(NIVELES_INFORMATIVOS.PRECAUCION);
      expect(r72.variables_evaluadas.acum_72h_mm.nivel).toBe(NIVELES_INFORMATIVOS.PRECAUCION);
    });

    it('1.3. Clasifica como ALERTA exactamente en el umbral y permanece en PRECAUCION justo debajo', () => {
      // Justo debajo de ALERTA en las 3 variables (6.49 < 6.5, 24.99 < 25.0, 59.99 < 60.0)
      const mSubAlerta = {
        intensidad_mm_h: 6.49,
        acum_24h_mm: 24.99,
        acum_72h_mm: 59.99,
        horas_validas_24h: 24,
        horas_validas_72h: 72,
      };
      const rSub = clasificarMuestra(mSubAlerta, CONFIG_ACADEMICA_V1);
      expect(rSub.nivel_calculado).toBe(NIVELES_INFORMATIVOS.PRECAUCION);

      // Intensidad exacta 6.5 mm/h
      const mInt = {
        intensidad_mm_h: 6.5,
        acum_24h_mm: 0,
        acum_72h_mm: 0,
        horas_validas_24h: 24,
        horas_validas_72h: 72,
      };
      expect(clasificarMuestra(mInt, CONFIG_ACADEMICA_V1).nivel_calculado).toBe(
        NIVELES_INFORMATIVOS.ALERTA
      );

      // Acumulado 24h exacto 25.0 mm
      const m24 = {
        intensidad_mm_h: 0,
        acum_24h_mm: 25.0,
        acum_72h_mm: 25.0,
        horas_validas_24h: 24,
        horas_validas_72h: 72,
      };
      expect(clasificarMuestra(m24, CONFIG_ACADEMICA_V1).nivel_calculado).toBe(
        NIVELES_INFORMATIVOS.ALERTA
      );

      // Acumulado 72h exacto 60.0 mm
      const m72 = {
        intensidad_mm_h: 0,
        acum_24h_mm: 0,
        acum_72h_mm: 60.0,
        horas_validas_24h: 24,
        horas_validas_72h: 72,
      };
      expect(clasificarMuestra(m72, CONFIG_ACADEMICA_V1).nivel_calculado).toBe(
        NIVELES_INFORMATIVOS.ALERTA
      );
    });

    it('1.4. Clasifica como EMERGENCIA exactamente en el umbral y permanece en ALERTA justo debajo', () => {
      // Justo debajo de EMERGENCIA en las 3 variables (11.99 < 12.0, 39.99 < 40.0, 89.99 < 90.0)
      const mSubEmergencia = {
        intensidad_mm_h: 11.99,
        acum_24h_mm: 39.99,
        acum_72h_mm: 89.99,
        horas_validas_24h: 24,
        horas_validas_72h: 72,
      };
      const rSub = clasificarMuestra(mSubEmergencia, CONFIG_ACADEMICA_V1);
      expect(rSub.nivel_calculado).toBe(NIVELES_INFORMATIVOS.ALERTA);

      // Intensidad exacta 12.0 mm/h
      const mInt = {
        intensidad_mm_h: 12.0,
        acum_24h_mm: 0,
        acum_72h_mm: 0,
        horas_validas_24h: 24,
        horas_validas_72h: 72,
      };
      expect(clasificarMuestra(mInt, CONFIG_ACADEMICA_V1).nivel_calculado).toBe(
        NIVELES_INFORMATIVOS.EMERGENCIA
      );

      // Acumulado 24h exacto 40.0 mm
      const m24 = {
        intensidad_mm_h: 0,
        acum_24h_mm: 40.0,
        acum_72h_mm: 0,
        horas_validas_24h: 24,
        horas_validas_72h: 72,
      };
      expect(clasificarMuestra(m24, CONFIG_ACADEMICA_V1).nivel_calculado).toBe(
        NIVELES_INFORMATIVOS.EMERGENCIA
      );

      // Acumulado 72h exacto 90.0 mm
      const m72 = {
        intensidad_mm_h: 0,
        acum_24h_mm: 0,
        acum_72h_mm: 90.0,
        horas_validas_24h: 24,
        horas_validas_72h: 72,
      };
      expect(clasificarMuestra(m72, CONFIG_ACADEMICA_V1).nivel_calculado).toBe(
        NIVELES_INFORMATIVOS.EMERGENCIA
      );
    });

    it('1.5. Aplica dominancia de la variable más alta entre las 3 variables meteorológicas', () => {
      // Intensidad = NORMAL (1.0), 24h = PRECAUCION (15.0), 72h = EMERGENCIA (95.0)
      const muestra = {
        intensidad_mm_h: 1.0,
        acum_24h_mm: 15.0,
        acum_72h_mm: 95.0,
        horas_validas_24h: 24,
        horas_validas_72h: 72,
      };
      const res = clasificarMuestra(muestra, CONFIG_ACADEMICA_V1);
      expect(res.nivel_calculado).toBe(NIVELES_INFORMATIVOS.EMERGENCIA);
      expect(res.nivel_base_variables).toBe(NIVELES_INFORMATIVOS.EMERGENCIA);
      expect(res.variables_evaluadas.intensidad_mm_h.nivel).toBe(NIVELES_INFORMATIVOS.NORMAL);
      expect(res.variables_evaluadas.acum_24h_mm.nivel).toBe(NIVELES_INFORMATIVOS.PRECAUCION);
      expect(res.variables_evaluadas.acum_72h_mm.nivel).toBe(NIVELES_INFORMATIVOS.EMERGENCIA);
    });
  });

  // ==========================================================================
  // BLOQUE 2: P17 — Regla de Saturación del Suelo (acum_72h >= 60 + intensidad >= 2.5)
  // ==========================================================================
  describe('Bloque 2: Regla P17 — Saturación del Suelo (acum_72h >= 60 + intensidad >= 2.5)', () => {
    it('2.1. Caso oficial P17 positivo: activa regla de saturación y asegura nivel ALERTA', () => {
      const muestra = {
        intensidad_mm_h: 2.5,
        acum_24h_mm: 5.0,
        acum_72h_mm: 60.0,
        horas_validas_24h: 24,
        horas_validas_72h: 72,
      };
      const res = clasificarMuestra(muestra, CONFIG_ACADEMICA_V1);
      expect(res.nivel_calculado).toBe(NIVELES_INFORMATIVOS.ALERTA);
      expect(res.regla_saturacion_aplicada).toBe(true);
    });

    it('2.2. Caso oficial P17 negativo: 59.9 mm en 72h no alcanza saturación (60 mm) y se queda en PRECAUCION', () => {
      const muestra = {
        intensidad_mm_h: 2.5, // PRECAUCION
        acum_24h_mm: 12.0,    // PRECAUCION
        acum_72h_mm: 59.9,    // PRECAUCION (debajo de 60 mm)
        horas_validas_24h: 24,
        horas_validas_72h: 72,
      };
      const res = clasificarMuestra(muestra, CONFIG_ACADEMICA_V1);
      expect(res.nivel_calculado).toBe(NIVELES_INFORMATIVOS.PRECAUCION);
      expect(res.nivel_base_variables).toBe(NIVELES_INFORMATIVOS.PRECAUCION);
      expect(res.regla_saturacion_aplicada).toBe(false);
    });

    it('2.3. Eleva efectivamente un nivel base PRECAUCION a ALERTA cuando los umbrales difieren de la regla de suelo', () => {
      // Configuración personalizada donde ALERTA en 72h exige 75 mm, pero la saturación es a los 60 mm
      const configPersonalizada = {
        umbrales: {
          intensidad_mm_h: { PRECAUCION: 2.5, ALERTA: 6.5, EMERGENCIA: 12.0 },
          acum_24h_mm: { PRECAUCION: 10.0, ALERTA: 25.0, EMERGENCIA: 40.0 },
          acum_72h_mm: { PRECAUCION: 25.0, ALERTA: 75.0, EMERGENCIA: 90.0 },
        },
        parametros: {
          saturacion: {
            habilitada: true,
            acum_72h_min_mm: 60,
            intensidad_min_mm_h: 2.5,
            nivel_minimo: 'ALERTA',
          },
        },
      };

      const muestra = {
        intensidad_mm_h: 3.0, // PRECAUCION (3.0 < 6.5)
        acum_24h_mm: 5.0,     // NORMAL (5.0 < 10.0)
        acum_72h_mm: 62.0,    // PRECAUCION (62.0 < 75.0)
        horas_validas_24h: 24,
        horas_validas_72h: 72,
      };

      const res = clasificarMuestra(muestra, configPersonalizada);
      expect(res.nivel_base_variables).toBe(NIVELES_INFORMATIVOS.PRECAUCION);
      expect(res.regla_saturacion_aplicada).toBe(true);
      expect(res.nivel_calculado).toBe(NIVELES_INFORMATIVOS.ALERTA);
    });

    it('2.4. No degrada el nivel si una variable ya alcanzó EMERGENCIA y simultáneamente hay suelo saturado', () => {
      const muestra = {
        intensidad_mm_h: 2.8, // Sat >= 2.5
        acum_24h_mm: 45.0,    // EMERGENCIA (>= 40.0)
        acum_72h_mm: 65.0,    // Sat >= 60.0
        horas_validas_24h: 24,
        horas_validas_72h: 72,
      };
      const res = clasificarMuestra(muestra, CONFIG_ACADEMICA_V1);
      expect(res.nivel_base_variables).toBe(NIVELES_INFORMATIVOS.EMERGENCIA);
      expect(res.regla_saturacion_aplicada).toBe(true);
      expect(res.nivel_calculado).toBe(NIVELES_INFORMATIVOS.EMERGENCIA);
    });

    it('2.5. Respeta el flag habilitada: false y no aplica regla de saturación', () => {
      const configDeshabilitada = {
        ...CONFIG_ACADEMICA_V1,
        parametros: {
          saturacion: {
            habilitada: false,
            acum_72h_min_mm: 60,
            intensidad_min_mm_h: 2.5,
            nivel_minimo: 'ALERTA',
          },
        },
      };
      const muestra = {
        intensidad_mm_h: 2.5,
        acum_24h_mm: 5.0,
        acum_72h_mm: 60.0,
        horas_validas_24h: 24,
        horas_validas_72h: 72,
      };
      const res = clasificarMuestra(muestra, configDeshabilitada);
      expect(res.regla_saturacion_aplicada).toBe(false);
      // Con umbrales V1, 60.0 en 72h es ALERTA por su propio umbral
      expect(res.nivel_calculado).toBe(NIVELES_INFORMATIVOS.ALERTA);
    });
  });

  // ==========================================================================
  // BLOQUE 3: P02 (Clasificador) — Variables Incompletas y Muestras Inválidas
  // ==========================================================================
  describe('Bloque 3: Regla P02 — Variables Incompletas y Muestras Inválidas', () => {
    it('3.1. Clasifica parcialmente excluyendo acum_72h_mm cuando es null y horas_validas < 72', () => {
      const muestra = {
        intensidad_mm_h: 3.0, // PRECAUCION
        acum_24h_mm: 5.0,     // NORMAL
        acum_72h_mm: null,    // Incompleta
        horas_validas_24h: 24,
        horas_validas_72h: 68, // Faltan horas
      };
      const res = clasificarMuestra(muestra, CONFIG_ACADEMICA_V1);
      expect(res.muestra_valida).toBe(true);
      expect(res.nivel_calculado).toBe(NIVELES_INFORMATIVOS.PRECAUCION);
      expect(res.clasificacion_parcial).toBe(true);
      expect(res.variables_excluidas).toEqual(['acum_72h_mm']);
      expect(res.variables_evaluadas).toHaveProperty('intensidad_mm_h');
      expect(res.variables_evaluadas).toHaveProperty('acum_24h_mm');
      expect(res.variables_evaluadas).not.toHaveProperty('acum_72h_mm');
      expect(res.regla_saturacion_aplicada).toBe(false);
    });

    it('3.2. Excluye acum_24h_mm si horas_validas_24h < 24 aunque contenga valor numérico residual', () => {
      const muestra = {
        intensidad_mm_h: 1.0,  // NORMAL
        acum_24h_mm: 50.0,     // Con 20 horas no es válido
        horas_validas_24h: 20,
        acum_72h_mm: null,
        horas_validas_72h: 20,
      };
      const res = clasificarMuestra(muestra, CONFIG_ACADEMICA_V1);
      expect(res.muestra_valida).toBe(true);
      // Al excluir 24h y 72h, solo participa intensidad (1.0 mm/h -> NORMAL)
      expect(res.nivel_calculado).toBe(NIVELES_INFORMATIVOS.NORMAL);
      expect(res.clasificacion_parcial).toBe(true);
      expect(res.variables_excluidas).toEqual(['acum_24h_mm', 'acum_72h_mm']);
    });

    it('3.3. Retorna muestra_valida: false y motivo SIN_VARIABLES_COMPLETAS si ninguna variable es válida', () => {
      const muestraVacia = {
        intensidad_mm_h: null,
        acum_24h_mm: null,
        acum_72h_mm: null,
        horas_validas_24h: 10,
        horas_validas_72h: 10,
      };
      const res = clasificarMuestra(muestraVacia, CONFIG_ACADEMICA_V1);
      expect(res.muestra_valida).toBe(false);
      expect(res.nivel_calculado).toBeNull();
      expect(res.motivo_invalidez).toBe('SIN_VARIABLES_COMPLETAS');
      expect(res.variables_excluidas).toEqual(VARIABLES_METEOROLOGICAS);
    });

    it('3.4. Soporta transparentemente formato de filas de base de datos con cadenas numéricas de PostgreSQL', () => {
      const muestra = {
        intensidad_mm_h: 7.0, // ALERTA
        acum_24h_mm: 15.0,    // PRECAUCION
        acum_72h_mm: 20.0,    // NORMAL
        horas_validas_24h: 24,
        horas_validas_72h: 72,
      };

      // Inyectar array relacional directamente
      const res = clasificarMuestra(muestra, UMBRALES_DB_STRINGS);
      expect(res.muestra_valida).toBe(true);
      expect(res.nivel_calculado).toBe(NIVELES_INFORMATIVOS.ALERTA);
      expect(res.clasificacion_parcial).toBe(false);
    });

    it('3.5. Rechaza inmediatamente muestras marcadas con estado: "invalida"', () => {
      const muestraInvalida = {
        estado: 'invalida',
        intensidad_mm_h: 10.0,
        acum_24h_mm: 30.0,
        acum_72h_mm: 70.0,
      };
      const res = clasificarMuestra(muestraInvalida, CONFIG_ACADEMICA_V1);
      expect(res.muestra_valida).toBe(false);
      expect(res.nivel_calculado).toBeNull();
      expect(res.motivo_invalidez).toBe('SIN_VARIABLES_COMPLETAS');
    });
  });

  // ==========================================================================
  // BLOQUE 4: Funciones Puras Auxiliares y Robustez de Contrato
  // ==========================================================================
  describe('Bloque 4: Funciones Puras Auxiliares y Validaciones Estrictas', () => {
    it('4.1. compararNiveles respeta el orden estricto y lanza error ante niveles inválidos', () => {
      expect(compararNiveles('NORMAL', 'NORMAL')).toBe(0);
      expect(compararNiveles('PRECAUCION', 'NORMAL')).toBeGreaterThan(0);
      expect(compararNiveles('ALERTA', 'EMERGENCIA')).toBeLessThan(0);
      expect(compararNiveles('EMERGENCIA', 'ALERTA')).toBe(1);

      expect(() => compararNiveles('DESCONOCIDO', 'NORMAL')).toThrow(/Nivel inválido/);
      expect(() => compararNiveles('NORMAL', null)).toThrow(/Nivel inválido/);
      expect(() => compararNiveles(undefined, 'ALERTA')).toThrow(/Nivel inválido/);
    });

    it('4.2. obtenerNivelMayor devuelve el nivel predominante de forma asociativa y conmutativa', () => {
      expect(obtenerNivelMayor('NORMAL', 'PRECAUCION')).toBe('PRECAUCION');
      expect(obtenerNivelMayor('PRECAUCION', 'NORMAL')).toBe('PRECAUCION');
      expect(obtenerNivelMayor('ALERTA', 'EMERGENCIA')).toBe('EMERGENCIA');
      expect(obtenerNivelMayor('EMERGENCIA', 'EMERGENCIA')).toBe('EMERGENCIA');
    });

    it('4.3. normalizarMapaUmbrales valida presencia de los 9 umbrales y rechaza incompletos o negativos', () => {
      // Caso exitoso
      const mapa = normalizarMapaUmbrales(CONFIG_ACADEMICA_V1);
      expect(mapa).toHaveProperty('intensidad_mm_h');
      expect(mapa).toHaveProperty('acum_24h_mm');
      expect(mapa).toHaveProperty('acum_72h_mm');
      expect(mapa.intensidad_mm_h.PRECAUCION).toBe(2.5);

      // Faltan umbrales
      expect(() =>
        normalizarMapaUmbrales([
          { variable: 'intensidad_mm_h', nivel: 'PRECAUCION', valor: 2.5 },
        ])
      ).toThrow(/Umbral faltante o inválido/);

      // Umbral negativo
      expect(() =>
        normalizarMapaUmbrales({
          intensidad_mm_h: { PRECAUCION: -1, ALERTA: 6.5, EMERGENCIA: 12 },
          acum_24h_mm: { PRECAUCION: 10, ALERTA: 25, EMERGENCIA: 40 },
          acum_72h_mm: { PRECAUCION: 25, ALERTA: 60, EMERGENCIA: 90 },
        })
      ).toThrow(/Umbral faltante o inválido/);

      // Entrada nula
      expect(() => normalizarMapaUmbrales(null)).toThrow(/Umbrales inválidos/);
    });

    it('4.4. clasificarVariableIndividual evalúa límites y rechaza entradas no numéricas o negativas', () => {
      const umbralesVar = { PRECAUCION: 2.5, ALERTA: 6.5, EMERGENCIA: 12.0 };
      expect(clasificarVariableIndividual(0, umbralesVar)).toBe('NORMAL');
      expect(clasificarVariableIndividual(2.5, umbralesVar)).toBe('PRECAUCION');
      expect(clasificarVariableIndividual(6.5, umbralesVar)).toBe('ALERTA');
      expect(clasificarVariableIndividual(12.0, umbralesVar)).toBe('EMERGENCIA');

      expect(() => clasificarVariableIndividual(-0.1, umbralesVar)).toThrow(/Valor de variable meteorológica inválido/);
      expect(() => clasificarVariableIndividual(NaN, umbralesVar)).toThrow(/Valor de variable meteorológica inválido/);
      expect(() => clasificarVariableIndividual(null, umbralesVar)).toThrow(/Valor de variable meteorológica inválido/);
      expect(() => clasificarVariableIndividual(undefined, umbralesVar)).toThrow(/Valor de variable meteorológica inválido/);
    });

    it('4.5. esVariableCompleta rechaza booleanos, nulos, vacíos y respeta horas requeridas', () => {
      expect(esVariableCompleta({ intensidad_mm_h: false }, 'intensidad_mm_h')).toBe(false);
      expect(esVariableCompleta({ intensidad_mm_h: '' }, 'intensidad_mm_h')).toBe(false);
      expect(esVariableCompleta({ intensidad_mm_h: null }, 'intensidad_mm_h')).toBe(false);
      expect(esVariableCompleta({ intensidad_mm_h: -5 }, 'intensidad_mm_h')).toBe(false);
      expect(esVariableCompleta({ intensidad_mm_h: 0 }, 'intensidad_mm_h')).toBe(true);

      // acum_24h_mm
      expect(esVariableCompleta({ acum_24h_mm: 10, horas_validas_24h: 24 }, 'acum_24h_mm')).toBe(true);
      expect(esVariableCompleta({ acum_24h_mm: 10, horas_validas_24h: 23 }, 'acum_24h_mm')).toBe(false);

      // acum_72h_mm
      expect(esVariableCompleta({ acum_72h_mm: 30, horas_validas_72h: 72 }, 'acum_72h_mm')).toBe(true);
      expect(esVariableCompleta({ acum_72h_mm: 30, horas_validas_72h: 71 }, 'acum_72h_mm')).toBe(false);

      // variable no reconocida
      expect(esVariableCompleta({ temp: 15 }, 'temp')).toBe(false);
    });

    it('4.6. Integración fluida directa con salida de calcularAcumuladosYCalidad', () => {
      // Simular cálculo de acumulados completo
      const tiemposUtc = [];
      const precipitacionMm = [];
      const tsAnchor = Date.parse('2026-10-23T18:00:00.000Z');

      for (let h = 79; h >= 0; h--) {
        tiemposUtc.push(new Date(tsAnchor - h * 3_600_000).toISOString());
        precipitacionMm.push(0.5); // 0.5 mm por hora
      }

      const salidaAcumulados = calcularAcumuladosYCalidad({
        observado_en: '2026-10-23T18:30:00.000Z',
        actual: { precipitacion_mm: 3.0 },
        serie_horaria: { tiempos_utc: tiemposUtc, precipitacion_mm: precipitacionMm },
      });

      // 24h = 24 * 0.5 = 12.0 mm (PRECAUCION)
      // 72h = 72 * 0.5 = 36.0 mm (PRECAUCION)
      // intensidad = 3.0 mm/h (PRECAUCION)
      const res = clasificarMuestra(salidaAcumulados, CONFIG_ACADEMICA_V1);
      expect(res.muestra_valida).toBe(true);
      expect(res.nivel_calculado).toBe(NIVELES_INFORMATIVOS.PRECAUCION);
      expect(res.clasificacion_parcial).toBe(false);
      expect(res.regla_saturacion_aplicada).toBe(false);
    });
  });
});
