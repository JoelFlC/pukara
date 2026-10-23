import dotenv from 'dotenv';

dotenv.config();

/**
 * Configuración centralizada de la coordenada piloto de consulta para PUKARA.
 * Sector: Llojeta / Bajo Llojeta (Macrodistrito Cotahuma, La Paz).
 * Eje referencial: Río Pasajahuira / Av. Los Sargentos.
 */
export const ZONA_PILOTO = Object.freeze({
  nombre: 'Sector Llojeta / Bajo Llojeta',
  macrodistrito: 'Cotahuma',
  municipio: 'Nuestra Señora de La Paz',
  eje_referencia: 'Eje río Pasajahuira / Av. Los Sargentos',
  latitud: parseFloat(process.env.LLOJETA_LAT || '-16.5235'),
  longitud: parseFloat(process.env.LLOJETA_LON || '-68.1425'),
  timeoutMs: parseInt(process.env.OPEN_METEO_TIMEOUT_MS || '8000', 10),
  timezone: process.env.OPEN_METEO_TIMEZONE || 'UTC',
  baseUrl: process.env.OPEN_METEO_BASE_URL || 'https://api.open-meteo.com/v1/forecast',
});

export default ZONA_PILOTO;
