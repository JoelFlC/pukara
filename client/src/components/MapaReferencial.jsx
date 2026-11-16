import React, { useEffect, useRef, useState, useMemo } from 'react';
import 'leaflet/dist/leaflet.css';
import {
  distanciaHaversine,
  calcularDistanciasAPuntos,
  LEYENDA_DISTANCIA_HAVERSINE,
} from '../utils/haversine.js';

/**
 * Estilo cartográfico neutro obligatorio para polígonos GeoJSON de zonas_referencia.
 * Directriz de GEMINI.md: Las zonas de referencia se dibujan siempre en tono neutro;
 * el nivel informativo de lluvia es un banner global y NO colorea los polígonos.
 */
export const ESTILO_ZONA_NEUTRO = Object.freeze({
  color: '#475569',
  fillColor: '#64748b',
  fillOpacity: 0.22,
  weight: 2,
});

/**
 * Maneja el éxito en la obtención de geolocalización en el dispositivo (Requisito P09 / P18).
 *
 * @param {Object} pos
 * @param {Function} setEstado
 * @param {Function} setUbicacion
 */
export function manejarExitoGeolocalizacion(pos, setEstado, setUbicacion) {
  setUbicacion({
    latitud: pos.coords.latitude,
    longitud: pos.coords.longitude,
    precision: Math.round(pos.coords.accuracy || 0),
  });
  setEstado('concedido');
}

/**
 * Maneja el error o rechazo de geolocalización en el dispositivo (Requisito P09).
 *
 * @param {Object} err
 * @param {Function} setEstado
 * @param {Function} setUbicacion
 */
export function manejarErrorGeolocalizacion(err, setEstado, setUbicacion) {
  if (err && err.code === 1) {
    // 1 = PERMISSION_DENIED
    setEstado('denegado');
  } else {
    setEstado('no_disponible');
  }
  setUbicacion(null);
}

/**
 * Componente MapaReferencial (Capítulo 02 — Cartografía de Referencia)
 * Muestra el mapa referencial con Leaflet, polígonos de zonas en tono neutro, puntos de referencia,
 * control de geolocalización procesado 100% en el dispositivo (P09) y cálculo de distancias
 * en línea recta con la fórmula de Haversine (P18).
 *
 * @param {Object} props
 * @param {Array} [props.zonasReferencia=[]]
 * @param {Array} [props.puntosReferencia=[]]
 * @param {Object} [props.coordenadaCentral] { latitud, longitud } o { lat, lng }
 * @param {string} [props.nivelVigente='NORMAL']
 * @param {Object|null} [props.ubicacionInicial=null]
 * @param {string} [props.estadoUbicacionInicial='inactivo']
 * @param {boolean} [props.modoOffline=false]
 */
export default function MapaReferencial({
  zonasReferencia = [],
  puntosReferencia = [],
  coordenadaCentral,
  nivelVigente = 'NORMAL',
  ubicacionInicial = null,
  estadoUbicacionInicial = 'inactivo',
  modoOffline = false,
}) {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const tileLayerRef = useRef(null);
  const markersLayerRef = useRef(null);
  const userMarkerRef = useRef(null);

  // Estados de carga de teselas y conectividad (Requisito P10)
  const [hayErrorTeselas, setHayErrorTeselas] = useState(false);
  const sinTeselasDisponibles =
    modoOffline ||
    hayErrorTeselas ||
    (typeof navigator !== 'undefined' && !navigator.onLine);

  // Estados de geolocalización en el dispositivo (Requisito P09)
  const [estadoUbicacion, setEstadoUbicacion] = useState(estadoUbicacionInicial);
  const [ubicacionUsuario, setUbicacionUsuario] = useState(ubicacionInicial);

  // Coordenada central efectiva de la zona piloto
  const centroLat = Number(
    coordenadaCentral?.latitud ??
      coordenadaCentral?.lat ??
      -16.5235
  );
  const centroLon = Number(
    coordenadaCentral?.longitud ??
      coordenadaCentral?.lng ??
      -68.1425
  );

  // URL del proveedor de teselas con fallback
  const tileUrl =
    (typeof import.meta !== 'undefined' &&
      import.meta.env?.VITE_OSM_TILE_URL) ||
    'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';

  // Puntos enriquecidos con distancias Haversine si la ubicación está activa
  const puntosConDistancia = useMemo(() => {
    if (estadoUbicacion === 'concedido' && ubicacionUsuario) {
      return calcularDistanciasAPuntos(ubicacionUsuario, puntosReferencia);
    }
    return puntosReferencia.map((p) => ({ ...p, distancia: null }));
  }, [puntosReferencia, estadoUbicacion, ubicacionUsuario]);

  // Manejador de solicitud de ubicación del dispositivo (P09)
  const handleSolicitarUbicacion = () => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      manejarErrorGeolocalizacion(
        { code: 2, message: 'Geolocalización no disponible' },
        setEstadoUbicacion,
        setUbicacionUsuario
      );
      return;
    }

    setEstadoUbicacion('solicitando');

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        manejarExitoGeolocalizacion(
          pos,
          setEstadoUbicacion,
          setUbicacionUsuario
        );
      },
      (err) => {
        manejarErrorGeolocalizacion(
          err,
          setEstadoUbicacion,
          setUbicacionUsuario
        );
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 30000,
      }
    );
  };

  const handleOcultarUbicacion = () => {
    setEstadoUbicacion('inactivo');
    setUbicacionUsuario(null);
  };

  // Inicialización y actualización de Leaflet
  useEffect(() => {
    if (typeof window === 'undefined') return;

    let cancelado = false;

    import('leaflet')
      .then((leafletModule) => {
        if (cancelado) return;
        const L = leafletModule.default || leafletModule;

        // Arreglo de íconos por defecto de Leaflet en Vite
        try {
          delete L.Icon.Default.prototype._getIconUrl;
          L.Icon.Default.mergeOptions({
            iconRetinaUrl:
              'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
            iconUrl:
              'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
            shadowUrl:
              'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
          });
        } catch {}

        if (!mapContainerRef.current) return;

        // Crear mapa si no existe
        if (!mapInstanceRef.current) {
          const map = L.map(mapContainerRef.current, {
            center: [centroLat, centroLon],
            zoom: 14,
            zoomControl: true,
            attributionControl: false,
          });

          const tileLayer = L.tileLayer(tileUrl, {
            maxZoom: 18,
            attribution:
              '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
          });

          tileLayer.on('tileerror', () => {
            setHayErrorTeselas(true);
          });

          tileLayer.on('tileload', () => {
            setHayErrorTeselas(false);
          });

          tileLayer.addTo(map);
          tileLayerRef.current = tileLayer;

          const markersLayer = L.layerGroup().addTo(map);
          markersLayerRef.current = markersLayer;

          mapInstanceRef.current = map;
        }

        // Renderizado de capas sobre el mapa
        if (markersLayerRef.current && mapInstanceRef.current) {
          markersLayerRef.current.clearLayers();

          // 1. Polígonos de zonas en tono neutro inmutable (#475569)
          if (Array.isArray(zonasReferencia) && zonasReferencia.length > 0) {
            zonasReferencia.forEach((zona) => {
              if (zona.geometria) {
                try {
                  const geoLayer = L.geoJSON(zona.geometria, {
                    style: () => ESTILO_ZONA_NEUTRO,
                    onEachFeature: (_, layer) => {
                      layer.bindPopup(`
                        <div style="font-family: sans-serif; font-size: 12px; line-height: 1.4;">
                          <p style="font-weight: bold; margin: 0 0 4px 0; color: #0f172a;">${zona.nombre}</p>
                          <p style="margin: 0 0 2px 0; color: #475569;"><strong>Fuente:</strong> ${zona.fuente || 'Propuesta académica'}</p>
                          <p style="margin: 0 0 4px 0; color: #475569;"><strong>Estado:</strong> ${
                            zona.verificada
                              ? 'Verificada por autoridad'
                              : 'Referencia de demostración, no validada (sin verificar)'
                          }</p>
                          <p style="margin: 4px 0 0 0; font-size: 10px; color: #92400e; font-style: italic;">
                            referencia de demostración, no validada
                          </p>
                        </div>
                      `);
                    },
                  });
                  geoLayer.addTo(markersLayerRef.current);
                } catch (err) {
                  console.warn('Error dibujando polígono de zona:', err);
                }
              }
            });
          }

          // 2. Marcadores de puntos de referencia
          if (Array.isArray(puntosConDistancia) && puntosConDistancia.length > 0) {
            puntosConDistancia.forEach((punto) => {
              const lat = Number(punto.latitud ?? punto.lat);
              const lon = Number(punto.longitud ?? punto.lng);

              if (Number.isFinite(lat) && Number.isFinite(lon)) {
                const marker = L.marker([lat, lon]);

                let popupContent = `
                  <div style="font-family: sans-serif; font-size: 12px; line-height: 1.4;">
                    <p style="font-weight: bold; margin: 0 0 2px 0; color: #0f172a;">${punto.nombre}</p>
                    <p style="margin: 0 0 2px 0; color: #475569;"><strong>Tipo:</strong> ${punto.tipo || 'Punto'}</p>
                    <p style="margin: 0 0 2px 0; font-family: monospace; font-size: 11px; color: #64748b;">
                      Lat: ${lat.toFixed(4)}, Lon: ${lon.toFixed(4)}
                    </p>
                    <p style="margin: 0 0 2px 0; color: #475569;"><strong>Fuente:</strong> ${punto.fuente || 'Propuesta académica'}</p>
                    <p style="margin: 0 0 4px 0; color: #475569;"><strong>Estado:</strong> ${
                      punto.estado_verificacion === 'verificado_por_autoridad'
                        ? 'Verificado por autoridad'
                        : 'Referencia de demostración, no validada (sin verificar)'
                    }</p>
                `;

                if (punto.distancia) {
                  popupContent += `
                    <div style="margin-top: 6px; padding: 4px 6px; background: #f1f5f9; border-radius: 4px;">
                      <strong style="color: #0f172a;">Distancia: ${punto.distancia.distanciaCorta}</strong>
                      <div style="font-size: 10px; color: #64748b; margin-top: 2px;">
                        ${punto.distancia.leyenda}
                      </div>
                    </div>
                  `;
                }

                popupContent += `
                    <p style="margin: 6px 0 0 0; font-size: 10px; color: #92400e; font-style: italic;">
                      referencia de demostración, no validada
                    </p>
                  </div>
                `;

                marker.bindPopup(popupContent);
                marker.addTo(markersLayerRef.current);
              }
            });
          }

          // 3. Marcador de usuario (si concedido)
          if (estadoUbicacion === 'concedido' && ubicacionUsuario) {
            if (userMarkerRef.current) {
              try {
                markersLayerRef.current.removeLayer(userMarkerRef.current);
              } catch {}
            }

            const userMarker = L.circleMarker(
              [ubicacionUsuario.latitud, ubicacionUsuario.longitud],
              {
                radius: 8,
                fillColor: '#3525CD',
                color: '#ffffff',
                weight: 2,
                opacity: 1,
                fillOpacity: 0.85,
              }
            ).bindPopup(`
              <div style="font-family: sans-serif; font-size: 12px;">
                <strong>Mi ubicación estimada</strong>
                <p style="margin: 4px 0 0 0; font-size: 11px; color: #64748b;">
                  Precisión: ±${ubicacionUsuario.precision} m (procesado solo en este dispositivo)
                </p>
              </div>
            `);

            userMarker.addTo(markersLayerRef.current);
            userMarkerRef.current = userMarker;
          }
        }
      })
      .catch((e) => {
        console.warn('Leaflet degradado en entorno sin soporte gráfico:', e.message);
      });

    const handleOffline = () => setHayErrorTeselas(true);
    const handleOnline = () => setHayErrorTeselas(false);

    if (typeof window !== 'undefined') {
      window.addEventListener('offline', handleOffline);
      window.addEventListener('online', handleOnline);
    }

    return () => {
      cancelado = true;
      if (typeof window !== 'undefined') {
        window.removeEventListener('offline', handleOffline);
        window.removeEventListener('online', handleOnline);
      }
      if (mapInstanceRef.current) {
        try {
          mapInstanceRef.current.remove();
        } catch {}
        mapInstanceRef.current = null;
      }
    };
  }, [
    centroLat,
    centroLon,
    tileUrl,
    zonasReferencia,
    puntosConDistancia,
    estadoUbicacion,
    ubicacionUsuario,
  ]);

  return (
    <section
      aria-label="Mapa referencial del sector piloto"
      className="clay-card p-5 sm:p-7 space-y-5 animate-fade-up"
    >
      {/* 1. Encabezado Editorial Suizo e Indicador Global vs Tono Neutro */}
      <div className="space-y-2.5 border-b border-slate-100 pb-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="swiss-chapter-badge">
            02 CAPÍTULO DOS — CARTOGRAFÍA DE REFERENCIA
          </span>
          <span className="clay-pill px-3 py-1 text-xs font-bold bg-[#F0F3FF] text-[#111C2D] border border-[#E2DFFF]">
            Sector Piloto Llojeta
          </span>
        </div>

        <h2 className="headline-lg text-2xl sm:text-3xl lg:text-4xl font-bold text-[#111C2D] leading-snug break-words">
          Mapa del Sector Piloto Llojeta / Bajo Llojeta
        </h2>

        {/* Nota obligatoria de la directriz arquitectónica */}
        <p
          data-testid="nota-indicador-global"
          className="text-base text-[#1E293B] leading-relaxed bg-[#F9F9FF] p-4 rounded-2xl border border-slate-200/80"
        >
          El nivel informativo de lluvia es un indicador global para todo el
          sector piloto Llojeta / Bajo Llojeta y no varía espacialmente. Las
          zonas de referencia se representan en color neutro.
        </p>
      </div>

      {/* 2. Aviso de error o mapa parcial (si fallan teselas u offline - Requisito P10) */}
      {sinTeselasDisponibles && (
        <div
          data-testid="aviso-mapa-parcial"
          role="status"
          className="clay-card-sm border-2 border-[#FDE68A] bg-[#FEF3C7] p-4 text-base text-[#92400E] font-medium space-y-1.5"
        >
          <p className="font-bold flex items-center gap-2">
            <span aria-hidden="true">⚠️</span> Cartografía parcial
          </p>
          <p className="text-sm sm:text-base text-[#92400E] leading-relaxed">
            Mapa parcial con limitación de teselas: sin conexión a internet o teselas de OpenStreetMap no disponibles en el caché del navegador. Por política de uso de OpenStreetMap no se realiza precarga masiva de teselas. El sistema no ofrece navegación; consulte a continuación la lista completa de zonas y puntos de referencia de demostración disponibles sin conexión.
          </p>
        </div>
      )}

      {/* 3. Layout Responsivo: Apilado en móvil, 12 columnas en desktop */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Columna Izquierda (lg:col-span-7): Lienzo del Mapa Leaflet */}
        <div className="lg:col-span-7 space-y-2.5">
          <div className="clay-card-sm p-1.5 bg-[#F9F9FF]">
            <div
              ref={mapContainerRef}
              data-testid="mapa-leaflet-contenedor"
              className="h-[300px] sm:h-[380px] lg:h-[440px] w-full rounded-2xl overflow-hidden z-0 relative bg-slate-100"
              tabIndex={0}
              aria-label="Mapa cartográfico referencial del sector piloto Llojeta"
            />
          </div>

          {/* Atribución única clara de OpenStreetMap */}
          <div className="text-xs text-[#475569] text-right px-1">
            &copy;{' '}
            <a
              href="https://www.openstreetmap.org/copyright"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-[#111C2D]"
            >
              OpenStreetMap
            </a>{' '}
            contributors
          </div>
        </div>

        {/* Columna Derecha (lg:col-span-5): Proximidad Haversine, Zonas y Puntos */}
        <div className="lg:col-span-5 space-y-4">
          {/* Panel de Control de Ubicación GPS (Requisito P09 / P18) */}
          <div className="clay-card-sm bg-[#F9F9FF] p-4 sm:p-5 space-y-3.5">
            <div className="space-y-3">
              <div className="min-w-0">
                <h3 className="headline-sm text-base sm:text-lg font-bold text-[#111C2D]">
                  Ubicación aproximada en dispositivo
                </h3>
                <p className="text-sm sm:text-base text-[#464555] leading-relaxed mt-1">
                  Su ubicación se procesa únicamente en este dispositivo para
                  calcular la distancia en línea recta y nunca se almacena ni se
                  envía al servidor.
                </p>
              </div>

              <div className="w-full">
                {estadoUbicacion !== 'concedido' ? (
                  <button
                    type="button"
                    data-testid="btn-solicitar-ubicacion"
                    onClick={handleSolicitarUbicacion}
                    disabled={estadoUbicacion === 'solicitando'}
                    className="clay-btn-primary clay-interactive min-h-[50px] w-full px-4 py-3 text-sm sm:text-base font-bold disabled:opacity-50 inline-flex items-center justify-center gap-2 text-center leading-snug cursor-pointer"
                  >
                    <span className="shrink-0" aria-hidden="true">📍</span>
                    <span>
                      {estadoUbicacion === 'solicitando'
                        ? 'Consultando GPS local...'
                        : 'Calcular distancia aproximada desde mi ubicación (procesado solo en este dispositivo)'}
                    </span>
                  </button>
                ) : (
                  <button
                    type="button"
                    data-testid="btn-ocultar-ubicacion"
                    onClick={handleOcultarUbicacion}
                    className="clay-btn-secondary clay-interactive min-h-[48px] w-full px-4 py-2.5 text-sm sm:text-base font-bold inline-flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <span>Ocultar mi ubicación</span>
                  </button>
                )}
              </div>
            </div>

            {/* Escenario P09: GPS Denegado o no disponible */}
            {(estadoUbicacion === 'denegado' ||
              estadoUbicacion === 'no_disponible') && (
              <div
                data-testid="aviso-gps-denegado"
                role="status"
                className="clay-card-sm bg-white p-3.5 text-sm sm:text-base text-[#1E293B] space-y-1 border border-slate-300"
              >
                <p className="font-bold text-[#111C2D]">
                  Permiso de ubicación denegado o no disponible
                </p>
                <p className="text-[#464555] leading-relaxed">
                  Permiso de ubicación denegado o no disponible: no se muestran distancias a los puntos de referencia. La consulta general del nivel informativo, las recomendaciones y el mapa referencial funcionan con normalidad.
                </p>
              </div>
            )}

            {/* Ubicación concedida: detalle de precisión */}
            {estadoUbicacion === 'concedido' && ubicacionUsuario && (
              <div
                data-testid="aviso-gps-concedido"
                role="status"
                className="clay-card-sm border border-[#E2DFFF] bg-[#EEF2FF] p-3.5 text-sm sm:text-base text-[#111C2D] flex flex-wrap items-center justify-between gap-2"
              >
                <span className="font-semibold">
                  Ubicación activa en este dispositivo · Precisión: ±
                  {ubicacionUsuario.precision} m
                </span>
                <span className="clay-pill text-xs bg-white text-[#3525CD] px-2.5 py-0.5 font-mono font-bold border border-[#E2DFFF]">
                  GPS local
                </span>
              </div>
            )}
          </div>

          {/* Listado de Zonas de Referencia */}
          <div
            data-testid="seccion-zonas-referencia"
            className="clay-card-sm p-4 sm:p-5 space-y-3"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-extrabold text-[#111C2D] uppercase tracking-wider">
                Zonas de Referencia ({zonasReferencia.length})
              </h3>
              <span className="clay-pill text-xs text-[#92400E] font-bold bg-[#FEF3C7] px-2.5 py-0.5 border border-[#FDE68A]">
                referencia de demostración, no validada
              </span>
            </div>

            {zonasReferencia.length === 0 ? (
              <p className="text-base text-[#475569] italic">
                No se han delimitado zonas de referencia aún.
              </p>
            ) : (
              <div className="grid grid-cols-1 gap-3 max-h-60 overflow-y-auto pr-1">
                {zonasReferencia.map((z) => (
                  <div
                    key={z.id}
                    data-testid="tarjeta-zona"
                    className="p-3.5 rounded-2xl bg-[#F9F9FF] border border-slate-200/80 space-y-1.5"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <h4 className="font-bold text-base text-[#111C2D]">{z.nombre}</h4>
                      <span
                        className={`clay-pill text-xs px-2.5 py-0.5 font-bold border ${
                          z.verificada
                            ? 'bg-[#ECFDF5] text-[#065F46] border-[#A7F3D0]'
                            : 'bg-slate-100 text-[#475569] border-slate-200'
                        }`}
                      >
                        {z.verificada
                          ? 'Verificada por autoridad'
                          : 'Sin verificación oficial'}
                      </span>
                    </div>

                    <div className="text-sm text-[#464555] space-y-0.5">
                      <p>
                        <span className="font-semibold text-[#111C2D]">Fuente:</span>{' '}
                        {z.fuente || 'Propuesta académica'}
                      </p>
                      <p>
                        <span className="font-semibold text-[#111C2D]">
                          Fecha del dato:
                        </span>{' '}
                        {z.fecha_dato || 'No disponible'}
                        {z.vigente_hasta && ` · Vigente hasta: ${z.vigente_hasta}`}
                      </p>
                      {z.advertencia && (
                        <p className="text-[#92400E] italic text-xs sm:text-sm">{z.advertencia}</p>
                      )}
                    </div>

                    <div className="pt-1">
                      <span className="text-xs text-[#92400E] bg-[#FEF3C7] px-2 py-0.5 rounded-full font-semibold">
                        referencia de demostración, no validada
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Listado de Puntos de Referencia con Distancias Haversine (P18) */}
          <div
            data-testid="seccion-puntos-referencia"
            className="clay-card-sm p-4 sm:p-5 space-y-3"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-extrabold text-[#111C2D] uppercase tracking-wider">
                Puntos de Referencia ({puntosConDistancia.length})
              </h3>
              <span className="clay-pill text-xs text-[#92400E] font-bold bg-[#FEF3C7] px-2.5 py-0.5 border border-[#FDE68A]">
                referencia de demostración, no validada
              </span>
            </div>

            {puntosConDistancia.length === 0 ? (
              <p className="text-base text-[#475569] italic">
                No se han registrado puntos de referencia aún.
              </p>
            ) : (
              <div className="grid grid-cols-1 gap-3 max-h-80 overflow-y-auto pr-1">
                {puntosConDistancia.map((p) => (
                  <div
                    key={p.id}
                    data-testid="tarjeta-punto"
                    className="p-3.5 rounded-2xl bg-[#F9F9FF] border border-slate-200/80 space-y-2"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h4 className="font-bold text-base text-[#111C2D] break-words">{p.nombre}</h4>
                        <span className="text-xs text-[#475569] font-mono">
                          Tipo: {p.tipo || 'Punto'}
                        </span>
                      </div>
                      <span
                        className={`clay-pill text-xs px-2.5 py-0.5 font-bold border ${
                          p.estado_verificacion === 'verificado_por_autoridad'
                            ? 'bg-[#ECFDF5] text-[#065F46] border-[#A7F3D0]'
                            : 'bg-[#FEF3C7] text-[#92400E] border-[#FDE68A]'
                        }`}
                      >
                        {p.estado_verificacion === 'verificado_por_autoridad'
                          ? 'Verificado por autoridad'
                          : 'Referencia de demostración, no validada (sin verificar)'}
                      </span>
                    </div>

                    <div className="text-xs sm:text-sm text-[#464555] space-y-0.5 font-mono">
                      <p className="break-words">
                        Lat: {Number(p.latitud).toFixed(4)}, Lon:{' '}
                        {Number(p.longitud).toFixed(4)}
                      </p>
                      <p className="font-sans text-[#464555]">
                        Fuente: {p.fuente || 'Propuesta académica'}
                      </p>
                    </div>

                    {/* Distancia Haversine calculada en el cliente (P18) */}
                    {p.distancia ? (
                      <div
                        data-testid="distancia-haversine"
                        className="p-3 rounded-xl bg-[#EEF2FF] border border-[#E2DFFF] text-[#111C2D] space-y-1"
                      >
                        <p className="font-bold text-sm sm:text-base text-[#3525CD]">
                          Distancia en línea recta: {p.distancia.distanciaCorta}
                        </p>
                        <p className="text-xs sm:text-sm text-[#464555] leading-snug">
                          {p.distancia.leyenda}
                        </p>
                      </div>
                    ) : (
                      <div className="text-xs sm:text-sm text-[#475569] italic">
                        Distancia no calculada (active ubicación en el dispositivo)
                      </div>
                    )}

                    <div className="pt-0.5">
                      <span className="text-xs text-[#92400E] bg-[#FEF3C7] px-2 py-0.5 rounded-full font-semibold">
                        referencia de demostración, no validada
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <footer className="pt-3 text-sm text-[#475569] border-t border-slate-100 leading-relaxed">
        Los puntos y polígonos son referencias cartográficas fijas de demostración académica; no representan rutas ni garantizan seguridad ante contingencias pluviales.
      </footer>
    </section>
  );
}
