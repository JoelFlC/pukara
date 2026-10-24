import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { pool } from './pool.js';

dotenv.config();

/**
 * 2 Polígonos GeoJSON de demostración delimitados sobre OpenStreetMap.
 * Estándar RFC 7946: coordenadas [longitud, latitud] cerradas.
 */
export const ZONAS_SEMILLA = [
  {
    nombre: 'Sector Piloto Llojeta — Cuenca Media (Referencial)',
    geometria: {
      type: 'Polygon',
      coordinates: [
        [
          [-68.151, -16.5175],
          [-68.138, -16.5175],
          [-68.138, -16.525],
          [-68.151, -16.525],
          [-68.151, -16.5175],
        ],
      ],
    },
    fuente:
      'Delimitación académica aproximada sobre cartografía base OpenStreetMap',
    fecha_dato: '2026-10-23',
    vigente_hasta: null,
    verificada: false,
    advertencia: 'referencia de demostración, no validada',
  },
  {
    nombre:
      'Subsector Bajo Llojeta — Corredor Pasajahuira / Los Sargentos (Referencial)',
    geometria: {
      type: 'Polygon',
      coordinates: [
        [
          [-68.1455, -16.523],
          [-68.1335, -16.523],
          [-68.1335, -16.5305],
          [-68.1455, -16.5305],
          [-68.1455, -16.523],
        ],
      ],
    },
    fuente:
      'Delimitación académica aproximada sobre cartografía base OpenStreetMap',
    fecha_dato: '2026-10-23',
    vigente_hasta: null,
    verificada: false,
    advertencia: 'referencia de demostración, no validada',
  },
];

/**
 * 6 Puntos de referencia cartográfica para orientación urbana de demostración.
 * REGLA SEMÁNTICA INMUTABLE: NO son zonas seguras ni rutas de evacuación.
 */
export const PUNTOS_SEMILLA = [
  {
    nombre:
      'Cruce Av. Los Sargentos — Acceso Bajo Llojeta (Referencia vial)',
    tipo: 'hito_vial_referencial',
    latitud: -16.5268,
    longitud: -68.1372,
    fuente:
      'Referencia cartográfica OpenStreetMap — Demostración académica no validada',
    estado_verificacion: 'sin_verificar',
    activo: true,
  },
  {
    nombre: 'Entorno Cementerio Jardín — Llojeta (Referencia urbana)',
    tipo: 'referencia_urbana',
    latitud: -16.5229,
    longitud: -68.1434,
    fuente:
      'Referencia cartográfica OpenStreetMap — Demostración académica no validada',
    estado_verificacion: 'sin_verificar',
    activo: true,
  },
  {
    nombre:
      'Parada Teleférico Línea Morada — Faro Murillo / Conexión Cotahuma (Referencia transporte)',
    tipo: 'transporte_referencial',
    latitud: -16.5152,
    longitud: -68.1489,
    fuente:
      'Referencia cartográfica OpenStreetMap — Demostración académica no validada',
    estado_verificacion: 'sin_verificar',
    activo: true,
  },
  {
    nombre:
      'Puente / Eje Av. Costanera — Confluencia Bajo Llojeta (Referencia vial)',
    tipo: 'hito_vial_referencial',
    latitud: -16.5294,
    longitud: -68.1341,
    fuente:
      'Referencia cartográfica OpenStreetMap — Demostración académica no validada',
    estado_verificacion: 'sin_verificar',
    activo: true,
  },
  {
    nombre: 'Plaza / Cancha El Vergel — Llojeta (Referencia barrial)',
    tipo: 'referencia_barrial',
    latitud: -16.5211,
    longitud: -68.1468,
    fuente:
      'Referencia cartográfica OpenStreetMap — Demostración académica no validada',
    estado_verificacion: 'sin_verificar',
    activo: true,
  },
  {
    nombre: 'Vía Principal Max Fernández — Llojeta Alto (Referencia vial)',
    tipo: 'hito_vial_referencial',
    latitud: -16.5193,
    longitud: -68.1405,
    fuente:
      'Referencia cartográfica OpenStreetMap — Demostración académica no validada',
    estado_verificacion: 'sin_verificar',
    activo: true,
  },
];

/**
 * Directorio telefónico inicial de contactos de emergencia para La Paz.
 */
export const CONTACTOS_SEMILLA = [
  {
    nombre: 'Red 114 — Emergencias GAMLP (Alcaldía La Paz)',
    telefono: '114',
    fuente: 'Gobierno Autónomo Municipal de La Paz',
    verificado_en: '2026-10-23',
    activo: true,
  },
  {
    nombre: 'Dirección Departamental de Bomberos (La Paz)',
    telefono: '119',
    fuente: 'Policía Boliviana - Bomberos Antofagasta',
    verificado_en: '2026-10-23',
    activo: true,
  },
  {
    nombre: 'Radio Patrulla 110 (Policía Boliviana)',
    telefono: '110',
    fuente: 'Policía Boliviana',
    verificado_en: '2026-10-23',
    activo: true,
  },
];

/**
 * Inserta de manera idempotente las capas y puntos de referencia semilla.
 *
 * @param {import('pg').PoolClient|null} [clientExterno=null] Cliente transaccional opcional
 */
export async function seedCapas(clientExterno = null) {
  const debeManejarConexion = !clientExterno;
  const client = clientExterno || (await pool.connect());

  try {
    if (debeManejarConexion) {
      console.log('[SEED-CAPAS] Iniciando transacción de capas y puntos semilla...');
      await client.query('BEGIN');
    }

    // 1. Zonas de Referencia (Polígonos GeoJSON)
    for (const z of ZONAS_SEMILLA) {
      const existe = await client.query(
        'SELECT id FROM zonas_referencia WHERE nombre = $1 LIMIT 1;',
        [z.nombre]
      );

      if (existe.rows.length === 0) {
        await client.query(
          `INSERT INTO zonas_referencia (nombre, geometria, fuente, fecha_dato, vigente_hasta, verificada, advertencia)
           VALUES ($1, $2, $3, $4, $5, $6, $7);`,
          [
            z.nombre,
            JSON.stringify(z.geometria),
            z.fuente,
            z.fecha_dato,
            z.vigente_hasta,
            z.verificada,
            z.advertencia,
          ]
        );
      } else {
        await client.query(
          `UPDATE zonas_referencia
           SET geometria = $2, fuente = $3, fecha_dato = $4, vigente_hasta = $5, verificada = $6, advertencia = $7
           WHERE id = $1;`,
          [
            existe.rows[0].id,
            JSON.stringify(z.geometria),
            z.fuente,
            z.fecha_dato,
            z.vigente_hasta,
            z.verificada,
            z.advertencia,
          ]
        );
      }
    }
    console.log(`[SEED-CAPAS] ✓ ${ZONAS_SEMILLA.length} polígonos de zonas de referencia sincronizados`);

    // 2. Puntos de Referencia Cartográfica
    for (const p of PUNTOS_SEMILLA) {
      const existe = await client.query(
        'SELECT id FROM puntos_referencia WHERE nombre = $1 LIMIT 1;',
        [p.nombre]
      );

      if (existe.rows.length === 0) {
        await client.query(
          `INSERT INTO puntos_referencia (nombre, tipo, latitud, longitud, fuente, estado_verificacion, activo)
           VALUES ($1, $2, $3, $4, $5, $6, $7);`,
          [
            p.nombre,
            p.tipo,
            p.latitud,
            p.longitud,
            p.fuente,
            p.estado_verificacion,
            p.activo,
          ]
        );
      } else {
        await client.query(
          `UPDATE puntos_referencia
           SET tipo = $2, latitud = $3, longitud = $4, fuente = $5, estado_verificacion = $6, activo = $7
           WHERE id = $1;`,
          [
            existe.rows[0].id,
            p.tipo,
            p.latitud,
            p.longitud,
            p.fuente,
            p.estado_verificacion,
            p.activo,
          ]
        );
      }
    }
    console.log(`[SEED-CAPAS] ✓ ${PUNTOS_SEMILLA.length} puntos de referencia cartográfica sincronizados`);

    // 3. Contactos de Emergencia
    for (const c of CONTACTOS_SEMILLA) {
      const existe = await client.query(
        'SELECT id FROM contactos_emergencia WHERE nombre = $1 LIMIT 1;',
        [c.nombre]
      );

      if (existe.rows.length === 0) {
        await client.query(
          `INSERT INTO contactos_emergencia (nombre, telefono, fuente, verificado_en, activo)
           VALUES ($1, $2, $3, $4, $5);`,
          [c.nombre, c.telefono, c.fuente, c.verificado_en, c.activo]
        );
      } else {
        await client.query(
          `UPDATE contactos_emergencia
           SET telefono = $2, fuente = $3, verificado_en = $4, activo = $5
           WHERE id = $1;`,
          [existe.rows[0].id, c.telefono, c.fuente, c.verificado_en, c.activo]
        );
      }
    }
    console.log(`[SEED-CAPAS] ✓ ${CONTACTOS_SEMILLA.length} contactos de emergencia sincronizados`);

    if (debeManejarConexion) {
      await client.query('COMMIT');
      console.log('[SEED-CAPAS] Transacción completada con éxito.');
    }
  } catch (error) {
    if (debeManejarConexion) {
      await client.query('ROLLBACK');
    }
    console.error('[SEED-CAPAS] ✗ Error durante la carga de capas semilla:', error.message);
    throw error;
  } finally {
    if (debeManejarConexion) {
      client.release();
    }
  }
}

// Ejecución directa por CLI
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  seedCapas()
    .then(async () => {
      await pool.end();
      process.exit(0);
    })
    .catch(async (error) => {
      console.error('[SEED-CAPAS] Falla fatal:', error);
      await pool.end();
      process.exit(1);
    });
}

export default seedCapas;
