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
      className="fixed bottom-20 md:bottom-6 right-4 left-4 sm:left-auto z-40 sm:max-w-sm clay-card bg-white/95 backdrop-blur-md border-2 border-[#3525CD]/25 p-4 text-[#111C2D] space-y-3 shadow-2xl animate-fade-up"
    >
      <div className="flex items-start justify-between gap-2.5">
        <div className="flex items-start gap-3 min-w-0">
          <span
            className="w-10 h-10 rounded-full bg-[#EEF2FF] text-[#3525CD] flex items-center justify-center text-lg shrink-0 clay-pill"
            aria-hidden="true"
          >
            📲
          </span>
          <div className="min-w-0">
            <p className="headline-sm text-base font-bold text-[#111C2D] leading-snug">
              Instalar PUKARA en este dispositivo
            </p>
            <p className="text-sm text-[#464555] leading-snug mt-0.5">
              Acceso rápido y consulta sin conexión.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setDescartado(true)}
          aria-label="Cerrar sugerencia de instalación"
          className="w-9 h-9 rounded-full bg-slate-100 hover:bg-slate-200 text-[#475569] hover:text-[#111C2D] transition-colors inline-flex items-center justify-center text-sm font-bold shrink-0 cursor-pointer"
        >
          ✕
        </button>
      </div>

      <button
        type="button"
        data-testid="btn-instalar-pwa"
        onClick={handleInstalar}
        className="clay-btn-primary clay-interactive min-h-[48px] w-full px-4 py-2 text-sm font-bold inline-flex items-center justify-center gap-2 cursor-pointer"
      >
        <span>Instalar aplicación PWA para consulta sin conexión</span>
      </button>
    </div>
  );
}
