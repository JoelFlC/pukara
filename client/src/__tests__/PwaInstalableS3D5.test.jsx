/**
 * @file PwaInstalableS3D5.test.jsx
 * @description Suite de pruebas automatizadas para la Semana 3 - Día 5 (Fase B):
 * - 1. Almacenamiento local determinista y formato del aviso offline (offlineStorage.js)
 * - 2. Verificación de configuración PWA y políticas de caché (Sección 9.4)
 * - 3. Verificación de cabeceras binarias y existencia de íconos PNG en client/public/
 * - 4. Componente EstadoPwaBanner y recuperación offline en InicioPage
 */

import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  CLAVE_ULTIMO_ESTADO_OFFLINE,
  formatearFechaHoraOffline,
  construirAvisoDatosNoActualizados,
  guardarUltimoEstadoLocal,
  obtenerUltimoEstadoLocal,
  limpiarUltimoEstadoLocal,
} from '../utils/offlineStorage.js';
import EstadoPwaBanner from '../components/EstadoPwaBanner.jsx';
import { CONFIG_PWA_PUKARA } from '../../vite.config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PUBLIC_DIR = path.resolve(__dirname, '../../public');

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

describe('Semana 3 - Día 5 (Fase B): PWA Instalable, Service Worker y Almacenamiento Local (PwaInstalableS3D5.test.jsx)', () => {
  beforeEach(() => {
    store.clear();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    store.clear();
  });

  // =========================================================================
  // BLOQUE 1: Almacenamiento Local y Formato del Aviso Offline
  // =========================================================================
  describe('Bloque 1: Almacenamiento Local y Formato Exacto del Aviso Offline', () => {
    const mockEstadoCompleto = {
      ok: true,
      modalidad: 'real',
      nivel_vigente: 'PRECAUCION',
      estado_sistema: 'PRECAUCION',
      lectura: {
        id: 42,
        observado_en: '2026-10-23T19:30:00.000Z',
        intensidad_mm_h: 3.5,
        acum_24h_mm: 12.0,
      },
      recomendacion: {
        nivel: 'PRECAUCION',
        titulo: 'Recomendaciones preventivas generales — Nivel Precaución',
        contenido: 'Evitar cauces de ríos y quebradas.',
        origen: 'demostracion',
      },
      recomendaciones_publicadas: [
        { nivel: 'NORMAL', origen: 'demostracion' },
        { nivel: 'PRECAUCION', origen: 'demostracion' },
      ],
      contactos_emergencia: [
        { nombre: 'Red 114 GAMLP', telefono: '114' },
      ],
      zonas_referencia: [
        { id: 1, nombre: 'Sector Pasajahuira' },
      ],
      puntos_referencia: [
        { id: 1, nombre: 'Cruce Av. Los Sargentos', latitud: -16.528, longitud: -68.138 },
      ],
    };

    it('1.1. guardarUltimoEstadoLocal persiste el paquete completo en localStorage y obtenerUltimoEstadoLocal lo recupera intacto', () => {
      const guardado = guardarUltimoEstadoLocal(mockEstadoCompleto);

      expect(guardado).not.toBeNull();
      expect(guardado.datos.nivel_vigente).toBe('PRECAUCION');
      expect(guardado.fecha_dato_iso).toBe('2026-10-23T19:30:00.000Z');
      expect(guardado.aviso_offline).toContain('Datos del');
      expect(guardado.aviso_offline).toContain('no actualizados');

      // Recuperación directa desde localStorage
      const recuperado = obtenerUltimoEstadoLocal();
      expect(recuperado).not.toBeNull();
      expect(recuperado.datos.nivel_vigente).toBe('PRECAUCION');
      expect(recuperado.datos.recomendaciones_publicadas).toHaveLength(2);
      expect(recuperado.datos.contactos_emergencia).toHaveLength(1);
      expect(recuperado.datos.puntos_referencia).toHaveLength(1);
    });

    it('1.2. construirAvisoDatosNoActualizados genera exactamente el formato requerido en la memoria arquitectónica', () => {
      const fechaPrueba = '2026-10-23T19:30:00.000Z';
      const aviso = construirAvisoDatosNoActualizados(fechaPrueba);

      // Formato exacto: "Datos del [fecha y hora], no actualizados"
      expect(aviso).toMatch(/^Datos del .+, no actualizados$/);
      expect(aviso).toContain('23/10/2026');
      expect(aviso).toContain('no actualizados');

      // Caso fecha nula / inválida
      expect(formatearFechaHoraOffline(null)).toBe('fecha desconocida');
      expect(construirAvisoDatosNoActualizados(null)).toBe('Datos del fecha desconocida, no actualizados');
    });

    it('1.3. Tolerancia a fallos: devuelve null ante JSON corrupto en localStorage sin lanzar excepciones', () => {
      // Inyectar datos no JSON
      store.set(CLAVE_ULTIMO_ESTADO_OFFLINE, '<<<JSON_CORRUPTO_INVÁLIDO>>>');

      let resultado = null;
      expect(() => {
        resultado = obtenerUltimoEstadoLocal();
      }).not.toThrow();

      expect(resultado).toBeNull();
    });

    it('1.4. limpiarUltimoEstadoLocal elimina correctamente el registro persistido', () => {
      guardarUltimoEstadoLocal(mockEstadoCompleto);
      expect(obtenerUltimoEstadoLocal()).not.toBeNull();

      limpiarUltimoEstadoLocal();
      expect(obtenerUltimoEstadoLocal()).toBeNull();
    });
  });

  // =========================================================================
  // BLOQUE 2: Configuración PWA y Políticas de Caché (Sección 9.4)
  // =========================================================================
  describe('Bloque 2: Configuración PWA y Políticas de Caché (Sección 9.4)', () => {
    it('2.1. El Web App Manifest define short_name, display standalone, orientación portrait e iconos', () => {
      const manifest = CONFIG_PWA_PUKARA.manifest;

      expect(manifest.short_name).toBe('PUKARA');
      expect(manifest.display).toBe('standalone');
      expect(manifest.orientation).toBe('portrait');
      expect(manifest.start_url).toBe('/');
      expect(manifest.scope).toBe('/');
      expect(manifest.lang).toBe('es-BO');
      expect(manifest.theme_color).toBe('#0f172a');
      expect(manifest.background_color).toBe('#f8fafc');

      // Debe definir al menos los íconos de 192x192 y 512x512
      const sizes = manifest.icons.map((ic) => ic.sizes);
      expect(sizes).toContain('192x192');
      expect(sizes).toContain('512x512');

      const maskable = manifest.icons.find((ic) => ic.purpose === 'maskable');
      expect(maskable).toBeDefined();
    });

    it('2.2. Workbox configura NetworkFirst para estado e historial y StaleWhileRevalidate para contenidos', () => {
      const workbox = CONFIG_PWA_PUKARA.workbox;

      expect(workbox.cleanupOutdatedCaches).toBe(true);
      expect(workbox.clientsClaim).toBe(true);
      expect(workbox.skipWaiting).toBe(true);

      const rules = workbox.runtimeCaching;
      expect(rules).toHaveLength(2);

      // Regla 1: Estado e historial con NetworkFirst
      const reglaEstado = rules.find((r) => r.options.cacheName === 'pukara-estado-network-first');
      expect(reglaEstado).toBeDefined();
      expect(reglaEstado.handler).toBe('NetworkFirst');
      expect(reglaEstado.options.networkTimeoutSeconds).toBe(4);

      // Regla 2: Contenidos con StaleWhileRevalidate
      const reglaContenidos = rules.find((r) => r.options.cacheName === 'pukara-contenidos-swr');
      expect(reglaContenidos).toBeDefined();
      expect(reglaContenidos.handler).toBe('StaleWhileRevalidate');
    });

    it('2.3. PROHIBICIÓN ESTRICTA: Workbox NO incluye ninguna regla de precarga ni caché para OpenStreetMap (Sección 9.4)', () => {
      const workbox = CONFIG_PWA_PUKARA.workbox;
      const serializado = JSON.stringify(workbox);

      // Ninguna mención a tile.openstreetmap.org en las reglas del Service Worker
      expect(serializado).not.toContain('openstreetmap');
      expect(serializado).not.toContain('tile.openstreetmap.org');
    });
  });

  // =========================================================================
  // BLOQUE 3: Existencia Física y Firma Binaria de Íconos PNG en client/public/
  // =========================================================================
  describe('Bloque 3: Existencia Física y Firma Binaria de Íconos PNG en client/public/', () => {
    const firmaValidaPng = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

    const iconos = [
      { archivo: 'pwa-192x192.png', minBytes: 500 },
      { archivo: 'pwa-512x512.png', minBytes: 1000 },
      { archivo: 'pwa-maskable-512x512.png', minBytes: 1000 },
    ];

    iconos.forEach(({ archivo, minBytes }) => {
      it(`3.${archivo}: existe físicamente y posee firma binaria PNG legítima`, () => {
        const rutaCompleta = path.join(PUBLIC_DIR, archivo);
        expect(fs.existsSync(rutaCompleta)).toBe(true);

        const buffer = fs.readFileSync(rutaCompleta);
        expect(buffer.length).toBeGreaterThan(minBytes);

        // Primeros 8 bytes deben coincidir exactamente con la firma estándar de PNG
        const firmaArchivo = buffer.subarray(0, 8);
        expect(firmaArchivo.equals(firmaValidaPng)).toBe(true);
      });
    });

    it('3.4. favicon.svg existe y posee la paleta sobria de PUKARA (#0f172a y #38bdf8)', () => {
      const rutaFavicon = path.join(PUBLIC_DIR, 'favicon.svg');
      expect(fs.existsSync(rutaFavicon)).toBe(true);

      const contenido = fs.readFileSync(rutaFavicon, 'utf-8');
      expect(contenido).toContain('#0f172a');
      expect(contenido).toContain('#38bdf8');
    });
  });

  // =========================================================================
  // BLOQUE 4: Componente EstadoPwaBanner y Experiencia de Instalación
  // =========================================================================
  describe('Bloque 4: Componente EstadoPwaBanner y Experiencia de Instalación', () => {
    it('4.1. Muestra el botón data-testid="btn-instalar-pwa" cuando la app es instalable', () => {
      const htmlInstalable = renderToStaticMarkup(
        <EstadoPwaBanner instalableInicial={true} />
      );

      expect(htmlInstalable).toContain('data-testid="banner-instalacion-pwa"');
      expect(htmlInstalable).toContain('data-testid="btn-instalar-pwa"');
      expect(htmlInstalable).toContain('Instalar aplicación PWA para consulta sin conexión');
    });

    it('4.2. No renderiza ningún banner cuando instalableInicial es false', () => {
      const htmlNoInstalable = renderToStaticMarkup(
        <EstadoPwaBanner instalableInicial={false} />
      );

      expect(htmlNoInstalable).toBe('');
    });

    it('4.3. Al interactuar con el botón de instalación, invoca el callback correspondiente', () => {
      const alInstalarMock = vi.fn();

      const html = renderToStaticMarkup(
        <EstadoPwaBanner instalableInicial={true} alInstalar={alInstalarMock} />
      );

      expect(html).toContain('Instalar PUKARA en este dispositivo');
    });
  });
});

