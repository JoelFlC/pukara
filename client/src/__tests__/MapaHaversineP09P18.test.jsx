/**
 * @file MapaHaversineP09P18.test.jsx
 * @description Suite de pruebas automatizadas para el Módulo 4 en React:
 * - 1. Verificación de la fórmula Haversine (Requisito P18) en cliente
 * - 2. Renderizado de Zonas y Puntos con procedencia, color neutro y leyenda obligatoria
 * - 3. Caso Funcional P09: Permiso GPS Denegado (PERMISSION_DENIED)
 * - 4. Caso Funcional P09/P18: Permiso GPS Concedido y Privacidad Absoluta (sin llamadas de red)
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

import MapaReferencial, {
  manejarExitoGeolocalizacion,
  manejarErrorGeolocalizacion,
  ESTILO_ZONA_NEUTRO,
} from '../components/MapaReferencial.jsx';
import {
  distanciaHaversine,
  esCoordenadaValida,
  calcularDistanciasAPuntos,
  LEYENDA_DISTANCIA_HAVERSINE,
} from '../utils/haversine.js';

describe('Semana 3 - Día 4 (Fase B): Mapa Referencial, Haversine P18 y Permiso GPS P09 (MapaHaversineP09P18.test.jsx)', () => {
  const CENTRO_LLOJETA = {
    latitud: -16.5235,
    longitud: -68.1425,
  };

  const mockZonasReferencia = [
    {
      id: 1,
      nombre: 'Sector Pasajahuira / Santa Rosa',
      fuente: 'Secretaría Municipal de Gestión Integral de Riesgos GAMLP',
      fecha_dato: '2026-10-23',
      vigente_hasta: '2026-11-30',
      verificada: true,
      advertencia: 'referencia de demostración, no validada',
    },
    {
      id: 2,
      nombre: 'Sector Llojeta Central',
      fuente: 'Propuesta académica PUKARA',
      fecha_dato: '2026-10-23',
      vigente_hasta: null,
      verificada: false,
      advertencia: 'referencia de demostración, no validada',
    },
  ];

  const mockPuntosReferencia = [
    {
      id: 1,
      nombre: 'Cruce Av. Los Sargentos y Av. Mario Mercado',
      tipo: 'interseccion',
      latitud: -16.528,
      longitud: -68.138,
      fuente: 'Levantamiento en campo PUKARA',
      estado_verificacion: 'verificado_por_autoridad',
      activo: true,
    },
    {
      id: 2,
      nombre: 'Cancha Bajo Llojeta',
      tipo: 'equipamiento',
      latitud: -16.519,
      longitud: -68.149,
      fuente: 'Cartografía Municipal La Paz',
      estado_verificacion: 'sin_verificar',
      activo: true,
    },
  ];

  let originalFetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  // =========================================================================
  // BLOQUE 1: Verificación de Haversine P18 en el Cliente (haversine.js)
  // =========================================================================
  describe('Bloque 1: Verificación del Motor Haversine P18 en el Cliente', () => {
    it('1.1. Coordenada idéntica arroja distancia cero (0 m)', () => {
      const res = distanciaHaversine(CENTRO_LLOJETA, CENTRO_LLOJETA);
      expect(res.metros).toBe(0);
      expect(res.distanciaCorta).toBe('0 m');
      expect(res.leyenda).toBe(LEYENDA_DISTANCIA_HAVERSINE);
    });

    it('1.2. Ubicación conocida 1: Centro Llojeta a Plaza Murillo (~3.23 km ± 25 m)', () => {
      const plazaMurillo = { latitud: -16.4957, longitud: -68.1335 };
      const res = distanciaHaversine(CENTRO_LLOJETA, plazaMurillo);

      expect(Math.abs(res.metros - 3234)).toBeLessThanOrEqual(25);
      expect(res.kilometros).toBeGreaterThanOrEqual(3.21);
      expect(res.kilometros).toBeLessThanOrEqual(3.26);
      expect(res.distanciaCorta).toMatch(/^3\.\d{1,2}\s*km$/);
    });

    it('1.3. Ubicación conocida 2: Centro Llojeta a Bajo Llojeta (~693 m ± 15 m)', () => {
      const bajoLlojeta = { latitud: -16.528, longitud: -68.138 };
      const res = distanciaHaversine(CENTRO_LLOJETA, bajoLlojeta);

      expect(Math.abs(res.metros - 693)).toBeLessThanOrEqual(15);
      expect(res.distanciaCorta).toBe(`${res.metros} m`);
    });

    it('1.4. Ubicación conocida 3: Centro Llojeta a Alto Llojeta (~854 m ± 15 m)', () => {
      const altoLlojeta = { latitud: -16.519, longitud: -68.149 };
      const res = distanciaHaversine(CENTRO_LLOJETA, altoLlojeta);

      expect(Math.abs(res.metros - 854)).toBeLessThanOrEqual(15);
      expect(res.distanciaCorta).toBe(`${res.metros} m`);
    });

    it('1.5. Simetría matemática y enriquecimiento seguro con calcularDistanciasAPuntos', () => {
      const puntoA = { lat: -16.5235, lng: -68.1425 };
      const puntoB = { lat: -16.528, lng: -68.138 };

      const resAB = distanciaHaversine(puntoA, puntoB);
      const resBA = distanciaHaversine(puntoB, puntoA);
      expect(resAB.metros).toBe(resBA.metros);

      const puntosEnriquecidos = calcularDistanciasAPuntos(
        CENTRO_LLOJETA,
        mockPuntosReferencia
      );
      expect(puntosEnriquecidos).toHaveLength(2);
      expect(puntosEnriquecidos[0].distancia.metros).toBe(693);
      expect(puntosEnriquecidos[1].distancia.metros).toBe(855);
    });
  });

  // =========================================================================
  // BLOQUE 2: Renderizado de Zonas y Puntos con Procedencia y Leyenda
  // =========================================================================
  describe('Bloque 2: Renderizado de Zonas y Puntos con Procedencia, Color Neutro y Leyenda', () => {
    it('2.1. Muestra la nota del indicador global, zonas en color neutro y atribución de OpenStreetMap', () => {
      const html = renderToStaticMarkup(
        <MapaReferencial
          zonasReferencia={mockZonasReferencia}
          puntosReferencia={mockPuntosReferencia}
          coordenadaCentral={CENTRO_LLOJETA}
          nivelVigente="EMERGENCIA"
        />
      );

      // Nota obligatoria de color neutro y alcance global
      expect(html).toContain('data-testid="nota-indicador-global"');
      expect(html).toContain(
        'El nivel informativo de lluvia es un indicador global para todo el sector piloto Llojeta / Bajo Llojeta y no varía espacialmente. Las zonas de referencia se representan en color neutro.'
      );

      // Verificación de constante de estilo neutro fijo
      expect(ESTILO_ZONA_NEUTRO.color).toBe('#475569');
      expect(ESTILO_ZONA_NEUTRO.fillColor).toBe('#64748b');

      // Atribución obligatoria de OpenStreetMap
      expect(html).toContain('OpenStreetMap');
      expect(html).toContain('https://www.openstreetmap.org/copyright');

      // Contenedor accesible del mapa
      expect(html).toContain('data-testid="mapa-leaflet-contenedor"');
      expect(html).toContain('Mapa del Sector Piloto Llojeta / Bajo Llojeta');
    });

    it('2.2. Renderiza la trazabilidad de zonas y puntos con fuente, fecha, estado y leyenda obligatoria', () => {
      const html = renderToStaticMarkup(
        <MapaReferencial
          zonasReferencia={mockZonasReferencia}
          puntosReferencia={mockPuntosReferencia}
          coordenadaCentral={CENTRO_LLOJETA}
          nivelVigente="NORMAL"
        />
      );

      // Zonas de referencia
      expect(html).toContain('data-testid="seccion-zonas-referencia"');
      expect(html).toContain('Sector Pasajahuira / Santa Rosa');
      expect(html).toContain('Secretaría Municipal de Gestión Integral de Riesgos GAMLP');
      expect(html).toContain('2026-10-23');
      expect(html).toContain('Verificada por autoridad');
      expect(html).toContain('Sector Llojeta Central');
      expect(html).toContain('Sin verificación oficial');

      // Puntos de referencia
      expect(html).toContain('data-testid="seccion-puntos-referencia"');
      expect(html).toContain('Cruce Av. Los Sargentos y Av. Mario Mercado');
      expect(html).toContain('Levantamiento en campo PUKARA');
      expect(html).toContain('Cancha Bajo Llojeta');

      // Leyenda obligatoria repetida de forma visible
      expect(html).toContain('referencia de demostración, no validada');

      // PROHIBICIÓN ESTRICTA: Sin botones de navegación ni rutas asistidas
      expect(html).not.toContain('C' + 'ómo llegar');
      expect(html).not.toContain('google.com/' + 'maps');
      expect(html).not.toContain('waze' + '.com');
      expect(html).not.toContain('ruta' + ' segura');
      expect(html).not.toContain('zona' + ' segura');
    });
  });

  // =========================================================================
  // BLOQUE 3: Caso Funcional P09 (Permiso GPS Denegado)
  // =========================================================================
  describe('Bloque 3: Caso Funcional P09 — Permiso GPS Denegado (PERMISSION_DENIED)', () => {
    it('3.1. Al denegarse el permiso GPS, despliega data-testid="aviso-gps-denegado" y no muestra distancias', () => {
      // Simulación de respuesta de error PERMISSION_DENIED (código 1)
      let estado = 'inactivo';
      let ubicacion = null;

      const setEstadoMock = (val) => {
        estado = val;
      };
      const setUbicacionMock = (val) => {
        ubicacion = val;
      };

      // Disparo de error de geolocalización
      manejarErrorGeolocalizacion(
        { code: 1, message: 'User denied Geolocation' },
        setEstadoMock,
        setUbicacionMock
      );

      expect(estado).toBe('denegado');
      expect(ubicacion).toBeNull();

      // Renderizado con estado denegado
      const htmlDenegado = renderToStaticMarkup(
        <MapaReferencial
          zonasReferencia={mockZonasReferencia}
          puntosReferencia={mockPuntosReferencia}
          coordenadaCentral={CENTRO_LLOJETA}
          estadoUbicacionInicial={estado}
          ubicacionInicial={ubicacion}
        />
      );

      // Verificación de contenedor de aviso y accesibilidad
      expect(htmlDenegado).toContain('data-testid="aviso-gps-denegado"');
      expect(htmlDenegado).toContain('role="status"');
      expect(htmlDenegado).toContain(
        'Permiso de ubicación denegado o no disponible: no se muestran distancias a los puntos de referencia. La consulta general del nivel informativo, las recomendaciones y el mapa referencial funcionan con normalidad.'
      );

      // No se muestra ninguna distancia calculada
      expect(htmlDenegado).not.toContain('data-testid="distancia-haversine"');
      expect(htmlDenegado).toContain('Distancia no calculada (active ubicación en el dispositivo)');

      // La consulta general, zonas y puntos siguen funcionando normalmente
      expect(htmlDenegado).toContain('Sector Pasajahuira / Santa Rosa');
      expect(htmlDenegado).toContain('Cruce Av. Los Sargentos y Av. Mario Mercado');
    });
  });

  // =========================================================================
  // BLOQUE 4: Caso Funcional P09/P18 (Permiso Concedido y Privacidad en Dispositivo)
  // =========================================================================
  describe('Bloque 4: Caso Permiso Concedido y Privacidad en Dispositivo (P09 y P18)', () => {
    it('4.1. Con GPS concedido, calcula distancias en dispositivo con leyenda obligatoria y sin llamadas de red', () => {
      // Simulación de éxito de geolocalización
      let estado = 'inactivo';
      let ubicacion = null;

      const setEstadoMock = (val) => {
        estado = val;
      };
      const setUbicacionMock = (val) => {
        ubicacion = val;
      };

      const posicionMock = {
        coords: {
          latitude: -16.5235,
          longitude: -68.1425,
          accuracy: 18,
        },
      };

      manejarExitoGeolocalizacion(
        posicionMock,
        setEstadoMock,
        setUbicacionMock
      );

      expect(estado).toBe('concedido');
      expect(ubicacion).toEqual({
        latitud: -16.5235,
        longitud: -68.1425,
        precision: 18,
      });

      // Renderizado con ubicación concedida
      const htmlConcedido = renderToStaticMarkup(
        <MapaReferencial
          zonasReferencia={mockZonasReferencia}
          puntosReferencia={mockPuntosReferencia}
          coordenadaCentral={CENTRO_LLOJETA}
          estadoUbicacionInicial={estado}
          ubicacionInicial={ubicacion}
        />
      );

      // Verificación del banner de precisión en dispositivo
      expect(htmlConcedido).toContain('data-testid="aviso-gps-concedido"');
      expect(htmlConcedido).toContain('Precisión: ±18 m');
      expect(htmlConcedido).toContain('Ocultar mi ubicación');

      // Verificación de distancias Haversine calculadas a los puntos
      expect(htmlConcedido).toContain('data-testid="distancia-haversine"');
      expect(htmlConcedido).toContain('Distancia en línea recta: 693 m');
      expect(htmlConcedido).toContain('Distancia en línea recta: 855 m');

      // Leyenda obligatoria rigurosa
      expect(htmlConcedido).toContain(
        'distancia aproximada en línea recta (no es recomendación de ruta ni indica seguridad)'
      );

      // CERTIFICACIÓN CRÍTICA DE PRIVACIDAD: fetch NUNCA fue llamado para enviar la ubicación
      expect(globalThis.fetch).not.toHaveBeenCalled();
    });
  });
});

