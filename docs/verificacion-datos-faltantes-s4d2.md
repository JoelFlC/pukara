# PUKARA — Verificación de Datos Faltantes (`P02`), Fallos de API (`P03`/`T5`) y Aislamiento de Simulación (`P11`) [`S4D2`]

## 1. Objetivo de la Verificación (`S4D2`)

Este documento registra la evidencia técnica y los resultados de las pruebas de integración ejecutadas en el **Día 2 de la Semana 4 (`S4D2`)** bajo el régimen de congelamiento de funcionalidades (*Feature Freeze*). El propósito es certificar contra PostgreSQL real (`pukara_db`) y la API Express que el motor de evaluación y la capa de orquestación cumplen de forma determinista con:

1. **Prueba `P02` (Manejo de series horarias incompletas y valores nulos):** Prohibición absoluta de asumir `0 mm` ante datos faltantes. Las ventanas retrospectivas con menos de 24 o 72 horas válidas se catalogan como `null`, marcando la lectura como `'incompleta'` (clasificación parcial con las variables completas disponibles) o `'invalida'` (si ninguna variable está completa, sin alterar el estado vigente).
2. **Prueba `P03` y Regla de Transición `T5` (Resiliencia ante fallos del proveedor externo Open-Meteo):** Un fallo de red, timeout, error HTTP `5xx` o cuerpo JSON malformado nunca constituye una muestra meteorológica válida, no inserta registros inválidos en base de datos y preserva intactos el `nivel_vigente` y el `contador_descenso` durante una ventana de histéresis activa.
3. **Prueba `P11` (Aislamiento estricto entre Modo Simulación y Estado Real):** Las lecturas y evaluaciones con `modalidad = 'simulada'` jamás leen, alteran ni reinician el `nivel_vigente` ni el `contador_descenso` del flujo `modalidad = 'real'`.

> **Aviso Permanente Institucional:**  
> *"Los niveles Normal, Precaución, Alerta y Emergencia son niveles informativos de lluvia: niveles meteorológicos simulados, calculados con umbrales académicos. No sustituyen alertas ni instrucciones de las autoridades oficiales. PUKARA muestra información bajo consulta y no avisa activamente a la población. Ante una emergencia, atienda las indicaciones oficiales y contacte a los servicios de emergencia."*

---

## 2. Matriz Detallada de Casos Probados (`P02`, `P03`/`T5` y `P11`)

### 2.1. Certificación de `P02` — Series Horarias Incompletas y Valores Nulos

| Caso | Prueba | Estado Inicial | Datos de Entrada | Resultado Esperado | Resultado Obtenido | Estado |
| :--- | :---: | :--- | :--- | :--- | :--- | :---: |
| **Caso 1A** (Ventana 72h incompleta, 24h e intensidad completas) | `P02` | `SIN_DATOS` (`cnt = 0`) | `intensidad_mm_h = 3.0` (`PRECAUCION`), 24h completas con `1.2 mm/h` (`acum_24h_mm = 28.8` -> `ALERTA`), 10 valores `null` entre horas 25 y 72 (`horas_validas_72h = 62 < 72`). | Persistir lectura con `estado = 'incompleta'` y `acum_72h_mm = null`. Clasificar solo con intensidad y 24h (`nivel_vigente = 'ALERTA'`, `clasificacion_parcial = true`). | `lectura.estado = 'incompleta'`, `acum_72h_mm = null`, `acum_24h_mm = 28.8`, `nivel_vigente = 'ALERTA'`, `clasificacion_parcial = true`. | `[PASS]` |
| **Caso 1B** (Ventanas 24h y 72h incompletas, solo intensidad válida) | `P02` | `ALERTA` (`cnt = 0`) | Huecos `null` en las primeras 24 horas (`horas_validas_24h < 24`, `horas_validas_72h < 72`), `intensidad_mm_h` válida (`7.2 mm/h` en suite HTTP / `2.8 mm/h` en script). | Persistir `estado = 'incompleta'`, `acum_24h_mm = null` y `acum_72h_mm = null`. Clasificar exclusivamente con `intensidad_mm_h` y exponer `clasificacion_parcial = true` en `GET /api/estado`. | `lectura.estado = 'incompleta'`, `acum_24h_mm = null`, `acum_72h_mm = null`, `banderas_calidad.clasificacion_parcial = true`. | `[PASS]` |
| **Caso 1C** (Muestra totalmente inválida — ninguna variable completa) | `P02` | `ALERTA` (`cnt = 1`) | `actual.precipitacion_mm = null` y huecos `null` tanto en ventana 24h como en 72h (`0` variables completas). | Persistir lectura con `estado = 'invalida'`, no crear fila en `evaluaciones_nivel` y conservar intactos `nivel_vigente = 'ALERTA'` y `contador_descenso = 1`. | `lectura.estado = 'invalida'`, `0` evaluaciones nuevas insertadas, `nivel_vigente = 'ALERTA'`, `contador_descenso = 1`. | `[PASS]` |

---

### 2.2. Certificación de `P03` y Transición `T5` — Fallos de Open-Meteo en Medio de Histéresis

| Paso / Escenario | Prueba / Regla | Estado Inicial | Perturbación / Datos de Entrada | Resultado Esperado | Resultado Obtenido | Estado |
| :--- | :---: | :--- | :--- | :--- | :--- | :---: |
| **Preparación Histéresis** | `T1` -> `T3` | `SIN_DATOS` | Muestra 1 (`t = -50m`): `7.5 mm/h` (`ALERTA`). Muestra 2 (`t = -30m`): `3.0 mm/h` (`PRECAUCION`). | Sistema queda en `nivel_vigente = 'ALERTA'` con `contador_descenso = 1`. | `nivel_vigente = 'ALERTA'`, `contador_descenso = 1` (2 filas en `evaluaciones_nivel`). | `[PASS]` |
| **Fallo (a): Timeout de red** | `P03` / `T5` | `ALERTA` (`cnt = 1`) | Caché expirado + `AbortError` / `ETIMEDOUT` (`OpenMeteoError: TIMEOUT`). | `GET /api/estado` responde `200 OK` con última lectura válida (`respaldo_bd_por_fallo_api`), `0` filas nuevas en BD, `nivel_vigente = 'ALERTA'` y `contador_descenso = 1`. | `HTTP 200`, `fallo_api_reciente = true`, `nivel_vigente = 'ALERTA'`, `contador_descenso = 1`, `antiguedad_minutos >= 29`. | `[PASS]` |
| **Fallo (b): Error HTTP 503** | `P03` / `T5` | `ALERTA` (`cnt = 1`) | Caché expirado + respuesta `HTTP 503 Service Unavailable` de Open-Meteo. | `GET /api/estado` responde `200 OK` desde respaldo BD, `0` filas nuevas en BD, `nivel_vigente = 'ALERTA'` y `contador_descenso = 1`. | `HTTP 200`, `fallo_api_reciente = true`, `nivel_vigente = 'ALERTA'`, `contador_descenso = 1`. | `[PASS]` |
| **Fallo (c): JSON malformado sin `hourly`** | `P03` / `T5` | `ALERTA` (`cnt = 1`) | Caché expirado + JSON de Open-Meteo sin bloque `hourly` (`RESPUESTA_CORRUPTA`). | Rechazo en `validarYNormalizarRespuesta`, `GET /api/estado` sirve respaldo BD (`200 OK`), `0` filas nuevas en BD, `nivel_vigente = 'ALERTA'` y `contador_descenso = 1`. | `HTTP 200`, `fallo_api_reciente = true`, `nivel_vigente = 'ALERTA'`, `contador_descenso = 1`. | `[PASS]` |
| **Recuperación y 2da Muestra Independiente** | `P03` / `T3` | `ALERTA` (`cnt = 1`) | Restauración de Open-Meteo con 2da muestra válida independiente en `PRECAUCION` (`t = -10m`, `2.8 mm/h`). | Recién con la segunda muestra válida independiente consolida `T3_DESCENSO_COMPLETADO` hacia `PRECAUCION` y reinicia `contador_descenso = 0`. | `HTTP 200`, `fallo_api_reciente = false`, `nivel_vigente = 'PRECAUCION'`, `contador_descenso = 0`. | `[PASS]` |

---

### 2.3. Certificación de `P11` — Aislamiento Total entre Modo Simulación y Estado Real

| Paso / Escenario | Prueba | Estado Inicial Real | Datos de Entrada en Simulación | Resultado Esperado | Resultado Obtenido | Estado |
| :--- | :---: | :--- | :--- | :--- | :--- | :---: |
| **Secuencia Simulada de 4 Niveles** | `P11` | `nivel_vigente = 'ALERTA'`, `contador_descenso = 1` | Inyección secuencial vía `POST /api/simulacion/lectura` de los 4 niveles: `NORMAL` -> `PRECAUCION` -> `ALERTA` -> `EMERGENCIA`. | `GET /api/estado?modalidad=simulada` refleja cada nivel simulado con `modalidad = 'simulada'`. Simultáneamente, `GET /api/estado` real conserva intactos `nivel_vigente = 'ALERTA'` y `contador_descenso = 1`. | Simulación transita por `NORMAL`, `PRECAUCION`, `ALERTA`, `EMERGENCIA`; flujo real permanece inalterado en `ALERTA` (`contador_descenso = 1`). | `[PASS]` |
| **Limpieza de Simulación** | `P11` | `nivel_vigente = 'ALERTA'`, `contador_descenso = 1` | `DELETE /api/simulacion` | Elimina exclusivamente las 4 lecturas y evaluaciones con `modalidad = 'simulada'`, preservando intactas las evaluaciones reales. | `lecturas_eliminadas = 4`, estado real intacto en `ALERTA` (`contador_descenso = 1`). | `[PASS]` |

---

## 3. Instrucciones de Reproducción

### 3.1. Ejecutar la suite automatizada de integración `S4D2` (Vitest + Supertest)
Desde la raíz del repositorio (con el contenedor Docker `pukara-postgres` activo):

```bash
npx --prefix server vitest run tests/integracion/resilienciaFallos.s4d2.test.js
```

O ejecutando la totalidad de las 22 suites del servidor:

```bash
npm test --prefix server
```

### 3.2. Ejecutar el script reproducible de auditoría en consola (`verify:resiliencia`)

```bash
npm run verify:resiliencia --prefix server
```

El script ejecuta secuencialmente los 8 controles (`S4D2-01` a `S4D2-08`), imprime la tabla de trazabilidad con estado `[PASS]` y restaura la base de datos a su estado limpio inicial.

