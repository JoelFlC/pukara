import React, { useState, useEffect } from 'react';
import {
  soportaLecturaVoz,
  estaLeyendo,
  obtenerIdLecturaActiva,
  obtenerErrorLecturaVoz,
  suscribirEstadoLectura,
  leerTexto,
  detenerLectura,
} from '../utils/lectorVoz';

function IconoAltavozVoz({ activo }) {
  return (
    <svg
      className="w-5 h-5 shrink-0"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
      {activo ? (
        <rect x="16" y="8" width="6" height="8" rx="1.5" />
      ) : (
        <>
          <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
          <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
        </>
      )}
    </svg>
  );
}

/**
 * Botón reutilizable y accesible de lectura por voz (Web Speech API / TTS offline).
 *
 * @param {Object} props
 * @param {string} props.texto Texto que será leído en voz alta
 * @param {string} props.idLectura Identificador único del bloque de lectura
 * @param {string} [props.etiqueta='Escuchar'] Texto del botón en reposo
 * @param {string} [props.etiquetaDetener='Detener voz'] Texto cuando está leyendo este bloque
 * @param {string|null} [props.ariaLabel=null]
 * @param {boolean} [props.ocultarSiNoSoporta=true]
 * @param {boolean} [props.compacto=false] Modo icono circular compacto para tarjetas de telemetría
 * @param {'primario'|'secundario'} [props.variante='secundario']
 * @param {string} [props.className='']
 */
export default function BotonLeerVoz({
  texto,
  idLectura,
  etiqueta = 'Escuchar',
  etiquetaDetener = 'Detener voz',
  ariaLabel = null,
  ocultarSiNoSoporta = true,
  compacto = false,
  variante = 'secundario',
  className = '',
}) {
  const [estadoVoz, setEstadoVoz] = useState(() => ({
    leyendo: estaLeyendo(),
    idActivo: obtenerIdLecturaActiva(),
    errorMensaje: obtenerErrorLecturaVoz(),
  }));
  const [ultimoSolicitado, setUltimoSolicitado] = useState(false);

  useEffect(() => {
    return suscribirEstadoLectura((nuevoEstado) => {
      setEstadoVoz(nuevoEstado);
      if (nuevoEstado.leyendo && nuevoEstado.idActivo !== idLectura) {
        setUltimoSolicitado(false);
      }
    });
  }, [idLectura]);

  const soportado = soportaLecturaVoz();
  if (!soportado && ocultarSiNoSoporta) {
    return null;
  }

  const textoValido = typeof texto === 'string' && texto.trim().length > 0;
  const estaActivo =
    Boolean(estadoVoz.leyendo) && estadoVoz.idActivo === idLectura;

  const handleClick = () => {
    if (!soportado || !textoValido) return;
    if (estaActivo) {
      setUltimoSolicitado(false);
      detenerLectura();
      return;
    }
    setUltimoSolicitado(true);
    leerTexto(texto, { id: idLectura });
  };

  const claseVariante = estaActivo
    ? 'bg-[#EEF2FF] text-[#3525CD] border-[#3525CD]/45 ring-2 ring-[#3525CD]/25 shadow-sm'
    : variante === 'primario'
      ? 'bg-[#3525CD] hover:bg-[#4F46E5] text-white border-[#3525CD] shadow-sm'
      : 'bg-white/95 hover:bg-[#F0F3FF] text-[#111C2D] border-slate-200/90 shadow-xs';

  if (compacto) {
    const labelCompacto = ariaLabel || (estaActivo ? etiquetaDetener : etiqueta);
    return (
      <button
        type="button"
        data-testid={`btn-leer-voz-${idLectura}`}
        aria-label={labelCompacto}
        title={labelCompacto}
        aria-pressed={estaActivo}
        disabled={!soportado || !textoValido}
        onClick={handleClick}
        className={`aviso-pressable w-11 h-11 min-w-[44px] min-h-[44px] rounded-full border inline-flex items-center justify-center shrink-0 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer ${claseVariante} ${className}`}
      >
        <IconoAltavozVoz activo={estaActivo} />
      </button>
    );
  }

  return (
    <div className={`inline-flex flex-col items-start gap-1.5 ${className}`}>
      <button
        type="button"
        data-testid={`btn-leer-voz-${idLectura}`}
        aria-label={ariaLabel || (estaActivo ? etiquetaDetener : etiqueta)}
        aria-pressed={estaActivo}
        disabled={!soportado || !textoValido}
        onClick={handleClick}
        className={`aviso-pressable clay-pill min-h-[48px] px-4 py-2 border text-base font-bold inline-flex items-center justify-center gap-2.5 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer ${claseVariante}`}
      >
        <IconoAltavozVoz activo={estaActivo} />
        <span>
          {!soportado
            ? 'Voz no disponible en este navegador'
            : estaActivo
              ? etiquetaDetener
              : etiqueta}
        </span>
        {estaActivo && (
          <span className="inline-flex items-end gap-0.5 h-3.5" aria-hidden="true">
            <span
              className="w-1 h-3.5 rounded-full bg-current aviso-wave-bar"
              style={{ animationDelay: '0ms' }}
            />
            <span
              className="w-1 h-3.5 rounded-full bg-current aviso-wave-bar"
              style={{ animationDelay: '150ms' }}
            />
            <span
              className="w-1 h-3.5 rounded-full bg-current aviso-wave-bar"
              style={{ animationDelay: '300ms' }}
            />
          </span>
        )}
      </button>

      {ultimoSolicitado && estadoVoz.errorMensaje && (
        <p
          role="status"
          data-testid={`error-leer-voz-${idLectura}`}
          className="text-sm text-[#92400E] bg-[#FEF3C7] border border-[#FDE68A] rounded-xl px-3 py-1.5 leading-snug max-w-sm"
        >
          {estadoVoz.errorMensaje}
        </p>
      )}
    </div>
  );
}
