/**
 * @file integracionPwaOffline.s4d3.test.jsx
 * @description Suite de Integración Frontend de la Semana 4 - Día 3 (S4D3):
 * Certificación cruzada de Modo Avión / Offline (P08), Permiso GPS Denegado y Privacidad (P09),
 * Mapa Parcial sin Teselas (P10), Aviso Visual In-App (P06), Distancia Haversine en 4 ubicaciones (P18)
 * y Estructura Integral / Instalabilidad PWA en Android (P12).
 */

import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';

import AvisoPermanente from '../components/AvisoPermanente.jsx';
import BannerModoOffline from '../components/BannerModoOffline.jsx';
import BannerNivelInformativo from '../components/BannerNivelInformativo.jsx';
import TarjetaLecturaMeteorologica from '../components/TarjetaLecturaMeteorologica.jsx';
import SeccionRecomendaciones from '../components/SeccionRecomendaciones.jsx';
import SeccionContactosEmergencia from '../components/SeccionContactosEmergencia.jsx';
import AvisoCambioNivelInApp from '../components/AvisoCambioNivelInApp.jsx';
import EstadoPwaBanner from '../components/EstadoPwaBanner.jsx';
import MapaReferencial, {
  manejarExitoGeolocalizacion,
  manejarErrorGeolocalizacion,
  ESTILO_ZONA_NEUTRO,
} from '../components/MapaReferencial.jsx';
import {
  CLAVE_ULTIMO_ESTADO_OFFLINE,
  guardarUltimoEstadoLocal,
  obtenerUltimoEstadoLocal,
  construirAvisoDatosNoActualizados,
} from '../utils/offlineStorage.js';
import {
  distanciaHaversine,
  calcularDistanciasAPuntos,
  LEYENDA_DISTANCIA_HAVERSINE,
} from '../utils/haversine.js';
import { obtenerEstadoSistema } from '../services/api.js';
import { CONFIG_PWA_PUKARA } from '../../vite.config.js';

// Almacenamiento local simulado determinista para entorno Node/Vitest
const store = new Map();
const localStorageMock = {
  getItem: (k) => store.get(k) || null,
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
  clear: () => store.clear(),
};

Object.defineProperty(globalThis, 'localStorage', {
  value: localStorageMock,
  writable: true,
  configurable: true,
});

describe('SUITE DE INTEGRACIÓN FRONTEND S4D3 — MODO AVIÓN P08, GPS P09, MAPA PARCIAL P10, AVISO IN-APP P06, HAVERSINE P18 Y PWA P12', () => {
  const COORDENADA_CENTRAL_LLOJETA = {
    latitud: -16.5235,
    longitud: -68.1425,
  };

  const mockEstadoInicialPrecaucion = {
    ok: true,
    modalidad: 'real',
    nivel_vigente: 'PRECAUCION',
    estado_sistema: 'PRECAUCION',
    contador_descenso: 0,
    version_reglas: { version: 1 },
    lectura: {
      id: 301,
      observado_en: '2026-11-12T14:00:00.000Z',
      intensidad_mm_h: 3.2,
      acum_24h_mm: 18.5,
      acum_72h_mm: 36.0,
      fuente: 'Open-Meteo',
    },
    meteorologia: {
      disponible: true,
      observado_en: '2026-11-12T14:00:00.000Z',
      origen_respuesta: 'open_meteo',
      lectura: {
        id: 301,
        observado_en: '2026-11-12T14:00:00.000Z',
        intensidad_mm_h: 3.2,
        acum_24h_mm: 18.5,
        acum_72h_mm: 36.0,
        horas_validas_24h: 24,
        horas_validas_72h: 72,
        temperatura: 12.4,
        humedad: 82,
        viento: 11.0,
        antiguedad_minutos: 4,
        estado: 'valida',
      },
    },
    recomendacion: {
      id: 2,
      nivel: 'PRECAUCION',
      titulo: 'Vigilancia preventiva de drenajes y taludes',
      contenido:
        'Revisar sumideros domiciliarios, evitar acercarse a quebradas y mantener linterna disponible.',
      origen: 'demostracion',
      version: 1,
      fuente: 'Propuesta académica PUKARA',
    },
    recomendaciones_publicadas: [
      {
        id: 1,
        nivel: 'NORMAL',
        titulo: 'Mantenimiento preventivo habitual',
        contenido: 'Limpieza periódica de canaletas y desagües pluviales.',
        origen: 'demostracion',
        version: 1,
        fuente: 'Propuesta académica PUKARA',
      },
      {
        id: 2,
        nivel: 'PRECAUCION',
        titulo: 'Vigilancia preventiva de drenajes y taludes',
        contenido:
          'Revisar sumideros domiciliarios, evitar acercarse a quebradas y mantener linterna disponible.',
        origen: 'demostracion',
        version: 1,
        fuente: 'Propuesta académica PUKARA',
      },
      {
        id: 3,
        nivel: 'ALERTA',
        titulo: 'Monitoreo permanente de cauces y laderas en Llojeta',
        contenido:
          'Alejarse de márgenes de ríos y quebradas; preparar botiquín y documentos familiares.',
        origen: 'institucional_verificada',
        version: 2,
        fuente: 'Dirección de Gestión de Riesgos GAMLP',
      },
      {
        id: 4,
        nivel: 'EMERGENCIA',
        titulo: 'Atención prioritaria a instrucciones oficiales',
        contenido:
          'Comunicarse de inmediato con los servicios de emergencia de La Paz y acatar disposiciones de las autoridades.',
        origen: 'demostracion',
        version: 1,
        fuente: 'Propuesta académica PUKARA',
      },
    ],
    contactos_emergencia: [
      {
        id: 1,
        nombre: 'Red 114 — Emergencias GAMLP',
        telefono: '114',
        fuente: 'Gobierno Autónomo Municipal de La Paz',
        verificado_en: '2026-10-23',
        activo: true,
      },
      {
        id: 2,
        nombre: 'Bomberos Antofagasta La Paz',
        telefono: '119',
        fuente: 'Policía Boliviana',
        verificado_en: '2026-10-23',
        activo: true,
      },
      {
        id: 3,
        nombre: 'Cruz Roja Boliviana — Filial La Paz',
        telefono: '160',
        fuente: 'Cruz Roja Boliviana',
        verificado_en: '2026-10-23',
        activo: true,
      },
    ],
    zonas_referencia: [
      {
        id: 1,
        nombre: 'Sector Pasajahuira / Santa Rosa de Llojeta',
        fuente: 'Secretaría Municipal de Gestión Integral de Riesgos GAMLP',
        fecha_dato: '2026-10-23',
        vigente_hasta: '2026-12-31',
        verificada: true,
        advertencia: 'referencia de demostración, no validada',
      },
      {
        id: 2,
        nombre: 'Sector Bajo Llojeta / Cuenca Río Llojeta',
        fuente: 'Propuesta académica PUKARA',
        fecha_dato: '2026-10-23',
        vigente_hasta: null,
        verificada: false,
        advertencia: 'referencia de demostración, no validada',
      },
    ],
    puntos_referencia: [
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
      {
        id: 3,
        nombre: 'Mirador Pasajahuira',
        tipo: 'mirador',
        latitud: -16.525,
        longitud: -68.145,
        fuente: 'Propuesta académica PUKARA',
        estado_verificacion: 'sin_verificar',
        activo: true,
      },
      {
        id: 4,
        nombre: 'Puente Libertad Bajo Llojeta',
        tipo: 'infraestructura',
        latitud: -16.522,
        longitud: -68.14,
        fuente: 'GAMLP',
        estado_verificacion: 'verificado_por_autoridad',
        activo: true,
      },
      {
        id: 5,
        nombre: 'Unidad Educativa Llojeta',
        tipo: 'educacion',
        latitud: -16.526,
        longitud: -68.147,
        fuente: 'Distrito Educativo La Paz',
        estado_verificacion: 'sin_verificar',
        activo: true,
      },
      {
        id: 6,
        nombre: 'Centro de Salud Llojeta',
        tipo: 'salud',
        latitud: -16.521,
        longitud: -68.143,
        fuente: 'SEDES La Paz',
        estado_verificacion: 'verificado_por_autoridad',
        activo: true,
      },
    ],
  };

  const originalFetch = globalThis.fetch;
  const originalOnLine = navigator.onLine;
  const originalGeolocation = navigator.geolocation;

  beforeEach(() => {
    store.clear();
    vi.restoreAllMocks();
    Object.defineProperty(navigator, 'onLine', {
      value: true,
      configurable: true,
      writable: true,
    });
  });

  afterEach(() => {
    store.clear();
    globalThis.fetch = originalFetch;
    Object.defineProperty(navigator, 'onLine', {
      value: originalOnLine,
      configurable: true,
      writable: true,
    });
    Object.defineProperty(navigator, 'geolocation', {
      value: originalGeolocation,
      configurable: true,
      writable: true,
    });
  });

  // ===========================================================================
  // BLOQUE 1 — Certificación de P08 (Modo Avión / Consulta sin conexión)
  // ===========================================================================
  describe('Bloque 1 — Certificación de P08 (Modo Avión / Consulta sin conexión con almacenamiento local)', () => {
    it('1.1. Carga inicial exitosa con conexión (navigator.onLine = true) persiste estado, recomendaciones, contactos y los 6 puntos en offlineStorage, y al pasar a Modo Avión (navigator.onLine = false + Failed to fetch) renderiza el respaldo completo con "Datos del [fecha y hora], no actualizados" junto a <AvisoPermanente/>', async () => {
      // Fase 1: Dispositivo conectado a internet recibe GET /api/estado
      Object.defineProperty(navigator, 'onLine', {
        value: true,
        configurable: true,
        writable: true,
      });

      globalThis.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockEstadoInicialPrecaucion,
      });

      const datosEnLinea = await obtenerEstadoSistema('real');
      expect(datosEnLinea.nivel_vigente).toBe('PRECAUCION');
      expect(datosEnLinea.puntos_referencia).toHaveLength(6);

      const paqueteGuardado = guardarUltimoEstadoLocal(datosEnLinea);
      expect(paqueteGuardado).not.toBeNull();
      expect(paqueteGuardado.fecha_dato_iso).toBe('2026-11-12T14:00:00.000Z');
      expect(localStorage.getItem(CLAVE_ULTIMO_ESTADO_OFFLINE)).not.toBeNull();

      // Fase 2: Dispositivo entra en Modo Avión (navigator.onLine = false y fetch falla)
      Object.defineProperty(navigator, 'onLine', {
        value: false,
        configurable: true,
        writable: true,
      });
      globalThis.fetch = vi
        .fn()
        .mockRejectedValue(new TypeError('Failed to fetch'));

      let estadoRecuperado = null;
      let infoOffline = null;

      try {
        await obtenerEstadoSistema('real');
      } catch {
        const respaldo = obtenerUltimoEstadoLocal();
        estadoRecuperado = respaldo.datos;
        infoOffline = respaldo;
      }

      expect(estadoRecuperado).not.toBeNull();
      expect(estadoRecuperado.nivel_vigente).toBe('PRECAUCION');
      expect(estadoRecuperado.puntos_referencia).toHaveLength(6);
      expect(estadoRecuperado.contactos_emergencia).toHaveLength(3);
      expect(estadoRecuperado.recomendaciones_publicadas).toHaveLength(4);

      const avisoFechaExacto = construirAvisoDatosNoActualizados(
        '2026-11-12T14:00:00.000Z'
      );
      expect(infoOffline.aviso_offline).toBe(avisoFechaExacto);
      expect(infoOffline.aviso_offline).toMatch(/^Datos del .+, no actualizados$/);

      // Renderizado completo en Modo Avión
      const htmlModoAvion = renderToStaticMarkup(
        <MemoryRouter>
          <div>
            <BannerModoOffline
              activo={true}
              fechaDatoIso={infoOffline.fecha_dato_iso}
              avisoOffline={infoOffline.aviso_offline}
              guardadoEnIso={infoOffline.guardado_en_iso}
              onReintentar={() => {}}
            />
            <AvisoPermanente />
            <BannerNivelInformativo estado={estadoRecuperado} />
            <SeccionRecomendaciones
              nivelVigente={estadoRecuperado.nivel_vigente}
              estadoSistema={estadoRecuperado.estado_sistema}
              recomendacionVigente={estadoRecuperado.recomendacion}
              recomendacionesPublicadas={
                estadoRecuperado.recomendaciones_publicadas
              }
            />
            <SeccionContactosEmergencia
              contactos={estadoRecuperado.contactos_emergencia}
            />
            <MapaReferencial
              zonasReferencia={estadoRecuperado.zonas_referencia}
              puntosReferencia={estadoRecuperado.puntos_referencia}
              coordenadaCentral={COORDENADA_CENTRAL_LLOJETA}
              nivelVigente={estadoRecuperado.nivel_vigente}
              modoOffline={true}
            />
          </div>
        </MemoryRouter>
      );

      // Verificaciones obligatorias de P08
      expect(htmlModoAvion).toContain('data-testid="banner-datos-no-actualizados"');
      expect(htmlModoAvion).toContain(avisoFechaExacto);
      expect(htmlModoAvion).toContain('no actualizados');
      expect(htmlModoAvion).toContain('data-testid="aviso-permanente"');
      expect(htmlModoAvion).toContain(
        'Los niveles Normal, Precaución, Alerta y Emergencia son niveles informativos de lluvia'
      );
      expect(htmlModoAvion).toContain('Nivel informativo de lluvia: PRECAUCIÓN');
      expect(htmlModoAvion).toContain(
        'Vigilancia preventiva de drenajes y taludes'
      );
      expect(htmlModoAvion).toContain('Red 114 — Emergencias GAMLP');
      expect(htmlModoAvion).toContain('Puntos de Referencia (6)');
      expect(htmlModoAvion).toContain(
        'Cruce Av. Los Sargentos y Av. Mario Mercado'
      );
      expect(htmlModoAvion).toContain('Centro de Salud Llojeta');
    });
  });

  // ===========================================================================
  // BLOQUE 2 — Certificación de P09 (Permiso GPS denegado y privacidad)
  // ===========================================================================
  describe('Bloque 2 — Certificación de P09 (Permiso de ubicación GPS denegado y privacidad en dispositivo)', () => {
    it('2.1. Cuando navigator.geolocation.getCurrentPosition devuelve code = 1 (PERMISSION_DENIED), la consulta general sigue operativa al 100%, no se muestran distancias calculadas, se explica el motivo y ninguna llamada a fetch envía coordenadas al servidor', () => {
      const fetchSpy = vi.fn();
      globalThis.fetch = fetchSpy;

      // Mock de navigator.geolocation que invoca error code = 1 (PERMISSION_DENIED)
      const getCurrentPositionMock = vi.fn((_onSuccess, onError) => {
        onError({
          code: 1,
          PERMISSION_DENIED: 1,
          message: 'User denied Geolocation',
        });
      });

      Object.defineProperty(navigator, 'geolocation', {
        value: { getCurrentPosition: getCurrentPositionMock },
        configurable: true,
        writable: true,
      });

      let estadoGps = 'inactivo';
      let ubicacionGps = null;

      navigator.geolocation.getCurrentPosition(
        (pos) =>
          manejarExitoGeolocalizacion(
            pos,
            (s) => {
              estadoGps = s;
            },
            (u) => {
              ubicacionGps = u;
            }
          ),
        (err) =>
          manejarErrorGeolocalizacion(
            err,
            (s) => {
              estadoGps = s;
            },
            (u) => {
              ubicacionGps = u;
            }
          )
      );

      expect(getCurrentPositionMock).toHaveBeenCalledTimes(1);
      expect(estadoGps).toBe('denegado');
      expect(ubicacionGps).toBeNull();

      // Renderizar la vista completa con el estado GPS denegado
      const htmlConGpsDenegado = renderToStaticMarkup(
        <MemoryRouter>
          <div>
            <AvisoPermanente />
            <BannerNivelInformativo estado={mockEstadoInicialPrecaucion} />
            <SeccionRecomendaciones
              nivelVigente={mockEstadoInicialPrecaucion.nivel_vigente}
              recomendacionVigente={mockEstadoInicialPrecaucion.recomendacion}
              recomendacionesPublicadas={
                mockEstadoInicialPrecaucion.recomendaciones_publicadas
              }
            />
            <SeccionContactosEmergencia
              contactos={mockEstadoInicialPrecaucion.contactos_emergencia}
            />
            <MapaReferencial
              zonasReferencia={mockEstadoInicialPrecaucion.zonas_referencia}
              puntosReferencia={mockEstadoInicialPrecaucion.puntos_referencia}
              coordenadaCentral={COORDENADA_CENTRAL_LLOJETA}
              nivelVigente={mockEstadoInicialPrecaucion.nivel_vigente}
              estadoUbicacionInicial={estadoGps}
              ubicacionInicial={ubicacionGps}
            />
          </div>
        </MemoryRouter>
      );

      // 1. Consulta general funciona al 100%
      expect(htmlConGpsDenegado).toContain(
        'Nivel informativo de lluvia: PRECAUCIÓN'
      );
      expect(htmlConGpsDenegado).toContain(
        'Vigilancia preventiva de drenajes y taludes'
      );
      expect(htmlConGpsDenegado).toContain('Red 114 — Emergencias GAMLP');
      expect(htmlConGpsDenegado).toContain('Puntos de Referencia (6)');

      // 2. NO se muestran distancias numéricas calculadas
      expect(htmlConGpsDenegado).not.toContain(
        'data-testid="distancia-haversine"'
      );
      expect(htmlConGpsDenegado).toContain(
        'Distancia no calculada (active ubicación en el dispositivo)'
      );

      // 3. Se muestra el mensaje explicativo del motivo (permiso de ubicación denegado)
      expect(htmlConGpsDenegado).toContain('data-testid="aviso-gps-denegado"');
      expect(htmlConGpsDenegado).toContain(
        'Permiso de ubicación denegado o no disponible: no se muestran distancias a los puntos de referencia. La consulta general del nivel informativo, las recomendaciones y el mapa referencial funcionan con normalidad.'
      );

      // 4. Privacidad absoluta: ninguna petición fetch fue disparada para enviar coordenadas al backend
      expect(fetchSpy).not.toHaveBeenCalled();
    });
  });

  // ===========================================================================
  // BLOQUE 3 — Certificación de P10 (Mapa parcial sin teselas en desconexión)
  // ===========================================================================
  describe('Bloque 3 — Certificación de P10 (Mapa parcial sin teselas en desconexión / fallo de OpenStreetMap)', () => {
    it('3.1. Ante desconexión o fallo de carga de teselas de OpenStreetMap, muestra el aviso de mapa parcial sin teselas, mantiene accesible el listado de zonas y puntos con "referencia de demostración, no validada" y carece de enlaces de navegación o botones prohibidos', () => {
      Object.defineProperty(navigator, 'onLine', {
        value: false,
        configurable: true,
        writable: true,
      });

      const htmlMapaParcial = renderToStaticMarkup(
        <MapaReferencial
          zonasReferencia={mockEstadoInicialPrecaucion.zonas_referencia}
          puntosReferencia={mockEstadoInicialPrecaucion.puntos_referencia}
          coordenadaCentral={COORDENADA_CENTRAL_LLOJETA}
          nivelVigente="ALERTA"
          modoOffline={true}
        />
      );

      // Aviso de limitación de mapa parcial sin teselas disponibles
      expect(htmlMapaParcial).toContain('data-testid="aviso-mapa-parcial"');
      expect(htmlMapaParcial).toContain('Cartografía parcial');
      expect(htmlMapaParcial).toContain(
        'Mapa parcial con limitación de teselas: sin conexión a internet o teselas de OpenStreetMap no disponibles en el caché del navegador.'
      );
      expect(htmlMapaParcial).toContain(
        'Por política de uso de OpenStreetMap no se realiza precarga masiva de teselas.'
      );

      // Lista textual de zonas y puntos de referencia accesible con etiqueta canónica
      expect(htmlMapaParcial).toContain('data-testid="seccion-zonas-referencia"');
      expect(htmlMapaParcial).toContain(
        'Sector Pasajahuira / Santa Rosa de Llojeta'
      );
      expect(htmlMapaParcial).toContain(
        'Sector Bajo Llojeta / Cuenca Río Llojeta'
      );
      expect(htmlMapaParcial).toContain('data-testid="seccion-puntos-referencia"');
      expect(htmlMapaParcial).toContain('Puntos de Referencia (6)');
      expect(htmlMapaParcial).toContain('referencia de demostración, no validada');

      // Tono neutro inmutable para polígonos
      expect(ESTILO_ZONA_NEUTRO.color).toBe('#475569');
      expect(ESTILO_ZONA_NEUTRO.fillColor).toBe('#64748b');

      // Prohibición estricta de botones de navegación o redirecciones externas
      const htmlLower = htmlMapaParcial.toLowerCase();
      const prohibidos = [
        ['c', 'ómo llegar'].join(''),
        ['como ', 'llegar'].join(''),
        ['maps.google', '.com'].join(''),
        ['waze', '.com'].join(''),
        ['ruta ', 'segura'].join(''),
        ['zona ', 'segura'].join(''),
      ];
      for (const termino of prohibidos) {
        expect(htmlLower).not.toContain(termino);
      }
    });
  });

  // ===========================================================================
  // BLOQUE 4 — Certificación de P06 (Aviso visual in-app ante cambio de nivel)
  // ===========================================================================
  describe('Bloque 4 — Certificación de P06 (Aviso visual in-app al cambiar el nivel informativo con la aplicación abierta)', () => {
    it('4.1. Al actualizar el estado de PRECAUCION a ALERTA con la vista abierta, despliega el aviso visual in-app (role="status", aria-live="polite"), actualiza las recomendaciones a ALERTA y no utiliza APIs de Web Push / notificaciones en segundo plano', () => {
      // Estado inicial: PRECAUCION (no hay aviso de cambio en la primera carga)
      const htmlCargaInicial = renderToStaticMarkup(
        <div>
          <AvisoCambioNivelInApp cambioNivel={null} onCerrar={() => {}} />
          <SeccionRecomendaciones
            nivelVigente="PRECAUCION"
            estadoSistema="PRECAUCION"
            recomendacionVigente={mockEstadoInicialPrecaucion.recomendacion}
            recomendacionesPublicadas={
              mockEstadoInicialPrecaucion.recomendaciones_publicadas
            }
          />
        </div>
      );
      expect(htmlCargaInicial).not.toContain(
        'data-testid="aviso-cambio-nivel-inapp"'
      );
      expect(htmlCargaInicial).toContain(
        'Recomendaciones Preventivas para PRECAUCION'
      );

      // Actualización posterior en sesión abierta: cambia de PRECAUCION a ALERTA
      const recomendacionAlerta =
        mockEstadoInicialPrecaucion.recomendaciones_publicadas.find(
          (r) => r.nivel === 'ALERTA'
        );

      const cambioDetectado = {
        nivelAnterior: 'PRECAUCION',
        nivelNuevo: 'ALERTA',
        modalidad: 'real',
        detectadoEn: '2026-11-12T14:15:00.000Z',
        recomendacion: recomendacionAlerta,
      };

      const htmlActualizado = renderToStaticMarkup(
        <div>
          <AvisoCambioNivelInApp
            cambioNivel={cambioDetectado}
            onCerrar={() => {}}
          />
          <SeccionRecomendaciones
            nivelVigente="ALERTA"
            estadoSistema="ALERTA"
            recomendacionVigente={recomendacionAlerta}
            recomendacionesPublicadas={
              mockEstadoInicialPrecaucion.recomendaciones_publicadas
            }
          />
        </div>
      );

      // 1. Aparece el aviso visual in-app con role="status" y aria-live="polite"
      expect(htmlActualizado).toContain('data-testid="aviso-cambio-nivel-inapp"');
      expect(htmlActualizado).toContain('role="status"');
      expect(htmlActualizado).toContain('aria-live="polite"');
      expect(htmlActualizado).toContain(
        'Cambio en el nivel informativo de lluvia: de PRECAUCION a ALERTA'
      );

      // 2. Se actualizan las recomendaciones al nivel ALERTA con su etiqueta de origen
      expect(htmlActualizado).toContain(
        'Recomendaciones Preventivas para ALERTA'
      );
      expect(htmlActualizado).toContain(
        'Monitoreo permanente de cauces y laderas en Llojeta'
      );
      expect(htmlActualizado).toContain('Origen: Institucional verificada');

      // 3. Nota explícita de que es un aviso in-app y NO una notificación remota / Web Push
      expect(htmlActualizado).toContain(
        'Aviso visual dentro de la aplicación (solo mientras la aplicación permanece abierta; no es una notificación remota ni sustituye canales oficiales).'
      );
    });
  });

  // ===========================================================================
  // BLOQUE 5 — Certificación de P18 (Distancia Haversine en 4 ubicaciones)
  // ===========================================================================
  describe('Bloque 5 — Certificación de P18 (Distancia Haversine en 4 ubicaciones de prueba con distancia conocida)', () => {
    it('5.1. Verifica con precisión matemática las 4 ubicaciones de referencia hacia la coordenada central de Llojeta (-16.5235, -68.1425)', () => {
      // 1. Ubicación 1: Mismo punto central Llojeta (-16.5235, -68.1425) -> 0.00 km (tolerancia < 0.001 km)
      const ub1MismoPunto = { latitud: -16.5235, longitud: -68.1425 };
      const calc1 = distanciaHaversine(ub1MismoPunto, COORDENADA_CENTRAL_LLOJETA);
      expect(calc1.kilometros).toBeLessThan(0.001);
      expect(calc1.metros).toBe(0);
      expect(calc1.leyenda).toBe(LEYENDA_DISTANCIA_HAVERSINE);

      // 2. Ubicación 2: Sector Bajo Llojeta / Av. Costanera (-16.5280, -68.1380) -> ~0.69 km (± 0.05 km)
      const ub2BajoLlojeta = { latitud: -16.528, longitud: -68.138 };
      const calc2 = distanciaHaversine(
        ub2BajoLlojeta,
        COORDENADA_CENTRAL_LLOJETA
      );
      expect(Math.abs(calc2.kilometros - 0.69)).toBeLessThanOrEqual(0.05);
      expect(calc2.metros).toBeGreaterThanOrEqual(640);
      expect(calc2.metros).toBeLessThanOrEqual(740);

      // 3. Ubicación 3: Plaza Murillo / Centro La Paz (-16.4957, -68.1335) -> ~3.24 km (± 0.05 km)
      const ub3PlazaMurillo = { latitud: -16.4957, longitud: -68.1335 };
      const calc3 = distanciaHaversine(
        ub3PlazaMurillo,
        COORDENADA_CENTRAL_LLOJETA
      );
      expect(Math.abs(calc3.kilometros - 3.24)).toBeLessThanOrEqual(0.05);

      // 4. Ubicación 4: Ceja de El Alto (-16.5048, -68.1624) -> ~2.98 km (± 0.05 km)
      const ub4CejaElAlto = { latitud: -16.5048, longitud: -68.1624 };
      const calc4 = distanciaHaversine(ub4CejaElAlto, COORDENADA_CENTRAL_LLOJETA);
      expect(Math.abs(calc4.kilometros - 2.98)).toBeLessThanOrEqual(0.05);
    });

    it('5.2. Al disponer de una ubicación válida en la UI, calcula la distancia a los 6 puntos de referencia y muestra obligatoriamente la leyenda canónica', () => {
      const fetchSpy = vi.fn();
      globalThis.fetch = fetchSpy;

      const ubicacionValida = {
        latitud: -16.4957,
        longitud: -68.1335,
        precision: 12,
      };

      const puntosEnriquecidos = calcularDistanciasAPuntos(
        ubicacionValida,
        mockEstadoInicialPrecaucion.puntos_referencia
      );
      expect(puntosEnriquecidos).toHaveLength(6);
      puntosEnriquecidos.forEach((p) => {
        expect(p.distancia).not.toBeNull();
        expect(p.distancia.leyenda).toBe(
          'distancia aproximada en línea recta (no es recomendación de ruta ni indica seguridad)'
        );
      });

      const htmlMapaConGps = renderToStaticMarkup(
        <MapaReferencial
          zonasReferencia={mockEstadoInicialPrecaucion.zonas_referencia}
          puntosReferencia={mockEstadoInicialPrecaucion.puntos_referencia}
          coordenadaCentral={COORDENADA_CENTRAL_LLOJETA}
          nivelVigente="PRECAUCION"
          estadoUbicacionInicial="concedido"
          ubicacionInicial={ubicacionValida}
        />
      );

      expect(htmlMapaConGps).toContain('data-testid="aviso-gps-concedido"');
      expect(htmlMapaConGps).toContain('data-testid="distancia-haversine"');
      expect(htmlMapaConGps).toContain(
        'distancia aproximada en línea recta (no es recomendación de ruta ni indica seguridad)'
      );
      expect(fetchSpy).not.toHaveBeenCalled();
    });
  });

  // ===========================================================================
  // BLOQUE 6 — Certificación de P12 (Flujos principales e instalabilidad PWA)
  // ===========================================================================
  describe('Bloque 6 — Certificación de P12 (Estructura de flujos principales e instalabilidad PWA)', () => {
    it('6.1. Expone todos los bloques principales en consulta móvil/desktop (Aviso permanente, Nivel informativo, Telemetría, Recomendaciones, Contactos y Cartografía referencial) y configuración PWA standalone', () => {
      expect(CONFIG_PWA_PUKARA.manifest.display).toBe('standalone');
      expect(CONFIG_PWA_PUKARA.manifest.short_name).toBe('PUKARA');

      const htmlFlujoCompleto = renderToStaticMarkup(
        <MemoryRouter>
          <div>
            <EstadoPwaBanner instalableInicial={true} />
            <AvisoPermanente />
            <BannerNivelInformativo estado={mockEstadoInicialPrecaucion} />
            <TarjetaLecturaMeteorologica
              meteorologia={mockEstadoInicialPrecaucion.meteorologia}
            />
            <SeccionRecomendaciones
              nivelVigente={mockEstadoInicialPrecaucion.nivel_vigente}
              estadoSistema={mockEstadoInicialPrecaucion.estado_sistema}
              recomendacionVigente={mockEstadoInicialPrecaucion.recomendacion}
              recomendacionesPublicadas={
                mockEstadoInicialPrecaucion.recomendaciones_publicadas
              }
            />
            <SeccionContactosEmergencia
              contactos={mockEstadoInicialPrecaucion.contactos_emergencia}
            />
            <MapaReferencial
              zonasReferencia={mockEstadoInicialPrecaucion.zonas_referencia}
              puntosReferencia={mockEstadoInicialPrecaucion.puntos_referencia}
              coordenadaCentral={COORDENADA_CENTRAL_LLOJETA}
              nivelVigente={mockEstadoInicialPrecaucion.nivel_vigente}
            />
          </div>
        </MemoryRouter>
      );

      // 1. Banner de instalación PWA
      expect(htmlFlujoCompleto).toContain('data-testid="banner-instalacion-pwa"');
      expect(htmlFlujoCompleto).toContain('data-testid="btn-instalar-pwa"');

      // 2. Aviso permanente obligatorio
      expect(htmlFlujoCompleto).toContain('data-testid="aviso-permanente"');
      expect(htmlFlujoCompleto).toContain('niveles informativos de lluvia');

      // 3. Nivel informativo
      expect(htmlFlujoCompleto).toContain(
        'Nivel informativo de lluvia: PRECAUCIÓN'
      );

      // 4. Telemetría pluviométrica
      expect(htmlFlujoCompleto).toContain('3.2');
      expect(htmlFlujoCompleto).toContain('18.5');
      expect(htmlFlujoCompleto).toContain('36');

      // 5. Recomendaciones preventivas
      expect(htmlFlujoCompleto).toContain(
        'Recomendaciones Preventivas para PRECAUCION'
      );

      // 6. Contactos de emergencia
      expect(htmlFlujoCompleto).toContain(
        'Contactos de Emergencia — La Paz / Cotahuma'
      );
      expect(htmlFlujoCompleto).toContain('href="tel:114"');

      // 7. Cartografía referencial
      expect(htmlFlujoCompleto).toContain(
        'Mapa del Sector Piloto Llojeta / Bajo Llojeta'
      );
      expect(htmlFlujoCompleto).toContain('Puntos de Referencia (6)');
    });
  });
});
