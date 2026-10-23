import { describe, it, expect } from 'vitest';
import {
  calcularAcumuladosYCalidad,
  truncarAHoraUtc,
} from '../src/engine/acumulados.js';

/**
 * Generador auxiliar de fixtures para series horarias de Open-Meteo.
 *
 * @param {Object} opciones
 * @param {string} [opciones.observadoEn] Timestamp de referencia (por defecto 2026-10-23T18:45:00.000Z)
 * @param {number} [opciones.horasHaciaAtras] Cantidad de horas retrospectivas (por defecto 80)
 * @param {number} [opciones.horasFuturas] Cantidad de horas futuras proyectadas (por defecto 12)
 * @param {number|null} [opciones.precipitacionActual] Precipitación actual instantánea
 * @param {Function} [opciones.valorHoraFn] Función que retorna el valor de lluvia para cada hora atrás (h >= 0) o futura (h < 0)
 * @returns {Object} Objeto con la estructura esperada por calcularAcumuladosYCalidad
 */
function crearFixtureSerie({
  observadoEn = '2026-10-23T18:45:00.000Z',
  horasHaciaAtras = 80,
  horasFuturas = 12,
  precipitacionActual = 1.5,
  valorHoraFn = (horasAtras) => (horasAtras < 0 ? 99.0 : 1.0),
} = {}) {
  const tsAnchor = truncarAHoraUtc(observadoEn);
  const tiemposUtc = [];
  const precipitacionMm = [];

  // Desde la hora más antigua en el pasado (horasHaciaAtras - 1) hasta el futuro (-horasFuturas)
  for (let h = horasHaciaAtras - 1; h >= -horasFuturas; h--) {
    const ts = tsAnchor - h * 3_600_000;
    tiemposUtc.push(new Date(ts).toISOString());
    precipitacionMm.push(valorHoraFn(h, ts));
  }

  return {
    observado_en: observadoEn,
    actual: {
      precipitacion_mm: precipitacionActual,
    },
    serie_horaria: {
      tiempos_utc: tiemposUtc,
      precipitacion_mm: precipitacionMm,
    },
  };
}

describe('Motor de Evaluación: Cálculo de Acumulados y Calidad (acumulados.js)', () => {
  it('1. Muestra "valida" con observado_en en cuarto de hora (18:45Z) e ignorando horas futuras', () => {
    // 80 horas pasadas con 1.0 mm y 12 horas futuras con 99.0 mm
    const fixture = crearFixtureSerie({
      observadoEn: '2026-10-23T18:45:00.000Z',
      horasHaciaAtras: 80,
      horasFuturas: 12,
      precipitacionActual: 1.5,
      valorHoraFn: (h) => (h < 0 ? 99.0 : 1.0),
    });

    const resultado = calcularAcumuladosYCalidad(fixture);

    expect(resultado.intensidad_mm_h).toBe(1.5);
    expect(resultado.acum_24h_mm).toBe(24);
    expect(resultado.acum_72h_mm).toBe(72);
    expect(resultado.horas_validas_24h).toBe(24);
    expect(resultado.horas_validas_72h).toBe(72);
    expect(resultado.estado).toBe('valida');
    expect(resultado.banderas_calidad).toEqual({
      intensidad_completa: true,
      acum_24h_completo: true,
      acum_72h_completo: true,
      clasificacion_parcial: false,
    });
  });

  it('2. Exactitud decimal sin errores de punto flotante IEEE-754', () => {
    // Alternar 0.1 y 0.2 mm en las 72 horas para desafiar la precisión de punto flotante
    const fixture = crearFixtureSerie({
      observadoEn: '2026-10-23T18:00:00.000Z',
      horasHaciaAtras: 75,
      horasFuturas: 0,
      precipitacionActual: 0.3,
      valorHoraFn: (h) => (h % 2 === 0 ? 0.1 : 0.2),
    });

    const resultado = calcularAcumuladosYCalidad(fixture);

    // 24 horas: 12 * 0.1 + 12 * 0.2 = 3.6
    expect(resultado.acum_24h_mm).toBe(3.6);
    // 72 horas: 36 * 0.1 + 36 * 0.2 = 10.8
    expect(resultado.acum_72h_mm).toBe(10.8);
    expect(resultado.intensidad_mm_h).toBe(0.3);
    expect(resultado.estado).toBe('valida');
  });

  it('3. P02 — Valor null reciente dentro de la ventana de 24h (hace 4 horas)', () => {
    const fixture = crearFixtureSerie({
      observadoEn: '2026-10-23T18:45:00.000Z',
      horasHaciaAtras: 80,
      horasFuturas: 6,
      precipitacionActual: 1.5,
      valorHoraFn: (h) => (h === 4 ? null : 1.0),
    });

    const resultado = calcularAcumuladosYCalidad(fixture);

    expect(resultado.horas_validas_24h).toBe(23);
    expect(resultado.acum_24h_mm).toBeNull();
    expect(resultado.horas_validas_72h).toBe(71);
    expect(resultado.acum_72h_mm).toBeNull();
    expect(resultado.intensidad_mm_h).toBe(1.5);
    expect(resultado.estado).toBe('incompleta');
    expect(resultado.banderas_calidad).toEqual({
      intensidad_completa: true,
      acum_24h_completo: false,
      acum_72h_completo: false,
      clasificacion_parcial: true,
    });
  });

  it('4. P02 — Valor null antiguo entre la hora 25 y la 72 (hace 48 horas)', () => {
    const fixture = crearFixtureSerie({
      observadoEn: '2026-10-23T18:45:00.000Z',
      horasHaciaAtras: 80,
      horasFuturas: 6,
      precipitacionActual: 2.0,
      valorHoraFn: (h) => (h === 48 ? null : 1.0),
    });

    const resultado = calcularAcumuladosYCalidad(fixture);

    // La ventana de 24 horas está 100% intacta
    expect(resultado.horas_validas_24h).toBe(24);
    expect(resultado.acum_24h_mm).toBe(24);
    expect(resultado.banderas_calidad.acum_24h_completo).toBe(true);

    // La ventana de 72 horas queda incompleta y se excluye (null)
    expect(resultado.horas_validas_72h).toBe(71);
    expect(resultado.acum_72h_mm).toBeNull();
    expect(resultado.banderas_calidad.acum_72h_completo).toBe(false);

    expect(resultado.intensidad_mm_h).toBe(2.0);
    expect(resultado.estado).toBe('incompleta');
    expect(resultado.banderas_calidad.clasificacion_parcial).toBe(true);
  });

  it('5. P02 — Hueco temporal real (marca horaria ausente en tiempos_utc sin null explícito)', () => {
    const fixture = crearFixtureSerie({
      observadoEn: '2026-10-23T18:45:00.000Z',
      horasHaciaAtras: 80,
      horasFuturas: 6,
      precipitacionActual: 1.5,
      valorHoraFn: () => 1.0,
    });

    // Remover con splice la marca de hace 10 horas tanto en tiempos_utc como en precipitacion_mm
    const tsAnchor = truncarAHoraUtc(fixture.observado_en);
    const tsHace10Horas = new Date(tsAnchor - 10 * 3_600_000).toISOString();
    const indiceHueco = fixture.serie_horaria.tiempos_utc.indexOf(tsHace10Horas);

    expect(indiceHueco).toBeGreaterThanOrEqual(0);
    fixture.serie_horaria.tiempos_utc.splice(indiceHueco, 1);
    fixture.serie_horaria.precipitacion_mm.splice(indiceHueco, 1);

    // Ambos arreglos mantienen igual longitud, pero existe un salto temporal
    expect(fixture.serie_horaria.tiempos_utc.length).toBe(
      fixture.serie_horaria.precipitacion_mm.length
    );

    const resultado = calcularAcumuladosYCalidad(fixture);

    expect(resultado.horas_validas_24h).toBe(23);
    expect(resultado.acum_24h_mm).toBeNull();
    expect(resultado.horas_validas_72h).toBe(71);
    expect(resultado.acum_72h_mm).toBeNull();
    expect(resultado.estado).toBe('incompleta');
    expect(resultado.banderas_calidad.acum_24h_completo).toBe(false);
    expect(resultado.banderas_calidad.acum_72h_completo).toBe(false);
    expect(resultado.banderas_calidad.clasificacion_parcial).toBe(true);
  });

  it('6. P02 — Intensidad actual null con acumulados de 24h y 72h completos', () => {
    const fixture = crearFixtureSerie({
      observadoEn: '2026-10-23T18:45:00.000Z',
      horasHaciaAtras: 75,
      horasFuturas: 4,
      precipitacionActual: null,
      valorHoraFn: () => 1.0,
    });

    const resultado = calcularAcumuladosYCalidad(fixture);

    expect(resultado.intensidad_mm_h).toBeNull();
    expect(resultado.acum_24h_mm).toBe(24);
    expect(resultado.acum_72h_mm).toBe(72);
    expect(resultado.horas_validas_24h).toBe(24);
    expect(resultado.horas_validas_72h).toBe(72);
    expect(resultado.estado).toBe('incompleta');
    expect(resultado.banderas_calidad).toEqual({
      intensidad_completa: false,
      acum_24h_completo: true,
      acum_72h_completo: true,
      clasificacion_parcial: true,
    });
  });

  it('7. P02 — Muestra "invalida" cuando NINGUNA variable está completa', () => {
    // Intensidad actual nula y serie con solo 12 horas disponibles
    const fixture = crearFixtureSerie({
      observadoEn: '2026-10-23T18:45:00.000Z',
      horasHaciaAtras: 12,
      horasFuturas: 0,
      precipitacionActual: null,
      valorHoraFn: () => 1.0,
    });

    const resultado = calcularAcumuladosYCalidad(fixture);

    expect(resultado.intensidad_mm_h).toBeNull();
    expect(resultado.acum_24h_mm).toBeNull();
    expect(resultado.acum_72h_mm).toBeNull();
    expect(resultado.horas_validas_24h).toBe(12);
    expect(resultado.horas_validas_72h).toBe(12);
    expect(resultado.estado).toBe('invalida');
    expect(resultado.banderas_calidad).toEqual({
      intensidad_completa: false,
      acum_24h_completo: false,
      acum_72h_completo: false,
      clasificacion_parcial: false,
    });
  });

  it('8. Diferenciación estricta entre lluvia cero (0 mm) y dato faltante (null)', () => {
    const fixture = crearFixtureSerie({
      observadoEn: '2026-10-23T18:45:00.000Z',
      horasHaciaAtras: 80,
      horasFuturas: 2,
      precipitacionActual: 0,
      valorHoraFn: () => 0,
    });

    const resultado = calcularAcumuladosYCalidad(fixture);

    expect(resultado.intensidad_mm_h).toBe(0);
    expect(resultado.acum_24h_mm).toBe(0);
    expect(resultado.acum_72h_mm).toBe(0);
    expect(resultado.horas_validas_24h).toBe(24);
    expect(resultado.horas_validas_72h).toBe(72);
    expect(resultado.estado).toBe('valida');
    expect(resultado.banderas_calidad.clasificacion_parcial).toBe(false);
  });

  it('9. Rechazo de datos corruptos negativos (-1.2), NaN o observado_en inválido', () => {
    // 9.1 Valor negativo en serie horaria (-1.2) se descarta como inválido
    const fixtureNegativo = crearFixtureSerie({
      observadoEn: '2026-10-23T18:45:00.000Z',
      horasHaciaAtras: 80,
      horasFuturas: 2,
      precipitacionActual: 1.0,
      valorHoraFn: (h) => (h === 5 ? -1.2 : 1.0),
    });

    const resNegativo = calcularAcumuladosYCalidad(fixtureNegativo);
    expect(resNegativo.horas_validas_24h).toBe(23);
    expect(resNegativo.acum_24h_mm).toBeNull();
    expect(resNegativo.horas_validas_72h).toBe(71);
    expect(resNegativo.acum_72h_mm).toBeNull();

    // 9.2 observado_en inválido retorna estado "invalida" sin lanzar excepciones
    const resInvalido = calcularAcumuladosYCalidad({
      observado_en: 'fecha-rota',
      actual: { precipitacion_mm: 2.0 },
    });

    expect(resInvalido.estado).toBe('invalida');
    expect(resInvalido.intensidad_mm_h).toBeNull();
    expect(resInvalido.acum_24h_mm).toBeNull();
    expect(resInvalido.acum_72h_mm).toBeNull();
    expect(resInvalido.horas_validas_24h).toBe(0);
    expect(resInvalido.horas_validas_72h).toBe(0);

    // 9.3 Entrada nula o no-objeto
    expect(calcularAcumuladosYCalidad(null).estado).toBe('invalida');
    expect(calcularAcumuladosYCalidad(undefined).estado).toBe('invalida');
  });

  it('10. Arreglos horarios desalineados (tiempos_utc.length !== precipitacion_mm.length)', () => {
    const fixture = crearFixtureSerie({
      observadoEn: '2026-10-23T18:45:00.000Z',
      horasHaciaAtras: 80,
      horasFuturas: 2,
      precipitacionActual: 3.0,
      valorHoraFn: () => 1.0,
    });

    // Descuadrar los arreglos agregando un elemento extra a tiempos_utc
    fixture.serie_horaria.tiempos_utc.push('2026-10-24T00:00:00.000Z');
    expect(fixture.serie_horaria.tiempos_utc.length).not.toBe(
      fixture.serie_horaria.precipitacion_mm.length
    );

    const resultado = calcularAcumuladosYCalidad(fixture);

    expect(resultado.intensidad_mm_h).toBe(3);
    expect(resultado.horas_validas_24h).toBe(0);
    expect(resultado.acum_24h_mm).toBeNull();
    expect(resultado.horas_validas_72h).toBe(0);
    expect(resultado.acum_72h_mm).toBeNull();
    expect(resultado.estado).toBe('incompleta');
    expect(resultado.banderas_calidad.intensidad_completa).toBe(true);
    expect(resultado.banderas_calidad.acum_24h_completo).toBe(false);
    expect(resultado.banderas_calidad.acum_72h_completo).toBe(false);
    expect(resultado.banderas_calidad.clasificacion_parcial).toBe(true);
  });
});
