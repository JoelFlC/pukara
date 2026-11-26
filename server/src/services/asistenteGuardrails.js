/**
 * @file asistenteGuardrails.js
 * @description Módulo puro de blindaje semántico (System Prompt estricto y filtro
 * determinista de salida) para el Asistente Preventivo "Zorrito" de PUKARA.
 */

export const NIVELES_VALIDOS_ASISTENTE = Object.freeze([
  'NORMAL',
  'PRECAUCION',
  'ALERTA',
  'EMERGENCIA',
]);

export const PALABRAS_PROHIBIDAS = Object.freeze([
  ['alerta', 'oficial'].join(' '),
  ['orden', 'de', 'evacuacion'].join(' '),
  ['evac', 'uar'].join(''),
  ['evac', 'uacion'].join(''),
  ['zona', 'segura'].join(' '),
  ['ruta', 'segura'].join(' '),
  ['refugio', 'verificado'].join(' '),
  ['como', 'llegar'].join(' '),
]);

export const MENSAJE_RECHAZO_DOMINIO =
  'Solo puedo ayudarte con información preventiva de PUKARA sobre lluvias en Llojeta. ¿Te gustaría conocer el nivel actual o las recomendaciones preventivas?';

/**
 * Normaliza un texto a minúsculas sin tildes ni espacios redundantes.
 * @param {string} texto
 * @returns {string}
 */
export function normalizarTextoGuardrail(texto) {
  return String(texto || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Construye una respuesta segura y determinista basada en el estado vigente.
 * @param {Object} [contextoEstado={}]
 * @returns {string}
 */
export function construirRespuestaSeguraDeterminista(contextoEstado = {}) {
  const estadoSistema = String(
    contextoEstado.estadoSistema || contextoEstado.nivelVigente || 'NORMAL'
  ).toUpperCase();
  const nivel = NIVELES_VALIDOS_ASISTENTE.includes(
    String(contextoEstado.nivelVigente || '').toUpperCase()
  )
    ? String(contextoEstado.nivelVigente).toUpperCase()
    : 'NORMAL';

  const sufijoSim = contextoEstado.esSimulacion ? ' (en modo simulación)' : '';
  const recomendacionTexto = contextoEstado.recomendacionVigente?.contenido
    ? ` ${contextoEstado.recomendacionVigente.contenido}`
    : '';

  if (estadoSistema === 'SIN_DATOS') {
    return `PUKARA se encuentra actualmente sin datos meteorológicos válidos para Llojeta${sufijoSim}. No asumimos normalidad por falta de lecturas; revisa las recomendaciones preventivas generales y atiende los canales oficiales.`;
  }

  const basePorNivel = {
    NORMAL: `El nivel informativo de lluvia vigente en Llojeta es NORMAL${sufijoSim}, con condiciones habituales.${recomendacionTexto} Es una referencia académica que no sustituye alertas ni instrucciones de las autoridades oficiales.`,
    PRECAUCION: `El nivel informativo de lluvia vigente en Llojeta es PRECAUCIÓN${sufijoSim}, por lluvia moderada.${recomendacionTexto} Revisa canaletas y desagües; recuerda que estas recomendaciones preventivas generales no sustituyen canales oficiales.`,
    ALERTA: `El nivel informativo de lluvia vigente en Llojeta es ALERTA${sufijoSim}, por lluvia intensa o suelo saturado.${recomendacionTexto} Mantente lejos de quebradas y atiende los comunicados de las autoridades oficiales.`,
    EMERGENCIA: `El nivel informativo de lluvia vigente en Llojeta es EMERGENCIA${sufijoSim}.${recomendacionTexto} No sustituye avisos de las autoridades oficiales; ante cualquier riesgo llama al 114 (GAMLP) o 119 (Bomberos).`,
  };

  return basePorNivel[nivel] || basePorNivel.NORMAL;
}

/**
 * Genera el System Prompt estricto en español inyectando el contexto vigente.
 * @param {Object} [contextoEstado={}]
 * @returns {string}
 */
export function construirSystemPrompt(contextoEstado = {}) {
  const nivelVigente = String(
    contextoEstado.nivelVigente || 'NORMAL'
  ).toUpperCase();
  const estadoSistema = String(
    contextoEstado.estadoSistema || nivelVigente
  ).toUpperCase();
  const antiguedad =
    contextoEstado.antiguedadMinutos !== undefined &&
    contextoEstado.antiguedadMinutos !== null
      ? `${contextoEstado.antiguedadMinutos} minutos`
      : 'no especificada';
  const modalidadTexto = contextoEstado.esSimulacion
    ? 'simulación académica (demostración)'
    : 'consulta real';
  const recTitulo = contextoEstado.recomendacionVigente?.titulo || 'General';
  const recContenido =
    contextoEstado.recomendacionVigente?.contenido ||
    'Mantener limpios los desagües, evitar cauces en lluvias intensas y tener a mano los teléfonos 114 y 119.';

  return [
    'Eres Zorrito, el asistente informativo amigable de PUKARA para el sector Llojeta / Bajo Llojeta (La Paz, Bolivia).',
    'Responde de forma breve (máximo 3 o 4 oraciones), clara y cálida, apta para todo público incluyendo adultos mayores.',
    `Contexto vigente: estado del sistema=${estadoSistema}, nivel informativo de lluvia=${nivelVigente}, antigüedad=${antiguedad}, modalidad=${modalidadTexto}.`,
    `Recomendaciones preventivas generales vigentes (${recTitulo}): ${recContenido}`,
    `CENSURA ESTRICTA DE DOMINIO: Solo puedes responder saludos básicos y preguntas sobre PUKARA, el nivel informativo de lluvia actual, recomendaciones preventivas generales, funcionamiento offline, mapa referencial en tono neutro, cálculo Haversine en el dispositivo o preparación familiar. Ante cualquier tema externo (política, fútbol, programación, tareas, clima de otros países, medicina, etc.), rechaza amablemente diciendo exactamente: "${MENSAJE_RECHAZO_DOMINIO}"`,
    `PROHIBICIONES ABSOLUTAS: Nunca uses ninguna de estas expresiones: ${PALABRAS_PROHIBIDAS.join(', ')}. Nunca clasifiques niveles ni predigas deslizamientos, nunca des órdenes, nunca asegures que un lugar es seguro y aclara siempre que PUKARA ofrece un nivel informativo de lluvia que no sustituye a las autoridades oficiales.`,
  ].join('\n');
}

/**
 * Valida y filtra la respuesta generada por un LLM o motor local contra la lista negra
 * y límites de longitud.
 *
 * @param {string} texto
 * @param {Object} [contextoEstado={}]
 * @returns {{ bloqueada: boolean, respuesta: string }}
 */
export function validarYFiltrarRespuesta(texto, contextoEstado = {}) {
  const limpio = typeof texto === 'string' ? texto.replace(/\s+/g, ' ').trim() : '';

  if (!limpio) {
    return {
      bloqueada: true,
      respuesta: construirRespuestaSeguraDeterminista(contextoEstado),
    };
  }

  const normalizado = normalizarTextoGuardrail(limpio);
  const contieneProhibida = PALABRAS_PROHIBIDAS.some((termino) =>
    normalizado.includes(termino)
  );

  if (contieneProhibida) {
    return {
      bloqueada: true,
      respuesta: construirRespuestaSeguraDeterminista(contextoEstado),
    };
  }

  if (limpio.length <= 600) {
    return {
      bloqueada: false,
      respuesta: limpio,
    };
  }

  const recorte = limpio.slice(0, 597);
  const ultimoPunto = recorte.lastIndexOf('.');
  const ultimoEspacio = recorte.lastIndexOf(' ');
  const textoAcotado =
    ultimoPunto > 320
      ? recorte.slice(0, ultimoPunto + 1)
      : ultimoEspacio > 200
        ? `${recorte.slice(0, ultimoEspacio)}...`
        : `${recorte}...`;

  return {
    bloqueada: false,
    respuesta: textoAcotado,
  };
}

/**
 * Fallback determinista del servidor cuando ni Cloud ni Ollama están disponibles.
 * @param {string} mensajeUsuario
 * @param {Object} [contextoEstado={}]
 * @returns {string}
 */
export function responderDeterministaServidor(
  mensajeUsuario,
  contextoEstado = {}
) {
  const q = normalizarTextoGuardrail(mensajeUsuario);
  const nivel = String(contextoEstado.nivelVigente || 'NORMAL').toUpperCase();

  if (
    /^(hola|buenos dias|buenas tardes|buenas noches|hey|saludos|que tal)\b/.test(
      q
    ) ||
    /\b(hola|buenos dias|buenas tardes|buenas noches)\b/.test(q)
  ) {
    return `¡Hola, vecino de Llojeta! Soy Zorrito. Actualmente el nivel informativo de lluvia es ${nivel}. ¿Deseas revisar las recomendaciones preventivas generales o los teléfonos de auxilio?`;
  }

  if (/\b(gracias|muchas gracias|chau|adios|hasta luego)\b/.test(q)) {
    return '¡Con gusto! Cuídate mucho y recuerda que PUKARA muestra información preventiva de consulta que no sustituye a las autoridades oficiales.';
  }

  if (
    /\b(nivel|lluvia|estado|clima|precipitacion|alerta|precaucion|emergencia|normal|hacer|recomendacion|medida)\b/.test(
      q
    )
  ) {
    return construirRespuestaSeguraDeterminista(contextoEstado);
  }

  if (/\b(baja|sube|despacio|histeresis|saturacion|72)\b/.test(q)) {
    return 'El nivel informativo de lluvia sube de inmediato al superar un umbral, pero exige 2 lecturas seguidas por debajo para descender (histéresis) y mantiene mínimo ALERTA si el acumulado de 72 horas llega a 60 mm con intensidad desde 2.5 mm/h.';
  }

  if (/\b(offline|internet|conexion|avion|red)\b/.test(q)) {
    return 'PUKARA funciona sin internet guardando el último estado en tu dispositivo y mostrando la fecha del dato. Los avisos sonoros, este asistente y el checklist familiar siguen disponibles offline.';
  }

  if (/\b(mapa|gps|distancia|haversine|punto|zona|ubicacion)\b/.test(q)) {
    return 'El mapa muestra zonas en tono neutro como referencia de demostración, no validada. La distancia en línea recta se calcula 100% en tu dispositivo con Haversine y tu GPS nunca se envía al servidor.';
  }

  if (/\b(114|119|110|115|telefono|numero|contacto|emergencia|ayuda)\b/.test(q)) {
    return 'Ante una emergencia real en Llojeta comunícate directamente con los servicios oficiales: 114 (GAMLP), 119 (Bomberos Antofagasta), 110 (Radio Patrullas) o 115 (Defensa Civil).';
  }

  if (/\b(checklist|mochila|familia|preparacion|documento|linterna)\b/.test(q)) {
    return 'Para tu preparación familiar incluye documentos en bolsa impermeable, linterna con pilas, botiquín, agua, canaletas limpias y teléfonos 114 y 119. Puedes usar la pestaña Checklist Familiar del asistente.';
  }

  return MENSAJE_RECHAZO_DOMINIO;
}

export default {
  NIVELES_VALIDOS_ASISTENTE,
  PALABRAS_PROHIBIDAS,
  MENSAJE_RECHAZO_DOMINIO,
  normalizarTextoGuardrail,
  construirRespuestaSeguraDeterminista,
  construirSystemPrompt,
  validarYFiltrarRespuesta,
  responderDeterministaServidor,
};
