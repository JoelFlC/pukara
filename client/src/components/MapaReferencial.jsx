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
    setEstado('denegado');
  } else {
    setEstado('no_disponible');
  }
  setUbicacion(null);
}

/**
 * Componente MapaReferencial (Capítulo 02 — Cartografía de Referencia)
 * Mapa limpio a ancho completo con los puntos y zonas de referencia agrupados en un modal
 * ampliable bajo demanda (sin ocupar espacio permanente junto al mapa).
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

  const [hayErrorTeselas, setHayErrorTeselas] = useState(false);
  const sinTeselasDisponibles =
    modoOffline ||
    hayErrorTeselas ||
    (typeof navigator !== 'undefined' && !navigator.onLine);

  const [estadoUbicacion, setEstadoUbicacion] = useState(estadoUbicacionInicial);
  const [ubicacionUsuario, setUbicacionUsuario] = useState(ubicacionInicial);
  const [modalReferenciasAbierto, setModalReferenciasAbierto] = useState(false);

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

  const tileUrl =
    (typeof import.meta !== 'undefined' &&
      import.meta.env?.VITE_OSM_TILE_URL) ||
    'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';

  const puntosConDistancia = useMemo(() => {
    if (estadoUbicacion === 'concedido' && ubicacionUsuario) {
      return calcularDistanciasAPuntos(ubicacionUsuario, puntosReferencia);
    }
    return puntosReferencia.map((p) => ({ ...p, distancia: null }));
  }, [puntosReferencia, estadoUbicacion, ubicacionUsuario]);

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
        setModalReferenciasAbierto(true);
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

  useEffect(() => {
    if (typeof window === 'undefined') return;

    let cancelado = false;

    import('leaflet')
      .then((leafletModule) => {
        if (cancelado) return;
        const L = leafletModule.default || leafletModule;

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

        if (markersLayerRef.current && mapInstanceRef.current) {
          markersLayerRef.current.clearLayers();

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

  const renderListaPuntos = () => (
    <div data-testid="seccion-puntos-referencia" className="space-y-3">
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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {puntosConDistancia.map((p) => (
            <div
              key={p.id}
              data-testid="tarjeta-punto"
              className="p-4 rounded-2xl bg-[#F4F6FB] border border-slate-200/80 space-y-2"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <h4 className="font-bold text-base text-[#111C2D] break-words">
                    {p.nombre}
                  </h4>
                  <span className="text-xs text-[#475569] font-mono">
                    Tipo: {p.tipo || 'Punto'} · Lat {Number(p.latitud).toFixed(4)}, Lon {Number(p.longitud).toFixed(4)}
                  </span>
                </div>
                <span
                  className={`clay-pill text-[11px] px-2.5 py-0.5 font-bold border shrink-0 ${
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

              <p className="text-xs sm:text-sm text-[#464555]">
                Fuente: {p.fuente || 'Propuesta académica'}
              </p>

              {p.distancia ? (
                <div
                  data-testid="distancia-haversine"
                  className="p-3 rounded-xl bg-white border border-[#E2DFFF] text-[#111C2D] space-y-0.5"
                >
                  <p className="font-extrabold text-sm sm:text-base text-[#3525CD]">
                    Distancia en línea recta: {p.distancia.distanciaCorta}
                  </p>
                  <p className="text-xs text-[#464555] leading-snug">
                    {p.distancia.leyenda}
                  </p>
                </div>
              ) : (
                <p className="text-xs text-[#475569] italic">
                  Distancia no calculada (active ubicación en el dispositivo)
                </p>
              )}

              <div>
                <span className="text-[11px] text-[#92400E] bg-[#FEF3C7] px-2 py-0.5 rounded-full font-semibold">
                  referencia de demostración, no validada
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const renderListaZonas = () => (
    <div data-testid="seccion-zonas-referencia" className="space-y-3">
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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {zonasReferencia.map((z) => (
            <div
              key={z.id}
              data-testid="tarjeta-zona"
              className="p-3.5 rounded-2xl bg-[#F4F6FB] border border-slate-200/80 space-y-1"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <h4 className="font-bold text-base text-[#111C2D]">{z.nombre}</h4>
                <span
                  className={`clay-pill text-[11px] px-2.5 py-0.5 font-bold border ${
                    z.verificada
                      ? 'bg-[#ECFDF5] text-[#065F46] border-[#A7F3D0]'
                      : 'bg-white text-[#475569] border-slate-200'
                  }`}
                >
                  {z.verificada
                    ? 'Verificada por autoridad'
                    : 'Sin verificación oficial'}
                </span>
              </div>

              <div className="text-xs sm:text-sm text-[#464555] space-y-0.5">
                <p>
                  <strong className="text-[#111C2D]">Fuente:</strong>{' '}
                  {z.fuente || 'Propuesta académica'}
                </p>
                <p>
                  <strong className="text-[#111C2D]">Fecha del dato:</strong>{' '}
                  {z.fecha_dato || 'No disponible'}
                  {z.vigente_hasta && ` · Vigente hasta: ${z.vigente_hasta}`}
                </p>
                {z.advertencia && (
                  <p className="text-[#92400E] italic text-xs">{z.advertencia}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <section
      aria-label="Mapa referencial del sector piloto"
      className="space-y-5 animate-fade-up"
    >
      {/* 1. Encabezado Editorial Suizo directo sobre el lienzo */}
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-3">
          <span className="swiss-chapter-badge">
            02 CAPÍTULO DOS — CARTOGRAFÍA DE REFERENCIA
          </span>
          <span className="clay-pill px-3 py-0.5 text-xs font-bold bg-white text-[#111C2D] border border-slate-200">
            Sector Piloto Llojeta
          </span>
        </div>

        <h2 className="headline-lg text-2xl sm:text-4xl font-extrabold text-[#111C2D] leading-tight break-words">
          Mapa del Sector Piloto Llojeta / Bajo Llojeta
        </h2>

        <p
          data-testid="nota-indicador-global"
          className="text-base text-[#464555] leading-relaxed max-w-4xl"
        >
          El nivel informativo de lluvia es un indicador global para todo el
          sector piloto Llojeta / Bajo Llojeta y no varía espacialmente. Las
          zonas de referencia se representan en color neutro.
        </p>
      </div>

      {/* 2. Aviso de error o mapa parcial (Requisito P10) */}
      {sinTeselasDisponibles && (
        <div
          data-testid="aviso-mapa-parcial"
          role="status"
          className="clay-card-sm border-2 border-[#FDE68A] bg-[#FEF3C7] p-4 sm:p-5 text-base text-[#92400E] font-medium space-y-1.5"
        >
          <p className="font-bold flex items-center gap-2">
            <span aria-hidden="true">⚠️</span> Cartografía parcial
          </p>
          <p className="text-sm sm:text-base text-[#92400E] leading-relaxed">
            Mapa parcial con limitación de teselas: sin conexión a internet o teselas de OpenStreetMap no disponibles en el caché del navegador. Por política de uso de OpenStreetMap no se realiza precarga masiva de teselas. El sistema no ofrece navegación; consulte a continuación la lista completa de zonas y puntos de referencia de demostración disponibles sin conexión.
          </p>
        </div>
      )}

      {/* 3. Tarjeta Única Amplia del Mapa (Ancho Completo) + Controles Limpios */}
      <div className="clay-card p-4 sm:p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 pb-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-bold text-base text-[#111C2D]">
              Topografía Llojeta - Cotahuma
            </span>
            <span className="font-mono text-xs text-[#475569] bg-[#F4F6FB] px-2.5 py-1 rounded-full">
              {centroLat.toFixed(4)}, {centroLon.toFixed(4)}
            </span>
          </div>

          <button
            type="button"
            onClick={() => setModalReferenciasAbierto(true)}
            className="clay-btn-secondary clay-interactive min-h-[44px] px-4 py-2 text-xs sm:text-sm font-bold text-[#3525CD] inline-flex items-center gap-2 cursor-pointer"
          >
            <span aria-hidden="true">📋</span>
            <span>
              Ver puntos ({puntosConDistancia.length}) y zonas ({zonasReferencia.length})
            </span>
          </button>
        </div>

        <div className="rounded-2xl overflow-hidden border border-slate-200/80 bg-slate-100">
          <div
            ref={mapContainerRef}
            data-testid="mapa-leaflet-contenedor"
            className="h-[320px] sm:h-[420px] lg:h-[480px] w-full rounded-2xl overflow-hidden z-0 relative bg-slate-100"
            tabIndex={0}
            aria-label="Mapa cartográfico referencial del sector piloto Llojeta"
          />
        </div>

        {/* Barra inferior de ubicación GPS local y atribución */}
        <div className="space-y-3 pt-1">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-bold text-[#111C2D]">
                Ubicación aproximada en dispositivo
              </p>
              <p className="text-xs sm:text-sm text-[#464555]">
                Cálculo Haversine local; su GPS jamás se envía al servidor.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
              {estadoUbicacion !== 'concedido' ? (
                <button
                  type="button"
                  data-testid="btn-solicitar-ubicacion"
                  onClick={handleSolicitarUbicacion}
                  disabled={estadoUbicacion === 'solicitando'}
                  className="clay-btn-primary clay-interactive min-h-[48px] px-5 py-2.5 text-sm font-bold disabled:opacity-50 inline-flex items-center justify-center gap-2 text-center leading-snug cursor-pointer"
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
                  className="clay-btn-secondary clay-interactive min-h-[48px] px-4 py-2 text-sm font-bold inline-flex items-center justify-center gap-2 cursor-pointer"
                >
                  <span>Ocultar mi ubicación</span>
                </button>
              )}
            </div>
          </div>

          {/* Estado GPS Denegado (P09) */}
          {(estadoUbicacion === 'denegado' ||
            estadoUbicacion === 'no_disponible') && (
            <div
              data-testid="aviso-gps-denegado"
              role="status"
              className="rounded-2xl bg-[#F4F6FB] border border-slate-300 p-3.5 text-sm text-[#1E293B] space-y-1"
            >
              <p className="font-bold text-[#111C2D]">
                Permiso de ubicación denegado o no disponible
              </p>
              <p className="text-[#464555] leading-relaxed">
                Permiso de ubicación denegado o no disponible: no se muestran distancias a los puntos de referencia. La consulta general del nivel informativo, las recomendaciones y el mapa referencial funcionan con normalidad.
              </p>
            </div>
          )}

          {/* Estado GPS Concedido */}
          {estadoUbicacion === 'concedido' && ubicacionUsuario && (
            <div
              data-testid="aviso-gps-concedido"
              role="status"
              className="rounded-2xl border border-[#E2DFFF] bg-[#EEF2FF] p-3.5 text-sm sm:text-base text-[#111C2D] flex flex-wrap items-center justify-between gap-2"
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

          {/* Desplegable discreto de referencia (mantiene trazabilidad sin ocupar espacio) + atribución OSM */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100">
            <details className="w-full sm:w-auto flex-1 group">
              <summary className="text-sm font-bold text-[#3525CD] hover:text-[#4F46E5] cursor-pointer select-none inline-flex items-center gap-2 py-1">
                <span>
                  Detalle rápido de {puntosConDistancia.length} puntos y {zonasReferencia.length} zonas de referencia
                </span>
                <span className="text-xs transition-transform group-open:rotate-180" aria-hidden="true">▼</span>
              </summary>
              <div className="mt-4 space-y-6 pt-3 border-t border-slate-100">
                {renderListaPuntos()}
                {renderListaZonas()}
              </div>
            </details>

            <div className="text-xs text-[#475569] shrink-0">
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
        </div>
      </div>

      {/* 4. Modal Ampliado de Puntos y Zonas de Referencia (bajo demanda) */}
      {modalReferenciasAbierto && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Zonas y Puntos de Referencia de Llojeta"
          className="fixed inset-0 z-50 bg-slate-900/45 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div className="clay-card bg-white w-full max-w-4xl max-h-[85vh] flex flex-col overflow-hidden animate-fade-up">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between gap-3">
              <div>
                <span className="swiss-chapter-badge block">
                  Sector Piloto Llojeta
                </span>
                <h3 className="headline-md text-xl font-extrabold text-[#111C2D]">
                  Puntos y Zonas de Referencia Cartográfica
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setModalReferenciasAbierto(false)}
                className="min-h-[44px] min-w-[44px] px-4 py-2 rounded-full bg-[#F4F6FB] hover:bg-slate-200 text-[#111C2D] font-bold text-sm cursor-pointer"
              >
                ✕ Cerrar
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-6">
              {renderListaPuntos()}
              {renderListaZonas()}
            </div>
          </div>
        </div>
      )}

      <footer className="text-xs sm:text-sm text-[#475569] leading-relaxed px-1">
        Los puntos y polígonos son referencias cartográficas fijas de demostración académica; no representan rutas ni garantizan seguridad ante contingencias pluviales.
      </footer>
    </section>
  );
}
