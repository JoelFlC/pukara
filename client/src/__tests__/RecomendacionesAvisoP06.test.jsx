/**
 * @file RecomendacionesAvisoP06.test.jsx
 * @description Suite de pruebas automatizadas para el Módulo 3 y la Regla P06 en React:
 * - 1. Renderizado de recomendaciones preventivas con etiquetas de origen y contactos de emergencia
 * - 2. Escenario P06: Detección y despliegue del aviso visual in-app ante cambio de nivel en sesión activa
 * - 3. Cierre y ocultamiento interactivo del aviso visual in-app
 */

import React, { useState } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

import AvisoCambioNivelInApp from '../components/AvisoCambioNivelInApp.jsx';
import SeccionRecomendaciones from '../components/SeccionRecomendaciones.jsx';
import SeccionContactosEmergencia from '../components/SeccionContactosEmergencia.jsx';

describe('Semana 3 - Día 3 (Fase B): Recomendaciones, Contactos y Aviso In-App P06 (RecomendacionesAvisoP06.test.jsx)', () => {
  // =========================================================================
  // BLOQUE 1: Renderizado de Recomendaciones con Etiqueta de Origen y Contactos
  // =========================================================================
  describe('Bloque 1: Renderizado de Recomendaciones con Etiqueta de Origen y Contactos', () => {
    const mockRecomendaciones = [
      {
        id: 1,
        nivel: 'NORMAL',
        titulo: 'Recomendaciones generales — Nivel Normal',
        contenido: 'Mantenerse informado por canales oficiales; revisar canaletas.',
        origen: 'demostracion',
        version: 1,
        fuente: 'Propuesta académica PUKARA',
      },
      {
        id: 2,
        nivel: 'PRECAUCION',
        titulo: 'Recomendaciones generales — Nivel Precaución',
        contenido: 'Evitar cauces y quebradas; tener a mano linterna.',
        origen: 'demostracion',
        version: 1,
        fuente: 'Propuesta académica PUKARA',
      },
      {
        id: 3,
        nivel: 'ALERTA',
        titulo: 'Monitoreo institucional de taludes y cauces',
        contenido: 'Mantenerse alejado de ríos y preparar mochila de emergencia.',
        origen: 'institucional_verificada',
        version: 2,
        fuente: 'Dirección de Gestión de Riesgos GAMLP',
      },
      {
        id: 4,
        nivel: 'EMERGENCIA',
        titulo: 'Recomendaciones generales — Nivel Emergencia',
        contenido: 'No cruzar zonas inundadas; contactar servicios oficiales.',
        origen: 'demostracion',
        version: 1,
        fuente: 'Propuesta académica PUKARA',
      },
    ];

    const mockContactos = [
      {
        id: 1,
        nombre: 'Red 114 — Emergencias GAMLP',
        telefono: '114',
        fuente: 'Gobierno Autónomo Municipal de La Paz [Verificar con fuente oficial]',
        verificado_en: '2026-10-23',
        activo: true,
      },
      {
        id: 2,
        nombre: 'Bomberos Antofagasta La Paz',
        telefono: '119',
        fuente: 'Policía Boliviana [Verificar con fuente oficial]',
        verificado_en: null, // Verificación documental pendiente
        activo: true,
      },
    ];

    it('1.1. <SeccionRecomendaciones/> destaca el nivel vigente, expone badges de origen y recordatorio institucional', () => {
      // Caso A: Nivel vigente ALERTA con origen institucional_verificada
      const htmlAlerta = renderToStaticMarkup(
        <SeccionRecomendaciones
          nivelVigente="ALERTA"
          estadoSistema="ALERTA"
          recomendacionVigente={mockRecomendaciones[2]}
          recomendacionesPublicadas={mockRecomendaciones}
        />
      );

      // Título y nivel vigente
      expect(htmlAlerta).toContain('Recomendaciones Preventivas para ALERTA');
      expect(htmlAlerta).toContain('Monitoreo institucional de taludes y cauces');
      expect(htmlAlerta).toContain('Mantenerse alejado de ríos y preparar mochila de emergencia');

      // Badge visible de origen institucional
      expect(htmlAlerta).toContain('Origen: Institucional verificada');
      expect(htmlAlerta).toContain('Versión: v2');
      expect(htmlAlerta).toContain('Dirección de Gestión de Riesgos GAMLP');

      // Recordatorio reglamentario del Módulo 3
      expect(htmlAlerta).toContain(
        'Recomendaciones preventivas generales de carácter informativo. El sistema no emite instrucciones de desplazamiento ni sustituye a las autoridades competentes.'
      );

      // Caso B: Nivel vigente NORMAL con origen demostracion
      const htmlNormal = renderToStaticMarkup(
        <SeccionRecomendaciones
          nivelVigente="NORMAL"
          estadoSistema="NORMAL"
          recomendacionVigente={mockRecomendaciones[0]}
          recomendacionesPublicadas={mockRecomendaciones}
        />
      );

      expect(htmlNormal).toContain('Recomendaciones Preventivas para NORMAL');
      expect(htmlNormal).toContain('Origen: Demostración (contenido académico)');
    });

    it('1.2. <SeccionContactosEmergencia/> renderiza enlaces táctiles tel:, fuentes y advertencia ciudadana', () => {
      const htmlContactos = renderToStaticMarkup(
        <SeccionContactosEmergencia contactos={mockContactos} />
      );

      // Encabezado y lista de servicios
      expect(htmlContactos).toContain('Contactos de Emergencia — La Paz / Cotahuma');
      expect(htmlContactos).toContain('Red 114 — Emergencias GAMLP');
      expect(htmlContactos).toContain('Bomberos Antofagasta La Paz');

      // Enlaces telefónicos directos con marcado táctil (href="tel:...")
      expect(htmlContactos).toContain('href="tel:114"');
      expect(htmlContactos).toContain('href="tel:119"');

      // Trazabilidad de verificación
      expect(htmlContactos).toContain('Verificado el:');
      expect(htmlContactos).toContain('Verificación documental pendiente con fuente oficial');

      // Advertencia ciudadana obligatoria
      expect(htmlContactos).toContain(
        'Ante una emergencia real en el sector Llojeta / Bajo Llojeta, comuníquese directamente con los servicios oficiales de emergencia.'
      );
    });
  });

  // =========================================================================
  // BLOQUE 2: Escenario P06 (Aviso Visual In-App ante Cambio de Nivel)
  // =========================================================================
  describe('Bloque 2: Escenario Funcional P06 — Aviso Visual In-App de Cambio de Nivel', () => {
    it('2.1. No renderiza el banner de cambio de nivel en la carga inicial cuando cambioNivel es null', () => {
      const htmlSinCambio = renderToStaticMarkup(
        <AvisoCambioNivelInApp cambioNivel={null} onCerrar={() => {}} />
      );

      expect(htmlSinCambio).toBe('');
    });

    it('2.2. Despliega el aviso visual in-app ante transición de NORMAL a ALERTA con data-testid, resumen y nota obligatoria', () => {
      const cambioNivelAlerta = {
        nivelAnterior: 'NORMAL',
        nivelNuevo: 'ALERTA',
        modalidad: 'real',
        detectadoEn: '2026-10-23T20:15:00.000Z',
        recomendacion: {
          id: 3,
          nivel: 'ALERTA',
          titulo: 'Medidas preventivas ante persistencia pluvial',
          contenido: 'Mantenerse alejado de ríos y quebradas; preparar mochila de emergencia.',
          origen: 'institucional_verificada',
        },
      };

      const htmlAviso = renderToStaticMarkup(
        <AvisoCambioNivelInApp
          cambioNivel={cambioNivelAlerta}
          onCerrar={() => {}}
        />
      );

      // Atributos de accesibilidad y data-testid obligatorio
      expect(htmlAviso).toContain('data-testid="aviso-cambio-nivel-inapp"');
      expect(htmlAviso).toContain('role="status"');
      expect(htmlAviso).toContain('aria-live="polite"');

      // Título claro de transición
      expect(htmlAviso).toContain(
        'Cambio en el nivel informativo de lluvia: de NORMAL a ALERTA'
      );

      // Resumen de la recomendación vigente para el nuevo nivel
      expect(htmlAviso).toContain('Medidas preventivas ante persistencia pluvial');
      expect(htmlAviso).toContain(
        'Mantenerse alejado de ríos y quebradas; preparar mochila de emergencia.'
      );

      // Nota explícita ineludible (Módulo 3 y GEMINI.md)
      expect(htmlAviso).toContain(
        'Aviso visual dentro de la aplicación (solo mientras la aplicación permanece abierta; no es una notificación remota ni sustituye canales oficiales).'
      );

      // Botón táctil para descartar
      expect(htmlAviso).toContain('Entendido / Cerrar aviso');
    });

    it('2.3. Simulador de sesión P06: Permite cerrar el aviso interactivo ocultándolo limpiamente', () => {
      let estadoAviso = {
        nivelAnterior: 'NORMAL',
        nivelNuevo: 'PRECAUCION',
        modalidad: 'simulada',
      };

      const onCerrarMock = vi.fn(() => {
        estadoAviso = null;
      });

      // Render inicial con aviso activo
      const htmlVisible = renderToStaticMarkup(
        <AvisoCambioNivelInApp
          cambioNivel={estadoAviso}
          onCerrar={onCerrarMock}
        />
      );
      expect(htmlVisible).toContain('data-testid="aviso-cambio-nivel-inapp"');
      expect(htmlVisible).toContain('de NORMAL a PRECAUCION');

      // Simular ejecución del cierre
      onCerrarMock();
      expect(onCerrarMock).toHaveBeenCalledTimes(1);
      expect(estadoAviso).toBeNull();

      // Render posterior al cierre
      const htmlOculto = renderToStaticMarkup(
        <AvisoCambioNivelInApp
          cambioNivel={estadoAviso}
          onCerrar={onCerrarMock}
        />
      );
      expect(htmlOculto).toBe('');
    });
  });
});
