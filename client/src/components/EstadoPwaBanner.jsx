import React, { useEffect, useState } from 'react';
import {
  esModoStandalone,
  detectarPlataformaMovil,
  configurarPromptInstalacion,
  dispararPromptInstalacion,
} from '../utils/pwaRegister.js';

/**
 * Componente EstadoPwaBanner (Requisito P12 / Sección 9.4)
 * Muestra el prompt nativo de instalación PWA cuando `beforeinstallprompt` está disponible
 * o una guía rápida para instalar PUKARA como app en Android / iPhone cuando el usuario
 * lo solicita manualmente desde el botón "Instalar App".
 *
 * @param {Object} props
 * @param {boolean} [props.instalableInicial=false] Permite forzar visibilidad en pruebas unitarias
 * @param {boolean} [props.abiertoManual=false] Permite abrir la guía de instalación móvil manualmente
 * @param {Function} [props.onCerrarManual] Callback al cerrar la guía manual
 * @param {Function} [props.alInstalar] Callback opcional para pruebas
 */
export default function EstadoPwaBanner({
  instalableInicial = false,
  abiertoManual = false,
  onCerrarManual,
  alInstalar,
}) {
  const [instalable, setInstalable] = useState(instalableInicial);
  const [esStandalone, setEsStandalone] = useState(false);
  const [descartado, setDescartado] = useState(false);

  useEffect(() => {
    setEsStandalone(esModoStandalone());

    const desuscribir = configurarPromptInstalacion((listo) => {
      setInstalable(listo);
      if (listo) {
        setDescartado(false);
      }
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
      if (onCerrarManual) onCerrarManual();
    }
  };

  const handleCerrar = () => {
    if (abiertoManual && onCerrarManual) {
      onCerrarManual();
      return;
    }
    setDescartado(true);
  };

  const mostrarAutomatico = !descartado && !esStandalone && instalable;
  const mostrarManual = abiertoManual && !esStandalone;

  if (!mostrarAutomatico && !mostrarManual) {
    return null;
  }

  const plataforma = detectarPlataformaMovil();
  const esContextoSeguro =
    typeof window === 'undefined' ? true : Boolean(window.isSecureContext);
  const origenActual =
    typeof window === 'undefined' ? '' : window.location?.origin || '';

  return (
    <div
      data-testid="banner-instalacion-pwa"
      role="region"
      aria-label="Instalación de aplicación PWA"
      className="fixed bottom-20 md:bottom-6 right-4 left-4 sm:left-auto z-50 sm:max-w-sm clay-card bg-white/95 backdrop-blur-md border-2 border-[#3525CD]/25 p-4 sm:p-5 text-[#111C2D] space-y-3.5 shadow-2xl animate-fade-up"
    >
      <div className="flex items-start justify-between gap-2.5">
        <div className="flex items-start gap-3 min-w-0">
          <img
            src="/logo.png"
            alt=""
            aria-hidden="true"
            className="w-10 h-10 object-contain shrink-0"
          />
          <div className="min-w-0">
            <p className="headline-sm text-base font-bold text-[#111C2D] leading-snug">
              Instalar PUKARA en este dispositivo
            </p>
            <p className="text-sm text-[#464555] leading-snug mt-0.5">
              Úsala como app en tu pantalla de inicio, incluso sin conexión.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleCerrar}
          aria-label="Cerrar sugerencia de instalación"
          className="w-9 h-9 rounded-full bg-slate-100 hover:bg-slate-200 text-[#475569] hover:text-[#111C2D] transition-colors inline-flex items-center justify-center text-sm font-bold shrink-0 cursor-pointer"
        >
          ✕
        </button>
      </div>

      {instalable ? (
        <button
          type="button"
          data-testid="btn-instalar-pwa"
          onClick={handleInstalar}
          className="clay-btn-primary clay-interactive min-h-[48px] w-full px-4 py-2 text-sm font-bold inline-flex items-center justify-center gap-2 cursor-pointer"
        >
          <span>Instalar aplicación PWA para consulta sin conexión</span>
        </button>
      ) : (
        <div className="rounded-2xl bg-[#F4F6FB] border border-slate-200/80 p-3.5 text-xs sm:text-sm text-[#1E293B] space-y-2 leading-relaxed">
          {!esContextoSeguro ? (
            <>
              <p className="font-bold text-[#92400E]">
                Estás en HTTP local no seguro ({origenActual || 'IP LAN'})
              </p>
              <p>
                Chrome Android desactiva los Service Workers en direcciones <code>http://</code> locales y por eso solo ofrece <strong>Crear acceso directo</strong> en lugar de instalar la app real.
              </p>
              <ol className="list-decimal pl-4 space-y-1">
                <li>Ábrela por <strong>HTTPS</strong> o mediante <code>http://localhost</code> (con cable USB <code>adb reverse</code>).</li>
                <li>O en Chrome del móvil abre <code>chrome://flags/#unsafely-treat-insecure-origin-as-secure</code>, pega <code>{origenActual}</code> y reinicia Chrome.</li>
              </ol>
            </>
          ) : plataforma === 'ios' ? (
            <>
              <p className="font-bold text-[#111C2D]">En iPhone / iPad (Safari):</p>
              <ol className="list-decimal pl-4 space-y-1">
                <li>Toca el botón <strong>Compartir</strong> en la barra inferior.</li>
                <li>Elige <strong>Agregar a pantalla de inicio</strong> y pulsa <strong>Agregar</strong>.</li>
              </ol>
            </>
          ) : (
            <>
              <p className="font-bold text-[#111C2D]">En Android / Chrome o Edge:</p>
              <ol className="list-decimal pl-4 space-y-1">
                <li>Abre el menú del navegador (<strong>⋮</strong> arriba a la derecha).</li>
                <li>Selecciona <strong>Instalar aplicación</strong> o <strong>Agregar a la pantalla principal</strong>.</li>
              </ol>
            </>
          )}
        </div>
      )}
    </div>
  );
}
