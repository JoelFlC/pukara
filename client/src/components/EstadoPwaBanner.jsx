import React, { useEffect, useState } from 'react';
import {
  esModoStandalone,
  configurarPromptInstalacion,
  dispararPromptInstalacion,
} from '../utils/pwaRegister.js';

/**
 * Componente EstadoPwaBanner (Requisito P12 / Sección 9.4)
 * Muestra una opción discreta y accesible para instalar la PWA cuando el navegador
 * lo permite (evento beforeinstallprompt) o indica que ya está operando como aplicación independiente.
 *
 * @param {Object} props
 * @param {boolean} [props.instalableInicial=false] Permite forzar visibilidad en pruebas unitarias
 * @param {Function} [props.alInstalar] Callback opcional para pruebas
 */
export default function EstadoPwaBanner({
  instalableInicial = false,
  alInstalar,
}) {
  const [instalable, setInstalable] = useState(instalableInicial);
  const [esStandalone, setEsStandalone] = useState(false);
  const [descartado, setDescartado] = useState(false);

  useEffect(() => {
    setEsStandalone(esModoStandalone());

    const desuscribir = configurarPromptInstalacion((listo) => {
      setInstalable(listo);
    });

    return () => {
      desuscribir();
    };
  }, []);

  const handleInstalar = async () => {
    if (alInstalar) {
      alInstalar();
    }
    const resultado = await dispararPromptInstalacion();
    if (resultado) {
      setInstalable(false);
    }
  };

  if (descartado || esStandalone || !instalable) {
    return null;
  }

  return (
    <div
      data-testid="banner-instalacion-pwa"
      role="region"
      aria-label="Instalación de aplicación PWA"
      className="clay-card bg-[#EEF2FF]/95 border-[#3525CD]/20 p-4 sm:p-5 text-[#111C2D] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3.5 animate-fade-up"
    >
      <div className="flex items-start sm:items-center gap-3 min-w-0">
        <span
          className="w-10 h-10 rounded-full bg-white text-[#3525CD] flex items-center justify-center text-lg shrink-0 clay-pill"
          aria-hidden="true"
        >
          📲
        </span>
        <div className="min-w-0">
          <p className="headline-sm text-base sm:text-lg font-bold text-[#111C2D]">
            Instalar PUKARA en este dispositivo
          </p>
          <p className="text-sm sm:text-base text-[#464555] leading-snug">
            Permite la consulta rápida y la disponibilidad de datos recientes sin conexión.
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2.5 shrink-0 w-full sm:w-auto">
        <button
          type="button"
          data-testid="btn-instalar-pwa"
          onClick={handleInstalar}
          className="clay-btn-primary clay-interactive min-h-[48px] flex-1 sm:flex-initial px-5 py-2.5 text-sm sm:text-base font-bold inline-flex items-center justify-center gap-2 cursor-pointer"
        >
          <span>Instalar aplicación PWA para consulta sin conexión</span>
        </button>

        <button
          type="button"
          onClick={() => setDescartado(true)}
          aria-label="Cerrar sugerencia de instalación"
          className="min-h-[48px] min-w-[48px] rounded-full bg-white/80 hover:bg-white text-[#475569] hover:text-[#111C2D] border border-slate-200/80 transition-colors inline-flex items-center justify-center text-base font-bold shrink-0 cursor-pointer"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
