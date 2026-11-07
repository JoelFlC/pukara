import bcrypt from 'bcrypt';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { pool } from './pool.js';

dotenv.config();

/**
 * Asegura la existencia y actualización del usuario administrador en PostgreSQL.
 *
 * @param {Object} [opciones={}]
 * @param {string} [opciones.email]
 * @param {string} [opciones.password]
 * @param {string} [opciones.nombre]
 * @param {import('pg').PoolClient|import('pg').Pool} [opciones.client]
 * @returns {Promise<Object>} Registro del usuario administrador asegurado
 */
export async function asegurarUsuarioAdministrador(opciones = {}) {
  const email = (opciones.email || process.env.ADMIN_EMAIL || 'admin@pukara.bo').trim().toLowerCase();
  const password = opciones.password || process.env.ADMIN_PASSWORD || 'PukaraAdmin2026!';
  const nombre = (opciones.nombre || process.env.ADMIN_NOMBRE || 'Administrador PUKARA').trim();
  const dbClient = opciones.client || pool;

  const passwordHash = await bcrypt.hash(password, 10);

  const query = `
    INSERT INTO usuarios (nombre, email, password_hash, rol, activo, creado_en, actualizado_en)
    VALUES ($1, $2, $3, 'administrador', true, NOW(), NOW())
    ON CONFLICT (email) DO UPDATE
    SET nombre = EXCLUDED.nombre,
        password_hash = EXCLUDED.password_hash,
        rol = 'administrador',
        activo = true,
        actualizado_en = NOW()
    RETURNING id, nombre, email, rol, activo, creado_en, actualizado_en;
  `;

  const resultado = await dbClient.query(query, [nombre, email, passwordHash]);
  return resultado.rows[0];
}

// Ejecución directa por CLI si se invoca con `node src/db/seedAdmin.js`
const esArchivoPrincipal =
  process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];

if (esArchivoPrincipal) {
  try {
    const admin = await asegurarUsuarioAdministrador();
    console.log(
      `[SEED-ADMIN] ✓ Administrador asegurado: ID ${admin.id} (${admin.email}, rol: ${admin.rol})`
    );
    await pool.end();
    process.exit(0);
  } catch (err) {
    console.error('[SEED-ADMIN] ❌ Error asegurando administrador:', err);
    await pool.end();
    process.exit(1);
  }
}

