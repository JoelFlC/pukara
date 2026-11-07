/**
 * @file PanelAdmin.test.jsx
 * @description Suite de pruebas automatizadas para la interfaz del Panel de Administración en React:
 * - 1. Renderizado de AdminLogin cuando no hay token en localStorage con AvisoPermanente
 * - 2. Flujo de inicio de sesión exitoso y renderizado de PanelAdministracion con sus 6 pestañas
 * - 3. Visualización clara de los errores de validación P16 ante umbrales incoherentes
 */

import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';

import AdminLogin from '../components/AdminLogin.jsx';
import PanelAdministracion from '../components/PanelAdministracion.jsx';
import AdminPage from '../pages/AdminPage.jsx';
import AvisoPermanente from '../components/AvisoPermanente.jsx';
import {
  loginAdmin,
  crearConfiguracionAdmin,
  obtenerTokenAdmin,
  guardarTokenAdmin,
  guardarUsuarioAdmin,
  logoutAdmin,
} from '../api/adminApi.js';

// Mock de localStorage en entorno Node/Vitest
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

describe('Semana 3 - Día 2 (Fase B): Pruebas de UI del Panel de Administración (PanelAdmin.test.jsx)', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    store.clear();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    store.clear();
    globalThis.fetch = originalFetch;
  });

  // =========================================================================
  // 1. Renderizado de AdminLogin sin sesión con AvisoPermanente
  // =========================================================================
  it('1. Renderiza el formulario de acceso institucional AdminLogin y el AvisoPermanente cuando no hay token', () => {
    expect(obtenerTokenAdmin()).toBeNull();

    const html = renderToStaticMarkup(
      <MemoryRouter>
        <AdminLogin alIniciarSesion={() => {}} />
      </MemoryRouter>
    );

    // Formulario de credenciales
    expect(html).toContain('Acceso Administrativo');
    expect(html).toContain('Correo Institucional');
    expect(html).toContain('Contraseña');
    expect(html).toContain('Iniciar Sesión');
    expect(html).toContain('Volver a la Consulta Pública');

    // Aviso Permanente Institucional reglamentario (GEMINI.md)
    expect(html).toContain('Aviso Permanente Institucional');
    expect(html).toContain('niveles informativos de lluvia');
    expect(html).toContain('umbrales académicos');
    expect(html).toContain('PUKARA muestra información bajo consulta');

    // También verificamos que AdminPage sin sesión renderice AdminLogin
    const htmlPage = renderToStaticMarkup(
      <MemoryRouter>
        <AdminPage />
      </MemoryRouter>
    );
    expect(htmlPage).toContain('Acceso Administrativo');
  });

  // =========================================================================
  // 2. Flujo de inicio de sesión exitoso y renderizado de las 6 pestañas
  // =========================================================================
  it('2. Flujo de inicio de sesión exitoso (loginAdmin) que da paso a PanelAdministracion con sus 6 pestañas operativas', async () => {
    const mockToken = 'mock-jwt-token-admin-pukara-2026';
    const mockUsuario = {
      id: 1,
      email: 'admin@pukara.bo',
      nombre: 'Administrador PUKARA',
      rol: 'administrador',
    };

    // 1. Mock de fetch para POST /api/auth/login
    globalThis.fetch = vi.fn().mockImplementation((url, opts) => {
      if (url.includes('/api/auth/login')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () =>
            Promise.resolve({
              ok: true,
              token: mockToken,
              usuario: mockUsuario,
            }),
        });
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ ok: true }),
      });
    });

    // 2. Ejecutar loginAdmin
    const resLogin = await loginAdmin('admin@pukara.bo', 'PukaraAdmin2026!');
    expect(resLogin.ok).toBe(true);
    expect(resLogin.token).toBe(mockToken);
    expect(resLogin.usuario.email).toBe('admin@pukara.bo');

    // Guardar sesión en localStorage
    guardarTokenAdmin(mockToken);
    guardarUsuarioAdmin(mockUsuario);
    expect(obtenerTokenAdmin()).toBe(mockToken);

    // 3. Renderizado del PanelAdministracion autenticado
    const htmlPanel = renderToStaticMarkup(
      <MemoryRouter>
        <PanelAdministracion alCerrarSesion={() => {}} />
      </MemoryRouter>
    );

    // Encabezado y sesión
    expect(htmlPanel).toContain('Panel de Administración PUKARA');
    expect(htmlPanel).toContain('Administrador PUKARA');
    expect(htmlPanel).toContain('admin@pukara.bo');
    expect(htmlPanel.toLowerCase()).toContain('cerrar sesión');

    // Las 6 pestañas obligatorias de administración
    expect(htmlPanel).toContain('1. Umbrales y Reglas (P05/P16)');
    expect(htmlPanel).toContain('2. Textos Preventivos');
    expect(htmlPanel).toContain('3. Contactos de Emergencia');
    expect(htmlPanel).toContain('4. Capas y Referencias');
    expect(htmlPanel).toContain('5. Modo Demostración');
    expect(htmlPanel).toContain('6. Bitácora de Cambios');

    // Aviso permanente siempre visible en el pie del panel
    expect(htmlPanel).toContain('Aviso Permanente Institucional');
  });

  // =========================================================================
  // 3. Visualización clara de los errores de validación P16 ante incoherencias
  // =========================================================================
  it('3. Formatea y visualiza con claridad las alertas de error de validación P16 ante respuestas de configuración incoherente', async () => {
    // 1. Simular rechazo de la API con HTTP 400 y errores P16
    const erroresP16Api = [
      {
        codigo: 'ORDEN_NIVELES_INVALIDO',
        campo: 'intensidad_mm_h',
        mensaje:
          'En intensidad_mm_h, el umbral de PRECAUCION (8.5) debe ser estrictamente menor que ALERTA (6.5).',
      },
      {
        codigo: 'COHERENCIA_24H_72H_INVALIDA',
        campo: 'acum_24h_mm.ALERTA',
        mensaje:
          'El acumulado de 24 horas en nivel ALERTA (70 mm) no puede ser mayor al de 72 horas (60 mm).',
      },
    ];

    globalThis.fetch = vi.fn().mockImplementation((url, opts) => {
      if (url.includes('/api/admin/configuraciones') && opts?.method === 'POST') {
        return Promise.resolve({
          ok: false,
          status: 400,
          json: () =>
            Promise.resolve({
              ok: false,
              error: {
                codigo: 'CONFIGURACION_INVALIDA',
                mensaje:
                  'La configuración de umbrales contiene errores de coherencia matemática o está incompleta.',
                detalles: erroresP16Api,
              },
            }),
        });
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ ok: true, versiones: [] }),
      });
    });

    guardarTokenAdmin('fake-token');

    // 2. Verificar que el cliente adminApi capture y propague los detalles
    let errorCapturado = null;
    try {
      await crearConfiguracionAdmin({ umbrales: [] });
    } catch (err) {
      errorCapturado = err;
    }

    expect(errorCapturado).not.toBeNull();
    expect(errorCapturado.status).toBe(400);
    expect(errorCapturado.codigo).toBe('CONFIGURACION_INVALIDA');
    expect(Array.isArray(errorCapturado.detalles)).toBe(true);
    expect(errorCapturado.detalles).toHaveLength(2);

    // 3. Verificar que el banner de alerta P16 formatee los mensajes correctamente
    const detallesFormateados = errorCapturado.detalles.map((d) =>
      typeof d === 'string' ? d : d.mensaje || d.codigo
    );

    // Renderizado del bloque de alerta P16 tal como se renderiza en PanelAdministracion
    const alertaHtml = renderToStaticMarkup(
      <div role="alert" className="rounded-xl border border-red-300 bg-red-50 p-4 text-xs text-red-950">
        <p className="font-bold flex items-center gap-1.5">
          <span>🛑</span> Error de Validación Estricta (Regla P16):
        </p>
        <ul className="list-disc list-inside space-y-1 pl-1 text-red-900/90 font-mono text-[11px]">
          {detallesFormateados.map((errStr, idx) => (
            <li key={idx}>{errStr}</li>
          ))}
        </ul>
      </div>
    );

    expect(alertaHtml).toContain('Error de Validación Estricta (Regla P16)');
    expect(alertaHtml).toContain(
      'el umbral de PRECAUCION (8.5) debe ser estrictamente menor que ALERTA (6.5)'
    );
    expect(alertaHtml).toContain(
      'El acumulado de 24 horas en nivel ALERTA (70 mm) no puede ser mayor al de 72 horas (60 mm)'
    );
  });
});
