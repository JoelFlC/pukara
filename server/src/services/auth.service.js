import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { pool } from '../db/pool.js';

/**
 * Clase de error de dominio para autenticación y autorización en PUKARA.
 */
export class AuthError extends Error {
  /**
   * @param {number} statusCode Código HTTP (400, 401, 403, etc.)
   * @param {string} codigo Código canónico de error
   * @param {string} mensaje Descripción del error
   */
  constructor(statusCode, codigo, mensaje) {
    super(mensaje);
    this.name = 'AuthError';
    this.statusCode = statusCode;
    this.codigo = codigo;
  }
}

/**
 * Expresión regular básica para validación de formato de correo electrónico.
 */
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Sanitiza y valida las credenciales de entrada.
 *
 * @param {Object} credenciales
 * @param {any} credenciales.email
 * @param {any} credenciales.password
 * @returns {{ email: string, password: string }}
 * @throws {AuthError} Si los datos son incompletos o inválidos (HTTP 400)
 */
export function validarCredencialesEntrada({ email, password } = {}) {
  if (
    typeof email !== 'string' ||
    typeof password !== 'string' ||
    email.trim().length === 0 ||
    password.length === 0
  ) {
    throw new AuthError(
      400,
      'DATOS_INCOMPLETOS',
      'Debe proporcionar un correo electrónico y una contraseña.'
    );
  }

  const emailLimpio = email.trim().toLowerCase();

  if (emailLimpio.length > 255 || !EMAIL_REGEX.test(emailLimpio)) {
    throw new AuthError(
      400,
      'DATOS_INCOMPLETOS',
      'El correo electrónico no tiene un formato válido.'
    );
  }

  if (password.length > 128) {
    throw new AuthError(
      400,
      'DATOS_INCOMPLETOS',
      'La contraseña excede la longitud máxima permitida.'
    );
  }

  return { email: emailLimpio, password };
}

/**
 * Genera un token JWT de acceso para el usuario indicado.
 *
 * @param {Object} usuario
 * @param {number|string} usuario.id
 * @param {string} usuario.email
 * @param {string} usuario.nombre
 * @param {string} usuario.rol
 * @param {Object} [opciones={}]
 * @param {string} [opciones.secret]
 * @param {string|number} [opciones.expiresIn]
 * @returns {string} Token JWT firmado
 */
export function generarTokenAcceso(usuario, opciones = {}) {
  if (!usuario || !usuario.id || !usuario.email) {
    throw new AuthError(
      400,
      'DATOS_INCOMPLETOS',
      'Datos de usuario insuficientes para emitir el token de acceso.'
    );
  }

  const payload = {
    sub: String(usuario.id),
    id: Number(usuario.id),
    email: usuario.email,
    nombre: usuario.nombre || '',
    rol: usuario.rol || 'usuario',
  };

  const secret =
    opciones.secret ||
    process.env.JWT_SECRET ||
    'pukara_dev_jwt_secret_llojeta_2026_umsa';

  const expiresIn =
    opciones.expiresIn || process.env.JWT_EXPIRES_IN || '8h';

  return jwt.sign(payload, secret, { expiresIn });
}

/**
 * Verifica y decodifica un token JWT de acceso.
 *
 * @param {string} token
 * @param {Object} [opciones={}]
 * @param {string} [opciones.secret]
 * @returns {Object} Payload del token decodificado
 * @throws {AuthError} Si el token es nulo, inválido o ha expirado (HTTP 401)
 */
export function verificarTokenAcceso(token, opciones = {}) {
  if (!token || typeof token !== 'string' || token.trim().length === 0) {
    throw new AuthError(
      401,
      'TOKEN_INVALIDO',
      'Token de autenticación no proporcionado o inválido.'
    );
  }

  const secret =
    opciones.secret ||
    process.env.JWT_SECRET ||
    'pukara_dev_jwt_secret_llojeta_2026_umsa';

  try {
    const decoded = jwt.verify(token.trim(), secret);
    if (!decoded || typeof decoded !== 'object' || typeof decoded.exp !== 'number') {
      throw new AuthError(
        401,
        'TOKEN_INVALIDO',
        'El token de autenticación debe poseer expiración (exp) válida.'
      );
    }
    return decoded;
  } catch (err) {
    if (err instanceof AuthError) {
      throw err;
    }
    if (err instanceof jwt.TokenExpiredError) {
      throw new AuthError(
        401,
        'TOKEN_EXPIRADO',
        'El token de autenticación ha expirado.'
      );
    }
    throw new AuthError(
      401,
      'TOKEN_INVALIDO',
      'Token de autenticación inválido.'
    );
  }
}

/**
 * Autentica las credenciales de un administrador y devuelve el token de sesión.
 *
 * @param {Object} credenciales
 * @param {string} credenciales.email
 * @param {string} credenciales.password
 * @param {Object} [opciones={}]
 * @param {import('pg').Pool|import('pg').PoolClient} [opciones.db]
 * @param {string} [opciones.secret]
 * @param {string|number} [opciones.expiresIn]
 * @returns {Promise<{ token: string, expira_en: string, usuario: { id: number, nombre: string, email: string, rol: string } }>}
 * @throws {AuthError}
 */
export async function autenticarAdministrador(credenciales, opciones = {}) {
  const { email, password } = validarCredencialesEntrada(credenciales);
  const db = opciones.db || pool;

  const query = `
    SELECT id, nombre, email, password_hash, rol, activo
    FROM usuarios
    WHERE LOWER(email) = LOWER($1)
    LIMIT 1;
  `;

  const res = await db.query(query, [email]);

  if (res.rows.length === 0) {
    throw new AuthError(401, 'CREDENCIALES_INVALIDAS', 'Credenciales inválidas.');
  }

  const usuario = res.rows[0];

  const coincide = await bcrypt.compare(password, usuario.password_hash);
  if (!coincide) {
    throw new AuthError(401, 'CREDENCIALES_INVALIDAS', 'Credenciales inválidas.');
  }

  if (usuario.activo !== true) {
    throw new AuthError(
      403,
      'CUENTA_INACTIVA',
      'La cuenta de usuario se encuentra deshabilitada.'
    );
  }

  if (usuario.rol !== 'administrador') {
    throw new AuthError(
      403,
      'ROL_INSUFICIENTE',
      'Acceso restringido exclusivamente al rol administrador.'
    );
  }

  const token = generarTokenAcceso(usuario, opciones);
  const expira_en = opciones.expiresIn || process.env.JWT_EXPIRES_IN || '8h';

  return {
    token,
    expira_en,
    usuario: {
      id: Number(usuario.id),
      nombre: usuario.nombre,
      email: usuario.email,
      rol: usuario.rol,
    },
  };
}

