/**
 * @file PanelAvisosPreventivos.test.jsx
 * @description Suite de pruebas para PanelAvisosPreventivos y persistencia/reglas de useAvisosNivel.
 */

import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

import PanelAvisosPreventivos from '../components/PanelAvisosPreventivos.jsx';
import PulsoFondoEmergencia from '../components/PulsoFondoEmergencia.jsx';
import {
  CLAVE_PREFERENCIAS_AVISOS,
  PREFERENCIAS_INICIALES,
  leerPreferenciasAvisos,
  guardarPreferenciasAvisos,
  debeDispararAvisoPorCambio,
} from '../hooks/useAvisosNivel.js';

const store = new Map();
const localStorageMock = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
  clear: () => store.clear(),
};

Object.defineProperty(globalThis, 'localStorage', {
  value: localStorageMock,
  writable: true,
  configurable: true,
});

function crearControladorMock(overrides = {}) {
  return {
    sonidoActivo: false,
    notificacionesActivas: false,
    silenciado: false,
    permisoNotificaciones: 'default',
    esContextoSeguro: true,
    soportaAudio: true,
    soportaVibracion: true,
    soportaNotificaciones: true,
    reproduciendoNivel: null,
    ultimoAvisoEmitido: null,
    activarSonido: vi.fn(),
    desactivarSonido: vi.fn(),
    alternarSilencio: vi.fn(),
    activarNotificaciones: vi.fn(),
    desactivarNotificaciones: vi.fn(),
    activarAvisosCompletos: vi.fn(),
    desactivarAvisosCompletos: vi.fn(),
    probarAviso: vi.fn(),
    detenerSonido: vi.fn(),
    marcarModalidadInicializada: vi.fn(),
    ...overrides,
  };
}

describe('Panel y Orquestación de Avisos Preventivos (PanelAvisosPreventivos.test.jsx)', () => {
  beforeEach(() => {
    store.clear();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    store.clear();
  });

  it('1. Persiste y lee preferencias en localStorage bajo "pukara_avisos_prefs" con sonidoActivo=false por defecto', () => {
    expect(CLAVE_PREFERENCIAS_AVISOS).toBe('pukara_avisos_prefs');
    expect(leerPreferenciasAvisos()).toEqual(PREFERENCIAS_INICIALES);
    expect(leerPreferenciasAvisos().sonidoActivo).toBe(false);

    guardarPreferenciasAvisos({
      sonidoActivo: true,
      notificacionesActivas: true,
      silenciado: false,
    });

    const raw = localStorage.getItem('pukara_avisos_prefs');
    expect(raw).not.toBeNull();
    expect(leerPreferenciasAvisos()).toEqual({
      sonidoActivo: true,
      notificacionesActivas: true,
      silenciado: false,
    });
  });

  it('2. No dispara alarmas en carga inicial ni al permanecer en el mismo nivel, y sí ante ascensos/cambios relevantes', () => {
    expect(
      debeDispararAvisoPorCambio({
        nivelAnterior: null,
        nivelNuevo: 'ALERTA',
        esCargaInicial: true,
        silenciado: false,
      })
    ).toBe(false);

    expect(
      debeDispararAvisoPorCambio({
        nivelAnterior: 'ALERTA',
        nivelNuevo: 'ALERTA',
        esCargaInicial: false,
        silenciado: false,
      })
    ).toBe(false);

    expect(
      debeDispararAvisoPorCambio({
        nivelAnterior: 'NORMAL',
        nivelNuevo: 'PRECAUCION',
        esCargaInicial: false,
        silenciado: true,
      })
    ).toBe(false);

    expect(
      debeDispararAvisoPorCambio({
        nivelAnterior: 'ALERTA',
        nivelNuevo: 'NORMAL',
        esCargaInicial: false,
        silenciado: false,
      })
    ).toBe(false);

    expect(
      debeDispararAvisoPorCambio({
        nivelAnterior: 'NORMAL',
        nivelNuevo: 'PRECAUCION',
        esCargaInicial: false,
        silenciado: false,
      })
    ).toBe(true);

    expect(
      debeDispararAvisoPorCambio({
        nivelAnterior: 'PRECAUCION',
        nivelNuevo: 'ALERTA',
        esCargaInicial: false,
        silenciado: false,
      })
    ).toBe(true);

    expect(
      debeDispararAvisoPorCambio({
        nivelAnterior: 'ALERTA',
        nivelNuevo: 'EMERGENCIA',
        esCargaInicial: false,
        silenciado: false,
      })
    ).toBe(true);
  });

  it('3. Renderiza la barra compacta de un solo switch >= 48px sin sección pesada de pruebas', () => {
    const controlador = crearControladorMock();
    const html = renderToStaticMarkup(
      <PanelAvisosPreventivos controlador={controlador} />
    );

    expect(html).toContain('data-testid="panel-avisos-preventivos"');
    expect(html).toContain('Avisos sonoros preventivos');
    expect(html).toContain('role="switch"');
    expect(html).toContain('aria-checked="false"');
    expect(html).toContain('min-h-[48px]');
    expect(html).toContain('text-base');
    expect(html).toContain('Inactivos');
    expect(html).not.toContain('Probar avisos por nivel');
    expect(html).not.toContain('btn-probar-ALERTA');
  });

  it('4. Muestra controles de Silenciar / Detener sonido y estado activo cuando está reproduciendo', () => {
    const controlador = crearControladorMock({
      sonidoActivo: true,
      notificacionesActivas: true,
      silenciado: false,
      permisoNotificaciones: 'granted',
      reproduciendoNivel: 'ALERTA',
    });

    const html = renderToStaticMarkup(
      <PanelAvisosPreventivos controlador={controlador} />
    );

    expect(html).toContain('aria-checked="true"');
    expect(html).toContain('Activos');
    expect(html).toContain('data-testid="btn-silenciar-avisos"');
    expect(html).toContain('Silenciar');
    expect(html).toContain('data-testid="btn-detener-sonido"');
    expect(html).toContain('Detener sonido');
    expect(html).toContain('Sonando: Alerta');
  });

  it('5. Muestra estado silenciado y nota discreta de compatibilidad al estar activo en HTTP / permiso denegado', () => {
    const controlador = crearControladorMock({
      sonidoActivo: true,
      silenciado: true,
      esContextoSeguro: false,
      permisoNotificaciones: 'unsupported',
    });

    const html = renderToStaticMarkup(
      <PanelAvisosPreventivos controlador={controlador} />
    );

    expect(html).toContain('Silenciados');
    expect(html).toContain('Reactivar');
    expect(html).toContain('data-testid="aviso-compatibilidad-notificaciones"');
    expect(html).toContain('requieren HTTPS');
    expect(html).toContain('Sonido y vibración locales activos');
  });

  it('6. Preserva estrictamente la semántica obligatoria y cero términos prohibidos', () => {
    const controlador = crearControladorMock({
      sonidoActivo: true,
      permisoNotificaciones: 'denied',
      reproduciendoNivel: 'EMERGENCIA',
    });

    const html = renderToStaticMarkup(
      <PanelAvisosPreventivos controlador={controlador} />
    );

    expect(html).toContain('nivel informativo de lluvia');
    expect(html).toContain(
      'Avisos preventivos locales sobre el nivel informativo de lluvia. No sustituyen alertas oficiales.'
    );

    const htmlLower = html.toLowerCase();
    const terminosProhibidos = [
      ['alerta', 'oficial'].join(' '),
      ['orden', 'de', 'evacuación'].join(' '),
      ['evac', 'uar'].join(''),
      ['zona', 'segura'].join(' '),
      ['ruta', 'segura'].join(' '),
      ['refugio', 'verificado'].join(' '),
      ['c', 'ómo llegar'].join(''),
    ];

    for (const term of terminosProhibidos) {
      expect(htmlLower).not.toContain(term);
    }
  });

  it('7. Renderiza <PulsoFondoEmergencia /> solo cuando activo=true y aplica intensidad alta al sonar EMERGENCIA', () => {
    const htmlInactivo = renderToStaticMarkup(
      <PulsoFondoEmergencia activo={false} intenso={false} />
    );
    expect(htmlInactivo).toBe('');

    const htmlContinuo = renderToStaticMarkup(
      <PulsoFondoEmergencia activo={true} intenso={false} />
    );
    expect(htmlContinuo).toContain('data-testid="fondo-pulso-emergencia"');
    expect(htmlContinuo).toContain('data-testid="borde-pulso-emergencia"');
    expect(htmlContinuo).toContain('aria-hidden="true"');
    expect(htmlContinuo).toContain('pointer-events-none');
    expect(htmlContinuo).toContain('data-intensidad="continua"');
    expect(htmlContinuo).not.toContain('emergencia-pulso-rapido');

    const htmlIntenso = renderToStaticMarkup(
      <PulsoFondoEmergencia activo={true} intenso={true} />
    );
    expect(htmlIntenso).toContain('data-intensidad="alta"');
    expect(htmlIntenso).toContain('emergencia-pulso-rapido');
  });
});
