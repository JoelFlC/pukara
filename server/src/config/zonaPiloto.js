import dotenv from 'dotenv';

dotenv.config();

/**
 * Obtiene y valida la configuración geográfica centralizada del sector piloto Llojeta.
 * Valida que latitud esté en [-90, 90] y longitud en [-180, 180].
 * @returns {{ nombre: string, latitud: number, longitud: number }}
 */
export function obtenerConfigZonaPiloto() {
  const rawLat = process.env.LLOJETA_LAT ?? '-16.5235';
  const rawLon = process.env.LLOJETA_LON ?? '-68.1425';

  const latitud = Number(rawLat);
  const longitud = Number(rawLon);

  if (!Number.isFinite(latitud) || latitud < -90 || latitud > 90) {
    throw new Error(
      `Coordenada de latitud corrupta o fuera de rango [-90, 90]: ${rawLat}`
    );
  }

  if (!Number.isFinite(longitud) || longitud < -180 || longitud > 180) {
    throw new Error(
      `Coordenada de longitud corrupta o fuera de rango [-180, 180]: ${rawLon}`
    );
  }

  return {
    nombre: 'Sector Llojeta / Bajo Llojeta (Macrodistrito Cotahuma, La Paz)',
    latitud,
    longitud,
  };
}

export const ZONA_PILOTO = Object.freeze({
  ...obtenerConfigZonaPiloto(),
  macrodistrito: 'Cotahuma',
  municipio: 'Nuestra Señora de La Paz',
  eje_referencia: 'Eje río Pasajahuira / Av. Los Sargentos',
  timeoutMs: parseInt(process.env.OPEN_METEO_TIMEOUT_MS || '8000', 10),
  timezone: process.env.OPEN_METEO_TIMEZONE || 'UTC',
  baseUrl: process.env.OPEN_METEO_BASE_URL || 'https://api.open-meteo.com/v1/forecast',
});

export default obtenerConfigZonaPiloto;
