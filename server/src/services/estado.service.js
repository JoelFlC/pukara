/**
 * @file estado.service.js
 * @description Servicio que consolida el estado público integral (v1) del sistema PUKARA:
 * última lectura meteorológica, calidad de datos, metadatos de zona piloto, capas y puntos
 * de referencia cartográfica de demostración, recomendaciones y contactos de emergencia.
 */

import { pool } from '../db/pool.js';
import { obtenerConfigZonaPiloto } from '../config/zonaPiloto.js';
import { consultarYRegistrarLecturaReal } from './lecturas.service.js';

export const AVISO_PERMANENTE_OFICIAL =
  'Los niveles Normal, Precaución, Alerta y Emergencia son niveles informativos de lluvia: niveles meteorológicos simulados, calculados con umbrales académicos. No sustituyen alertas ni instrucciones de las autoridades oficiales. PUKARA muestra información bajo consulta y no avisa activamente a la población. Ante una emergencia, atienda las indicaciones oficiales y contacte a los servicios de emergencia.';

/**
 * Obtiene el estado público v1 para la consulta en cliente web/PWA.
 *
 * @param {Object} [opciones]
 * @param {Object} [opciones.db=pool] Cliente o Pool de PostgreSQL
 * @param {Function} [opciones.consultarMeteoFn] Inyección de función de consulta a Open-Meteo
 * @param {Function} [opciones.ahoraFn=() => Date.now()] Inyección de función de reloj
 * @param {boolean} [opciones.forzarConsultaExterna=false]
 * @returns {Promise<Object>} Payload JSON de estado público v1
 */
export async function obtenerEstadoPublicoV1(opciones = {}) {
  const {
    db = pool,
    consultarMeteoFn,
    ahoraFn = () => Date.now(),
    forzarConsultaExterna = false,
  } = opciones;

  const ahoraMs = ahoraFn();
  const configPiloto = obtenerConfigZonaPiloto();

  // 1. Obtener última lectura meteorológica (con gestión de caché en servidor y resiliencia T5)
  const resultadoLectura = await consultarYRegistrarLecturaReal({
    db,
    consultarMeteoFn,
    ahoraFn,
    forzarConsultaExterna,
  });

  // 2. Consulta paralela de catálogos y capas geográficas en PostgreSQL
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
        "SELECT id, nivel, titulo, contenido, version, estado_publicacion, origen, fuente FROM recomendaciones_preventivas WHERE estado_publicacion = 'publicado' ORDER BY id ASC;"
      ),
    ]);

  // Mapeo seguro con números finitos para coordenadas e IDs
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

  const recomendacionesMapeadas = recomendacionesRes.rows.map((r) => ({
    id: Number(r.id),
    nivel: r.nivel,
    titulo: r.titulo,
    contenido: r.contenido,
    version: Number(r.version),
    estado_publicacion: r.estado_publicacion,
    origen: r.origen,
    fuente: r.fuente,
  }));

  const tieneLectura = resultadoLectura.lectura !== null;

  return {
    ok: true,
    version_esquema_api: 'v1',
    modalidad: 'real',
    aviso_permanente: AVISO_PERMANENTE_OFICIAL,
    zona_piloto: {
      nombre: configPiloto.nombre,
      latitud_central: configPiloto.latitud,
      longitud_central: configPiloto.longitud,
      nota_alcance:
        'El nivel informativo se calcula con una sola consulta para toda la zona piloto y no varía espacialmente.',
    },
    estado_operativo: tieneLectura ? 'LECTURA_DISPONIBLE_V1' : 'SIN_DATOS',
    clasificacion: {
      estado_motor: 'PENDIENTE_MOTOR_SEMANA_2',
      nivel_vigente: null,
      mensaje:
        'Vista v1 (Semana 1): motor de clasificación por umbrales e histéresis programado para Semana 2.',
    },
    meteorologia: {
      disponible: tieneLectura,
      origen_respuesta: resultadoLectura.origen_respuesta,
      fallo_api_reciente: resultadoLectura.fallo_api,
      lectura: resultadoLectura.lectura,
      banderas_calidad: resultadoLectura.banderas_calidad,
      nota_modelo:
        'Datos provenientes de modelo meteorológico (Open-Meteo), no equivalen a mediciones de estación pluviométrica local.',
    },
    capas_referencia: {
      leyenda_obligatoria: 'referencia de demostración, no validada',
      zonas: zonasMapeadas,
      puntos: puntosMapeados,
    },
    recomendaciones_publicadas: recomendacionesMapeadas,
    contactos_emergencia: contactosMapeados,
    consultado_en: new Date(ahoraMs).toISOString(),
  };
}

export default {
  AVISO_PERMANENTE_OFICIAL,
  obtenerEstadoPublicoV1,
};
