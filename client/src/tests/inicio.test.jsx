import React from 'react';
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

import {
  formatearFechaHoraLaPaz,
  formatearAntiguedad,
} from '../utils/formatoTiempo.js';
import AvisoPermanente from '../components/AvisoPermanente.jsx';
import TarjetaLecturaMeteorologica from '../components/TarjetaLecturaMeteorologica.jsx';

describe('Suite Frontend: Utilidades de Tiempo y Componentes (inicio.test.jsx)', () => {
  it('1. formatearFechaHoraLaPaz y formatearAntiguedad formatean correctamente marcas UTC a hora de Bolivia (UTC-4) y minutos', () => {
    // 23:00 UTC corresponde a las 19:00 en La Paz (BOT, UTC-4)
    const fechaUtc = '2026-10-23T23:00:00.000Z';
    const formateada = formatearFechaHoraLaPaz(fechaUtc);

    expect(formateada).toContain('19:00');
    expect(formateada).toContain('hora La Paz, BOT');
    expect(formatearFechaHoraLaPaz(null)).toBe('No disponible');
    expect(formatearFechaHoraLaPaz('fecha-invalida')).toBe('No disponible');

    // Casos de prueba de antigüedad
    expect(formatearAntiguedad(0.2)).toBe('hace menos de 1 min');
    expect(formatearAntiguedad(12)).toBe('hace 12 min');
    expect(formatearAntiguedad(60)).toBe('hace 1 h');
    expect(formatearAntiguedad(75)).toBe('hace 1 h 15 min');
    expect(formatearAntiguedad(null)).toBe('Sin registro previo');
    expect(formatearAntiguedad(undefined)).toBe('Sin registro previo');
  });

  it('2. <AvisoPermanente/> contiene obligatoriamente las frases canónicas y no es cerrable', () => {
    const html = renderToStaticMarkup(<AvisoPermanente />);

    // Frases obligatorias de la memoria arquitectónica (GEMINI.md)
    expect(html).toContain('niveles informativos de lluvia');
    expect(html).toContain('umbrales académicos');
    expect(html).toContain(
      'No sustituyen alertas ni instrucciones de las autoridades oficiales'
    );
    expect(html).toContain('PUKARA muestra información bajo consulta');

    // No debe contener botones de cierre/ocultamiento
    expect(html).not.toContain('button');
    expect(html).not.toContain('Cerrar');
    expect(html).not.toContain('×');
  });

  it('3. <TarjetaLecturaMeteorologica/> muestra "SIN DATOS" cuando disponible: false (nunca "Normal"), y con null acumulado muestra "incompleto" y "20/24" en vez de "0 mm"', () => {
    // 3.A Caso sin datos
    const htmlSinDatos = renderToStaticMarkup(
      <TarjetaLecturaMeteorologica meteorologia={{ disponible: false }} />
    );

    expect(htmlSinDatos).toContain('SIN DATOS');
    expect(htmlSinDatos).toContain('SIN DATOS METEOROLÓGICOS REGISTRADOS');
    // PROHIBIDO catalogar como Normal por ausencia de datos
    expect(htmlSinDatos).not.toContain('Nivel Normal');
    expect(htmlSinDatos).not.toContain('Estado: Normal');

    // 3.B Caso con acumulado null y horas válidas parciales
    const mockConNull = {
      disponible: true,
      origen_respuesta: 'open_meteo',
      fallo_api_reciente: false,
      banderas_calidad: {
        intensidad_completa: true,
        acum_24h_completo: false,
        acum_72h_completo: false,
        clasificacion_parcial: true,
      },
      nota_modelo: 'Datos de modelo meteorológico Open-Meteo',
      lectura: {
        id: 1,
        observado_en: '2026-10-23T23:00:00.000Z',
        intensidad_mm_h: 2.5,
        acum_24h_mm: null, // Dato incompleto
        acum_72h_mm: null,
        horas_validas_24h: 20, // 20 de 24 horas válidas
        horas_validas_72h: 68,
        estado: 'incompleta',
        antiguedad_minutos: 15,
        temperatura: 10.5,
        humedad: 80,
        viento: 6.2,
      },
    };

    const htmlConNull = renderToStaticMarkup(
      <TarjetaLecturaMeteorologica meteorologia={mockConNull} />
    );

    // Debe evidenciar el estado incompleto y la fracción horaria
    expect(htmlConNull).toContain('Acumulado incompleto');
    expect(htmlConNull).toContain('20/24');
    // PROHIBIDO asumir 0 mm ante nulos
    expect(htmlConNull).not.toContain('0 mm');
    expect(htmlConNull).toContain('2.5');
    expect(htmlConNull).toContain('Nota de calidad de datos');
  });
});
