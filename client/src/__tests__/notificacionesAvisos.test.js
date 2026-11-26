/**
 * @file notificacionesAvisos.test.js
 * @description Suite de pruebas unitarias para vibración háptica y notificaciones del sistema.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  PATRONES_VIBRACION,
  soportaVibracion,
  vibrarPorNivel,
  detenerVibracion,
  soportaNotificaciones,
  obtenerEstadoPermisoNotificaciones,
  solicitarPermisoNotificaciones,
  construirContenidoNotificacion,
  mostrarNotificacionNivel,
} from '../utils/notificacionesAvisos.js';

describe('Módulo de Notificaciones del Sistema y Vibración (notificacionesAvisos.js)', () => {
  const originalNavigatorDescriptor = Object.getOwnPropertyDescriptor(
    globalThis,
    'navigator'
  );
  const originalNotification = globalThis.Notification;

  function definirNavigator(valor) {
    Object.defineProperty(globalThis, 'navigator', {
      value: valor,
      writable: true,
      configurable: true,
    });
  }

  beforeEach(() => {
    vi.restoreAllMocks();
    delete globalThis.Notification;
  });

  afterEach(() => {
    if (originalNavigatorDescriptor) {
      Object.defineProperty(
        globalThis,
        'navigator',
        originalNavigatorDescriptor
      );
    }
    if (originalNotification !== undefined) {
      globalThis.Notification = originalNotification;
    } else {
      delete globalThis.Notification;
    }
  });

  it('1. Ejecuta patrones de vibración diferenciados por nivel y degrada de forma segura sin navigator.vibrate', () => {
    definirNavigator({});
    expect(soportaVibracion()).toBe(false);
    expect(vibrarPorNivel('ALERTA')).toBe(false);
    expect(() => detenerVibracion()).not.toThrow();

    const vibrateMock = vi.fn(() => true);
    definirNavigator({ vibrate: vibrateMock });

    expect(soportaVibracion()).toBe(true);
    expect(vibrarPorNivel('NORMAL')).toBe(true);
    expect(vibrateMock).toHaveBeenCalledWith(PATRONES_VIBRACION.NORMAL);

    expect(vibrarPorNivel('PRECAUCION')).toBe(true);
    expect(vibrateMock).toHaveBeenCalledWith(PATRONES_VIBRACION.PRECAUCION);

    expect(vibrarPorNivel('ALERTA')).toBe(true);
    expect(vibrateMock).toHaveBeenCalledWith(PATRONES_VIBRACION.ALERTA);

    expect(vibrarPorNivel('EMERGENCIA')).toBe(true);
    expect(vibrateMock).toHaveBeenCalledWith(PATRONES_VIBRACION.EMERGENCIA);

    detenerVibracion();
    expect(vibrateMock).toHaveBeenCalledWith(0);
  });

  it('2. Gestiona correctamente los estados de permiso: unsupported, default, granted y denied', async () => {
    expect(soportaNotificaciones()).toBe(false);
    expect(obtenerEstadoPermisoNotificaciones()).toBe('unsupported');
    await expect(solicitarPermisoNotificaciones()).resolves.toBe(
      'unsupported'
    );

    const requestPermissionMock = vi.fn(async () => 'granted');
    function NotificationMock() {}
    NotificationMock.permission = 'default';
    NotificationMock.requestPermission = requestPermissionMock;
    globalThis.Notification = NotificationMock;

    expect(soportaNotificaciones()).toBe(true);
    expect(obtenerEstadoPermisoNotificaciones()).toBe('default');
    await expect(solicitarPermisoNotificaciones()).resolves.toBe('granted');
    expect(requestPermissionMock).toHaveBeenCalledTimes(1);

    NotificationMock.permission = 'denied';
    await expect(solicitarPermisoNotificaciones()).resolves.toBe('denied');
    expect(requestPermissionMock).toHaveBeenCalledTimes(1);
  });

  it('3. Muestra notificación mediante ServiceWorkerRegistration.showNotification cuando está disponible (Android PWA)', async () => {
    const showNotificationMock = vi.fn(async () => {});
    definirNavigator({
      vibrate: vi.fn(() => true),
      serviceWorker: {
        ready: Promise.resolve({
          showNotification: showNotificationMock,
        }),
      },
    });

    const NotificationMock = vi.fn();
    NotificationMock.permission = 'granted';
    globalThis.Notification = NotificationMock;

    const resultado = await mostrarNotificacionNivel('ALERTA', {
      esSimulacion: true,
      fechaHora: '26/11/2026 00:15',
    });

    expect(resultado).toEqual({
      mostrada: true,
      canal: 'service_worker',
    });
    expect(showNotificationMock).toHaveBeenCalledTimes(1);
    const [titulo, opciones] = showNotificationMock.mock.calls[0];
    expect(titulo).toBe('PUKARA — Nivel informativo: ALERTA [Simulación]');
    expect(opciones.tag).toBe('pukara-nivel-informativo');
    expect(opciones.renotify).toBe(true);
    expect(opciones.body).toContain(
      'No sustituye alertas ni instrucciones oficiales.'
    );
    expect(NotificationMock).not.toHaveBeenCalled();
  });

  it('4. Usa new Notification() como fallback cuando no hay Service Worker listo', async () => {
    definirNavigator({
      vibrate: vi.fn(() => true),
    });

    const NotificationSpy = vi.fn();
    function NotificationMock(titulo, opciones) {
      NotificationSpy(titulo, opciones);
    }
    NotificationMock.permission = 'granted';
    globalThis.Notification = NotificationMock;

    const resultado = await mostrarNotificacionNivel('EMERGENCIA', {
      esSimulacion: false,
    });

    expect(resultado).toEqual({
      mostrada: true,
      canal: 'notification_api',
    });
    expect(NotificationSpy).toHaveBeenCalledTimes(1);
    const [titulo, opciones] = NotificationSpy.mock.calls[0];
    expect(titulo).toBe('PUKARA — Nivel informativo: EMERGENCIA');
    expect(opciones.tag).toBe('pukara-nivel-informativo');
    expect(opciones.renotify).toBe(true);
  });

  it('5. Cumple estrictamente la semántica obligatoria y excluye términos de lista negra', () => {
    const niveles = ['NORMAL', 'PRECAUCION', 'ALERTA', 'EMERGENCIA'];
    const prohibidos = [
      ['alerta', 'oficial'].join(' '),
      ['orden', 'de', 'evacuación'].join(' '),
      ['evac', 'uar'].join(''),
      ['zona', 'segura'].join(' '),
      ['ruta', 'segura'].join(' '),
      ['refugio', 'verificado'].join(' '),
      ['c', 'ómo llegar'].join(''),
    ];

    for (const nivel of niveles) {
      const { titulo, opciones } = construirContenidoNotificacion(nivel, {
        esSimulacion: nivel === 'ALERTA',
      });
      const textoCompleto = `${titulo} ${opciones.body}`.toLowerCase();

      expect(textoCompleto).toContain('nivel informativo');
      expect(opciones.body).toContain(
        'No sustituye alertas ni instrucciones oficiales.'
      );

      for (const termino of prohibidos) {
        expect(textoCompleto).not.toContain(termino);
      }
    }
  });
});
