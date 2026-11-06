# PUKARA — Informe de Cierre de Semana 2: Puerta de Calidad, Matriz de Verificación y Certificación del Motor

**Semana:** 2 — Día 7 (Fase B)  
**Sistema:** PUKARA (Sector Llojeta, La Paz)  
**Estado:** Puerta de Calidad Superada al 100% — Transición Certificada a Semana 3  
**Evidencia Académica:** Sección 11.5 del Informe Técnico del Proyecto  

---

## 1. Estado de la Puerta de la Semana 2 y Certificación de Componentes

Al cierre de la Semana 2 (`S2D1` a `S2D7`), se certifica la implementación completa, modular y verificada de todos los componentes del núcleo de procesamiento y visualización de **PUKARA**:

1. **Motor Puro de Clasificación (`/server/src/engine/clasificar.js`):**
   - Implementado bajo el paradigma *Pure Functions First* (cero dependencias de base de datos o red).
   - Compara las métricas observadas (`intensidad_mm_h`, `acum_24h_mm`, `acum_72h_mm`) contra los umbrales configurados mediante comparación `>=` ("o más").
   - Evalúa y aplica de forma determinista la regla geológica de saturación de suelo antecedente (`acum_72h_mm >= 60.0` y `intensidad_mm_h >= 2.5`), forzando el nivel informativo a un mínimo de `ALERTA`.
   - Manejo estricto de series incompletas: excluye intervalos horarios nulos o faltantes sin asumir jamás $0\text{ mm}$, marcando la evaluación como `clasificacion_parcial: true`.

2. **Máquina de Estados e Histéresis (`/server/src/engine/estado.js`):**
   - Gestiona las 7 transiciones formales de estado (T1 a T7).
   - **Ascenso Inmediato (T1, T3):** La transición hacia un nivel superior se produce en el instante en que cualquier métrica alcanza o supera el umbral correspondiente.
   - **Descenso con Histéresis (T2, T4, T5):** Exige estrictamente 2 muestras consecutivas e independientes en su marca temporal (`separacion_minima_minutos >= 15`), rechazando muestras duplicadas por caché de red.
   - **Descenso Escalonado:** El descenso se produce exclusivamente hacia el mayor de los dos niveles inferiores inmediatos, previniendo oscilaciones bruscas (*chattering*).
   - **Integridad de Primer Orden (T6, T7):** Los estados `SIN_DATOS` (arranque o ausencia total de lecturas) y `DATOS_DESACTUALIZADOS` (antigüedad mayor a `t_max_minutos = 60`) se tratan como estados de primer orden. Queda estrictamente prohibido degradar a `NORMAL` por obsolescencia o falta de datos.

3. **Validador y Versionado Inmutable (`/server/src/engine/validarConfiguracion.js` y `/server/src/services/configuracion.service.js`):**
   - Valida la monotonicidad estricta de umbrales (`PRECAUCION < ALERTA < EMERGENCIA`) y la coherencia de parámetros temporales.
   - Versionado inmutable en PostgreSQL (`configuraciones_reglas`): las versiones previas pasan a estado `'archivada'` y nunca son sobrescritas.
   - La activación de una nueva versión no altera evaluaciones históricas previas y reinicia de forma limpia el contador de descenso.

4. **Modo Simulación Aislado (`/server/src/services/simulacion.service.js`):**
   - Ejecuta lecturas simuladas en memoria manteniendo una máquina de estados independiente.
   - Aislamiento estricto: las pruebas y demostraciones con `modalidad = 'simulada'` jamás alteran la tabla real de lecturas, el historial operativo ni el `contador_descenso` del flujo en tiempo real.

5. **Servicio de Orquestación y Persistencia (`/server/src/services/evaluaciones.service.js` y `/server/src/services/estado.service.js`):**
   - Coordina la ingesta meteorológica (Open-Meteo con respaldo de base de datos ante caídas de red o timeouts), cálculo de acumulados móviles, evaluación del estado derivado y persistencia atómica en `evaluaciones_nivel`.
   - Expone los endpoints `GET /api/estado` y `GET /api/historial` con payload normalizado v1, aviso permanente inmutable, datos meteorológicos, nivel vigente y capas cartográficas de referencia.

6. **Cliente Web del Esqueleto E2E (`/client/src/`):**
   - Interfaz mobile-first en React 18 + Tailwind CSS.
   - Renderiza el banner de nivel informativo con los 4 colores semánticos canónicos (`NORMAL`, `PRECAUCION`, `ALERTA`, `EMERGENCIA`).
   - Alertas visuales destacadas para `SIN_DATOS`, `DATOS_DESACTUALIZADOS` y advertencia de clasificación parcial.
   - Panel de control interactivo para pruebas de simulación y tabla de historial reciente de evaluaciones.

### Constancia Formal: No Aplicación de la Regla de Recorte

> [!NOTE]
> **CERTIFICACIÓN DE ALCANCE:** Se deja constancia explícita de que **NO se activa la regla de recorte** prevista en el plan de contingencia del proyecto. El 100% de los requisitos funcionales, de negocio, de integridad temporal y de cobertura de pruebas correspondientes a la Semana 2 se cumplieron satisfactoriamente sin exclusión de módulos ni simplificación de algoritmos.

---

## 2. Matriz de Trazabilidad de Pruebas Automatizadas (Semanas 1 y 2)

A continuación se detalla la matriz de verificación formal con todos los códigos oficiales de prueba implementados y validados en verde mediante Vitest:

| Código | Requisito / Propiedad Validada | Archivo de Prueba Oficial | Estado |
| :---: | :--- | :--- | :---: |
| **`P01`** | **Límite de Umbral Inclusivo (`>=`):** Comprobación con valor igual al límite superior; métrica en umbral detona el nivel superior ("o más"). | [`server/tests/clasificar.p01.p17.test.js`](file:///home/joel/Documentos/Taller/Proyecto/PUKARA/server/tests/clasificar.p01.p17.test.js) | **PASÓ** |
| **`P02`** | **Manejo de Lecturas Incompletas:** Horas faltantes o nulas en series horarias se excluyen; prohibido asumir $0\text{ mm}$. Marca evaluación como parcial. | [`server/tests/acumulados.test.js`](file:///home/joel/Documentos/Taller/Proyecto/PUKARA/server/tests/acumulados.test.js)<br>[`server/tests/motorSecuenciasBordes.s2d7.test.js`](file:///home/joel/Documentos/Taller/Proyecto/PUKARA/server/tests/motorSecuenciasBordes.s2d7.test.js) | **PASÓ** |
| **`P03`** | **Ascenso Inmediato de Nivel:** Al superar el umbral, el estado transiciona inmediatamente al nivel superior sin requerir muestras adicionales. | [`server/tests/estado.p13.p14.test.js`](file:///home/joel/Documentos/Taller/Proyecto/PUKARA/server/tests/estado.p13.p14.test.js)<br>[`server/tests/motorSecuenciasBordes.s2d7.test.js`](file:///home/joel/Documentos/Taller/Proyecto/PUKARA/server/tests/motorSecuenciasBordes.s2d7.test.js) | **PASÓ** |
| **`P04`** | **Descenso con Histéresis:** Exige estrictamente 2 muestras consecutivas e independientes menores al umbral para permitir el descenso. | [`server/tests/estado.p13.p14.test.js`](file:///home/joel/Documentos/Taller/Proyecto/PUKARA/server/tests/estado.p13.p14.test.js)<br>[`server/tests/motorSecuenciasBordes.s2d7.test.js`](file:///home/joel/Documentos/Taller/Proyecto/PUKARA/server/tests/motorSecuenciasBordes.s2d7.test.js) | **PASÓ** |
| **`P05`** | **Descenso al Mayor Inferior:** Ante una caída abrupta de métricas, el nivel desciende paso a paso hacia el mayor de los dos niveles inferiores. | [`server/tests/estado.p13.p14.test.js`](file:///home/joel/Documentos/Taller/Proyecto/PUKARA/server/tests/estado.p13.p14.test.js)<br>[`server/tests/motorSecuenciasBordes.s2d7.test.js`](file:///home/joel/Documentos/Taller/Proyecto/PUKARA/server/tests/motorSecuenciasBordes.s2d7.test.js) | **PASÓ** |
| **`P11`** | **Inmutabilidad de Versiones Históricas:** La creación de una nueva versión de reglas archiva la anterior sin alterar evaluaciones pasadas. | [`server/tests/estadoDerivadoYSimulacion.p15.p11.test.js`](file:///home/joel/Documentos/Taller/Proyecto/PUKARA/server/tests/estadoDerivadoYSimulacion.p15.p11.test.js)<br>[`server/tests/validarConfiguracion.p16.p05.test.js`](file:///home/joel/Documentos/Taller/Proyecto/PUKARA/server/tests/validarConfiguracion.p16.p05.test.js) | **PASÓ** |
| **`P13`** | **Aislamiento de Simulación:** Las lecturas simuladas se procesan en memoria sin persistir en BD real ni alterar el contador de descenso real. | [`server/tests/estado.p13.p14.test.js`](file:///home/joel/Documentos/Taller/Proyecto/PUKARA/server/tests/estado.p13.p14.test.js)<br>[`server/tests/estadoDerivadoYSimulacion.p15.p11.test.js`](file:///home/joel/Documentos/Taller/Proyecto/PUKARA/server/tests/estadoDerivadoYSimulacion.p15.p11.test.js) | **PASÓ** |
| **`P14`** | **Integridad `SIN_DATOS` en Arranque:** Arranque sin registros inicia en `SIN_DATOS` con nivel vigente nulo; nunca degrada a `NORMAL`. | [`server/tests/estado.p13.p14.test.js`](file:///home/joel/Documentos/Taller/Proyecto/PUKARA/server/tests/estado.p13.p14.test.js)<br>[`server/tests/orquestacion.s2d5.test.js`](file:///home/joel/Documentos/Taller/Proyecto/PUKARA/server/tests/orquestacion.s2d5.test.js)<br>[`client/src/tests/esqueleto.s2d6.test.jsx`](file:///home/joel/Documentos/Taller/Proyecto/PUKARA/client/src/tests/esqueleto.s2d6.test.jsx) | **PASÓ** |
| **`P15`** | **Integridad `DATOS_DESACTUALIZADOS`:** Tras superar $T_{\max} = 60\text{ min}$, preserva el último nivel conocido y alerta obsolescencia; nunca degrada a `NORMAL`. | [`server/tests/estadoDerivadoYSimulacion.p15.p11.test.js`](file:///home/joel/Documentos/Taller/Proyecto/PUKARA/server/tests/estadoDerivadoYSimulacion.p15.p11.test.js)<br>[`server/tests/motorSecuenciasBordes.s2d7.test.js`](file:///home/joel/Documentos/Taller/Proyecto/PUKARA/server/tests/motorSecuenciasBordes.s2d7.test.js)<br>[`client/src/tests/esqueleto.s2d6.test.jsx`](file:///home/joel/Documentos/Taller/Proyecto/PUKARA/client/src/tests/esqueleto.s2d6.test.jsx) | **PASÓ** |
| **`P16`** | **Rechazo de Muestras Duplicadas:** Muestras con separación menor a 15 min se descartan para el contador de descenso por histéresis. | [`server/tests/validarConfiguracion.p16.p05.test.js`](file:///home/joel/Documentos/Taller/Proyecto/PUKARA/server/tests/validarConfiguracion.p16.p05.test.js)<br>[`server/tests/estadoDerivadoYSimulacion.p15.p11.test.js`](file:///home/joel/Documentos/Taller/Proyecto/PUKARA/server/tests/estadoDerivadoYSimulacion.p15.p11.test.js) | **PASÓ** |
| **`P17`** | **Regla de Saturación de Suelo:** Acumulado 72h $\ge 60\text{ mm}$ e intensidad $\ge 2.5\text{ mm/h}$ fuerza el nivel a mínimo `ALERTA`. | [`server/tests/clasificar.p01.p17.test.js`](file:///home/joel/Documentos/Taller/Proyecto/PUKARA/server/tests/clasificar.p01.p17.test.js)<br>[`server/tests/motorSecuenciasBordes.s2d7.test.js`](file:///home/joel/Documentos/Taller/Proyecto/PUKARA/server/tests/motorSecuenciasBordes.s2d7.test.js) | **PASÓ** |

### Pruebas de Línea Base y Puerta de Semana 1 Ratificadas

| Componente | Archivo de Prueba | Cobertura / Objetivo | Estado |
| :--- | :--- | :--- | :---: |
| **Semántica y Lista Negra** | [`server/tests/puerta_semana1.test.js`](file:///home/joel/Documentos/Taller/Proyecto/PUKARA/server/tests/puerta_semana1.test.js) | Escaneo estático de código fuente y UI contra términos prohibidos. | **PASÓ** |
| **Base de Datos y Semillas** | [`server/tests/esquema_seed.test.js`](file:///home/joel/Documentos/Taller/Proyecto/PUKARA/server/tests/esquema_seed.test.js) | 10 tablas relacionales SQL, constraints, tipos e idempotencia de seeds. | **PASÓ** |
| **Salud del Sistema** | [`server/tests/salud.test.js`](file:///home/joel/Documentos/Taller/Proyecto/PUKARA/server/tests/salud.test.js) | Conectividad `GET /api/salud` y comprobación de PostgreSQL nativo. | **PASÓ** |
| **Cliente Open-Meteo** | [`server/tests/openMeteo.test.js`](file:///home/joel/Documentos/Taller/Proyecto/PUKARA/server/tests/openMeteo.test.js) | Consulta con reintentos exponenciales, timeouts y validación de tipos. | **PASÓ** |
| **Caché y Resiliencia** | [`server/tests/lecturas.service.test.js`](file:///home/joel/Documentos/Taller/Proyecto/PUKARA/server/tests/lecturas.service.test.js) | TTL en memoria (12 min) y tolerancia a fallos con respaldo en base de datos. | **PASÓ** |
| **Rutas de Estado** | [`server/tests/estado.routes.test.js`](file:///home/joel/Documentos/Taller/Proyecto/PUKARA/server/tests/estado.routes.test.js) | Integración HTTP de `GET /api/estado` con aviso permanente y capas. | **PASÓ** |
| **Interfaz de Usuario Web** | [`client/src/tests/inicio.test.jsx`](file:///home/joel/Documentos/Taller/Proyecto/PUKARA/client/src/tests/inicio.test.jsx) | Renderizado de aviso legal, capas de referencia y semántica permitida. | **PASÓ** |

---

## 3. Resumen Cuantitativo de Ejecución de Pruebas

- **Backend (`/server`):**
  - **14 suites de pruebas** ejecutadas.
  - **129 pruebas unitarias y de integración**, 100% aprobadas.
  - **0 fallos, 0 errores, 0 pruebas saltadas.**
- **Frontend (`/client`):**
  - **2 suites de pruebas** ejecutadas.
  - **9 pruebas de componentes e interfaz**, 100% aprobadas.
  - **Compilación de producción (`vite build`):** Completada con éxito sin errores en $\sim 570\text{ ms}$.

---

## 4. Comandos de Verificación Rápida

Para reproducir y validar de forma autónoma toda la batería de pruebas del sistema, ejecute los siguientes comandos desde la raíz del proyecto:

```bash
# 1. Ejecutar las 14 suites del Backend (requiere PostgreSQL local pukara-postgres activo)
npm test --prefix server

# 2. Ejecutar las suites de componentes y UI del Frontend
npm test --prefix client

# 3. Validar la compilación estática de producción del Frontend
npm run build --prefix client
```

---

## 5. Gobernanza Semántica y Aviso Permanente de Seguridad

Se ratifica el estricto apego al marco de gobernanza definido en [`GEMINI.md`](file:///home/joel/Documentos/Taller/Proyecto/PUKARA/GEMINI.md):
- El sistema utiliza de forma exclusiva la semántica autorizada de **"nivel informativo de lluvia"** con sus cuatro estados canónicos: `NORMAL`, `PRECAUCION`, `ALERTA` y `EMERGENCIA`.
- Las recomendaciones preventivas son de tipo general y con indicación expresa de origen de demostración.
- En toda vista de usuario se exhibe de manera fija e inalterable el texto legal:
  > *"Los niveles Normal, Precaución, Alerta y Emergencia son niveles informativos de lluvia: niveles meteorológicos simulados, calculados con umbrales académicos. No sustituyen alertas ni instrucciones de las autoridades oficiales. PUKARA muestra información bajo consulta y no avisa activamente a la población. Ante una emergencia, atienda las indicaciones oficiales y contacte a los servicios de emergencia."*

---

## 6. Dictamen de Transición a Semana 3

Con la aprobación formal de la **Puerta de la Semana 2**, el repositorio se encuentra en condiciones óptimas para iniciar la **Semana 3**:
- Ramas temáticas planificadas: `feat/admin-auth` (autenticación administrativa y gestión de umbrales), `feat/mapa-haversine` (cartografía Leaflet y cálculo 100% en cliente sin envío de GPS) y `feat/pwa-offline` (Service Worker y modo sin conexión).
- La rama `feat/motor-reglas` queda formalmente completada y fusionada de manera no acelerada (`--no-ff`) en `main`.
