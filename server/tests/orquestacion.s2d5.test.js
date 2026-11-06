import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll, vi } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { pool } from '../src/db/pool.js';
import { limpiarCacheLecturas, insertarLecturaMeteorologica } from '../src/services/lecturas.service.js';
import {
  evaluarLecturaConConfiguracionVigente,
  evaluarUltimaLectura,
} from '../src/services/evaluaciones.service.js';
import { crearVersionConfiguracion } from '../src/services/configuracion.service.js';
import { consultarOpenMeteo } from '../src/services/openMeteo.js';

// Mockear el cliente Open-Meteo para aislar completamente las pruebas HTTP sin llamadas a internet
vi.mock('../src/services/openMeteo.js', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    consultarOpenMeteo: vi.fn(),
  };
});

/**
 * Genera una respuesta simulada estructurada de Open-Meteo con serie horaria calculada.
 */
function crearRespuestaOpenMeteoMock({
  observadoEn = new Date().toISOString(),
  precipitacionActual = 8.0,
  acum24hDeseado = 30.0,
  acum72hDeseado = 65.0,
} = {}) {
  const tsAnchor = Math.floor(Date.parse(observadoEn) / 3_600_000) * 3_600_000;
  const tiemposUtc = [];
  const precipitacionMm = [];

  const val24 = acum24hDeseado / 24;
  const val72 = (acum72hDeseado - acum24hDeseado) / 48;

  for (let h = 79; h >= 0; h--) {
    const ts = tsAnchor - h * 3_600_000;
    tiemposUtc.push(new Date(ts).toISOString());
    if (h < 24) {
      precipitacionMm.push(val24);
    } else if (h < 72) {
      precipitacionMm.push(val72);
    } else {
      precipitacionMm.push(0);
    }
  }

  return {
    fuente: 'Open-Meteo',
    observado_en: observadoEn,
    intervalo_actual_segundos: 900,
    actual: {
      precipitacion_mm: precipitacionActual,
      temperatura_c: 12.0,
      humedad_pct: 70,
      viento_kmh: 8.0,
    },
    serie_horaria: {
      tiempos_utc: tiemposUtc,
      precipitacion_mm: precipitacionMm,
    },
  };
}

/**
 * Limpia quirúrgicamente registros de prueba y restaura la configuración V1 vigente.
 */
async function limpiarTodo() {
  limpiarCacheLecturas();
  await pool.query('DELETE FROM evaluaciones_nivel;');
  await pool.query('DELETE FROM lecturas_meteorologicas;');
  await pool.query(`
    DELETE FROM bitacora_cambios
    WHERE entidad = 'configuraciones_reglas'
      AND entidad_id IN (
        SELECT id FROM configuraciones_reglas WHERE version > 1
      );
  `);
  await pool.query(`
    DELETE FROM umbrales
    WHERE configuracion_id IN (
      SELECT id FROM configuraciones_reglas WHERE version > 1
    );
  `);
  await pool.query('DELETE FROM configuraciones_reglas WHERE version > 1;');
  await pool.query("UPDATE configuraciones_reglas SET estado = 'vigente' WHERE version = 1;");
}

describe('Semana 2 - Día 5 (Fase B): Pruebas de Integración de Orquestación y API (orquestacion.s2d5.test.js)', () => {
  beforeAll(async () => {
    await limpiarTodo();
  });

  beforeEach(async () => {
    await limpiarTodo();
    vi.clearAllMocks();
  });

  afterEach(async () => {
    await limpiarTodo();
  });

  afterAll(async () => {
    await limpiarTodo();
  });

  // ==========================================================================
  // ESCENARIO 1: Orquestación de lectura real -> evaluación en BD y GET /api/estado
  // ==========================================================================
  it('1. Orquestación de lectura real -> evaluación en BD y exposición completa en GET /api/estado', async () => {
    const fechaReciente = new Date(Date.now() - 5 * 60 * 1000).toISOString();

    consultarOpenMeteo.mockResolvedValueOnce(
      crearRespuestaOpenMeteoMock({
        observadoEn: fechaReciente,
        precipitacionActual: 8.0,
        acum24hDeseado: 30.0,
        acum72hDeseado: 65.0,
      })
    );

    const res = await request(app)
      .get('/api/estado')
      .expect('Content-Type', /json/)
      .expect(200);

    expect(res.body.ok).toBe(true);
    expect(res.body.modalidad).toBe('real');
    expect(res.body.nivel_calculado).toBe('ALERTA');
    expect(res.body.nivel_vigente).toBe('ALERTA');
    expect(res.body.estado_sistema).toBe('ALERTA');
    expect(res.body.contador_descenso).toBe(0);
    expect(res.body.regla_saturacion_aplicada).toBe(true);
    expect(res.body.version_reglas.version).toBe(1);
    expect(res.body.datos_desactualizados).toBe(false);

    // Recomendaciones del nivel vigente ALERTA
    expect(Array.isArray(res.body.recomendaciones_nivel_vigente)).toBe(true);
    expect(res.body.recomendaciones_nivel_vigente.length).toBeGreaterThanOrEqual(1);
    for (const rec of res.body.recomendaciones_nivel_vigente) {
      expect(rec.nivel).toBe('ALERTA');
      expect(['demostracion', 'institucional_verificada']).toContain(rec.origen);
    }

    // Comprobar persistencia exacta en evaluaciones_nivel vinculada a lectura_id y config v1
    const evalRes = await pool.query(
      `SELECT e.*, c.version AS config_version
       FROM evaluaciones_nivel e
       JOIN configuraciones_reglas c ON c.id = e.configuracion_id
       WHERE e.lectura_id = $1;`,
      [res.body.lectura.id]
    );

    expect(evalRes.rows.length).toBe(1);
    const evalFila = evalRes.rows[0];
    expect(evalFila.nivel_calculado).toBe('ALERTA');
    expect(evalFila.nivel_vigente).toBe('ALERTA');
    expect(evalFila.estado_sistema).toBe('ALERTA');
    expect(Number(evalFila.contador_descenso)).toBe(0);
    expect(Number(evalFila.config_version)).toBe(1);
  });

  // ==========================================================================
  // ESCENARIO 2: Idempotencia (no duplicar evaluación para la misma lectura — P04)
  // ==========================================================================
  it('2. Idempotencia en BD: no duplicar evaluación para la misma lectura dentro del caché (P04)', async () => {
    const fechaReciente = new Date(Date.now() - 5 * 60 * 1000).toISOString();

    consultarOpenMeteo.mockResolvedValue(
      crearRespuestaOpenMeteoMock({
        observadoEn: fechaReciente,
        precipitacionActual: 8.0,
        acum24hDeseado: 30.0,
        acum72hDeseado: 65.0,
      })
    );

    // Primera consulta HTTP
    const res1 = await request(app).get('/api/estado').expect(200);
    const lecturaId = res1.body.lectura.id;

    const conteo1 = await pool.query(
      'SELECT COUNT(*)::int AS total FROM evaluaciones_nivel WHERE lectura_id = $1;',
      [lecturaId]
    );
    expect(conteo1.rows[0].total).toBe(1);

    // Segunda consulta HTTP inmediatamente (misma lectura en caché)
    const res2 = await request(app).get('/api/estado').expect(200);
    expect(res2.body.lectura.id).toBe(lecturaId);

    // Tercera invocación directa del orquestador evaluarUltimaLectura
    await evaluarUltimaLectura({ modalidad: 'real' });

    const conteoFinal = await pool.query(
      'SELECT COUNT(*)::int AS total, MAX(contador_descenso) as max_descenso FROM evaluaciones_nivel WHERE lectura_id = $1;',
      [lecturaId]
    );
    expect(conteoFinal.rows[0].total).toBe(1);
    expect(Number(conteoFinal.rows[0].max_descenso)).toBe(0);
  });

  // ==========================================================================
  // ESCENARIO 3: Secuencia de histéresis reflejada en GET /api/historial
  // ==========================================================================
  it('3. Secuencia de histéresis en GET /api/historial (Ascenso inmediato y descenso en 2 muestras consecutivas)', async () => {
    // 10:00Z -> ALERTA
    const { lectura: l1 } = await insertarLecturaMeteorologica({
      modalidad: 'real',
      fuente: 'test-orquestacion',
      observado_en: '2026-05-10T10:00:00.000Z',
      intensidad_mm_h: 8.0, // >= 6.5 ALERTA
      acum_24h_mm: 30.0,
      acum_72h_mm: 20.0,
      horas_validas_24h: 24,
      horas_validas_72h: 72,
      estado: 'valida',
    });
    const eval1 = await evaluarLecturaConConfiguracionVigente(l1);
    expect(eval1.estado_motor.nivel_vigente).toBe('ALERTA');
    expect(eval1.estado_motor.contador_descenso).toBe(0);

    // 11:00Z -> PRECAUCION (Muestra 1 de descenso, separación 60 min >= 15 min)
    const { lectura: l2 } = await insertarLecturaMeteorologica({
      modalidad: 'real',
      fuente: 'test-orquestacion',
      observado_en: '2026-05-10T11:00:00.000Z',
      intensidad_mm_h: 3.0, // >= 2.5 y < 6.5 PRECAUCION
      acum_24h_mm: 12.0,
      acum_72h_mm: 20.0,
      horas_validas_24h: 24,
      horas_validas_72h: 72,
      estado: 'valida',
    });
    const eval2 = await evaluarLecturaConConfiguracionVigente(l2);
    expect(eval2.estado_motor.nivel_vigente).toBe('ALERTA'); // Mantiene ALERTA
    expect(eval2.estado_motor.contador_descenso).toBe(1);

    // 12:00Z -> NORMAL (Muestra 2 de descenso: desciende a max('PRECAUCION', 'NORMAL') = 'PRECAUCION')
    const { lectura: l3 } = await insertarLecturaMeteorologica({
      modalidad: 'real',
      fuente: 'test-orquestacion',
      observado_en: '2026-05-10T12:00:00.000Z',
      intensidad_mm_h: 0.5, // NORMAL
      acum_24h_mm: 2.0,
      acum_72h_mm: 5.0,
      horas_validas_24h: 24,
      horas_validas_72h: 72,
      estado: 'valida',
    });
    const eval3 = await evaluarLecturaConConfiguracionVigente(l3);
    expect(eval3.estado_motor.nivel_vigente).toBe('PRECAUCION');
    expect(eval3.estado_motor.contador_descenso).toBe(0);

    // Consultar historial
    const res = await request(app)
      .get('/api/historial?modalidad=real&limite=10')
      .expect(200);

    expect(res.body.modalidad).toBe('real');
    expect(res.body.total).toBe(3);
    expect(res.body.items).toHaveLength(3);

    // Ítem 0 (más reciente: 12:00Z)
    const item0 = res.body.items[0];
    expect(item0.observado_en).toBe('2026-05-10T12:00:00.000Z');
    expect(item0.nivel_calculado).toBe('NORMAL');
    expect(item0.nivel_vigente).toBe('PRECAUCION');
    expect(item0.contador_descenso).toBe(0);

    // Ítem 1 (11:00Z)
    const item1 = res.body.items[1];
    expect(item1.observado_en).toBe('2026-05-10T11:00:00.000Z');
    expect(item1.nivel_calculado).toBe('PRECAUCION');
    expect(item1.nivel_vigente).toBe('ALERTA');
    expect(item1.contador_descenso).toBe(1);

    // Ítem 2 (10:00Z)
    const item2 = res.body.items[2];
    expect(item2.observado_en).toBe('2026-05-10T10:00:00.000Z');
    expect(item2.nivel_calculado).toBe('ALERTA');
    expect(item2.nivel_vigente).toBe('ALERTA');
    expect(item2.contador_descenso).toBe(0);
  });

  // ==========================================================================
  // ESCENARIO 4: Inmutabilidad histórica ante cambio de versión de reglas (P05)
  // ==========================================================================
  it('4. Inmutabilidad histórica ante cambio de versión de reglas (P05 en GET /api/historial)', async () => {
    // 1. Evaluar las primeras 3 lecturas con la versión 1
    const { lectura: l1 } = await insertarLecturaMeteorologica({
      modalidad: 'real',
      fuente: 'test-p05',
      observado_en: '2026-05-10T10:00:00.000Z',
      intensidad_mm_h: 8.0,
      acum_24h_mm: 30.0,
      acum_72h_mm: 20.0,
      horas_validas_24h: 24,
      horas_validas_72h: 72,
      estado: 'valida',
    });
    await evaluarLecturaConConfiguracionVigente(l1);

    const { lectura: l2 } = await insertarLecturaMeteorologica({
      modalidad: 'real',
      fuente: 'test-p05',
      observado_en: '2026-05-10T11:00:00.000Z',
      intensidad_mm_h: 3.0,
      acum_24h_mm: 12.0,
      acum_72h_mm: 20.0,
      horas_validas_24h: 24,
      horas_validas_72h: 72,
      estado: 'valida',
    });
    await evaluarLecturaConConfiguracionVigente(l2);

    const { lectura: l3 } = await insertarLecturaMeteorologica({
      modalidad: 'real',
      fuente: 'test-p05',
      observado_en: '2026-05-10T12:00:00.000Z',
      intensidad_mm_h: 0.5,
      acum_24h_mm: 2.0,
      acum_72h_mm: 5.0,
      horas_validas_24h: 24,
      horas_validas_72h: 72,
      estado: 'valida',
    });
    await evaluarLecturaConConfiguracionVigente(l3);

    // 2. Crear y activar una nueva versión de reglas v2 con umbrales válidos
    const nuevaConfigV2 = await crearVersionConfiguracion({
      umbrales: [
        { variable: 'intensidad_mm_h', nivel: 'PRECAUCION', valor: 3.5 },
        { variable: 'intensidad_mm_h', nivel: 'ALERTA', valor: 7.5 },
        { variable: 'intensidad_mm_h', nivel: 'EMERGENCIA', valor: 13.0 },
        { variable: 'acum_24h_mm', nivel: 'PRECAUCION', valor: 11.0 },
        { variable: 'acum_24h_mm', nivel: 'ALERTA', valor: 26.0 },
        { variable: 'acum_24h_mm', nivel: 'EMERGENCIA', valor: 41.0 },
        { variable: 'acum_72h_mm', nivel: 'PRECAUCION', valor: 26.0 },
        { variable: 'acum_72h_mm', nivel: 'ALERTA', valor: 61.0 },
        { variable: 'acum_72h_mm', nivel: 'EMERGENCIA', valor: 91.0 },
      ],
      motivo: 'Activación de reglas académicas V2 en prueba de integración',
      estadoInicial: 'vigente',
    });
    expect(nuevaConfigV2.version).toBe(2);

    // 3. Evaluar una cuarta lectura con la versión 2 vigente
    const { lectura: l4 } = await insertarLecturaMeteorologica({
      modalidad: 'real',
      fuente: 'test-p05',
      observado_en: '2026-05-10T13:00:00.000Z',
      intensidad_mm_h: 0.5,
      acum_24h_mm: 2.0,
      acum_72h_mm: 5.0,
      horas_validas_24h: 24,
      horas_validas_72h: 72,
      estado: 'valida',
    });
    await evaluarLecturaConConfiguracionVigente(l4);

    // 4. Consultar historial completo
    const resHistorial = await request(app)
      .get('/api/historial?modalidad=real&limite=10')
      .expect(200);

    expect(resHistorial.body.total).toBe(4);
    expect(resHistorial.body.items).toHaveLength(4);

    // Evaluación en 13:00Z asociada a versión 2
    expect(resHistorial.body.items[0].observado_en).toBe('2026-05-10T13:00:00.000Z');
    expect(resHistorial.body.items[0].version_reglas).toBe(2);
    expect(resHistorial.body.items[0].configuracion_id).toBe(nuevaConfigV2.id);

    // Las 3 evaluaciones anteriores conservan inmutablemente version_reglas: 1 y sus estados
    expect(resHistorial.body.items[1].observado_en).toBe('2026-05-10T12:00:00.000Z');
    expect(resHistorial.body.items[1].version_reglas).toBe(1);
    expect(resHistorial.body.items[1].nivel_vigente).toBe('PRECAUCION');

    expect(resHistorial.body.items[2].observado_en).toBe('2026-05-10T11:00:00.000Z');
    expect(resHistorial.body.items[2].version_reglas).toBe(1);
    expect(resHistorial.body.items[2].nivel_vigente).toBe('ALERTA');

    expect(resHistorial.body.items[3].observado_en).toBe('2026-05-10T10:00:00.000Z');
    expect(resHistorial.body.items[3].version_reglas).toBe(1);
    expect(resHistorial.body.items[3].nivel_vigente).toBe('ALERTA');
  });

  // ==========================================================================
  // ESCENARIO 5: Separación de modalidad real y simulada (P11)
  // ==========================================================================
  it('5. Separación absoluta entre modalidad simulada y real (P11)', async () => {
    // 1. Inyectar primero un estado real en NORMAL
    const { lectura: lReal } = await insertarLecturaMeteorologica({
      modalidad: 'real',
      fuente: 'test-real-p11',
      observado_en: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
      intensidad_mm_h: 0.2,
      acum_24h_mm: 1.0,
      acum_72h_mm: 2.0,
      horas_validas_24h: 24,
      horas_validas_72h: 72,
      estado: 'valida',
    });
    await evaluarLecturaConConfiguracionVigente(lReal);

    // 2. Registrar una lectura simulada de EMERGENCIA
    const fechaSim = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    await request(app)
      .post('/api/simulacion/lectura')
      .send({
        observado_en: fechaSim,
        intensidad_mm_h: 15.0, // EMERGENCIA (>= 12.0)
        acum_24h_mm: 50.0,
        acum_72h_mm: 100.0,
        horas_validas_24h: 24,
        horas_validas_72h: 72,
      })
      .expect(201);

    // 3. GET /api/estado?modalidad=simulada refleja EMERGENCIA y banner de simulación
    const resSim = await request(app)
      .get('/api/estado?modalidad=simulada')
      .expect(200);

    expect(resSim.body.ok).toBe(true);
    expect(resSim.body.modalidad).toBe('simulada');
    expect(resSim.body.es_simulacion).toBe(true);
    expect(resSim.body.banner_simulacion).toBe('DATOS SIMULADOS DE DEMOSTRACIÓN ACADÉMICA');
    expect(resSim.body.nivel_vigente).toBe('EMERGENCIA');
    expect(resSim.body.estado_sistema).toBe('EMERGENCIA');

    // 4. GET /api/estado?modalidad=real permanece intacto en NORMAL
    const resReal = await request(app)
      .get('/api/estado?modalidad=real')
      .expect(200);

    expect(resReal.body.modalidad).toBe('real');
    expect(resReal.body.es_simulacion).toBe(false);
    expect(resReal.body.banner_simulacion).toBeNull();
    expect(resReal.body.nivel_vigente).toBe('NORMAL');

    // 5. GET /api/historial?modalidad=simulada contiene exclusivamente la evaluación simulada
    const resHistSim = await request(app)
      .get('/api/historial?modalidad=simulada')
      .expect(200);

    expect(resHistSim.body.modalidad).toBe('simulada');
    expect(resHistSim.body.items.length).toBe(1);
    expect(resHistSim.body.items[0].modalidad).toBe('simulada');
    expect(resHistSim.body.items[0].nivel_vigente).toBe('EMERGENCIA');

    // 6. Validación de modalidad inválida en ambos endpoints
    const resBadEstado = await request(app)
      .get('/api/estado?modalidad=invalida')
      .expect(400);
    expect(resBadEstado.body).toHaveProperty('error');

    const resBadHist = await request(app)
      .get('/api/historial?modalidad=invalida')
      .expect(400);
    expect(resBadHist.body).toHaveProperty('error');
  });
});
