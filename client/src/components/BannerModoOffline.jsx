import React from 'react';
import { construirAvisoDatosNoActualizados } from '../utils/offlineStorage.js';

/**
 * Componente BannerModoOffline (Requisito P08 / Sección 9.4 y 11.1 criterio 5)
 * Despliega de forma visible y prioritaria el aviso institucional permanente
 * cuando el usuario navega sin conexión a internet (modo avión / red caída):
 * "Datos del [fecha y hora], no actualizados".
 *
 * @param {Object} props
 * @param {boolean} [props.activo=false] Si el modo offline está activo
 * @param {string} [props.fechaDatoIso] Marca de tiempo ISO del dato histórico
 * @param {string} [props.avisoOffline] Leyenda preformateada (opcional)
 * @param {string} [props.guardadoEnIso] Marca de tiempo en que se guardó en este dispositivo
 * @param {Function} [props.onReintentar] Callback para reintentar la conexión de red
 */
export default function BannerModoOffline({
  activo = false,
  fechaDatoIso,
  avisoOffline,
  guardadoEnIso,
  onReintentar,
}) {
  if (!activo) {
    return null;
  }

  const tituloAviso =
    avisoOffline || construirAvisoDatosNoActualizados(fechaDatoIso);

  return (
    <div
      data-testid="banner-datos-no-actualizados"
      role="status"
      aria-live="polite"
      className="rounded-2xl border-2 border-amber-300 bg-amber-50/95 p-4 sm:p-5 shadow-sm space-y-3 text-amber-950"
    >
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="text-xl shrink-0" aria-hidden="true">
            📡
          </span>
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-800 block">
              Consulta con Conectividad Limitada
            </span>
            <h2
              data-testid="aviso-datos-offline"
              className="text-sm sm:text-base font-bold text-amber-950 tracking-tight leading-snug"
            >
              {tituloAviso}
            </h2>
          </div>
        </div>

        {onReintentar && (
          <button
            type="button"
            data-testid="btn-reintentar-conexion"
            onClick={onReintentar}
            className="min-h-[44px] px-3.5 py-2 rounded-xl text-xs font-semibold bg-amber-900 text-white hover:bg-amber-800 active:bg-amber-950 transition-colors shrink-0 shadow-xs inline-flex items-center justify-center gap-1.5"
          >
            <span aria-hidden="true">🔄</span>
            <span>Reintentar conexión</span>
          </button>
        )}
      </div>

      <p className="text-xs text-amber-900 leading-relaxed">
        Modo sin conexión o conectividad limitada: se muestra únicamente la última información almacenada previamente en este dispositivo (nivel informativo conocido, recomendaciones preventivas generales, contactos de emergencia y lista de puntos de referencia). No representa el estado meteorológico en tiempo real.
      </p>

      {guardadoEnIso && (
        <p className="text-[10px] text-amber-800/80 font-mono">
          Almacenado localmente en este dispositivo: {guardadoEnIso}
        </p>
      )}
    </div>
  );
}
