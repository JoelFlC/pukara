import React, { useEffect, useState } from 'react';
import { construirAvisoDatosNoActualizados } from '../utils/offlineStorage.js';

/**
 * Componente BannerModoOffline (Requisito P08 / Sección 9.4 y 11.1 criterio 5)
 * Se presenta como modal compacto y centrado cuando la red falla, evitando
 * desplazar o interferir con el Hero Banner superior.
 *
 * @param {Object} props
 * @param {boolean} [props.activo=false] Si el modo offline está activo
 * @param {string} [props.fechaDatoIso] Marca de tiempo ISO del dato histórico
 * @param {string} [props.avisoOffline] Leyenda preformateada (opcional)
 * @param {string} [props.guardadoEnIso] Marca de tiempo en que se guardó en este dispositivo
 * @param {Function} [props.onReintentar] Callback para reintentar la conexión de red
 * @param {Function} [props.onCerrar] Callback opcional al cerrar temporalmente el modal
 */
export default function BannerModoOffline({
  activo = false,
  fechaDatoIso,
  avisoOffline,
  guardadoEnIso,
  onReintentar,
  onCerrar,
}) {
  const [cerrado, setCerrado] = useState(false);

  useEffect(() => {
    if (activo) {
      setCerrado(false);
    }
  }, [activo, fechaDatoIso]);

  if (!activo || cerrado) {
    return null;
  }

  const tituloAviso =
    avisoOffline || construirAvisoDatosNoActualizados(fechaDatoIso);

  const handleCerrar = () => {
    setCerrado(true);
    if (onCerrar) {
      onCerrar();
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/45 backdrop-blur-xs flex items-center justify-center p-4">
      <div
        data-testid="banner-datos-no-actualizados"
        role="status"
        aria-live="polite"
        aria-modal="true"
        className="w-full max-w-lg clay-card border-2 border-[#FBBF24] bg-[#FFFBEB] p-5 sm:p-6 space-y-4 text-[#92400E] shadow-2xl animate-fade-up"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <span
              className="w-10 h-10 rounded-full bg-white text-[#B45309] flex items-center justify-center text-xl shrink-0 clay-pill border border-[#FDE68A]"
              aria-hidden="true"
            >
              📡
            </span>
            <div className="min-w-0 space-y-0.5">
              <span className="text-xs font-extrabold uppercase tracking-wider text-[#B45309] block">
                Consulta con Conectividad Limitada
              </span>
              <h2
                data-testid="aviso-datos-offline"
                className="headline-sm text-lg font-extrabold text-[#92400E] tracking-tight leading-snug break-words"
              >
                {tituloAviso}
              </h2>
            </div>
          </div>

          <button
            type="button"
            onClick={handleCerrar}
            aria-label="Cerrar aviso sin conexión"
            className="w-9 h-9 rounded-full bg-white/90 hover:bg-white text-[#92400E] border border-[#FDE68A] flex items-center justify-center text-sm font-bold shrink-0 cursor-pointer"
          >
            ✕
          </button>
        </div>

        <p className="text-base text-[#92400E] leading-relaxed">
          Modo sin conexión o conectividad limitada: se muestra la última información guardada en este dispositivo. No representa el estado en tiempo real.
        </p>

        {guardadoEnIso && (
          <p className="text-xs text-[#92400E]/85 font-mono break-all">
            Respaldo local: {guardadoEnIso}
          </p>
        )}

        <div className="flex flex-col sm:flex-row justify-end gap-2.5 pt-1">
          <button
            type="button"
            onClick={handleCerrar}
            className="min-h-[48px] px-4 py-2.5 rounded-full text-sm font-bold bg-white/90 hover:bg-white text-[#92400E] border border-[#FDE68A] cursor-pointer"
          >
            Ver respaldo guardado
          </button>

          {onReintentar && (
            <button
              type="button"
              data-testid="btn-reintentar-conexion"
              onClick={onReintentar}
              className="clay-interactive min-h-[48px] px-5 py-2.5 rounded-full text-sm sm:text-base font-bold bg-[#92400E] text-white hover:bg-[#78350F] transition-colors shrink-0 shadow-sm inline-flex items-center justify-center gap-2 cursor-pointer"
            >
              <span aria-hidden="true">🔄</span>
              <span>Reintentar conexión</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
