/**
 * @file ensayoDefensa.s4d7.test.js
 * @description Suite automatizada del Ensayo Completo de la Demostración en Vivo (S4D7):
 * - Acto 1: Consulta Real Pública (GET /api/estado).
 * - Acto 2: Modo Simulación con los Cuatro Niveles (NORMAL, PRECAUCION, ALERTA, EMERGENCIA — P11).
 * - Acto 3: Respaldo Integral para Modo Avión en Android (P08).
 * - Acto 4: Panel de Administración, RBAC, Validación P16, Versionado P05 y Bitácora.
 * - Acto 5: Restauración de Estado Limpio (configuración v1 vigente) para la Defensa Final.
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import request from 'supertest';
import { app } from '../../src/app.js';
import { pool } from '../../src/db/pool.js';
import { asegurarUsuarioAdministrador } from '../../src/db/seedAdmin.js';
import { limpiarCacheLecturas } from '../../src/services/lecturas.service.js';
import { limpiarRateLimiterLogin } from '../../src/middleware/rateLimit.middleware.js';
import { consultarOpenMeteo } from '../../src/services/openMeteo.js';

vi.mock('../../src/services/openMeteo.js', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    consultarOpenMeteo: vi.fn(),
  };
});

/**
 * Construye un payload determinista de Open-Meteo para el ensayo.
 *
 * @param {string} observadoEnIso
 * @param {number} precipActual
 * @param {number} precipHoraria
 */
function construirPayloadMeteoEnsayo(
  observadoEnIso,
  precipActual = 0.6,
  precipHoraria = 0.1
) {
  const baseMs = Date.parse(observadoEnIso);
  return {
    fuente: 'Open-Meteo',
    observado_en: observadoEnIso,
    intervalo_actual_segundos: 900,
    actual: {
      precipitacion_mm: precipActual,
      temperatura_c: 14.0,
      humedad_pct: 66,
      viento_kmh: 9.2,
    },
    serie_horaria: {
      tiempos_utc: Array.from({ length: 80 }, (_, idx) =>
        new Date(baseMs - (79 - idx) * 3600000).toISOString()
      ),
      precipitacion_mm: Array.from({ length: 80 }, () => precipHoraria),
    },
  };
}

/**
 * Limpia cualquier rastro de versiones de prueba (> 1) y simulaciones residuales,
 * dejando la versión 1 vigente e intacta.
 */
async function restaurarEstadoLimpioDefensa() {
  limpiarCacheLecturas();
  limpiarRateLimiterLogin();

  await pool.query(`
    DELETE FROM evaluaciones_nivel
    WHERE lectura_id IN (
      SELECT id FROM lecturas_meteorologicas WHERE modalidad = 'simulada'
    );
  `);
  await pool.query(
    "DELETE FROM lecturas_meteorologicas WHERE modalidad = 'simulada';"
  );

  await pool.query(`
    DELETE FROM evaluaciones_nivel
    WHERE configuracion_id IN (
      SELECT id FROM configuraciones_reglas WHERE version > 1
    );
  `);

  await pool.query(`
    DELETE FROM bitacora_cambios
    WHERE valor_nuevo::text LIKE '%[S4D7-ENSAYO]%'
       OR valor_anterior::text LIKE '%[S4D7-ENSAYO]%'
       OR (entidad = 'configuraciones_reglas' AND entidad_id IN (SELECT id FROM configuraciones_reglas WHERE version > 1));
  `);

  await pool.query(`
    DELETE FROM umbrales
    WHERE configuracion_id IN (
      SELECT id FROM configuraciones_reglas WHERE version > 1
    );
  `);
  await pool.query('DELETE FROM configuraciones_reglas WHERE version > 1;');

  await pool.query(`
    UPDATE configuraciones_reglas
    SET estado = 'vigente', activada_en = COALESCE(activada_en, NOW())
    WHERE version = 1;
  `);
}

describe('S4D7 — Ensayo Integral de la Demostración en Vivo (5 Actos)', () => {
  let tokenAdmin = '';
  let estadoRealInicial = null;

  beforeAll(async () => {
    await asegurarUsuarioAdministrador({
      email: 'admin@pukara.bo',
      password: 'PukaraAdmin2026!',
      client: pool,
    });
    await restaurarEstadoLimpioDefensa();

    const ahoraIso = new Date().toISOString();
    consultarOpenMeteo.mockResolvedValue(
      construirPayloadMeteoEnsayo(ahoraIso, 0.4, 0.1)
    );
  });

  afterAll(async () => {
    await restaurarEstadoLimpioDefensa();
  });

  it('Acto 1 (Consulta Real Pública): verifica GET /api/estado en modalidad real con nivel vigente, antigüedad, 4 recomendaciones con origen, contactos y capas no validadas', async () => {
    const res = await request(app).get('/api/estado');

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.modalidad).toBe('real');
    expect(res.body.es_simulacion).toBe(false);
    expect(['NORMAL', 'PRECAUCION', 'ALERTA', 'EMERGENCIA']).toContain(
      res.body.nivel_vigente
    );
    expect(typeof res.body.antiguedad_minutos).toBe('number');
    expect(res.body.aviso_permanente).toContain(
      'niveles informativos de lluvia'
    );

    // 4 recomendaciones preventivas generales con etiqueta de origen
    expect(Array.isArray(res.body.recomendaciones)).toBe(true);
    expect(res.body.recomendaciones.length).toBeGreaterThanOrEqual(4);
    for (const rec of res.body.recomendaciones) {
      expect(rec.origen).toBeTruthy();
      expect(rec.estado_publicacion).toBe('publicado');
    }

    // Contactos de emergencia y capas de referencia con leyenda obligatoria
    expect(Array.isArray(res.body.contactos_emergencia)).toBe(true);
    expect(res.body.contactos_emergencia.length).toBeGreaterThanOrEqual(4);
    expect(res.body.capas_referencia.leyenda_obligatoria).toBe(
      'referencia de demostración, no validada'
    );
    expect(res.body.zonas_referencia.length).toBeGreaterThanOrEqual(2);
    expect(res.body.puntos_referencia.length).toBeGreaterThanOrEqual(6);

    estadoRealInicial = res.body;
  });

  it('Acto 2 (Modo Simulación con los Cuatro Niveles — P11): recorre NORMAL, PRECAUCION, ALERTA y EMERGENCIA sin alterar el estado real y limpia al finalizar', async () => {
    // Login administrativo para inyectar escenarios del ensayo
    const resLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@pukara.bo', password: 'PukaraAdmin2026!' });
    expect(resLogin.status).toBe(200);
    tokenAdmin = resLogin.body.token;

    const escenariosDefensa = [
      {
        nivelEsperado: 'NORMAL',
        payload: {
          intensidad_mm_h: 0.8,
          acum_24h_mm: 3.0,
          acum_72h_mm: 8.0,
          observado_en: '2026-11-13T10:00:00.000Z',
        },
      },
      {
        nivelEsperado: 'PRECAUCION',
        payload: {
          intensidad_mm_h: 3.2,
          acum_24h_mm: 12.0,
          acum_72h_mm: 28.0,
          observado_en: '2026-11-13T10:20:00.000Z',
        },
      },
      {
        nivelEsperado: 'ALERTA',
        payload: {
          intensidad_mm_h: 2.6,
          acum_24h_mm: 14.0,
          acum_72h_mm: 62.0, // Activa regla compuesta de saturación (72h >= 60 + 1h >= 2.5)
          observado_en: '2026-11-13T10:40:00.000Z',
        },
      },
      {
        nivelEsperado: 'EMERGENCIA',
        payload: {
          intensidad_mm_h: 14.0,
          acum_24h_mm: 46.0,
          acum_72h_mm: 96.0,
          observado_en: '2026-11-13T11:00:00.000Z',
        },
      },
    ];

    for (const escenario of escenariosDefensa) {
      const resInyeccion = await request(app)
        .post('/api/admin/simulacion/lectura')
        .set('Authorization', `Bearer ${tokenAdmin}`)
        .send(escenario.payload);
      expect(resInyeccion.status).toBe(201);

      const resSim = await request(app)
        .get('/api/estado')
        .query({ modalidad: 'simulada' });
      expect(resSim.status).toBe(200);
      expect(resSim.body.modalidad).toBe('simulada');
      expect(resSim.body.es_simulacion).toBe(true);
      expect(resSim.body.nivel_vigente).toBe(escenario.nivelEsperado);

      // Comprobar que el estado real jamás fue alterado por la simulación
      const resRealParalelo = await request(app)
        .get('/api/estado')
        .query({ modalidad: 'real' });
      expect(resRealParalelo.status).toBe(200);
      expect(resRealParalelo.body.modalidad).toBe('real');
      expect(resRealParalelo.body.nivel_vigente).toBe(
        estadoRealInicial.nivel_vigente
      );
      expect(resRealParalelo.body.contador_descenso).toBe(
        estadoRealInicial.contador_descenso
      );
    }

    // Limpiar simulación al concluir el Acto 2
    const resLimpiar = await request(app)
      .delete('/api/admin/simulacion')
      .set('Authorization', `Bearer ${tokenAdmin}`);
    expect(resLimpiar.status).toBe(200);
  });

  it('Acto 3 (Respaldo para Modo Avión en Android — P08): verifica que GET /api/estado entrega todas las propiedades necesarias para offlineStorage', async () => {
    const res = await request(app).get('/api/estado');
    expect(res.status).toBe(200);

    const cuerpo = res.body;
    expect(cuerpo.lectura?.observado_en || cuerpo.consultado_en).toBeTruthy();
    expect(cuerpo.nivel_vigente).toBeTruthy();
    expect(Array.isArray(cuerpo.recomendaciones)).toBe(true);
    expect(cuerpo.recomendaciones.length).toBeGreaterThanOrEqual(4);
    expect(Array.isArray(cuerpo.contactos_emergencia)).toBe(true);
    expect(cuerpo.contactos_emergencia.length).toBeGreaterThanOrEqual(4);
    expect(Array.isArray(cuerpo.puntos_referencia)).toBe(true);
    expect(cuerpo.puntos_referencia.length).toBeGreaterThanOrEqual(6);
    expect(Array.isArray(cuerpo.zonas_referencia)).toBe(true);
    expect(cuerpo.zonas_referencia.length).toBeGreaterThanOrEqual(2);
  });

  it('Acto 4 (Panel de Administración y Bitácora — P05, P07, P16): verifica bloqueo 401, login, rechazo 400 incoherente, activación de nueva versión, edición y bitácora', async () => {
    // 1. Bloqueo 401 sin token (P07)
    const resSinToken = await request(app).get('/api/admin/configuraciones');
    expect(resSinToken.status).toBe(401);

    // 2. Login exitoso con admin@pukara.bo / PukaraAdmin2026!
    limpiarRateLimiterLogin();
    const resLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@pukara.bo', password: 'PukaraAdmin2026!' });
    expect(resLogin.status).toBe(200);
    expect(resLogin.body.token).toBeTruthy();
    tokenAdmin = resLogin.body.token;

    // 3. Rechazo 400 de configuración incoherente (P16: PRECAUCION >= ALERTA)
    const resIncoherente = await request(app)
      .post('/api/admin/configuraciones')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({
        motivo: '[S4D7-ENSAYO] Intento incoherente P16',
        umbrales: [
          { variable: 'intensidad_mm_h', nivel: 'PRECAUCION', valor: 8.0 },
          { variable: 'intensidad_mm_h', nivel: 'ALERTA', valor: 6.5 },
          { variable: 'intensidad_mm_h', nivel: 'EMERGENCIA', valor: 12.0 },
          { variable: 'acum_24h_mm', nivel: 'PRECAUCION', valor: 10.0 },
          { variable: 'acum_24h_mm', nivel: 'ALERTA', valor: 25.0 },
          { variable: 'acum_24h_mm', nivel: 'EMERGENCIA', valor: 40.0 },
          { variable: 'acum_72h_mm', nivel: 'PRECAUCION', valor: 25.0 },
          { variable: 'acum_72h_mm', nivel: 'ALERTA', valor: 60.0 },
          { variable: 'acum_72h_mm', nivel: 'EMERGENCIA', valor: 90.0 },
        ],
      });
    expect(resIncoherente.status).toBe(400);

    // 4. Creación y activación de versión nueva válida (P05)
    const resNuevaVersion = await request(app)
      .post('/api/admin/configuraciones')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({
        activar: true,
        motivo: '[S4D7-ENSAYO] Nueva versión de demostración P05',
        umbrales: [
          { variable: 'intensidad_mm_h', nivel: 'PRECAUCION', valor: 3.0 },
          { variable: 'intensidad_mm_h', nivel: 'ALERTA', valor: 7.0 },
          { variable: 'intensidad_mm_h', nivel: 'EMERGENCIA', valor: 13.0 },
          { variable: 'acum_24h_mm', nivel: 'PRECAUCION', valor: 11.0 },
          { variable: 'acum_24h_mm', nivel: 'ALERTA', valor: 26.0 },
          { variable: 'acum_24h_mm', nivel: 'EMERGENCIA', valor: 42.0 },
          { variable: 'acum_72h_mm', nivel: 'PRECAUCION', valor: 28.0 },
          { variable: 'acum_72h_mm', nivel: 'ALERTA', valor: 62.0 },
          { variable: 'acum_72h_mm', nivel: 'EMERGENCIA', valor: 92.0 },
        ],
      });
    expect(resNuevaVersion.status).toBe(201);
    expect(resNuevaVersion.body.configuracion.estado).toBe('vigente');
    expect(resNuevaVersion.body.configuracion.version).toBeGreaterThan(1);

    // 5. Edición de atributo de un contacto y restauración inmediata
    const resContactos = await request(app)
      .get('/api/admin/contactos')
      .set('Authorization', `Bearer ${tokenAdmin}`);
    expect(resContactos.status).toBe(200);
    const primerContacto = resContactos.body.contactos[0];

    const resUpdateContacto = await request(app)
      .put(`/api/admin/contactos/${primerContacto.id}`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({
        nombre: primerContacto.nombre,
        telefono: primerContacto.telefono,
        fuente: `${primerContacto.fuente} [S4D7-ENSAYO]`,
        activo: primerContacto.activo,
      });
    expect(resUpdateContacto.status).toBe(200);

    // Restaurar atributo original del contacto
    await request(app)
      .put(`/api/admin/contactos/${primerContacto.id}`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({
        nombre: primerContacto.nombre,
        telefono: primerContacto.telefono,
        fuente: primerContacto.fuente,
        activo: primerContacto.activo,
      });

    // 6. Verificar registro auditable en GET /api/admin/bitacora
    const resBitacora = await request(app)
      .get('/api/admin/bitacora')
      .set('Authorization', `Bearer ${tokenAdmin}`);
    expect(resBitacora.status).toBe(200);
    expect(Array.isArray(resBitacora.body.registros)).toBe(true);
    expect(resBitacora.body.registros.length).toBeGreaterThan(0);

    const filaReciente = resBitacora.body.registros[0];
    expect(filaReciente.usuario_id).toBeDefined();
    expect(filaReciente).toHaveProperty('valor_anterior');
    expect(filaReciente).toHaveProperty('valor_nuevo');
  });

  it('Acto 5 (Restauración de Estado Limpio para Defensa): restaura la configuración version = 1 como vigente y verifica integridad final', async () => {
    await restaurarEstadoLimpioDefensa();

    const resEstadoFinal = await request(app).get('/api/estado');
    expect(resEstadoFinal.status).toBe(200);
    expect(resEstadoFinal.body.version_reglas.version).toBe(1);
    expect(resEstadoFinal.body.version_reglas.estado).toBe('vigente');
    expect(resEstadoFinal.body.modalidad).toBe('real');
  });
});
