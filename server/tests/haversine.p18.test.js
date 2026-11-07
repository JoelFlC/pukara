/**
 * @file haversine.p18.test.js
 * @description Suite de pruebas automatizadas para el Requisito P18:
 * Precisión de la fórmula de Haversine en ubicaciones con distancia conocida,
 * simetría matemática, validación de coordenadas y leyenda obligatoria.
 */

import { describe, it, expect } from 'vitest';
import {
  distanciaHaversine,
  esCoordenadaValida,
  calcularDistanciasAPuntos,
  LEYENDA_DISTANCIA_HAVERSINE,
} from '../src/engine/haversine.js';

describe('Semana 3 - Día 4 (Fase B): Precisión Haversine y Requisito P18 (haversine.p18.test.js)', () => {
  // Coordenada central de referencia: Sector Piloto Llojeta
  const CENTRO_LLOJETA = {
    latitud: -16.5235,
    longitud: -68.1425,
  };

  // =========================================================================
  // BLOQUE 1: Casos P18 en Ubicaciones con Distancia Conocida
  // =========================================================================
  describe('Bloque 1: Casos P18 en Ubicaciones con Distancia Conocida', () => {
    it('1. Caso P18.1 — Coordenada idéntica arroja distancia exactamente cero (0 m y 0 km)', () => {
      const resultado = distanciaHaversine(CENTRO_LLOJETA, CENTRO_LLOJETA);

      expect(resultado.metros).toBe(0);
      expect(resultado.kilometros).toBe(0);
      expect(resultado.distanciaCorta).toBe('0 m');
      expect(resultado.leyenda).toBe(LEYENDA_DISTANCIA_HAVERSINE);
      expect(resultado.textoFormateado).toContain('0 m');
      expect(resultado.textoFormateado).toContain(LEYENDA_DISTANCIA_HAVERSINE);
    });

    it('2. Caso P18.2 — Ubicación conocida 1: Centro Piloto Llojeta a Plaza Murillo (~3.23 km con tolerancia ± 25 m)', () => {
      const plazaMurillo = {
        latitud: -16.4957,
        longitud: -68.1335,
      };

      const res = distanciaHaversine(CENTRO_LLOJETA, plazaMurillo);

      // Esperado: ~3234 m (tolerancia ± 25 m)
      expect(Math.abs(res.metros - 3234)).toBeLessThanOrEqual(25);
      expect(res.kilometros).toBeGreaterThanOrEqual(3.21);
      expect(res.kilometros).toBeLessThanOrEqual(3.26);
      expect(res.distanciaCorta).toMatch(/^3\.\d{1,2}\s*km$/);
      expect(res.leyenda).toBe(
        'distancia aproximada en línea recta (no es recomendación de ruta ni indica seguridad)'
      );
    });

    it('3. Caso P18.3 — Ubicación conocida 2: Centro Piloto a Bajo Llojeta / Av. Los Sargentos (~693 m con tolerancia ± 15 m)', () => {
      const bajoLlojeta = {
        latitud: -16.528,
        longitud: -68.138,
      };

      const res = distanciaHaversine(CENTRO_LLOJETA, bajoLlojeta);

      // Esperado: ~693 m (tolerancia ± 15 m)
      expect(Math.abs(res.metros - 693)).toBeLessThanOrEqual(15);
      expect(res.kilometros).toBeGreaterThanOrEqual(0.678);
      expect(res.kilometros).toBeLessThanOrEqual(0.708);
      expect(res.distanciaCorta).toBe(`${res.metros} m`);
      expect(res.leyenda).toBe(LEYENDA_DISTANCIA_HAVERSINE);
    });

    it('4. Caso P18.4 — Ubicación conocida 3: Centro Piloto a Alto Llojeta / Cancha (~854 m con tolerancia ± 15 m)', () => {
      const altoLlojeta = {
        latitud: -16.519,
        longitud: -68.149,
      };

      const res = distanciaHaversine(CENTRO_LLOJETA, altoLlojeta);

      // Esperado: ~854 m (tolerancia ± 15 m)
      expect(Math.abs(res.metros - 854)).toBeLessThanOrEqual(15);
      expect(res.kilometros).toBeGreaterThanOrEqual(0.839);
      expect(res.kilometros).toBeLessThanOrEqual(0.869);
      expect(res.distanciaCorta).toBe(`${res.metros} m`);
      expect(res.leyenda).toBe(LEYENDA_DISTANCIA_HAVERSINE);
    });

    it('5. Caso P18.5 — Control geodésico estándar: 1 grado de latitud sobre el mismo meridiano (~111.195 km ± 50 m)', () => {
      const puntoA = { latitud: -16.0, longitud: -68.0 };
      const puntoB = { latitud: -17.0, longitud: -68.0 };

      const res = distanciaHaversine(puntoA, puntoB);

      // 1 grado en esfera de R=6371 km equivale a: (PI / 180) * 6371 = 111.1949266... km -> 111195 m
      expect(Math.abs(res.metros - 111195)).toBeLessThanOrEqual(50);
      expect(Math.abs(res.kilometros - 111.195)).toBeLessThanOrEqual(0.05);
      expect(res.leyenda).toBe(LEYENDA_DISTANCIA_HAVERSINE);
    });
  });

  // =========================================================================
  // BLOQUE 2: Propiedades Matemáticas, Simetría y Formatos
  // =========================================================================
  describe('Bloque 2: Propiedades Matemáticas, Simetría y Formatos', () => {
    it('1. Simetría: la distancia de A a B es estrictamente igual a la distancia de B a A', () => {
      const puntoA = { latitud: -16.5235, longitud: -68.1425 };
      const puntoB = { latitud: -16.4957, longitud: -68.1335 };

      const resAB = distanciaHaversine(puntoA, puntoB);
      const resBA = distanciaHaversine(puntoB, puntoA);

      expect(resAB.metros).toBe(resBA.metros);
      expect(resAB.kilometros).toBe(resBA.kilometros);
      expect(resAB.distanciaCorta).toBe(resBA.distanciaCorta);
      expect(resAB.textoFormateado).toBe(resBA.textoFormateado);
    });

    it('2. Acepta indistintamente propiedades lat/lng y latitud/longitud', () => {
      const coordFormatoA = { lat: -16.5235, lng: -68.1425 };
      const coordFormatoB = { latitud: -16.528, longitud: -68.138 };

      const res = distanciaHaversine(coordFormatoA, coordFormatoB);

      expect(res.metros).toBe(693);
      expect(res.leyenda).toBe(LEYENDA_DISTANCIA_HAVERSINE);
    });

    it('3. Formato legible: distancia < 1000 m usa "m" y >= 1000 m usa "km"', () => {
      const cercano = distanciaHaversine(CENTRO_LLOJETA, {
        latitud: -16.5235,
        longitud: -68.1415, // ~107 m
      });
      expect(cercano.distanciaCorta).toContain('m');
      expect(cercano.distanciaCorta).not.toContain('km');

      const lejano = distanciaHaversine(CENTRO_LLOJETA, {
        latitud: -16.4957,
        longitud: -68.1335, // ~3.24 km
      });
      expect(lejano.distanciaCorta).toContain('km');
    });
  });

  // =========================================================================
  // BLOQUE 3: Validación de Coordenadas y Robustez ante Errores
  // =========================================================================
  describe('Bloque 3: Validación de Coordenadas y Robustez ante Errores', () => {
    it('1. esCoordenadaValida identifica correctamente valores válidos e inválidos', () => {
      // Válidos
      expect(esCoordenadaValida(0, 0)).toBe(true);
      expect(esCoordenadaValida(-16.5235, -68.1425)).toBe(true);
      expect(esCoordenadaValida('-16.5235', '-68.1425')).toBe(true);
      expect(esCoordenadaValida(90, 180)).toBe(true);
      expect(esCoordenadaValida(-90, -180)).toBe(true);

      // Inválidos
      expect(esCoordenadaValida(null, -68.14)).toBe(false);
      expect(esCoordenadaValida(-16.52, undefined)).toBe(false);
      expect(esCoordenadaValida(true, -68.14)).toBe(false);
      expect(esCoordenadaValida(-16.52, false)).toBe(false);
      expect(esCoordenadaValida(NaN, -68.14)).toBe(false);
      expect(esCoordenadaValida(-16.52, NaN)).toBe(false);
      expect(esCoordenadaValida('', -68.14)).toBe(false);
      expect(esCoordenadaValida('   ', -68.14)).toBe(false);
      expect(esCoordenadaValida(90.1, 0)).toBe(false);
      expect(esCoordenadaValida(-90.1, 0)).toBe(false);
      expect(esCoordenadaValida(0, 180.1)).toBe(false);
      expect(esCoordenadaValida(0, -180.1)).toBe(false);
    });

    it('2. distanciaHaversine lanza TypeError ante coordenadas inválidas o ausentes', () => {
      expect(() => distanciaHaversine(null, CENTRO_LLOJETA)).toThrow(TypeError);
      expect(() => distanciaHaversine(CENTRO_LLOJETA, undefined)).toThrow(
        TypeError
      );
      expect(() =>
        distanciaHaversine(
          { latitud: 95, longitud: -68.14 },
          CENTRO_LLOJETA
        )
      ).toThrow(TypeError);
      expect(() =>
        distanciaHaversine(
          CENTRO_LLOJETA,
          { latitud: -16.52, longitud: 200 }
        )
      ).toThrow(TypeError);
      expect(() =>
        distanciaHaversine(
          { latitud: 'no-es-numero', longitud: -68.14 },
          CENTRO_LLOJETA
        )
      ).toThrow(TypeError);
    });

    it('3. calcularDistanciasAPuntos enriquece puntos válidos o asigna null sin romper el flujo', () => {
      const puntos = [
        { id: 1, nombre: 'Punto Válido 1', latitud: -16.528, longitud: -68.138 },
        { id: 2, nombre: 'Punto Válido 2', latitud: -16.519, longitud: -68.149 },
        { id: 3, nombre: 'Punto Corrupto', latitud: 'invalido', longitud: null },
      ];

      // Caso 3.A: Ubicación de usuario válida
      const enriquecidos = calcularDistanciasAPuntos(CENTRO_LLOJETA, puntos);
      expect(enriquecidos).toHaveLength(3);
      expect(enriquecidos[0].distancia).not.toBeNull();
      expect(enriquecidos[0].distancia.metros).toBe(693);
      expect(enriquecidos[1].distancia).not.toBeNull();
      expect(enriquecidos[1].distancia.metros).toBe(855);
      expect(enriquecidos[2].distancia).toBeNull();

      // Caso 3.B: Ubicación de usuario null
      const sinUbicacion = calcularDistanciasAPuntos(null, puntos);
      expect(sinUbicacion).toHaveLength(3);
      expect(sinUbicacion[0].distancia).toBeNull();
      expect(sinUbicacion[1].distancia).toBeNull();
      expect(sinUbicacion[2].distancia).toBeNull();

      // Caso 3.C: Lista vacía o no array
      expect(calcularDistanciasAPuntos(CENTRO_LLOJETA, [])).toEqual([]);
      expect(calcularDistanciasAPuntos(CENTRO_LLOJETA, null)).toEqual([]);
    });
  });
});

