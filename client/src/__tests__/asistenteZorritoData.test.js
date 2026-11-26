/**
 * @file asistenteZorritoData.test.js
 * @description Suite de pruebas para el banco determinista del Asistente Zorrito y auditoría semántica estricta.
 */

import { describe, it, expect } from 'vitest';
import {
  IMAGENES_ZORRITO,
  MENSAJES_POR_NIVEL,
  MENSAJES_CONTEXTO,
  PREGUNTAS_FRECUENTES,
  obtenerSaludoBienvenida,
  resolverEstadoVisualZorrito,
  buscarRespuestaPorConsulta,
  construirTextoLecturaEstado,
  construirTextoLecturaRecomendaciones,
  construirTextoLecturaLluvia1h,
  construirTextoLecturaAcum24h,
  construirTextoLecturaSaturacion72h,
  construirTextoLecturaAmbiente,
} from '../data/asistenteZorritoData.js';

const TERMINOS_PROHIBIDOS = [
  ['alerta', 'oficial'].join(' '),
  ['orden', 'de', 'evacuación'].join(' '),
  ['evac', 'uar'].join(''),
  ['evac', 'uación'].join(''),
  ['zona', 'segura'].join(' '),
  ['ruta', 'segura'].join(' '),
  ['refugio', 'verificado'].join(' '),
  ['c', 'ómo llegar'].join(''),
  ['maps.google', '.com'].join(''),
  ['waze', '.com'].join(''),
];

function verificarSinTerminosProhibidos(texto) {
  const limpio = String(texto || '').toLowerCase();
  for (const termino of TERMINOS_PROHIBIDOS) {
    expect(limpio).not.toContain(termino);
  }
}

describe('Base de Conocimiento Determinista del Asistente Zorrito (asistenteZorritoData.js)', () => {
  it('1. Resuelve los 4 sprites y modos Duolingo del Zorrito según nivel, bienvenida, modo offline, simulación y lectura por voz', () => {
    const saludo = resolverEstadoVisualZorrito({
      nivelVigente: 'NORMAL',
      esBienvenida: true,
      hora: 9,
    });
    expect(saludo.imagen).toBe(IMAGENES_ZORRITO.saludo);
    expect(saludo.modoVisual).toBe('saludo_libre');
    expect(saludo.sinCuadro).toBe(true);
    expect(saludo.mensaje).toContain('Buenos días');

    const normal = resolverEstadoVisualZorrito({
      nivelVigente: 'NORMAL',
      esBienvenida: false,
    });
    expect(normal.imagen).toBe(IMAGENES_ZORRITO.normal);
    expect(normal.modoVisual).toBe('recuadro_normal');
    expect(normal.sinCuadro).toBe(false);

    const precaucion = resolverEstadoVisualZorrito({
      nivelVigente: 'PRECAUCION',
      esBienvenida: false,
    });
    expect(precaucion.imagen).toBe(IMAGENES_ZORRITO.cartel);
    expect(precaucion.modoVisual).toBe('recuadro_normal');
    expect(precaucion.sinCuadro).toBe(false);

    const offline = resolverEstadoVisualZorrito({
      nivelVigente: 'NORMAL',
      estaOffline: true,
      esBienvenida: false,
    });
    expect(offline.imagen).toBe(IMAGENES_ZORRITO.cartel);
    expect(offline.mensaje).toContain('sin internet');

    const simulacion = resolverEstadoVisualZorrito({
      nivelVigente: 'NORMAL',
      esSimulacion: true,
      esBienvenida: false,
    });
    expect(simulacion.imagen).toBe(IMAGENES_ZORRITO.cartel);
    expect(simulacion.mensaje).toContain('simulación');

    const alerta = resolverEstadoVisualZorrito({
      nivelVigente: 'ALERTA',
      esBienvenida: false,
    });
    expect(alerta.imagen).toBe(IMAGENES_ZORRITO.megafono);
    expect(alerta.modoVisual).toBe('loco_alerta');
    expect(alerta.sinCuadro).toBe(true);

    const emergencia = resolverEstadoVisualZorrito({
      nivelVigente: 'EMERGENCIA',
      esBienvenida: false,
    });
    expect(emergencia.imagen).toBe(IMAGENES_ZORRITO.megafono);
    expect(emergencia.modoVisual).toBe('loco_alerta');
    expect(emergencia.sinCuadro).toBe(true);

    const leyendo = resolverEstadoVisualZorrito({
      nivelVigente: 'NORMAL',
      leyendoVoz: true,
      esBienvenida: false,
    });
    expect(leyendo.imagen).toBe(IMAGENES_ZORRITO.cartel);
    expect(leyendo.modoVisual).toBe('presentando_cartel');
    expect(leyendo.sinCuadro).toBe(true);
  });

  it('2. Responde las 7 preguntas frecuentes dinámicamente y permite búsqueda por palabras clave offline', () => {
    expect(PREGUNTAS_FRECUENTES).toHaveLength(7);

    const contextoAlerta = {
      nivelVigente: 'ALERTA',
      estadoSistema: 'ALERTA',
      esSimulacion: true,
      estaOffline: true,
      recomendacionVigente: {
        titulo: 'Monitoreo de taludes',
        contenido: 'Alejarse de quebradas en Llojeta.',
      },
    };

    for (const faq of PREGUNTAS_FRECUENTES) {
      const resp = faq.responder(contextoAlerta);
      expect(typeof resp).toBe('string');
      expect(resp.length).toBeGreaterThan(40);
      verificarSinTerminosProhibidos(resp);
    }

    const rNivel = PREGUNTAS_FRECUENTES[0].responder(contextoAlerta);
    expect(rNivel).toContain('ALERTA');
    expect(rNivel).toContain('Modo Simulación');

    const busquedaHaversine = buscarRespuestaPorConsulta(
      'como calcula la distancia gps',
      contextoAlerta
    );
    expect(busquedaHaversine.encontrada).toBe(true);
    expect(busquedaHaversine.preguntaId).toBe('distancia-gps');
    expect(busquedaHaversine.respuesta).toContain('Haversine');

    const saludoHola = buscarRespuestaPorConsulta('Hola Zorrito', contextoAlerta);
    expect(saludoHola.encontrada).toBe(true);
    expect(saludoHola.preguntaId).toBe('saludo');
    expect(saludoHola.respuesta).toContain('ALERTA');

    const gracias = buscarRespuestaPorConsulta('Muchas gracias', contextoAlerta);
    expect(gracias.encontrada).toBe(true);
    expect(gracias.preguntaId).toBe('despedida');

    const busquedaFueraDominio = buscarRespuestaPorConsulta(
      'quien gano el partido de futbol',
      contextoAlerta
    );
    expect(busquedaFueraDominio.encontrada).toBe(false);
    expect(busquedaFueraDominio.respuesta).toContain(
      'Solo puedo ayudarte con información preventiva de PUKARA'
    );
  });

  it('3. Construye guiones hablados claros para estado vigente y recomendaciones sin términos prohibidos', () => {
    const scriptEstado = construirTextoLecturaEstado({
      estado_sistema: 'ALERTA',
      nivel_vigente: 'ALERTA',
      antiguedad_minutos: 8,
      lectura: { observado_en: '2026-11-26T12:00:00.000Z' },
    });
    expect(scriptEstado).toContain('Nivel informativo de lluvia vigente en Llojeta: ALERTA');
    expect(scriptEstado).toContain('no sustituye alertas');
    verificarSinTerminosProhibidos(scriptEstado);

    const scriptSinDatos = construirTextoLecturaEstado({
      estado_sistema: 'SIN_DATOS',
    });
    expect(scriptSinDatos).toContain('sin datos meteorológicos válidos');
    verificarSinTerminosProhibidos(scriptSinDatos);

    const scriptRecs = construirTextoLecturaRecomendaciones('PRECAUCION', [
      {
        nivel: 'NORMAL',
        rec: { titulo: 'Normal', contenido: 'Revisar canaletas.' },
      },
      {
        nivel: 'PRECAUCION',
        rec: { titulo: 'Precaución', contenido: 'Evitar cauces y quebradas.' },
      },
    ]);
    expect(scriptRecs).toContain('Recomendaciones preventivas generales');
    expect(scriptRecs).toContain('Nivel vigente PRECAUCION');
    verificarSinTerminosProhibidos(scriptRecs);

    // Guiones de telemetría (lluvia, saturación y ambiente), respetando regla de nulos
    const script1h = construirTextoLecturaLluvia1h({
      intensidad_mm_h: 5.4,
      antiguedad_minutos: 4,
    });
    expect(script1h).toContain('5.4 milímetros por hora');
    verificarSinTerminosProhibidos(script1h);

    const script24hIncompleto = construirTextoLecturaAcum24h({
      acum_24h_mm: null,
      horas_validas_24h: 19,
    });
    expect(script24hIncompleto).toContain('acumulado incompleto');
    expect(script24hIncompleto).not.toContain('0 milímetros');

    const script72h = construirTextoLecturaSaturacion72h({
      acum_72h_mm: 64,
      horas_validas_72h: 72,
    });
    expect(script72h).toContain('64 milímetros acumulados');
    expect(script72h).toContain('umbral de 60 milímetros');

    const scriptAmbiente = construirTextoLecturaAmbiente({
      temperatura: 12.5,
      humedad: 82,
      viento: 9.1,
    });
    expect(scriptAmbiente).toContain('12.5 grados Celsius');
    expect(scriptAmbiente).toContain('82 por ciento');
    expect(scriptAmbiente).toContain('9.1 kilómetros por hora');
  });

  it('4. Auditoría semántica estricta de todos los mensajes, saludos y respuestas del Zorrito', () => {
    for (const h of [8, 15, 22]) {
      verificarSinTerminosProhibidos(obtenerSaludoBienvenida(h));
    }

    for (const lista of Object.values(MENSAJES_POR_NIVEL)) {
      for (const msg of lista) {
        verificarSinTerminosProhibidos(msg);
      }
    }

    for (const msg of Object.values(MENSAJES_CONTEXTO)) {
      verificarSinTerminosProhibidos(msg);
    }

    for (const nivel of ['NORMAL', 'PRECAUCION', 'ALERTA', 'EMERGENCIA']) {
      for (const faq of PREGUNTAS_FRECUENTES) {
        verificarSinTerminosProhibidos(faq.pregunta);
        verificarSinTerminosProhibidos(
          faq.responder({ nivelVigente: nivel, estadoSistema: nivel })
        );
      }
    }
  });
});
