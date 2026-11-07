/**
 * @file admin.api.test.js
 * @description Suite integral de pruebas automatizadas para la API de Administración de PUKARA:
 * - Bloque 1: Protección RBAC Transversal (P07 sobre todas las rutas /api/admin/*)
 * - Bloque 2: Versionado de Umbrales y Validación de Coherencia (P05 y P16)
 * - Bloque 3: Gestión de Recomendaciones Preventivas y Etiquetas de Origen
 * - Bloque 4: Gestión de Contactos de Emergencia
 * - Bloque 5: Edición de Atributos de Capas y Puntos e Inmutabilidad Cartográfica
 * - Bloque 6: Modo Demostración (P11) y Consulta de Bitácora de Cambios
 */

import { describe, it, expect, beforeAll, beforeEach, afterEach, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { pool } from '../src/db/pool.js';
import { seed } from '../src/db/seed.js';
import { asegurarUsuarioAdministrador } from '../src/db/seedAdmin.js';
import { generarTokenAcceso } from '../src/services/auth.service.js';
import { limpiarRateLimiterLogin } from '../src/middleware/rateLimit.middleware.js';
import { limpiarDatosSimulados } from '../src/services/simulacion.service.js';

// Umbrales canónicos de prueba coherentes para versión 2 (P05)
const UMBRALES_V2_COHERENTES = [
  { variable: 'intensidad_mm_h', nivel: 'PRECAUCION', valor: 3.0 },
  { variable: 'intensidad_mm_h', nivel: 'ALERTA', valor: 7.0 },
  { variable: 'intensidad_mm_h', nivel: 'EMERGENCIA', valor: 14.0 },
  { variable: 'acum_24h_mm', nivel: 'PRECAUCION', valor: 12.0 },
  { variable: 'acum_24h_mm', nivel: 'ALERTA', valor: 28.0 },
  { variable: 'acum_24h_mm', nivel: 'EMERGENCIA', valor: 45.0 },
  { variable: 'acum_72h_mm', nivel: 'PRECAUCION', valor: 30.0 },
  { variable: 'acum_72h_mm', nivel: 'ALERTA', valor: 65.0 },
  { variable: 'acum_72h_mm', nivel: 'EMERGENCIA', valor: 95.0 },
];

/**
 * Restaura el estado de la base de datos a la versión inicial v1,
 * eliminando versiones de prueba, bitácoras de test, recomendaciones agregadas
 * y contactos generados durante las pruebas.
 */
async function restaurarEstadoBD() {
  await limpiarDatosSimulados();

  // 1. Limpiar bitácora de configuraciones > 1 y de entidades de prueba
  await pool.query(`
    DELETE FROM bitacora_cambios
    WHERE entidad = 'configuraciones_reglas'
      AND entidad_id IN (SELECT id FROM configuraciones_reglas WHERE version > 1);
  `);
  await pool.query(`
    DELETE FROM bitacora_cambios
    WHERE entidad IN ('contactos_emergencia', 'recomendaciones_preventivas')
      AND (valor_nuevo::text LIKE '%Test%' OR valor_anterior::text LIKE '%Test%');
  `);

  // 2. Limpiar umbrales y configuraciones con version > 1
  await pool.query(`
    DELETE FROM umbrales
    WHERE configuracion_id IN (SELECT id FROM configuraciones_reglas WHERE version > 1);
  `);
  await pool.query('DELETE FROM configuraciones_reglas WHERE version > 1;');

  // 3. Garantizar que la versión 1 esté como 'vigente'
  await pool.query("UPDATE configuraciones_reglas SET estado = 'vigente' WHERE version = 1;");

  // 4. Limpiar recomendaciones de prueba con versión > 1
  await pool.query('DELETE FROM recomendaciones_preventivas WHERE version > 1;');
  await pool.query("UPDATE recomendaciones_preventivas SET estado_publicacion = 'publicado' WHERE version = 1;");

  // 5. Limpiar contactos de prueba
  await pool.query("DELETE FROM contactos_emergencia WHERE nombre LIKE '%Test%' OR fuente LIKE '%Test%';");

  // 6. Restaurar atributos descriptivos de zonas y puntos semilla
  await pool.query(`
    UPDATE zonas_referencia
    SET nombre = 'Sector Piloto Llojeta — Cuenca Media (Referencial)',
        fuente = 'Delimitación académica aproximada sobre cartografía base OpenStreetMap',
        verificada = false,
        advertencia = 'referencia de demostración, no validada'
    WHERE id = 1;
  `);

  await pool.query(`
    DELETE FROM puntos_referencia WHERE id > 6;
  `);

  await pool.query(`
    UPDATE puntos_referencia
    SET nombre = 'Cruce Av. Los Sargentos — Acceso Bajo Llojeta (Referencia vial)',
        tipo = 'hito_vial_referencial',
        fuente = 'Referencia cartográfica OpenStreetMap — Demostración académica no validada',
        estado_verificacion = 'sin_verificar',
        activo = true
    WHERE id = 1;
  `);
}

describe('Semana 3 - Día 2 (Fase B): API de Administración y Bitácora de Cambios (admin.api.test.js)', () => {
  let adminToken;
  let adminUser;
  let publicToken;
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@pukara.bo';
  const adminPassword = process.env.ADMIN_PASSWORD || 'PukaraAdmin2026!';

  beforeAll(async () => {
    await seed();
    const admin = await asegurarUsuarioAdministrador();
    adminUser = admin;

    // Token con rol 'publico' para verificar RBAC (403)
    publicToken = generarTokenAcceso({
      id: 999,
      email: 'vecino_llojeta@pukara.bo',
      nombre: 'Vecino Llojeta',
      rol: 'publico',
    });
  });

  beforeEach(async () => {
    limpiarRateLimiterLogin();
    await restaurarEstadoBD();

    // Obtener token JWT de administrador vía login oficial
    const resLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: adminEmail, password: adminPassword });

    expect(resLogin.status).toBe(200);
    adminToken = resLogin.body.token;
  });

  afterEach(async () => {
    limpiarRateLimiterLogin();
    await restaurarEstadoBD();
  });

  afterAll(async () => {
    await restaurarEstadoBD();
  });

  // =========================================================================
  // BLOQUE 1: Protección RBAC Transversal (P07 sobre /api/admin/*)
  // =========================================================================
  describe('Bloque 1: Protección RBAC Transversal (P07 sobre todas las rutas /api/admin/*)', () => {
    const rutasAdmin = [
      { metodo: 'get', ruta: '/api/admin/configuraciones' },
      { metodo: 'post', ruta: '/api/admin/configuraciones', payload: {} },
      { metodo: 'put', ruta: '/api/admin/recomendaciones/1', payload: { titulo: 'Prueba' } },
      { metodo: 'put', ruta: '/api/admin/contactos/1', payload: { telefono: '123' } },
      { metodo: 'put', ruta: '/api/admin/zonas/1', payload: { nombre: 'Zona' } },
      { metodo: 'put', ruta: '/api/admin/puntos/1', payload: { nombre: 'Punto' } },
      { metodo: 'get', ruta: '/api/admin/bitacora' },
    ];

    for (const { metodo, ruta, payload } of rutasAdmin) {
      it(`1.1. Rechaza petición sin token a ${metodo.toUpperCase()} ${ruta} con HTTP 401 (TOKEN_FALTANTE)`, async () => {
        let req = request(app)[metodo](ruta);
        if (payload) req = req.send(payload);

        const res = await req;
        expect(res.status).toBe(401);
        expect(res.body.ok).toBe(false);
        expect(res.body.error.codigo).toBe('TOKEN_FALTANTE');
      });

      it(`1.2. Rechaza petición con rol 'publico' a ${metodo.toUpperCase()} ${ruta} con HTTP 403 (ROL_INSUFICIENTE)`, async () => {
        let req = request(app)[metodo](ruta).set('Authorization', `Bearer ${publicToken}`);
        if (payload) req = req.send(payload);

        const res = await req;
        expect(res.status).toBe(403);
        expect(res.body.ok).toBe(false);
        expect(res.body.error.codigo).toBe('ROL_INSUFICIENTE');
      });
    }
  });

  // =========================================================================
  // BLOQUE 2: Versionado de Umbrales y Validación de Coherencia (P05 y P16)
  // =========================================================================
  describe('Bloque 2: Versionado de Umbrales y Validación de Coherencia (P05 y P16)', () => {
    it('2.1. GET /api/admin/configuraciones devuelve la versión 1 vigente con sus 9 umbrales académicos', async () => {
      const res = await request(app)
        .get('/api/admin/configuraciones')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(Array.isArray(res.body.versiones)).toBe(true);
      expect(res.body.total).toBeGreaterThanOrEqual(1);

      const v1 = res.body.versiones.find((v) => v.version === 1);
      expect(v1).toBeDefined();
      expect(v1.estado).toBe('vigente');
      expect(v1.umbrales).toHaveLength(9);
      expect(v1.parametros).toHaveProperty('t_max_minutos');
    });

    it('2.2. Regla P16: Rechaza con HTTP 400 y CONFIGURACION_INVALIDA ante umbrales negativos', async () => {
      const umbralesNegativos = UMBRALES_V2_COHERENTES.map((u) =>
        u.variable === 'intensidad_mm_h' && u.nivel === 'PRECAUCION'
          ? { ...u, valor: -2.5 }
          : u
      );

      const res = await request(app)
        .post('/api/admin/configuraciones')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          umbrales: umbralesNegativos,
          motivo: 'Intento con valor negativo',
        });

      expect(res.status).toBe(400);
      expect(res.body.ok).toBe(false);
      expect(res.body.error.codigo).toBe('CONFIGURACION_INVALIDA');
      expect(Array.isArray(res.body.error.detalles)).toBe(true);
      expect(
        res.body.error.detalles.some(
          (d) =>
            d.codigo === 'VALOR_NEGATIVO' ||
            (d.mensaje && d.mensaje.includes('no puede ser negativo'))
        )
      ).toBe(true);

      // Comprobar que no se insertó ninguna fila en la base de datos
      const checkBD = await pool.query('SELECT COUNT(*)::int AS total FROM configuraciones_reglas WHERE version > 1;');
      expect(checkBD.rows[0].total).toBe(0);
    });

    it('2.3. Regla P16: Rechaza con HTTP 400 ante orden invertido (PRECAUCION >= ALERTA)', async () => {
      const umbralesInvertidos = UMBRALES_V2_COHERENTES.map((u) => {
        if (u.variable === 'intensidad_mm_h' && u.nivel === 'PRECAUCION') {
          return { ...u, valor: 8.0 }; // Mayor que ALERTA (7.0)
        }
        return u;
      });

      const res = await request(app)
        .post('/api/admin/configuraciones')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          umbrales: umbralesInvertidos,
          motivo: 'Intento con orden invertido en intensidad',
        });

      expect(res.status).toBe(400);
      expect(res.body.error.codigo).toBe('CONFIGURACION_INVALIDA');
      expect(
        res.body.error.detalles.some(
          (d) =>
            d.codigo === 'ORDEN_NIVELES_INVALIDO' ||
            (d.mensaje && d.mensaje.includes('estrictamente menor'))
        )
      ).toBe(true);
    });

    it('2.4. Regla P16: Rechaza con HTTP 400 ante incoherencia temporal (acum_24h_mm > acum_72h_mm)', async () => {
      const umbralesIncoherentes = UMBRALES_V2_COHERENTES.map((u) => {
        if (u.variable === 'acum_24h_mm' && u.nivel === 'ALERTA') {
          return { ...u, valor: 70.0 }; // 24h = 70.0 > 72h = 65.0
        }
        return u;
      });

      const res = await request(app)
        .post('/api/admin/configuraciones')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          umbrales: umbralesIncoherentes,
          motivo: 'Intento con 24h mayor a 72h en ALERTA',
        });

      expect(res.status).toBe(400);
      expect(res.body.error.codigo).toBe('CONFIGURACION_INVALIDA');
      expect(
        res.body.error.detalles.some(
          (d) =>
            d.codigo === 'COHERENCIA_24H_72H_INVALIDA' ||
            (d.mensaje && d.mensaje.includes('no puede ser mayor al de 72 horas'))
        )
      ).toBe(true);
    });

    it('2.5. Regla P16: Rechaza con HTTP 400 ante configuración incompleta (menos de 9 umbrales)', async () => {
      const umbralesIncompletos = UMBRALES_V2_COHERENTES.slice(0, 8); // Solo 8 umbrales

      const res = await request(app)
        .post('/api/admin/configuraciones')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          umbrales: umbralesIncompletos,
          motivo: 'Intento con matriz incompleta',
        });

      expect(res.status).toBe(400);
      expect(res.body.error.codigo).toBe('CONFIGURACION_INVALIDA');
      expect(
        res.body.error.detalles.some(
          (d) =>
            d.codigo === 'CANTIDAD_UMBRALES_INVALIDA' ||
            (d.mensaje && d.mensaje.includes('exactamente 9 umbrales'))
        )
      ).toBe(true);
    });

    it('2.6. Regla P05: Creación y activación de versión 2 archiva versión 1, preserva inmutable historial y audita en bitácora', async () => {
      // 1. Simular una evaluación previa calculada con v1
      const lecturaRes = await pool.query(`
        INSERT INTO lecturas_meteorologicas (observado_en, intensidad_mm_h, acum_24h_mm, acum_72h_mm, estado, fuente, modalidad)
        VALUES ('2026-10-23T18:00:00.000Z', 1.0, 5.0, 10.0, 'valida', 'Open-Meteo Test', 'real')
        RETURNING id;
      `);
      const lecturaId = lecturaRes.rows[0].id;

      const evalRes = await pool.query(`
        INSERT INTO evaluaciones_nivel (lectura_id, configuracion_id, nivel_calculado, nivel_vigente, contador_descenso, estado_sistema)
        VALUES ($1, 1, 'NORMAL', 'NORMAL', 0, 'NORMAL')
        RETURNING id, configuracion_id;
      `, [lecturaId]);
      const evaluacionIdPrevia = evalRes.rows[0].id;

      // 2. Crear y activar la versión 2 mediante POST /api/admin/configuraciones con activar: true
      const resPost = await request(app)
        .post('/api/admin/configuraciones')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          umbrales: UMBRALES_V2_COHERENTES,
          parametros: {
            t_max_minutos: 60,
            separacion_minima_minutos: 15,
            muestras_descenso: 2,
          },
          motivo: 'Ajuste estacional para época húmeda de verano en Llojeta',
          activar: true,
        });

      expect(resPost.status).toBe(201);
      expect(resPost.body.ok).toBe(true);
      expect(resPost.body.configuracion.version).toBe(2);
      expect(resPost.body.configuracion.estado).toBe('vigente');

      // 3. Verificar estado en Base de Datos: v1 archivada, v2 única vigente
      const checkV1 = await pool.query('SELECT estado FROM configuraciones_reglas WHERE version = 1;');
      expect(checkV1.rows[0].estado).toBe('archivada');

      const vigentes = await pool.query("SELECT id, version FROM configuraciones_reglas WHERE estado = 'vigente';");
      expect(vigentes.rows).toHaveLength(1);
      expect(vigentes.rows[0].version).toBe(2);

      // 4. Regla P05: Inmutabilidad del historial previo (conserva configuracion_id = 1)
      const checkEval = await pool.query('SELECT configuracion_id FROM evaluaciones_nivel WHERE id = $1;', [evaluacionIdPrevia]);
      expect(Number(checkEval.rows[0].configuracion_id)).toBe(1);

      // 5. Verificar registro en bitácora_cambios
      const bitacora = await pool.query(
        "SELECT accion, entidad, entidad_id FROM bitacora_cambios WHERE entidad = 'configuraciones_reglas' AND entidad_id = $1;",
        [resPost.body.configuracion.id]
      );
      expect(bitacora.rows.length).toBeGreaterThanOrEqual(1);

      // Limpieza específica
      await pool.query('DELETE FROM evaluaciones_nivel WHERE id = $1;', [evaluacionIdPrevia]);
      await pool.query('DELETE FROM lecturas_meteorologicas WHERE id = $1;', [lecturaId]);
    });
  });

  // =========================================================================
  // BLOQUE 3: Gestión de Recomendaciones Preventivas y Etiquetas de Origen
  // =========================================================================
  describe('Bloque 3: Gestión de Recomendaciones Preventivas y Etiquetas de Origen', () => {
    it('3.1. POST /api/admin/recomendaciones crea nueva versión, archiva la previa del mismo nivel y registra en bitácora', async () => {
      // Recomendación previa publicada
      const prevRes = await pool.query(
        "SELECT id, version, estado_publicacion FROM recomendaciones_preventivas WHERE nivel = 'ALERTA' AND estado_publicacion = 'publicado';"
      );
      expect(prevRes.rows.length).toBeGreaterThanOrEqual(1);
      const prevId = prevRes.rows[0].id;

      // Crear nueva recomendación para nivel ALERTA
      const resPost = await request(app)
        .post('/api/admin/recomendaciones')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          nivel: 'ALERTA',
          titulo: 'Monitoreo preventivo y limpieza de bajantes Test',
          contenido: 'Verificar que las canaletas y bajantes se encuentren libres de escombros ante precipitaciones persistentes.',
          origen: 'institucional_verificada',
          fuente: 'Dirección Especial de Gestión Integral del Riesgo GAMLP',
          estado_publicacion: 'publicado',
        });

      expect(resPost.status).toBe(201);
      expect(resPost.body.ok).toBe(true);
      expect(resPost.body.recomendacion.nivel).toBe('ALERTA');
      expect(resPost.body.recomendacion.origen).toBe('institucional_verificada');
      expect(resPost.body.recomendacion.version).toBeGreaterThan(Number(prevRes.rows[0].version));

      const nuevaId = resPost.body.recomendacion.id;

      // Verificar que la versión previa se haya archivado
      const prevActualizada = await pool.query(
        'SELECT estado_publicacion FROM recomendaciones_preventivas WHERE id = $1;',
        [prevId]
      );
      expect(prevActualizada.rows[0].estado_publicacion).toBe('archivado');

      // Verificar registro en bitacora_cambios
      const bitacora = await pool.query(
        "SELECT accion, entidad, entidad_id, valor_nuevo FROM bitacora_cambios WHERE entidad = 'recomendaciones_preventivas' AND entidad_id = $1;",
        [nuevaId]
      );
      expect(bitacora.rows).toHaveLength(1);
      expect(bitacora.rows[0].accion).toBe('crear');
      expect(bitacora.rows[0].valor_nuevo.origen).toBe('institucional_verificada');
    });

    it('3.2. PUT /api/admin/recomendaciones/:id actualiza campos y registra valor_anterior y valor_nuevo en bitácora', async () => {
      // Obtener una recomendación existente
      const rec = await pool.query('SELECT id, titulo, contenido FROM recomendaciones_preventivas LIMIT 1;');
      const recId = rec.rows[0].id;

      const nuevoTitulo = 'Título Modificado de Prueba Test';
      const nuevoContenido = 'Contenido preventivo modificado para verificar auditoría en bitácora.';

      const resPut = await request(app)
        .put(`/api/admin/recomendaciones/${recId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          titulo: nuevoTitulo,
          contenido: nuevoContenido,
        });

      expect(resPut.status).toBe(200);
      expect(resPut.body.ok).toBe(true);
      expect(resPut.body.recomendacion.titulo).toBe(nuevoTitulo);

      // Verificar auditoría en bitacora_cambios
      const bitacora = await pool.query(
        "SELECT accion, entidad, entidad_id, valor_anterior, valor_nuevo FROM bitacora_cambios WHERE entidad = 'recomendaciones_preventivas' AND entidad_id = $1 AND accion = 'modificar' ORDER BY id DESC LIMIT 1;",
        [recId]
      );
      expect(bitacora.rows).toHaveLength(1);
      expect(bitacora.rows[0].valor_anterior.titulo).toBe(rec.rows[0].titulo);
      expect(bitacora.rows[0].valor_nuevo.titulo).toBe(nuevoTitulo);
    });
  });

  // =========================================================================
  // BLOQUE 4: Gestión de Contactos de Emergencia
  // =========================================================================
  describe('Bloque 4: Gestión de Contactos de Emergencia', () => {
    it('4.1. POST y PUT /api/admin/contactos crean y actualizan contactos con registro en bitácora', async () => {
      // 1. Crear nuevo contacto
      const resPost = await request(app)
        .post('/api/admin/contactos')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          nombre: 'Comité Barrial de Cuenca Test',
          telefono: '2-2410000',
          fuente: 'Subalcaldía Cotahuma Test',
          activo: true,
        });

      expect(resPost.status).toBe(201);
      expect(resPost.body.ok).toBe(true);
      const contactoId = resPost.body.contacto.id;

      // Verificar bitácora de creación
      const bitacoraCrear = await pool.query(
        "SELECT accion, entidad_id FROM bitacora_cambios WHERE entidad = 'contactos_emergencia' AND entidad_id = $1 AND accion = 'crear';",
        [contactoId]
      );
      expect(bitacoraCrear.rows).toHaveLength(1);

      // 2. Modificar contacto
      const resPut = await request(app)
        .put(`/api/admin/contactos/${contactoId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          telefono: '2-2429999',
          activo: false,
        });

      expect(resPut.status).toBe(200);
      expect(resPut.body.ok).toBe(true);
      expect(resPut.body.contacto.telefono).toBe('2-2429999');
      expect(resPut.body.contacto.activo).toBe(false);

      // Verificar bitácora de modificación
      const bitacoraMod = await pool.query(
        "SELECT accion, entidad_id, valor_anterior, valor_nuevo FROM bitacora_cambios WHERE entidad = 'contactos_emergencia' AND entidad_id = $1 AND accion = 'modificar';",
        [contactoId]
      );
      expect(bitacoraMod.rows).toHaveLength(1);
      expect(bitacoraMod.rows[0].valor_anterior.telefono).toBe('2-2410000');
      expect(bitacoraMod.rows[0].valor_nuevo.telefono).toBe('2-2429999');
    });
  });

  // =========================================================================
  // BLOQUE 5: Edición de Atributos de Capas y Puntos e Inmutabilidad Cartográfica
  // =========================================================================
  describe('Bloque 5: Edición de Atributos de Capas y Puntos e Inmutabilidad Cartográfica', () => {
    it('5.1. PUT /api/admin/zonas/:id actualiza atributos y salvaguarda inmutable la geometría GeoJSON en BD', async () => {
      // 1. Obtener la geometría JSONB original directamente de PostgreSQL
      const geoOriginalRes = await pool.query('SELECT id, nombre, geometria FROM zonas_referencia WHERE id = 1;');
      expect(geoOriginalRes.rows).toHaveLength(1);
      const geoOriginal = geoOriginalRes.rows[0].geometria;

      // 2. Intentar actualizar enviando un objeto geometria falso para comprobar que es ignorado
      const resPut = await request(app)
        .put('/api/admin/zonas/1')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          nombre: 'Sector Piloto Llojeta — Atributo Modificado Test',
          fuente: 'Cartografía Municipal Actualizada Test 2026',
          verificada: true,
          advertencia: 'referencia de demostración, no validada',
          geometria: {
            type: 'Point',
            coordinates: [0, 0], // Intento malicioso de alterar geometría
          },
        });

      expect(resPut.status).toBe(200);
      expect(resPut.body.ok).toBe(true);
      expect(resPut.body.zona.nombre).toBe('Sector Piloto Llojeta — Atributo Modificado Test');
      expect(resPut.body.zona.verificada).toBe(true);

      // 3. Comprobar que en la base de datos la geometría permanece 100% idéntica
      const geoBD = await pool.query('SELECT geometria FROM zonas_referencia WHERE id = 1;');
      expect(geoBD.rows[0].geometria).toEqual(geoOriginal);

      // 4. Verificar auditoría en bitácora
      const bitacora = await pool.query(
        "SELECT accion, entidad, entidad_id FROM bitacora_cambios WHERE entidad = 'zonas_referencia' AND entidad_id = 1 AND accion = 'modificar';"
      );
      expect(bitacora.rows.length).toBeGreaterThanOrEqual(1);
    });

    it('5.2. PUT /api/admin/puntos/:id actualiza atributos y salvaguarda inmutables latitud y longitud en BD', async () => {
      // 1. Obtener coordenadas originales
      const coordOriginalRes = await pool.query('SELECT id, nombre, latitud, longitud FROM puntos_referencia WHERE id = 1;');
      expect(coordOriginalRes.rows).toHaveLength(1);
      const latOriginal = Number(coordOriginalRes.rows[0].latitud);
      const lonOriginal = Number(coordOriginalRes.rows[0].longitud);

      // 2. Intentar modificar enviando latitud y longitud cambiadas
      const resPut = await request(app)
        .put('/api/admin/puntos/1')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          nombre: 'Cruce Av. Los Sargentos — Nombre Test Actualizado',
          tipo: 'hito_vial_referencial',
          fuente: 'Relevamiento Test',
          estado_verificacion: 'verificado_por_autoridad',
          activo: true,
          latitud: -10.000000, // Intento de cambiar latitud
          longitud: -50.000000, // Intento de cambiar longitud
        });

      expect(resPut.status).toBe(200);
      expect(resPut.body.ok).toBe(true);
      expect(resPut.body.punto.nombre).toBe('Cruce Av. Los Sargentos — Nombre Test Actualizado');
      expect(resPut.body.punto.estado_verificacion).toBe('verificado_por_autoridad');

      // 3. Comprobar en PostgreSQL que latitud y longitud siguen intactas
      const coordBD = await pool.query('SELECT latitud, longitud FROM puntos_referencia WHERE id = 1;');
      expect(Number(coordBD.rows[0].latitud)).toBeCloseTo(latOriginal, 5);
      expect(Number(coordBD.rows[0].longitud)).toBeCloseTo(lonOriginal, 5);

      // 4. Verificar auditoría en bitácora
      const bitacora = await pool.query(
        "SELECT accion, entidad, entidad_id FROM bitacora_cambios WHERE entidad = 'puntos_referencia' AND entidad_id = 1 AND accion = 'modificar';"
      );
      expect(bitacora.rows.length).toBeGreaterThanOrEqual(1);
    });
  });

  // =========================================================================
  // BLOQUE 6: Modo Demostración (P11) y Consulta de Bitácora de Cambios
  // =========================================================================
  describe('Bloque 6: Modo Demostración (P11) y Consulta de Bitácora de Cambios', () => {
    it('6.1. Inyección y limpieza de simulación administrativa auditan en bitácora y preservan intacto el estado real', async () => {
      // 1. Inyectar lectura simulada con nivel ALERTA
      const resSim = await request(app)
        .post('/api/admin/simulacion/lectura')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          intensidad_mm_h: 8.0,
          acum_24h_mm: 30.0,
          acum_72h_mm: 70.0,
        });

      expect(resSim.status).toBe(201);
      expect(resSim.body.ok).toBe(true);
      expect(resSim.body.evaluacion.nivel_calculado).toBe('ALERTA');

      // 2. Verificar que el estado público real permanece intacto
      const resReal = await request(app).get('/api/estado');
      expect(resReal.status).toBe(200);
      expect(resReal.body.modalidad).toBe('real');
      expect(resReal.body.es_simulacion).toBe(false);

      // 3. Verificar que se auditó en bitácora
      const bitacoraSim = await pool.query(
        "SELECT accion, entidad FROM bitacora_cambios WHERE entidad = 'simulacion' AND accion = 'simular' ORDER BY id DESC LIMIT 1;"
      );
      expect(bitacoraSim.rows).toHaveLength(1);

      // 4. Limpiar simulación administrativa
      const resLimpiar = await request(app)
        .delete('/api/admin/simulacion')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(resLimpiar.status).toBe(200);
      expect(resLimpiar.body.ok).toBe(true);

      // 5. Verificar bitácora de limpieza
      const bitacoraLimp = await pool.query(
        "SELECT accion, entidad FROM bitacora_cambios WHERE entidad = 'simulacion' AND accion = 'limpiar' ORDER BY id DESC LIMIT 1;"
      );
      expect(bitacoraLimp.rows).toHaveLength(1);
    });

    it('6.2. GET /api/admin/bitacora devuelve lista cronológica con autor, entidad, acción y filtrado por entidad', async () => {
      const resBitacora = await request(app)
        .get('/api/admin/bitacora')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(resBitacora.status).toBe(200);
      expect(resBitacora.body.ok).toBe(true);
      expect(Array.isArray(resBitacora.body.registros)).toBe(true);
      expect(resBitacora.body.total).toBeGreaterThanOrEqual(1);

      const primerRegistro = resBitacora.body.registros[0];
      expect(primerRegistro).toHaveProperty('id');
      expect(primerRegistro).toHaveProperty('usuario_email');
      expect(primerRegistro).toHaveProperty('entidad');
      expect(primerRegistro).toHaveProperty('entidad_id');
      expect(primerRegistro).toHaveProperty('accion');
      expect(primerRegistro).toHaveProperty('ocurrido_en');

      // Filtrado por entidad
      const resFiltrada = await request(app)
        .get('/api/admin/bitacora?entidad=configuraciones_reglas')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(resFiltrada.status).toBe(200);
      for (const reg of resFiltrada.body.registros) {
        expect(reg.entidad).toBe('configuraciones_reglas');
      }
    });
  });
});
