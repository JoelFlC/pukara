/**
 * @file auth.p07.test.js
 * @description Suite de pruebas automatizadas para la regla P07 y requisitos transversales:
 * - Autenticación JWT y hashing seguro con bcrypt
 * - Control de acceso basado en roles (RBAC) y rechazo 401 / 403
 * - Sanitización de credenciales y tolerancia a inyección SQL
 * - Rate limiting contra ataques de fuerza bruta (429)
 * - Integridad relacional inalterada ante accesos rechazados
 */

import { describe, it, expect, beforeAll, beforeEach, afterEach, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { pool } from '../src/db/pool.js';
import { seed } from '../src/db/seed.js';
import { asegurarUsuarioAdministrador } from '../src/db/seedAdmin.js';
import {
  generarTokenAcceso,
  verificarTokenAcceso,
} from '../src/services/auth.service.js';
import { limpiarRateLimiterLogin } from '../src/middleware/rateLimit.middleware.js';

describe('Prueba P07: Seguridad de Autenticación, Control de Acceso y Rate Limiting', () => {
  let adminId;
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@pukara.bo';
  const adminPassword = process.env.ADMIN_PASSWORD || 'PukaraAdmin2026!';

  beforeAll(async () => {
    // Asegurar esquema base y usuario administrador institucional
    await seed();
    const admin = await asegurarUsuarioAdministrador();
    adminId = admin.id;
  });

  beforeEach(() => {
    limpiarRateLimiterLogin();
  });

  afterEach(() => {
    limpiarRateLimiterLogin();
  });

  afterAll(() => {
    limpiarRateLimiterLogin();
  });

  // =========================================================================
  // BLOQUE 1: Login exitoso de administrador (POST /api/auth/login)
  // =========================================================================
  describe('Bloque 1: Inicio de Sesión de Administrador', () => {
    it('1.1. Inicia sesión con credenciales válidas devolviendo token JWT y objeto usuario sin password_hash', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: adminEmail, password: adminPassword });

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(typeof res.body.token).toBe('string');
      expect(res.body.token.length).toBeGreaterThan(20);
      expect(res.body.expira_en).toBeDefined();

      // Verificar que el token es decodificable y contiene el rol correcto
      const payload = verificarTokenAcceso(res.body.token);
      expect(payload.id).toBe(Number(adminId));
      expect(payload.email).toBe(adminEmail.toLowerCase());
      expect(payload.rol).toBe('administrador');

      // Verificar que el objeto usuario contiene datos públicos sin fugar hash
      expect(res.body.usuario).toBeDefined();
      expect(res.body.usuario.id).toBe(Number(adminId));
      expect(res.body.usuario.email).toBe(adminEmail.toLowerCase());
      expect(res.body.usuario.rol).toBe('administrador');
      expect(res.body.usuario.password_hash).toBeUndefined();
      expect(res.body.password_hash).toBeUndefined();
    });

    it('1.2. Normaliza el correo electrónico con espacios y mayúsculas permitiendo el login', async () => {
      const emailConEspaciosYMayusculas = `  ${adminEmail.toUpperCase()}  `;
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: emailConEspaciosYMayusculas, password: adminPassword });

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.usuario.email).toBe(adminEmail.toLowerCase());
    });
  });

  // =========================================================================
  // BLOQUE 2: Rechazo por credenciales inválidas, datos incompletos e inyección SQL
  // =========================================================================
  describe('Bloque 2: Validación de Entradas y Rechazo Seguro', () => {
    it('2.1. Rechaza contraseña incorrecta con HTTP 401 y código CREDENCIALES_INVALIDAS', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: adminEmail, password: 'PasswordCompletamenteErroneo123!' });

      expect(res.status).toBe(401);
      expect(res.body.ok).toBe(false);
      expect(res.body.error).toBeDefined();
      expect(res.body.error.codigo).toBe('CREDENCIALES_INVALIDAS');
      expect(res.body.token).toBeUndefined();
    });

    it('2.2. Rechaza email inexistente con HTTP 401 y código CREDENCIALES_INVALIDAS (sin enumeración)', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'usuario_inexistente_999@pukara.bo', password: adminPassword });

      expect(res.status).toBe(401);
      expect(res.body.ok).toBe(false);
      expect(res.body.error.codigo).toBe('CREDENCIALES_INVALIDAS');
      expect(res.body.token).toBeUndefined();
    });

    it('2.3. Rechaza payload vacío o campos faltantes con HTTP 400 y código DATOS_INCOMPLETOS', async () => {
      // Caso a: body vacío
      const resVacio = await request(app).post('/api/auth/login').send({});
      expect(resVacio.status).toBe(400);
      expect(resVacio.body.error.codigo).toBe('DATOS_INCOMPLETOS');

      // Caso b: falta password
      const resSinPass = await request(app)
        .post('/api/auth/login')
        .send({ email: adminEmail });
      expect(resSinPass.status).toBe(400);
      expect(resSinPass.body.error.codigo).toBe('DATOS_INCOMPLETOS');

      // Caso c: falta email
      const resSinEmail = await request(app)
        .post('/api/auth/login')
        .send({ password: adminPassword });
      expect(resSinEmail.status).toBe(400);
      expect(resSinEmail.body.error.codigo).toBe('DATOS_INCOMPLETOS');

      // Caso d: strings vacíos
      const resStringsVacios = await request(app)
        .post('/api/auth/login')
        .send({ email: '   ', password: '' });
      expect(resStringsVacios.status).toBe(400);
      expect(resStringsVacios.body.error.codigo).toBe('DATOS_INCOMPLETOS');
    });

    it('2.4. Resiste intentos de inyección SQL sin generar errores 500 ni exponer información interna', async () => {
      const payloadsMaliciosos = [
        { email: "' OR 1=1 --", password: 'password' },
        { email: "admin@pukara.bo' OR '1'='1", password: 'password' },
        { email: "admin@pukara.bo'; DROP TABLE usuarios; --", password: 'password' },
      ];

      for (const payload of payloadsMaliciosos) {
        const res = await request(app).post('/api/auth/login').send(payload);
        // Debe rechazar por formato (400) o credenciales inválidas (401), NUNCA HTTP 500
        expect([400, 401]).toContain(res.status);
        expect(res.body.ok).toBe(false);
        expect(res.body.token).toBeUndefined();
      }

      // Comprobar que la tabla usuarios y el admin permanecen intactos
      const checkAdmin = await pool.query(
        'SELECT id, email, rol, activo FROM usuarios WHERE email = $1;',
        [adminEmail]
      );
      expect(checkAdmin.rows.length).toBe(1);
      expect(checkAdmin.rows[0].rol).toBe('administrador');
      expect(checkAdmin.rows[0].activo).toBe(true);
    });
  });

  // =========================================================================
  // BLOQUE 3: Caso P07.1 — Acceso a ruta de administración SIN token (401)
  // =========================================================================
  describe('Bloque 3: Caso P07.1 — Ausencia de Token de Autenticación', () => {
    it('3.1. GET /api/admin/resumen sin cabecera Authorization responde HTTP 401 con TOKEN_FALTANTE', async () => {
      const res = await request(app).get('/api/admin/resumen');

      expect(res.status).toBe(401);
      expect(res.body.ok).toBe(false);
      expect(res.body.error.codigo).toBe('TOKEN_FALTANTE');
      expect(res.body.error.mensaje).toContain('Bearer');
    });

    it('3.2. GET /api/auth/perfil sin cabecera Authorization responde HTTP 401 con TOKEN_FALTANTE', async () => {
      const res = await request(app).get('/api/auth/perfil');

      expect(res.status).toBe(401);
      expect(res.body.ok).toBe(false);
      expect(res.body.error.codigo).toBe('TOKEN_FALTANTE');
    });

    it('3.3. Petición con cabecera Authorization no Bearer (ej. Basic) devuelve TOKEN_FALTANTE', async () => {
      const res = await request(app)
        .get('/api/admin/resumen')
        .set('Authorization', 'Basic YWRtaW46cGFzc3dvcmQ=');

      expect(res.status).toBe(401);
      expect(res.body.error.codigo).toBe('TOKEN_FALTANTE');
    });
  });

  // =========================================================================
  // BLOQUE 4: Caso P07.2 — Acceso con token malformado o firma alterada (401)
  // =========================================================================
  describe('Bloque 4: Caso P07.2 — Token Malformado o Firma Inválida', () => {
    it('4.1. Responde HTTP 401 con TOKEN_INVALIDO ante un token de estructura arbitraria', async () => {
      const res = await request(app)
        .get('/api/admin/resumen')
        .set('Authorization', 'Bearer token.falso.completamente.alterado');

      expect(res.status).toBe(401);
      expect(res.body.ok).toBe(false);
      expect(res.body.error.codigo).toBe('TOKEN_INVALIDO');
    });

    it('4.2. Responde HTTP 401 con TOKEN_INVALIDO ante un token firmado con otro secreto', async () => {
      const tokenFalsoSecreto = generarTokenAcceso(
        { id: adminId, email: adminEmail, nombre: 'Admin', rol: 'administrador' },
        { secret: 'secreto_atacante_completamente_diferente_2026' }
      );

      const res = await request(app)
        .get('/api/admin/resumen')
        .set('Authorization', `Bearer ${tokenFalsoSecreto}`);

      expect(res.status).toBe(401);
      expect(res.body.ok).toBe(false);
      expect(res.body.error.codigo).toBe('TOKEN_INVALIDO');
    });
  });

  // =========================================================================
  // BLOQUE 5: Caso P07.3 — Acceso con token VENCIDO (401)
  // =========================================================================
  describe('Bloque 5: Caso P07.3 — Token Expirado', () => {
    it('5.1. Responde HTTP 401 con TOKEN_EXPIRADO ante un token cuya vigencia haya caducado', async () => {
      const tokenVencido = generarTokenAcceso(
        { id: adminId, email: adminEmail, nombre: 'Admin', rol: 'administrador' },
        { expiresIn: '-1s' }
      );

      const resAdmin = await request(app)
        .get('/api/admin/resumen')
        .set('Authorization', `Bearer ${tokenVencido}`);

      expect(resAdmin.status).toBe(401);
      expect(resAdmin.body.ok).toBe(false);
      expect(resAdmin.body.error.codigo).toBe('TOKEN_EXPIRADO');
      expect(resAdmin.body.error.mensaje).toContain('expirado');

      const resPerfil = await request(app)
        .get('/api/auth/perfil')
        .set('Authorization', `Bearer ${tokenVencido}`);

      expect(resPerfil.status).toBe(401);
      expect(resPerfil.body.error.codigo).toBe('TOKEN_EXPIRADO');
    });
  });

  // =========================================================================
  // BLOQUE 6: Caso P07.4 — Acceso con ROL INSUFICIENTE (403)
  // =========================================================================
  describe('Bloque 6: Caso P07.4 — Control de Acceso por Roles (RBAC)', () => {
    it('6.1. Responde HTTP 403 con ROL_INSUFICIENTE si el token tiene rol público', async () => {
      const tokenPublico = generarTokenAcceso({
        id: 991,
        email: 'vecino_llojeta@pukara.bo',
        nombre: 'Vecino Llojeta',
        rol: 'publico',
      });

      const res = await request(app)
        .get('/api/admin/resumen')
        .set('Authorization', `Bearer ${tokenPublico}`);

      expect(res.status).toBe(403);
      expect(res.body.ok).toBe(false);
      expect(res.body.error.codigo).toBe('ROL_INSUFICIENTE');
      expect(res.body.error.mensaje).toContain('permisos suficientes');
    });

    it('6.2. Responde HTTP 403 con ROL_INSUFICIENTE si el token tiene rol operador', async () => {
      const tokenOperador = generarTokenAcceso({
        id: 992,
        email: 'operador_cuenca@pukara.bo',
        nombre: 'Operador Cuenca',
        rol: 'operador',
      });

      const res = await request(app)
        .get('/api/admin/resumen')
        .set('Authorization', `Bearer ${tokenOperador}`);

      expect(res.status).toBe(403);
      expect(res.body.ok).toBe(false);
      expect(res.body.error.codigo).toBe('ROL_INSUFICIENTE');
    });
  });

  // =========================================================================
  // BLOQUE 7: Caso P07.5 — Acceso autorizado con token de administrador (200)
  // =========================================================================
  describe('Bloque 7: Caso P07.5 — Acceso Autorizado de Administrador', () => {
    it('7.1. Permite acceso a GET /api/admin/resumen con token válido de administrador', async () => {
      // 1. Obtener token mediante endpoint de login oficial
      const resLogin = await request(app)
        .post('/api/auth/login')
        .send({ email: adminEmail, password: adminPassword });
      expect(resLogin.status).toBe(200);
      const token = resLogin.body.token;

      // 2. Acceder al recurso protegido
      const resAdmin = await request(app)
        .get('/api/admin/resumen')
        .set('Authorization', `Bearer ${token}`);

      expect(resAdmin.status).toBe(200);
      expect(resAdmin.body.ok).toBe(true);
      expect(resAdmin.body.mensaje).toBe('Acceso de administración verificado');
      expect(resAdmin.body.usuario).toBeDefined();
      expect(resAdmin.body.usuario.rol).toBe('administrador');
      expect(resAdmin.body.usuario.email).toBe(adminEmail.toLowerCase());
      expect(resAdmin.body.aviso).toBeDefined();
    });

    it('7.2. Permite acceso a GET /api/auth/perfil y GET /api/auth/verificar con token de administrador', async () => {
      const resLogin = await request(app)
        .post('/api/auth/login')
        .send({ email: adminEmail, password: adminPassword });
      const token = resLogin.body.token;

      const resPerfil = await request(app)
        .get('/api/auth/perfil')
        .set('Authorization', `Bearer ${token}`);
      expect(resPerfil.status).toBe(200);
      expect(resPerfil.body.ok).toBe(true);
      expect(resPerfil.body.usuario.email).toBe(adminEmail.toLowerCase());

      const resVerificar = await request(app)
        .get('/api/auth/verificar')
        .set('Authorization', `Bearer ${token}`);
      expect(resVerificar.status).toBe(200);
      expect(resVerificar.body.ok).toBe(true);
      expect(resVerificar.body.usuario.rol).toBe('administrador');
    });
  });

  // =========================================================================
  // BLOQUE 8: Integridad de datos ante accesos rechazados (P07)
  // =========================================================================
  describe('Bloque 8: Integridad Relacional ante Intentos de Acceso No Autorizados', () => {
    it('8.1. Comprueba que las tablas de negocio permanecen inalteradas tras múltiples accesos rechazados', async () => {
      // Contar filas antes de las solicitudes rechazadas
      const configAntes = await pool.query('SELECT count(*) FROM configuraciones_reglas;');
      const umbralesAntes = await pool.query('SELECT count(*) FROM umbrales;');
      const bitacoraAntes = await pool.query('SELECT count(*) FROM bitacora_cambios;');
      const usuariosAntes = await pool.query('SELECT count(*) FROM usuarios;');

      // Bombardear con intentos fallidos (400, 401, 403, inyección)
      await request(app).get('/api/admin/resumen');
      await request(app).get('/api/admin/resumen').set('Authorization', 'Bearer token_invalido');
      await request(app).post('/api/auth/login').send({ email: 'hacker@malicioso.com', password: 'mal' });
      await request(app).post('/api/auth/login').send({ email: "admin@pukara.bo' OR '1'='1", password: 'x' });
      await request(app).get('/api/admin/resumen').set(
        'Authorization',
        `Bearer ${generarTokenAcceso({ id: 123, email: 'user@pukara.bo', rol: 'publico' })}`
      );

      // Contar filas después de los intentos fallidos
      const configDespues = await pool.query('SELECT count(*) FROM configuraciones_reglas;');
      const umbralesDespues = await pool.query('SELECT count(*) FROM umbrales;');
      const bitacoraDespues = await pool.query('SELECT count(*) FROM bitacora_cambios;');
      const usuariosDespues = await pool.query('SELECT count(*) FROM usuarios;');

      expect(configDespues.rows[0].count).toBe(configAntes.rows[0].count);
      expect(umbralesDespues.rows[0].count).toBe(umbralesAntes.rows[0].count);
      expect(bitacoraDespues.rows[0].count).toBe(bitacoraAntes.rows[0].count);
      expect(usuariosDespues.rows[0].count).toBe(usuariosAntes.rows[0].count);
    });
  });

  // =========================================================================
  // BLOQUE 9: Rate Limiting en el inicio de sesión (429 Too Many Requests)
  // =========================================================================
  describe('Bloque 9: Protección contra Fuerza Bruta (Rate Limiting)', () => {
    it('9.1. Bloquea peticiones con HTTP 429 tras superar el límite de 5 intentos fallidos consecutivos', async () => {
      limpiarRateLimiterLogin();

      // Enviar exactamente 5 intentos fallidos
      for (let i = 1; i <= 5; i++) {
        const resFallo = await request(app)
          .post('/api/auth/login')
          .send({ email: adminEmail, password: `IntentoErroneo_${i}` });
        expect(resFallo.status).toBe(401);
      }

      // El intento 6 debe ser bloqueado inmediatamente con 429 Too Many Requests
      const resBloqueado = await request(app)
        .post('/api/auth/login')
        .send({ email: adminEmail, password: 'CualquierPassword' });

      expect(resBloqueado.status).toBe(429);
      expect(resBloqueado.body.ok).toBe(false);
      expect(resBloqueado.body.error).toBeDefined();
      expect(resBloqueado.body.error.codigo).toBe('DEMASIADOS_INTENTOS');
      expect(resBloqueado.body.error.mensaje).toContain('Demasiados intentos');
      expect(resBloqueado.headers['retry-after']).toBeDefined();

      // Limpiar el rate limiter y verificar que se restablece el acceso
      limpiarRateLimiterLogin();

      const resRestablecido = await request(app)
        .post('/api/auth/login')
        .send({ email: adminEmail, password: adminPassword });
      expect(resRestablecido.status).toBe(200);
      expect(resRestablecido.body.ok).toBe(true);
    });
  });

  // =========================================================================
  // BLOQUE 10: Cabeceras de Seguridad Transversal
  // =========================================================================
  describe('Bloque 10: Cabeceras de Seguridad Transversal en Respuestas HTTP', () => {
    it('10.1. Incluye X-Content-Type-Options: nosniff, X-Frame-Options: DENY y Referrer-Policy', async () => {
      const res = await request(app).get('/api/salud');

      expect(res.headers['x-content-type-options']).toBe('nosniff');
      expect(res.headers['x-frame-options']).toBe('DENY');
      expect(res.headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
    });
  });
});
