import { describe, it, expect, afterAll } from 'vitest';
import { pool } from '../src/db/pool.js';

describe('Modelo de Datos, Esquema y Datos Semilla (S1D2)', () => {
  afterAll(async () => {
    await pool.end();
  });

  const TABLAS_OBLIGATORIAS = [
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

  it('1. Debe contener exactamente las 10 tablas de dominio del modelo relacional', async () => {
    const res = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name;
    `);

    const tablasExistentes = res.rows.map((r) => r.table_name);
    for (const tabla of TABLAS_OBLIGATORIAS) {
      expect(tablasExistentes).toContain(tabla);
    }
  });

  it('2. Debe contener la configuración v1 vigente y sus 9 umbrales académicos exactos', async () => {
    // Verificar configuración v1 vigente
    const resConfig = await pool.query(`
      SELECT id, version, estado, parametros 
      FROM configuraciones_reglas 
      WHERE estado = 'vigente';
    `);

    expect(resConfig.rows.length).toBe(1);
    const config = resConfig.rows[0];
    expect(config.version).toBe(1);
    expect(config.parametros.t_max_minutos).toBe(60);
    expect(config.parametros.muestras_descenso).toBe(2);
    expect(config.parametros.saturacion.habilitada).toBe(true);
    expect(config.parametros.saturacion.acum_72h_min_mm).toBe(60);
    expect(config.parametros.saturacion.intensidad_min_mm_h).toBe(2.5);

    // Verificar los 9 umbrales obligatorios
    const resUmbrales = await pool.query(
      `SELECT variable, nivel, valor 
       FROM umbrales 
       WHERE configuracion_id = $1 
       ORDER BY variable, nivel;`,
      [config.id]
    );

    expect(resUmbrales.rows.length).toBe(9);

    const mapaUmbrales = {};
    for (const row of resUmbrales.rows) {
      mapaUmbrales[`${row.variable}_${row.nivel}`] = parseFloat(row.valor);
    }

    // Intensidad horaria (mm/h)
    expect(mapaUmbrales['intensidad_mm_h_PRECAUCION']).toBe(2.5);
    expect(mapaUmbrales['intensidad_mm_h_ALERTA']).toBe(6.5);
    expect(mapaUmbrales['intensidad_mm_h_EMERGENCIA']).toBe(12.0);

    // Acumulado 24 horas (mm)
    expect(mapaUmbrales['acum_24h_mm_PRECAUCION']).toBe(10.0);
    expect(mapaUmbrales['acum_24h_mm_ALERTA']).toBe(25.0);
    expect(mapaUmbrales['acum_24h_mm_EMERGENCIA']).toBe(40.0);

    // Acumulado 72 horas (mm)
    expect(mapaUmbrales['acum_72h_mm_PRECAUCION']).toBe(25.0);
    expect(mapaUmbrales['acum_72h_mm_ALERTA']).toBe(60.0);
    expect(mapaUmbrales['acum_72h_mm_EMERGENCIA']).toBe(90.0);
  });

  it('3. Debe impedir una segunda configuración vigente por el índice único parcial (error 23505)', async () => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const userRes = await client.query('SELECT id FROM usuarios LIMIT 1;');
      const userId = userRes.rows[0].id;

      let errorCapturado = null;
      try {
        await client.query(
          `INSERT INTO configuraciones_reglas (version, estado, parametros, creada_por)
           VALUES (999, 'vigente', '{"t_max_minutos": 30}', $1);`,
          [userId]
        );
      } catch (err) {
        errorCapturado = err;
      }

      expect(errorCapturado).not.toBeNull();
      // Código PostgreSQL 23505: unique_violation
      expect(errorCapturado.code).toBe('23505');
      expect(errorCapturado.constraint).toBe('idx_unica_configuracion_vigente');
    } finally {
      await client.query('ROLLBACK');
      client.release();
    }
  });

  it('4. Debe rechazar umbrales con valor negativo por restricción CHECK (error 23514)', async () => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const configRes = await client.query('SELECT id FROM configuraciones_reglas LIMIT 1;');
      const configId = configRes.rows[0].id;

      let errorCapturado = null;
      try {
        await client.query(
          `INSERT INTO umbrales (configuracion_id, variable, nivel, valor)
           VALUES ($1, 'intensidad_mm_h', 'PRECAUCION', -1.00);`,
          [configId]
        );
      } catch (err) {
        errorCapturado = err;
      }

      expect(errorCapturado).not.toBeNull();
      // Código PostgreSQL 23514: check_violation
      expect(errorCapturado.code).toBe('23514');
    } finally {
      await client.query('ROLLBACK');
      client.release();
    }
  });

  it('5. Debe impedir duplicados en lecturas meteorológicas por restricción UNIQUE (error 23505)', async () => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const fechaObservada = '2026-10-23T12:00:00Z';

      await client.query(
        `INSERT INTO lecturas_meteorologicas (modalidad, fuente, observado_en, estado, intensidad_mm_h)
         VALUES ('real', 'open-meteo', $1, 'valida', 5.0);`,
        [fechaObservada]
      );

      let errorCapturado = null;
      try {
        await client.query(
          `INSERT INTO lecturas_meteorologicas (modalidad, fuente, observado_en, estado, intensidad_mm_h)
           VALUES ('real', 'open-meteo', $1, 'valida', 8.0);`,
          [fechaObservada]
        );
      } catch (err) {
        errorCapturado = err;
      }

      expect(errorCapturado).not.toBeNull();
      // Código PostgreSQL 23505: unique_violation
      expect(errorCapturado.code).toBe('23505');
      expect(errorCapturado.constraint).toBe('uq_lectura_modalidad_fuente_obs');
    } finally {
      await client.query('ROLLBACK');
      client.release();
    }
  });
});
