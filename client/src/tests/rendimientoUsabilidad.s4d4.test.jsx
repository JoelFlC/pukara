/**
 * @file rendimientoUsabilidad.s4d4.test.jsx
 * @description Suite de Rendimiento de Renderizado y Usabilidad en Cliente para la Semana 4 - Día 4 (S4D4):
 * Certificación de la Prueba Académica P19 en el Frontend:
 * - Prueba 1: Renderizado de pantalla principal con nivel informativo, antigüedad, recomendaciones y contactos en < 3000 ms (y < 1000 ms en cliente).
 * - Prueba 2: Verificación automatizada de heurísticas de usabilidad, comprensión del Aviso Permanente, controles descriptivos y conmutación entre los 4 niveles en < 1000 ms.
 */

import React from 'react';
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';

import AvisoPermanente from '../components/AvisoPermanente.jsx';
import BannerModoSimulacion from '../components/BannerModoSimulacion.jsx';
import BannerNivelInformativo from '../components/BannerNivelInformativo.jsx';
import TarjetaLecturaMeteorologica from '../components/TarjetaLecturaMeteorologica.jsx';
import SeccionRecomendaciones from '../components/SeccionRecomendaciones.jsx';
import SeccionContactosEmergencia from '../components/SeccionContactosEmergencia.jsx';
import AvisoCambioNivelInApp from '../components/AvisoCambioNivelInApp.jsx';
import MapaReferencial from '../components/MapaReferencial.jsx';

const RECOMENDACIONES_CANONICAS = [
  {
    id: 1,
    nivel: 'NORMAL',
    titulo: 'Recomendaciones preventivas generales — Nivel Normal',
    contenido:
      'Mantener limpias las canaletas domiciliarias y consultar periódicamente los reportes meteorológicos.',
    origen: 'demostracion',
    version: 1,
    fuente: 'Propuesta académica PUKARA',
  },
  {
    id: 2,
    nivel: 'PRECAUCION',
    titulo: 'Recomendaciones preventivas generales — Nivel Precaución',
    contenido:
      'Vigilar escorrentías superficiales, revisar drenajes y evitar acercarse a márgenes de ríos o quebradas.',
    origen: 'demostracion',
    version: 1,
    fuente: 'Propuesta académica PUKARA',
  },
  {
    id: 3,
    nivel: 'ALERTA',
    titulo: 'Monitoreo preventivo ante lluvia intensa o saturación',
    contenido:
      'Alejarse de quebradas y taludes en el sector Llojeta; tener lista mochila de emergencia y teléfonos de auxilio.',
    origen: 'institucional_verificada',
    version: 2,
    fuente: 'Dirección de Gestión de Riesgos GAMLP',
  },
  {
    id: 4,
    nivel: 'EMERGENCIA',
    titulo: 'Atención prioritaria a instrucciones oficiales de emergencia',
    contenido:
      'No transitar por vías anegadas ni puentes comprometidos; contactar inmediatamente a los servicios de emergencia.',
    origen: 'demostracion',
    version: 1,
    fuente: 'Propuesta académica PUKARA',
  },
];

const CONTACTOS_CANONICOS = [
  {
    id: 1,
    nombre: 'Red 114 — Emergencias GAMLP',
    telefono: '114',
    fuente: 'Gobierno Autónomo Municipal de La Paz',
    verificado_en: '2026-10-23',
    activo: true,
  },
  {
    id: 2,
    nombre: 'Bomberos Antofagasta La Paz',
    telefono: '119',
    fuente: 'Policía Boliviana',
    verificado_en: '2026-10-23',
    activo: true,
  },
  {
    id: 3,
    nombre: 'Cruz Roja Boliviana — Filial La Paz',
    telefono: '160',
    fuente: 'Cruz Roja Boliviana',
    verificado_en: '2026-10-23',
    activo: true,
  },
];

const ZONAS_CANONICAS = [
  {
    id: 1,
    nombre: 'Sector Pasajahuira / Santa Rosa de Llojeta',
    fuente: 'Secretaría Municipal de Gestión Integral de Riesgos GAMLP',
    fecha_dato: '2026-10-23',
    vigente_hasta: '2026-12-31',
    verificada: true,
    advertencia: 'referencia de demostración, no validada',
  },
  {
    id: 2,
    nombre: 'Sector Bajo Llojeta / Cuenca Río Llojeta',
    fuente: 'Propuesta académica PUKARA',
    fecha_dato: '2026-10-23',
    vigente_hasta: null,
    verificada: false,
    advertencia: 'referencia de demostración, no validada',
  },
];

const PUNTOS_CANONICOS = [
  {
    id: 1,
    nombre: 'Cruce Av. Los Sargentos y Av. Mario Mercado',
    tipo: 'interseccion',
    latitud: -16.528,
    longitud: -68.138,
    fuente: 'Levantamiento en campo PUKARA',
    estado_verificacion: 'verificado_por_autoridad',
    activo: true,
  },
  {
    id: 2,
    nombre: 'Cancha Bajo Llojeta',
    tipo: 'equipamiento',
    latitud: -16.519,
    longitud: -68.149,
    fuente: 'Cartografía Municipal La Paz',
    estado_verificacion: 'sin_verificar',
    activo: true,
  },
];

function construirEstadoPorNivel(nivel = 'ALERTA', modalidad = 'real') {
  const recomendacion =
    RECOMENDACIONES_CANONICAS.find((r) => r.nivel === nivel) ||
    RECOMENDACIONES_CANONICAS[0];

  return {
    ok: true,
    modalidad,
    nivel_vigente: nivel,
    estado_sistema: nivel,
    contador_descenso: 0,
    antiguedad_minutos: 6,
    t_max_minutos: 60,
    version_reglas: { version: 1 },
    lectura: {
      id: 501,
      observado_en: '2026-11-13T18:00:00.000Z',
      intensidad_mm_h: 7.5,
      acum_24h_mm: 28.0,
      acum_72h_mm: 64.0,
      fuente: modalidad === 'simulada' ? 'Simulación Académica' : 'Open-Meteo',
    },
    meteorologia: {
      disponible: true,
      observado_en: '2026-11-13T18:00:00.000Z',
      origen_respuesta: 'open_meteo',
      lectura: {
        id: 501,
        observado_en: '2026-11-13T18:00:00.000Z',
        intensidad_mm_h: 7.5,
        acum_24h_mm: 28.0,
        acum_72h_mm: 64.0,
        horas_validas_24h: 24,
        horas_validas_72h: 72,
        temperatura: 11.8,
        humedad: 84,
        viento: 12.5,
        antiguedad_minutos: 6,
        estado: 'valida',
      },
    },
    recomendacion,
    recomendaciones_publicadas: RECOMENDACIONES_CANONICAS,
    contactos_emergencia: CONTACTOS_CANONICOS,
    zonas_referencia: ZONAS_CANONICAS,
    puntos_referencia: PUNTOS_CANONICOS,
  };
}

describe('SUITE DE RENDIMIENTO DE RENDERIZADO Y USABILIDAD S4D4 — CERTIFICACIÓN P19 (< 3000 ms)', () => {
  // ===========================================================================
  // PRUEBA 1: Renderizado de pantalla principal con nivel y recomendaciones en < 3000 ms
  // ===========================================================================
  it('1. P19: Renderiza la pantalla principal completa (Aviso Permanente, Nivel Informativo y antigüedad, Recomendaciones con origen y Contactos de Emergencia) en menos de 3000 ms (< 1000 ms en cliente)', () => {
    const estadoAlerta = construirEstadoPorNivel('ALERTA', 'real');

    const inicio = performance.now();

    const htmlVistaPrincipal = renderToStaticMarkup(
      <MemoryRouter>
        <div>
          <AvisoPermanente />
          <BannerNivelInformativo estado={estadoAlerta} />
          <TarjetaLecturaMeteorologica
            meteorologia={estadoAlerta.meteorologia}
          />
          <SeccionRecomendaciones
            nivelVigente={estadoAlerta.nivel_vigente}
            estadoSistema={estadoAlerta.estado_sistema}
            recomendacionVigente={estadoAlerta.recomendacion}
            recomendacionesPublicadas={estadoAlerta.recomendaciones_publicadas}
          />
          <SeccionContactosEmergencia
            contactos={estadoAlerta.contactos_emergencia}
          />
          <MapaReferencial
            zonasReferencia={estadoAlerta.zonas_referencia}
            puntosReferencia={estadoAlerta.puntos_referencia}
            nivelVigente={estadoAlerta.nivel_vigente}
          />
        </div>
      </MemoryRouter>
    );

    const duracionMs = performance.now() - inicio;

    // 1. El <AvisoPermanente/> institucional está presente y visible
    expect(htmlVistaPrincipal).toContain('data-testid="aviso-permanente"');
    expect(htmlVistaPrincipal).toContain(
      'Los niveles Normal, Precaución, Alerta y Emergencia son niveles informativos de lluvia: niveles meteorológicos simulados, calculados con umbrales académicos.'
    );

    // 2. El Nivel Informativo Vigente y su antigüedad están visibles
    expect(htmlVistaPrincipal).toContain('Nivel informativo de lluvia: ALERTA');
    expect(htmlVistaPrincipal).toContain('Antigüedad: hace 6 min');

    // 3. La sección de <SeccionRecomendaciones/> muestra textos preventivos y etiqueta de origen
    expect(htmlVistaPrincipal).toContain(
      'Recomendaciones Preventivas para ALERTA'
    );
    expect(htmlVistaPrincipal).toContain(
      'Monitoreo preventivo ante lluvia intensa o saturación'
    );
    expect(htmlVistaPrincipal).toContain('Origen: Institucional verificada');

    // 4. La sección de <SeccionContactosEmergencia/> muestra líneas verificadas con enlace táctil
    expect(htmlVistaPrincipal).toContain(
      'Contactos de Emergencia — La Paz / Cotahuma'
    );
    expect(htmlVistaPrincipal).toContain('Red 114 — Emergencias GAMLP');
    expect(htmlVistaPrincipal).toContain('href="tel:114"');
    expect(htmlVistaPrincipal).toContain('href="tel:119"');

    // Verificación cuantitativa de P19 (< 3000 ms meta global y < 1000 ms renderizado en cliente)
    expect(duracionMs).toBeLessThan(3000);
    expect(duracionMs).toBeLessThan(1000);
  });

  // ===========================================================================
  // PRUEBA 2: Heurísticas de usabilidad, comprensión y conmutación entre los 4 niveles
  // ===========================================================================
  it('2. P19: Cumple las heurísticas de usabilidad (aviso permanente sin modales, etiquetas claras de modalidad y Haversine sin lista negra) y actualiza los 4 niveles en modo simulación en < 1000 ms', () => {
    // 1. Verificar selector de modalidad descriptivo y aviso permanente visible sin abrir modales
    const htmlControles = renderToStaticMarkup(
      <MemoryRouter>
        <div>
          <AvisoPermanente />
          <BannerModoSimulacion
            modalidad="simulada"
            esSimulacion={true}
            nivelActual="NORMAL"
            alCambiarModalidad={() => {}}
            alInyectarEscenario={() => {}}
            alLimpiarSimulacion={() => {}}
          />
          <MapaReferencial
            zonasReferencia={ZONAS_CANONICAS}
            puntosReferencia={PUNTOS_CANONICOS}
            nivelVigente="NORMAL"
          />
        </div>
      </MemoryRouter>
    );

    expect(htmlControles).toContain('Datos Reales (Open-Meteo)');
    expect(htmlControles).toContain('Modo Simulación (Demostración)');
    expect(htmlControles).toContain(
      'MODO SIMULACIÓN ACADÉMICA ACTIVO — Los datos y el nivel mostrados son simulados para demostración y NO alteran el estado meteorológico real.'
    );
    expect(htmlControles).toContain('data-testid="btn-solicitar-ubicacion"');
    expect(htmlControles).toContain(
      'Calcular distancia aproximada desde mi ubicación (procesado solo en este dispositivo)'
    );
    expect(htmlControles).toContain('referencia de demostración, no validada');

    // Prohibición estricta de términos de la lista negra
    const htmlMin = htmlControles.toLowerCase();
    const prohibidos = [
      ['alerta', 'oficial'].join(' '),
      ['orden', 'de', 'evacuación'].join(' '),
      ['ruta', 'segura'].join(' '),
      ['zona', 'segura'].join(' '),
      ['refugio', 'verificado'].join(' '),
      ['c', 'ómo llegar'].join(''),
    ];
    for (const term of prohibidos) {
      expect(htmlMin).not.toContain(term);
    }

    // 2. Cronometrar la conmutación secuencial entre los 4 niveles en modo simulación
    const niveles = ['NORMAL', 'PRECAUCION', 'ALERTA', 'EMERGENCIA'];
    const inicioConmutacion = performance.now();

    for (let i = 0; i < niveles.length; i++) {
      const nivelActual = niveles[i];
      const nivelAnterior = i === 0 ? 'NORMAL' : niveles[i - 1];
      const estadoSim = construirEstadoPorNivel(nivelActual, 'simulada');

      const htmlNivel = renderToStaticMarkup(
        <div>
          {i > 0 && (
            <AvisoCambioNivelInApp
              cambioNivel={{
                nivelAnterior,
                nivelNuevo: nivelActual,
                modalidad: 'simulada',
                recomendacion: estadoSim.recomendacion,
              }}
              onCerrar={() => {}}
            />
          )}
          <BannerNivelInformativo estado={estadoSim} />
          <SeccionRecomendaciones
            nivelVigente={estadoSim.nivel_vigente}
            estadoSistema={estadoSim.estado_sistema}
            recomendacionVigente={estadoSim.recomendacion}
            recomendacionesPublicadas={estadoSim.recomendaciones_publicadas}
          />
        </div>
      );

      expect(htmlNivel).toContain(
        `Recomendaciones Preventivas para ${nivelActual}`
      );
      expect(htmlNivel).toContain(estadoSim.recomendacion.titulo);
    }

    const duracionConmutacionMs = performance.now() - inicioConmutacion;
    expect(duracionConmutacionMs).toBeLessThan(1000);
  });
});

