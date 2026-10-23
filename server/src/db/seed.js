import bcrypt from 'bcrypt';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { pool } from './pool.js';

dotenv.config();

const PARAMETROS_V1 = {
  t_max_minutos: 60,
  separacion_minima_minutos: 15,
  muestras_descenso: 2,
  saturacion: {
    habilitada: true,
    acum_72h_min_mm: 60,
    intensidad_min_mm_h: 2.5,
    nivel_minimo: 'ALERTA',
  },
};

const UMBRALES_V1 = [
  // Intensidad horaria (mm/h)
  { variable: 'intensidad_mm_h', nivel: 'PRECAUCION', valor: 2.5 },
  { variable: 'intensidad_mm_h', nivel: 'ALERTA', valor: 6.5 },
  { variable: 'intensidad_mm_h', nivel: 'EMERGENCIA', valor: 12.0 },
  // Acumulado 24 horas (mm)
  { variable: 'acum_24h_mm', nivel: 'PRECAUCION', valor: 10.0 },
  { variable: 'acum_24h_mm', nivel: 'ALERTA', valor: 25.0 },
  { variable: 'acum_24h_mm', nivel: 'EMERGENCIA', valor: 40.0 },
  // Acumulado 72 horas (mm)
  { variable: 'acum_72h_mm', nivel: 'PRECAUCION', valor: 25.0 },
  { variable: 'acum_72h_mm', nivel: 'ALERTA', valor: 60.0 },
  { variable: 'acum_72h_mm', nivel: 'EMERGENCIA', valor: 90.0 },
];

const RECOMENDACIONES_V1 = [
  {
    nivel: 'NORMAL',
    titulo: 'Recomendaciones generales — Nivel Normal',
    contenido:
      'Mantenerse informado por canales oficiales; revisar el estado de canaletas y desagües de la vivienda.',
  },
  {
    nivel: 'PRECAUCION',
    titulo: 'Recomendaciones generales — Nivel Precaución',
    contenido:
      'Evitar cauces y quebradas; revisar desagües y canaletas; tener a mano linterna y documentos; consultar con regularidad el nivel informativo y los canales oficiales.',
  },
  {
    nivel: 'ALERTA',
    titulo: 'Recomendaciones generales — Nivel Alerta',
    contenido:
      'Mantenerse alejado de ríos, cauces y taludes con grietas; preparar una mochila de emergencia; evitar vías cercanas a cauces; seguir los canales oficiales.',
  },
  {
    nivel: 'EMERGENCIA',
    titulo: 'Recomendaciones generales — Nivel Emergencia',
    contenido:
      'Mantenerse informado por canales oficiales; evitar cauces y taludes; no cruzar zonas inundadas ni con lodo; contactar a los servicios de emergencia.',
  },
];

/**
 * Función principal para poblar datos iniciales del sistema (idempotente).
 */
export async function seed() {
  const client = await pool.connect();

  try {
    console.log('[SEED] Iniciando transacción de datos semilla...');
    await client.query('BEGIN');

    // 1. Usuario Administrador Inicial
    const adminEmail = process.env.ADMIN_SEED_EMAIL || 'admin@pukara.local';
    const adminPassword = process.env.ADMIN_SEED_PASSWORD || 'PukaraAdmin2026!';
    let adminId;

    const userCheck = await client.query('SELECT id FROM usuarios WHERE email = $1;', [adminEmail]);
    if (userCheck.rows.length === 0) {
      const passwordHash = await bcrypt.hash(adminPassword, 10);
      const resUser = await client.query(
        `INSERT INTO usuarios (nombre, email, password_hash, rol, activo)
         VALUES ($1, $2, $3, 'administrador', true)
         RETURNING id;`,
        ['Administrador PUKARA', adminEmail, passwordHash]
      );
      adminId = resUser.rows[0].id;
      console.log(`[SEED] ✓ Usuario administrador creado con ID: ${adminId} (${adminEmail})`);
    } else {
      adminId = userCheck.rows[0].id;
      console.log(`[SEED] - Usuario administrador ya existe con ID: ${adminId}`);
    }

    // 2. Configuración Inicial v1 (vigente)
    let configId;
    let esNuevaConfig = false;

    const configCheck = await client.query(
      'SELECT id, estado FROM configuraciones_reglas WHERE version = 1;'
    );

    if (configCheck.rows.length === 0) {
      const resConfig = await client.query(
        `INSERT INTO configuraciones_reglas (version, estado, parametros, creada_por, activada_en, motivo)
         VALUES (1, 'vigente', $1, $2, now(), 'Configuración inicial v1 con umbrales académicos simulados de referencia (Llojeta)')
         RETURNING id;`,
        [JSON.stringify(PARAMETROS_V1), adminId]
      );
      configId = resConfig.rows[0].id;
      esNuevaConfig = true;
      console.log(`[SEED] ✓ Configuración de reglas v1 creada con ID: ${configId} (estado: vigente)`);
    } else {
      configId = configCheck.rows[0].id;
      console.log(`[SEED] - Configuración v1 ya existe con ID: ${configId}`);
    }

    // 3. Los 9 Umbrales Obligatorios de la versión 1
    for (const u of UMBRALES_V1) {
      await client.query(
        `INSERT INTO umbrales (configuracion_id, variable, nivel, valor)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (configuracion_id, variable, nivel)
         DO UPDATE SET valor = EXCLUDED.valor;`,
        [configId, u.variable, u.nivel, u.valor]
      );
    }
    console.log(`[SEED] ✓ ${UMBRALES_V1.length} umbrales académicos sincronizados para la configuración ID: ${configId}`);

    // 4. Recomendaciones Preventivas Iniciales v1
    const fuenteRecomendaciones =
      'Propuesta académica PUKARA - Contenido preventivo general de demostración';

    for (const r of RECOMENDACIONES_V1) {
      await client.query(
        `INSERT INTO recomendaciones_preventivas (nivel, titulo, contenido, version, estado_publicacion, origen, fuente, actualizado_por)
         VALUES ($1, $2, $3, 1, 'publicado', 'demostracion', $4, $5)
         ON CONFLICT (nivel, version)
         DO UPDATE SET
           titulo = EXCLUDED.titulo,
           contenido = EXCLUDED.contenido,
           estado_publicacion = EXCLUDED.estado_publicacion,
           origen = EXCLUDED.origen,
           fuente = EXCLUDED.fuente,
           actualizado_por = EXCLUDED.actualizado_por,
           actualizado_en = now();`,
        [r.nivel, r.titulo, r.contenido, fuenteRecomendaciones, adminId]
      );
    }
    console.log(
      `[SEED] ✓ ${RECOMENDACIONES_V1.length} recomendaciones preventivas sincronizadas para versión 1`
    );

    // 5. Registro inicial en bitacora_cambios si fue creada en esta corrida
    const bitacoraCheck = await client.query(
      `SELECT id FROM bitacora_cambios 
       WHERE entidad = 'configuraciones_reglas' AND entidad_id = $1 AND accion = 'activar';`,
      [configId]
    );

    if (bitacoraCheck.rows.length === 0) {
      const valorNuevo = {
        version: 1,
        estado: 'vigente',
        parametros: PARAMETROS_V1,
        umbrales: UMBRALES_V1,
      };

      await client.query(
        `INSERT INTO bitacora_cambios (usuario_id, entidad, entidad_id, accion, valor_anterior, valor_nuevo)
         VALUES ($1, 'configuraciones_reglas', $2, 'activar', null, $3);`,
        [adminId, configId, JSON.stringify(valorNuevo)]
      );
      console.log(`[SEED] ✓ Bitácora de cambios registrada para la activación de v1`);
    } else {
      console.log(`[SEED] - Registro de auditoría en bitácora de cambios ya presente`);
    }

    await client.query('COMMIT');
    console.log('[SEED] Proceso de datos semilla completado exitosamente.');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('[SEED] ✗ Error durante la ejecución del seed:', error.message);
    throw error;
  } finally {
    client.release();
  }
}

// Ejecución directa por CLI
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  seed()
    .then(async () => {
      await pool.end();
      process.exit(0);
    })
    .catch(async (error) => {
      console.error('[SEED] Falla fatal:', error);
      await pool.end();
      process.exit(1);
    });
}
