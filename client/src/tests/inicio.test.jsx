import React from 'react';
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

import {
  formatearFechaHoraLaPaz,
  formatearAntiguedad,
} from '../utils/formatoTiempo.js';
import AvisoPermanente from '../components/AvisoPermanente.jsx';
import TarjetaLecturaMeteorologica from '../components/TarjetaLecturaMeteorologica.jsx';
import BannerModoSimulacion from '../components/BannerModoSimulacion.jsx';
import BannerNivelInformativo from '../components/BannerNivelInformativo.jsx';
import RecomendacionesNivelVigente from '../components/RecomendacionesNivelVigente.jsx';
import HistorialEvaluaciones from '../components/HistorialEvaluaciones.jsx';

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

  it('4. <BannerModoSimulacion/> conmuta visualmente y muestra el banner canónico en modo simulada (P11)', () => {
    // Modo real: no muestra el aviso de simulación activa
    const htmlReal = renderToStaticMarkup(
      <BannerModoSimulacion
        modalidad="real"
        alCambiarModalidad={() => {}}
        alInyectarEscenario={() => {}}
        alLimpiarSimulacion={() => {}}
      />
    );
    expect(htmlReal).toContain('Datos Reales (Open-Meteo)');
    expect(htmlReal).toContain('Modo Simulación (Demostración)');
    expect(htmlReal).not.toContain('MODO SIMULACIÓN ACADÉMICA ACTIVO');

    // Modo simulada: alto contraste con texto canónico y botones de los 4 escenarios
    const htmlSim = renderToStaticMarkup(
      <BannerModoSimulacion
        modalidad="simulada"
        alCambiarModalidad={() => {}}
        alInyectarEscenario={() => {}}
        alLimpiarSimulacion={() => {}}
      />
    );
    expect(htmlSim).toContain(
      'MODO SIMULACIÓN ACADÉMICA ACTIVO — Los datos y el nivel mostrados son simulados para demostración y NO alteran el estado meteorológico real.'
    );
    expect(htmlSim).toContain('Simular Normal');
    expect(htmlSim).toContain('Simular Precaución');
    expect(htmlSim).toContain('Simular Alerta');
    expect(htmlSim).toContain('Simular Emergencia');
    expect(htmlSim).toContain('Limpiar Simulación');
  });

  it('5. <BannerNivelInformativo/> maneja con rigor SIN_DATOS, DATOS_DESACTUALIZADOS y niveles con saturación', () => {
    // 5.A SIN_DATOS: jamás muestra Normal
    const htmlSinDatos = renderToStaticMarkup(
      <BannerNivelInformativo
        estado={{
          estado_sistema: 'SIN_DATOS',
          nivel_vigente: null,
          version_reglas: { version: 1 },
          modalidad: 'real',
        }}
      />
    );
    expect(htmlSinDatos).toContain('Estado: SIN DATOS METEOROLÓGICOS VÁLIDOS');
    expect(htmlSinDatos).not.toContain('Nivel informativo de lluvia: NORMAL');

    // 5.B DATOS_DESACTUALIZADOS: muestra el último nivel y no degrada a Normal
    const htmlDesact = renderToStaticMarkup(
      <BannerNivelInformativo
        estado={{
          estado_sistema: 'DATOS_DESACTUALIZADOS',
          datos_desactualizados: true,
          nivel_vigente: 'ALERTA',
          antiguedad_minutos: 85,
          t_max_minutos: 60,
          version_reglas: { version: 1 },
          modalidad: 'real',
          lectura: {
            observado_en: '2026-10-23T20:00:00.000Z',
            fuente: 'Open-Meteo',
          },
        }}
      />
    );
    expect(htmlDesact).toContain(
      'DATOS DESACTUALIZADOS (supera el límite de vigencia T_max)'
    );
    expect(htmlDesact).toContain('Último nivel informativo conocido');
    expect(htmlDesact).toContain('ALERTA');
    expect(htmlDesact).not.toContain('Nivel informativo de lluvia: NORMAL');

    // 5.C ALERTA con regla de saturación aplicada
    const htmlAlertaSat = renderToStaticMarkup(
      <BannerNivelInformativo
        estado={{
          estado_sistema: 'ALERTA',
          nivel_vigente: 'ALERTA',
          regla_saturacion_aplicada: true,
          clasificacion_parcial: false,
          contador_descenso: 0,
          antiguedad_minutos: 10,
          version_reglas: { version: 1 },
          modalidad: 'real',
          lectura: {
            observado_en: '2026-10-23T23:00:00.000Z',
            fuente: 'Open-Meteo',
          },
        }}
      />
    );
    expect(htmlAlertaSat).toContain('Nivel informativo de lluvia: ALERTA');
    expect(htmlAlertaSat).toContain('Regla de saturación aplicada');
    expect(htmlAlertaSat).toContain('Histéresis (contador descenso): 0/2');
    expect(htmlAlertaSat).toContain('Versión de configuración: v1');
  });

  it('6. <RecomendacionesNivelVigente/> y <HistorialEvaluaciones/> respetan la lista negra y muestran datos completos', () => {
    const recomendaciones = [
      {
        id: 1,
        nivel: 'ALERTA',
        titulo: 'Revisión preventiva de canaletas y bajantes',
        contenido:
          'Verifique que los desagües pluviales no presenten obstrucciones de tierra o basura.',
        origen: 'institucional_verificada',
        fuente: 'Manual de Prevención Pluvial',
      },
      {
        id: 2,
        nivel: 'ALERTA',
        titulo: 'Monitoreo preventivo del entorno',
        contenido:
          'Manténgase atento a grietas en el terreno o incremento de humedad en taludes cercanos.',
        origen: 'demostracion',
        fuente: 'Recomendación académica',
      },
    ];

    const htmlRec = renderToStaticMarkup(
      <RecomendacionesNivelVigente
        recomendaciones={recomendaciones}
        nivelVigente="ALERTA"
      />
    );
    expect(htmlRec).toContain('Recomendaciones Preventivas para ALERTA');
    expect(htmlRec).toContain('institucional_verificada');
    expect(htmlRec).toContain('demostracion');
    expect(htmlRec).toContain('Revisión preventiva de canaletas');

    // PROHIBICIONES ESTRICTAS (Lista Negra evaluada dinámicamente)
    const terminosProhibidos = [
      ['alerta', 'oficial'].join(' '),
      ['orden', 'de', 'evacuación'].join(' '),
      ['evacuar'].join(''),
      ['ruta', 'segura'].join(' '),
      ['zona', 'segura'].join(' '),
      ['refugio', 'verificado'].join(' '),
      ['Cómo', 'llegar'].join(' '),
    ];
    for (const term of terminosProhibidos) {
      expect(htmlRec.toLowerCase()).not.toContain(term.toLowerCase());
    }

    // Historial de evaluaciones
    const itemsHist = [
      {
        evaluacion_id: 10,
        observado_en: '2026-10-23T23:00:00.000Z',
        nivel_calculado: 'NORMAL',
        nivel_vigente: 'PRECAUCION',
        contador_descenso: 0,
        version_reglas: 1,
        variables: { intensidad_mm_h: 0.5, acum_24h_mm: 2.0 },
      },
    ];

    const htmlHist = renderToStaticMarkup(
      <HistorialEvaluaciones
        items={itemsHist}
        total={1}
        modalidad="real"
      />
    );
    expect(htmlHist).toContain('Historial Reciente (Real)');
    expect(htmlHist).toContain('NORMAL');
    expect(htmlHist).toContain('PRECAUCION');
    expect(htmlHist).toContain('0/2');
    expect(htmlHist).toContain('v1');
  });
});
