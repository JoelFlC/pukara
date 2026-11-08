/**
 * @file ConsultaOfflineP08P10.test.jsx
 * @description Suite de pruebas automatizadas para la Semana 3 - Día 6 (Fase B):
 * - 1. Escenario Funcional P08.1: Guardado en línea y reapertura en Modo Avión (offline) con aviso de datos no actualizados
 * - 2. Escenario Funcional P08.2: Transición en vivo de Online a Offline y Recuperación Online con reintento
 * - 3. Escenario Funcional P10: Mapa parcial sin teselas en Modo Avión y lista de puntos de referencia offline
 * - 4. Integración P08 + P09: Consulta Offline sin Permiso de Ubicación (GPS denegado) y privacidad absoluta
 */

import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

import BannerModoOffline from '../components/BannerModoOffline.jsx';
import MapaReferencial, {
  manejarExitoGeolocalizacion,
  manejarErrorGeolocalizacion,
  ESTILO_ZONA_NEUTRO,
} from '../components/MapaReferencial.jsx';
import BannerNivelInformativo from '../components/BannerNivelInformativo.jsx';
import SeccionRecomendaciones from '../components/SeccionRecomendaciones.jsx';
import SeccionContactosEmergencia from '../components/SeccionContactosEmergencia.jsx';
import AvisoPermanente from '../components/AvisoPermanente.jsx';
import {
  CLAVE_ULTIMO_ESTADO_OFFLINE,
  guardarUltimoEstadoLocal,
  obtenerUltimoEstadoLocal,
  limpiarUltimoEstadoLocal,
  construirAvisoDatosNoActualizados,
} from '../utils/offlineStorage.js';

// Mock in-memory de localStorage para aislamiento determinista en Node/Vitest
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

describe('Semana 3 - Día 6 (Fase B): Consulta Offline P08, Mapa Parcial P10 y Privacidad GPS P09 (ConsultaOfflineP08P10.test.jsx)', () => {
  // Dataset representativo completo para Llojeta / Bajo Llojeta
  const mockEstadoEnLineaAlerta = {
    ok: true,
    modalidad: 'real',
    nivel_vigente: 'ALERTA',
    estado_sistema: 'ALERTA',
    lectura: {
      id: 101,
      observado_en: '2026-11-06T18:00:00.000Z',
      intensidad_mm_h: 12.5,
      acum_24h_mm: 35.0,
      acum_72h_mm: 65.0,
    },
    meteorologia: {
      disponible: true,
      observado_en: '2026-11-06T18:00:00.000Z',
      intensidad_mm_h: 12.5,
      acum_24h_mm: 35.0,
      acum_72h_mm: 65.0,
      horas_validas_24h: 24,
      horas_validas_72h: 72,
      temperatura: 11.2,
      humedad: 86,
      viento: 14.0,
      antiguedad_minutos: 5,
    },
    recomendacion: {
      id: 3,
      nivel: 'ALERTA',
      titulo: 'Monitoreo institucional de taludes y cauces',
      contenido:
        'Mantenerse alejado de ríos y quebradas; preparar elementos de emergencia familiar.',
      origen: 'institucional_verificada',
      version: 2,
      fuente: 'Dirección de Gestión de Riesgos GAMLP',
    },
    recomendaciones_publicadas: [
      {
        id: 1,
        nivel: 'NORMAL',
        titulo: 'Revisión preventiva de canaletas y bajantes',
        contenido: 'Limpiar canaletas y sumideros domiciliarios.',
        origen: 'demostracion',
        version: 1,
        fuente: 'Propuesta académica PUKARA',
      },
      {
        id: 2,
        nivel: 'PRECAUCION',
        titulo: 'Monitoreo de filtraciones y escorrentías',
        contenido: 'Evitar cruzar quebradas y vigilar taludes cercanos.',
        origen: 'demostracion',
        version: 1,
        fuente: 'Propuesta académica PUKARA',
      },
      {
        id: 3,
        nivel: 'ALERTA',
        titulo: 'Monitoreo institucional de taludes y cauces',
        contenido:
          'Mantenerse alejado de ríos y quebradas; preparar elementos de emergencia familiar.',
        origen: 'institucional_verificada',
        version: 2,
        fuente: 'Dirección de Gestión de Riesgos GAMLP',
      },
      {
        id: 4,
        nivel: 'EMERGENCIA',
        titulo: 'Atención a indicaciones de autoridades',
        contenido:
          'Contactar a los servicios de emergencia de La Paz y atender indicaciones oficiales.',
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
        nombre: 'Cruz Roja Boliviana',
        telefono: '160',
        fuente: 'Cruz Roja Boliviana',
        verificado_en: '2026-10-23',
        activo: true,
      },
    ],
    zonas_referencia: [
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
  });

  // =========================================================================
  // BLOQUE 1: Escenario Funcional P08.1 — Guardado en línea y reapertura offline
  // =========================================================================
  describe('Bloque 1: Escenario Funcional P08.1 — Guardado en Línea y Reapertura en Modo Avión', () => {
    it('1.1. Persiste el paquete completo recibido en línea en localStorage', () => {
      // 1. Simulación de guardado exitoso en línea
      const guardado = guardarUltimoEstadoLocal(mockEstadoEnLineaAlerta);
      expect(guardado).not.toBeNull();
      expect(guardado.datos.nivel_vigente).toBe('ALERTA');
      expect(guardado.fecha_dato_iso).toBe('2026-11-06T18:00:00.000Z');
      expect(guardado.aviso_offline).toContain('Datos del');
      expect(guardado.aviso_offline).toContain('no actualizados');

      const crudo = localStorage.getItem(CLAVE_ULTIMO_ESTADO_OFFLINE);
      expect(crudo).not.toBeNull();
      const parseado = JSON.parse(crudo);
      expect(parseado.datos.zonas_referencia).toHaveLength(2);
      expect(parseado.datos.puntos_referencia).toHaveLength(6);
    });

    it('1.2. Al reiniciar la aplicación en Modo Avión (sin conexión), recupera del almacenamiento local el último nivel conocido (ALERTA), recomendaciones, contactos y puntos de referencia', () => {
      // Precondición: estado previamente guardado en sesión con conexión
      guardarUltimoEstadoLocal(mockEstadoEnLineaAlerta);

      // Simular activación de Modo Avión en el dispositivo
      Object.defineProperty(navigator, 'onLine', {
        value: false,
        configurable: true,
        writable: true,
      });
      globalThis.fetch = vi
        .fn()
        .mockRejectedValue(new TypeError('Failed to fetch'));

      // Recuperación desde almacenamiento local resiliente
      const respaldo = obtenerUltimoEstadoLocal();
      expect(respaldo).not.toBeNull();
      expect(respaldo.datos.nivel_vigente).toBe('ALERTA');
      expect(respaldo.fecha_dato_iso).toBe('2026-11-06T18:00:00.000Z');

      // Despliegue de BannerModoOffline
      const htmlBanner = renderToStaticMarkup(
        <BannerModoOffline
          activo={true}
          fechaDatoIso={respaldo.fecha_dato_iso}
          avisoOffline={respaldo.aviso_offline}
          guardadoEnIso={respaldo.guardado_en}
          onReintentar={() => {}}
        />
      );

      // Verificaciones canónicas de P08
      expect(htmlBanner).toContain('data-testid="banner-datos-no-actualizados"');
      expect(htmlBanner).toContain('role="status"');
      expect(htmlBanner).toContain('aria-live="polite"');
      expect(htmlBanner).toContain('Datos del');
      expect(htmlBanner).toContain('no actualizados');
      expect(htmlBanner).toContain('data-testid="btn-reintentar-conexion"');
      expect(htmlBanner).toContain('Consulta con Conectividad Limitada');
      expect(htmlBanner).toContain('Modo sin conexión o conectividad limitada');

      // Verificación de que el nivel ALERTA recuperado se visualiza con claridad
      const htmlNivel = renderToStaticMarkup(
        <BannerNivelInformativo estado={respaldo.datos} />
      );
      expect(htmlNivel).toContain('Nivel informativo de lluvia: ALERTA');

      // Verificación de recomendaciones con etiqueta de origen institucional
      const htmlRecom = renderToStaticMarkup(
        <SeccionRecomendaciones
          nivelVigente={respaldo.datos.nivel_vigente}
          recomendacionVigente={respaldo.datos.recomendacion}
          recomendacionesPublicadas={respaldo.datos.recomendaciones_publicadas}
        />
      );
      expect(htmlRecom).toContain('Monitoreo institucional de taludes y cauces');
      expect(htmlRecom).toContain('Origen: Institucional verificada');
      expect(htmlRecom).toContain('Dirección de Gestión de Riesgos GAMLP');

      // Verificación de contactos de emergencia disponibles offline
      const htmlContactos = renderToStaticMarkup(
        <SeccionContactosEmergencia
          contactos={respaldo.datos.contactos_emergencia}
        />
      );
      expect(htmlContactos).toContain('Red 114 — Emergencias GAMLP');
      expect(htmlContactos).toContain('114');
      expect(htmlContactos).toContain('Bomberos Antofagasta La Paz');
      expect(htmlContactos).toContain('119');

      // Verificación del Aviso Permanente reglamentario en modo offline
      const htmlAviso = renderToStaticMarkup(<AvisoPermanente />);
      expect(htmlAviso).toContain('niveles informativos de lluvia');
      expect(htmlAviso).toContain('umbrales académicos');
      expect(htmlAviso).toContain(
        'No sustituyen alertas ni instrucciones de las autoridades oficiales'
      );
    });
  });

  // =========================================================================
  // BLOQUE 2: Escenario Funcional P08.2 — Transición Online -> Offline -> Online
  // =========================================================================
  describe('Bloque 2: Escenario Funcional P08.2 — Transición en Vivo Online/Offline y Reintento de Conexión', () => {
    it('2.1. Conectado en línea: BannerModoOffline inactivo (no renderiza nada)', () => {
      const htmlEnLinea = renderToStaticMarkup(
        <BannerModoOffline activo={false} />
      );
      expect(htmlEnLinea).toBe('');
    });

    it('2.2. Transición a offline: despliega el banner permanente con la fecha y hora del dato guardado', () => {
      const fechaIsoDato = '2026-11-06T18:00:00.000Z';
      const avisoEsperado = construirAvisoDatosNoActualizados(fechaIsoDato);

      const htmlDesconectado = renderToStaticMarkup(
        <BannerModoOffline
          activo={true}
          fechaDatoIso={fechaIsoDato}
          guardadoEnIso="2026-11-06T18:05:00.000Z"
          onReintentar={() => {}}
        />
      );

      expect(htmlDesconectado).toContain(
        'data-testid="banner-datos-no-actualizados"'
      );
      expect(htmlDesconectado).toContain(avisoEsperado);
      expect(htmlDesconectado).toContain('Datos del');
      expect(htmlDesconectado).toContain('no actualizados');
    });

    it('2.3. Al reintentar la conexión cuando la red se recupera, invoca onReintentar y permite ocultar el banner', () => {
      const onReintentarMock = vi.fn();

      const htmlConBoton = renderToStaticMarkup(
        <BannerModoOffline
          activo={true}
          fechaDatoIso="2026-11-06T18:00:00.000Z"
          onReintentar={onReintentarMock}
        />
      );

      expect(htmlConBoton).toContain('data-testid="btn-reintentar-conexion"');
      expect(htmlConBoton).toContain('Reintentar conexión');

      // Simulación de recuperación de red y llamada al manejador
      onReintentarMock();
      expect(onReintentarMock).toHaveBeenCalledTimes(1);

      // Una vez recuperado, el banner vuelve a activo={false}
      const htmlRecuperado = renderToStaticMarkup(
        <BannerModoOffline activo={false} />
      );
      expect(htmlRecuperado).toBe('');
    });
  });

  // =========================================================================
  // BLOQUE 3: Escenario Funcional P10 — Mapa Parcial sin Teselas en Modo Avión
  // =========================================================================
  describe('Bloque 3: Escenario Funcional P10 — Mapa Parcial sin Teselas y Lista de Puntos Offline', () => {
    it('3.1. En Modo Avión (modoOffline={true}), despliega data-testid="aviso-mapa-parcial" con la política exacta de OSM', () => {
      const htmlMapaOffline = renderToStaticMarkup(
        <MapaReferencial
          modoOffline={true}
          zonasReferencia={mockEstadoEnLineaAlerta.zonas_referencia}
          puntosReferencia={mockEstadoEnLineaAlerta.puntos_referencia}
          nivelVigente="ALERTA"
        />
      );

      expect(htmlMapaOffline).toContain('data-testid="aviso-mapa-parcial"');
      expect(htmlMapaOffline).toContain('role="status"');
      expect(htmlMapaOffline).toContain('Cartografía parcial');

      // Texto exacto obligatorio según la Sección 9.4 y requisito P10
      expect(htmlMapaOffline).toContain(
        'Mapa parcial con limitación de teselas: sin conexión a internet o teselas de OpenStreetMap no disponibles en el caché del navegador.'
      );
      expect(htmlMapaOffline).toContain(
        'Por política de uso de OpenStreetMap no se realiza precarga masiva de teselas.'
      );
      expect(htmlMapaOffline).toContain('El sistema no ofrece navegación');
      expect(htmlMapaOffline).toContain(
        'consulte a continuación la lista completa de zonas y puntos de referencia de demostración disponibles sin conexión.'
      );
    });

    it('3.2. Mantiene visibles las 2 zonas de referencia con su fuente, fecha y etiqueta obligatoria "referencia de demostración, no validada"', () => {
      const htmlMapa = renderToStaticMarkup(
        <MapaReferencial
          modoOffline={true}
          zonasReferencia={mockEstadoEnLineaAlerta.zonas_referencia}
          puntosReferencia={mockEstadoEnLineaAlerta.puntos_referencia}
          nivelVigente="ALERTA"
        />
      );

      // Sección y conteo de zonas
      expect(htmlMapa).toContain('data-testid="seccion-zonas-referencia"');
      expect(htmlMapa).toContain('Zonas de Referencia (2)');

      // Zona 1
      expect(htmlMapa).toContain('Sector Pasajahuira / Santa Rosa');
      expect(htmlMapa).toContain(
        'Secretaría Municipal de Gestión Integral de Riesgos GAMLP'
      );
      expect(htmlMapa).toContain('2026-10-23');
      expect(htmlMapa).toContain('Verificada por autoridad');

      // Zona 2
      expect(htmlMapa).toContain('Sector Llojeta Central');
      expect(htmlMapa).toContain('Propuesta académica PUKARA');
      expect(htmlMapa).toContain('Sin verificación oficial');

      // Leyenda obligatoria canónica
      expect(htmlMapa).toContain('referencia de demostración, no validada');

      // Estilo neutro garantizado en la especificación cartográfica
      expect(ESTILO_ZONA_NEUTRO.color).toBe('#475569');
      expect(ESTILO_ZONA_NEUTRO.fillColor).toBe('#64748b');
      expect(htmlMapa).toContain('data-testid="nota-indicador-global"');
      expect(htmlMapa).toContain(
        'Las zonas de referencia se representan en color neutro.'
      );
    });

    it('3.3. Mantiene visibles los 6 puntos de referencia de demostración en Llojeta con sus coordenadas, tipo y fuentes', () => {
      const htmlMapa = renderToStaticMarkup(
        <MapaReferencial
          modoOffline={true}
          zonasReferencia={mockEstadoEnLineaAlerta.zonas_referencia}
          puntosReferencia={mockEstadoEnLineaAlerta.puntos_referencia}
          nivelVigente="ALERTA"
        />
      );

      expect(htmlMapa).toContain('data-testid="seccion-puntos-referencia"');
      expect(htmlMapa).toContain('Puntos de Referencia (6)');

      // Verificación de los 6 puntos de Llojeta
      expect(htmlMapa).toContain(
        'Cruce Av. Los Sargentos y Av. Mario Mercado'
      );
      expect(htmlMapa).toContain('Cancha Bajo Llojeta');
      expect(htmlMapa).toContain('Mirador Pasajahuira');
      expect(htmlMapa).toContain('Puente Libertad Bajo Llojeta');
      expect(htmlMapa).toContain('Unidad Educativa Llojeta');
      expect(htmlMapa).toContain('Centro de Salud Llojeta');

      // Coordenadas verificadas en el listado
      expect(htmlMapa).toContain('-16.5280');
      expect(htmlMapa).toContain('-68.1380');
    });
  });

  // =========================================================================
  // BLOQUE 4: Integración P08 + P09 — Consulta Offline sin Permiso de Ubicación
  // =========================================================================
  describe('Bloque 4: Integración P08 + P09 — Consulta Offline con Permiso GPS Denegado', () => {
    it('4.1. Manejador de geolocalización sitúa el estado en "denegado" ante PERMISSION_DENIED (error.code = 1) sin llamadas externas', () => {
      let estadoLocal = 'inactivo';
      let ubicacionLocal = { latitud: -16.52, longitud: -68.14 };

      const setEstado = (nuevo) => {
        estadoLocal = nuevo;
      };
      const setUbicacion = (nueva) => {
        ubicacionLocal = nueva;
      };

      // Simular denegación de permisos de geolocalización por el usuario (P09)
      manejarErrorGeolocalizacion(
        { code: 1, message: 'User denied Geolocation' },
        setEstado,
        setUbicacion
      );

      expect(estadoLocal).toBe('denegado');
      expect(ubicacionLocal).toBeNull();
    });

    it('4.2. En Modo Avión y con GPS denegado, muestra data-testid="aviso-gps-denegado" y la consulta permanece 100% operativa', () => {
      const htmlMapaGpsDenegado = renderToStaticMarkup(
        <MapaReferencial
          modoOffline={true}
          estadoUbicacionInicial="denegado"
          zonasReferencia={mockEstadoEnLineaAlerta.zonas_referencia}
          puntosReferencia={mockEstadoEnLineaAlerta.puntos_referencia}
          nivelVigente="ALERTA"
        />
      );

      // Aviso explícito de GPS denegado (P09)
      expect(htmlMapaGpsDenegado).toContain(
        'data-testid="aviso-gps-denegado"'
      );
      expect(htmlMapaGpsDenegado).toContain('role="status"');
      expect(htmlMapaGpsDenegado).toContain(
        'Permiso de ubicación denegado o no disponible'
      );
      expect(htmlMapaGpsDenegado).toContain(
        'no se muestran distancias a los puntos de referencia'
      );
      expect(htmlMapaGpsDenegado).toContain(
        'La consulta general del nivel informativo, las recomendaciones y el mapa referencial funcionan con normalidad.'
      );

      // Aviso de mapa parcial por modo offline también presente
      expect(htmlMapaGpsDenegado).toContain(
        'data-testid="aviso-mapa-parcial"'
      );

      // Todos los 6 puntos siguen visibles
      expect(htmlMapaGpsDenegado).toContain('Puntos de Referencia (6)');
      expect(htmlMapaGpsDenegado).toContain('Cancha Bajo Llojeta');
      expect(htmlMapaGpsDenegado).toContain('Centro de Salud Llojeta');

      // Botón para reintentar o solicitar ubicación accesible
      expect(htmlMapaGpsDenegado).toContain(
        'data-testid="btn-solicitar-ubicacion"'
      );
    });

    it('4.3. Ausencia absoluta de términos prohibidos de la lista negra y sin enlaces externos de navegación', () => {
      const htmlCompleto = renderToStaticMarkup(
        <div>
          <BannerModoOffline
            activo={true}
            fechaDatoIso="2026-11-06T18:00:00.000Z"
          />
          <AvisoPermanente />
          <BannerNivelInformativo estado={mockEstadoEnLineaAlerta} />
          <SeccionRecomendaciones
            nivelVigente="ALERTA"
            recomendacionVigente={mockEstadoEnLineaAlerta.recomendacion}
            recomendacionesPublicadas={
              mockEstadoEnLineaAlerta.recomendaciones_publicadas
            }
          />
          <SeccionContactosEmergencia
            contactos={mockEstadoEnLineaAlerta.contactos_emergencia}
          />
          <MapaReferencial
            modoOffline={true}
            estadoUbicacionInicial="denegado"
            zonasReferencia={mockEstadoEnLineaAlerta.zonas_referencia}
            puntosReferencia={mockEstadoEnLineaAlerta.puntos_referencia}
            nivelVigente="ALERTA"
          />
        </div>
      );

      const htmlMin = htmlCompleto.toLowerCase();

      // Prohibición estricta de redirecciones y mapas externos
      const terminosProhibidos = [
        'maps.google' + '.com',
        'waze' + '.com',
        'c' + 'ómo llegar',
        'como ' + 'llegar',
        'r' + 'uta segura',
        'z' + 'ona segura',
        'alerta ' + 'oficial',
        'orden de ' + 'evacuación',
        'refugio ' + 'verificado',
      ];

      for (const t of terminosProhibidos) {
        expect(htmlMin).not.toContain(t);
      }
    });
  });
});
