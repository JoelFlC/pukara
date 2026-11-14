/**
 * @file escenarioHistoricoSeguridad.s4d5.test.js
 * @description Suite de integración para la Semana 4 — Día 5 (S4D5):
 * - Bloque 1: Prueba de escenario de referencia histórico (Abril 2019 y Noviembre 2024 en Llojeta — Sección 11.3 de PUKARA.pdf).
 * - Bloque 2: Auditoría automatizada de seguridad básica (Secretos, bcrypt, JWT exp/rol, SQLi y Rate Limiting/CORS/Privacidad GPS — Sección 6.4 de PUKARA.pdf).
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { app } from '../../src/app.js';
import { pool } from '../../src/db/pool.js';
import { asegurarUsuarioAdministrador } from '../../src/db/seedAdmin.js';
import { obtenerConfiguracionVigente } from '../../src/services/configuracion.service.js';
import { generarTokenAcceso } from '../../src/services/auth.service.js';
import { limpiarRateLimiterLogin } from '../../src/middleware/rateLimit.middleware.js';
import {
  COORDENADA_HISTORICA_LLOJETA,
  NOTA_LIMITACION_CIENTIFICA_SECCION_11_3,
  consultarOpenMeteoHistorico,
  evaluarSerieHistoricaConMotor,
} from '../../src/data/escenariosHistoricosReferencia.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '../../../');
const SERVER_ROOT = path.resolve(__dirname, '../../');

const TABLAS_INMUTABLES_PUKARA = [
  'usuarios',
  'configuraciones_reglas',
  'umbrales',
  'lecturas_meteorologicas',
  'evaluaciones_nivel',
  'recomendaciones_preventivas',
  'contactos_emergencia',
  'zonas_referencia',
  'puntos_referencia',
  'bitacora_cambios',
];

/**
 * Recorre recursivamente un directorio devolviendo rutas de archivos `.js`.
 *
 * @param {string} dirPath
 * @returns {string[]}
 */
function listarArchivosJsRecursivo(dirPath) {
  if (!fs.existsSync(dirPath)) return [];
  const entradas = fs.readdirSync(dirPath, { withFileTypes: true });
  const archivos = [];
  for (const entrada of entradas) {
    const rutaCompleta = path.join(dirPath, entrada.name);
    if (entrada.isDirectory()) {
      archivos.push(...listarArchivosJsRecursivo(rutaCompleta));
    } else if (entrada.isFile() && entrada.name.endsWith('.js')) {
      archivos.push(rutaCompleta);
    }
  }
  return archivos;
}

describe('S4D5 — Escenario de Referencia Histórico (Sección 11.3) y Revisión de Seguridad Básica (Sección 6.4)', () => {
  let tokenAdminValido = '';
  let adminUsuario = null;

  beforeAll(async () => {
    await asegurarUsuarioAdministrador(pool);
    const resUser = await pool.query(
      "SELECT id, email, nombre, rol FROM usuarios WHERE rol = 'administrador' ORDER BY id ASC LIMIT 1;"
    );
    adminUsuario = resUser.rows[0];
    tokenAdminValido = generarTokenAcceso(adminUsuario);
  });

  beforeEach(() => {
    limpiarRateLimiterLogin();
  });

  afterAll(async () => {
    limpiarRateLimiterLogin();
    await pool.query(`
      DELETE FROM evaluaciones_nivel
      WHERE lectura_id IN (
        SELECT id FROM lecturas_meteorologicas WHERE modalidad = 'simulada'
      );
    `);
    await pool.query("DELETE FROM lecturas_meteorologicas WHERE modalidad = 'simulada';");
  });

  // =========================================================================
  // BLOQUE 1: PRUEBA DE ESCENARIO DE REFERENCIA HISTÓRICO (SECCIÓN 11.3)
  // =========================================================================
  describe('Bloque 1: Prueba de Escenario de Referencia Histórico (Abril 2019 y Noviembre 2024 — Sección 11.3)', () => {
    it('Verifica la coordenada representativa de Llojeta (-16.5235, -68.1425) y la nota de limitación científica (Sección 11.3)', () => {
      expect(COORDENADA_HISTORICA_LLOJETA.latitud).toBeCloseTo(-16.5235, 4);
      expect(COORDENADA_HISTORICA_LLOJETA.longitud).toBeCloseTo(-68.1425, 4);
      expect(COORDENADA_HISTORICA_LLOJETA.timezone).toBe('America/La_Paz');
      expect(NOTA_LIMITACION_CIENTIFICA_SECCION_11_3).toContain(
        'Prueba de escenario de referencia histórico (Sección 11.3)'
      );
      expect(NOTA_LIMITACION_CIENTIFICA_SECCION_11_3).toContain(
        'No se afirma validación meteorológica ni coincidencia con la gravedad real'
      );
      expect(NOTA_LIMITACION_CIENTIFICA_SECCION_11_3).toContain(
        'NO se utilizan para ajustar ni recalibrar los umbrales académicos v1'
      );
    });

    it('Prueba 1A (Abril 2019 — Deslizamiento Bajo Llojeta / Kantutani): evalúa serie de 96h con umbrales v1 de PostgreSQL sin alterar evaluaciones reales ni umbrales', async () => {
      // Snapshot del estado previo en base de datos para certificar aislamiento e inmutabilidad
      const conteoEvalAntes = await pool.query(
        'SELECT COUNT(*)::int AS total, COALESCE(MAX(id), 0)::int AS max_id FROM evaluaciones_nivel;'
      );
      const configV1Antes = await obtenerConfiguracionVigente({ db: pool });
      expect(configV1Antes).not.toBeNull();
      expect(configV1Antes.version).toBe(1);
      expect(configV1Antes.umbrales).toHaveLength(9);

      // Consultar serie histórica (con respaldo determinista offline si no hay red en sandbox)
      const escenario2019 = await consultarOpenMeteoHistorico(
        '2019-04-27',
        '2019-04-30',
        { fetchFn: async () => { throw new Error('Offline determinista en suite test'); } }
      );

      expect(escenario2019.escenario_id).toBe('abril_2019_bajo_llojeta_kantutani');
      expect(escenario2019.serie_horaria.tiempos_utc).toHaveLength(96);
      expect(escenario2019.serie_horaria.precipitacion_mm).toHaveLength(96);

      const resultado2019 = evaluarSerieHistoricaConMotor(
        escenario2019.serie_horaria,
        configV1Antes.umbrales,
        configV1Antes.parametros
      );

      // Verificar que las 24 ventanas del día crítico (2019-04-30) tienen series completas (24/24 y 72/72)
      expect(resultado2019.ventanas_evaluadas).toBe(24);
      expect(resultado2019.secuencia_evaluaciones).toHaveLength(24);
      for (const ventana of resultado2019.secuencia_evaluaciones) {
        expect(ventana.horas_validas_24h).toBe(24);
        expect(ventana.horas_validas_72h).toBe(72);
        expect(ventana.estado_muestra).toBe('valida');
        expect(['NORMAL', 'PRECAUCION', 'ALERTA', 'EMERGENCIA']).toContain(
          ventana.nivel_calculado
        );
        expect(['NORMAL', 'PRECAUCION', 'ALERTA', 'EMERGENCIA']).toContain(
          ventana.nivel_vigente
        );
      }

      // Verificar picos y nivel resultante con umbrales académicos v1 (2.5/6.5/12, 10/25/40, 25/60/90)
      expect(resultado2019.pico_intensidad_1h_mm_h).toBeGreaterThanOrEqual(2.5);
      expect(resultado2019.pico_acum_72h_mm).toBeGreaterThanOrEqual(25.0);
      expect(resultado2019.nivel_calculado_maximo).toBe('PRECAUCION');
      expect(resultado2019.nivel_vigente_maximo).toBe('PRECAUCION');
      expect(resultado2019.umbrales_modificados).toBe(false);

      // Confirmar que la evaluación histórica NO alteró evaluaciones_nivel ni umbrales v1
      const conteoEvalDespues = await pool.query(
        'SELECT COUNT(*)::int AS total, COALESCE(MAX(id), 0)::int AS max_id FROM evaluaciones_nivel;'
      );
      expect(conteoEvalDespues.rows[0]).toEqual(conteoEvalAntes.rows[0]);

      const configV1Despues = await obtenerConfiguracionVigente({ db: pool });
      expect(configV1Despues.version).toBe(1);
      expect(configV1Despues.umbrales).toEqual(configV1Antes.umbrales);
    });

    it('Prueba 1B (Noviembre 2024 — Mazamorra Bajo Llojeta): evalúa serie de 96h con umbrales v1 de PostgreSQL alcanzando ALERTA sin alterar estado real ni umbrales', async () => {
      const conteoEvalAntes = await pool.query(
        'SELECT COUNT(*)::int AS total, COALESCE(MAX(id), 0)::int AS max_id FROM evaluaciones_nivel;'
      );
      const configV1Antes = await obtenerConfiguracionVigente({ db: pool });
      expect(configV1Antes).not.toBeNull();
      expect(configV1Antes.version).toBe(1);

      const escenario2024 = await consultarOpenMeteoHistorico(
        '2024-11-20',
        '2024-11-23',
        { fetchFn: async () => { throw new Error('Offline determinista en suite test'); } }
      );

      expect(escenario2024.escenario_id).toBe('noviembre_2024_bajo_llojeta_mazamorra');
      expect(escenario2024.serie_horaria.tiempos_utc).toHaveLength(96);
      expect(escenario2024.serie_horaria.precipitacion_mm).toHaveLength(96);

      const resultado2024 = evaluarSerieHistoricaConMotor(
        escenario2024.serie_horaria,
        configV1Antes.umbrales,
        configV1Antes.parametros
      );

      expect(resultado2024.ventanas_evaluadas).toBe(24);
      expect(resultado2024.secuencia_evaluaciones).toHaveLength(24);
      for (const ventana of resultado2024.secuencia_evaluaciones) {
        expect(ventana.horas_validas_24h).toBe(24);
        expect(ventana.horas_validas_72h).toBe(72);
        expect(ventana.estado_muestra).toBe('valida');
      }

      // En noviembre 2024, la serie alcanza pico horario >= 6.5 mm/h y acum_24h >= 25.0 mm -> ALERTA
      expect(resultado2024.pico_intensidad_1h_mm_h).toBeGreaterThanOrEqual(6.5);
      expect(resultado2024.pico_acum_24h_mm).toBeGreaterThanOrEqual(25.0);
      expect(resultado2024.nivel_calculado_maximo).toBe('ALERTA');
      expect(resultado2024.nivel_vigente_maximo).toBe('ALERTA');

      // Verificar también transición e histéresis de descenso (2 muestras consecutivas para bajar de ALERTA a PRECAUCION)
      const nivelesVigentes = resultado2024.secuencia_evaluaciones.map((v) => v.nivel_vigente);
      expect(nivelesVigentes).toContain('ALERTA');
      expect(nivelesVigentes).toContain('PRECAUCION');

      // Confirmar que ni 2019 ni 2024 alteraron evaluaciones_nivel ni ajustaron los 9 umbrales v1
      const conteoEvalDespues = await pool.query(
        'SELECT COUNT(*)::int AS total, COALESCE(MAX(id), 0)::int AS max_id FROM evaluaciones_nivel;'
      );
      expect(conteoEvalDespues.rows[0]).toEqual(conteoEvalAntes.rows[0]);

      const configV1Despues = await obtenerConfiguracionVigente({ db: pool });
      expect(configV1Despues.version).toBe(1);
      expect(configV1Despues.umbrales).toEqual([
        { variable: 'acum_24h_mm', nivel: 'PRECAUCION', valor: 10 },
        { variable: 'acum_24h_mm', nivel: 'ALERTA', valor: 25 },
        { variable: 'acum_24h_mm', nivel: 'EMERGENCIA', valor: 40 },
        { variable: 'acum_72h_mm', nivel: 'PRECAUCION', valor: 25 },
        { variable: 'acum_72h_mm', nivel: 'ALERTA', valor: 60 },
        { variable: 'acum_72h_mm', nivel: 'EMERGENCIA', valor: 90 },
        { variable: 'intensidad_mm_h', nivel: 'PRECAUCION', valor: 2.5 },
        { variable: 'intensidad_mm_h', nivel: 'ALERTA', valor: 6.5 },
        { variable: 'intensidad_mm_h', nivel: 'EMERGENCIA', valor: 12 },
      ]);
    });
  });

  // =========================================================================
  // BLOQUE 2: AUDITORÍA AUTOMATIZADA DE SEGURIDAD BÁSICA (SECCIÓN 6.4)
  // =========================================================================
  describe('Bloque 2: Auditoría Automatizada de Seguridad Básica (Sección 6.4 de PUKARA.pdf)', () => {
    it('Control S1 (Secretos y Variables de Entorno): verifica .gitignore, .env.example y ausencia de credenciales de producción hardcodeadas', () => {
      // 1. Verificar que .gitignore excluye archivos .env
      const rutaGitignore = path.join(REPO_ROOT, '.gitignore');
      expect(fs.existsSync(rutaGitignore)).toBe(true);
      const contenidoGitignore = fs.readFileSync(rutaGitignore, 'utf8');
      expect(contenidoGitignore).toMatch(/\.env/);

      // 2. Verificar que server/.env.example existe y contiene solo plantillas de ejemplo
      const rutaEnvExample = path.join(SERVER_ROOT, '.env.example');
      expect(fs.existsSync(rutaEnvExample)).toBe(true);
      const contenidoEnvExample = fs.readFileSync(rutaEnvExample, 'utf8');
      expect(contenidoEnvExample).toContain('JWT_SECRET=');
      expect(contenidoEnvExample).toContain('DATABASE_URL=');

      // 3. Verificar que db/pool.js y services/auth.service.js leen de process.env
      const codigoPool = fs.readFileSync(
        path.join(SERVER_ROOT, 'src/db/pool.js'),
        'utf8'
      );
      const codigoAuth = fs.readFileSync(
        path.join(SERVER_ROOT, 'src/services/auth.service.js'),
        'utf8'
      );
      expect(codigoPool).toContain('DATABASE_URL');
      expect(codigoPool).toContain('process.env');
      expect(codigoAuth).toContain('process.env.JWT_SECRET');

      // 4. Escaneo estático en server/src/ para descartar tokens reales o claves privadas embebidas
      const archivosSrc = listarArchivosJsRecursivo(path.join(SERVER_ROOT, 'src'));
      expect(archivosSrc.length).toBeGreaterThan(10);
      for (const archivo of archivosSrc) {
        const codigo = fs.readFileSync(archivo, 'utf8');
        expect(codigo).not.toContain('-----BEGIN RSA PRIVATE KEY-----');
        expect(codigo).not.toContain('-----BEGIN PRIVATE KEY-----');
        expect(codigo).not.toMatch(/sk_live_[0-9a-zA-Z]{16,}/);
      }
    });

    it('Control S2 (Hashing de Contraseñas con bcrypt y No Exposición): verifica hash $2b$/$2a$ en BD y ausencia total de password_hash en respuestas HTTP', async () => {
      // 1. Verificar formato bcrypt en la tabla usuarios
      const resUsuarios = await pool.query(
        'SELECT id, email, password_hash, rol FROM usuarios;'
      );
      expect(resUsuarios.rows.length).toBeGreaterThanOrEqual(1);

      for (const u of resUsuarios.rows) {
        expect(u.password_hash).toMatch(/^\$2[aby]\$\d{2}\$.{53}$/);
        expect(u.password_hash).not.toBe('AdminPukara2026!');
      }

      // 2. Verificar que POST /api/auth/login jamás incluye password_hash ni password
      const emailAdmin = process.env.ADMIN_EMAIL || 'admin@pukara.bo';
      const passwordAdmin = process.env.ADMIN_PASSWORD || 'AdminPukara2026!';
      const resLogin = await request(app)
        .post('/api/auth/login')
        .send({ email: emailAdmin, password: passwordAdmin });

      expect(resLogin.status).toBe(200);
      expect(resLogin.body.usuario).toBeDefined();
      expect(resLogin.body.usuario.password_hash).toBeUndefined();
      expect(resLogin.body.usuario.password).toBeUndefined();
      expect(JSON.stringify(resLogin.body)).not.toContain('$2b$');
      expect(JSON.stringify(resLogin.body)).not.toContain('password_hash');

      // 3. Verificar que endpoints administrativos tampoco exponen password_hash
      const resConfig = await request(app)
        .get('/api/admin/configuraciones')
        .set('Authorization', `Bearer ${tokenAdminValido}`);
      expect(resConfig.status).toBe(200);
      expect(JSON.stringify(resConfig.body)).not.toContain('password_hash');
      expect(JSON.stringify(resConfig.body)).not.toContain('$2b$');

      const resBitacora = await request(app)
        .get('/api/admin/bitacora')
        .set('Authorization', `Bearer ${tokenAdminValido}`);
      expect(resBitacora.status).toBe(200);
      expect(JSON.stringify(resBitacora.body)).not.toContain('password_hash');
    });

    it('Control S3 (Expiración y Rol en JWT): exige claim exp y rol administrador, rechazando tokens sin exp, vencidos o con rol distinto (401/403)', async () => {
      const secret =
        process.env.JWT_SECRET || 'pukara_dev_jwt_secret_llojeta_2026_umsa';

      // 1. Verificar que el token emitido por el sistema posee claim exp y rol: 'administrador'
      const decodificado = jwt.decode(tokenAdminValido);
      expect(decodificado).toBeDefined();
      expect(typeof decodificado.exp).toBe('number');
      expect(decodificado.exp).toBeGreaterThan(decodificado.iat);
      expect(decodificado.rol).toBe('administrador');

      // 2. Token firmado válidamente pero SIN claim exp debe ser rechazado con 401
      const tokenSinExp = jwt.sign(
        { id: adminUsuario.id, email: adminUsuario.email, rol: 'administrador' },
        secret
      );
      const resSinExp = await request(app)
        .get('/api/admin/configuraciones')
        .set('Authorization', `Bearer ${tokenSinExp}`);
      expect(resSinExp.status).toBe(401);

      // 3. Token expirado debe ser rechazado con 401
      const tokenExpirado = jwt.sign(
        {
          id: adminUsuario.id,
          email: adminUsuario.email,
          rol: 'administrador',
          exp: Math.floor(Date.now() / 1000) - 60,
        },
        secret
      );
      const resExpirado = await request(app)
        .get('/api/admin/configuraciones')
        .set('Authorization', `Bearer ${tokenExpirado}`);
      expect(resExpirado.status).toBe(401);

      // 4. Token válido con exp pero con rol distinto ('operador' / 'consulta') debe ser rechazado con 403
      const tokenRolNoAdmin = jwt.sign(
        {
          id: 999,
          email: 'operador@pukara.bo',
          rol: 'operador',
        },
        secret,
        { expiresIn: '1h' }
      );
      const resNoAdmin = await request(app)
        .get('/api/admin/configuraciones')
        .set('Authorization', `Bearer ${tokenRolNoAdmin}`);
      expect(resNoAdmin.status).toBe(403);
    });

    it('Control S4 (Protección contra Inyección SQL — Consultas Parametrizadas): rechaza payloads SQLi sin errores 500 y mantiene intactas las 10 tablas', async () => {
      // 1. Probar vectores de inyección SQL en POST /api/auth/login
      const vectoresLogin = [
        { email: "' OR '1'='1' --", password: "' OR '1'='1' --" },
        {
          email: "admin@pukara.bo'; DROP TABLE usuarios; --",
          password: 'Password123!',
        },
        {
          email: 'admin@pukara.bo',
          password: "' OR 1=1; SELECT * FROM usuarios; --",
        },
      ];

      for (const payload of vectoresLogin) {
        limpiarRateLimiterLogin();
        const res = await request(app).post('/api/auth/login').send(payload);
        expect([400, 401]).toContain(res.status);
        expect(res.status).not.toBe(500);
      }

      // 2. Probar vectores SQLi en query params de GET /api/estado y GET /api/historial
      const resEstadoSqli = await request(app)
        .get('/api/estado')
        .query({ modalidad: "real' OR '1'='1" });
      expect(resEstadoSqli.status).toBe(400);

      const resHistorialSqli = await request(app)
        .get('/api/historial')
        .query({ limite: '1; SELECT * FROM usuarios --' });
      expect([200, 400]).toContain(resHistorialSqli.status);
      expect(resHistorialSqli.status).not.toBe(500);

      // 3. Probar vectores SQLi en endpoints administrativos protegidos
      const resConfigSqli = await request(app)
        .post('/api/admin/configuraciones')
        .set('Authorization', `Bearer ${tokenAdminValido}`)
        .send({
          motivo: "'; DROP TABLE umbrales; --",
          umbrales: [
            {
              variable: "intensidad_mm_h'; DROP TABLE umbrales; --",
              nivel: 'PRECAUCION',
              valor: "10; DROP TABLE umbrales; --",
            },
          ],
        });
      expect(resConfigSqli.status).toBe(400);

      // 4. Verificar que las 10 tablas inmutables de PUKARA siguen intactas y operativas
      const resTablas = await pool.query(
        `SELECT table_name
         FROM information_schema.tables
         WHERE table_schema = 'public'
           AND table_name = ANY($1::text[]);`,
        [TABLAS_INMUTABLES_PUKARA]
      );
      const nombresTablas = resTablas.rows.map((r) => r.table_name);
      for (const tablaEsperada of TABLAS_INMUTABLES_PUKARA) {
        expect(nombresTablas).toContain(tablaEsperada);
      }

      // 5. Escaneo estático en server/src/services/ y server/src/routes/ para verificar ausencia de concatenación insegura con req.body / req.query / req.params
      const archivosServiciosYRutas = [
        ...listarArchivosJsRecursivo(path.join(SERVER_ROOT, 'src/services')),
        ...listarArchivosJsRecursivo(path.join(SERVER_ROOT, 'src/routes')),
      ];
      for (const rutaArchivo of archivosServiciosYRutas) {
        const codigo = fs.readFileSync(rutaArchivo, 'utf8');
        expect(codigo).not.toMatch(
          /\.query\s*\(\s*`[^`]*\$\{\s*req\.(body|query|params)/
        );
      }
    });

    it('Control S5 (Rate Limiting en Login, CORS y Privacidad de Ubicación GPS): aplica HTTP 429 tras ráfaga, expone CORS y verifica cero almacenamiento de GPS de usuario', async () => {
      // 1. Verificar encabezados CORS en la API
      const resCors = await request(app)
        .get('/api/salud')
        .set('Origin', 'http://localhost:5173');
      expect(resCors.status).toBe(200);
      expect(resCors.headers['access-control-allow-origin']).toBeDefined();

      // 2. Verificar Rate Limiting en POST /api/auth/login (máximo 5 intentos por ventana -> 6to devuelve 429)
      limpiarRateLimiterLogin();
      let ultimoStatus = 0;
      let respuesta429 = null;
      for (let i = 1; i <= 6; i += 1) {
        const resIntento = await request(app)
          .post('/api/auth/login')
          .send({ email: 'admin@pukara.bo', password: `ClaveIncorrecta_${i}` });
        ultimoStatus = resIntento.status;
        if (resIntento.status === 429) {
          respuesta429 = resIntento;
        }
      }
      expect(ultimoStatus).toBe(429);
      expect(respuesta429).not.toBeNull();
      expect(respuesta429.headers['retry-after']).toBeDefined();

      // Limpiar rate limiter al terminar la prueba de ráfaga
      limpiarRateLimiterLogin();

      // 3. Verificar privacidad de geolocalización (Sección 6.4 / Regla 5):
      // Ninguna tabla de lecturas ni evaluaciones almacena coordenadas GPS del dispositivo del usuario
      const resColumnasGps = await pool.query(`
        SELECT table_name, column_name
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name IN ('lecturas_meteorologicas', 'evaluaciones_nivel')
          AND column_name IN ('latitud_usuario', 'longitud_usuario', 'gps_usuario', 'ubicacion_usuario');
      `);
      expect(resColumnasGps.rows).toHaveLength(0);
    });
  });
});
