/**
 * @file estado.service.js
 * @description Servicio que consolida el estado público integral del sistema PUKARA:
 * orquestación del motor de reglas, lectura meteorológica, calidad de datos,
 * metadatos de zona piloto, capas y puntos de referencia de demostración,
 * recomendaciones preventivas y contactos de emergencia.
 */

import { pool } from '../db/pool.js';
import { obtenerConfigZonaPiloto } from '../config/zonaPiloto.js';
import {
  consultarYRegistrarLecturaReal,
  obtenerUltimaLecturaRegistrada,
} from './lecturas.service.js';
import { obtenerConfiguracionVigente } from './configuracion.service.js';
import {
  evaluarLecturaConConfiguracionVigente,
  obtenerHistorialEvaluaciones,
} from './evaluaciones.service.js';
import { derivarEstadoAlConsultar } from '../engine/estado.js';
import { obtenerUltimaEvaluacionPorModalidad } from './simulacion.service.js';

export const AVISO_PERMANENTE_OFICIAL =
  'Los niveles Normal, Precaución, Alerta y Emergencia son niveles informativos de lluvia: niveles meteorológicos simulados, calculados con umbrales académicos. No sustituyen alertas ni instrucciones de las autoridades oficiales. PUKARA muestra información bajo consulta y no avisa activamente a la población. Ante una emergencia, atienda las indicaciones oficiales y contacte a los servicios de emergencia.';

export const BANNER_SIMULACION =
  'DATOS SIMULADOS DE DEMOSTRACIÓN ACADÉMICA';

/**
 * Obtiene el estado actual consolidado del sistema para la modalidad especificada ('real' o 'simulada').
 *
 * @param {Object} [opciones]
 * @param {string} [opciones.modalidad='real'] 'real' o 'simulada'
 * @param {Date|string|number} [opciones.ahora=new Date()] Marca de tiempo de consulta
 * @param {Function} [opciones.ahoraFn] Función inyectable de reloj
 * @param {boolean} [opciones.forzar=false] Forzar consulta externa
 * @param {boolean} [opciones.forzarConsultaExterna=false] Alias de forzar
 * @param {Function} [opciones.fetcher] Función inyectable de consulta meteorológica
 * @param {Function} [opciones.consultarMeteoFn] Alias de fetcher
 * @param {Object} [opciones.db=pool]
 * @returns {Promise<Object>} Payload JSON de estado público
 */
export async function obtenerEstadoActualSistema(opciones = {}) {
  const {
    modalidad = 'real',
    ahora = new Date(),
    forzar = false,
    forzarConsultaExterna = forzar,
    fetcher,
    consultarMeteoFn = fetcher,
    db = pool,
  } = opciones;

  if (modalidad !== 'real' && modalidad !== 'simulada') {
    const err = new Error(
      `Modalidad inválida: "${modalidad}". Debe ser "real" o "simulada".`
    );
    err.statusCode = 400;
    throw err;
  }

  const ahoraFn =
    opciones.ahoraFn ||
    (() =>
      ahora instanceof Date
        ? ahora.getTime()
        : typeof ahora === 'number'
          ? ahora
          : Date.parse(ahora));

  const ahoraMs = ahoraFn();
  const configPiloto = obtenerConfigZonaPiloto();

  // 1. Obtener configuración vigente
  const configVigente = await obtenerConfiguracionVigente({ db });

  let lectura = null;
  let origenRespuesta = 'ninguno';
  let falloApiReciente = false;
  let banderasCalidad = null;
  let resEvaluacion = null;

  if (modalidad === 'real') {
    // 2. Consulta y registro de lectura real con resiliencia T5
    const resultadoLectura = await consultarYRegistrarLecturaReal({
      db,
      consultarMeteoFn,
      ahoraFn,
      forzarConsultaExterna,
    });

    lectura = resultadoLectura.lectura;
    origenRespuesta = resultadoLectura.origen_respuesta;
    falloApiReciente = resultadoLectura.fallo_api;
    banderasCalidad = resultadoLectura.banderas_calidad;

    // 3. Orquestar evaluación con motor de reglas
    if (lectura) {
      resEvaluacion = await evaluarLecturaConConfiguracionVigente(lectura, {
        db,
      });
    }
  } else {
    // Modalidad simulada
    lectura = await obtenerUltimaLecturaRegistrada({
      modalidad: 'simulada',
      db,
    });
    origenRespuesta = 'simulacion_academica';
    falloApiReciente = false;

    if (lectura) {
      resEvaluacion = await evaluarLecturaConConfiguracionVigente(lectura, {
        db,
      });
    }
  }

  // 4. Obtener última evaluación registrada y derivar estado actual ante T_max (P15 / T6)
  const ultimaEval = await obtenerUltimaEvaluacionPorModalidad({
    modalidad,
    db,
  });

  const estadoDerivado = derivarEstadoAlConsultar(ultimaEval, {
    ahora: new Date(ahoraMs),
    t_max_minutos: configVigente?.parametros?.t_max_minutos ?? 60,
    modalidad,
  });

  // 5. Consulta paralela de capas geográficas, recomendaciones y contactos
  const [zonasRes, puntosRes, contactosRes, recomendacionesRes] =
    await Promise.all([
      db.query(
        'SELECT id, nombre, geometria, fuente, fecha_dato, vigente_hasta, verificada, advertencia FROM zonas_referencia ORDER BY id ASC;'
      ),
      db.query(
        'SELECT id, nombre, tipo, latitud, longitud, fuente, estado_verificacion, activo FROM puntos_referencia WHERE activo = true ORDER BY id ASC;'
      ),
      db.query(
        'SELECT id, nombre, telefono, fuente, verificado_en, activo FROM contactos_emergencia WHERE activo = true ORDER BY id ASC;'
      ),
      db.query(
        "SELECT id, nivel, titulo, contenido, version, estado_publicacion, origen, fuente, actualizado_en FROM recomendaciones_preventivas WHERE estado_publicacion = 'publicado' ORDER BY id ASC;"
      ),
    ]);

  const zonasMapeadas = zonasRes.rows.map((z) => ({
    id: Number(z.id),
    nombre: z.nombre,
    geometria: z.geometria,
    fuente: z.fuente,
    fecha_dato: z.fecha_dato,
    vigente_hasta: z.vigente_hasta,
    verificada: z.verificada,
    advertencia: z.advertencia,
  }));

  const puntosMapeados = puntosRes.rows.map((p) => ({
    id: Number(p.id),
    nombre: p.nombre,
    tipo: p.tipo,
    latitud: Number(p.latitud),
    longitud: Number(p.longitud),
    fuente: p.fuente,
    estado_verificacion: p.estado_verificacion,
    activo: p.activo,
  }));

  const contactosMapeados = contactosRes.rows.map((c) => ({
    id: Number(c.id),
    nombre: c.nombre,
    telefono: c.telefono,
    fuente: c.fuente,
    verificado_en: c.verificado_en,
    activo: c.activo,
  }));

  const ORDEN_LOGICO_NIVELES = ['NORMAL', 'PRECAUCION', 'ALERTA', 'EMERGENCIA'];

  const recomendacionesMapeadas = recomendacionesRes.rows
    .map((r) => ({
      id: Number(r.id),
      nivel: r.nivel,
      titulo: r.titulo,
      contenido: r.contenido,
      version: Number(r.version),
      estado_publicacion: r.estado_publicacion,
      origen: r.origen,
      fuente: r.fuente,
      actualizado_en: r.actualizado_en ? new Date(r.actualizado_en).toISOString() : null,
    }))
    .sort((a, b) => {
      const idxA = ORDEN_LOGICO_NIVELES.indexOf(a.nivel);
      const idxB = ORDEN_LOGICO_NIVELES.indexOf(b.nivel);
      return (idxA !== -1 ? idxA : 99) - (idxB !== -1 ? idxB : 99);
    });

  const tieneLectura = lectura !== null;
  const nivelVigenteActual = estadoDerivado.nivel_vigente;
  const nivelRecom = nivelVigenteActual || 'NORMAL';
  const recomendacionesNivelVigente = recomendacionesMapeadas.filter(
    (r) => r.nivel === nivelRecom
  );
  const recomendacionVigente = recomendacionesNivelVigente[0] || null;

  const clasificacion = resEvaluacion?.clasificacion || null;

  return {
    ok: true,
    version_esquema_api: 'v1',
    modalidad,
    es_simulacion: modalidad === 'simulada',
    banner_simulacion:
      modalidad === 'simulada' ? BANNER_SIMULACION : null,
    aviso_permanente: AVISO_PERMANENTE_OFICIAL,
    zona_piloto: {
      nombre: configPiloto.nombre,
      latitud_central: configPiloto.latitud,
      longitud_central: configPiloto.longitud,
      latitud: configPiloto.latitud,
      longitud: configPiloto.longitud,
      nota_alcance:
        'El nivel informativo se calcula con una sola consulta para toda la zona piloto y no varía espacialmente.',
    },
    zonaPiloto: {
      nombre: configPiloto.nombre,
      latitud: configPiloto.latitud,
      longitud: configPiloto.longitud,
      latitud_central: configPiloto.latitud,
      longitud_central: configPiloto.longitud,
    },
    coordenada_central: {
      latitud: configPiloto.latitud,
      longitud: configPiloto.longitud,
    },
    estado_operativo: tieneLectura ? 'LECTURA_DISPONIBLE_V1' : 'SIN_DATOS',
    estado_sistema: estadoDerivado.estado_sistema,
    nivel_vigente: estadoDerivado.nivel_vigente,
    nivel_calculado:
      ultimaEval?.nivel_calculado ?? clasificacion?.nivel_calculado ?? null,
    contador_descenso: estadoDerivado.contador_descenso ?? 0,
    clasificacion_parcial: Boolean(clasificacion?.clasificacion_parcial),
    regla_saturacion_aplicada: Boolean(
      clasificacion?.regla_saturacion_aplicada
    ),
    antiguedad_minutos: estadoDerivado.antiguedad_minutos,
    datos_desactualizados: Boolean(estadoDerivado.datos_desactualizados),
    t_max_minutos: estadoDerivado.t_max_minutos,
    version_reglas: {
      configuracion_id: configVigente?.id ?? 1,
      version: configVigente?.version ?? 1,
      estado: configVigente?.estado ?? 'vigente',
      parametros: configVigente?.parametros ?? {},
    },
    clasificacion: {
      estado_motor: 'PENDIENTE_MOTOR_SEMANA_2',
      nivel_vigente: estadoDerivado.nivel_vigente,
      nivel_calculado:
        ultimaEval?.nivel_calculado ?? clasificacion?.nivel_calculado ?? null,
      contador_descenso: estadoDerivado.contador_descenso ?? 0,
      mensaje:
        'Motor de clasificación por umbrales e histéresis temporal activo en Semana 2.',
    },
    evaluacion: ultimaEval,
    lectura,
    meteorologia: {
      disponible: tieneLectura,
      origen_respuesta: origenRespuesta,
      fallo_api_reciente: falloApiReciente,
      lectura,
      banderas_calidad: banderasCalidad || {
        horas_completas_24h: lectura?.horas_validas_24h === 24,
        horas_completas_72h: lectura?.horas_validas_72h === 72,
        clasificacion_parcial: Boolean(clasificacion?.clasificacion_parcial),
      },
      nota_modelo:
        'Datos provenientes de modelo meteorológico (Open-Meteo), no equivalen a mediciones de estación pluviométrica local.',
    },
    capas_referencia: {
      leyenda_obligatoria: 'referencia de demostración, no validada',
      zonas: zonasMapeadas,
      puntos: puntosMapeados,
    },
    puntos_referencia: puntosMapeados,
    zonas_referencia: zonasMapeadas,
    recomendacion: recomendacionVigente,
    recomendacion_vigente: recomendacionVigente,
    recomendaciones: recomendacionesMapeadas,
    recomendaciones_publicadas: recomendacionesMapeadas,
    recomendaciones_nivel_vigente: recomendacionesNivelVigente,
    contactos: contactosMapeados,
    contactos_emergencia: contactosMapeados,
    parametros_vigentes_resumen: {
      version_reglas: configVigente?.version ?? 1,
      t_max_minutos: configVigente?.parametros?.t_max_minutos ?? 60,
      separacion_minima_minutos:
        configVigente?.parametros?.separacion_minima_minutos ?? 15,
    },
    consultado_en: new Date(ahoraMs).toISOString(),
  };
}

/**
 * Función pública retrocompatible v1 para consulta en cliente web/PWA.
 *
 * @param {Object} [opciones]
 * @returns {Promise<Object>}
 */
export async function obtenerEstadoPublicoV1(opciones = {}) {
  return obtenerEstadoActualSistema(opciones);
}

export default {
  AVISO_PERMANENTE_OFICIAL,
  BANNER_SIMULACION,
  obtenerEstadoActualSistema,
  obtenerEstadoPublicoV1,
};
