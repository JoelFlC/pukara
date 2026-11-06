import React from 'react';
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

import AvisoPermanente from '../components/AvisoPermanente.jsx';
import BannerModoSimulacion from '../components/BannerModoSimulacion.jsx';
import BannerNivelInformativo from '../components/BannerNivelInformativo.jsx';
import RecomendacionesNivelVigente from '../components/RecomendacionesNivelVigente.jsx';
import TarjetaLecturaMeteorologica from '../components/TarjetaLecturaMeteorologica.jsx';
import HistorialEvaluaciones from '../components/HistorialEvaluaciones.jsx';

/**
 * Contenedor de prueba que renderiza el esqueleto visual completo de extremo a extremo
 * tal como se estructura en la vista principal (InicioPage).
 */
function EsqueletoCompleto({ estado, modalidad = 'real', historial = null }) {
  return (
    <div className="p-4 space-y-4">
      <AvisoPermanente />
      <BannerModoSimulacion
        modalidad={modalidad}
        esSimulacion={modalidad === 'simulada' || Boolean(estado?.es_simulacion)}
        alCambiarModalidad={() => {}}
        alInyectarEscenario={() => {}}
        alLimpiarSimulacion={() => {}}
      />
      <BannerNivelInformativo estado={estado} />
      <RecomendacionesNivelVigente
        recomendaciones={estado?.recomendaciones_nivel_vigente}
        nivelVigente={estado?.nivel_vigente || 'NORMAL'}
      />
      <TarjetaLecturaMeteorologica meteorologia={estado?.meteorologia} />
      <HistorialEvaluaciones
        items={historial?.items}
        total={historial?.total}
        modalidad={modalidad}
      />
    </div>
  );
}

describe('Semana 2 - Día 6 (Fase B): Pruebas de Renderizado del Esqueleto E2E (esqueleto.s2d6.test.jsx)', () => {
  // ==========================================================================
  // ESCENARIO 1: Renderizado del Nivel Informativo Vigente y Aviso Permanente
  // ==========================================================================
  it('1. Renderizado del Nivel Informativo Vigente ALERTA, trazabilidad, aviso permanente y ausencia de banner de simulación', () => {
    const mockEstadoAlerta = {
      ok: true,
      modalidad: 'real',
      es_simulacion: false,
      banner_simulacion: null,
      aviso_permanente:
        'Los niveles Normal, Precaución, Alerta y Emergencia son niveles informativos de lluvia: niveles meteorológicos simulados, calculados con umbrales académicos. No sustituyen alertas ni instrucciones de las autoridades oficiales. PUKARA muestra información bajo consulta y no avisa activamente a la población. Ante una emergencia, atienda las indicaciones oficiales y contacte a los servicios de emergencia.',
      estado_sistema: 'ALERTA',
      nivel_vigente: 'ALERTA',
      nivel_calculado: 'ALERTA',
      contador_descenso: 0,
      clasificacion_parcial: false,
      regla_saturacion_aplicada: false,
      antiguedad_minutos: 12,
      datos_desactualizados: false,
      t_max_minutos: 60,
      version_reglas: {
        configuracion_id: 1,
        version: 1,
        estado: 'vigente',
      },
      lectura: {
        id: 101,
        observado_en: '2026-10-23T23:00:00.000Z',
        intensidad_mm_h: 7.5,
        acum_24h_mm: 28.0,
        acum_72h_mm: 45.0,
        horas_validas_24h: 24,
        horas_validas_72h: 72,
        estado: 'valida',
        fuente: 'Open-Meteo',
        antiguedad_minutos: 12,
      },
      meteorologia: {
        disponible: true,
        origen_respuesta: 'open_meteo',
        fallo_api_reciente: false,
        banderas_calidad: {
          horas_completas_24h: true,
          horas_completas_72h: true,
          clasificacion_parcial: false,
        },
        lectura: {
          id: 101,
          observado_en: '2026-10-23T23:00:00.000Z',
          intensidad_mm_h: 7.5,
          acum_24h_mm: 28.0,
          acum_72h_mm: 45.0,
          horas_validas_24h: 24,
          horas_validas_72h: 72,
          estado: 'valida',
          antiguedad_minutos: 12,
          temperatura: 12.0,
          humedad: 70,
          viento: 8.0,
        },
      },
      recomendaciones_nivel_vigente: [
        {
          id: 1,
          nivel: 'ALERTA',
          titulo: 'Monitoreo preventivo de canaletas y bajantes',
          contenido:
            'Verificar desagües pluviales ante persistencia de precipitaciones.',
          origen: 'demostracion',
          fuente: 'Guía de Demostración PUKARA',
        },
      ],
    };

    const mockHistorial = {
      items: [
        {
          evaluacion_id: 1,
          observado_en: '2026-10-23T23:00:00.000Z',
          nivel_calculado: 'ALERTA',
          nivel_vigente: 'ALERTA',
          contador_descenso: 0,
          version_reglas: 1,
          variables: { intensidad_mm_h: 7.5, acum_24h_mm: 28.0 },
        },
      ],
      total: 1,
    };

    const html = renderToStaticMarkup(
      <EsqueletoCompleto
        estado={mockEstadoAlerta}
        modalidad="real"
        historial={mockHistorial}
      />
    );

    // 1. Aviso permanente siempre presente
    expect(html).toContain('Aviso Permanente Institucional');
    expect(html).toContain('niveles informativos de lluvia');
    expect(html).toContain('umbrales académicos');
    expect(html).toContain('PUKARA muestra información bajo consulta');

    // 2. Nivel informativo vigente ALERTA
    expect(html).toContain('Nivel informativo de lluvia: ALERTA');

    // 3. Antigüedad y trazabilidad
    expect(html).toContain('12 min');
    expect(html).toContain('Versión de configuración: v1');
    expect(html).toContain('Histéresis (contador descenso): 0/2');

    // 4. Recomendaciones del nivel vigente con etiqueta 'demostracion'
    expect(html).toContain('Recomendaciones Preventivas para ALERTA');
    expect(html).toContain('Monitoreo preventivo de canaletas y bajantes');
    expect(html).toContain('demostracion');

    // 5. NO debe mostrar el banner de modo simulación activa en modalidad real
    expect(html).not.toContain('MODO SIMULACIÓN ACADÉMICA ACTIVO');
  });

  // ==========================================================================
  // ESCENARIO 2: Renderizado de DATOS_DESACTUALIZADOS sin degradar a NORMAL (P15)
  // ==========================================================================
  it('2. Renderizado de DATOS_DESACTUALIZADOS con antigüedad de 95 min, conservando el último nivel conocido EMERGENCIA sin degradar a NORMAL (P15)', () => {
    const mockDatosDesactualizados = {
      ok: true,
      modalidad: 'real',
      es_simulacion: false,
      banner_simulacion: null,
      estado_sistema: 'DATOS_DESACTUALIZADOS',
      nivel_vigente: 'EMERGENCIA',
      ultimo_nivel_conocido: 'EMERGENCIA',
      datos_desactualizados: true,
      antiguedad_minutos: 95,
      t_max_minutos: 60,
      version_reglas: { version: 1 },
      lectura: {
        id: 42,
        observado_en: '2026-10-23T20:00:00.000Z',
        fuente: 'Open-Meteo',
        intensidad_mm_h: 15.0,
        acum_24h_mm: 55.0,
        acum_72h_mm: 110.0,
        horas_validas_24h: 24,
        horas_validas_72h: 72,
        estado: 'valida',
        antiguedad_minutos: 95,
      },
      meteorologia: {
        disponible: true,
        origen_respuesta: 'open_meteo',
        fallo_api_reciente: true,
        lectura: {
          id: 42,
          observado_en: '2026-10-23T20:00:00.000Z',
          intensidad_mm_h: 15.0,
          acum_24h_mm: 55.0,
          acum_72h_mm: 110.0,
          horas_validas_24h: 24,
          horas_validas_72h: 72,
          estado: 'valida',
          antiguedad_minutos: 95,
          temperatura: 10.0,
          humedad: 90,
          viento: 15.0,
        },
      },
      recomendaciones_nivel_vigente: [
        {
          id: 5,
          nivel: 'EMERGENCIA',
          titulo: 'Atención a canales y taludes cercanos',
          contenido:
            'Permanecer atento a indicaciones oficiales ante eventos extraordinarios.',
          origen: 'institucional_verificada',
          fuente: 'Cartilla de Emergencias',
        },
      ],
    };

    const html = renderToStaticMarkup(
      <EsqueletoCompleto
        estado={mockDatosDesactualizados}
        modalidad="real"
      />
    );

    // 1. Alerta visual destacada de vencimiento temporal (T6 / P15)
    expect(html).toContain(
      'DATOS DESACTUALIZADOS (supera el límite de vigencia T_max)'
    );

    // 2. Refleja la antigüedad exacta mayor a T_max (95 min = 1 h 35 min)
    expect(html).toContain('1 h 35 min');

    // 3. Conserva visible el último nivel conocido EMERGENCIA
    expect(html).toContain('Último nivel informativo conocido');
    expect(html).toContain('EMERGENCIA');
    expect(html).toContain('institucional_verificada');

    // 4. PROHIBICIÓN ESTRICTA: jamás degradar a NORMAL
    expect(html).not.toContain('Nivel informativo de lluvia: NORMAL');
    expect(html).not.toContain('Estado: NORMAL');
  });

  // ==========================================================================
  // ESCENARIO 3: Banner de Modo Simulación y Acumulado Incompleto (P11 y P02)
  // ==========================================================================
  it('3. Renderizado de modo simulación con banner académico de alto contraste, clasificación parcial y acumulado 72h incompleto sin asumir 0 mm (P11 y P02)', () => {
    const mockSimulacionConHueco = {
      ok: true,
      modalidad: 'simulada',
      es_simulacion: true,
      banner_simulacion: 'DATOS SIMULADOS DE DEMOSTRACIÓN ACADÉMICA',
      estado_sistema: 'PRECAUCION',
      nivel_vigente: 'PRECAUCION',
      nivel_calculado: 'PRECAUCION',
      contador_descenso: 0,
      clasificacion_parcial: true,
      regla_saturacion_aplicada: false,
      antiguedad_minutos: 5,
      datos_desactualizados: false,
      t_max_minutos: 60,
      version_reglas: { version: 1 },
      lectura: {
        id: 999,
        observado_en: '2026-10-23T23:00:00.000Z',
        fuente: 'simulacion_academica',
        intensidad_mm_h: 3.2,
        acum_24h_mm: 14.5,
        horas_validas_24h: 24,
        acum_72h_mm: null, // Ventana con horas faltantes
        horas_validas_72h: 60, // 60 de 72 horas
        estado: 'incompleta',
        antiguedad_minutos: 5,
      },
      meteorologia: {
        disponible: true,
        origen_respuesta: 'simulacion_academica',
        fallo_api_reciente: false,
        banderas_calidad: {
          intensidad_completa: true,
          acum_24h_completo: true,
          acum_72h_completo: false,
          clasificacion_parcial: true,
        },
        lectura: {
          id: 999,
          observado_en: '2026-10-23T23:00:00.000Z',
          intensidad_mm_h: 3.2,
          acum_24h_mm: 14.5,
          horas_validas_24h: 24,
          acum_72h_mm: null,
          horas_validas_72h: 60,
          estado: 'incompleta',
          antiguedad_minutos: 5,
          temperatura: 11.0,
          humedad: 75,
          viento: 10.0,
        },
      },
      recomendaciones_nivel_vigente: [
        {
          id: 2,
          nivel: 'PRECAUCION',
          titulo: 'Recomendación preventiva de prueba',
          contenido: 'Mantener canaletas limpias.',
          origen: 'demostracion',
        },
      ],
    };

    const html = renderToStaticMarkup(
      <EsqueletoCompleto
        estado={mockSimulacionConHueco}
        modalidad="simulada"
      />
    );

    // 1. Banner obligatorio de Modo Simulación Académica (P11)
    expect(html).toContain(
      'MODO SIMULACIÓN ACADÉMICA ACTIVO — Los datos y el nivel mostrados son simulados para demostración y NO alteran el estado meteorológico real.'
    );
    expect(html).toContain('Simular Normal');
    expect(html).toContain('Simular Precaución');
    expect(html).toContain('Simular Alerta');
    expect(html).toContain('Simular Emergencia');
    expect(html).toContain('Limpiar Simulación');

    // 2. Banner de clasificación parcial por horas faltantes (P02)
    expect(html).toContain(
      'Clasificación parcial: una o más ventanas de acumulación (24h/72h) tienen horas faltantes y fueron excluidas del cálculo.'
    );

    // 3. Tarjeta pluviométrica con acumulado incompleto: PROHIBIDO mostrar 0 mm
    expect(html).toContain('Acumulado incompleto (60/72 h)');
    expect(html).toContain('60/72 horas válidas');
    expect(html).not.toContain('0 mm');
    expect(html).toContain('3.2');
    expect(html).toContain('14.5');
  });
});

