import { Router } from 'express';
import { pool } from '../db/pool.js';
import { obtenerIpCliente } from '../middleware/rateLimit.middleware.js';
import { obtenerUltimaEvaluacionPorModalidad } from '../services/simulacion.service.js';
import { NIVELES_VALIDOS_ASISTENTE } from '../services/asistenteGuardrails.js';
import { consultarAsistente } from '../services/asistenteLlmService.js';

export const asistenteRouter = Router();

const VENTANA_RATE_LIMIT_MS = 60 * 1000;
const MAX_PETICIONES_ASISTENTE = 20;
const registrosRateLimit = new Map();

/**
 * Middleware suave de rate limiting por IP para POST /api/asistente (20 req/min).
 */
export function rateLimiterAsistente(req, res, next) {
  const ip = obtenerIpCliente(req);
  const ahora = Date.now();
  const registro = registrosRateLimit.get(ip);

  if (!registro || ahora - registro.inicio > VENTANA_RATE_LIMIT_MS) {
    registrosRateLimit.set(ip, { count: 1, inicio: ahora });
    return next();
  }

  if (registro.count >= MAX_PETICIONES_ASISTENTE) {
    const retryAfter = Math.max(
      1,
      Math.ceil((registro.inicio + VENTANA_RATE_LIMIT_MS - ahora) / 1000)
    );
    res.setHeader('Retry-After', String(retryAfter));
    return res.status(429).json({
      error:
        'Demasiadas consultas al asistente en un minuto. Por favor espera unos segundos.',
    });
  }

  registro.count += 1;
  return next();
}

export function limpiarRateLimiterAsistente() {
  registrosRateLimit.clear();
}

async function resolverContextoVigente(contextoSimulacion = null) {
  if (
    contextoSimulacion &&
    typeof contextoSimulacion === 'object' &&
    contextoSimulacion.esSimulacion === true
  ) {
    const nivelSim = String(
      contextoSimulacion.nivelVigente || 'NORMAL'
    ).toUpperCase();
    const nivelValido = NIVELES_VALIDOS_ASISTENTE.includes(nivelSim)
      ? nivelSim
      : 'NORMAL';

    const tituloRec =
      typeof contextoSimulacion.recomendacionVigente?.titulo === 'string'
        ? contextoSimulacion.recomendacionVigente.titulo.slice(0, 120)
        : undefined;
    const contenidoRec =
      typeof contextoSimulacion.recomendacionVigente?.contenido === 'string'
        ? contextoSimulacion.recomendacionVigente.contenido.slice(0, 320)
        : undefined;

    return {
      nivelVigente: nivelValido,
      estadoSistema: nivelValido,
      esSimulacion: true,
      antiguedadMinutos: 0,
      recomendacionVigente:
        tituloRec || contenidoRec
          ? { titulo: tituloRec || `Nivel ${nivelValido}`, contenido: contenidoRec || '' }
          : null,
    };
  }

  try {
    const ultima = await obtenerUltimaEvaluacionPorModalidad({
      modalidad: 'real',
      db: pool,
    });

    if (!ultima) {
      return {
        nivelVigente: 'NORMAL',
        estadoSistema: 'SIN_DATOS',
        esSimulacion: false,
        antiguedadMinutos: null,
        recomendacionVigente: null,
      };
    }

    const nivelVigente = NIVELES_VALIDOS_ASISTENTE.includes(ultima.nivel_vigente)
      ? ultima.nivel_vigente
      : 'NORMAL';
    const antiguedadMinutos = ultima.observado_en
      ? Math.max(
          0,
          Math.round(
            (Date.now() - new Date(ultima.observado_en).getTime()) / 60000
          )
        )
      : null;

    const { rows: recs } = await pool.query(
      `SELECT titulo, contenido
       FROM recomendaciones_preventivas
       WHERE nivel = $1 AND estado_publicacion = 'publicada'
       ORDER BY version DESC, id DESC
       LIMIT 1;`,
      [nivelVigente]
    );

    return {
      nivelVigente,
      estadoSistema: ultima.estado_sistema || nivelVigente,
      esSimulacion: false,
      antiguedadMinutos,
      recomendacionVigente: recs?.[0] || null,
    };
  } catch {
    return {
      nivelVigente: 'NORMAL',
      estadoSistema: 'NORMAL',
      esSimulacion: false,
      antiguedadMinutos: null,
      recomendacionVigente: null,
    };
  }
}

/**
 * POST /api/asistente
 * Procesa una consulta ciudadana al Asistente Preventivo "Zorrito" con cascada LLM + guardrails.
 */
asistenteRouter.post('/', rateLimiterAsistente, async (req, res, next) => {
  try {
    const { mensaje, contextoSimulacion } = req.body || {};
    if (typeof mensaje !== 'string' || !mensaje.trim()) {
      return res.status(400).json({
        error: 'El campo "mensaje" es obligatorio y no puede estar vacío.',
      });
    }

    const contextoEstado = await resolverContextoVigente(contextoSimulacion);
    const resultado = await consultarAsistente(mensaje, contextoEstado);

    return res.status(200).json({
      respuesta: resultado.respuesta,
      origen: resultado.origen,
      bloqueada: resultado.bloqueada,
    });
  } catch (err) {
    return next(err);
  }
});

export default asistenteRouter;
