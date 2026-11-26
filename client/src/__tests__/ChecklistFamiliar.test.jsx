/**
 * @file ChecklistFamiliar.test.jsx
 * @description Suite de pruebas para ChecklistFamiliar offline, persistencia localStorage y semántica.
 */

import React from 'react';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

import ChecklistFamiliar, {
  CLAVE_CHECKLIST_FAMILIAR,
  ITEMS_CHECKLIST_FAMILIAR,
  leerChecklistLocal,
  guardarChecklistLocal,
  reiniciarChecklistLocal,
  calcularProgresoChecklist,
  construirTextoLecturaChecklist,
} from '../components/ChecklistFamiliar.jsx';

const store = new Map();
const localStorageMock = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
  clear: () => store.clear(),
};

Object.defineProperty(globalThis, 'localStorage', {
  value: localStorageMock,
  writable: true,
  configurable: true,
});

describe('Checklist Familiar Preventivo Offline (ChecklistFamiliar.test.jsx)', () => {
  beforeEach(() => {
    store.clear();
  });

  afterEach(() => {
    store.clear();
  });

  it('1. Calcula el progreso (0%, parcial y 100%) y persiste en localStorage bajo "pukara_checklist_familiar"', () => {
    expect(CLAVE_CHECKLIST_FAMILIAR).toBe('pukara_checklist_familiar');
    expect(ITEMS_CHECKLIST_FAMILIAR).toHaveLength(6);

    expect(calcularProgresoChecklist(leerChecklistLocal())).toEqual({
      completados: 0,
      total: 6,
      porcentaje: 0,
      completo: false,
    });

    guardarChecklistLocal({
      'documentos-impermeables': true,
      'linterna-pilas': true,
      'canaletas-desagues': true,
    });

    const leido = leerChecklistLocal();
    expect(calcularProgresoChecklist(leido)).toEqual({
      completados: 3,
      total: 6,
      porcentaje: 50,
      completo: false,
    });

    const todos = Object.fromEntries(
      ITEMS_CHECKLIST_FAMILIAR.map((i) => [i.id, true])
    );
    guardarChecklistLocal(todos);
    expect(calcularProgresoChecklist(leerChecklistLocal())).toEqual({
      completados: 6,
      total: 6,
      porcentaje: 100,
      completo: true,
    });

    reiniciarChecklistLocal();
    expect(calcularProgresoChecklist(leerChecklistLocal())).toEqual({
      completados: 0,
      total: 6,
      porcentaje: 0,
      completo: false,
    });
  });

  it('2. Renderiza el checklist accesible con progreso persistido, controles >= 48px y sin términos prohibidos', () => {
    guardarChecklistLocal({
      'documentos-impermeables': true,
      'numeros-emergencia': true,
    });

    const html = renderToStaticMarkup(<ChecklistFamiliar />);

    expect(html).toContain('data-testid="checklist-familiar"');
    expect(html).toContain('2 de 6 completados');
    expect(html).toContain('33%');
    expect(html).toContain('role="progressbar"');
    expect(html).toContain('role="checkbox"');
    expect(html).toContain('min-h-[54px]');
    expect(html).toContain('min-h-[48px]');
    expect(html).toContain('data-testid="btn-reiniciar-checklist"');
    expect(html).toContain('Reiniciar lista');

    for (const item of ITEMS_CHECKLIST_FAMILIAR) {
      expect(html).toContain(`data-testid="checklist-item-${item.id}"`);
      expect(html).toContain(item.titulo);
    }

    const textoVoz = construirTextoLecturaChecklist(leerChecklistLocal());
    expect(textoVoz).toContain('2 de 6 puntos completados');

    const combinado = `${html} ${textoVoz}`.toLowerCase();
    const prohibidos = [
      ['alerta', 'oficial'].join(' '),
      ['orden', 'de', 'evacuación'].join(' '),
      ['evac', 'uar'].join(''),
      ['zona', 'segura'].join(' '),
      ['ruta', 'segura'].join(' '),
      ['refugio', 'verificado'].join(' '),
    ];
    for (const term of prohibidos) {
      expect(combinado).not.toContain(term);
    }
  });
});
