import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { pool } from './pool.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const MIGRATIONS_DIR = path.join(__dirname, 'migrations');

const TABLAS_ORDEN_DROP = [
  'bitacora_cambios',
  'evaluaciones_nivel',
  'umbrales',
  'configuraciones_reglas',
  'recomendaciones_preventivas',
  'usuarios',
  'lecturas_meteorologicas',
  'contactos_emergencia',
  'zonas_referencia',
  'puntos_referencia',
  '_migraciones',
];

/**
 * Inicializa la tabla de control de migraciones si no existe.
 */
async function asegurarTablaMigraciones(client) {
  const sql = `
    CREATE TABLE IF NOT EXISTS _migraciones (
      id SERIAL PRIMARY KEY,
      nombre VARCHAR(255) NOT NULL UNIQUE,
      aplicada_en TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `;
  await client.query(sql);
}

/**
 * Ejecuta el reseteo de la base de datos (solo desarrollo y pruebas).
 */
async function resetearBaseDeDatos(client) {
  const env = process.env.NODE_ENV || 'development';
  if (env === 'production') {
    throw new Error(
      '[SEGURIDAD] Intento de resetear base de datos en entorno de producción abortado. Flag --reset prohibido en producción.'
    );
  }

  console.log(`[MIGRATE] Reseteando base de datos en entorno '${env}'...`);
  for (const tabla of TABLAS_ORDEN_DROP) {
    await client.query(`DROP TABLE IF EXISTS ${tabla} CASCADE;`);
    console.log(`  - Tabla eliminada: ${tabla}`);
  }
  console.log('[MIGRATE] Tablas eliminadas correctamente.');
}

/**
 * Función principal de migración.
 * @param {Object} options
 * @param {boolean} options.reset Si es true, reinicia las tablas antes de migrar.
 */
export async function migrate(options = {}) {
  const isReset = options.reset || process.argv.includes('--reset');
  const client = await pool.connect();

  try {
    if (isReset) {
      await client.query('BEGIN');
      try {
        await resetearBaseDeDatos(client);
        await client.query('COMMIT');
      } catch (resetError) {
        await client.query('ROLLBACK');
        throw resetError;
      }
    }

    // Asegurar tabla de control
    await asegurarTablaMigraciones(client);

    // Obtener migraciones ya aplicadas
    const res = await client.query('SELECT nombre FROM _migraciones;');
    const aplicadas = new Set(res.rows.map((r) => r.nombre));

    // Leer archivos de migración
    const archivos = await fs.readdir(MIGRATIONS_DIR);
    const archivosSql = archivos
      .filter((file) => file.endsWith('.sql'))
      .sort((a, b) => a.localeCompare(b));

    if (archivosSql.length === 0) {
      console.log('[MIGRATE] No se encontraron archivos de migración en:', MIGRATIONS_DIR);
      return;
    }

    let migracionesEjecutadas = 0;

    for (const archivo of archivosSql) {
      if (aplicadas.has(archivo)) {
        console.log(`[MIGRATE] Omitiendo migración ya aplicada: ${archivo}`);
        continue;
      }

      console.log(`[MIGRATE] Aplicando migración: ${archivo}...`);
      const filePath = path.join(MIGRATIONS_DIR, archivo);
      const sqlContent = await fs.readFile(filePath, 'utf-8');

      await client.query('BEGIN');
      try {
        // Ejecutar DDL
        await client.query(sqlContent);

        // Registrar en tabla de control
        await client.query('INSERT INTO _migraciones (nombre) VALUES ($1);', [archivo]);

        await client.query('COMMIT');
        console.log(`[MIGRATE] ✓ Migración exitosa: ${archivo}`);
        migracionesEjecutadas++;
      } catch (migError) {
        await client.query('ROLLBACK');
        console.error(`[MIGRATE] ✗ Error aplicando migración ${archivo}:`, migError.message);
        throw migError;
      }
    }

    if (migracionesEjecutadas === 0) {
      console.log('[MIGRATE] Todas las migraciones están al día. Esquema sin cambios pendientes.');
    } else {
      console.log(`[MIGRATE] Se aplicaron ${migracionesEjecutadas} migración(es) satisfactoriamente.`);
    }
  } finally {
    client.release();
  }
}

// Ejecutar si se invoca directamente desde CLI
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  migrate()
    .then(async () => {
      await pool.end();
      process.exit(0);
    })
    .catch(async (error) => {
      console.error('[MIGRATE] Falla fatal durante la migración:', error);
      await pool.end();
      process.exit(1);
    });
}
