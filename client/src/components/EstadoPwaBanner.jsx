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
      className="rounded-xl border border-sky-200 bg-sky-50/90 p-3 text-xs text-sky-950 shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5"
    >
      <div className="flex items-center gap-2">
        <span className="text-base" aria-hidden="true">
          📲
        </span>
        <div>
          <p className="font-semibold text-slate-900">
            Instalar PUKARA en este dispositivo
          </p>
          <p className="text-[11px] text-slate-600 leading-tight">
            Permite la consulta rápida y la disponibilidad de datos recientes sin conexión.
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <button
          type="button"
          data-testid="btn-instalar-pwa"
          onClick={handleInstalar}
          className="min-h-[44px] px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-900 text-white hover:bg-slate-800 active:bg-slate-950 transition-colors inline-flex items-center justify-center gap-1.5 shadow-xs"
        >
          <span>Instalar aplicación PWA para consulta sin conexión</span>
        </button>

        <button
          type="button"
          onClick={() => setDescartado(true)}
          aria-label="Cerrar sugerencia de instalación"
          className="min-h-[44px] min-w-[44px] text-slate-400 hover:text-slate-700 transition-colors inline-flex items-center justify-center text-sm"
        >
          ✕
        </button>
      </div>
    </div>
  );
}

