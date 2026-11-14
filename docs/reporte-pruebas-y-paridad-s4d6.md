# PUKARA — Reporte Consolidado de Pruebas Automatizadas y Matriz de Paridad frente a `PUKARA.pdf` (`S4D6`)

- **Proyecto:** PUKARA — Aplicación web progresiva (PWA) para consulta de condiciones de lluvias intensas en el sector Llojeta, La Paz
- **Asignatura:** INF-266 Taller de Proyecto — Carrera de Informática, UMSA
- **Docente:** Ph.D. Brigida Alexandra Carvajal Blanco
- **Estudiante:** Joel Fernando Flores Choque
- **Certificación de Suites Automatizadas:** **34 suites en verde (`24` en `/server` + `10` en `/client`) — `298` pruebas automatizadas (`100% PASS`)**

> **Aviso Permanente Obligatorio:**
> *"Los niveles Normal, Precaución, Alerta y Emergencia son niveles informativos de lluvia: niveles meteorológicos simulados, calculados con umbrales académicos. No sustituyen alertas ni instrucciones de las autoridades oficiales. PUKARA muestra información bajo consulta y no avisa activamente a la población. Ante una emergencia, atienda las indicaciones oficiales y contacte a los servicios de emergencia."*

---

## 1. Inventario Completo de Suites Automatizadas (`/server` y `/client`)

### 1.1. Suites de Pruebas Automatizadas del Backend (`/server/tests/` — 24 Suites / 228 Pruebas)

| # | Archivo de Suite (`/server/tests/`) | Pruebas | Módulos y Casos `P01`–`P19` Cubiertos | Resultado |
| :-: | :--- | :---: | :--- | :---: |
| 1 | `tests/salud.test.js` | 2 | Salud de la API (`GET /api/salud`), conectividad a PostgreSQL y respuesta 404 limpia | **`100% PASS`** |
| 2 | `tests/esquema_seed.test.js` | 5 | Contrato de las 10 tablas SQL inmutables, configuración `v1` y los 9 umbrales académicos | **`100% PASS`** |
| 3 | `tests/openMeteo.test.js` | 8 | Módulo 1: Cliente Open-Meteo, normalización UTC, timeout y resiliencia ante caída (`P03`) | **`100% PASS`** |
| 4 | `tests/acumulados.test.js` | 10 | Módulo 1/2: Cálculo de intensidad `1h`, acumulados `24h`/`72h` y datos faltantes/nulos (`P02`) | **`100% PASS`** |
| 5 | `tests/lecturas.service.test.js` | 7 | Módulo 1: Persistencia, caché de `12 min` y unicidad por `observado_en` (`P03`, `P04`) | **`100% PASS`** |
| 6 | `tests/puerta_semana1.test.js` | 11 | Puerta de calidad Semana 1: auditoría de esquema, umbrales `v1` y restricciones semánticas | **`100% PASS`** |
| 7 | `tests/clasificar.p01.p17.test.js` | 21 | Módulo 2: Clasificación pura por umbrales con `>=` (`P01`) y regla de saturación (`P17`) | **`100% PASS`** |
| 8 | `tests/estado.p13.p14.test.js` | 20 | Módulo 2: Máquina de estados `T1`–`T5`, ascenso inmediato (`P13`) e histéresis (`P14`) | **`100% PASS`** |
| 9 | `tests/estadoDerivadoYSimulacion.p15.p11.test.js` | 8 | Módulo 2: Estados derivados `DATOS_DESACTUALIZADOS`/`SIN_DATOS` (`P15`) y aislamiento (`P11`) | **`100% PASS`** |
| 10 | `tests/validarConfiguracion.p16.p05.test.js` | 9 | Módulo 2/5: Validación matemática de umbrales (`P16`) y versionado inmutable (`P05`) | **`100% PASS`** |
| 11 | `tests/configuracion.service.test.js` | 12 | Módulo 2/5: Servicio transaccional de configuraciones, activación y reinicio de contador (`P05`) | **`100% PASS`** |
| 12 | `tests/orquestacion.s2d5.test.js` | 5 | Módulo 1/2/3: Orquestación completa lectura → evaluación → estado público | **`100% PASS`** |
| 13 | `tests/estado.routes.test.js` | 3 | Endpoint público `GET /api/estado` en modalidad `real` y `simulada` | **`100% PASS`** |
| 14 | `tests/motorSecuenciasBordes.s2d7.test.js` | 8 | Módulo 2: Secuencias prolongadas de tormenta, bordes de histéresis y saturación (`P01`, `P13`, `P14`, `P17`) | **`100% PASS`** |
| 15 | `tests/auth.p07.test.js` | 19 | Módulo 5: Login con `bcrypt`, emisión/verificación JWT, RBAC (`P07`) y Rate Limiting (HTTP `429`) | **`100% PASS`** |
| 16 | `tests/admin.api.test.js` | 27 | Módulo 5: CRUD administrativo protegido, versionado (`P05`/`P16`), simulación (`P11`) y bitácora | **`100% PASS`** |
| 17 | `tests/recomendaciones.p06.test.js` | 3 | Módulo 3: **Recomendaciones preventivas generales**, etiqueta *"referencia de demostración, no validada"* y `P06` | **`100% PASS`** |
| 18 | `tests/haversine.p18.test.js` | 11 | Módulo 4: Fórmula de Haversine y verificación matemática en ubicaciones de Llojeta (`P18`) | **`100% PASS`** |
| 19 | `tests/contrato_ui_api.test.js` | 5 | Contrato de integración Frontend-Backend y verificación anti-404 de rutas | **`100% PASS`** |
| 20 | `tests/puerta_semana3.test.js` | 8 | Puerta de calidad Semana 3: auditoría semántica estática y cumplimiento de los 5 módulos | **`100% PASS`** |
| 21 | `tests/integracion/apiCompleta.s4d1.test.js` | 10 | `S4D1`: Integración HTTP completa de la API (`P01`, `P03`, `P04`, `P05`, `P07`, `P16`, `P17`) | **`100% PASS`** |
| 22 | `tests/integracion/resilienciaFallos.s4d2.test.js` | 5 | `S4D2`: Integración de datos faltantes (`P02`), fallos de API (`P03`/`T5`) y simulación vs real (`P11`) | **`100% PASS`** |
| 23 | `tests/integracion/rendimientoApi.s4d4.test.js` | 3 | `S4D4`: Benchmark de tiempos de respuesta HTTP (`p50`, `p95`, promedio `< 3s` — `P19`) | **`100% PASS`** |
| 24 | `tests/integracion/escenarioHistoricoSeguridad.s4d5.test.js` | 8 | `S4D5`: Escenarios históricos abril 2019 y noviembre 2024 (Sección 11.3) + Seguridad básica (Sección 6.4) | **`100% PASS`** |
| **Total Backend** | **24 Suites en `/server`** | **228** | **Cobertura integral de backend, motor, base de datos, seguridad y escenarios históricos** | **`228 / 228 PASS`** |

### 1.2. Suites de Pruebas Automatizadas del Frontend (`/client/src/` — 10 Suites / 70 Pruebas)

| # | Archivo de Suite (`/client/src/`) | Pruebas | Módulos y Casos `P01`–`P19` Cubiertos | Resultado |
| :-: | :--- | :---: | :--- | :---: |
| 1 | `src/tests/inicio.test.jsx` | 6 | Renderizado base de la interfaz pública y presencia del Aviso Permanente | **`100% PASS`** |
| 2 | `src/tests/esqueleto.s2d6.test.jsx` | 3 | Estructura de navegación, banner de **nivel informativo de lluvia** y tarjetas principales | **`100% PASS`** |
| 3 | `src/__tests__/PanelAdmin.test.jsx` | 3 | Módulo 5: Vista de autenticación administrativa, gestión de umbrales y bitácora | **`100% PASS`** |
| 4 | `src/__tests__/RecomendacionesAvisoP06.test.jsx` | 5 | Módulo 3: **Recomendaciones preventivas generales**, etiqueta *"referencia de demostración, no validada"* y aviso in-app (`P06`) | **`100% PASS`** |
| 5 | `src/__tests__/MapaHaversineP09P18.test.jsx` | 9 | Módulo 4: Permiso GPS denegado (`P09`), Haversine en cliente (`P18`) y leyenda *"distancia aproximada en línea recta (no es recomendación de ruta ni indica seguridad)"* | **`100% PASS`** |
| 6 | `src/__tests__/ConsultaOfflineP08P10.test.jsx` | 11 | Módulo 3/4: Modo avión (`P08`) con aviso *"Datos del [fecha y hora], no actualizados"* y mapa sin teselas (`P10`) | **`100% PASS`** |
| 7 | `src/__tests__/PwaInstalableS3D5.test.jsx` | 14 | Módulo 3/4: Manifiesto PWA instalable (`P12`), Service Worker y almacenamiento local resiliente (`P08`) | **`100% PASS`** |
| 8 | `src/__tests__/PuertaSemana3UI.test.jsx` | 10 | Puerta de calidad UI Semana 3: cumplimiento semántico y ausencia de redirecciones externas | **`100% PASS`** |
| 9 | `src/tests/integracionPwaOffline.s4d3.test.jsx` | 7 | `S4D3`: Integración transversal PWA Offline (`P08`), GPS denegado (`P09`), mapa parcial (`P10`), `P06`, `P12` y 4 ubicaciones `P18` | **`100% PASS`** |
| 10 | `src/tests/rendimientoUsabilidad.s4d4.test.jsx` | 2 | `S4D4`: Visibilidad de nivel y recomendaciones en `< 3000 ms` y claridad de tareas clave (`P19`) | **`100% PASS`** |
| **Total Frontend** | **10 Suites en `/client`** | **70** | **Cobertura integral de interfaz pública, cartografía, Haversine, PWA offline, usabilidad y panel admin** | **`70 / 70 PASS`** |

---

## 2. Resolución de Todos los Marcadores `[Completar]` y `[Verificar]` de `PUKARA.pdf`

Durante el ciclo de desarrollo (`S1D1` a `S4D6`) se cerraron y documentaron con evidencia empírica todos los puntos marcados como `[Completar]` o `[Verificar]` en el documento de diseño `PUKARA.pdf`:

| Marcador en `PUKARA.pdf` | Resolución Técnica Implementada y Verificada | Archivo / Evidencia de Respaldo |
| :--- | :--- | :--- |
| **Coordenada central representativa de Llojeta** | Fijada en **`latitud: -16.5235, longitud: -68.1425`** (Sector Llojeta / Bajo Llojeta, macrodistrito Cotahuma, La Paz), con cuadro delimitador `[-16.5350, -68.1580]` a `[-16.5120, -68.1280]`. | `server/src/config/zonaPiloto.js`, `docs/verificacion_open_meteo_llojeta.md` |
| **Zonas y puntos de referencia de demostración** | Cargadas **2 zonas poligonales GeoJSON** en `JSONB` (*Sector Bajo Llojeta — Cuenca Pasajahuira* y *Ladera Llojeta — Sector Inmaculada Concepción*) y **6 puntos de referencia** con `estado_verificacion = 'sin_verificar'` y etiqueta *"referencia de demostración, no validada"*. | `server/src/db/seedCapas.js`, `docs/capas_referencia_llojeta.md` |
| **Intervalo de actualización de Open-Meteo y caché** | Serie horaria (`hourly=precipitation`) + bloque `current` con intervalo nativo de `15 minutos` (`900 s`), `separacion_minima_minutos: 15`, caché en servidor de **`12 minutos`** (`LECTURAS_CACHE_TTL_MINUTOS=12`) y umbral de vigencia `t_max_minutos: 60`. | `server/src/services/openMeteo.js`, `server/src/services/lecturas.service.js` |
| **Contactos de emergencia verificados (fuente y fecha)** | Verificados en fuentes públicas institucionales (GAMLP / Policía Boliviana / Viceministerio de Defensa Civil): **Red 114 — Emergencias GAMLP (`114`)**, **Bomberos Antofagasta (`119`)**, **Radio Patrullas (`110`)** y **Defensa Civil (`115`)**. | `server/src/db/seed.js`, tabla `contactos_emergencia` |
| **Tolerancia de distancia Haversine (`P18`)** | Tolerancia fijada en **`± 0.05 km` (`50 metros`)**; verificada en **4 ubicaciones de prueba** con error real `< 0.01 km` y rótulo obligatorio *"distancia aproximada en línea recta (no es recomendación de ruta ni indica seguridad)"* (*"distancia aproximada en línea recta (no es ruta ni indica seguridad)"*). | `server/tests/haversine.p18.test.js`, `client/src/tests/integracionPwaOffline.s4d3.test.jsx` |
| **Participantes en prueba de usabilidad (`P19`)** | Evaluada con **`5 participantes`** (`U01` a `U05`): `100%` de tareas completadas (`25/25`), `0` hallazgos pendientes de severidad alta y tiempo de carga medido en **`287 ms < 3000 ms`**. | `docs/informe-usabilidad-rendimiento-s4d4.md`, `server/src/scripts/medirRendimientoP19.js` |

---

## 3. Matriz de Paridad Integral contra la Propuesta `PUKARA.pdf`

| Sección de `PUKARA.pdf` | Especificación de Diseño | Estado de Implementación y Paridad en el Repositorio | Cumplimiento |
| :--- | :--- | :--- | :---: |
| **Sección 5 — Objetivos Específicos (`OE1` a `OE6`)** | `OE1`: Ingesta Open-Meteo; `OE2`: Motor por umbrales/histéresis/saturación; `OE3`: Recomendaciones, contactos y aviso in-app; `OE4`: Mapa neutro, Haversine en cliente y PWA offline; `OE5`: Panel admin JWT y bitácora; `OE6`: Validación `P01`–`P19`, usabilidad y escenarios 2019/2024. | Los 6 objetivos específicos están implementados, integrados y respaldados por 34 suites de prueba y 6 scripts ejecutables de auditoría. | **`100% CUMPLIDO`** |
| **Sección 6.3 — Los 5 Módulos del Sistema** | Módulos 1 al 5 en arquitectura de monolito en capas (`/client` React + Vite + Tailwind + Leaflet + PWA y `/server` Node.js ESM + Express + `pg` Pool nativo sin ORM ni PostGIS). | Implementados en `/server/src/{routes,services,engine,db,middleware}` y `/client/src/{components,pages,utils,services}`. | **`100% CUMPLIDO`** |
| **Sección 6.4 — Seguridad Básica y Privacidad** | Secretos en `.env` fuera de Git, contraseñas con `bcrypt`, JWT con expiración (`exp`) y rol `administrador`, consultas SQL parametrizadas (`$1, $2`), rate limiting en login (`429`), CORS y cero envío de GPS al servidor. | Auditado automáticamente por `escenarioHistoricoSeguridad.s4d5.test.js` y `npm run verify:s4d5 --prefix server` (`Controles S1 a S5` en `[PASS]`). | **`100% CUMPLIDO`** |
| **Sección 9.5 — Modelo Relacional de 10 Tablas SQL** | `usuarios`, `configuraciones_reglas`, `umbrales`, `lecturas_meteorologicas`, `evaluaciones_nivel`, `recomendaciones_preventivas`, `contactos_emergencia`, `zonas_referencia`, `puntos_referencia`, `bitacora_cambios`. | Las 10 tablas exactas existen en PostgreSQL con geometrías GeoJSON en `JSONB`, integridad referencial y restricciones `CHECK`. | **`100% CUMPLIDO`** |
| **Sección 9.6 — Máquina de Estados (`T1` a `T7`)** | `T1`: Ascenso inmediato; `T2`: Reinicio de contador; `T3`: 1ra muestra inferior (`contador = 1`); `T4`: 2da muestra inferior consecutiva e independiente (`>= 15 min`) baja al mayor de los dos; `T5`: Fallo API conserva estado; `T6`: `DATOS_DESACTUALIZADOS`; `T7`: `SIN_DATOS`. | Implementado como funciones puras en `/server/src/engine/` y certificado por `estado.p13.p14.test.js` y `resilienciaFallos.s4d2.test.js`. | **`100% CUMPLIDO`** |
| **Sección 11.1 — Los 7 Criterios de Validación del Software** | Exactitud del motor, resiliencia ante datos faltantes/caída de API, modo offline con aviso *"Datos del [fecha y hora], no actualizados"*, geolocalización local con Haversine, seguridad JWT/RBAC, aislamiento simulación vs. real y rendimiento `< 3s`. | Los 7 criterios se verifican de forma determinista en las 19 pruebas obligatorias (`P01` a `P19`). | **`100% CUMPLIDO`** |
| **Sección 11.2 — Declaración Fuera del Alcance (Validación Meteorológica)** | No se afirma calibración hidrometeorológica real ni predicción geotécnica de deslizamientos; los umbrales son académicos y las recomendaciones preventivas generales son de demostración (*"referencia de demostración, no validada"*). | Declarado explícitamente en el **Aviso Permanente** de toda pantalla y en la documentación técnica del proyecto. | **`100% CUMPLIDO`** |
| **Sección 11.3 — Prueba de Escenario de Referencia Histórico (2019 y 2024)** | Ejecutar el motor con series históricas de Open-Meteo de abril de 2019 y noviembre de 2024 en Llojeta, documentar el nivel resultante sin afirmar coincidencia con la gravedad real y **sin ajustar los umbrales v1**. | Ejecutado y documentado en `docs/escenario-referencia-seguridad-s4d5.md` (`PRECAUCION` en abril 2019 y `ALERTA` en noviembre 2024; umbrales `v1` inmutables). | **`100% CUMPLIDO`** |
| **Sección 11.5 — Paquete de Evidencias Mínimas a Entregar** | Repositorio Git, manual de instalación, colección Postman, tabla `P01`–`P19` ampliada, reporte de tests, verificación offline/Android y resultado de usabilidad/rendimiento. | Completo en `/docs/` y auditado automáticamente mediante `npm run verify:evidencias --prefix server`. | **`100% CUMPLIDO`** |
