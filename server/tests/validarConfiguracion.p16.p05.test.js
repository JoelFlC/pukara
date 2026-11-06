/**
 * @file validarConfiguracion.p16.p05.test.js
 * @description Suite de pruebas automatizadas para verificar las reglas oficiales
 * P16 (validación de coherencia matemática, orden creciente y completitud de umbrales)
 * y P05 (versionado inmutable, activación con doble candado, bitácora de auditoría,
 * preservación de evaluaciones históricas y reinicio de contador de descenso).
 */

import { describe, it, expect, beforeEach, afterEach, afterAll } from 'vitest';
import { pool } from '../src/db/pool.js';
import {
  validarUmbralesConfiguracion,
  validarParametrosMotor,
  validarConfiguracionCompleta,
  ConfiguracionInvalidaError,
} from '../src/engine/validarConfiguracion.js';
import {
  obtenerConfiguracionVigente,
  crearVersionConfiguracion,
  activarVersionConfiguracion,
} from '../src/services/configuracion.service.js';
import { siguienteEstado } from '../src/engine/estado.js';
import { insertarLecturaMeteorologica } from '../src/services/lecturas.service.js';

/**
 * Fixture de los 9 umbrales oficiales académicos de PUKARA (V1).
 */
const UMBRALES_V1_OFICIALES = Object.freeze([
  { variable: 'intensidad_mm_h', nivel: 'PRECAUCION', valor: 2.5 },
  { variable: 'intensidad_mm_h', nivel: 'ALERTA', valor: 6.5 },
  { variable: 'intensidad_mm_h', nivel: 'EMERGENCIA', valor: 12.0 },
  { variable: 'acum_24h_mm', nivel: 'PRECAUCION', valor: 10.0 },
  { variable: 'acum_24h_mm', nivel: 'ALERTA', valor: 25.0 },
  { variable: 'acum_24h_mm', nivel: 'EMERGENCIA', valor: 40.0 },
  { variable: 'acum_72h_mm', nivel: 'PRECAUCION', valor: 25.0 },
  { variable: 'acum_72h_mm', nivel: 'ALERTA', valor: 60.0 },
  { variable: 'acum_72h_mm', nivel: 'EMERGENCIA', valor: 90.0 },
]);

/**
 * Limpia quirúrgicamente registros de prueba y restaura la configuración V1 como vigente.
 */
async function restaurarEstadoOriginalBD() {
  // 1. Eliminar evaluaciones asociadas a lecturas de prueba en 2099 o con fuente test
  await pool.query(`
    DELETE FROM evaluaciones_nivel
    WHERE lectura_id IN (
      SELECT id FROM lecturas_meteorologicas
      WHERE observado_en >= '2099-01-01T00:00:00.000Z'
         OR fuente LIKE '%test%'
    );
  `);

  // 2. Eliminar lecturas de prueba
  await pool.query(`
    DELETE FROM lecturas_meteorologicas
    WHERE observado_en >= '2099-01-01T00:00:00.000Z'
       OR fuente LIKE '%test%';
  `);

  // 3. Eliminar bitacora_cambios asociada a configuraciones_reglas con version > 1
  await pool.query(`
    DELETE FROM bitacora_cambios
    WHERE entidad = 'configuraciones_reglas'
      AND entidad_id IN (
        SELECT id FROM configuraciones_reglas WHERE version > 1
      );
  `);

  // 4. Eliminar umbrales y versiones de configuraciones con version > 1
  await pool.query(`
    DELETE FROM umbrales
    WHERE configuracion_id IN (
      SELECT id FROM configuraciones_reglas WHERE version > 1
    );
  `);

  await pool.query(`
    DELETE FROM configuraciones_reglas WHERE version > 1;
  `);

  // 5. Garantizar que version = 1 vuelva a estar 'vigente'
  await pool.query(`
    UPDATE configuraciones_reglas
    SET estado = 'vigente'
    WHERE version = 1;
  `);
}

describe('Validación de Configuraciones y Versionado PUKARA: Reglas P16 y P05', () => {
  // ==========================================================================
  // BLOQUE 1: P16 — Pruebas Unitarias Puras de validarConfiguracion.js
  // ==========================================================================
  describe('Bloque 1: Regla P16 — Validación Pura de Coherencia Matemática y Completitud', () => {
    it('1.1. Configuración académica v1 válida y caso borde 24h === 72h', () => {
      // Configuración canónica V1
      const resV1 = validarConfiguracionCompleta({
        umbrales: UMBRALES_V1_OFICIALES,
      });
      expect(resV1.valida).toBe(true);
      expect(resV1.errores).toHaveLength(0);
      expect(resV1.umbrales_normalizados).toBeDefined();
      expect(resV1.umbrales_lista).toHaveLength(9);

      // Caso borde permitido por P16: acum_24h_mm === acum_72h_mm en un mismo nivel (24h <= 72h)
      const umbralesBorde = UMBRALES_V1_OFICIALES.map((u) => {
        if (u.variable === 'acum_72h_mm' && u.nivel === 'PRECAUCION') {
          return { ...u, valor: 10.0 }; // 24h = 10.0 y 72h = 10.0
        }
        return u;
      });
      const resBorde = validarUmbralesConfiguracion(umbralesBorde);
      expect(resBorde.valida).toBe(true);
      expect(resBorde.errores).toHaveLength(0);
    });

    it('1.2. Rechazo de valores negativos (VALOR_NEGATIVO)', () => {
      const umbralesConNegativo = UMBRALES_V1_OFICIALES.map((u) => {
        if (u.variable === 'intensidad_mm_h' && u.nivel === 'PRECAUCION') {
          return { ...u, valor: -0.1 };
        }
        return u;
      });

      const res = validarUmbralesConfiguracion(umbralesConNegativo);
      expect(res.valida).toBe(false);
      const errNegativo = res.errores.find((e) => e.codigo === 'VALOR_NEGATIVO');
      expect(errNegativo).toBeDefined();
      expect(errNegativo.campo).toBe('intensidad_mm_h.PRECAUCION');
    });

    it('1.3. Rechazo por orden creciente roto PRECAUCION < ALERTA < EMERGENCIA (ORDEN_NIVELES_INVALIDO)', () => {
      // A. PRECAUCION === ALERTA
      const umbralesIguales = UMBRALES_V1_OFICIALES.map((u) => {
        if (u.variable === 'intensidad_mm_h' && u.nivel === 'PRECAUCION') {
          return { ...u, valor: 6.5 }; // Igual a ALERTA (6.5)
        }
        return u;
      });
      const resIguales = validarUmbralesConfiguracion(umbralesIguales);
      expect(resIguales.valida).toBe(false);
      expect(
        resIguales.errores.some((e) => e.codigo === 'ORDEN_NIVELES_INVALIDO')
      ).toBe(true);

      // B. PRECAUCION > ALERTA
      const umbralesInvertidos = UMBRALES_V1_OFICIALES.map((u) => {
        if (u.variable === 'intensidad_mm_h' && u.nivel === 'PRECAUCION') {
          return { ...u, valor: 8.0 }; // Mayor a ALERTA (6.5)
        }
        return u;
      });
      const resInvertidos = validarUmbralesConfiguracion(umbralesInvertidos);
      expect(resInvertidos.valida).toBe(false);
      expect(
        resInvertidos.errores.some((e) => e.codigo === 'ORDEN_NIVELES_INVALIDO')
      ).toBe(true);

      // C. ALERTA >= EMERGENCIA
      const umbralesAlertaMayor = UMBRALES_V1_OFICIALES.map((u) => {
        if (u.variable === 'acum_24h_mm' && u.nivel === 'EMERGENCIA') {
          return { ...u, valor: 20.0 }; // Menor que ALERTA (25.0)
        }
        return u;
      });
      const resAlertaMayor = validarUmbralesConfiguracion(umbralesAlertaMayor);
      expect(resAlertaMayor.valida).toBe(false);
      expect(
        resAlertaMayor.errores.some((e) => e.codigo === 'ORDEN_NIVELES_INVALIDO')
      ).toBe(true);
    });

    it('1.4. Rechazo por umbral de 24 h mayor que el de 72 h (COHERENCIA_24H_72H_INVALIDA)', () => {
      // Caso 1: En nivel PRECAUCION 24h (30 mm) > 72h (25 mm)
      const umbralesIncoherentesPrec = UMBRALES_V1_OFICIALES.map((u) => {
        if (u.variable === 'acum_24h_mm' && u.nivel === 'PRECAUCION') {
          return { ...u, valor: 30.0 };
        }
        return u;
      });
      const resPrec = validarUmbralesConfiguracion(umbralesIncoherentesPrec);
      expect(resPrec.valida).toBe(false);
      const errPrec = resPrec.errores.find(
        (e) => e.codigo === 'COHERENCIA_24H_72H_INVALIDA'
      );
      expect(errPrec).toBeDefined();
      expect(errPrec.campo).toBe('acum_24h_mm.PRECAUCION');

      // Caso 2: En nivel EMERGENCIA 24h (95 mm) > 72h (90 mm)
      const umbralesIncoherentesEmerg = UMBRALES_V1_OFICIALES.map((u) => {
        if (u.variable === 'acum_24h_mm' && u.nivel === 'EMERGENCIA') {
          return { ...u, valor: 95.0 };
        }
        return u;
      });
      const resEmerg = validarUmbralesConfiguracion(umbralesIncoherentesEmerg);
      expect(resEmerg.valida).toBe(false);
      const errEmerg = resEmerg.errores.find(
        (e) => e.codigo === 'COHERENCIA_24H_72H_INVALIDA'
      );
      expect(errEmerg).toBeDefined();
      expect(errEmerg.campo).toBe('acum_24h_mm.EMERGENCIA');
    });

    it('1.5. Rechazo por menos de 9 umbrales (UMBRALES_INCOMPLETOS / CANTIDAD_UMBRALES_INVALIDA)', () => {
      // Enviar solo 8 umbrales
      const soloOcho = UMBRALES_V1_OFICIALES.slice(0, 8);
      const resOcho = validarUmbralesConfiguracion(soloOcho);
      expect(resOcho.valida).toBe(false);
      expect(
        resOcho.errores.some(
          (e) =>
            e.codigo === 'CANTIDAD_UMBRALES_INVALIDA' ||
            e.codigo === 'UMBRALES_INCOMPLETOS'
        )
      ).toBe(true);

      // Enviar mapa sin la clave acum_72h_mm
      const mapaIncompleto = {
        intensidad_mm_h: { PRECAUCION: 2.5, ALERTA: 6.5, EMERGENCIA: 12.0 },
        acum_24h_mm: { PRECAUCION: 10.0, ALERTA: 25.0, EMERGENCIA: 40.0 },
      };
      const resMapaIncompleto = validarUmbralesConfiguracion(mapaIncompleto);
      expect(resMapaIncompleto.valida).toBe(false);
      expect(
        resMapaIncompleto.errores.some((e) => e.codigo === 'UMBRALES_INCOMPLETOS')
      ).toBe(true);
    });

    it('1.6. Validación de parámetros de motor y sanitización', () => {
      const resValido = validarParametrosMotor({
        t_max_minutos: 90,
        separacion_minima_minutos: 20,
        muestras_descenso: 3,
        saturacion: {
          habilitada: true,
          acum_72h_min_mm: 70,
          intensidad_min_mm_h: 3.5,
          nivel_minimo: 'ALERTA',
        },
      });
      expect(resValido.valida).toBe(true);
      expect(resValido.parametros_normalizados.t_max_minutos).toBe(90);

      // Parámetros negativos
      const resInvalido = validarParametrosMotor({
        t_max_minutos: -5,
        separacion_minima_minutos: 0,
        muestras_descenso: 0,
        saturacion: { acum_72h_min_mm: -1 },
      });
      expect(resInvalido.valida).toBe(false);
      expect(resInvalido.errores.length).toBeGreaterThanOrEqual(4);
    });
  });

  // ==========================================================================
  // BLOQUE 2: P05 y P16 en BD — Versionado, Activación, Bitácora y Reinicio
  // ==========================================================================
  describe('Bloque 2: Reglas P05 y P16 en Base de Datos (Versionado, Bitácora e Historial)', () => {
    beforeEach(async () => {
      await restaurarEstadoOriginalBD();
    });

    afterEach(async () => {
      await restaurarEstadoOriginalBD();
    });

    afterAll(async () => {
      await restaurarEstadoOriginalBD();
    });

    it('2.1. Rechazo de guardado de configuración incoherente en el servicio (P16)', async () => {
      const umbralesIncoherentes = UMBRALES_V1_OFICIALES.map((u) => {
        if (u.variable === 'intensidad_mm_h' && u.nivel === 'PRECAUCION') {
          return { ...u, valor: -1.0 }; // Negativo
        }
        return u;
      });

      await expect(
        crearVersionConfiguracion({
          umbrales: umbralesIncoherentes,
          motivo: 'Intento inválido con valor negativo',
        })
      ).rejects.toThrow(ConfiguracionInvalidaError);

      // Comprobar que en PostgreSQL no se insertó ninguna fila con version > 1
      const countRes = await pool.query(
        'SELECT COUNT(*)::int AS total FROM configuraciones_reglas WHERE version > 1;'
      );
      expect(countRes.rows[0].total).toBe(0);
    });

    it('2.2. Rechazo de activación si una configuración en borrador en BD está incompleta (P16)', async () => {
      // 1. Crear una versión válida en borrador (v2)
      const configBorrador = await crearVersionConfiguracion({
        umbrales: UMBRALES_V1_OFICIALES,
        motivo: 'Borrador para prueba de candado de activación',
        estadoInicial: 'borrador',
      });
      expect(configBorrador.id).toBeDefined();
      expect(configBorrador.estado).toBe('borrador');

      // 2. Corromper intencionalmente la versión borrador eliminando 1 umbral directamente en BD
      await pool.query(
        `DELETE FROM umbrales
         WHERE configuracion_id = $1
           AND variable = 'intensidad_mm_h'
           AND nivel = 'EMERGENCIA';`,
        [configBorrador.id]
      );

      // 3. Intentar activar la configuración corrupta
      await expect(
        activarVersionConfiguracion({
          configuracionId: configBorrador.id,
          motivo: 'Intento de activación con umbrales incompletos',
        })
      ).rejects.toThrow(ConfiguracionInvalidaError);

      // 4. Verificar que version = 1 sigue siendo la ÚNICA vigente
      const vigenteRes = await pool.query(
        "SELECT id, version FROM configuraciones_reglas WHERE estado = 'vigente';"
      );
      expect(vigenteRes.rowCount).toBe(1);
      expect(Number(vigenteRes.rows[0].version)).toBe(1);
    });

    it('2.3. Flujo completo P05: Nueva versión, bitácora, historial intacto y reinicio de contador', async () => {
      // 1. Obtener la configuración vigente v1 actual
      const configV1 = await obtenerConfiguracionVigente();
      expect(configV1).not.toBeNull();
      expect(configV1.version).toBe(1);

      // 2. Insertar una lectura real y su evaluación histórica asociada a configV1
      const { lectura: lecturaRealV1 } = await insertarLecturaMeteorologica({
        modalidad: 'real',
        fuente: 'test-p05',
        observado_en: '2099-02-01T10:00:00.000Z',
        intensidad_mm_h: 3.0,
        acum_24h_mm: 12.0,
        acum_72h_mm: 30.0,
        horas_validas_24h: 24,
        horas_validas_72h: 72,
        estado: 'valida',
      });

      const resEvalV1 = await pool.query(
        `INSERT INTO evaluaciones_nivel (
           lectura_id, configuracion_id, nivel_calculado, nivel_vigente,
           estado_sistema, contador_descenso, evaluada_en
         ) VALUES ($1, $2, 'PRECAUCION', 'ALERTA', 'ALERTA', 1, now())
         RETURNING *;`,
        [lecturaRealV1.id, configV1.id]
      );
      const evalHistoricaId = Number(resEvalV1.rows[0].id);

      // 3. Crear y activar una nueva versión válida (v2) con umbrales ajustados
      const umbralesV2 = UMBRALES_V1_OFICIALES.map((u) => {
        if (u.variable === 'intensidad_mm_h') {
          if (u.nivel === 'PRECAUCION') return { ...u, valor: 3.0 };
          if (u.nivel === 'ALERTA') return { ...u, valor: 7.5 };
          if (u.nivel === 'EMERGENCIA') return { ...u, valor: 14.0 };
        }
        return u;
      });

      const configV2 = await crearVersionConfiguracion({
        umbrales: umbralesV2,
        motivo: 'Ajuste académico de prueba P05',
        estadoInicial: 'vigente',
      });

      expect(configV2.version).toBe(2);
      expect(configV2.estado).toBe('vigente');
      expect(configV2.contador_descenso_reiniciado).toBe(true);

      // VERIFICACIONES EN BD (P05):
      // a) Version 2 activa en BD
      const v2EnBd = await pool.query(
        'SELECT * FROM configuraciones_reglas WHERE id = $1;',
        [configV2.id]
      );
      expect(v2EnBd.rows[0].estado).toBe('vigente');
      expect(v2EnBd.rows[0].activada_en).not.toBeNull();

      // b) Version 1 archivada
      const v1EnBd = await pool.query(
        'SELECT * FROM configuraciones_reglas WHERE id = $1;',
        [configV1.id]
      );
      expect(v1EnBd.rows[0].estado).toBe('archivada');

      // c) Auditoría en bitacora_cambios (eventos 'crear' y 'activar')
      const bitacoraRes = await pool.query(
        `SELECT accion, entidad, entidad_id, valor_anterior, valor_nuevo
         FROM bitacora_cambios
         WHERE entidad = 'configuraciones_reglas' AND entidad_id = $1
         ORDER BY id ASC;`,
        [configV2.id]
      );
      expect(bitacoraRes.rowCount).toBeGreaterThanOrEqual(2);
      expect(bitacoraRes.rows[0].accion).toBe('crear');
      expect(bitacoraRes.rows[1].accion).toBe('activar');
      expect(bitacoraRes.rows[1].valor_anterior).not.toBeNull();
      expect(bitacoraRes.rows[1].valor_nuevo).not.toBeNull();

      // d) Evaluación histórica NO modificada ni recalculada
      const evalHistoricaBD = await pool.query(
        'SELECT * FROM evaluaciones_nivel WHERE id = $1;',
        [evalHistoricaId]
      );
      expect(Number(evalHistoricaBD.rows[0].configuracion_id)).toBe(configV1.id);
      expect(evalHistoricaBD.rows[0].nivel_vigente).toBe('ALERTA');
      expect(Number(evalHistoricaBD.rows[0].contador_descenso)).toBe(1);

      // e) Reinicio automático del contador de descenso ante nueva versión (P05)
      // Estado previo con configV1.id y contador_descenso = 1
      const estadoPrevio = {
        nivel_vigente: 'ALERTA',
        ultimo_nivel_calculado: 'PRECAUCION',
        estado_sistema: 'ALERTA',
        contador_descenso: 1,
        candidato_descenso_maximo: 'PRECAUCION',
        configuracion_id: configV1.id,
        ultimo_observado_en: '2099-02-01T10:00:00.000Z',
      };

      // Llega muestra NORMAL evaluada con configV2 (configuracion_id distinta)
      const resNuevaEvaluacion = siguienteEstado(
        estadoPrevio,
        {
          nivel_calculado: 'NORMAL',
          observado_en: '2099-02-01T11:00:00.000Z',
        },
        {
          id: configV2.id,
          t_max_minutos: 60,
          separacion_minima_minutos: 15,
          muestras_descenso: 2,
        }
      );

      // El contador previo se reinició a 0 por el cambio de versión, por lo que
      // la muestra NORMAL inicia una nueva cuenta (contador = 1) y NO completa el descenso
      expect(resNuevaEvaluacion.transicion).toBe('T3_DESCENSO_PENDIENTE');
      expect(resNuevaEvaluacion.contador_descenso).toBe(1);
      expect(resNuevaEvaluacion.nivel_vigente).toBe('ALERTA');
      expect(resNuevaEvaluacion.configuracion_id).toBe(configV2.id);
    });
  });
});
