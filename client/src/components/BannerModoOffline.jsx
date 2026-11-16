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
      className="clay-card border-2 border-[#FDE68A] bg-[#FEF3C7] p-5 sm:p-6 space-y-3.5 text-[#92400E] animate-fade-up"
    >
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3.5">
        <div className="flex items-start sm:items-center gap-3 min-w-0">
          <span
            className="w-10 h-10 rounded-full bg-white/90 text-[#B45309] flex items-center justify-center text-xl shrink-0 clay-pill"
            aria-hidden="true"
          >
            📡
          </span>
          <div className="min-w-0">
            <span className="text-xs font-extrabold uppercase tracking-wider text-[#B45309] block">
              Consulta con Conectividad Limitada
            </span>
            <h2
              data-testid="aviso-datos-offline"
              className="headline-sm text-base sm:text-lg font-extrabold text-[#92400E] tracking-tight leading-snug break-words"
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
            className="clay-interactive min-h-[48px] w-full sm:w-auto px-5 py-2.5 rounded-full text-sm sm:text-base font-bold bg-[#92400E] text-white hover:bg-[#78350F] transition-colors shrink-0 shadow-sm inline-flex items-center justify-center gap-2 cursor-pointer"
          >
            <span aria-hidden="true">🔄</span>
            <span>Reintentar conexión</span>
          </button>
        )}
      </div>

      <p className="text-base text-[#92400E] leading-relaxed">
        Modo sin conexión o conectividad limitada: se muestra únicamente la última información almacenada previamente en este dispositivo (nivel informativo conocido, recomendaciones preventivas generales, contactos de emergencia y lista de puntos de referencia). No representa el estado meteorológico en tiempo real.
      </p>

      {guardadoEnIso && (
        <p className="text-xs sm:text-sm text-[#92400E]/90 font-mono break-all">
          Almacenado localmente en este dispositivo: {guardadoEnIso}
        </p>
      )}
    </div>
  );
}
