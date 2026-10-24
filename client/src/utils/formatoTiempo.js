/**
 * @file formatoTiempo.js
 * @description Funciones puras de formateo temporal y cálculo de antigüedad
 * para la visualización en la interfaz pública de PUKARA.
 */

/**
 * Formatea una fecha ISO UTC a la zona horaria oficial de Bolivia ('America/La_Paz', UTC-4).
 *
 * @param {string|Date|null|undefined} isoString Marca de tiempo ISO UTC
 * @returns {string} Cadena legible con indicación explícita de zona (BOT)
 */
export function formatearFechaHoraLaPaz(isoString) {
  if (!isoString) {
    return 'No disponible';
  }

  const d = typeof isoString === 'string' ? new Date(isoString) : isoString;
  if (!(d instanceof Date) || Number.isNaN(d.getTime())) {
    return 'No disponible';
  }

  const opciones = {
    timeZone: 'America/La_Paz',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  };

  try {
    const formateado = new Intl.DateTimeFormat('es-BO', opciones).format(d);
    return `${formateado} (hora La Paz, BOT)`;
  } catch {
    return 'No disponible';
  }
}

/**
 * Convierte un número de minutos transcurridos en texto descriptivo de antigüedad.
 *
 * @param {number|null|undefined} minutos Minutos calculados desde la observación
 * @returns {string} Texto amigable de antigüedad
 */
export function formatearAntiguedad(minutos) {
  if (minutos === null || minutos === undefined || Number.isNaN(Number(minutos))) {
    return 'Sin registro previo';
  }

  const m = Math.max(0, Math.round(Number(minutos)));

  if (m < 1) {
    return 'hace menos de 1 min';
  }

  if (m < 60) {
    return `hace ${m} min`;
  }

  const horas = Math.floor(m / 60);
  const minsRestantes = m % 60;

  if (minsRestantes === 0) {
    return `hace ${horas} h`;
  }

  return `hace ${horas} h ${minsRestantes} min`;
}

export default {
  formatearFechaHoraLaPaz,
  formatearAntiguedad,
};
