import { describe, it, expect, beforeAll, beforeEach, afterEach, afterAll, vi } from 'vitest';
import request from 'supertest';
import { app } from '../../src/app.js';
import { pool } from '../../src/db/pool.js';
import { limpiarCacheLecturas } from '../../src/services/lecturas.service.js';
import { rateLimiterLogin } from '../../src/middleware/rateLimit.middleware.js';
import { generarTokenAcceso } from '../../src/services/auth.service.js';
import { consultarOpenMeteo } from '../../src/services/openMeteo.js';
import { asegurarUsuarioAdministrador } from '../../src/db/seedAdmin.js';

// Mock determinista de Open-Meteo para pruebas de integración HTTP (permite controlar P03 y P04)
vi.mock('../../src/services/openMeteo.js', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    consultarOpenMeteo: vi.fn(),
  };
});

/**
 * Construye un payload válido de Open-Meteo con timestamp configurable.
 *
 * @param {string} [observadoEnIso='2026-03-10T14:00:00.000Z']
 * @param {number} [precipActual=1.2]
 * @param {number} [precipHoraria=0.2]
 */
function construirPayloadOpenMeteoMock(
  observadoEnIso = '2026-03-10T14:00:00.000Z',
  precipActual = 1.2,
  precipHoraria = 0.2
) {
  const baseMs = Date.parse(observadoEnIso);
  return {
    fuente: 'Open-Meteo',
    observado_en: observadoEnIso,
    intervalo_actual_segundos: 900,
    actual: {
      precipitacion_mm: precipActual,
      temperatura_c: 13.5,
      humedad_pct: 72,
      viento_kmh: 9.4,
    },
    serie_horaria: {
      tiempos_utc: Array.from({ length: 80 }, (_, idx) =>
        new Date(baseMs - (79 - idx) * 3600000).toISOString()
      ),
      precipitacion_mm: Array.from({ length: 80 }, () => precipHoraria),
    },
  };
}

const UMBRALES_V2_VALIDOS = [
  { variable: 'intensidad_mm_h', nivel: 'PRECAUCION', valor: 3.0 },
  { variable: 'intensidad_mm_h', nivel: 'ALERTA', valor: 7.0 },
  { variable: 'intensidad_mm_h', nivel: 'EMERGENCIA', valor: 13.0 },
  { variable: 'acum_24h_mm', nivel: 'PRECAUCION', valor: 12.0 },
  { variable: 'acum_24h_mm', nivel: 'ALERTA', valor: 28.0 },
  { variable: 'acum_24h_mm', nivel: 'EMERGENCIA', valor: 45.0 },
  { variable: 'acum_72h_mm', nivel: 'PRECAUCION', valor: 30.0 },
  { variable: 'acum_72h_mm', nivel: 'ALERTA', valor: 65.0 },
  { variable: 'acum_72h_mm', nivel: 'EMERGENCIA', valor: 95.0 },
];

/**
 * Restaura la base de datos a su estado semilla canónico (v1 vigente, sin simulaciones ni residuos).
 */
async function restaurarEstadoBaseDatos() {
  limpiarCacheLecturas();
  if (rateLimiterLogin && typeof rateLimiterLogin.limpiarTodo === 'function') {
    rateLimiterLogin.limpiarTodo();
  }

  await pool.query(`
    DELETE FROM evaluaciones_nivel
    WHERE lectura_id IN (
      SELECT id FROM lecturas_meteorologicas WHERE modalidad = 'simulada'
    );
  `);
  await pool.query("DELETE FROM lecturas_meteorologicas WHERE modalidad = 'simulada';");

  // Si existen evaluaciones asociadas a configuraciones > 1, reasignarlas o limpiarlas antes de borrar config > 1
  await pool.query(`
    DELETE FROM evaluaciones_nivel
    WHERE configuracion_id IN (
      SELECT id FROM configuraciones_reglas WHERE version > 1
    );
  `);

  await pool.query(`
    DELETE FROM bitacora_cambios
    WHERE entidad = 'configuraciones_reglas'
      AND entidad_id IN (SELECT id FROM configuraciones_reglas WHERE version > 1);
  `);
  await pool.query(`
    DELETE FROM bitacora_cambios
    WHERE valor_nuevo::text LIKE '%[S4D1-TEST]%'
       OR valor_anterior::text LIKE '%[S4D1-TEST]%';
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

describe('SUITE DE INTEGRACIÓN END-TO-END S4D1 — API COMPLETA (P01, P03, P04, P05, P07, P16, P17)', () => {
  let adminUsuario;
  let adminToken;

  beforeAll(async () => {
    adminUsuario = await asegurarUsuarioAdministrador({ client: pool });
    adminToken = generarTokenAcceso(adminUsuario);
    await restaurarEstadoBaseDatos();
  });

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.mocked(consultarOpenMeteo).mockResolvedValue(
      construirPayloadOpenMeteoMock('2026-03-10T14:00:00.000Z', 0.4, 0.1)
    );
    await restaurarEstadoBaseDatos();
  });

  afterEach(async () => {
    await restaurarEstadoBaseDatos();
  });

  afterAll(async () => {
    await restaurarEstadoBaseDatos();
    // Asegurar que quede el estado limpio para el resto de suites o uso local
    await pool.query('DELETE FROM evaluaciones_nivel;');
    await pool.query('DELETE FROM lecturas_meteorologicas;');
    limpiarCacheLecturas();
  });

  // ==========================================================================
  // BLOQUE 1 — Contrato completo de endpoints públicos
  // ==========================================================================
  describe('Bloque 1 — Contrato completo de endpoints públicos (GET /api/salud, /api/estado, /api/historial)', () => {
    it('1.1 GET /api/salud responde 200 con estado ok y base_de_datos conectado', async () => {
      const res = await request(app).get('/api/salud');

      expect(res.status).toBe(200);
      expect(res.body.estado).toBe('ok');
      expect(res.body.servicio).toBe('PUKARA API');
      expect(res.body.base_de_datos).toBe('conectado');
      expect(typeof res.body.timestamp).toBe('string');
      expect(res.body.db_time).toBeDefined();
    });

    it('1.2 GET /api/estado entrega estructura v1 completa, 4 recomendaciones, contactos activos, 2 zonas GeoJSON y 6 puntos', async () => {
      const res = await request(app).get('/api/estado');

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.version_esquema_api).toBe('v1');
      expect(res.body.modalidad).toBe('real');
      expect(res.body.es_simulacion).toBe(false);

      // Nivel informativo y metadatos de evaluación
      expect(['NORMAL', 'PRECAUCION', 'ALERTA', 'EMERGENCIA']).toContain(res.body.nivel_vigente);
      expect(typeof res.body.estado_sistema).toBe('string');
      expect(typeof res.body.contador_descenso).toBe('number');
      expect(typeof res.body.version_reglas).toBe('object');
      expect(typeof res.body.version_reglas.version).toBe('number');
      expect(typeof res.body.t_max_minutos).toBe('number');

      // Aviso permanente institucional obligatorio
      expect(typeof res.body.aviso_permanente).toBe('string');
      expect(res.body.aviso_permanente).toContain('niveles informativos de lluvia');
      expect(res.body.aviso_permanente).toContain('umbrales académicos');

      //Las 4 recomendaciones preventivas publicadas con etiqueta origen
      expect(Array.isArray(res.body.recomendaciones_publicadas)).toBe(true);
      expect(res.body.recomendaciones_publicadas).toHaveLength(4);
      const nivelesRec = res.body.recomendaciones_publicadas.map((r) => r.nivel).sort();
      expect(nivelesRec).toEqual(['ALERTA', 'EMERGENCIA', 'NORMAL', 'PRECAUCION']);
      for (const rec of res.body.recomendaciones_publicadas) {
        expect(['institucional', 'demostracion']).toContain(rec.origen);
        expect(typeof rec.titulo).toBe('string');
        expect(typeof rec.contenido).toBe('string');
      }

      // Contactos de emergencia activos (>= 1)
      expect(Array.isArray(res.body.contactos_emergencia)).toBe(true);
      expect(res.body.contactos_emergencia.length).toBeGreaterThanOrEqual(1);
      for (const c of res.body.contactos_emergencia) {
        expect(c.activo).toBe(true);
        expect(typeof c.nombre).toBe('string');
        expect(typeof c.telefono).toBe('string');
        expect(typeof c.fuente).toBe('string');
      }

      // Las 2 zonas GeoJSON con advertencia canónica
      expect(Array.isArray(res.body.zonas_referencia)).toBe(true);
      expect(res.body.zonas_referencia).toHaveLength(2);
      for (const zona of res.body.zonas_referencia) {
        expect(zona.advertencia).toBe('referencia de demostración, no validada');
        expect(zona.geometria).toBeDefined();
        expect(['Feature', 'Polygon', 'MultiPolygon']).toContain(zona.geometria.type);
      }

      // Los 6 puntos de referencia con estado_verificacion y leyenda obligatoria en capas_referencia
      expect(res.body.capas_referencia.leyenda_obligatoria).toBe(
        'referencia de demostración, no validada'
      );
      expect(Array.isArray(res.body.puntos_referencia)).toBe(true);
      expect(res.body.puntos_referencia).toHaveLength(6);
      for (const punto of res.body.puntos_referencia) {
        expect(typeof punto.nombre).toBe('string');
        expect(typeof punto.latitud).toBe('number');
        expect(typeof punto.longitud).toBe('number');
        expect(typeof punto.estado_verificacion).toBe('string');
        expect(punto.estado_verificacion.length).toBeGreaterThan(0);
      }
    });

    it('1.3 GET /api/historial?limite=10 y GET /api/historial?modalidad=simulada&limite=10 responden con paginación y aislamiento de modalidad', async () => {
      // Asegurar al menos una lectura real y una simulada
      await request(app).get('/api/estado');
      await request(app)
        .post('/api/simulacion/lectura')
        .send({
          intensidad_mm_h: 7.0,
          acum_24h_mm: 26.0,
          acum_72h_mm: 62.0,
          observado_en: '2026-03-10T15:00:00.000Z',
          reiniciar_antes: true,
        });

      const resReal = await request(app).get('/api/historial?limite=10');
      expect(resReal.status).toBe(200);
      expect(resReal.body.modalidad).toBe('real');
      expect(resReal.body.limite).toBe(10);
      expect(resReal.body.offset).toBe(0);
      expect(typeof resReal.body.total).toBe('number');
      expect(Array.isArray(resReal.body.items)).toBe(true);
      expect(resReal.body.items.length).toBeGreaterThanOrEqual(1);
      for (const item of resReal.body.items) {
        expect(item.modalidad).toBe('real');
      }

      const resSim = await request(app).get('/api/historial?modalidad=simulada&limite=10');
      expect(resSim.status).toBe(200);
      expect(resSim.body.modalidad).toBe('simulada');
      expect(resSim.body.limite).toBe(10);
      expect(Array.isArray(resSim.body.items)).toBe(true);
      expect(resSim.body.items).toHaveLength(1);
      expect(resSim.body.items[0].modalidad).toBe('simulada');
      expect(resSim.body.items[0].nivel_vigente).toBe('ALERTA');
    });
  });

  // ==========================================================================
  // BLOQUE 2 — Certificación de P03 (API sin respuesta) y P04 (Caché y unicidad)
  // ==========================================================================
  describe('Bloque 2 — Certificación de P03 (API sin respuesta) y P04 (Caché y unicidad de muestra) vía API', () => {
    it('2.1 P04: Dos llamadas consecutivas a GET /api/estado dentro de los 12 min sirven cache_servidor sin llamar de nuevo a Open-Meteo ni duplicar lecturas/evaluaciones', async () => {
      await pool.query('DELETE FROM evaluaciones_nivel;');
      await pool.query('DELETE FROM lecturas_meteorologicas;');
      limpiarCacheLecturas();

      const tsObservado = '2026-03-10T16:00:00.000Z';
      vi.mocked(consultarOpenMeteo).mockResolvedValue(
        construirPayloadOpenMeteoMock(tsObservado, 3.0, 0.5)
      );

      // Primera llamada: consulta Open-Meteo y persiste lectura + evaluación
      const res1 = await request(app).get('/api/estado');
      expect(res1.status).toBe(200);
      expect(res1.body.meteorologia.origen_respuesta).toBe('open_meteo');
      expect(vi.mocked(consultarOpenMeteo)).toHaveBeenCalledTimes(1);

      const conteoLecturas1 = await pool.query(
        "SELECT COUNT(*)::int AS total FROM lecturas_meteorologicas WHERE modalidad = 'real' AND observado_en = $1;",
        [tsObservado]
      );
      const conteoEvaluaciones1 = await pool.query(
        `SELECT COUNT(*)::int AS total
         FROM evaluaciones_nivel e
         JOIN lecturas_meteorologicas l ON l.id = e.lectura_id
         WHERE l.modalidad = 'real';`
      );
      expect(conteoLecturas1.rows[0].total).toBe(1);
      expect(conteoEvaluaciones1.rows[0].total).toBe(1);

      // Segunda llamada inmediata dentro de la ventana de caché (12 min)
      const res2 = await request(app).get('/api/estado');
      expect(res2.status).toBe(200);
      expect(res2.body.meteorologia.origen_respuesta).toBe('cache_servidor');
      expect(res2.body.meteorologia.lectura.id).toBe(res1.body.meteorologia.lectura.id);

      // Verificar que NO se llamó nuevamente a Open-Meteo
      expect(vi.mocked(consultarOpenMeteo)).toHaveBeenCalledTimes(1);

      // Verificar en PostgreSQL que no se insertó fila duplicada ni nueva evaluación
      const conteoLecturas2 = await pool.query(
        "SELECT COUNT(*)::int AS total FROM lecturas_meteorologicas WHERE modalidad = 'real' AND observado_en = $1;",
        [tsObservado]
      );
      const conteoEvaluaciones2 = await pool.query(
        `SELECT COUNT(*)::int AS total
         FROM evaluaciones_nivel e
         JOIN lecturas_meteorologicas l ON l.id = e.lectura_id
         WHERE l.modalidad = 'real';`
      );
      expect(conteoLecturas2.rows[0].total).toBe(1);
      expect(conteoEvaluaciones2.rows[0].total).toBe(1);
    });

    it('2.2 P03: Ante fallo/timeout de Open-Meteo al expirar la caché, GET /api/estado responde 200 OK con fallo_api_reciente=true, sirve última lectura con antigüedad, no inserta fila inválida y conserva nivel_vigente y contador_descenso', async () => {
      await pool.query('DELETE FROM evaluaciones_nivel;');
      await pool.query('DELETE FROM lecturas_meteorologicas;');
      limpiarCacheLecturas();

      // Paso A: Establecer un estado inicial conocido (ej. ALERTA con contador_descenso = 1)
      const ts1 = new Date(Date.now() - 35 * 60 * 1000).toISOString();
      vi.mocked(consultarOpenMeteo).mockResolvedValueOnce(
        construirPayloadOpenMeteoMock(ts1, 7.5, 0.8) // Intensidad >= 6.5 -> ALERTA
      );
      const resInicial = await request(app).get('/api/estado');
      expect(resInicial.status).toBe(200);
      expect(resInicial.body.nivel_vigente).toBe('ALERTA');
      expect(resInicial.body.contador_descenso).toBe(0);

      // Paso B: Segunda muestra 20 min después con lluvia baja -> inicia histéresis (contador_descenso = 1, sigue en ALERTA)
      limpiarCacheLecturas();
      const ts2 = new Date(Date.now() - 15 * 60 * 1000).toISOString();
      vi.mocked(consultarOpenMeteo).mockResolvedValueOnce(
        construirPayloadOpenMeteoMock(ts2, 0.2, 0.0)
      );
      const resPreFallo = await request(app).get('/api/estado');
      expect(resPreFallo.status).toBe(200);
      expect(resPreFallo.body.nivel_vigente).toBe('ALERTA');
      expect(resPreFallo.body.contador_descenso).toBe(1);

      const lecturasAntesFallo = await pool.query(
        "SELECT COUNT(*)::int AS total FROM lecturas_meteorologicas WHERE modalidad = 'real';"
      );
      const evaluacionesAntesFallo = await pool.query(
        `SELECT COUNT(*)::int AS total
         FROM evaluaciones_nivel e
         JOIN lecturas_meteorologicas l ON l.id = e.lectura_id
         WHERE l.modalidad = 'real';`
      );

      // Paso C: Simular expiración de caché (limpiarCacheLecturas) y fallo/timeout de Open-Meteo (P03)
      limpiarCacheLecturas();
      vi.mocked(consultarOpenMeteo).mockRejectedValueOnce(
        new Error('Open-Meteo HTTP Timeout (Simulación P03)')
      );

      const resFallo = await request(app).get('/api/estado');

      // Debe seguir respondiendo 200 OK sin degradar a NORMAL ni lanzar 500
      expect(resFallo.status).toBe(200);
      expect(resFallo.body.ok).toBe(true);
      expect(resFallo.body.meteorologia.fallo_api_reciente).toBe(true);
      expect(resFallo.body.meteorologia.origen_respuesta).toBe('respaldo_bd_por_fallo_api');
      expect(resFallo.body.meteorologia.lectura.id).toBe(resPreFallo.body.meteorologia.lectura.id);
      expect(typeof resFallo.body.antiguedad_minutos).toBe('number');
      expect(resFallo.body.antiguedad_minutos).toBeGreaterThanOrEqual(14);

      // El nivel vigente y el contador de descenso deben conservarse intactos
      expect(resFallo.body.nivel_vigente).toBe('ALERTA');
      expect(resFallo.body.contador_descenso).toBe(1);

      // No se debe haber insertado ninguna fila inválida en lecturas_meteorologicas ni evaluaciones_nivel
      const lecturasDespuesFallo = await pool.query(
        "SELECT COUNT(*)::int AS total FROM lecturas_meteorologicas WHERE modalidad = 'real';"
      );
      const evaluacionesDespuesFallo = await pool.query(
        `SELECT COUNT(*)::int AS total
         FROM evaluaciones_nivel e
         JOIN lecturas_meteorologicas l ON l.id = e.lectura_id
         WHERE l.modalidad = 'real';`
      );
      expect(lecturasDespuesFallo.rows[0].total).toBe(lecturasAntesFallo.rows[0].total);
      expect(evaluacionesDespuesFallo.rows[0].total).toBe(evaluacionesAntesFallo.rows[0].total);
    });
  });

  // ==========================================================================
  // BLOQUE 3 — Certificación de P07 (Control de acceso, JWT y Roles)
  // ==========================================================================
  describe('Bloque 3 — Certificación de P07 (Control de acceso, JWT y Roles en /api/admin/*)', () => {
    const rutasProtegidasAdmin = [
      { metodo: 'get', ruta: '/api/admin/configuraciones' },
      { metodo: 'post', ruta: '/api/admin/configuraciones', body: { umbrales: UMBRALES_V2_VALIDOS } },
      { metodo: 'post', ruta: '/api/admin/configuraciones/1/activar', body: {} },
      { metodo: 'get', ruta: '/api/admin/recomendaciones' },
      { metodo: 'post', ruta: '/api/admin/recomendaciones', body: {} },
      { metodo: 'put', ruta: '/api/admin/recomendaciones/1', body: {} },
      { metodo: 'get', ruta: '/api/admin/contactos' },
      { metodo: 'post', ruta: '/api/admin/contactos', body: {} },
      { metodo: 'put', ruta: '/api/admin/contactos/1', body: {} },
      { metodo: 'get', ruta: '/api/admin/capas' },
      { metodo: 'put', ruta: '/api/admin/zonas/1', body: {} },
      { metodo: 'put', ruta: '/api/admin/puntos/1', body: {} },
      { metodo: 'get', ruta: '/api/admin/bitacora' },
      { metodo: 'post', ruta: '/api/admin/simulacion/lectura', body: {} },
      { metodo: 'delete', ruta: '/api/admin/simulacion' },
    ];

    it('3.1 Rechaza con HTTP 401 todas las rutas de /api/admin/* sin token, con token malformado o con token JWT expirado', async () => {
      const tokenExpirado = generarTokenAcceso(adminUsuario, { expiresIn: '-10s' });
      const tokenMalformado = `${adminToken.slice(0, -6)}xxxxxx`;

      for (const item of rutasProtegidasAdmin) {
        // Sin token -> 401 TOKEN_FALTANTE
        const resSinToken = await request(app)[item.metodo](item.ruta).send(item.body || {});
        expect(resSinToken.status).toBe(401);
        expect(resSinToken.body.error.codigo).toBe('TOKEN_FALTANTE');

        // Token malformado -> 401 TOKEN_INVALIDO
        const resMalformado = await request(app)
          [item.metodo](item.ruta)
          .set('Authorization', `Bearer ${tokenMalformado}`)
          .send(item.body || {});
        expect(resMalformado.status).toBe(401);
        expect(resMalformado.body.error.codigo).toBe('TOKEN_INVALIDO');

        // Token expirado -> 401 TOKEN_EXPIRADO
        const resExpirado = await request(app)
          [item.metodo](item.ruta)
          .set('Authorization', `Bearer ${tokenExpirado}`)
          .send(item.body || {});
        expect(resExpirado.status).toBe(401);
        expect(resExpirado.body.error.codigo).toBe('TOKEN_EXPIRADO');
      }
    });

    it('3.2 Rechaza con HTTP 403 Forbidden tokens JWT válidos con rol operador o publico sin alterar ninguna tabla en PostgreSQL', async () => {
      const tokenOperador = generarTokenAcceso({
        id: 901,
        email: 'operador@pukara.bo',
        nombre: 'Operador Prueba',
        rol: 'operador',
      });
      const tokenPublico = generarTokenAcceso({
        id: 902,
        email: 'publico@pukara.bo',
        nombre: 'Consulta Pública',
        rol: 'publico',
      });

      const conteoBitacoraAntes = await pool.query(
        'SELECT COUNT(*)::int AS total FROM bitacora_cambios;'
      );
      const conteoConfigAntes = await pool.query(
        'SELECT COUNT(*)::int AS total FROM configuraciones_reglas;'
      );

      for (const tokenNoAdmin of [tokenOperador, tokenPublico]) {
        for (const item of rutasProtegidasAdmin) {
          const res = await request(app)
            [item.metodo](item.ruta)
            .set('Authorization', `Bearer ${tokenNoAdmin}`)
            .send(item.body || {});

          expect(res.status).toBe(403);
          expect(res.body.ok).toBe(false);
          expect(res.body.error.codigo).toBe('ROL_INSUFICIENTE');
        }
      }

      const conteoBitacoraDespues = await pool.query(
        'SELECT COUNT(*)::int AS total FROM bitacora_cambios;'
      );
      const conteoConfigDespues = await pool.query(
        'SELECT COUNT(*)::int AS total FROM configuraciones_reglas;'
      );
      expect(conteoBitacoraDespues.rows[0].total).toBe(conteoBitacoraAntes.rows[0].total);
      expect(conteoConfigDespues.rows[0].total).toBe(conteoConfigAntes.rows[0].total);
    });
  });

  // ==========================================================================
  // BLOQUE 4 — Certificación de P01, P17, P05 y P16 a través de endpoints HTTP
  // ==========================================================================
  describe('Bloque 4 — Certificación de P01, P17, P05 y P16 a través de endpoints HTTP', () => {
    it('4.1 P01: POST /api/simulacion/lectura clasifica exactamente los valores frontera (>=) e inmediatamente inferiores en las 3 variables', async () => {
      const casosFrontera = [
        // Valores inmediatamente inferiores al umbral de PRECAUCION -> NORMAL
        {
          desc: 'intensidad 2.4 mm/h (< 2.5) permanece en NORMAL',
          payload: { intensidad_mm_h: 2.4, acum_24h_mm: 0, acum_72h_mm: 0 },
          esperado: 'NORMAL',
        },
        {
          desc: 'acum_24h 9.9 mm (< 10) permanece en NORMAL',
          payload: { intensidad_mm_h: 0, acum_24h_mm: 9.9, acum_72h_mm: 0 },
          esperado: 'NORMAL',
        },
        {
          desc: 'acum_72h 24.9 mm (< 25) permanece en NORMAL',
          payload: { intensidad_mm_h: 0, acum_24h_mm: 0, acum_72h_mm: 24.9 },
          esperado: 'NORMAL',
        },
        // Fronteras exactas de PRECAUCION (>=)
        {
          desc: 'intensidad 2.5 mm/h (== 2.5) activa PRECAUCION',
          payload: { intensidad_mm_h: 2.5, acum_24h_mm: 0, acum_72h_mm: 0 },
          esperado: 'PRECAUCION',
        },
        {
          desc: 'acum_24h 10.0 mm (== 10) activa PRECAUCION',
          payload: { intensidad_mm_h: 0, acum_24h_mm: 10.0, acum_72h_mm: 0 },
          esperado: 'PRECAUCION',
        },
        {
          desc: 'acum_72h 25.0 mm (== 25) activa PRECAUCION',
          payload: { intensidad_mm_h: 0, acum_24h_mm: 0, acum_72h_mm: 25.0 },
          esperado: 'PRECAUCION',
        },
        // Fronteras exactas de ALERTA (>=)
        {
          desc: 'intensidad 6.5 mm/h (== 6.5) activa ALERTA',
          payload: { intensidad_mm_h: 6.5, acum_24h_mm: 0, acum_72h_mm: 0 },
          esperado: 'ALERTA',
        },
        {
          desc: 'acum_24h 25.0 mm (== 25) activa ALERTA',
          payload: { intensidad_mm_h: 0, acum_24h_mm: 25.0, acum_72h_mm: 0 },
          esperado: 'ALERTA',
        },
        {
          desc: 'acum_72h 60.0 mm (== 60) activa ALERTA',
          payload: { intensidad_mm_h: 0, acum_24h_mm: 0, acum_72h_mm: 60.0 },
          esperado: 'ALERTA',
        },
        // Fronteras exactas de EMERGENCIA (>=)
        {
          desc: 'intensidad 12.0 mm/h (== 12) activa EMERGENCIA',
          payload: { intensidad_mm_h: 12.0, acum_24h_mm: 0, acum_72h_mm: 0 },
          esperado: 'EMERGENCIA',
        },
        {
          desc: 'acum_24h 40.0 mm (== 40) activa EMERGENCIA',
          payload: { intensidad_mm_h: 0, acum_24h_mm: 40.0, acum_72h_mm: 0 },
          esperado: 'EMERGENCIA',
        },
        {
          desc: 'acum_72h 90.0 mm (== 90) activa EMERGENCIA',
          payload: { intensidad_mm_h: 0, acum_24h_mm: 0, acum_72h_mm: 90.0 },
          esperado: 'EMERGENCIA',
        },
      ];

      for (let i = 0; i < casosFrontera.length; i++) {
        const caso = casosFrontera[i];
        const res = await request(app)
          .post('/api/simulacion/lectura')
          .send({
            ...caso.payload,
            observado_en: new Date(Date.parse('2026-03-10T18:00:00.000Z') + i * 1800000).toISOString(),
            reiniciar_antes: true,
          });

        expect(res.status, caso.desc).toBe(201);
        expect(res.body.evaluacion.nivel_calculado, caso.desc).toBe(caso.esperado);
        expect(res.body.evaluacion.nivel_vigente, caso.desc).toBe(caso.esperado);
      }
    });

    it('4.2 P17: POST /api/simulacion/lectura aplica regla de saturación (acum_72h=60 + intensidad=2.5 -> ALERTA) y mantiene PRECAUCION con 59.9 + 2.5', async () => {
      // Caso 1: acum_72h_mm = 60.0 e intensidad_mm_h = 2.5 -> ALERTA con regla_saturacion_aplicada: true
      const resSaturado = await request(app)
        .post('/api/simulacion/lectura')
        .send({
          intensidad_mm_h: 2.5,
          acum_24h_mm: 5.0,
          acum_72h_mm: 60.0,
          observado_en: '2026-03-11T10:00:00.000Z',
          reiniciar_antes: true,
        });

      expect(resSaturado.status).toBe(201);
      expect(resSaturado.body.evaluacion.nivel_vigente).toBe('ALERTA');
      expect(resSaturado.body.clasificacion.regla_saturacion_aplicada).toBe(true);

      // Caso 2: acum_72h_mm = 59.9 e intensidad_mm_h = 2.5 -> permanece en PRECAUCION con regla_saturacion_aplicada: false
      const resNoSaturado = await request(app)
        .post('/api/simulacion/lectura')
        .send({
          intensidad_mm_h: 2.5,
          acum_24h_mm: 5.0,
          acum_72h_mm: 59.9,
          observado_en: '2026-03-11T11:00:00.000Z',
          reiniciar_antes: true,
        });

      expect(resNoSaturado.status).toBe(201);
      expect(resNoSaturado.body.evaluacion.nivel_vigente).toBe('PRECAUCION');
      expect(resNoSaturado.body.clasificacion.regla_saturacion_aplicada).toBe(false);
    });

    it('4.3 P16 y P05: POST /api/admin/configuraciones rechaza umbrales incoherentes (400), crea y activa versión v2 archivando v1, reinicia contador_descenso, no recalcula evaluaciones pasadas y registra en bitacora_cambios', async () => {
      // 1. P16: Rechazo de configuración con PRECAUCION >= ALERTA, valores negativos e incoherencia 24h > 72h
      const umbralesIncoherentes = [
        { variable: 'intensidad_mm_h', nivel: 'PRECAUCION', valor: 8.0 }, // Mayor que ALERTA (6.5)
        { variable: 'intensidad_mm_h', nivel: 'ALERTA', valor: 6.5 },
        { variable: 'intensidad_mm_h', nivel: 'EMERGENCIA', valor: 12.0 },
        { variable: 'acum_24h_mm', nivel: 'PRECAUCION', valor: -5.0 }, // Negativo
        { variable: 'acum_24h_mm', nivel: 'ALERTA', valor: 70.0 }, // Mayor que acum_72h ALERTA (60)
        { variable: 'acum_24h_mm', nivel: 'EMERGENCIA', valor: 100.0 },
        { variable: 'acum_72h_mm', nivel: 'PRECAUCION', valor: 25.0 },
        { variable: 'acum_72h_mm', nivel: 'ALERTA', valor: 60.0 },
        { variable: 'acum_72h_mm', nivel: 'EMERGENCIA', valor: 90.0 },
      ];

      const resInvalido = await request(app)
        .post('/api/admin/configuraciones')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          motivo: '[S4D1-TEST] Intento inválido P16',
          activar: false,
          umbrales: umbralesIncoherentes,
        });

      expect(resInvalido.status).toBe(400);
      expect(resInvalido.body.ok).toBe(false);
      expect(resInvalido.body.error.codigo).toBe('CONFIGURACION_INVALIDA');
      expect(Array.isArray(resInvalido.body.error.detalles)).toBe(true);
      expect(resInvalido.body.error.detalles.length).toBeGreaterThanOrEqual(3);

      // Rechazo por umbrales faltantes (< 9)
      const resFaltantes = await request(app)
        .post('/api/admin/configuraciones')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          motivo: '[S4D1-TEST] Umbrales incompletos P16',
          activar: false,
          umbrales: UMBRALES_V2_VALIDOS.slice(0, 5),
        });
      expect(resFaltantes.status).toBe(400);
      expect(resFaltantes.body.error.codigo).toBe('CONFIGURACION_INVALIDA');

      // 2. Generar evaluación histórica previa con v1 (intensidad 2.6 -> PRECAUCION en v1, pero sería NORMAL en v2 donde PRECAUCION=3.0)
      // Además dejar contador_descenso = 1 en simulación para verificar su reinicio al activar v2
      const resSim1 = await request(app)
        .post('/api/simulacion/lectura')
        .send({
          intensidad_mm_h: 2.6,
          acum_24h_mm: 5.0,
          acum_72h_mm: 10.0,
          observado_en: '2026-03-11T12:00:00.000Z',
          reiniciar_antes: true,
        });
      expect(resSim1.status).toBe(201);
      expect(resSim1.body.evaluacion.nivel_vigente).toBe('PRECAUCION');
      const idEvalPasada = resSim1.body.evaluacion.id;

      // Segunda lectura simulada menor (intensidad 0.5) para colocar contador_descenso = 1
      const resSim2 = await request(app)
        .post('/api/simulacion/lectura')
        .send({
          intensidad_mm_h: 0.5,
          acum_24h_mm: 2.0,
          acum_72h_mm: 5.0,
          observado_en: '2026-03-11T12:20:00.000Z',
          reiniciar_antes: false,
        });
      expect(resSim2.status).toBe(201);
      expect(resSim2.body.evaluacion.nivel_vigente).toBe('PRECAUCION');
      expect(resSim2.body.evaluacion.contador_descenso).toBe(1);

      // 3. P05: Crear nueva versión v2 válida en borrador
      const resCrearV2 = await request(app)
        .post('/api/admin/configuraciones')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          motivo: '[S4D1-TEST] Creación de versión v2 para prueba P05',
          activar: false,
          umbrales: UMBRALES_V2_VALIDOS,
        });

      expect(resCrearV2.status).toBe(201);
      expect(resCrearV2.body.ok).toBe(true);
      const idConfigV2 = resCrearV2.body.configuracion.id;
      expect(resCrearV2.body.configuracion.version).toBe(2);
      expect(resCrearV2.body.configuracion.estado).toBe('borrador');

      // 4. Activar versión v2 con POST /api/admin/configuraciones/:id/activar
      const resActivarV2 = await request(app)
        .post(`/api/admin/configuraciones/${idConfigV2}/activar`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          motivo: '[S4D1-TEST] Activación de versión v2 P05',
        });

      expect(resActivarV2.status).toBe(200);
      expect(resActivarV2.body.ok).toBe(true);
      expect(resActivarV2.body.configuracion.estado).toBe('vigente');
      expect(resActivarV2.body.configuracion.contador_descenso_reiniciado).toBe(true);

      // Verificar que v1 pasó a estado 'archivada'
      const estadoV1 = await pool.query(
        'SELECT estado FROM configuraciones_reglas WHERE version = 1;'
      );
      expect(estadoV1.rows[0].estado).toBe('archivada');

      // Verificar que la evaluación pasada NO fue recalculada (conserva configuracion_id = 1 y nivel PRECAUCION)
      const evalPasadaBD = await pool.query(
        'SELECT configuracion_id, nivel_calculado, nivel_vigente FROM evaluaciones_nivel WHERE id = $1;',
        [idEvalPasada]
      );
      expect(Number(evalPasadaBD.rows[0].configuracion_id)).toBe(1);
      expect(evalPasadaBD.rows[0].nivel_calculado).toBe('PRECAUCION');
      expect(evalPasadaBD.rows[0].nivel_vigente).toBe('PRECAUCION');

      // Verificar que una nueva evaluación posterior usa v2 y reinicia el contador_descenso a 0 por cambio de versión
      const resSim3 = await request(app)
        .post('/api/simulacion/lectura')
        .send({
          intensidad_mm_h: 0.5,
          acum_24h_mm: 2.0,
          acum_72h_mm: 5.0,
          observado_en: '2026-03-11T12:40:00.000Z',
          reiniciar_antes: false,
        });
      expect(resSim3.status).toBe(201);
      expect(Number(resSim3.body.evaluacion.configuracion_id)).toBe(Number(idConfigV2));
      // Como cambió de v1 a v2, el contador_descenso previo (1) se reinició a 0 antes de evaluar esta muestra (que suma 1 hacia NORMAL)
      expect(resSim3.body.evaluacion.nivel_vigente).toBe('PRECAUCION');
      expect(resSim3.body.evaluacion.contador_descenso).toBe(1);

      // Verificar registro en bitacora_cambios
      const bitacoraRes = await request(app)
        .get('/api/admin/bitacora?entidad=configuraciones_reglas&limite=10')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(bitacoraRes.status).toBe(200);
      const listaRegistros = bitacoraRes.body.registros || bitacoraRes.body.items || [];
      const registrosTest = listaRegistros.filter(
        (b) =>
          b.entidad === 'configuraciones_reglas' &&
          Number(b.entidad_id) === Number(idConfigV2)
      );
      expect(registrosTest.length).toBeGreaterThanOrEqual(1);
    });
  });
});

