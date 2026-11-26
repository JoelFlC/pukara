/**
 * @file asistenteZorritoData.js
 * @description Base de conocimiento 100% determinista y offline del Asistente Preventivo
 * "Zorrito" de PUKARA, respetando estrictamente la lista blanca y lista negra semántica.
 */

import {
  formatearFechaHoraLaPaz,
  formatearAntiguedad,
} from '../utils/formatoTiempo';

export const IMAGENES_ZORRITO = {
  saludo: '/assets/mascota/zorritoSaludo.png',
  normal: '/assets/mascota/zorrito.png',
  cartel: '/assets/mascota/zorritoCartel.png',
  megafono: '/assets/mascota/zorritoMegafono.png',
};

const DESCRIPCION_SPRITE = {
  saludo: 'Zorrito de PUKARA saludando con entusiasmo',
  normal: 'Zorrito de PUKARA acompañando la consulta preventiva',
  cartel: 'Zorrito de PUKARA sosteniendo un cartel informativo',
  megafono: 'Zorrito de PUKARA con megáfono preventivo',
};

export const MENSAJES_POR_NIVEL = {
  NORMAL: [
    'Todo tranquilo en Llojeta. Buen momento para revisar desagües y completar tu checklist familiar.',
    'Nivel informativo de lluvia: NORMAL. Aprovechemos la calma para preparar linterna y documentos.',
    'Sin lluvias intensas por ahora en el sector. Recuerda que PUKARA es informativo y no sustituye canales oficiales.',
  ],
  PRECAUCION: [
    'Lluvia moderada en Llojeta. Evita acercarte a cauces o quebradas y ten tu linterna a la mano.',
    'Nivel informativo de lluvia: PRECAUCIÓN. Revisa canaletas y mantén los documentos protegidos.',
    'Conviene estar atento a escorrentías en la ladera y seguir las recomendaciones preventivas generales.',
  ],
  ALERTA: [
    'Lluvia intensa o suelo saturado en Llojeta. Aléjate de quebradas y taludes; sigue los canales oficiales.',
    'Nivel informativo de lluvia: ALERTA. Ten lista tu mochila familiar y los teléfonos 114 y 119.',
    'Atención en Bajo Llojeta: evita circular por bordes de ríos y mantente informado por autoridades oficiales.',
  ],
  EMERGENCIA: [
    'Lluvia crítica según los umbrales académicos. No cruces zonas con agua o lodo y contacta al 114 o 119.',
    'Nivel informativo de lluvia: EMERGENCIA. Atiende de inmediato las indicaciones de las autoridades oficiales.',
    'Mantén la calma, resguárdate en un sitio alto y firme dentro de tu entorno y llama a los servicios de emergencia.',
  ],
  SIN_DATOS: [
    'Aún no llegan lecturas válidas de lluvia. No asumimos normalidad; revisa tu checklist mientras se actualiza.',
    'Estado sin datos meteorológicos válidos. Puedes usar el checklist familiar y la lectura por voz sin internet.',
  ],
  DATOS_DESACTUALIZADOS: [
    'Los datos superaron el tiempo de vigencia configurado. Mostramos el último nivel informativo conocido.',
    'Lectura desactualizada: verifica si tienes conexión o consulta los teléfonos de emergencia si notas lluvia fuerte.',
  ],
};

export const MENSAJES_CONTEXTO = {
  offline:
    'Estás sin internet, pero sigo contigo: ves el último dato guardado, el checklist familiar y la lectura por voz.',
  simulacion:
    'Estamos en modo simulación académica probando niveles. Estos valores no alteran el estado real de Llojeta.',
  checklistProgreso:
    '¡Excelente paso! Cada punto marcado fortalece la preparación preventiva de tu familia.',
  checklistCompleto:
    '¡Felicidades! Completaste al 100% tu checklist familiar preventivo de PUKARA.',
};

/**
 * Devuelve un saludo amigable adaptado a la hora del día.
 * @param {number} [hora]
 * @returns {string}
 */
export function obtenerSaludoBienvenida(hora = new Date().getHours()) {
  if (hora >= 5 && hora < 12) {
    return '¡Buenos días, vecino de Llojeta! Soy Zorrito, tu guía preventivo offline en PUKARA.';
  }
  if (hora >= 12 && hora < 19) {
    return '¡Buenas tardes, Llojeta! Soy Zorrito. Estoy aquí para explicarte el nivel informativo de lluvia.';
  }
  return '¡Buenas noches, Llojeta! Soy Zorrito. Revisa conmigo el estado preventivo y tu checklist familiar.';
}

function elegirVariante(lista, indice = 0) {
  if (!Array.isArray(lista) || lista.length === 0) {
    return '';
  }
  const idx = Math.abs(Number(indice) || 0) % lista.length;
  return lista[idx];
}

/**
 * Resuelve la ilustración, el modo visual estilo Duolingo y el mensaje contextual del Zorrito.
 *
 * @param {Object} [params]
 * @returns {{
 *   spriteClave: 'saludo'|'normal'|'cartel'|'megafono',
 *   modoVisual: 'saludo_libre'|'presentando_cartel'|'loco_alerta'|'recuadro_normal',
 *   sinCuadro: boolean,
 *   imagen: string,
 *   alt: string,
 *   mensaje: string
 * }}
 */
export function resolverEstadoVisualZorrito({
  nivelVigente = 'NORMAL',
  estadoSistema = 'NORMAL',
  estaOffline = false,
  esSimulacion = false,
  leyendoVoz = false,
  esBienvenida = false,
  checklistCelebracion = false,
  indice = 0,
  hora = 12,
} = {}) {
  const nivel = String(nivelVigente || 'NORMAL').toUpperCase();
  const sistema = String(estadoSistema || nivel).toUpperCase();

  let spriteClave = 'normal';
  let modoVisual = 'recuadro_normal';
  let sinCuadro = false;

  if (leyendoVoz) {
    // Al leer cualquier tarjeta o respuesta, Zorrito sale del cuadro con su cartel
    spriteClave = 'cartel';
    modoVisual = 'presentando_cartel';
    sinCuadro = true;
  } else if (nivel === 'EMERGENCIA' || nivel === 'ALERTA') {
    // En Alerta / Emergencia, Zorrito vibra y agita el megáfono con máxima energía
    spriteClave = 'megafono';
    modoVisual = 'loco_alerta';
    sinCuadro = true;
  } else if (esBienvenida || checklistCelebracion) {
    // Al entrar o celebrar checklist completo, saluda de forma libre y transparente sin recuadro
    spriteClave = 'saludo';
    modoVisual = 'saludo_libre';
    sinCuadro = true;
  } else if (
    estaOffline ||
    esSimulacion ||
    nivel === 'PRECAUCION' ||
    sistema === 'SIN_DATOS' ||
    sistema === 'DATOS_DESACTUALIZADOS'
  ) {
    spriteClave = 'cartel';
    modoVisual = 'recuadro_normal';
    sinCuadro = false;
  }

  let mensaje = '';
  if (checklistCelebracion) {
    mensaje = MENSAJES_CONTEXTO.checklistCompleto;
  } else if (esBienvenida && nivel === 'NORMAL' && !estaOffline && !esSimulacion) {
    mensaje = obtenerSaludoBienvenida(hora);
  } else if (estaOffline) {
    mensaje = MENSAJES_CONTEXTO.offline;
  } else if (esSimulacion) {
    const baseNivel = elegirVariante(
      MENSAJES_POR_NIVEL[nivel] || MENSAJES_POR_NIVEL.NORMAL,
      indice
    );
    mensaje = `${MENSAJES_CONTEXTO.simulacion} ${baseNivel}`;
  } else if (sistema === 'SIN_DATOS') {
    mensaje = elegirVariante(MENSAJES_POR_NIVEL.SIN_DATOS, indice);
  } else if (sistema === 'DATOS_DESACTUALIZADOS') {
    mensaje = elegirVariante(MENSAJES_POR_NIVEL.DATOS_DESACTUALIZADOS, indice);
  } else {
    mensaje = elegirVariante(
      MENSAJES_POR_NIVEL[nivel] || MENSAJES_POR_NIVEL.NORMAL,
      indice
    );
  }

  return {
    spriteClave,
    modoVisual,
    sinCuadro,
    imagen: IMAGENES_ZORRITO[spriteClave],
    alt: DESCRIPCION_SPRITE[spriteClave],
    mensaje,
  };
}

function describirNivelActual({ nivelVigente, estadoSistema, esSimulacion }) {
  const nivel = String(nivelVigente || 'NORMAL').toUpperCase();
  const sufijoMod = esSimulacion
    ? ' (actualmente estás viendo una demostración en Modo Simulación)'
    : '';

  if (estadoSistema === 'SIN_DATOS') {
    return `Actualmente el sistema está en estado SIN DATOS METEOROLÓGICOS VÁLIDOS${sufijoMod}. PUKARA nunca asume normalidad si faltan mediciones; conviene mantener la precaución básica y revisar las recomendaciones preventivas generales.`;
  }

  const textos = {
    NORMAL: `El nivel informativo de lluvia vigente es NORMAL${sufijoMod}. Indica precipitaciones habituales y estables en Llojeta / Bajo Llojeta, calculadas con umbrales académicos. Recuerda que no sustituye alertas ni instrucciones de las autoridades oficiales.`,
    PRECAUCION: `El nivel informativo de lluvia vigente es PRECAUCIÓN${sufijoMod}. Significa lluvia moderada que amerita revisar canaletas, evitar cauces y mantener linterna y documentos listos. Es una referencia informativa académica y no sustituye alertas de autoridades oficiales.`,
    ALERTA: `El nivel informativo de lluvia vigente es ALERTA${sufijoMod}. Señala lluvia fuerte o humedad acumulada relevante en la zona. Mantén distancia de quebradas y taludes, prepara tu mochila familiar y atiende los canales oficiales.`,
    EMERGENCIA: `El nivel informativo de lluvia vigente es EMERGENCIA${sufijoMod}. Refleja lluvia crítica o saturación elevada según los umbrales académicos de PUKARA. No sustituye avisos de las autoridades oficiales; ante riesgo real llama de inmediato al 114 (GAMLP) o 119 (Bomberos).`,
  };

  return textos[nivel] || textos.NORMAL;
}

export const PREGUNTAS_FRECUENTES = [
  {
    id: 'nivel-actual',
    pregunta: '¿Qué significa el nivel informativo actual?',
    palabrasClave: ['nivel', 'significa', 'estado', 'actual', 'semaforo', 'color'],
    responder: (ctx = {}) => describirNivelActual(ctx),
  },
  {
    id: 'que-hacer',
    pregunta: '¿Qué debo hacer ahora mismo?',
    palabrasClave: ['hacer', 'ahora', 'recomendacion', 'pasos', 'medidas', 'consejo'],
    responder: (ctx = {}) => {
      const nivel = String(ctx.nivelVigente || 'NORMAL').toUpperCase();
      const rec = ctx.recomendacionVigente;
      const detalleRec = rec?.contenido
        ? ` Recomendación vigente: ${rec.contenido}`
        : '';
      const nota =
        ' Estas son recomendaciones preventivas generales de carácter informativo y no sustituyen indicaciones de las autoridades oficiales.';

      if (nivel === 'EMERGENCIA') {
        return `Para el nivel informativo de lluvia EMERGENCIA: evita cruzar calles inundadas o sectores con lodo, aléjate de quebradas y comunícate directamente con los servicios de emergencia (114 GAMLP, 119 Bomberos, 115 Defensa Civil).${detalleRec}${nota}`;
      }
      if (nivel === 'ALERTA') {
        return `Para el nivel informativo de lluvia ALERTA: mantente lejos de ríos, taludes y quebradas de Llojeta, ten a mano tu mochila familiar y sigue las comunicaciones oficiales.${detalleRec}${nota}`;
      }
      if (nivel === 'PRECAUCION') {
        return `Para el nivel informativo de lluvia PRECAUCIÓN: limpia desagües y canaletas domiciliarias, evita acercarte a quebradas y verifica tu linterna y teléfonos de auxilio.${detalleRec}${nota}`;
      }
      return `Para el nivel informativo de lluvia NORMAL: aprovecha la tranquilidad para revisar sumideros, completar el checklist familiar y ubicar los teléfonos de emergencia.${detalleRec}${nota}`;
    },
  },
  {
    id: 'histeresis-saturacion',
    pregunta: '¿Por qué el nivel puede subir rápido pero baja despacio?',
    palabrasClave: ['baja', 'despacio', 'sube', 'rapido', 'histeresis', '72', 'saturacion', 'suelo'],
    responder: () =>
      'Para cuidar a las familias y evitar cambios bruscos por pausas cortas de lluvia, el nivel informativo de lluvia sube de inmediato cuando la lluvia alcanza un umbral, pero para descender exige 2 lecturas temporales consecutivas por debajo del límite (histéresis). Además, si el acumulado de 72 horas llega a 60 mm o más con intensidad desde 2.5 mm/h, la regla de saturación del suelo mantiene como mínimo el nivel ALERTA.',
  },
  {
    id: 'funciona-offline',
    pregunta: '¿PUKARA funciona sin internet?',
    palabrasClave: ['internet', 'offline', 'avion', 'conexion', 'datos', 'sin red'],
    responder: (ctx = {}) => {
      const notaEstado = ctx.estaOffline
        ? ' En este momento estás navegando sin conexión.'
        : '';
      return `Sí. PUKARA guarda en tu dispositivo el último estado válido y te muestra el aviso "Datos del [fecha y hora], no actualizados" cuando no hay red.${notaEstado} Además, los sonidos sintetizados, este asistente Zorrito, la lectura por voz del navegador y tu checklist familiar funcionan 100% sin internet.`;
    },
  },
  {
    id: 'mapa-rutas',
    pregunta: '¿Por qué el mapa no muestra rutas ni zonas seguras?',
    palabrasClave: ['mapa', 'ruta', 'rutas', 'zona', 'zonas', 'refugio', 'camino'],
    responder: () =>
      'Porque PUKARA es un prototipo académico informativo para consulta comunitaria. Los polígonos se muestran en tono neutro como referencia de demostración, no validada, y el sistema no emite instrucciones de desplazamiento ni valida trayectos ni refugios; esa responsabilidad corresponde exclusivamente a las autoridades oficiales.',
  },
  {
    id: 'distancia-gps',
    pregunta: '¿Cómo funciona la distancia a los puntos de referencia?',
    palabrasClave: ['distancia', 'gps', 'ubicacion', 'privacidad', 'haversine', 'puntos'],
    responder: () =>
      'Cuando autorizas tu ubicación, el cálculo se realiza 100% dentro de tu propio teléfono usando la fórmula matemática Haversine; tu posición GPS jamás se envía al servidor. El dato se muestra como distancia aproximada en línea recta (no es ruta ni indica seguridad), y si deniegas el permiso, toda la consulta sigue funcionando normalmente.',
  },
  {
    id: 'preparacion-familiar',
    pregunta: '¿Qué debo incluir en mi preparación familiar?',
    palabrasClave: ['preparacion', 'familia', 'checklist', 'mochila', 'documentos', 'linterna'],
    responder: () =>
      'Conviene tener documentos importantes en bolsa impermeable, linterna con pilas, botiquín básico y agua potable, desagües limpios, radio o batería externa cargada y los números 114, 119, 110 y 115 anotados. Puedes abrir la pestaña "Checklist Familiar" aquí mismo para ir marcando cada punto sin internet.',
  },
];

function normalizarTextoBusqueda(texto) {
  return String(texto || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export const MENSAJE_LIMITE_DOMINIO_OFFLINE =
  'Solo puedo ayudarte con información preventiva de PUKARA sobre lluvias en Llojeta. ¿Te gustaría conocer el nivel actual o las recomendaciones preventivas?';

/**
 * Busca la respuesta determinista más relevante para una consulta libre del usuario
 * (incluyendo saludos, agradecimientos, contactos y límites estrictos de dominio offline).
 *
 * @param {string} consulta
 * @param {Object} [contexto]
 * @returns {{ encontrada: boolean, preguntaId: string|null, respuesta: string }}
 */
export function buscarRespuestaPorConsulta(consulta, contexto = {}) {
  const query = normalizarTextoBusqueda(consulta);
  const nivelActual = String(contexto.nivelVigente || 'NORMAL').toUpperCase();

  if (!query) {
    return {
      encontrada: false,
      preguntaId: null,
      respuesta:
        'Toca cualquiera de las preguntas frecuentes o escribe palabras clave como "nivel", "offline", "mapa", "gps" o "checklist" para ayudarte.',
    };
  }

  // Saludos cordiales
  if (
    /^(hola|buenos dias|buenas tardes|buenas noches|hey|saludos|que tal|buen dia)\b/.test(
      query
    ) ||
    /\b(hola|buenos dias|buenas tardes|buenas noches|saludos)\b/.test(query)
  ) {
    return {
      encontrada: true,
      preguntaId: 'saludo',
      respuesta: `¡Hola, vecino de Llojeta! Soy Zorrito. Actualmente el nivel informativo de lluvia es ${nivelActual}. Puedo explicarte qué significa, qué medidas preventivas generales tomar o ayudarte con tu checklist familiar.`,
    };
  }

  // Agradecimientos y despedidas
  if (
    /\b(gracias|muchas gracias|mil gracias|chau|adios|hasta luego|nos vemos)\b/.test(
      query
    )
  ) {
    return {
      encontrada: true,
      preguntaId: 'despedida',
      respuesta:
        '¡Con mucho gusto! Cuídate mucho y recuerda que PUKARA ofrece información preventiva de consulta que no sustituye a las autoridades oficiales.',
    };
  }

  // Contactos de emergencia
  if (
    /\b(114|119|110|115|telefono|telefonos|numero|numeros|contacto|contactos|llamar|bomberos|emergencia)\b/.test(
      query
    )
  ) {
    return {
      encontrada: true,
      preguntaId: 'contactos',
      respuesta:
        'Ante una emergencia real en el sector Llojeta / Bajo Llojeta llama directamente a los servicios oficiales: 114 (GAMLP), 119 (Bomberos Antofagasta), 110 (Radio Patrullas) o 115 (Defensa Civil).',
    };
  }

  let mejorFaq = null;
  let mejorPuntaje = 0;

  for (const faq of PREGUNTAS_FRECUENTES) {
    let puntaje = 0;
    const preguntaNorm = normalizarTextoBusqueda(faq.pregunta);
    if (preguntaNorm.includes(query)) {
      puntaje += 5;
    }

    for (const kw of faq.palabrasClave) {
      const kwNorm = normalizarTextoBusqueda(kw);
      if (query.includes(kwNorm)) {
        puntaje += 3;
      } else if (kwNorm.includes(query) && query.length >= 3) {
        puntaje += 1;
      }
    }

    if (puntaje > mejorPuntaje) {
      mejorPuntaje = puntaje;
      mejorFaq = faq;
    }
  }

  if (mejorFaq && mejorPuntaje > 0) {
    return {
      encontrada: true,
      preguntaId: mejorFaq.id,
      respuesta: mejorFaq.responder(contexto),
    };
  }

  return {
    encontrada: false,
    preguntaId: null,
    respuesta: MENSAJE_LIMITE_DOMINIO_OFFLINE,
  };
}

/**
 * Construye un guion claro y natural para lectura por voz del Banner de Nivel Informativo.
 * @param {Object|null} estado
 * @returns {string}
 */
export function construirTextoLecturaEstado(estado) {
  if (!estado) {
    return '';
  }

  if (estado.estado_sistema === 'SIN_DATOS') {
    return 'Estado del sistema: sin datos meteorológicos válidos para el sector Llojeta. PUKARA no asume normalidad cuando faltan datos. Esta información no sustituye canales oficiales.';
  }

  const nivel = String(estado.nivel_vigente || 'NORMAL').toUpperCase();
  const observadoEn =
    estado.lectura?.observado_en || estado.meteorologia?.observado_en;
  const fechaTexto = observadoEn ? formatearFechaHoraLaPaz(observadoEn) : null;
  const antiguedadTexto =
    estado.antiguedad_minutos !== undefined && estado.antiguedad_minutos !== null
      ? formatearAntiguedad(estado.antiguedad_minutos)
      : null;

  const partes = [`Nivel informativo de lluvia vigente en Llojeta: ${nivel}.`];

  if (estado.estado_sistema === 'DATOS_DESACTUALIZADOS' || estado.datos_desactualizados) {
    partes.push(
      'Aviso: los datos superaron el límite de vigencia y se muestra el último nivel informativo conocido.'
    );
  }

  if (fechaTexto && fechaTexto !== 'No disponible') {
    partes.push(`Última actualización: ${fechaTexto}.`);
  }
  if (antiguedadTexto && antiguedadTexto !== 'Sin registro previo') {
    partes.push(`Antigüedad de lectura: ${antiguedadTexto}.`);
  }

  partes.push(
    'Este es un nivel informativo calculado con umbrales académicos y no sustituye alertas ni instrucciones de las autoridades oficiales.'
  );

  return partes.join(' ');
}

/**
 * Construye el texto completo en español claro para leer en voz alta las recomendaciones preventivas.
 * @param {string} nivelVigente
 * @param {Array<{ nivel: string, rec: Object }>} tarjetas
 * @returns {string}
 */
export function construirTextoLecturaRecomendaciones(
  nivelVigente = 'NORMAL',
  tarjetas = []
) {
  const nivel = String(nivelVigente || 'NORMAL').toUpperCase();
  if (!Array.isArray(tarjetas) || tarjetas.length === 0) {
    return `No hay recomendaciones preventivas generales registradas para el nivel informativo de lluvia ${nivel}.`;
  }

  const vigente = tarjetas.find((item) => item.nivel === nivel);
  const otras = tarjetas.filter((item) => item.nivel !== nivel);
  const ordenadas = vigente ? [vigente, ...otras] : tarjetas;

  const frases = ordenadas.map(({ nivel: n, rec }) => {
    const prefijo = n === nivel ? `Nivel vigente ${n}: ` : `Nivel ${n}: `;
    return `${prefijo}${rec.titulo}. ${rec.contenido}`;
  });

  return `Recomendaciones preventivas generales para el nivel informativo de lluvia ${nivel}. ${frases.join(' ')} Recuerda que son medidas preventivas generales y no sustituyen a las autoridades oficiales.`;
}

/**
 * Guion hablado para la tarjeta Lluvia Actual (1 hora).
 * @param {Object|null} lectura
 */
export function construirTextoLecturaLluvia1h(lectura) {
  if (!lectura) return '';
  const valorTexto =
    lectura.intensidad_mm_h !== null && lectura.intensidad_mm_h !== undefined
      ? `${lectura.intensidad_mm_h} milímetros por hora`
      : 'sin dato válido en este momento';
  const antiguedad =
    lectura.antiguedad_minutos !== null && lectura.antiguedad_minutos !== undefined
      ? ` Antigüedad de lectura: ${formatearAntiguedad(lectura.antiguedad_minutos)}.`
      : '';
  return `Lluvia actual en la última hora: ${valorTexto}.${antiguedad}`;
}

/**
 * Guion hablado para la tarjeta Lluvia Acumulada (24 horas). Nunca asume 0 ante nulos.
 * @param {Object|null} lectura
 */
export function construirTextoLecturaAcum24h(lectura) {
  if (!lectura) return '';
  const horasValidas = lectura.horas_validas_24h ?? 0;
  if (lectura.acum_24h_mm === null || lectura.acum_24h_mm === undefined) {
    return `Lluvia acumulada en 24 horas: acumulado incompleto, con ${horasValidas} de 24 horas válidas registradas.`;
  }
  return `Lluvia acumulada en las últimas 24 horas: ${lectura.acum_24h_mm} milímetros, calculada con ${horasValidas} de 24 horas válidas.`;
}

/**
 * Guion hablado para la tarjeta Saturación de Cuenca (72 horas). Nunca asume 0 ante nulos.
 * @param {Object|null} lectura
 */
export function construirTextoLecturaSaturacion72h(lectura) {
  if (!lectura) return '';
  const horasValidas = lectura.horas_validas_72h ?? 0;
  if (lectura.acum_72h_mm === null || lectura.acum_72h_mm === undefined) {
    return `Saturación de cuenca en 72 horas: acumulado incompleto, con ${horasValidas} de 72 horas válidas frente al umbral de 60 milímetros.`;
  }
  return `Saturación de cuenca en 72 horas: ${lectura.acum_72h_mm} milímetros acumulados frente al umbral de 60 milímetros, con ${horasValidas} de 72 horas válidas.`;
}

/**
 * Guion hablado para las variables ambientales (temperatura, humedad y viento).
 * @param {Object|null} lectura
 */
export function construirTextoLecturaAmbiente(lectura) {
  if (!lectura) return '';
  const temp =
    lectura.temperatura !== null && lectura.temperatura !== undefined
      ? `${lectura.temperatura} grados Celsius`
      : 'no disponible';
  const hum =
    lectura.humedad !== null && lectura.humedad !== undefined
      ? `${lectura.humedad} por ciento`
      : 'no disponible';
  const viento =
    lectura.viento !== null && lectura.viento !== undefined
      ? `${lectura.viento} kilómetros por hora`
      : 'no disponible';
  return `Condiciones atmosféricas en Llojeta: temperatura ${temp}, humedad ${hum} y viento ${viento}.`;
}

export default {
  IMAGENES_ZORRITO,
  MENSAJES_POR_NIVEL,
  MENSAJES_CONTEXTO,
  PREGUNTAS_FRECUENTES,
  obtenerSaludoBienvenida,
  resolverEstadoVisualZorrito,
  buscarRespuestaPorConsulta,
  construirTextoLecturaEstado,
  construirTextoLecturaRecomendaciones,
  construirTextoLecturaLluvia1h,
  construirTextoLecturaAcum24h,
  construirTextoLecturaSaturacion72h,
  construirTextoLecturaAmbiente,
};
