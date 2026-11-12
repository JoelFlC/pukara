/**
 * @file verificarApiDespliegue.js
 * @description Script de verificación de contratos HTTP en vivo (S4D1) para PUKARA.
 * Consulta la URL configurada en API_BASE_URL (o levanta una instancia efímera de app si el puerto
 * local no está escuchando) y verifica:
 *  1. GET /api/salud
 *  2. GET /api/estado
 *  3. GET /api/historial?limite=10
 *  4. POST /api/auth/login (credenciales válidas -> JWT)
 *  5. Control P07: rechazo 401 sin token en GET /api/admin/configuraciones
 *  6. GET /api/admin/configuraciones (con token válido -> 200)
 *  7. GET /api/admin/bitacora (con token válido -> 200)
 *  8. Ciclo completo de simulación aislada (POST /api/simulacion/lectura -> GET /api/estado?modalidad=simulada -> DELETE /api/simulacion)
 */

import { performance } from 'perf_hooks';
import { app } from '../app.js';
import { pool } from '../db/pool.js';
import { asegurarUsuarioAdministrador } from '../db/seedAdmin.js';

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@pukara.bo';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'PukaraAdmin2026!';

/**
 * Comprueba si un servidor HTTP ya responde en la URL base indicada.
 *
 * @param {string} urlBase
 * @returns {Promise<boolean>}
 */
async function servidorActivoEn(urlBase) {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 1500);
    const res = await fetch(`${urlBase}/api/salud`, { signal: controller.signal });
    clearTimeout(timer);
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Ejecuta una petición HTTP JSON midiendo latencia en milisegundos.
 *
 * @param {string} baseUrl
 * @param {string} ruta
 * @param {Object} [opciones={}]
 */
async function peticionJson(baseUrl, ruta, opciones = {}) {
  const t0 = performance.now();
  const headers = {
    Accept: 'application/json',
    ...(opciones.body ? { 'Content-Type': 'application/json' } : {}),
    ...(opciones.token ? { Authorization: `Bearer ${opciones.token}` } : {}),
  };

  const res = await fetch(`${baseUrl}${ruta}`, {
    method: opciones.method || 'GET',
    headers,
    body: opciones.body ? JSON.stringify(opciones.body) : undefined,
  });

  const ms = Math.round(performance.now() - t0);
  const data = await res.json();
  return { status: res.status, data, ms };
}

async function ejecutarVerificacion() {
  let baseUrl = (process.env.API_BASE_URL || 'http://127.0.0.1:3000').replace(/\/+$/, '');
  let servidorEfimero = null;

  const resultados = [];
  const registrarCheck = (id, endpoint, esperado, obtenido, ms, ok, detalle = '') => {
    resultados.push({
      id,
      estado: ok ? '[PASS]' : '[FAIL]',
      endpoint,
      esperado,
      obtenido,
      ms: `${ms} ms`,
      detalle,
    });
    if (!ok) {
      throw new Error(`Fallo en ${id} (${endpoint}): esperado ${esperado}, obtenido ${obtenido}. ${detalle}`);
    }
  };

  try {
    await asegurarUsuarioAdministrador({ client: pool });

    const yaEscuchando = await servidorActivoEn(baseUrl);
    if (!yaEscuchando) {
      servidorEfimero = await new Promise((resolve, reject) => {
        const srv = app.listen(0, '127.0.0.1', () => resolve(srv));
        srv.on('error', reject);
      });
      const address = servidorEfimero.address();
      baseUrl = `http://127.0.0.1:${address.port}`;
    }

    console.log('================================================================================');
    console.log(' PUKARA — Verificación Integral de Contratos HTTP (S4D1 - verify:api)');
    console.log(` URL Base Evaluada : ${baseUrl} ${servidorEfimero ? '(instancia efímera local)' : '(servidor activo)'}`);
    console.log(` Fecha/Hora UTC    : ${new Date().toISOString()}`);
    console.log('================================================================================\n');

    // 1. GET /api/salud
    const rSalud = await peticionJson(baseUrl, '/api/salud');
    registrarCheck(
      'CHK-01',
      'GET /api/salud',
      200,
      rSalud.status,
      rSalud.ms,
      rSalud.status === 200 && rSalud.data.estado === 'ok' && rSalud.data.base_de_datos === 'conectado',
      `BD=${rSalud.data.base_de_datos}`
    );

    // 2. GET /api/estado
    const rEstado = await peticionJson(baseUrl, '/api/estado');
    const estadoValido =
      rEstado.status === 200 &&
      rEstado.data.ok === true &&
      rEstado.data.version_esquema_api === 'v1' &&
      Array.isArray(rEstado.data.recomendaciones_publicadas) &&
      rEstado.data.recomendaciones_publicadas.length === 4 &&
      Array.isArray(rEstado.data.zonas_referencia) &&
      rEstado.data.zonas_referencia.length === 2 &&
      Array.isArray(rEstado.data.puntos_referencia) &&
      rEstado.data.puntos_referencia.length === 6;
    registrarCheck(
      'CHK-02',
      'GET /api/estado',
      200,
      rEstado.status,
      rEstado.ms,
      estadoValido,
      `Nivel=${rEstado.data.nivel_vigente}, Zonas=${rEstado.data.zonas_referencia?.length}, Puntos=${rEstado.data.puntos_referencia?.length}`
    );

    // 3. GET /api/historial
    const rHistorial = await peticionJson(baseUrl, '/api/historial?limite=10');
    registrarCheck(
      'CHK-03',
      'GET /api/historial?limite=10',
      200,
      rHistorial.status,
      rHistorial.ms,
      rHistorial.status === 200 && rHistorial.data.modalidad === 'real' && Array.isArray(rHistorial.data.items),
      `Total=${rHistorial.data.total}, Items=${rHistorial.data.items?.length}`
    );

    // 4. POST /api/auth/login
    const rLogin = await peticionJson(baseUrl, '/api/auth/login', {
      method: 'POST',
      body: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
    });
    const tokenAdmin = rLogin.data?.token;
    registrarCheck(
      'CHK-04',
      'POST /api/auth/login',
      200,
      rLogin.status,
      rLogin.ms,
      rLogin.status === 200 && Boolean(tokenAdmin) && rLogin.data.usuario?.rol === 'administrador',
      `Rol=${rLogin.data.usuario?.rol}`
    );

    // 5. Control P07: GET /api/admin/configuraciones sin token -> 401
    const rSinToken = await peticionJson(baseUrl, '/api/admin/configuraciones');
    registrarCheck(
      'CHK-05',
      'GET /api/admin/configuraciones (Sin JWT - P07)',
      401,
      rSinToken.status,
      rSinToken.ms,
      rSinToken.status === 401 && rSinToken.data?.error?.codigo === 'TOKEN_FALTANTE',
      `Código=${rSinToken.data?.error?.codigo}`
    );

    // 6. GET /api/admin/configuraciones con token válido -> 200
    const rConfigs = await peticionJson(baseUrl, '/api/admin/configuraciones', {
      token: tokenAdmin,
    });
    const listaVersiones = rConfigs.data?.versiones || rConfigs.data?.configuraciones;
    registrarCheck(
      'CHK-06',
      'GET /api/admin/configuraciones (Con JWT)',
      200,
      rConfigs.status,
      rConfigs.ms,
      rConfigs.status === 200 && rConfigs.data.ok === true && Array.isArray(listaVersiones),
      `Versiones=${listaVersiones?.length}`
    );

    // 7. GET /api/admin/bitacora con token válido -> 200
    const rBitacora = await peticionJson(baseUrl, '/api/admin/bitacora?limite=10', {
      token: tokenAdmin,
    });
    const listaBitacora = rBitacora.data?.registros || rBitacora.data?.items;
    registrarCheck(
      'CHK-07',
      'GET /api/admin/bitacora?limite=10',
      200,
      rBitacora.status,
      rBitacora.ms,
      rBitacora.status === 200 && rBitacora.data.ok === true && Array.isArray(listaBitacora),
      `Registros=${rBitacora.data.total}`
    );

    // 8. Ciclo de Simulación Aislada (P11 / P17) + Limpieza Final
    const rSimInyeccion = await peticionJson(baseUrl, '/api/simulacion/lectura', {
      method: 'POST',
      body: {
        intensidad_mm_h: 2.5,
        acum_24h_mm: 5.0,
        acum_72h_mm: 60.0,
        observado_en: '2026-03-12T10:00:00.000Z',
        reiniciar_antes: true,
      },
    });
    registrarCheck(
      'CHK-08',
      'POST /api/simulacion/lectura (P11/P17)',
      201,
      rSimInyeccion.status,
      rSimInyeccion.ms,
      rSimInyeccion.status === 201 &&
        rSimInyeccion.data.modalidad === 'simulada' &&
        rSimInyeccion.data.evaluacion?.nivel_vigente === 'ALERTA' &&
        rSimInyeccion.data.clasificacion?.regla_saturacion_aplicada === true,
      `NivelSim=${rSimInyeccion.data.evaluacion?.nivel_vigente}, Saturación=${rSimInyeccion.data.clasificacion?.regla_saturacion_aplicada}`
    );

    const rEstadoSim = await peticionJson(baseUrl, '/api/estado?modalidad=simulada');
    registrarCheck(
      'CHK-09',
      'GET /api/estado?modalidad=simulada',
      200,
      rEstadoSim.status,
      rEstadoSim.ms,
      rEstadoSim.status === 200 &&
        rEstadoSim.data.es_simulacion === true &&
        rEstadoSim.data.nivel_vigente === 'ALERTA',
      `Modalidad=${rEstadoSim.data.modalidad}, Nivel=${rEstadoSim.data.nivel_vigente}`
    );

    const rSimLimpieza = await peticionJson(baseUrl, '/api/simulacion', {
      method: 'DELETE',
    });
    registrarCheck(
      'CHK-10',
      'DELETE /api/simulacion (Limpieza final)',
      200,
      rSimLimpieza.status,
      rSimLimpieza.ms,
      rSimLimpieza.status === 200 && rSimLimpieza.data.ok === true,
      `Eliminadas=${rSimLimpieza.data.lecturas_eliminadas}`
    );

    // Impresión de tabla resumen
    console.log('ID      | Estado | Endpoint                                      | HTTP | Latencia | Detalle');
    console.log('--------+--------+-----------------------------------------------+------+----------+--------------------------------');
    for (const fila of resultados) {
      console.log(
        `${fila.id.padEnd(7)} | ${fila.estado} | ${fila.endpoint.padEnd(45)} | ${String(fila.obtenido).padEnd(4)} | ${fila.ms.padEnd(8)} | ${fila.detalle}`
      );
    }
    console.log('--------------------------------------------------------------------------------------------------------------------');
    console.log(`Resultado Global: ${resultados.length}/${resultados.length} verificaciones superadas con [PASS].\n`);
  } finally {
    if (servidorEfimero) {
      await new Promise((resolve) => servidorEfimero.close(resolve));
    }
    await pool.end();
  }
}

ejecutarVerificacion().catch((err) => {
  console.error(`\n[FAIL] Error en verificación de API: ${err.message}`);
  process.exit(1);
});

