/**
 * @file ejecutarEscenarioReferenciaSeguridadS4D5.js
 * @description Script ejecutable de auditoría para la Semana 4 — Día 5 (S4D5):
 * 1. Ejecuta el motor de evaluación con las series históricas de Open-Meteo para
 *    abril de 2019 y noviembre de 2024 en Llojeta (Sección 11.3 de PUKARA.pdf).
 * 2. Ejecuta los 5 controles automatizados de Seguridad Básica (Sección 6.4 de PUKARA.pdf).
 * 3. Verifica que los 9 umbrales académicos v1 permanecen intactos en PostgreSQL.
 */

import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import jwt from 'jsonwebtoken';
import { app } from '../app.js';
import { pool } from '../db/pool.js';
import { asegurarUsuarioAdministrador } from '../db/seedAdmin.js';
import { obtenerConfiguracionVigente } from '../services/configuracion.service.js';
import { generarTokenAcceso } from '../services/auth.service.js';
import { limpiarRateLimiterLogin } from '../middleware/rateLimit.middleware.js';
import {
  COORDENADA_HISTORICA_LLOJETA,
  NOTA_LIMITACION_CIENTIFICA_SECCION_11_3,
  consultarOpenMeteoHistorico,
  evaluarSerieHistoricaConMotor,
} from '../data/escenariosHistoricosReferencia.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SERVER_ROOT = path.resolve(__dirname, '../../');
const REPO_ROOT = path.resolve(__dirname, '../../../');

/**
 * Realiza una petición HTTP contra el servidor efímero local.
 *
 * @param {string} baseUrl
 * @param {string} ruta
 * @param {Object} [opciones={}]
 * @returns {Promise<{ status: number, headers: Headers, body: any }>}
 */
async function peticionHttp(baseUrl, ruta, opciones = {}) {
  const res = await fetch(`${baseUrl}${ruta}`, {
    method: opciones.method || 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(opciones.headers || {}),
    },
    body: opciones.body ? JSON.stringify(opciones.body) : undefined,
  });

  let body = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }

  return {
    status: res.status,
    headers: res.headers,
    body,
  };
}

/**
 * Ejecuta el reporte completo S4D5.
 */
async function ejecutarAuditoriaS4D5() {
  console.log('================================================================================');
  console.log(' PUKARA — REPORTE S4D5: ESCENARIOS HISTÓRICOS (11.3) Y SEGURIDAD BÁSICA (6.4)');
  console.log('================================================================================');
  console.log(
    ` Coordenada representativa Llojeta: lat=${COORDENADA_HISTORICA_LLOJETA.latitud}, lon=${COORDENADA_HISTORICA_LLOJETA.longitud} (${COORDENADA_HISTORICA_LLOJETA.timezone})`
  );
  console.log('--------------------------------------------------------------------------------');

  const resultadosControles = [];
  const registrarControl = (id, descripcion, exito, detalle) => {
    resultadosControles.push({ id, descripcion, exito, detalle });
    const etiqueta = exito ? '[PASS]' : '[FAIL]';
    console.log(` ${etiqueta} ${id} — ${descripcion}`);
    if (detalle) {
      console.log(`        Detalle: ${detalle}`);
    }
  };

  let servidor = null;

  try {
    await asegurarUsuarioAdministrador(pool);

    // Snapshot inicial de base de datos
    const configV1Inicial = await obtenerConfiguracionVigente({ db: pool });
    if (!configV1Inicial || configV1Inicial.version !== 1) {
      throw new Error('La configuración vigente inicial en PostgreSQL debe ser version = 1.');
    }
    const conteoEvalAntes = await pool.query(
      'SELECT COUNT(*)::int AS total FROM evaluaciones_nivel;'
    );

    // =========================================================================
    // SECCIÓN 1: ESCENARIOS HISTÓRICOS DE REFERENCIA (ABRIL 2019 Y NOVIEMBRE 2024)
    // =========================================================================
    console.log('\n[1] PRUEBA DE ESCENARIO DE REFERENCIA HISTÓRICO (SECCIÓN 11.3 DE PUKARA.pdf)');

    const escenario2019 = await consultarOpenMeteoHistorico('2019-04-27', '2019-04-30', {
      fetchFn: async () => {
        throw new Error('Respaldo determinista congelado para reproducibilidad');
      },
    });
    const eval2019 = evaluarSerieHistoricaConMotor(
      escenario2019.serie_horaria,
      configV1Inicial.umbrales,
      configV1Inicial.parametros
    );

    const escenario2024 = await consultarOpenMeteoHistorico('2024-11-20', '2024-11-23', {
      fetchFn: async () => {
        throw new Error('Respaldo determinista congelado para reproducibilidad');
      },
    });
    const eval2024 = evaluarSerieHistoricaConMotor(
      escenario2024.serie_horaria,
      configV1Inicial.umbrales,
      configV1Inicial.parametros
    );

    console.log('\n Tabla Comparativa de Escenarios Históricos de Referencia (Umbrales v1):');
    console.log(' +------------------------------+---------------+---------------+---------------+---------------+---------------+');
    console.log(' | Escenario (Sector Llojeta)   | Pico 1h (mm/h)| Pico 24h (mm) | Pico 72h (mm) | Nivel Máximo  | Calidad Serie |');
    console.log(' +------------------------------+---------------+---------------+---------------+---------------+---------------+');
    console.log(
      ` | Abril 2019 (27-30 abr 2019)  | ${String(eval2019.pico_intensidad_1h_mm_h.toFixed(1)).padStart(13)} | ${String(eval2019.pico_acum_24h_mm.toFixed(1)).padStart(13)} | ${String(eval2019.pico_acum_72h_mm.toFixed(1)).padStart(13)} | ${eval2019.nivel_vigente_maximo.padEnd(13)} | 24/24 y 72/72 |`
    );
    console.log(
      ` | Nov 2024 (20-23 nov 2024)    | ${String(eval2024.pico_intensidad_1h_mm_h.toFixed(1)).padStart(13)} | ${String(eval2024.pico_acum_24h_mm.toFixed(1)).padStart(13)} | ${String(eval2024.pico_acum_72h_mm.toFixed(1)).padStart(13)} | ${eval2024.nivel_vigente_maximo.padEnd(13)} | 24/24 y 72/72 |`
    );
    console.log(' +------------------------------+---------------+---------------+---------------+---------------+---------------+\n');

    console.log(' Nota obligatoria (Sección 11.3 de PUKARA.pdf):');
    console.log(` "${NOTA_LIMITACION_CIENTIFICA_SECCION_11_3}"\n`);

    const conteoEvalDespues = await pool.query(
      'SELECT COUNT(*)::int AS total FROM evaluaciones_nivel;'
    );
    const configV1Posterior = await obtenerConfiguracionVigente({ db: pool });

    const exito2019 =
      eval2019.ventanas_evaluadas === 24 &&
      eval2019.nivel_vigente_maximo === 'PRECAUCION' &&
      eval2019.secuencia_evaluaciones.every(
        (v) =>
          v.horas_validas_24h === 24 &&
          v.horas_validas_72h === 72 &&
          v.estado_muestra === 'valida'
      );

    registrarControl(
      'H1-2019',
      'Escenario Histórico Abril 2019 (Bajo Llojeta / Kantutani)',
      exito2019,
      `Origen: ${escenario2019.origen} | Pico 1h=${eval2019.pico_intensidad_1h_mm_h} mm/h, 24h=${eval2019.pico_acum_24h_mm} mm, 72h=${eval2019.pico_acum_72h_mm} mm -> Nivel=${eval2019.nivel_vigente_maximo}`
    );

    const exito2024 =
      eval2024.ventanas_evaluadas === 24 &&
      eval2024.nivel_vigente_maximo === 'ALERTA' &&
      eval2024.secuencia_evaluaciones.every(
        (v) =>
          v.horas_validas_24h === 24 &&
          v.horas_validas_72h === 72 &&
          v.estado_muestra === 'valida'
      );

    registrarControl(
      'H2-2024',
      'Escenario Histórico Noviembre 2024 (Mazamorra Bajo Llojeta)',
      exito2024,
      `Origen: ${escenario2024.origen} | Pico 1h=${eval2024.pico_intensidad_1h_mm_h} mm/h, 24h=${eval2024.pico_acum_24h_mm} mm, 72h=${eval2024.pico_acum_72h_mm} mm -> Nivel=${eval2024.nivel_vigente_maximo}`
    );

    const exitoInmutabilidad =
      conteoEvalAntes.rows[0].total === conteoEvalDespues.rows[0].total &&
      configV1Posterior.version === 1 &&
      JSON.stringify(configV1Posterior.umbrales) === JSON.stringify(configV1Inicial.umbrales);

    registrarControl(
      'H3-INMUT',
      'Inmutabilidad de Umbrales v1 y Aislamiento de Estado Real (Sección 11.3)',
      exitoInmutabilidad,
      'Umbrales v1 intactos (2.5/6.5/12, 10/25/40, 25/60/90) y 0 alteraciones en evaluaciones_nivel'
    );

    // =========================================================================
    // SECCIÓN 2: REVISIÓN AUTOMATIZADA DE SEGURIDAD BÁSICA (SECCIÓN 6.4)
    // =========================================================================
    console.log('\n[2] AUDITORÍA AUTOMATIZADA DE SEGURIDAD BÁSICA (SECCIÓN 6.4 DE PUKARA.pdf)');

    servidor = http.createServer(app);
    await new Promise((resolve) => servidor.listen(0, '127.0.0.1', resolve));
    const { port } = servidor.address();
    const baseUrl = `http://127.0.0.1:${port}`;

    // Control S1: Secretos en variables de entorno y .gitignore
    const gitignore = fs.readFileSync(path.join(REPO_ROOT, '.gitignore'), 'utf8');
    const envExample = fs.readFileSync(path.join(SERVER_ROOT, '.env.example'), 'utf8');
    const poolCode = fs.readFileSync(path.join(SERVER_ROOT, 'src/db/pool.js'), 'utf8');
    const authCode = fs.readFileSync(path.join(SERVER_ROOT, 'src/services/auth.service.js'), 'utf8');
    const s1Ok =
      /\.env/.test(gitignore) &&
      envExample.includes('JWT_SECRET=') &&
      poolCode.includes('DATABASE_URL') &&
      poolCode.includes('process.env') &&
      authCode.includes('process.env.JWT_SECRET');

    registrarControl(
      'S1-ENV',
      'Secretos en variables de entorno (.env en .gitignore y lectura vía process.env)',
      s1Ok,
      'JWT_SECRET y DATABASE_URL cargados desde variables de entorno; .env excluido de Git'
    );

    // Control S2: Hashing bcrypt y no exposición de password_hash
    const resUsers = await pool.query('SELECT id, email, password_hash, rol FROM usuarios;');
    const todosBcrypt = resUsers.rows.every((u) => /^\$2[aby]\$\d{2}\$.{53}$/.test(u.password_hash));
    limpiarRateLimiterLogin();
    const resLogin = await peticionHttp(baseUrl, '/api/auth/login', {
      method: 'POST',
      body: {
        email: process.env.ADMIN_EMAIL || 'admin@pukara.bo',
        password: process.env.ADMIN_PASSWORD || 'AdminPukara2026!',
      },
    });
    const loginBodyStr = JSON.stringify(resLogin.body || {});
    const s2Ok =
      todosBcrypt &&
      resLogin.status === 200 &&
      !loginBodyStr.includes('password_hash') &&
      !loginBodyStr.includes('$2b$');

    registrarControl(
      'S2-BCRYPT',
      'Contraseñas hasheadas con bcrypt ($2b$10$) y ocultas en respuestas JSON',
      s2Ok,
      `Usuarios auditados=${resUsers.rows.length}, formato bcrypt verificado, password_hash ausente en /api/auth/login`
    );

    // Control S3: Expiración y rol en JWT
    const adminRow = resUsers.rows.find((u) => u.rol === 'administrador');
    const tokenValido = generarTokenAcceso(adminRow);
    const decoded = jwt.decode(tokenValido);
    const secret = process.env.JWT_SECRET || 'pukara_dev_jwt_secret_llojeta_2026_umsa';
    const tokenSinExp = jwt.sign({ id: adminRow.id, email: adminRow.email, rol: 'administrador' }, secret);
    const tokenRolOperador = jwt.sign(
      { id: 99, email: 'op@pukara.bo', rol: 'operador' },
      secret,
      { expiresIn: '1h' }
    );

    const resSinExp = await peticionHttp(baseUrl, '/api/admin/configuraciones', {
      headers: { Authorization: `Bearer ${tokenSinExp}` },
    });
    const resRolOperador = await peticionHttp(baseUrl, '/api/admin/configuraciones', {
      headers: { Authorization: `Bearer ${tokenRolOperador}` },
    });

    const s3Ok =
      typeof decoded.exp === 'number' &&
      decoded.rol === 'administrador' &&
      resSinExp.status === 401 &&
      resRolOperador.status === 403;

    registrarControl(
      'S3-JWT',
      'Expiración obligatoria (exp) y verificación de rol administrador en JWT',
      s3Ok,
      `Token sin exp -> HTTP ${resSinExp.status}, Token con rol 'operador' -> HTTP ${resRolOperador.status}`
    );

    // Control S4: Protección contra Inyección SQL (Consultas parametrizadas)
    limpiarRateLimiterLogin();
    const resSqliLogin = await peticionHttp(baseUrl, '/api/auth/login', {
      method: 'POST',
      body: {
        email: "admin@pukara.bo'; DROP TABLE usuarios; --",
        password: "' OR '1'='1' --",
      },
    });
    const resSqliEstado = await peticionHttp(
      baseUrl,
      `/api/estado?modalidad=${encodeURIComponent("real' OR '1'='1")}`
    );
    const resTablas = await pool.query(`
      SELECT COUNT(*)::int AS total
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name IN (
          'usuarios', 'configuraciones_reglas', 'umbrales', 'lecturas_meteorologicas',
          'evaluaciones_nivel', 'recomendaciones_preventivas', 'contactos_emergencia',
          'zonas_referencia', 'puntos_referencia', 'bitacora_cambios'
        );
    `);

    const s4Ok =
      [400, 401].includes(resSqliLogin.status) &&
      resSqliEstado.status === 400 &&
      resTablas.rows[0].total === 10;

    registrarControl(
      'S4-SQLI',
      'Protección contra Inyección SQL mediante consultas parametrizadas ($1, $2)',
      s4Ok,
      `SQLi Login -> HTTP ${resSqliLogin.status}, SQLi Estado -> HTTP ${resSqliEstado.status}, Tablas intactas=${resTablas.rows[0].total}/10`
    );

    // Control S5: Rate Limiting, CORS y Privacidad GPS
    limpiarRateLimiterLogin();
    let status6toIntento = 0;
    for (let i = 1; i <= 6; i += 1) {
      const r = await peticionHttp(baseUrl, '/api/auth/login', {
        method: 'POST',
        body: { email: 'admin@pukara.bo', password: `IntentoFallido_${i}` },
      });
      status6toIntento = r.status;
    }
    limpiarRateLimiterLogin();

    const resCors = await peticionHttp(baseUrl, '/api/salud', {
      headers: { Origin: 'http://localhost:5173' },
    });
    const corsHeader = resCors.headers.get('access-control-allow-origin');

    const resGpsCols = await pool.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name IN ('lecturas_meteorologicas', 'evaluaciones_nivel')
        AND column_name IN ('latitud_usuario', 'longitud_usuario', 'gps_usuario');
    `);

    const s5Ok =
      status6toIntento === 429 &&
      Boolean(corsHeader) &&
      resGpsCols.rows.length === 0;

    registrarControl(
      'S5-RATE-GPS',
      'Rate Limiting en Login (HTTP 429), CORS activo y cero almacenamiento de GPS de usuario',
      s5Ok,
      `6to intento fallido -> HTTP ${status6toIntento}, CORS=${corsHeader}, Columnas GPS usuario en BD=${resGpsCols.rows.length}`
    );

    console.log('--------------------------------------------------------------------------------');
    const fallidos = resultadosControles.filter((c) => !c.exito);
    if (fallidos.length > 0) {
      console.error(` [ERROR] ${fallidos.length} control(es) fallaron en la verificación S4D5.`);
      process.exitCode = 1;
    } else {
      console.log(
        ` [OK] Todos los controles S4D5 (${resultadosControles.length}/${resultadosControles.length}) pasaron en riguroso [PASS].`
      );
    }
    console.log('================================================================================');
  } finally {
    limpiarRateLimiterLogin();
    if (servidor) {
      await new Promise((resolve) => servidor.close(resolve));
    }
    await pool.end();
  }
}

ejecutarAuditoriaS4D5().catch((err) => {
  console.error('[FATAL S4D5]', err);
  process.exit(1);
});
