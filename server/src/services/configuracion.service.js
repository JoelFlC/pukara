/**
 * @file configuracion.service.js
 * @description Servicio para la consulta y normalización de la configuración de reglas
 * y umbrales vigentes en PUKARA, ratificando los parámetros temporales y de saturación de suelo.
 */

import { pool } from '../db/pool.js';

export const PARAMETROS_DEFECTO_S1 = Object.freeze({
  t_max_minutos: 60,
  separacion_minima_minutos: 15,
  muestras_descenso: 2,
  saturacion: Object.freeze({
    habilitada: true,
    acum_72h_min_mm: 60,
    intensidad_min_mm_h: 2.5,
    nivel_minimo: 'ALERTA',
  }),
});

/**
 * Normaliza los parámetros de configuración de reglas asegurando valores numéricos
 * y estructura segura con fallback a los ratificados en Semana 1.
 *
 * @param {Object|null|undefined} rawParametros
 * @returns {Object} Parámetros normalizados
 */
export function normalizarParametrosReglas(rawParametros = {}) {
  const p = rawParametros || {};
  const sat = p.saturacion || {};

  return {
    t_max_minutos:
      p.t_max_minutos !== undefined && !Number.isNaN(Number(p.t_max_minutos))
        ? Number(p.t_max_minutos)
        : PARAMETROS_DEFECTO_S1.t_max_minutos,
    separacion_minima_minutos:
      p.separacion_minima_minutos !== undefined &&
      !Number.isNaN(Number(p.separacion_minima_minutos))
        ? Number(p.separacion_minima_minutos)
        : PARAMETROS_DEFECTO_S1.separacion_minima_minutos,
    muestras_descenso:
      p.muestras_descenso !== undefined &&
      !Number.isNaN(Number(p.muestras_descenso))
        ? Number(p.muestras_descenso)
        : PARAMETROS_DEFECTO_S1.muestras_descenso,
    saturacion: {
      habilitada:
        sat.habilitada === undefined
          ? PARAMETROS_DEFECTO_S1.saturacion.habilitada
          : Boolean(sat.habilitada),
      acum_72h_min_mm:
        sat.acum_72h_min_mm !== undefined &&
        !Number.isNaN(Number(sat.acum_72h_min_mm))
          ? Number(sat.acum_72h_min_mm)
          : PARAMETROS_DEFECTO_S1.saturacion.acum_72h_min_mm,
      intensidad_min_mm_h:
        sat.intensidad_min_mm_h !== undefined &&
        !Number.isNaN(Number(sat.intensidad_min_mm_h))
          ? Number(sat.intensidad_min_mm_h)
          : PARAMETROS_DEFECTO_S1.saturacion.intensidad_min_mm_h,
      nivel_minimo:
        sat.nivel_minimo || PARAMETROS_DEFECTO_S1.saturacion.nivel_minimo,
    },
  };
}

/**
 * Obtiene la configuración de reglas actualmente vigente en la base de datos
 * junto con sus umbrales asociados, con parámetros normalizados.
 *
 * @param {Object} [opciones]
 * @param {Object} [opciones.db=pool] Cliente o pool de base de datos
 * @returns {Promise<Object|null>} Configuración vigente o null si no existe
 */
export async function obtenerConfiguracionVigente({ db = pool } = {}) {
  const configRes = await db.query(
    "SELECT * FROM configuraciones_reglas WHERE estado = 'vigente' LIMIT 1;"
  );

  if (configRes.rows.length === 0) {
    return null;
  }

  const fila = configRes.rows[0];

  const umbralesRes = await db.query(
    'SELECT variable, nivel, valor FROM umbrales WHERE configuracion_id = $1 ORDER BY variable ASC, valor ASC;',
    [fila.id]
  );

  const umbrales = umbralesRes.rows.map((u) => ({
    variable: u.variable,
    nivel: u.nivel,
    valor: Number(u.valor),
  }));

  const parametros = normalizarParametrosReglas(fila.parametros);

  return {
    id: Number(fila.id),
    version: Number(fila.version),
    estado: fila.estado,
    parametros,
    umbrales,
    creada_por: fila.creada_por ? Number(fila.creada_por) : null,
    creada_en: fila.creada_en,
    activada_en: fila.activada_en,
    motivo: fila.motivo,
  };
}

export default {
  PARAMETROS_DEFECTO_S1,
  normalizarParametrosReglas,
  obtenerConfiguracionVigente,
};
