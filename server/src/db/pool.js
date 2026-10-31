import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

/**
 * Construye de forma pura y desacoplada las opciones de conexión para pg.Pool,
 * soportando PostgreSQL local (sin SSL) y servicios gestionados en la nube
 * (Neon, Supabase, Render) que exigen conexiones seguras TLS/SSL.
 *
 * @param {Object} [env=process.env] Variables de entorno
 * @returns {import('pg').PoolConfig} Opciones de configuración para pg.Pool
 */
export function construirOpcionesPool(env = process.env) {
  const connectionString =
    env.DATABASE_URL ||
    'postgresql://postgres:postgres@localhost:5432/pukara_db';

  const forzarSsl = env.DB_SSL === 'true';
  const prohibirSsl = env.DB_SSL === 'false';

  const urlIndicaCloudSsl =
    connectionString.includes('sslmode=require') ||
    connectionString.includes('.neon.tech') ||
    connectionString.includes('.supabase.co') ||
    connectionString.includes('.render.com');

  const debeActivarSsl = forzarSsl || (!prohibirSsl && urlIndicaCloudSsl);

  const opciones = {
    connectionString,
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: Number(env.DB_CONNECT_TIMEOUT_MS) || 10000,
  };

  if (debeActivarSsl) {
    opciones.ssl = { rejectUnauthorized: false };
  } else {
    opciones.ssl = false;
  }

  return opciones;
}

export const pool = new Pool(construirOpcionesPool());

pool.on('error', (err) => {
  console.error('Error inesperado en el cliente del pool de PostgreSQL:', err);
});

export default pool;
