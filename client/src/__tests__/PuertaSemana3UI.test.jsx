/**
 * @file PuertaSemana3UI.test.jsx
 * @description Suite Automatizada de Certificación de la Puerta de Calidad Semana 3 en Frontend:
 * "Todas las funciones obligatorias implementadas: login, panel, recomendaciones, mapa, offline"
 *
 * Controles de Verificación de UI:
 * - 1. Presencia Inamovible de <AvisoPermanente/> y "nivel informativo de lluvia" en Todas las Vistas
 * - 2. Integración Simultánea de Componentes (Nivel Informativo, Recomendaciones, Contactos, Mapa, PWA)
 * - 3. Resiliencia de Modos Offline (P08), Mapa Parcial (P10) y Aviso Visual In-App (P06)
 * - 4. Auditoría Semántica Estricta en la Interfaz (Lista Negra y Lista Blanca)
 */

import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';

import AvisoPermanente from '../components/AvisoPermanente.jsx';
import AdminLogin from '../components/AdminLogin.jsx';
import PanelAdministracion from '../components/PanelAdministracion.jsx';
import BannerModoOffline from '../components/BannerModoOffline.jsx';
import BannerNivelInformativo from '../components/BannerNivelInformativo.jsx';
import SeccionRecomendaciones from '../components/SeccionRecomendaciones.jsx';
import SeccionContactosEmergencia from '../components/SeccionContactosEmergencia.jsx';
import MapaReferencial, {
  ESTILO_ZONA_NEUTRO,
} from '../components/MapaReferencial.jsx';
import AvisoCambioNivelInApp from '../components/AvisoCambioNivelInApp.jsx';
import EstadoPwaBanner from '../components/EstadoPwaBanner.jsx';
import TarjetaLecturaMeteorologica from '../components/TarjetaLecturaMeteorologica.jsx';
import {
  guardarTokenAdmin,
  guardarUsuarioAdmin,
  logoutAdmin,
} from '../api/adminApi.js';
import {
  guardarUltimoEstadoLocal,
  obtenerUltimoEstadoLocal,
} from '../utils/offlineStorage.js';

// Mock in-memory de localStorage
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

describe('PUERTA DE CALIDAD SEMANA 3 (S3D7 - Fase B): Interfaz de Usuario y Vistas Integradas (PuertaSemana3UI.test.jsx)', () => {
  const mockEstadoGeneral = {
    ok: true,
    modalidad: 'real',
    nivel_vigente: 'ALERTA',
    estado_sistema: 'ALERTA',
    meteorologia: {
      disponible: true,
      observado_en: '2026-11-06T18:00:00.000Z',
      origen_respuesta: 'open_meteo',
      lectura: {
        id: 101,
        observado_en: '2026-11-06T18:00:00.000Z',
        intensidad_mm_h: 12.5,
        acum_24h_mm: 35.0,
        acum_72h_mm: 65.0,
        temperatura: 11.2,
        humedad: 86,
        viento: 14.0,
        antiguedad_minutos: 5,
        estado: 'valida',
      },
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
    ],
  };

  beforeEach(() => {
    store.clear();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    store.clear();
  });

  // =========================================================================
  // BLOQUE 1: Presencia Inamovible de <AvisoPermanente/> y Semántica Reglamentaria
  // =========================================================================
  describe('Bloque 1: Presencia Inamovible de <AvisoPermanente/> en Todas las Vistas', () => {
    const TEXTO_CANONICO_AVISO =
      'Los niveles Normal, Precaución, Alerta y Emergencia son niveles informativos de lluvia: niveles meteorológicos simulados, calculados con umbrales académicos. No sustituyen alertas ni instrucciones de las autoridades oficiales.';

    it('1.1. Vista de Consulta Pública en línea renderiza el Aviso Permanente', () => {
      const htmlPublico = renderToStaticMarkup(
        <MemoryRouter>
          <div>
            <EstadoPwaBanner />
            <AvisoPermanente />
            <BannerNivelInformativo estado={mockEstadoGeneral} />
          </div>
        </MemoryRouter>
      );

      expect(htmlPublico).toContain(TEXTO_CANONICO_AVISO);
      expect(htmlPublico.toLowerCase()).toContain('nivel informativo de lluvia');
      expect(htmlPublico).toContain('PUKARA muestra información bajo consulta');
    });

    it('1.2. Vista de Consulta Pública en Modo Avión (P08) renderiza simultáneamente el Banner Offline y el Aviso Permanente', () => {
      const htmlOffline = renderToStaticMarkup(
        <MemoryRouter>
          <div>
            <BannerModoOffline
              activo={true}
              fechaDatoIso="2026-11-06T18:00:00.000Z"
              onReintentar={() => {}}
            />
            <AvisoPermanente />
            <BannerNivelInformativo estado={mockEstadoGeneral} />
          </div>
        </MemoryRouter>
      );

      // Aviso permanente legal
      expect(htmlOffline).toContain(TEXTO_CANONICO_AVISO);
      // Banner offline obligatorio de P08
      expect(htmlOffline).toContain('data-testid="banner-datos-no-actualizados"');
      expect(htmlOffline).toContain('Datos del');
      expect(htmlOffline).toContain('no actualizados');
      expect(htmlOffline).toContain('data-testid="btn-reintentar-conexion"');
    });

    it('1.3. Vista de Acceso Administrativo (AdminLogin sin sesión) renderiza el Aviso Permanente', () => {
      const htmlLogin = renderToStaticMarkup(
        <MemoryRouter>
          <AdminLogin alIniciarSesion={() => {}} />
        </MemoryRouter>
      );

      expect(htmlLogin).toContain('Acceso Administrativo');
      expect(htmlLogin).toContain(TEXTO_CANONICO_AVISO);
      expect(htmlLogin).toContain('Volver a la Consulta Pública');
    });

    it('1.4. Vista del Panel de Administración (PanelAdministracion con sesión) renderiza el Aviso Permanente', () => {
      guardarTokenAdmin('fake-token-admin-s3');
      guardarUsuarioAdmin({
        id: 1,
        email: 'admin@pukara.bo',
        nombre: 'Administrador PUKARA',
        rol: 'administrador',
      });

      const htmlPanel = renderToStaticMarkup(
        <MemoryRouter>
          <PanelAdministracion alCerrarSesion={() => {}} />
        </MemoryRouter>
      );

      expect(htmlPanel).toContain('Panel de Administración PUKARA');
      expect(htmlPanel).toContain('1. Umbrales y Reglas (P05/P16)');
      expect(htmlPanel).toContain(TEXTO_CANONICO_AVISO);
    });
  });

  // =========================================================================
  // BLOQUE 2: Integración Simultánea de Componentes en Consulta Pública
  // =========================================================================
  describe('Bloque 2: Integración Simultánea de Componentes en la Consulta Pública', () => {
    it('2.1. Despliega conjuntamente el Banner de Nivel Informativo y las Lecturas Meteorológicas', () => {
      const html = renderToStaticMarkup(
        <div>
          <BannerNivelInformativo estado={mockEstadoGeneral} />
          <TarjetaLecturaMeteorologica
            meteorologia={mockEstadoGeneral.meteorologia}
          />
        </div>
      );

      // Nivel informativo y color
      expect(html).toContain('Nivel informativo de lluvia: ALERTA');
      expect(html).toContain('Sector Piloto Llojeta / Bajo Llojeta');
      // Variables meteorológicas
      expect(html).toContain('12.5'); // Intensidad
      expect(html).toContain('35'); // Acum 24h
      expect(html).toContain('65'); // Acum 72h
      expect(html).toContain('mm/h');
    });

    it('2.2. Despliega las Recomendaciones Preventivas con Etiqueta de Origen y los Contactos de Emergencia', () => {
      const html = renderToStaticMarkup(
        <div>
          <SeccionRecomendaciones
            nivelVigente="ALERTA"
            recomendacionVigente={mockEstadoGeneral.recomendacion}
            recomendacionesPublicadas={
              mockEstadoGeneral.recomendaciones_publicadas
            }
          />
          <SeccionContactosEmergencia
            contactos={mockEstadoGeneral.contactos_emergencia}
          />
        </div>
      );

      // Recomendaciones
      expect(html).toContain('Recomendaciones Preventivas para ALERTA');
      expect(html).toContain('Monitoreo institucional de taludes y cauces');
      expect(html).toContain('Origen: Institucional verificada');
      expect(html).toContain('Dirección de Gestión de Riesgos GAMLP');
      // Contactos de auxilio
      expect(html).toContain('Red 114 — Emergencias GAMLP');
      expect(html).toContain('114');
      expect(html).toContain('Bomberos Antofagasta La Paz');
      expect(html).toContain('119');
    });

    it('2.3. Despliega el Mapa Referencial Leaflet en Color Neutro con soporte GPS y Haversine P18', () => {
      const htmlMapa = renderToStaticMarkup(
        <MapaReferencial
          zonasReferencia={mockEstadoGeneral.zonas_referencia}
          puntosReferencia={mockEstadoGeneral.puntos_referencia}
          nivelVigente="ALERTA"
        />
      );

      // Cartografía referencial y tono neutro
      expect(htmlMapa).toContain('Mapa del Sector Piloto Llojeta / Bajo Llojeta');
      expect(htmlMapa).toContain('data-testid="nota-indicador-global"');
      expect(htmlMapa).toContain(
        'Las zonas de referencia se representan en color neutro.'
      );
      expect(ESTILO_ZONA_NEUTRO.color).toBe('#475569');

      // Botón táctil para geolocalización accesible
      expect(htmlMapa).toContain('data-testid="btn-solicitar-ubicacion"');
      expect(htmlMapa).toContain('Ubicación aproximada en dispositivo');

      // Zonas y puntos de referencia con leyenda obligatoria
      expect(htmlMapa).toContain('data-testid="seccion-zonas-referencia"');
      expect(htmlMapa).toContain('Sector Pasajahuira / Santa Rosa');
      expect(htmlMapa).toContain('data-testid="seccion-puntos-referencia"');
      expect(htmlMapa).toContain('Cruce Av. Los Sargentos y Av. Mario Mercado');
      expect(htmlMapa).toContain('referencia de demostración, no validada');
    });
  });

  // =========================================================================
  // BLOQUE 3: Resiliencia ante Eventos Visuales In-App y Desconexión
  // =========================================================================
  describe('Bloque 3: Resiliencia ante Eventos In-App (P06) y Desconexión (P08/P10)', () => {
    it('3.1. Aviso visual in-app (P06) se muestra ante cambio de nivel en pantalla activa', () => {
      const cambioNivel = {
        nivelAnterior: 'PRECAUCION',
        nivelNuevo: 'ALERTA',
        modalidad: 'real',
        recomendacion: mockEstadoGeneral.recomendacion,
      };

      const htmlAviso = renderToStaticMarkup(
        <AvisoCambioNivelInApp cambioNivel={cambioNivel} onCerrar={() => {}} />
      );

      expect(htmlAviso).toContain('data-testid="aviso-cambio-nivel-inapp"');
      expect(htmlAviso).toContain(
        'Cambio en el nivel informativo de lluvia: de PRECAUCION a ALERTA'
      );
      expect(htmlAviso).toContain('PRECAUCION');
      expect(htmlAviso).toContain('ALERTA');
      expect(htmlAviso).toContain('Entendido / Cerrar aviso');
    });

    it('3.2. En modo offline o ante limitación de teselas, muestra el aviso de limitación cartográfica P10', () => {
      const htmlMapaOffline = renderToStaticMarkup(
        <MapaReferencial
          modoOffline={true}
          zonasReferencia={mockEstadoGeneral.zonas_referencia}
          puntosReferencia={mockEstadoGeneral.puntos_referencia}
          nivelVigente="ALERTA"
        />
      );

      expect(htmlMapaOffline).toContain('data-testid="aviso-mapa-parcial"');
      expect(htmlMapaOffline).toContain('Cartografía parcial');
      expect(htmlMapaOffline).toContain('Por política de uso de OpenStreetMap');
      expect(htmlMapaOffline).toContain('El sistema no ofrece navegación');
    });
  });

  // =========================================================================
  // BLOQUE 4: Auditoría Semántica Estricta en la Interfaz de Usuario
  // =========================================================================
  describe('Bloque 4: Auditoría Semántica Estricta en la Interfaz de Usuario', () => {
    it('garantiza 0 ocurrencias de términos prohibidos de la lista negra en el renderizado completo', () => {
      const htmlCompleto = renderToStaticMarkup(
        <MemoryRouter>
          <div>
            <AvisoPermanente />
            <BannerNivelInformativo estado={mockEstadoGeneral} />
            <SeccionRecomendaciones
              nivelVigente="ALERTA"
              recomendacionVigente={mockEstadoGeneral.recomendacion}
              recomendacionesPublicadas={
                mockEstadoGeneral.recomendaciones_publicadas
              }
            />
            <SeccionContactosEmergencia
              contactos={mockEstadoGeneral.contactos_emergencia}
            />
            <MapaReferencial
              zonasReferencia={mockEstadoGeneral.zonas_referencia}
              puntosReferencia={mockEstadoGeneral.puntos_referencia}
              nivelVigente="ALERTA"
            />
          </div>
        </MemoryRouter>
      );

      const htmlMin = htmlCompleto.toLowerCase();

      // Prohibición estricta de términos de lista negra (rompiendo literales)
      const terminosProhibidos = [
        'alerta ' + 'oficial',
        'orden de ' + 'evacuación',
        'ruta ' + 'segura',
        'zona ' + 'segura',
        'refugio ' + 'verificado',
        'maps.google' + '.com',
        'waze' + '.com',
        'c' + 'ómo llegar',
        'como ' + 'llegar',
      ];

      for (const t of terminosProhibidos) {
        expect(htmlMin).not.toContain(t);
      }
    });
  });
});
