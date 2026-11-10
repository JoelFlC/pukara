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
 * Componente MapaReferencial
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
  // 'inactivo' | 'solicitando' | 'concedido' | 'denegado' | 'no_disponible'
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
                fillColor: '#2563eb',
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
      className="rounded-2xl border border-slate-200/80 bg-white p-5 md:p-6 shadow-sm space-y-5"
    >
      {/* 1. Encabezado e Indicador Global vs Tono Neutro */}
      <div className="space-y-2 border-b border-slate-100 pb-3">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
            Cartografía Referencial
          </span>
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
            Sector Piloto Llojeta
          </span>
        </div>

        <h2 className="text-lg sm:text-xl font-bold text-slate-900 leading-snug">
          Mapa del Sector Piloto Llojeta / Bajo Llojeta
        </h2>

        {/* Nota obligatoria de la directriz arquitectónica */}
        <p
          data-testid="nota-indicador-global"
          className="text-xs text-slate-600 leading-relaxed bg-slate-50/80 p-3 rounded-xl border border-slate-200/80"
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
          className="rounded-xl border border-amber-200 bg-amber-50/90 p-3.5 text-xs text-amber-900 font-medium space-y-1 shadow-2xs"
        >
          <p className="font-semibold flex items-center gap-1.5">
            <span aria-hidden="true">⚠️</span> Cartografía parcial
          </p>
          <p className="text-amber-800 leading-relaxed">
            Mapa parcial con limitación de teselas: sin conexión a internet o teselas de OpenStreetMap no disponibles en el caché del navegador. Por política de uso de OpenStreetMap no se realiza precarga masiva de teselas. El sistema no ofrece navegación; consulte a continuación la lista completa de zonas y puntos de referencia de demostración disponibles sin conexión.
          </p>
        </div>
      )}

      {/* 3. Layout Responsivo en 2 Columnas para Desktop (lg:grid-cols-12) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Columna Izquierda (lg:col-span-7): Lienzo del Mapa Leaflet */}
        <div className="lg:col-span-7 space-y-2">
          <div className="relative rounded-2xl overflow-hidden border border-slate-200 bg-slate-100 shadow-2xs">
            <div
              ref={mapContainerRef}
              data-testid="mapa-leaflet-contenedor"
              className="w-full h-80 sm:h-96 lg:h-[480px] z-0 relative"
              tabIndex={0}
              aria-label="Mapa cartográfico referencial del sector piloto Llojeta"
            />
          </div>

          {/* Atribución única clara de OpenStreetMap */}
          <div className="text-[10px] text-slate-400 text-right px-1">
            &copy;{' '}
            <a
              href="https://www.openstreetmap.org/copyright"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-slate-600"
            >
              OpenStreetMap
            </a>{' '}
            contributors
          </div>
        </div>

        {/* Columna Derecha (lg:col-span-5): Proximidad Haversine, Zonas y Puntos */}
        <div className="lg:col-span-5 space-y-4">
          {/* Panel de Control de Ubicación GPS (Requisito P09 / P18) */}
          <div className="rounded-2xl border border-slate-200/80 bg-slate-50/90 p-4 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="min-w-0 flex-1">
                <h3 className="text-xs font-bold text-slate-800">
                  Ubicación aproximada en dispositivo
                </h3>
                <p className="text-[11px] text-slate-500 leading-snug mt-0.5">
                  Su ubicación se procesa únicamente en este dispositivo para
                  calcular la distancia en línea recta y nunca se almacena ni se
                  envía al servidor.
                </p>
              </div>

              <div className="w-full sm:w-auto shrink-0">
                {estadoUbicacion !== 'concedido' ? (
                  <button
                    type="button"
                    data-testid="btn-solicitar-ubicacion"
                    onClick={handleSolicitarUbicacion}
                    disabled={estadoUbicacion === 'solicitando'}
                    className="min-h-[44px] px-3.5 py-2 rounded-xl text-xs font-semibold bg-[#0F172A] text-white hover:bg-slate-800 active:bg-slate-950 disabled:opacity-50 transition-colors inline-flex items-center justify-center gap-2 shadow-xs w-full sm:w-auto cursor-pointer"
                  >
                    <span>📍</span>
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
                    className="min-h-[44px] px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-200 text-slate-700 hover:bg-slate-300 transition-colors inline-flex items-center justify-center gap-2 w-full sm:w-auto cursor-pointer"
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
                className="rounded-xl border border-slate-300 bg-white p-3 text-xs text-slate-700 space-y-1 shadow-2xs"
              >
                <p className="font-semibold text-slate-800">
                  Permiso de ubicación denegado o no disponible
                </p>
                <p className="text-slate-600 leading-relaxed">
                  Permiso de ubicación denegado o no disponible: no se muestran distancias a los puntos de referencia. La consulta general del nivel informativo, las recomendaciones y el mapa referencial funcionan con normalidad.
                </p>
              </div>
            )}

            {/* Ubicación concedida: detalle de precisión */}
            {estadoUbicacion === 'concedido' && ubicacionUsuario && (
              <div
                data-testid="aviso-gps-concedido"
                role="status"
                className="rounded-xl border border-blue-200 bg-blue-50 p-2.5 text-xs text-blue-900 flex items-center justify-between gap-2 shadow-2xs"
              >
                <span>
                  Ubicación activa en este dispositivo · Precisión: ±
                  {ubicacionUsuario.precision} m
                </span>
                <span className="text-[10px] bg-blue-100 text-blue-800 px-2 py-0.5 rounded font-mono">
                  GPS local
                </span>
              </div>
            )}
          </div>

          {/* Listado de Zonas de Referencia */}
          <div
            data-testid="seccion-zonas-referencia"
            className="rounded-2xl border border-slate-200/80 bg-white p-4 space-y-3"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Zonas de Referencia ({zonasReferencia.length})
              </h3>
              <span className="text-[10px] text-amber-900 font-semibold bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                referencia de demostración, no validada
              </span>
            </div>

            {zonasReferencia.length === 0 ? (
              <p className="text-xs text-slate-400 italic">
                No se han delimitado zonas de referencia aún.
              </p>
            ) : (
              <div className="grid grid-cols-1 gap-2.5 max-h-52 overflow-y-auto pr-1">
                {zonasReferencia.map((z) => (
                  <div
                    key={z.id}
                    data-testid="tarjeta-zona"
                    className="p-3 rounded-xl bg-slate-50/80 border border-slate-200/80 space-y-1 text-xs"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="font-bold text-slate-900">{z.nombre}</h4>
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded font-semibold border ${
                          z.verificada
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                            : 'bg-slate-100 text-slate-600 border-slate-200'
                        }`}
                      >
                        {z.verificada
                          ? 'Verificada por autoridad'
                          : 'Sin verificación oficial'}
                      </span>
                    </div>

                    <div className="text-[11px] text-slate-600 space-y-0.5">
                      <p>
                        <span className="font-medium text-slate-700">Fuente:</span>{' '}
                        {z.fuente || 'Propuesta académica'}
                      </p>
                      <p>
                        <span className="font-medium text-slate-700">
                          Fecha del dato:
                        </span>{' '}
                        {z.fecha_dato || 'No disponible'}
                        {z.vigente_hasta && ` · Vigente hasta: ${z.vigente_hasta}`}
                      </p>
                      {z.advertencia && (
                        <p className="text-amber-800 italic">{z.advertencia}</p>
                      )}
                    </div>

                    <div className="pt-1">
                      <span className="text-[10px] text-amber-900 bg-amber-100/70 px-1.5 py-0.5 rounded font-medium">
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
            className="rounded-2xl border border-slate-200/80 bg-white p-4 space-y-3"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Puntos de Referencia ({puntosConDistancia.length})
              </h3>
              <span className="text-[10px] text-amber-900 font-semibold bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                referencia de demostración, no validada
              </span>
            </div>

            {puntosConDistancia.length === 0 ? (
              <p className="text-xs text-slate-400 italic">
                No se han registrado puntos de referencia aún.
              </p>
            ) : (
              <div className="grid grid-cols-1 gap-2.5 max-h-72 overflow-y-auto pr-1">
                {puntosConDistancia.map((p) => (
                  <div
                    key={p.id}
                    data-testid="tarjeta-punto"
                    className="p-3 rounded-xl bg-slate-50/80 border border-slate-200/80 space-y-1.5 text-xs"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h4 className="font-bold text-slate-900">{p.nombre}</h4>
                        <span className="text-[10px] text-slate-500 font-mono">
                          Tipo: {p.tipo || 'Punto'}
                        </span>
                      </div>
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded font-semibold border ${
                          p.estado_verificacion === 'verificado_por_autoridad'
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                            : 'bg-amber-50 text-amber-800 border-amber-200'
                        }`}
                      >
                        {p.estado_verificacion === 'verificado_por_autoridad'
                          ? 'Verificado por autoridad'
                          : 'Referencia de demostración, no validada (sin verificar)'}
                      </span>
                    </div>

                    <div className="text-[11px] text-slate-600 space-y-0.5 font-mono">
                      <p>
                        Lat: {Number(p.latitud).toFixed(4)}, Lon:{' '}
                        {Number(p.longitud).toFixed(4)}
                      </p>
                      <p className="font-sans text-slate-500">
                        Fuente: {p.fuente || 'Propuesta académica'}
                      </p>
                    </div>

                    {/* Distancia Haversine calculada en el cliente (P18) */}
                    {p.distancia ? (
                      <div
                        data-testid="distancia-haversine"
                        className="p-2.5 rounded-xl bg-blue-50/80 border border-blue-200 text-blue-900 space-y-0.5 shadow-2xs"
                      >
                        <p className="font-bold text-xs">
                          Distancia en línea recta: {p.distancia.distanciaCorta}
                        </p>
                        <p className="text-[10px] text-slate-600 leading-snug">
                          {p.distancia.leyenda}
                        </p>
                      </div>
                    ) : (
                      <div className="text-[10px] text-slate-400 italic">
                        Distancia no calculada (active ubicación en el dispositivo)
                      </div>
                    )}

                    <div className="pt-0.5">
                      <span className="text-[10px] text-amber-900 bg-amber-100/70 px-1.5 py-0.5 rounded font-medium">
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

      <footer className="pt-2 text-[11px] text-slate-400 border-t border-slate-100 leading-relaxed">
        Los puntos y polígonos son referencias cartográficas fijas de demostración académica; no representan rutas ni garantizan seguridad ante contingencias pluviales.
      </footer>
    </section>
  );
}
