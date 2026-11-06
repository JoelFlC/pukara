/**
 * @file estado.p13.p14.test.js
 * @description Suite de pruebas automatizadas para la máquina de estados con histéresis
 * y reglas de transición puras de PUKARA, certificando las reglas canónicas P13
 * (ascenso inmediato y saltos multinivel) y P14 (descenso escalonado con contador de histéresis).
 */

import { describe, it, expect } from 'vitest';
import {
  ESTADOS_SISTEMA,
  REGLAS_TRANSICION,
  normalizarParametrosMotor,
  esMuestraIndependiente,
  crearEstadoInicialMotor,
  siguienteEstado,
  ejecutarSecuenciaMuestras,
  evaluarVencimiento,
} from '../src/engine/estado.js';

describe('Máquina de Estados e Histéresis PUKARA: Reglas P13, P14 y Transiciones (estado.js)', () => {
  // ==========================================================================
  // BLOQUE 1: Independencia Temporal de Muestras (esMuestraIndependiente)
  // ==========================================================================
  describe('Bloque 1: Independencia Temporal de Muestras (esMuestraIndependiente)', () => {
    it('1.1. Primera muestra sin observadoEnAnterior (null) es independiente con motivo PRIMERA_MUESTRA', () => {
      const res = esMuestraIndependiente('2026-02-15T14:00:00.000Z', null, 15);
      expect(res.independiente).toBe(true);
      expect(res.motivo).toBe('PRIMERA_MUESTRA');
      expect(res.diferencia_minutos).toBeNull();
    });

    it('1.2. Muestra con exactamente el mismo observado_en es rechazada con motivo MARCA_NO_POSTERIOR', () => {
      const marca = '2026-02-15T14:00:00.000Z';
      const res = esMuestraIndependiente(marca, marca, 15);
      expect(res.independiente).toBe(false);
      expect(res.motivo).toBe('MARCA_NO_POSTERIOR');
      expect(res.diferencia_minutos).toBe(0);
    });

    it('1.3. Muestra con observado_en anterior en el tiempo es rechazada con motivo MARCA_NO_POSTERIOR', () => {
      const res = esMuestraIndependiente(
        '2026-02-15T13:50:00.000Z',
        '2026-02-15T14:00:00.000Z',
        15
      );
      expect(res.independiente).toBe(false);
      expect(res.motivo).toBe('MARCA_NO_POSTERIOR');
      expect(res.diferencia_minutos).toBe(-10);
    });

    it('1.4. Muestra posterior pero con separación menor a 15 minutos es rechazada con motivo SEPARACION_INSUFICIENTE', () => {
      const res = esMuestraIndependiente(
        '2026-02-15T14:10:00.000Z',
        '2026-02-15T14:00:00.000Z',
        15
      );
      expect(res.independiente).toBe(false);
      expect(res.motivo).toBe('SEPARACION_INSUFICIENTE');
      expect(res.diferencia_minutos).toBe(10);
    });

    it('1.5. Muestras separadas exactamente 15 y 60 minutos son independientes con motivo INDEPENDIENTE_VALIDA', () => {
      // Exactamente 15 minutos
      const res15 = esMuestraIndependiente(
        '2026-02-15T14:15:00.000Z',
        '2026-02-15T14:00:00.000Z',
        15
      );
      expect(res15.independiente).toBe(true);
      expect(res15.motivo).toBe('INDEPENDIENTE_VALIDA');
      expect(res15.diferencia_minutos).toBe(15);

      // 60 minutos
      const res60 = esMuestraIndependiente(
        '2026-02-15T15:00:00.000Z',
        '2026-02-15T14:00:00.000Z',
        15
      );
      expect(res60.independiente).toBe(true);
      expect(res60.motivo).toBe('INDEPENDIENTE_VALIDA');
      expect(res60.diferencia_minutos).toBe(60);
    });

    it('1.6. Rechaza marcas temporales nuevas nulas, vacías o inválidas', () => {
      expect(esMuestraIndependiente(null, '2026-02-15T14:00:00.000Z').independiente).toBe(false);
      expect(esMuestraIndependiente('', '2026-02-15T14:00:00.000Z').independiente).toBe(false);
      expect(esMuestraIndependiente('no-es-fecha', '2026-02-15T14:00:00.000Z').independiente).toBe(false);
    });
  });

  // ==========================================================================
  // BLOQUE 2: P13 — Ascenso Inmediato y Saltos de Varios Niveles (T7 y T1)
  // ==========================================================================
  describe('Bloque 2: Regla P13 — Ascenso Inmediato y Saltos Multinivel (T7 y T1)', () => {
    it('2.1. Recuperación inicial (T7): Desde SIN_DATOS fija directamente el nivel sin histéresis', () => {
      const estadoInicial = crearEstadoInicialMotor();
      expect(estadoInicial.estado_sistema).toBe(ESTADOS_SISTEMA.SIN_DATOS);
      expect(estadoInicial.nivel_vigente).toBeNull();

      const muestra = {
        nivel_calculado: ESTADOS_SISTEMA.NORMAL,
        observado_en: '2026-02-15T10:00:00.000Z',
      };

      const res = siguienteEstado(estadoInicial, muestra);
      expect(res.nivel_vigente).toBe(ESTADOS_SISTEMA.NORMAL);
      expect(res.estado_sistema).toBe(ESTADOS_SISTEMA.NORMAL);
      expect(res.contador_descenso).toBe(0);
      expect(res.ultimo_observado_en).toBe('2026-02-15T10:00:00.000Z');
      expect(res.transicion).toBe(REGLAS_TRANSICION.T7_RECUPERACION);
      expect(res.evaluacion_creada).toBe(true);
    });

    it('2.2. Caso oficial P13: Salto directo de NORMAL a EMERGENCIA en una sola muestra', () => {
      const estadoBase = {
        estado_sistema: ESTADOS_SISTEMA.NORMAL,
        nivel_vigente: ESTADOS_SISTEMA.NORMAL,
        ultimo_nivel_calculado: ESTADOS_SISTEMA.NORMAL,
        contador_descenso: 0,
        candidato_descenso_maximo: null,
        ultimo_observado_en: '2026-02-15T10:00:00.000Z',
      };

      const muestraEmergencia = {
        nivel_calculado: ESTADOS_SISTEMA.EMERGENCIA,
        observado_en: '2026-02-15T11:00:00.000Z', // 60 min después (> 15 min)
      };

      const res = siguienteEstado(estadoBase, muestraEmergencia);
      expect(res.nivel_vigente).toBe(ESTADOS_SISTEMA.EMERGENCIA);
      expect(res.estado_sistema).toBe(ESTADOS_SISTEMA.EMERGENCIA);
      expect(res.contador_descenso).toBe(0);
      expect(res.candidato_descenso_maximo).toBeNull();
      expect(res.transicion).toBe(REGLAS_TRANSICION.T1_ASCENSO);
      expect(res.evaluacion_creada).toBe(true);
    });

    it('2.3. Ascenso desde un estado con descenso en curso (contador_descenso = 1) reinicia el contador a 0', () => {
      const estadoConDescensoEnCurso = {
        estado_sistema: ESTADOS_SISTEMA.ALERTA,
        nivel_vigente: ESTADOS_SISTEMA.ALERTA,
        ultimo_nivel_calculado: ESTADOS_SISTEMA.PRECAUCION,
        contador_descenso: 1,
        candidato_descenso_maximo: ESTADOS_SISTEMA.PRECAUCION,
        ultimo_observado_en: '2026-02-15T10:30:00.000Z',
      };

      const muestraEmergencia = {
        nivel_calculado: ESTADOS_SISTEMA.EMERGENCIA,
        observado_en: '2026-02-15T11:00:00.000Z',
      };

      const res = siguienteEstado(estadoConDescensoEnCurso, muestraEmergencia);
      expect(res.nivel_vigente).toBe(ESTADOS_SISTEMA.EMERGENCIA);
      expect(res.estado_sistema).toBe(ESTADOS_SISTEMA.EMERGENCIA);
      expect(res.contador_descenso).toBe(0);
      expect(res.candidato_descenso_maximo).toBeNull();
      expect(res.transicion).toBe(REGLAS_TRANSICION.T1_ASCENSO);
      expect(res.evaluacion_creada).toBe(true);
    });

    it('2.4. Recuperación tras DATOS_DESACTUALIZADOS (T7): Fija directamente el nivel calculado sin histéresis', () => {
      const estadoDesactualizado = {
        estado_sistema: ESTADOS_SISTEMA.DATOS_DESACTUALIZADOS,
        nivel_vigente: ESTADOS_SISTEMA.EMERGENCIA,
        ultimo_nivel_calculado: ESTADOS_SISTEMA.EMERGENCIA,
        contador_descenso: 0,
        candidato_descenso_maximo: null,
        ultimo_observado_en: '2026-02-15T08:00:00.000Z', // 4 horas antes
      };

      const muestraNormal = {
        nivel_calculado: ESTADOS_SISTEMA.NORMAL,
        observado_en: '2026-02-15T12:00:00.000Z',
      };

      const res = siguienteEstado(estadoDesactualizado, muestraNormal);
      expect(res.nivel_vigente).toBe(ESTADOS_SISTEMA.NORMAL);
      expect(res.estado_sistema).toBe(ESTADOS_SISTEMA.NORMAL);
      expect(res.contador_descenso).toBe(0);
      expect(res.transicion).toBe(REGLAS_TRANSICION.T7_RECUPERACION);
      expect(res.evaluacion_creada).toBe(true);
    });
  });

  // ==========================================================================
  // BLOQUE 3: P14 — Descenso Gradual con Contador (T3) y Reinicio (T2 / T4)
  // ==========================================================================
  describe('Bloque 3: Regla P14 — Descenso con Histéresis (T3) y Reinicio de Contador (T2/T4)', () => {
    it('3.1. Caso oficial P14: ALERTA -> PRECAUCION y NORMAL baja a PRECAUCION (el mayor, nunca directo a NORMAL)', () => {
      const e0 = {
        estado_sistema: ESTADOS_SISTEMA.ALERTA,
        nivel_vigente: ESTADOS_SISTEMA.ALERTA,
        ultimo_nivel_calculado: ESTADOS_SISTEMA.ALERTA,
        contador_descenso: 0,
        candidato_descenso_maximo: null,
        ultimo_observado_en: '2026-02-15T10:00:00.000Z',
      };

      // Muestra 1 inferior: PRECAUCION
      const m1 = {
        nivel_calculado: ESTADOS_SISTEMA.PRECAUCION,
        observado_en: '2026-02-15T11:00:00.000Z',
      };
      const e1 = siguienteEstado(e0, m1);
      expect(e1.nivel_vigente).toBe(ESTADOS_SISTEMA.ALERTA); // Mantiene ALERTA
      expect(e1.estado_sistema).toBe(ESTADOS_SISTEMA.ALERTA);
      expect(e1.contador_descenso).toBe(1);
      expect(e1.candidato_descenso_maximo).toBe(ESTADOS_SISTEMA.PRECAUCION);
      expect(e1.transicion).toBe(REGLAS_TRANSICION.T3_DESCENSO_PENDIENTE);
      expect(e1.evaluacion_creada).toBe(true);

      // Muestra 2 inferior consecutiva: NORMAL
      const m2 = {
        nivel_calculado: ESTADOS_SISTEMA.NORMAL,
        observado_en: '2026-02-15T12:00:00.000Z',
      };
      const e2 = siguienteEstado(e1, m2);
      // Debe descender a PRECAUCION (el mayor de los 2 inferiores en la ventana)
      expect(e2.nivel_vigente).toBe(ESTADOS_SISTEMA.PRECAUCION);
      expect(e2.estado_sistema).toBe(ESTADOS_SISTEMA.PRECAUCION);
      expect(e2.contador_descenso).toBe(0);
      expect(e2.candidato_descenso_maximo).toBeNull();
      expect(e2.ultimo_nivel_calculado).toBe(ESTADOS_SISTEMA.NORMAL);
      expect(e2.transicion).toBe(REGLAS_TRANSICION.T3_DESCENSO_COMPLETADO);
      expect(e2.evaluacion_creada).toBe(true);
    });

    it('3.2. Orden inverso: ALERTA -> NORMAL seguido de PRECAUCION desciende a PRECAUCION', () => {
      const e0 = {
        estado_sistema: ESTADOS_SISTEMA.ALERTA,
        nivel_vigente: ESTADOS_SISTEMA.ALERTA,
        ultimo_nivel_calculado: ESTADOS_SISTEMA.ALERTA,
        contador_descenso: 0,
        candidato_descenso_maximo: null,
        ultimo_observado_en: '2026-02-15T10:00:00.000Z',
      };

      // Muestra 1: NORMAL
      const e1 = siguienteEstado(e0, {
        nivel_calculado: ESTADOS_SISTEMA.NORMAL,
        observado_en: '2026-02-15T11:00:00.000Z',
      });
      expect(e1.nivel_vigente).toBe(ESTADOS_SISTEMA.ALERTA);
      expect(e1.contador_descenso).toBe(1);
      expect(e1.candidato_descenso_maximo).toBe(ESTADOS_SISTEMA.NORMAL);
      expect(e1.transicion).toBe(REGLAS_TRANSICION.T3_DESCENSO_PENDIENTE);

      // Muestra 2: PRECAUCION
      const e2 = siguienteEstado(e1, {
        nivel_calculado: ESTADOS_SISTEMA.PRECAUCION,
        observado_en: '2026-02-15T12:00:00.000Z',
      });
      // El mayor entre NORMAL y PRECAUCION es PRECAUCION
      expect(e2.nivel_vigente).toBe(ESTADOS_SISTEMA.PRECAUCION);
      expect(e2.contador_descenso).toBe(0);
      expect(e2.transicion).toBe(REGLAS_TRANSICION.T3_DESCENSO_COMPLETADO);
    });

    it('3.3. Descenso a NORMAL cuando ambas muestras consecutivas son NORMAL desde PRECAUCION', () => {
      const e0 = {
        estado_sistema: ESTADOS_SISTEMA.PRECAUCION,
        nivel_vigente: ESTADOS_SISTEMA.PRECAUCION,
        ultimo_nivel_calculado: ESTADOS_SISTEMA.PRECAUCION,
        contador_descenso: 0,
        candidato_descenso_maximo: null,
        ultimo_observado_en: '2026-02-15T10:00:00.000Z',
      };

      const e1 = siguienteEstado(e0, {
        nivel_calculado: ESTADOS_SISTEMA.NORMAL,
        observado_en: '2026-02-15T11:00:00.000Z',
      });
      expect(e1.nivel_vigente).toBe(ESTADOS_SISTEMA.PRECAUCION);
      expect(e1.contador_descenso).toBe(1);

      const e2 = siguienteEstado(e1, {
        nivel_calculado: ESTADOS_SISTEMA.NORMAL,
        observado_en: '2026-02-15T12:00:00.000Z',
      });
      expect(e2.nivel_vigente).toBe(ESTADOS_SISTEMA.NORMAL);
      expect(e2.estado_sistema).toBe(ESTADOS_SISTEMA.NORMAL);
      expect(e2.contador_descenso).toBe(0);
      expect(e2.transicion).toBe(REGLAS_TRANSICION.T3_DESCENSO_COMPLETADO);
    });

    it('3.4. Reinicio del contador (T4) antes de completar el descenso: una muestra igual al vigente anula el descenso previo', () => {
      const e0 = {
        estado_sistema: ESTADOS_SISTEMA.ALERTA,
        nivel_vigente: ESTADOS_SISTEMA.ALERTA,
        ultimo_nivel_calculado: ESTADOS_SISTEMA.ALERTA,
        contador_descenso: 0,
        candidato_descenso_maximo: null,
        ultimo_observado_en: '2026-02-15T10:00:00.000Z',
      };

      // Muestra 1: PRECAUCION -> contador = 1
      const e1 = siguienteEstado(e0, {
        nivel_calculado: ESTADOS_SISTEMA.PRECAUCION,
        observado_en: '2026-02-15T11:00:00.000Z',
      });
      expect(e1.contador_descenso).toBe(1);
      expect(e1.transicion).toBe(REGLAS_TRANSICION.T3_DESCENSO_PENDIENTE);

      // Muestra 2: ALERTA (igual al vigente) -> T4 reinicia contador a 0
      const e2 = siguienteEstado(e1, {
        nivel_calculado: ESTADOS_SISTEMA.ALERTA,
        observado_en: '2026-02-15T12:00:00.000Z',
      });
      expect(e2.nivel_vigente).toBe(ESTADOS_SISTEMA.ALERTA);
      expect(e2.contador_descenso).toBe(0);
      expect(e2.candidato_descenso_maximo).toBeNull();
      expect(e2.transicion).toBe(REGLAS_TRANSICION.T4_REINICIO_CONTADOR);

      // Muestra 3: NORMAL -> empieza un nuevo ciclo de descenso (contador = 1, mantiene ALERTA)
      const e3 = siguienteEstado(e2, {
        nivel_calculado: ESTADOS_SISTEMA.NORMAL,
        observado_en: '2026-02-15T13:00:00.000Z',
      });
      expect(e3.nivel_vigente).toBe(ESTADOS_SISTEMA.ALERTA);
      expect(e3.contador_descenso).toBe(1);
      expect(e3.transicion).toBe(REGLAS_TRANSICION.T3_DESCENSO_PENDIENTE);
    });

    it('3.5. Transición T2_IGUAL_NIVEL cuando el contador de descenso ya era 0', () => {
      const e0 = {
        estado_sistema: ESTADOS_SISTEMA.PRECAUCION,
        nivel_vigente: ESTADOS_SISTEMA.PRECAUCION,
        ultimo_nivel_calculado: ESTADOS_SISTEMA.PRECAUCION,
        contador_descenso: 0,
        candidato_descenso_maximo: null,
        ultimo_observado_en: '2026-02-15T10:00:00.000Z',
      };

      const e1 = siguienteEstado(e0, {
        nivel_calculado: ESTADOS_SISTEMA.PRECAUCION,
        observado_en: '2026-02-15T10:30:00.000Z',
      });
      expect(e1.nivel_vigente).toBe(ESTADOS_SISTEMA.PRECAUCION);
      expect(e1.contador_descenso).toBe(0);
      expect(e1.transicion).toBe(REGLAS_TRANSICION.T2_IGUAL_NIVEL);
    });
  });

  // ==========================================================================
  // BLOQUE 4: Fallos de API (T5), Muestras Inválidas y Duplicados de Caché
  // ==========================================================================
  describe('Bloque 4: Fallos de API (T5), Muestras Inválidas y Duplicados de Caché', () => {
    it('4.1. Fallo de API (fallo_api: true o muestra_valida: false) con contador = 1 preserva el estado intacto', () => {
      const estadoConDescensoEnCurso = {
        estado_sistema: ESTADOS_SISTEMA.ALERTA,
        nivel_vigente: ESTADOS_SISTEMA.ALERTA,
        ultimo_nivel_calculado: ESTADOS_SISTEMA.PRECAUCION,
        contador_descenso: 1,
        candidato_descenso_maximo: ESTADOS_SISTEMA.PRECAUCION,
        ultimo_observado_en: '2026-02-15T10:00:00.000Z',
      };

      // Fallo de API explícito
      const resFallo = siguienteEstado(estadoConDescensoEnCurso, { fallo_api: true });
      expect(resFallo.nivel_vigente).toBe(ESTADOS_SISTEMA.ALERTA);
      expect(resFallo.contador_descenso).toBe(1);
      expect(resFallo.candidato_descenso_maximo).toBe(ESTADOS_SISTEMA.PRECAUCION);
      expect(resFallo.ultimo_observado_en).toBe('2026-02-15T10:00:00.000Z');
      expect(resFallo.transicion).toBe(REGLAS_TRANSICION.T5_SIN_MUESTRA_VALIDA);
      expect(resFallo.evaluacion_creada).toBe(false);

      // Muestra catalogada inválida
      const resInvalida = siguienteEstado(estadoConDescensoEnCurso, {
        muestra_valida: false,
        motivo_invalidez: 'DATOS_CORRUPTOS',
      });
      expect(resInvalida.nivel_vigente).toBe(ESTADOS_SISTEMA.ALERTA);
      expect(resInvalida.contador_descenso).toBe(1);
      expect(resInvalida.transicion).toBe(REGLAS_TRANSICION.T5_SIN_MUESTRA_VALIDA);
      expect(resInvalida.evaluacion_creada).toBe(false);
    });

    it('4.2. Respuesta repetida de caché (mismo observado_en o menor a 15 min) es ignorada y no altera el descenso', () => {
      const estadoConDescensoEnCurso = {
        estado_sistema: ESTADOS_SISTEMA.ALERTA,
        nivel_vigente: ESTADOS_SISTEMA.ALERTA,
        ultimo_nivel_calculado: ESTADOS_SISTEMA.PRECAUCION,
        contador_descenso: 1,
        candidato_descenso_maximo: ESTADOS_SISTEMA.PRECAUCION,
        ultimo_observado_en: '2026-02-15T10:00:00.000Z',
      };

      // Mismo observado_en (0 min de diferencia)
      const resMismo = siguienteEstado(estadoConDescensoEnCurso, {
        nivel_calculado: ESTADOS_SISTEMA.NORMAL,
        observado_en: '2026-02-15T10:00:00.000Z',
      });
      expect(resMismo.transicion).toBe(REGLAS_TRANSICION.IGNORADA_NO_INDEPENDIENTE);
      expect(resMismo.evaluacion_creada).toBe(false);
      expect(resMismo.contador_descenso).toBe(1);
      expect(resMismo.nivel_vigente).toBe(ESTADOS_SISTEMA.ALERTA);

      // 5 minutos después (insuficiente para ventana mínima de 15 min)
      const res5Min = siguienteEstado(estadoConDescensoEnCurso, {
        nivel_calculado: ESTADOS_SISTEMA.NORMAL,
        observado_en: '2026-02-15T10:05:00.000Z',
      });
      expect(res5Min.transicion).toBe(REGLAS_TRANSICION.IGNORADA_NO_INDEPENDIENTE);
      expect(res5Min.evaluacion_creada).toBe(false);
      expect(res5Min.contador_descenso).toBe(1);
      expect(res5Min.nivel_vigente).toBe(ESTADOS_SISTEMA.ALERTA);
    });

    it('4.3. ejecutarSecuenciaMuestras evalúa correctamente una serie temporal heterogénea', () => {
      const serie = [
        { nivel_calculado: ESTADOS_SISTEMA.NORMAL, observado_en: '2026-02-15T10:00:00.000Z' },
        { nivel_calculado: ESTADOS_SISTEMA.ALERTA, observado_en: '2026-02-15T10:20:00.000Z' }, // T1 Ascenso
        { nivel_calculado: ESTADOS_SISTEMA.PRECAUCION, observado_en: '2026-02-15T10:40:00.000Z' }, // T3 Pendiente
        { fallo_api: true }, // T5 Ignorado
        { nivel_calculado: ESTADOS_SISTEMA.NORMAL, observado_en: '2026-02-15T11:00:00.000Z' }, // T3 Descenso a PRECAUCION
      ];

      const { estadoFinal, historialPasos } = ejecutarSecuenciaMuestras(serie);

      expect(historialPasos).toHaveLength(5);
      expect(historialPasos[0].transicion).toBe(REGLAS_TRANSICION.T7_RECUPERACION);
      expect(historialPasos[1].transicion).toBe(REGLAS_TRANSICION.T1_ASCENSO);
      expect(historialPasos[2].transicion).toBe(REGLAS_TRANSICION.T3_DESCENSO_PENDIENTE);
      expect(historialPasos[3].transicion).toBe(REGLAS_TRANSICION.T5_SIN_MUESTRA_VALIDA);
      expect(historialPasos[4].transicion).toBe(REGLAS_TRANSICION.T3_DESCENSO_COMPLETADO);

      expect(estadoFinal.nivel_vigente).toBe(ESTADOS_SISTEMA.PRECAUCION);
      expect(estadoFinal.contador_descenso).toBe(0);
    });

    it('4.4. evaluarVencimiento produce transición T6_VENCIMIENTO cuando la lectura supera t_max_minutos', () => {
      const estadoVigente = {
        estado_sistema: ESTADOS_SISTEMA.PRECAUCION,
        nivel_vigente: ESTADOS_SISTEMA.PRECAUCION,
        ultimo_nivel_calculado: ESTADOS_SISTEMA.PRECAUCION,
        contador_descenso: 0,
        candidato_descenso_maximo: null,
        ultimo_observado_en: '2026-02-15T10:00:00.000Z',
      };

      // 45 minutos después (t_max = 60 min -> no vencido)
      const res45 = evaluarVencimiento(
        estadoVigente,
        '2026-02-15T10:45:00.000Z',
        { t_max_minutos: 60 }
      );
      expect(res45.vencido).toBe(false);
      expect(res45.estado.estado_sistema).toBe(ESTADOS_SISTEMA.PRECAUCION);

      // 65 minutos después (t_max = 60 min -> vencido)
      const res65 = evaluarVencimiento(
        estadoVigente,
        '2026-02-15T11:05:00.000Z',
        { t_max_minutos: 60 }
      );
      expect(res65.vencido).toBe(true);
      expect(res65.estado.estado_sistema).toBe(ESTADOS_SISTEMA.DATOS_DESACTUALIZADOS);
      expect(res65.estado.transicion).toBe(REGLAS_TRANSICION.T6_VENCIMIENTO);
      expect(res65.estado.evaluacion_creada).toBe(false);
      // Mantiene nivel_vigente intacto (no degrada a NORMAL)
      expect(res65.estado.nivel_vigente).toBe(ESTADOS_SISTEMA.PRECAUCION);
    });

    it('4.5. normalizarParametrosMotor aplica defaults robustos y sanitiza parámetros', () => {
      expect(normalizarParametrosMotor(null)).toEqual({
        t_max_minutos: 60,
        separacion_minima_minutos: 15,
        muestras_descenso: 2,
      });

      expect(
        normalizarParametrosMotor({
          t_max_minutos: '120',
          separacion_minima_minutos: '30',
          muestras_descenso: '3',
        })
      ).toEqual({
        t_max_minutos: 120,
        separacion_minima_minutos: 30,
        muestras_descenso: 3,
      });

      // Valores negativos o inválidos recurren a defaults
      expect(
        normalizarParametrosMotor({
          t_max_minutos: -10,
          separacion_minima_minutos: 0,
          muestras_descenso: 1, // Mínimo 2
        })
      ).toEqual({
        t_max_minutos: 60,
        separacion_minima_minutos: 15,
        muestras_descenso: 2,
      });
    });
  });
});
