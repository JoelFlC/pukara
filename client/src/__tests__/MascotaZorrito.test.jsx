/**
 * @file MascotaZorrito.test.jsx
 * @description Suite de pruebas para MascotaZorrito, estados de imagen, panel asistente y BotonLeerVoz.
 */

import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

import MascotaZorrito, {
  enviarConsultaAsistenteZorrito,
} from '../components/MascotaZorrito.jsx';
import BannerNivelInformativo from '../components/BannerNivelInformativo.jsx';
import SeccionRecomendaciones from '../components/SeccionRecomendaciones.jsx';
import TarjetaLecturaMeteorologica from '../components/TarjetaLecturaMeteorologica.jsx';
import {
  IMAGENES_ZORRITO,
  PREGUNTAS_FRECUENTES,
} from '../data/asistenteZorritoData.js';
import { reiniciarEstadoLectorVoz } from '../utils/lectorVoz.js';

describe('Mascota Zorrito, Panel Asistente y Botón de Voz (MascotaZorrito.test.jsx)', () => {
  const originalSpeechSynthesis = globalThis.speechSynthesis;
  const originalUtterance = globalThis.SpeechSynthesisUtterance;

  beforeEach(() => {
    reiniciarEstadoLectorVoz();
    delete globalThis.speechSynthesis;
    delete globalThis.SpeechSynthesisUtterance;
  });

  afterEach(() => {
    reiniciarEstadoLectorVoz();
    if (originalSpeechSynthesis !== undefined) {
      globalThis.speechSynthesis = originalSpeechSynthesis;
    } else {
      delete globalThis.speechSynthesis;
    }
    if (originalUtterance !== undefined) {
      globalThis.SpeechSynthesisUtterance = originalUtterance;
    } else {
      delete globalThis.SpeechSynthesisUtterance;
    }
    vi.restoreAllMocks();
  });

  it('1. Muestra la escena central de bienvenida con ¡Bienvenido a PUKARA! y modos transparentes ampliados manteniendo el cuadro normal igual', () => {
    const htmlBienvenida = renderToStaticMarkup(
      <MascotaZorrito nivelVigente="NORMAL" esBienvenidaInicial={true} />
    );
    expect(htmlBienvenida).toContain(IMAGENES_ZORRITO.saludo);
    expect(htmlBienvenida).toContain('data-testid="zorrito-escena-bienvenida"');
    expect(htmlBienvenida).toContain('¡Bienvenido a PUKARA!');
    expect(htmlBienvenida).toContain('data-modo-visual="saludo_libre"');
    expect(htmlBienvenida).toContain('w-[176px]');
    expect(htmlBienvenida).toContain('sm:w-[220px]');
    expect(htmlBienvenida).toContain('bg-transparent');
    expect(htmlBienvenida).toContain('zorrito-saludo-duolingo');
    expect(htmlBienvenida).toContain('zorrito-sombra-suelo');
    expect(htmlBienvenida).toContain('data-testid="zorrito-burbuja"');

    const htmlNormal = renderToStaticMarkup(
      <MascotaZorrito nivelVigente="NORMAL" esBienvenidaInicial={false} />
    );
    expect(htmlNormal).toContain(`src="${IMAGENES_ZORRITO.normal}"`);
    expect(htmlNormal).toContain('data-modo-visual="recuadro_normal"');
    expect(htmlNormal).toContain('w-[96px] h-[96px] sm:w-[110px] sm:h-[110px]');
    expect(htmlNormal).toContain('zorrito-idle-duolingo');

    const htmlPrecaucion = renderToStaticMarkup(
      <MascotaZorrito nivelVigente="PRECAUCION" esBienvenidaInicial={false} />
    );
    expect(htmlPrecaucion).toContain(`src="${IMAGENES_ZORRITO.cartel}"`);
    expect(htmlPrecaucion).toContain('data-modo-visual="recuadro_normal"');

    const htmlOffline = renderToStaticMarkup(
      <MascotaZorrito
        nivelVigente="NORMAL"
        estaOffline={true}
        esBienvenidaInicial={false}
      />
    );
    expect(htmlOffline).toContain(`src="${IMAGENES_ZORRITO.cartel}"`);

    const htmlSim = renderToStaticMarkup(
      <MascotaZorrito
        nivelVigente="NORMAL"
        esSimulacion={true}
        esBienvenidaInicial={false}
      />
    );
    expect(htmlSim).toContain(`src="${IMAGENES_ZORRITO.cartel}"`);

    const htmlAlerta = renderToStaticMarkup(
      <MascotaZorrito nivelVigente="ALERTA" esBienvenidaInicial={false} />
    );
    expect(htmlAlerta).toContain(`src="${IMAGENES_ZORRITO.megafono}"`);
    expect(htmlAlerta).toContain('data-modo-visual="loco_alerta"');
    expect(htmlAlerta).toContain('w-[164px]');
    expect(htmlAlerta).toContain('sm:w-[196px]');
    expect(htmlAlerta).toContain('zorrito-alerta-loco');
    expect(htmlAlerta).toContain('zorrito-aura-alerta');
    expect(htmlAlerta).toContain('zorrito-sombra-suelo');
    expect(htmlAlerta).toContain('bg-transparent');

    const htmlVozActiva = renderToStaticMarkup(
      <MascotaZorrito
        nivelVigente="NORMAL"
        esBienvenidaInicial={false}
        leyendoVozInicial={true}
      />
    );
    expect(htmlVozActiva).toContain(`src="${IMAGENES_ZORRITO.cartel}"`);
    expect(htmlVozActiva).toContain('data-modo-visual="presentando_cartel"');
    expect(htmlVozActiva).toContain('w-[164px]');
    expect(htmlVozActiva).toContain('sm:w-[196px]');
    expect(htmlVozActiva).toContain('zorrito-salir-cuadro');
    expect(htmlVozActiva).toContain('zorrito-presentando');
    expect(htmlVozActiva).toContain('zorrito-sombra-suelo');
    expect(htmlVozActiva).toContain('bg-transparent');
  });

  it('2. Renderiza el panel del asistente con pestañas >= 48px, 7 chips de FAQs y pestaña de Checklist Familiar', () => {
    const htmlAsistente = renderToStaticMarkup(
      <MascotaZorrito
        nivelVigente="ALERTA"
        abiertoInicialmente={true}
        pestanaInicial="asistente"
      />
    );

    expect(htmlAsistente).toContain('data-testid="panel-asistente-zorrito"');
    expect(htmlAsistente).toContain('Asistente Preventivo Zorrito');
    expect(htmlAsistente).toContain('data-testid="tab-asistente-voz"');
    expect(htmlAsistente).toContain('data-testid="tab-checklist-familiar"');
    expect(htmlAsistente).toContain('data-testid="respuesta-zorrito"');
    expect(htmlAsistente).toContain('data-testid="input-consulta-zorrito"');
    expect(htmlAsistente).toContain('data-testid="btn-leer-voz-respuesta-zorrito"');

    for (const faq of PREGUNTAS_FRECUENTES) {
      expect(htmlAsistente).toContain(`data-testid="faq-chip-${faq.id}"`);
      expect(htmlAsistente).toContain(faq.pregunta);
    }

    const htmlChecklist = renderToStaticMarkup(
      <MascotaZorrito
        nivelVigente="NORMAL"
        abiertoInicialmente={true}
        pestanaInicial="checklist"
      />
    );
    expect(htmlChecklist).toContain('data-testid="checklist-familiar"');
    expect(htmlChecklist).toContain('0 de 6 completados');
  });

  it('3. Integra BotonLeerVoz en BannerNivelInformativo y SeccionRecomendaciones cuando speechSynthesis está disponible', () => {
    class MockUtterance {
      constructor(text) {
        this.text = text;
      }
    }
    globalThis.SpeechSynthesisUtterance = MockUtterance;
    globalThis.speechSynthesis = {
      cancel: vi.fn(),
      speak: vi.fn(),
      getVoices: () => [],
    };

    const htmlConVoz = renderToStaticMarkup(
      <div>
        <BannerNivelInformativo
          estado={{
            estado_sistema: 'ALERTA',
            nivel_vigente: 'ALERTA',
            antiguedad_minutos: 4,
            version_reglas: { version: 1 },
            lectura: { observado_en: '2026-11-26T12:00:00.000Z', fuente: 'Open-Meteo' },
          }}
        />
        <SeccionRecomendaciones
          nivelVigente="ALERTA"
          recomendacionesPublicadas={[
            {
              nivel: 'ALERTA',
              titulo: 'Medidas preventivas',
              contenido: 'Alejarse de quebradas en Llojeta.',
              origen: 'demostracion',
            },
          ]}
        />
        <TarjetaLecturaMeteorologica
          meteorologia={{
            disponible: true,
            origen_respuesta: 'open_meteo',
            lectura: {
              observado_en: '2026-11-26T12:00:00.000Z',
              intensidad_mm_h: 5.5,
              acum_24h_mm: 18.2,
              acum_72h_mm: 42.0,
              horas_validas_24h: 24,
              horas_validas_72h: 72,
              temperatura: 12.1,
              humedad: 80,
              viento: 10.4,
              antiguedad_minutos: 4,
              estado: 'valida',
            },
          }}
        />
      </div>
    );

    expect(htmlConVoz).toContain('data-testid="btn-leer-voz-estado-nivel-vigente"');
    expect(htmlConVoz).toContain('Escuchar estado');
    expect(htmlConVoz).toContain('data-testid="btn-leer-voz-recomendaciones-vigentes"');
    expect(htmlConVoz).toContain('Escuchar guía');
    expect(htmlConVoz).toContain('data-testid="btn-leer-voz-telemetria-lluvia-1h"');
    expect(htmlConVoz).toContain('data-testid="btn-leer-voz-telemetria-acum-24h"');
    expect(htmlConVoz).toContain('data-testid="btn-leer-voz-telemetria-saturacion-72h"');
    expect(htmlConVoz).toContain('data-testid="btn-leer-voz-telemetria-ambiente"');
  });

  it('4. Auditoría semántica estricta del widget y panel del Zorrito', () => {
    const html = renderToStaticMarkup(
      <MascotaZorrito
        nivelVigente="EMERGENCIA"
        abiertoInicialmente={true}
        pestanaInicial="asistente"
      />
    );
    const htmlMin = html.toLowerCase();

    const prohibidos = [
      ['alerta', 'oficial'].join(' '),
      ['orden', 'de', 'evacuación'].join(' '),
      ['evac', 'uar'].join(''),
      ['zona', 'segura'].join(' '),
      ['ruta', 'segura'].join(' '),
      ['refugio', 'verificado'].join(' '),
      ['c', 'ómo llegar'].join(''),
    ];

    for (const term of prohibidos) {
      expect(htmlMin).not.toContain(term);
    }
  });

  it('5. Envía saludos/consultas libres al endpoint /api/asistente y cae al motor determinista offline cuando falla la red', async () => {
    const apiOk = vi.fn(async () => ({
      respuesta:
        '¡Hola vecino! El nivel informativo de lluvia en Llojeta es PRECAUCIÓN.',
      origen: 'cloud',
      bloqueada: false,
    }));

    const resCloud = await enviarConsultaAsistenteZorrito({
      mensaje: 'Hola, ¿cómo está Llojeta?',
      contextoActual: {
        nivelVigente: 'PRECAUCION',
        esSimulacion: true,
        estaOffline: false,
      },
      consultarApiFn: apiOk,
    });

    expect(apiOk).toHaveBeenCalledTimes(1);
    expect(resCloud.origen).toBe('cloud');
    expect(resCloud.respuesta).toContain('PRECAUCIÓN');

    const apiFalla = vi.fn(async () => {
      throw new Error('Failed to fetch');
    });

    const resFallback = await enviarConsultaAsistenteZorrito({
      mensaje: 'Buenos días',
      contextoActual: {
        nivelVigente: 'ALERTA',
        esSimulacion: false,
        estaOffline: false,
      },
      consultarApiFn: apiFalla,
    });

    expect(resFallback.origen).toBe('offline');
    expect(resFallback.respuesta).toContain('Hola, vecino de Llojeta');
    expect(resFallback.respuesta).toContain('ALERTA');

    // Renderizado de estado "Zorrito está pensando..." y etiqueta de origen
    const htmlPensando = renderToStaticMarkup(
      <MascotaZorrito
        nivelVigente="NORMAL"
        abiertoInicialmente={true}
        pensandoInicial={true}
      />
    );
    expect(htmlPensando).toContain('data-testid="zorrito-pensando"');
    expect(htmlPensando).toContain('Zorrito está pensando...');

    const htmlBadgeCloud = renderToStaticMarkup(
      <MascotaZorrito
        nivelVigente="NORMAL"
        abiertoInicialmente={true}
        origenInicial="cloud"
      />
    );
    expect(htmlBadgeCloud).toContain('data-testid="badge-origen-asistente"');
    expect(htmlBadgeCloud).toContain('En línea');
  });

  it('6. Recomienda activar los avisos sonoros en la burbuja y en el chat cuando están desactivados', () => {
    const controladorInactivo = {
      sonidoActivo: false,
      silenciado: false,
      activarAvisosCompletos: vi.fn(),
      desactivarAvisosCompletos: vi.fn(),
    };

    const htmlBurbuja = renderToStaticMarkup(
      <MascotaZorrito
        nivelVigente="NORMAL"
        esBienvenidaInicial={false}
        avisosControlador={controladorInactivo}
      />
    );
    expect(htmlBurbuja).toContain('data-testid="btn-zorrito-activar-sonido"');
    expect(htmlBurbuja).toContain('Activar sonido');

    const htmlPanel = renderToStaticMarkup(
      <MascotaZorrito
        nivelVigente="NORMAL"
        abiertoInicialmente={true}
        avisosControlador={controladorInactivo}
      />
    );
    expect(htmlPanel).toContain('data-testid="zorrito-recomendacion-avisos"');
    expect(htmlPanel).toContain('Te recomiendo activar los avisos sonoros');
    expect(htmlPanel).toContain('data-testid="zorrito-switch-avisos"');
  });
});
