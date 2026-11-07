import { Router } from 'express';
import {
  requerirAutenticacion,
  requerirRol,
} from '../middleware/auth.middleware.js';
import {
  listarVersionesConfiguracion,
  crearVersionConfiguracion,
  activarVersionConfiguracion,
  ConfiguracionInvalidaError,
  listarRecomendacionesAdmin,
  crearRecomendacionPreventiva,
  actualizarRecomendacionPreventiva,
  listarContactosAdmin,
  crearContactoEmergencia,
  actualizarContactoEmergencia,
  listarCapasAdmin,
  actualizarAtributosZona,
  actualizarAtributosPunto,
  listarBitacoraCambios,
  inyectarLecturaSimuladaConBitacora,
  limpiarSimulacionConBitacora,
} from '../services/admin.service.js';

export const adminRouter = Router();

// Aplica autenticación y autorización de rol 'administrador' a todas las rutas de administración
adminRouter.use(requerirAutenticacion, requerirRol('administrador'));

/**
 * GET /api/admin/resumen
 * Endpoint base de verificación de privilegios y resumen administrativo.
 */
adminRouter.get('/resumen', (req, res) => {
  return res.status(200).json({
    ok: true,
    mensaje: 'Acceso de administración verificado',
    usuario: req.usuario,
    aviso:
      'Los niveles Normal, Precaución, Alerta y Emergencia son niveles informativos de lluvia calculados con umbrales académicos.',
  });
});

// ===========================================================================
// CONFIGURACIONES Y UMBRALES (P05 / P16)
// ===========================================================================

/**
 * GET /api/admin/configuraciones
 * Lista todas las versiones de configuraciones_reglas con sus umbrales asociados.
 */
adminRouter.get('/configuraciones', async (req, res, next) => {
  try {
    const versiones = await listarVersionesConfiguracion();
    return res.status(200).json({
      ok: true,
      total: versiones.length,
      versiones,
    });
  } catch (err) {
    return next(err);
  }
});

/**
 * POST /api/admin/configuraciones
 * Crea una nueva versión inmutable de configuración de reglas y umbrales (P05/P16).
 * Si el body incluye `activar: true`, la activa en la misma operación.
 */
adminRouter.post('/configuraciones', async (req, res, next) => {
  try {
    const { umbrales, parametros, motivo, activar = false } = req.body || {};
    const usuarioId = req.usuario?.id;

    const nuevaConfig = await crearVersionConfiguracion({
      umbrales,
      parametros,
      motivo,
      usuarioId,
      estadoInicial: activar ? 'vigente' : 'borrador',
    });

    return res.status(201).json({
      ok: true,
      mensaje: activar
        ? 'Configuración creada y activada exitosamente'
        : 'Configuración creada en estado borrador',
      configuracion: nuevaConfig,
    });
  } catch (err) {
    if (err instanceof ConfiguracionInvalidaError) {
      return res.status(400).json({
        ok: false,
        error: {
          codigo: 'CONFIGURACION_INVALIDA',
          mensaje: err.message,
          detalles: err.errores || [],
        },
      });
    }
    return next(err);
  }
});

/**
 * POST /api/admin/configuraciones/:id/activar
 * Activa una versión existente de configuración archivando la vigente actual (P05/P16).
 */
adminRouter.post('/configuraciones/:id/activar', async (req, res, next) => {
  try {
    const configuracionId = Number(req.params.id);
    const { motivo } = req.body || {};
    const usuarioId = req.usuario?.id;

    const activada = await activarVersionConfiguracion({
      configuracionId,
      usuarioId,
      motivo,
    });

    return res.status(200).json({
      ok: true,
      mensaje: `Versión ${activada.version} activada exitosamente como vigente`,
      configuracion: activada,
    });
  } catch (err) {
    if (err instanceof ConfiguracionInvalidaError) {
      return res.status(400).json({
        ok: false,
        error: {
          codigo: 'CONFIGURACION_INVALIDA',
          mensaje: err.message,
          detalles: err.errores || [],
        },
      });
    }
    return next(err);
  }
});

// ===========================================================================
// RECOMENDACIONES PREVENTIVAS
// ===========================================================================

/**
 * GET /api/admin/recomendaciones
 * Lista todas las recomendaciones preventivas por nivel y versión.
 */
adminRouter.get('/recomendaciones', async (req, res, next) => {
  try {
    const recomendaciones = await listarRecomendacionesAdmin();
    return res.status(200).json({
      ok: true,
      total: recomendaciones.length,
      recomendaciones,
    });
  } catch (err) {
    return next(err);
  }
});

/**
 * POST /api/admin/recomendaciones
 * Crea una nueva versión de recomendación preventiva para un nivel informativo.
 */
adminRouter.post('/recomendaciones', async (req, res, next) => {
  try {
    const usuarioId = req.usuario?.id;
    const nuevaRec = await crearRecomendacionPreventiva(req.body, usuarioId);

    return res.status(201).json({
      ok: true,
      mensaje: 'Recomendación preventiva creada exitosamente',
      recomendacion: nuevaRec,
    });
  } catch (err) {
    if (err.statusCode === 400) {
      return res.status(400).json({
        ok: false,
        error: {
          codigo: 'DATOS_INVALIDOS',
          mensaje: err.message,
        },
      });
    }
    return next(err);
  }
});

/**
 * PUT /api/admin/recomendaciones/:id
 * Actualiza una recomendación preventiva existente.
 */
adminRouter.put('/recomendaciones/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const usuarioId = req.usuario?.id;
    const actualizada = await actualizarRecomendacionPreventiva(
      id,
      req.body,
      usuarioId
    );

    return res.status(200).json({
      ok: true,
      mensaje: 'Recomendación preventiva actualizada exitosamente',
      recomendacion: actualizada,
    });
  } catch (err) {
    if (err.statusCode === 404) {
      return res.status(404).json({
        ok: false,
        error: { codigo: 'NO_ENCONTRADO', mensaje: err.message },
      });
    }
    if (err.statusCode === 400) {
      return res.status(400).json({
        ok: false,
        error: { codigo: 'DATOS_INVALIDOS', mensaje: err.message },
      });
    }
    return next(err);
  }
});

// ===========================================================================
// CONTACTOS DE EMERGENCIA
// ===========================================================================

/**
 * GET /api/admin/contactos
 * Lista todos los contactos de emergencia.
 */
adminRouter.get('/contactos', async (req, res, next) => {
  try {
    const contactos = await listarContactosAdmin();
    return res.status(200).json({
      ok: true,
      total: contactos.length,
      contactos,
    });
  } catch (err) {
    return next(err);
  }
});

/**
 * POST /api/admin/contactos
 * Registra un nuevo contacto de emergencia.
 */
adminRouter.post('/contactos', async (req, res, next) => {
  try {
    const usuarioId = req.usuario?.id;
    const nuevo = await crearContactoEmergencia(req.body, usuarioId);

    return res.status(201).json({
      ok: true,
      mensaje: 'Contacto de emergencia registrado exitosamente',
      contacto: nuevo,
    });
  } catch (err) {
    if (err.statusCode === 400) {
      return res.status(400).json({
        ok: false,
        error: { codigo: 'DATOS_INVALIDOS', mensaje: err.message },
      });
    }
    return next(err);
  }
});

/**
 * PUT /api/admin/contactos/:id
 * Actualiza un contacto de emergencia existente.
 */
adminRouter.put('/contactos/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const usuarioId = req.usuario?.id;
    const actualizado = await actualizarContactoEmergencia(
      id,
      req.body,
      usuarioId
    );

    return res.status(200).json({
      ok: true,
      mensaje: 'Contacto de emergencia actualizado exitosamente',
      contacto: actualizado,
    });
  } catch (err) {
    if (err.statusCode === 404) {
      return res.status(404).json({
        ok: false,
        error: { codigo: 'NO_ENCONTRADO', mensaje: err.message },
      });
    }
    if (err.statusCode === 400) {
      return res.status(400).json({
        ok: false,
        error: { codigo: 'DATOS_INVALIDOS', mensaje: err.message },
      });
    }
    return next(err);
  }
});

// ===========================================================================
// CAPAS Y PUNTOS DE REFERENCIA CARTOGRÁFICA
// ===========================================================================

/**
 * GET /api/admin/capas
 * Lista zonas y puntos de referencia para administración.
 */
adminRouter.get('/capas', async (req, res, next) => {
  try {
    const capas = await listarCapasAdmin();
    return res.status(200).json({
      ok: true,
      ...capas,
    });
  } catch (err) {
    return next(err);
  }
});

/**
 * PUT /api/admin/zonas/:id
 * Actualiza únicamente los atributos descriptivos de una zona de referencia (geometría inmutable).
 */
adminRouter.put('/zonas/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const usuarioId = req.usuario?.id;
    const actualizada = await actualizarAtributosZona(id, req.body, usuarioId);

    return res.status(200).json({
      ok: true,
      mensaje: 'Atributos de zona de referencia actualizados exitosamente',
      zona: actualizada,
    });
  } catch (err) {
    if (err.statusCode === 404) {
      return res.status(404).json({
        ok: false,
        error: { codigo: 'NO_ENCONTRADO', mensaje: err.message },
      });
    }
    if (err.statusCode === 400) {
      return res.status(400).json({
        ok: false,
        error: { codigo: 'DATOS_INVALIDOS', mensaje: err.message },
      });
    }
    return next(err);
  }
});

/**
 * PUT /api/admin/puntos/:id
 * Actualiza únicamente los atributos descriptivos de un punto de referencia (coordenadas inmutables).
 */
adminRouter.put('/puntos/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const usuarioId = req.usuario?.id;
    const actualizado = await actualizarAtributosPunto(id, req.body, usuarioId);

    return res.status(200).json({
      ok: true,
      mensaje: 'Atributos de punto de referencia actualizados exitosamente',
      punto: actualizado,
    });
  } catch (err) {
    if (err.statusCode === 404) {
      return res.status(404).json({
        ok: false,
        error: { codigo: 'NO_ENCONTRADO', mensaje: err.message },
      });
    }
    if (err.statusCode === 400) {
      return res.status(400).json({
        ok: false,
        error: { codigo: 'DATOS_INVALIDOS', mensaje: err.message },
      });
    }
    return next(err);
  }
});

// ===========================================================================
// BITÁCORA DE CAMBIOS
// ===========================================================================

/**
 * GET /api/admin/bitacora
 * Consulta el historial de cambios y auditoría de la plataforma.
 */
adminRouter.get('/bitacora', async (req, res, next) => {
  try {
    const { limite, entidad } = req.query;
    const registros = await listarBitacoraCambios({ limite, entidad });

    return res.status(200).json({
      ok: true,
      total: registros.length,
      registros,
    });
  } catch (err) {
    return next(err);
  }
});

// ===========================================================================
// MODO DEMOSTRACIÓN / SIMULACIÓN (CON AUDITORÍA EN BITÁCORA)
// ===========================================================================

/**
 * POST /api/admin/simulacion/lectura
 * Inyecta una lectura simulada desde el panel administrativo y registra en bitácora.
 */
adminRouter.post('/simulacion/lectura', async (req, res, next) => {
  try {
    const usuarioId = req.usuario?.id;
    const resultado = await inyectarLecturaSimuladaConBitacora(
      req.body,
      usuarioId
    );

    return res.status(201).json({
      ok: true,
      mensaje: 'Lectura simulada procesada y registrada en bitácora',
      ...resultado,
    });
  } catch (err) {
    return next(err);
  }
});

/**
 * DELETE /api/admin/simulacion
 * Limpia los datos simulados desde el panel administrativo y registra en bitácora.
 */
adminRouter.delete('/simulacion', async (req, res, next) => {
  try {
    const usuarioId = req.usuario?.id;
    const resultado = await limpiarSimulacionConBitacora(usuarioId);

    return res.status(200).json({
      ok: true,
      ...resultado,
    });
  } catch (err) {
    return next(err);
  }
});
