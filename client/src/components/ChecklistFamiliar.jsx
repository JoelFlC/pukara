import React, { useState } from 'react';
import BotonLeerVoz from './BotonLeerVoz';

export const CLAVE_CHECKLIST_FAMILIAR = 'pukara_checklist_familiar';

export const ITEMS_CHECKLIST_FAMILIAR = [
  {
    id: 'documentos-impermeables',
    titulo: 'Documentos importantes en bolsa impermeable',
    detalle: 'Cédulas de identidad, certificados y contactos clave protegidos del agua.',
  },
  {
    id: 'linterna-pilas',
    titulo: 'Linterna con pilas cargadas',
    detalle: 'Útil ante cortes de energía eléctrica durante lluvias intensas.',
  },
  {
    id: 'canaletas-desagues',
    titulo: 'Revisar canaletas y desagües de la vivienda',
    detalle: 'Retirar tierra, hojas o basura para evitar acumulaciones en techos y patios.',
  },
  {
    id: 'numeros-emergencia',
    titulo: 'Números de emergencia anotados o guardados',
    detalle: '114 GAMLP, 119 Bomberos Antofagasta, 110 Radio Patrullas y 115 Defensa Civil.',
  },
  {
    id: 'botiquin-agua',
    titulo: 'Botiquín básico y agua potable',
    detalle: 'Insumos de primeros auxilios, medicación personal y agua limpia reservada.',
  },
  {
    id: 'radio-bateria',
    titulo: 'Radio portátil o batería externa cargada',
    detalle: 'Permite escuchar comunicados oficiales y mantener el celular con carga.',
  },
];

function obtenerStorage() {
  if (typeof window !== 'undefined' && window.localStorage) {
    return window.localStorage;
  }
  if (typeof globalThis !== 'undefined' && globalThis.localStorage) {
    return globalThis.localStorage;
  }
  return null;
}

/**
 * Lee el mapa de ítems completados desde localStorage (`pukara_checklist_familiar`).
 * @returns {Record<string, boolean>}
 */
export function leerChecklistLocal() {
  const storage = obtenerStorage();
  if (!storage) {
    return {};
  }

  try {
    const raw = storage.getItem(CLAVE_CHECKLIST_FAMILIAR);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return {};
    }
    const limpio = {};
    for (const item of ITEMS_CHECKLIST_FAMILIAR) {
      if (parsed[item.id] === true) {
        limpio[item.id] = true;
      }
    }
    return limpio;
  } catch {
    return {};
  }
}

/**
 * Guarda en localStorage el estado del checklist familiar.
 * @param {Record<string, boolean>} mapa
 */
export function guardarChecklistLocal(mapa) {
  const storage = obtenerStorage();
  if (!storage) return null;

  const limpio = {};
  for (const item of ITEMS_CHECKLIST_FAMILIAR) {
    if (mapa?.[item.id] === true) {
      limpio[item.id] = true;
    }
  }

  try {
    storage.setItem(CLAVE_CHECKLIST_FAMILIAR, JSON.stringify(limpio));
    return limpio;
  } catch {
    return null;
  }
}

/**
 * Reinicia el checklist familiar en localStorage.
 */
export function reiniciarChecklistLocal() {
  const storage = obtenerStorage();
  if (storage) {
    try {
      storage.setItem(CLAVE_CHECKLIST_FAMILIAR, JSON.stringify({}));
    } catch {
      // Ignorar errores de cuota
    }
  }
  return {};
}

/**
 * Calcula conteo, porcentaje y estado completo del checklist.
 * @param {Record<string, boolean>} mapa
 */
export function calcularProgresoChecklist(mapa = {}) {
  const total = ITEMS_CHECKLIST_FAMILIAR.length;
  const completados = ITEMS_CHECKLIST_FAMILIAR.filter(
    (item) => mapa?.[item.id] === true
  ).length;
  const porcentaje = total > 0 ? Math.round((completados / total) * 100) : 0;

  return {
    completados,
    total,
    porcentaje,
    completo: total > 0 && completados === total,
  };
}

/**
 * Construye el guion hablado de la lista preventiva para Web Speech API.
 * @param {Record<string, boolean>} mapa
 */
export function construirTextoLecturaChecklist(mapa = {}) {
  const { completados, total } = calcularProgresoChecklist(mapa);
  const lista = ITEMS_CHECKLIST_FAMILIAR.map((item, idx) => {
    const estado = mapa?.[item.id] ? 'Completado' : 'Pendiente';
    return `${idx + 1}: ${item.titulo}. Estado: ${estado}.`;
  }).join(' ');

  return `Checklist familiar preventivo de PUKARA. Tienes ${completados} de ${total} puntos completados. ${lista} Esta lista se guarda en tu dispositivo y funciona sin internet.`;
}

function IconoCheck({ marcado }) {
  return (
    <span
      aria-hidden="true"
      className={`w-7 h-7 rounded-xl border-2 flex items-center justify-center shrink-0 transition-colors duration-150 ${
        marcado
          ? 'bg-[#059669] border-[#059669] text-white'
          : 'bg-white border-slate-300 text-transparent'
      }`}
    >
      <svg
        className="w-4 h-4"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <polyline points="20 6 9 17 4 12" />
      </svg>
    </span>
  );
}

/**
 * Checklist Familiar Preventivo 100% offline persistido en localStorage.
 *
 * @param {Object} [props]
 * @param {Function|null} [props.onCambioProgreso=null]
 */
export default function ChecklistFamiliar({ onCambioProgreso = null }) {
  const [marcados, setMarcados] = useState(() => leerChecklistLocal());
  const progreso = calcularProgresoChecklist(marcados);

  const handleToggleItem = (itemId) => {
    const siguiente = {
      ...marcados,
      [itemId]: !marcados[itemId],
    };
    const guardado = guardarChecklistLocal(siguiente) || siguiente;
    setMarcados(guardado);

    if (typeof onCambioProgreso === 'function') {
      const nuevoProgreso = calcularProgresoChecklist(guardado);
      onCambioProgreso({
        ...nuevoProgreso,
        accion: guardado[itemId] ? 'marcado' : 'desmarcado',
      });
    }
  };

  const handleReiniciar = () => {
    const vacio = reiniciarChecklistLocal();
    setMarcados(vacio);

    if (typeof onCambioProgreso === 'function') {
      onCambioProgreso({
        ...calcularProgresoChecklist(vacio),
        accion: 'reiniciado',
      });
    }
  };

  return (
    <div
      data-testid="checklist-familiar"
      className="space-y-4"
    >
      {/* Progreso visual */}
      <div className="clay-card-sm bg-[#F8FAFC] p-4 space-y-2.5">
        <div className="flex items-center justify-between gap-3">
          <span
            data-testid="checklist-conteo"
            className="text-base font-bold text-[#111C2D]"
          >
            {progreso.completados} de {progreso.total} completados
          </span>
          <span
            data-testid="checklist-porcentaje"
            className={`clay-pill px-3 py-1 text-sm font-extrabold tabular-nums ${
              progreso.completo
                ? 'bg-[#ECFDF5] text-[#065F46] border border-[#A7F3D0]'
                : 'bg-[#EEF2FF] text-[#3525CD] border border-[#E2DFFF]'
            }`}
          >
            {progreso.porcentaje}%
          </span>
        </div>

        <div
          role="progressbar"
          aria-label="Progreso del checklist familiar preventivo"
          aria-valuenow={progreso.porcentaje}
          aria-valuemin={0}
          aria-valuemax={100}
          className="w-full h-3 rounded-full bg-slate-200 overflow-hidden"
        >
          <div
            className={`h-full rounded-full transition-all duration-300 ${
              progreso.completo ? 'bg-[#059669]' : 'bg-[#3525CD]'
            }`}
            style={{ width: `${progreso.porcentaje}%` }}
          />
        </div>
      </div>

      {/* Lista de tareas >= 48px */}
      <ul className="space-y-2.5">
        {ITEMS_CHECKLIST_FAMILIAR.map((item) => {
          const marcado = Boolean(marcados[item.id]);
          return (
            <li key={item.id}>
              <button
                type="button"
                role="checkbox"
                aria-checked={marcado}
                data-testid={`checklist-item-${item.id}`}
                onClick={() => handleToggleItem(item.id)}
                className={`aviso-pressable min-h-[54px] w-full p-3.5 rounded-2xl border text-left flex items-start gap-3 cursor-pointer ${
                  marcado
                    ? 'bg-[#ECFDF5]/85 border-[#A7F3D0] text-[#065F46]'
                    : 'bg-white border-slate-200 text-[#111C2D] hover:bg-[#F8FAFC]'
                }`}
              >
                <IconoCheck marcado={marcado} />
                <div className="min-w-0 space-y-0.5">
                  <span
                    className={`block text-base font-bold leading-snug ${
                      marcado ? 'line-through opacity-85' : ''
                    }`}
                  >
                    {item.titulo}
                  </span>
                  <span className="block text-sm text-[#464555] leading-snug">
                    {item.detalle}
                  </span>
                </div>
              </button>
            </li>
          );
        })}
      </ul>

      {/* Acciones de voz y reinicio */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 pt-1">
        <BotonLeerVoz
          idLectura="checklist-familiar"
          texto={construirTextoLecturaChecklist(marcados)}
          etiqueta="Escuchar lista"
          etiquetaDetener="Detener voz"
          ocultarSiNoSoporta={false}
        />

        <button
          type="button"
          data-testid="btn-reiniciar-checklist"
          onClick={handleReiniciar}
          className="aviso-pressable min-h-[48px] px-4 py-2 rounded-full border border-slate-200 bg-white hover:bg-[#F0F3FF] text-base font-bold text-[#464555] cursor-pointer"
        >
          Reiniciar lista
        </button>
      </div>
    </div>
  );
}
