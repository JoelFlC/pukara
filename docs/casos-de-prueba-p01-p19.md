# PUKARA — Casos de Prueba Documentados (`P01` a `P19`) — Tabla 11.4 Ampliada con Datos de Entrada (`S4D6`)

- **Proyecto:** PUKARA — Aplicación web progresiva (PWA) para consulta de condiciones de lluvias intensas en el sector Llojeta, La Paz
- **Asignatura:** INF-266 Taller de Proyecto — Carrera de Informática, UMSA
- **Docente:** Ph.D. Brigida Alexandra Carvajal Blanco
- **Estudiante:** Joel Fernando Flores Choque
- **Referencia de Diseño:** Secciones 11.4 (*Pruebas obligatorias*) y 11.5 (*Evidencias mínimas a entregar*) de `PUKARA.pdf`

> **Aviso Permanente Obligatorio:**
> *"Los niveles Normal, Precaución, Alerta y Emergencia son niveles informativos de lluvia: niveles meteorológicos simulados, calculados con umbrales académicos. No sustituyen alertas ni instrucciones de las autoridades oficiales. PUKARA muestra información bajo consulta y no avisa activamente a la población. Ante una emergencia, atienda las indicaciones oficiales y contacte a los servicios de emergencia."*

---

## 1. Tabla Maestra Resumida de los 19 Casos de Prueba Obligatorios (`P01` a `P19`)

| ID | Prueba Obligatoria (Tabla 11.4 `PUKARA.pdf`) | Módulos | Datos Clave de Entrada | Resultado Esperado y Obtenido | Suite / Script de Verificación | Estado |
| :---: | :--- | :---: | :--- | :--- | :--- | :---: |
| **`P01`** | Umbral igual al límite (`>=`) | M2 | Valores exactos `2.5/6.5/12.0` (`1h`), `10/25/40` (`24h`), `25/60/90` (`72h`) y bordes inferiores (`2.49`, `9.99`, `24.99`) | Activa el **nivel informativo de lluvia** correspondiente cuando el valor es `>=` al umbral; permanece en el nivel inferior con `<`. | `clasificar.p01.p17.test.js`, `apiCompleta.s4d1.test.js` | **APROBADO — EN VERDE** |
| **`P02`** | Lecturas incompletas y nulos | M1, M2 | Serie horaria con `null`/`NaN` en ventana de `24h` (`horas_validas_24h < 24`) o en las 3 variables a la vez | Marca la variable incompleta sin asumir `0 mm`; evalúa con las variables válidas o declara muestra `invalida` si ninguna está completa. | `acumulados.test.js`, `resilienciaFallos.s4d2.test.js` | **APROBADO — EN VERDE** |
| **`P03`** | API Open-Meteo sin respuesta (`T5`) | M1, M2 | `consultarOpenMeteo` rechaza por timeout (`> 8000 ms`) o HTTP `503` con lectura previa vigente en BD | No crea muestra nueva; conserva el último dato con su antigüedad y mantiene `nivel_vigente` y `contador_descenso` sin cambios (`T5`). | `openMeteo.test.js`, `resilienciaFallos.s4d2.test.js` | **APROBADO — EN VERDE** |
| **`P04`** | Dos consultas en la misma ventana de caché | M1, M2 | Dos llamadas consecutivas a `GET /api/estado` dentro del TTL de `12 min` o con idéntico `observado_en` | Se persiste una sola fila en `lecturas_meteorologicas` y una sola evaluación en `evaluaciones_nivel`, sin duplicar ni alterar histéresis. | `lecturas.service.test.js`, `apiCompleta.s4d1.test.js` | **APROBADO — EN VERDE** |
| **`P05`** | Cambio de parámetros y versionado | M2, M5 | `POST /api/admin/configuraciones` con 9 umbrales coherentes (`version = 2`, `activar: true`) | Crea `version = 2` inmutable, archiva `version = 1`, reinicia `contador_descenso = 0`, audita en `bitacora_cambios` y conserva evaluaciones pasadas en `v1`. | `validarConfiguracion.p16.p05.test.js`, `admin.api.test.js` | **APROBADO — EN VERDE** |
| **`P06`** | Cambio de nivel y aviso in-app | M3 | Transición de `PRECAUCION` a `ALERTA` con la aplicación abierta en el navegador | Actualiza el banner del **nivel informativo de lluvia**, despliega las **recomendaciones preventivas generales** con etiqueta *"referencia de demostración, no validada"* y muestra aviso visual in-app. | `recomendaciones.p06.test.js`, `RecomendacionesAvisoP06.test.jsx` | **APROBADO — EN VERDE** |
| **`P07`** | Acceso no autorizado a administración | M5 | Peticiones a `/api/admin/*` sin token, con JWT malformado/vencido o con `rol: 'operador'` | Responde `401 Unauthorized` (sin token / vencido / sin `exp`) o `403 Forbidden` (rol distinto a `administrador`); `0` cambios en BD. | `auth.p07.test.js`, `admin.api.test.js`, `escenarioHistoricoSeguridad.s4d5.test.js` | **APROBADO — EN VERDE** |
| **`P08`** | Modo avión / Consulta offline | M3, M4 | `navigator.onLine = false` y fallo de `fetch('/api/estado')` tras una consulta previa exitosa | Carga instantáneamente el snapshot de `localStorage` y muestra el aviso obligatorio: *"Datos del [fecha y hora], no actualizados"*. | `ConsultaOfflineP08P10.test.jsx`, `integracionPwaOffline.s4d3.test.jsx` | **APROBADO — EN VERDE** |
| **`P09`** | Permiso de GPS denegado (`code: 1`) | M4 | `navigator.geolocation.getCurrentPosition` rechaza con `PERMISSION_DENIED` (`code = 1`) | La consulta general funciona al 100%, oculta distancias numéricas, informa el motivo en pantalla y no envía coordenadas al servidor. | `MapaHaversineP09P18.test.jsx`, `integracionPwaOffline.s4d3.test.jsx` | **APROBADO — EN VERDE** |
| **`P10`** | Mapa sin teselas disponibles | M4 | Eventos `tileerror` en capa de teselas OpenStreetMap de Leaflet o desconexión de red | Muestra aviso de mapa parcial sin teselas, mantiene el polígono neutro de Llojeta y la lista textual de 6 puntos sin ofrecer navegación. | `ConsultaOfflineP08P10.test.jsx`, `integracionPwaOffline.s4d3.test.jsx` | **APROBADO — EN VERDE** |
| **`P11`** | Aislamiento Simulación vs. Real | M2, M5 | `POST /api/admin/simulacion/lectura` con `{ intensidad_mm_h: 14.5, acum_24h_mm: 45, acum_72h_mm: 95 }` | Se registra con `modalidad = 'simulada'`; `GET /api/estado?modalidad=real` conserva intactos el nivel real y el `contador_descenso`. | `estadoDerivadoYSimulacion.p15.p11.test.js`, `resilienciaFallos.s4d2.test.js` | **APROBADO — EN VERDE** |
| **`P12`** | Instalación y flujos en Android real | M3, M4 | Instalación desde Chrome Android (`manifest.webmanifest`, `display: standalone`, `sw.js`) | Aplicación instalada en pantalla de inicio de Android ejecutando los flujos online, offline (`P08`) y mapa referencial (`P10`). | `PwaInstalableS3D5.test.jsx`, `verificacion-offline-android-s4d3.md` | **APROBADO — EN VERDE** |
| **`P13`** | Ascenso inmediato de varios niveles (`T1`) | M2 | Estado vigente `NORMAL` seguido de muestra válida clasificada en `EMERGENCIA` (`intensidad_mm_h = 13.0`) | Transición inmediata (`T1`) a `nivel_vigente = 'EMERGENCIA'` en una sola muestra con `contador_descenso = 0`. | `estado.p13.p14.test.js`, `motorSecuenciasBordes.s2d7.test.js` | **APROBADO — EN VERDE** |
| **`P14`** | Descenso con contador de histéresis (`T2`–`T4`) | M2 | Vigente `ALERTA` (`contador = 0`), muestra 1 `PRECAUCION`, muestra 2 `NORMAL` (`>= 15 min` después) | En muestra 1 sube `contador_descenso = 1` y mantiene `ALERTA` (`T3`); en muestra 2 baja a `PRECAUCION` (el mayor de ambos) con `contador = 0` (`T4`). | `estado.p13.p14.test.js`, `motorSecuenciasBordes.s2d7.test.js` | **APROBADO — EN VERDE** |
| **`P15`** | Datos desactualizados (`T6`) y `SIN_DATOS` (`T7`) | M1, M2 | Última lectura válida con antigüedad `95 min > t_max_minutos (60)` o base de datos sin lecturas válidas | Deriva `DATOS_DESACTUALIZADOS` mostrando el último nivel conocido y su antigüedad (jamás `NORMAL`), o `SIN_DATOS` si no hubo muestras válidas. | `estadoDerivadoYSimulacion.p15.p11.test.js`, `resilienciaFallos.s4d2.test.js` | **APROBADO — EN VERDE** |
| **`P16`** | Rechazo de configuración incoherente | M2, M5 | Umbrales negativos (`-1`), orden roto (`PRECAUCION = 8 >= ALERTA = 6.5`), `24h > 72h` (`30 > 25`) o `< 9` filas | Rechaza la creación/activación con `ConfiguracionInvalidaError` (HTTP `400`) detallando las violaciones matemáticas. | `validarConfiguracion.p16.p05.test.js`, `apiCompleta.s4d1.test.js` | **APROBADO — EN VERDE** |
| **`P17`** | Regla compuesta de saturación de suelo | M2 | Caso A: `acum_72h_mm = 60.0`, `intensidad_mm_h = 2.5`, `acum_24h_mm = 5.0`; Caso B: `acum_72h_mm = 59.9`, `intensidad_mm_h = 2.5` | Caso A activa saturación y eleva el nivel como mínimo a `ALERTA`; Caso B no activa saturación y clasifica en `PRECAUCION`. | `clasificar.p01.p17.test.js`, `apiCompleta.s4d1.test.js` | **APROBADO — EN VERDE** |
| **`P18`** | Distancia Haversine en cliente (`>= 3` ubicaciones) | M4 | 4 coordenadas de prueba en La Paz / Llojeta contra los 6 puntos de referencia (`R = 6371 km`) | Error absoluto `< 0.01 km` (dentro de la tolerancia `± 0.05 km`) y rótulo obligatorio: *"distancia aproximada en línea recta (no es recomendación de ruta ni indica seguridad)"*. | `haversine.p18.test.js`, `MapaHaversineP09P18.test.jsx` | **APROBADO — EN VERDE** |
| **`P19`** | Usabilidad (`5` participantes) y rendimiento (`< 3s`) | M3, M4 | 5 participantes ejecutando 5 tareas clave + benchmark de carga inicial (API + montaje React DOM) | `100%` de tareas completadas sin hallazgos de severidad alta; tiempo total de visibilidad de `287 ms` (`< 3000 ms`). | `rendimientoApi.s4d4.test.js`, `rendimientoUsabilidad.s4d4.test.jsx`, `medirRendimientoP19.js` | **APROBADO — EN VERDE** |

---

## 2. Fichas Detalladas de los 19 Casos de Prueba (`P01` a `P19`)

### Ficha `P01` — Umbral igual al límite (`>=`)
- **ID y Nombre:** `P01` — Evaluación de umbral exactamente igual al límite (`>=`).
- **Módulo(s) Evaluados:** Módulo 2 (Motor de evaluación por umbrales).
- **Escenario y Condición Inicial:** Configuración `version = 1` vigente con los 9 umbrales académicos (`intensidad_mm_h`: `2.5 / 6.5 / 12.0`, `acum_24h_mm`: `10.0 / 25.0 / 40.0`, `acum_72h_mm`: `25.0 / 60.0 / 90.0`).
- **Datos Exactos de Entrada:**
  1. `intensidad_mm_h`: `2.49` (`NORMAL`), `2.50` (`PRECAUCION`), `6.50` (`ALERTA`), `12.00` (`EMERGENCIA`).
  2. `acum_24h_mm`: `9.99` (`NORMAL`), `10.00` (`PRECAUCION`), `25.00` (`ALERTA`), `40.00` (`EMERGENCIA`).
  3. `acum_72h_mm`: `24.99` (`NORMAL`), `25.00` (`PRECAUCION`), `60.00` (`ALERTA`), `90.00` (`EMERGENCIA`).
- **Resultado Esperado (Tabla 11.4 `PUKARA.pdf`):** Todo valor exactamente igual al umbral (`>=`) activa el nivel correspondiente sin requerir que sea estrictamente mayor (`>`).
- **Resultado Obtenido en PUKARA:** `clasificarMuestra` devuelve exactamente `PRECAUCION`, `ALERTA` y `EMERGENCIA` en los 9 límites exactos y `NORMAL` en los bordes inmediatos inferiores (`2.49`, `9.99`, `24.99`).
- **Evidencia Automatizada y Estado:** `server/tests/clasificar.p01.p17.test.js` y `server/tests/integracion/apiCompleta.s4d1.test.js` — **`APROBADO — EN VERDE`**.

---

### Ficha `P02` — Lecturas incompletas y manejo de valores nulos
- **ID y Nombre:** `P02` — Manejo de lecturas con valores faltantes o nulos en series horarias.
- **Módulo(s) Evaluados:** Módulo 1 (Ingesta meteorológica) y Módulo 2 (Motor de evaluación).
- **Escenario y Condición Inicial:** Recepción de payload de Open-Meteo con huecos o valores `null` en `hourly.precipitation` o en `current.precipitation`.
- **Datos Exactos de Entrada:**
  - **Subcaso A (Parcial):** `actual.precipitacion_mm = 3.2` (válida), `serie_horaria` con 24 horas válidas en `24h` (`acum_24h_mm = 12.0`) pero con 3 valores `null` entre la hora 25 y 72 (`horas_validas_72h = 69 < 72`).
  - **Subcaso B (Totalmente incompleta):** `actual.precipitacion_mm = null` y huecos en las últimas 24 horas (`horas_validas_24h = 20 < 24`, `horas_validas_72h = 68 < 72`).
- **Resultado Esperado (Tabla 11.4 `PUKARA.pdf`):** Marca la variable con huecos como incompleta (`null`) sin asumir `0 mm`; evalúa con las variables completas disponibles o declara la muestra `invalida` si ninguna de las tres variables está completa.
- **Resultado Obtenido en PUKARA:** En el Subcaso A, `acum_72h_mm` queda en `null` (`estado = 'incompleta'`) y el motor clasifica en `PRECAUCION` usando `intensidad_mm_h = 3.2` y `acum_24h_mm = 12.0`. En el Subcaso B, devuelve `estado = 'invalida'` y conserva el último nivel conocido sin degradar a `NORMAL`.
- **Evidencia Automatizada y Estado:** `server/tests/acumulados.test.js` y `server/tests/integracion/resilienciaFallos.s4d2.test.js` — **`APROBADO — EN VERDE`**.

---

### Ficha `P03` — API Open-Meteo sin respuesta (`Transición T5`)
- **ID y Nombre:** `P03` — Resiliencia ante caída o timeout de la API meteorológica externa (`T5`).
- **Módulo(s) Evaluados:** Módulo 1 y Módulo 2.
- **Escenario y Condición Inicial:** El sistema tiene una evaluación vigente en `ALERTA` con `contador_descenso = 1` observada hace `20 minutos`. La caché de 12 minutos expira y una nueva consulta dispara petición a Open-Meteo.
- **Datos Exactos de Entrada:** `consultarOpenMeteo()` falla con error de red / timeout (`ETIMEDOUT` / `HTTP 503 Service Unavailable`).
- **Resultado Esperado (Tabla 11.4 `PUKARA.pdf`):** No se inserta ninguna lectura nueva en `lecturas_meteorologicas`, se conserva el último dato válido indicando su antigüedad y se mantienen intactos tanto el `nivel_vigente` (`ALERTA`) como el `contador_descenso` (`1`).
- **Resultado Obtenido en PUKARA:** `GET /api/estado` responde HTTP `200` sirviendo el último estado conocido (`nivel = 'ALERTA'`, `contador_descenso = 1`), con `0` filas nuevas creadas y reportando la antigüedad real en minutos (`T5`).
- **Evidencia Automatizada y Estado:** `server/tests/openMeteo.test.js`, `server/tests/integracion/apiCompleta.s4d1.test.js` y `server/tests/integracion/resilienciaFallos.s4d2.test.js` — **`APROBADO — EN VERDE`**.

---

### Ficha `P04` — Dos consultas dentro del mismo caché / mismo `observado_en`
- **ID y Nombre:** `P04` — Unicidad de muestra temporal y protección contra doble conteo de histéresis.
- **Módulo(s) Evaluados:** Módulo 1 y Módulo 2.
- **Escenario y Condición Inicial:** Estado vigente en `ALERTA` (`contador_descenso = 0`). Ingresa una lectura con `observado_en = '2026-03-10T14:00:00.000Z'` y métricas de `PRECAUCION`.
- **Datos Exactos de Entrada:** Dos peticiones sucesivas a `GET /api/estado` dentro de la ventana de caché (`< 12 min`) o dos invocaciones al motor con el mismo timestamp `observado_en = '2026-03-10T14:00:00.000Z'` (o separación `< 15 min`).
- **Resultado Esperado (Tabla 11.4 `PUKARA.pdf`):** Se registra una única lectura y una única evaluación; la segunda consulta reutiliza la muestra vigente sin volver a incrementar `contador_descenso`.
- **Resultado Obtenido en PUKARA:** `lecturas_meteorologicas` y `evaluaciones_nivel` incrementan en exactamente `1` registro en la primera consulta y `0` en la segunda; `contador_descenso` permanece en `1` sin bajar prematuramente de nivel.
- **Evidencia Automatizada y Estado:** `server/tests/lecturas.service.test.js`, `server/tests/estado.p13.p14.test.js` y `server/tests/integracion/apiCompleta.s4d1.test.js` — **`APROBADO — EN VERDE`**.

---

### Ficha `P05` — Cambio de parámetros y versionado inmutable
- **ID y Nombre:** `P05` — Creación y activación de nueva versión de configuración de reglas.
- **Módulo(s) Evaluados:** Módulo 2 y Módulo 5 (Administración y bitácora).
- **Escenario y Condición Inicial:** Configuración `version = 1` vigente con evaluaciones históricas registradas y estado actual con `contador_descenso = 1`.
- **Datos Exactos de Entrada:** `POST /api/admin/configuraciones` autenticado con JWT de administrador y payload:
  `{ activar: true, motivo: "Ajuste académico de prueba P05", umbrales: [3.0/7.0/13.0, 12.0/28.0/45.0, 30.0/65.0/95.0] }`.
- **Resultado Esperado (Tabla 11.4 `PUKARA.pdf`):** Crea una nueva versión (`version = 2`), archiva la `version = 1` sin sobrescribirla, aplica los nuevos umbrales únicamente a evaluaciones futuras, reinicia `contador_descenso = 0` y deja registro auditable en `bitacora_cambios`.
- **Resultado Obtenido en PUKARA:** Responde HTTP `201`, las evaluaciones históricas conservan `configuracion_id = 1` (`version = 1`), las nuevas evaluaciones usan `version = 2`, el `contador_descenso` se reinicia a `0` y `bitacora_cambios` almacena `valor_anterior` y `valor_nuevo` en `JSONB`.
- **Evidencia Automatizada y Estado:** `server/tests/validarConfiguracion.p16.p05.test.js`, `server/tests/admin.api.test.js` y `server/tests/integracion/apiCompleta.s4d1.test.js` — **`APROBADO — EN VERDE`**.

---

### Ficha `P06` — Cambio de nivel y aviso visual in-app
- **ID y Nombre:** `P06` — Actualización de recomendaciones preventivas y aviso visual dentro de la aplicación abierta.
- **Módulo(s) Evaluados:** Módulo 3 (Recomendaciones preventivas y aviso visual in-app).
- **Escenario y Condición Inicial:** El usuario mantiene abierta la vista principal de PUKARA mientras el **nivel informativo de lluvia** vigente es `PRECAUCION`.
- **Datos Exactos de Entrada:** Nueva consulta actualiza el estado vigente a `ALERTA` (`transicion.cambio_nivel = true`, `nivel_anterior = 'PRECAUCION'`, `nivel_nuevo = 'ALERTA'`).
- **Resultado Esperado (Tabla 11.4 `PUKARA.pdf`):** Muestra el nuevo **nivel informativo de lluvia**, despliega las **recomendaciones preventivas generales** asociadas al nivel `ALERTA` con su etiqueta de origen *"referencia de demostración, no validada"* y presenta el banner de aviso visual in-app (sin emplear notificaciones push en segundo plano).
- **Resultado Obtenido en PUKARA:** El componente `AvisoCambioNivelInApp` renderiza la transición `PRECAUCIÓN → ALERTA`, actualiza las tarjetas de recomendaciones preventivas generales con su etiqueta de origen y mantiene visible el Aviso Permanente.
- **Evidencia Automatizada y Estado:** `server/tests/recomendaciones.p06.test.js` y `client/src/__tests__/RecomendacionesAvisoP06.test.jsx` — **`APROBADO — EN VERDE`**.

---

### Ficha `P07` — Acceso no autorizado a rutas administrativas
- **ID y Nombre:** `P07` — Control de acceso basado en JWT y rol `administrador` en `/api/admin/*`.
- **Módulo(s) Evaluados:** Módulo 5 (Autenticación, autorización RBAC y seguridad).
- **Escenario y Condición Inicial:** Endpoints administrativos protegidos (`GET/POST /api/admin/configuraciones`, `POST /api/admin/recomendaciones`, `PUT /api/admin/contactos/:id`, `POST /api/admin/simulacion/lectura`, `GET /api/admin/bitacora`).
- **Datos Exactos de Entrada:**
  1. Petición sin cabecera `Authorization`.
  2. Petición con `Authorization: Bearer token.malformado.invalido`.
  3. Petición con token JWT expirado (`exp < now`) o firmado sin claim `exp`.
  4. Petición con token JWT válido pero con `rol: 'operador'` (distinto a `'administrador'`).
- **Resultado Esperado (Tabla 11.4 `PUKARA.pdf`):** Rechaza con HTTP `401` (casos 1, 2 y 3) y HTTP `403` (caso 4), sin ejecutar ninguna modificación en las tablas de PostgreSQL.
- **Resultado Obtenido en PUKARA:** Devuelve `401 TOKEN_FALTANTE / TOKEN_INVALIDO / TOKEN_EXPIRADO` y `403 ROL_INSUFICIENTE`, verificando que los conteos y registros de `configuraciones_reglas`, `umbrales` y `bitacora_cambios` permanecen inalterados.
- **Evidencia Automatizada y Estado:** `server/tests/auth.p07.test.js`, `server/tests/admin.api.test.js` y `server/tests/integracion/escenarioHistoricoSeguridad.s4d5.test.js` — **`APROBADO — EN VERDE`**.

---

### Ficha `P08` — Modo avión y consulta offline en PWA
- **ID y Nombre:** `P08` — Apertura y consulta de la PWA sin conexión a internet (Modo Avión).
- **Módulo(s) Evaluados:** Módulo 3 y Módulo 4 (PWA Offline y almacenamiento local).
- **Escenario y Condición Inicial:** El usuario realizó previamente al menos una consulta con conexión en la que se persistió el último estado válido en `localStorage` (`pukara_ultimo_estado_v1`) y el Service Worker cacheó el App Shell.
- **Datos Exactos de Entrada:** Activación de modo avión (`navigator.onLine = false` y rechazo por red de `fetch('/api/estado')`).
- **Resultado Esperado (Tabla 11.4 `PUKARA.pdf`):** La aplicación abre normalmente y muestra el último **nivel informativo de lluvia**, las **recomendaciones preventivas generales**, los contactos de emergencia y las capas de referencia almacenadas, encabezados por el aviso: *"Datos del [fecha y hora], no actualizados"*.
- **Resultado Obtenido en PUKARA:** Renderiza sin errores el snapshot local completo y despliega el banner offline con el texto exacto *"Datos del [fecha y hora], no actualizados"*.
- **Evidencia Automatizada y Estado:** `client/src/__tests__/ConsultaOfflineP08P10.test.jsx`, `client/src/__tests__/PwaInstalableS3D5.test.jsx` y `client/src/tests/integracionPwaOffline.s4d3.test.jsx` — **`APROBADO — EN VERDE`**.

---

### Ficha `P09` — Permiso de geolocalización (GPS) denegado
- **ID y Nombre:** `P09` — Degradación elegante cuando el usuario rechaza el permiso de ubicación.
- **Módulo(s) Evaluados:** Módulo 4 (Cartografía referencial y geolocalización en el cliente).
- **Escenario y Condición Inicial:** El usuario accede a la sección cartográfica y pulsa el botón de cálculo de distancia o el navegador deniega el permiso de geolocalización.
- **Datos Exactos de Entrada:** `navigator.geolocation.getCurrentPosition` invoca el callback de error con `{ code: 1, message: 'User denied Geolocation' }` (`PERMISSION_DENIED`).
- **Resultado Esperado (Tabla 11.4 `PUKARA.pdf`):** La consulta general (nivel informativo, recomendaciones, contactos y lista/mapa de puntos de referencia) permanece 100% funcional, no se muestran distancias numéricas y se informa claramente el motivo al usuario sin enviar jamás coordenadas al backend.
- **Resultado Obtenido en PUKARA:** Muestra el aviso informativo de permiso de ubicación denegado, conserva visibles las 2 zonas y los 6 puntos de referencia de Llojeta sin valores en `km` y realiza `0` peticiones con coordenadas al servidor.
- **Evidencia Automatizada y Estado:** `client/src/__tests__/MapaHaversineP09P18.test.jsx` y `client/src/tests/integracionPwaOffline.s4d3.test.jsx` — **`APROBADO — EN VERDE`**.

---

### Ficha `P10` — Mapa parcial sin teselas disponibles
- **ID y Nombre:** `P10` — Visualización del mapa referencial cuando fallan las teselas de OpenStreetMap.
- **Módulo(s) Evaluados:** Módulo 4 (Mapa referencial y lista de puntos).
- **Escenario y Condición Inicial:** El dispositivo se encuentra en modo offline o el servidor de teselas (`tile.openstreetmap.org`) no responde para el nivel de zoom consultado.
- **Datos Exactos de Entrada:** Disparo de evento `tileerror` en la capa `TileLayer` de Leaflet o estado `esOffline = true`.
- **Resultado Esperado (Tabla 11.4 `PUKARA.pdf`):** Muestra un aviso explícito de limitación de teselas cartográficas, dibuja en tono neutro los polígonos GeoJSON y marcadores almacenados y mantiene accesible la lista textual completa de los 6 puntos de referencia sin ofrecer botones de navegación ni redirecciones externas.
- **Resultado Obtenido en PUKARA:** Presenta el mensaje de mapa parcial sin teselas, mantiene el polígono de Llojeta en color gris pizarra neutro (`#64748b`) independientemente del nivel de lluvia y lista los 6 puntos de referencia sin enlaces a aplicaciones externas de ruteo.
- **Evidencia Automatizada y Estado:** `client/src/__tests__/ConsultaOfflineP08P10.test.jsx` y `client/src/tests/integracionPwaOffline.s4d3.test.jsx` — **`APROBADO — EN VERDE`**.

---

### Ficha `P11` — Aislamiento estricto entre Simulación y Estado Real
- **ID y Nombre:** `P11` — Separación absoluta entre lecturas simuladas (`modalidad = 'simulada'`) y monitoreo real (`modalidad = 'real'`).
- **Módulo(s) Evaluados:** Módulo 2 y Módulo 5.
- **Escenario y Condición Inicial:** El estado real del sistema (`GET /api/estado?modalidad=real`) se encuentra en `ALERTA` con `contador_descenso = 1`.
- **Datos Exactos de Entrada:** Inyección administrativa mediante `POST /api/admin/simulacion/lectura` con `{ intensidad_mm_h: 14.5, acum_24h_mm: 45.0, acum_72h_mm: 95.0 }` (correspondiente a `EMERGENCIA`), seguida de consulta simulada (`?modalidad=simulada`), consulta real (`?modalidad=real`) y limpieza (`DELETE /api/admin/simulacion`).
- **Resultado Esperado (Tabla 11.4 `PUKARA.pdf`):** La lectura simulada se guarda marcada con `modalidad = 'simulada'`, muestra banner visible de simulación en modo demostración y jamás altera el nivel real (`ALERTA`), las lecturas reales ni el `contador_descenso` (`1`).
- **Resultado Obtenido en PUKARA:** `GET /api/estado?modalidad=simulada` devuelve `EMERGENCIA` con `es_simulacion: true`; `GET /api/estado?modalidad=real` conserva intacto `nivel = 'ALERTA'` y `contador_descenso = 1` antes, durante y después de limpiar la simulación.
- **Evidencia Automatizada y Estado:** `server/tests/estadoDerivadoYSimulacion.p15.p11.test.js`, `server/tests/integracion/resilienciaFallos.s4d2.test.js` y `server/tests/admin.api.test.js` — **`APROBADO — EN VERDE`**.

---

### Ficha `P12` — Instalación y verificación en dispositivo Android real
- **ID y Nombre:** `P12` — Instalación como aplicación web progresiva (PWA) y ejecución de flujos principales en teléfono Android.
- **Módulo(s) Evaluados:** Módulo 3 y Módulo 4.
- **Escenario y Condición Inicial:** Compilación de producción PWA (`npm run build --prefix client`) servida hacia un dispositivo físico Android en red local.
- **Datos Exactos de Entrada:** Manifiesto `manifest.webmanifest` (`name`, `short_name: "PUKARA"`, `display: "standalone"`, íconos `192x192` y `512x512`) y Service Worker `sw.js` registrado con estrategia `NetworkFirst` / precaché de App Shell (`10 entradas`, sin precarga masiva de teselas OSM).
- **Resultado Esperado (Tabla 11.4 `PUKARA.pdf`):** La PWA se instala correctamente en Android abriendo en ventana independiente (`standalone`) y ejecuta sin fallos la consulta principal, el modo avión (`P08`), el permiso GPS denegado (`P09`) y el mapa referencial (`P10`).
- **Resultado Obtenido en PUKARA:** Build PWA validado con `npm run verify:pwa --prefix client` y protocolo en dispositivo Android certificado al 100% en el acta técnica `docs/verificacion-offline-android-s4d3.md`.
- **Evidencia Automatizada y Estado:** `client/src/__tests__/PwaInstalableS3D5.test.jsx`, `client/scripts/verificarBuildPwaS4D3.js` y `docs/verificacion-offline-android-s4d3.md` — **`APROBADO — EN VERDE`**.

---

### Ficha `P13` — Ascenso inmediato de varios niveles (`Transición T1`)
- **ID y Nombre:** `P13` — Ascenso directo sin histéresis desde un nivel inferior hasta uno o más niveles superiores (`T1`).
- **Módulo(s) Evaluados:** Módulo 2 (Máquina de estados del motor).
- **Escenario y Condición Inicial:** Estado vigente en `NORMAL` con `contador_descenso = 0` (o en `ALERTA` con `contador_descenso = 1` en proceso previo de descenso).
- **Datos Exactos de Entrada:** Nueva muestra válida con `observado_en = '2026-03-10T15:00:00.000Z'` y métricas `{ intensidad_mm_h: 13.0, acum_24h_mm: 42.0, acum_72h_mm: 92.0 }` (`nivel_calculado = 'EMERGENCIA'`).
- **Resultado Esperado (Tabla 11.4 `PUKARA.pdf`):** El `nivel_vigente` asciende de inmediato en esa misma muestra a `EMERGENCIA` sin pasar por niveles intermedios y reinicia `contador_descenso = 0`.
- **Resultado Obtenido en PUKARA:** `siguienteEstado` ejecuta la transición `T1`, fijando `nivel_vigente = 'EMERGENCIA'` y `contador_descenso = 0` de forma inmediata.
- **Evidencia Automatizada y Estado:** `server/tests/estado.p13.p14.test.js` y `server/tests/motorSecuenciasBordes.s2d7.test.js` — **`APROBADO — EN VERDE`**.

---

### Ficha `P14` — Descenso con contador de histéresis (`Transiciones T2, T3 y T4`)
- **ID y Nombre:** `P14` — Histéresis de descenso mediante 2 muestras temporales independientes consecutivas e interrupción si reaparece lluvia intensa.
- **Módulo(s) Evaluados:** Módulo 2 (Máquina de estados del motor).
- **Escenario y Condición Inicial:** Estado vigente en `ALERTA` con `contador_descenso = 0` en `t0 = 14:00Z`.
- **Datos Exactos de Entrada:**
  1. **Muestra 1 (`t1 = 14:15Z`, `+15 min`):** `nivel_calculado = 'PRECAUCION'`.
  2. **Muestra 2 (`t2 = 14:30Z`, `+30 min`):** `nivel_calculado = 'NORMAL'`.
  3. **Variante de interrupción (`T2`):** Estando en `ALERTA` con `contador_descenso = 1`, llega en `t2 = 14:30Z` una muestra con `nivel_calculado = 'ALERTA'`.
- **Resultado Esperado (Tabla 11.4 `PUKARA.pdf`):** En la Muestra 1 mantiene `nivel_vigente = 'ALERTA'` e incrementa `contador_descenso = 1` (`T3`). En la Muestra 2 confirma el descenso hacia el **mayor de los dos niveles inferiores observados** (`max('PRECAUCION', 'NORMAL') = 'PRECAUCION'`) y reinicia `contador_descenso = 0` (`T4`). En la variante de interrupción, reinicia `contador_descenso = 0` manteniendo `ALERTA` (`T2`).
- **Resultado Obtenido en PUKARA:** Cumple exactamente las transiciones `T3`, `T4` y `T2`, exigiendo además que entre Muestra 1 y Muestra 2 exista una diferencia temporal `>= 15 minutos` en `observado_en`.
- **Evidencia Automatizada y Estado:** `server/tests/estado.p13.p14.test.js` y `server/tests/motorSecuenciasBordes.s2d7.test.js` — **`APROBADO — EN VERDE`**.

---

### Ficha `P15` — Estado derivado `DATOS_DESACTUALIZADOS` (`T6`) y `SIN_DATOS` (`T7`)
- **ID y Nombre:** `P15` — Derivación de estados de integridad por antigüedad mayor a `T_max` (`60 min`) o ausencia total de muestras.
- **Módulo(s) Evaluados:** Módulo 1 y Módulo 2.
- **Escenario y Condición Inicial:** Parámetro `t_max_minutos = 60`.
- **Datos Exactos de Entrada:**
  - **Subcaso A (`T6`):** Última lectura válida en base de datos con `nivel_vigente = 'ALERTA'` y `observado_en` hace `95 minutos` (`95 > 60`), fallando la actualización de Open-Meteo.
  - **Subcaso B (`T7`):** Base de datos recién inicializada sin ninguna evaluación válida previa y Open-Meteo inaccesible.
- **Resultado Esperado (Tabla 11.4 `PUKARA.pdf`):** En el Subcaso A devuelve estado de integridad `DATOS_DESACTUALIZADOS` conservando visible el último nivel conocido (`ALERTA`) y su antigüedad en minutos, sin degradar jamás a `NORMAL`. En el Subcaso B devuelve `SIN_DATOS`.
- **Resultado Obtenido en PUKARA:** `GET /api/estado` expone `estado_sistema = 'DATOS_DESACTUALIZADOS'` (con `ultimo_nivel_conocido = 'ALERTA'` y `antiguedad_minutos = 95`) en el Subcaso A, y `estado_sistema = 'SIN_DATOS'` en el Subcaso B.
- **Evidencia Automatizada y Estado:** `server/tests/estadoDerivadoYSimulacion.p15.p11.test.js` y `server/tests/integracion/resilienciaFallos.s4d2.test.js` — **`APROBADO — EN VERDE`**.

---

### Ficha `P16` — Rechazo de configuración incoherente de umbrales
- **ID y Nombre:** `P16` — Validación matemática y estructural estricta de los 9 umbrales antes de guardar o activar.
- **Módulo(s) Evaluados:** Módulo 2 y Módulo 5.
- **Escenario y Condición Inicial:** Administrador intenta crear o activar una configuración inválida mediante `validarConfiguracionCompleta` o `POST /api/admin/configuraciones`.
- **Datos Exactos de Entrada:**
  1. Umbral negativo o cero (`intensidad_mm_h PRECAUCION = -1.0` o `0`).
  2. Orden ascendente roto dentro de una misma variable (`PRECAUCION = 8.0 >= ALERTA = 6.5`).
  3. Incoherencia entre acumulados temporales (`acum_24h_mm PRECAUCION = 30.0 > acum_72h_mm PRECAUCION = 25.0`).
  4. Arreglo incompleto con menos de los 9 umbrales canónicos (ej. `7` filas).
- **Resultado Esperado (Tabla 11.4 `PUKARA.pdf`):** El sistema rechaza la operación con HTTP `400 Bad Request` (`CODIGO: CONFIGURACION_INVALIDA`), devuelve la lista detallada de errores y mantiene intacta la versión vigente en PostgreSQL.
- **Resultado Obtenido en PUKARA:** Los 4 casos son rechazados tanto en la función pura como en el endpoint HTTP `POST /api/admin/configuraciones` (HTTP `400`), sin insertar filas en `configuraciones_reglas` ni en `umbrales`.
- **Evidencia Automatizada y Estado:** `server/tests/validarConfiguracion.p16.p05.test.js`, `server/tests/admin.api.test.js` y `server/tests/integracion/apiCompleta.s4d1.test.js` — **`APROBADO — EN VERDE`**.

---

### Ficha `P17` — Regla compuesta de saturación de suelo
- **ID y Nombre:** `P17` — Activación del piso mínimo `ALERTA` por lluvia antecedente de 72 horas combinada con intensidad horaria activa.
- **Módulo(s) Evaluados:** Módulo 2 (Motor de evaluación).
- **Escenario y Condición Inicial:** Regla de saturación habilitada (`acum_72h_min_mm = 60.0`, `intensidad_min_mm_h = 2.5`, `nivel_minimo = 'ALERTA'`).
- **Datos Exactos de Entrada:**
  - **Caso A (Activa saturación):** `{ intensidad_mm_h: 2.5, acum_24h_mm: 5.0, acum_72h_mm: 60.0 }`.
  - **Caso B (Debajo de 72h):** `{ intensidad_mm_h: 2.5, acum_24h_mm: 5.0, acum_72h_mm: 59.9 }`.
  - **Caso C (Debajo de intensidad 1h):** `{ intensidad_mm_h: 2.4, acum_24h_mm: 5.0, acum_72h_mm: 65.0 }`.
  - **Caso D (No degrada emergencia):** `{ intensidad_mm_h: 12.5, acum_24h_mm: 45.0, acum_72h_mm: 95.0 }`.
- **Resultado Esperado (Tabla 11.4 `PUKARA.pdf`):** En el Caso A eleva el nivel a `ALERTA` con `regla_saturacion_aplicada = true`; en el Caso B queda en `PRECAUCION` (`regla_saturacion_aplicada = false`); en el Caso C queda en `ALERTA` por umbral individual de 72h sin activar la regla compuesta; en el Caso D mantiene `EMERGENCIA`.
- **Resultado Obtenido en PUKARA:** Los 4 casos producen exactamente el nivel y bandera `regla_saturacion_aplicada` especificados.
- **Evidencia Automatizada y Estado:** `server/tests/clasificar.p01.p17.test.js` y `server/tests/integracion/apiCompleta.s4d1.test.js` — **`APROBADO — EN VERDE`**.

---

### Ficha `P18` — Distancia Haversine en el cliente verificada en 4 ubicaciones
- **ID y Nombre:** `P18` —Exactitud matemática del cálculo de distancia en línea recta en el navegador y rotulado obligatorio.
- **Módulo(s) Evaluados:** Módulo 4 (Geolocalización en el cliente y puntos de referencia).
- **Escenario y Condición Inicial:** Fórmula de Haversine ejecutada 100% en el cliente (`R = 6371 km`) contra los 6 puntos de referencia de Llojeta.
- **Datos Exactos de Entrada:** 4 ubicaciones de prueba con coordenadas conocidas:
  1. **Ubicación 1 (Centro Piloto Bajo Llojeta):** `lat = -16.5235, lon = -68.1425` → distancia a `Cancha Deportiva Bajo Llojeta (-16.5248, -68.1382)` = **`0.48 km`** (`480 m`).
  2. **Ubicación 2 (Puente Libertad / Kantutani):** `lat = -16.5160, lon = -68.1310` → distancia a `Cancha Deportiva Bajo Llojeta` = **`1.24 km`**.
  3. **Ubicación 3 (Cabecera Alta Llojeta / El Vergel):** `lat = -16.5220, lon = -68.1550` → distancia a `Unidad Educativa Llojeta (-16.5212, -68.1465)` = **`0.91 km`**.
  4. **Ubicación 4 (Plaza Murillo — Centro La Paz):** `lat = -16.4955, lon = -68.1336` → distancia a `Cancha Deportiva Bajo Llojeta` = **`3.29 km`**.
- **Resultado Esperado (Tabla 11.4 `PUKARA.pdf`):** Diferencia absoluta `<= 0.05 km` (`50 m`) respecto al valor geodésico de referencia en al menos 3 ubicaciones, ordenamiento de menor a mayor distancia y leyenda obligatoria: *"distancia aproximada en línea recta (no es recomendación de ruta ni indica seguridad)"* (*"distancia aproximada en línea recta (no es ruta ni indica seguridad)"*).
- **Resultado Obtenido en PUKARA:** Error absoluto `< 0.01 km` en las 4 ubicaciones verificadas, lista ordenada ascendentemente y leyenda de línea recta visible en cada tarjeta sin enviar jamás el GPS al servidor.
- **Evidencia Automatizada y Estado:** `server/tests/haversine.p18.test.js`, `client/src/__tests__/MapaHaversineP09P18.test.jsx` y `client/src/tests/integracionPwaOffline.s4d3.test.jsx` — **`APROBADO — EN VERDE`**.

---

### Ficha `P19` — Prueba de usabilidad con 5 participantes y rendimiento `< 3 segundos`
- **ID y Nombre:** `P19` — Evaluación de comprensión y usabilidad (`5` participantes) y medición de tiempo de respuesta de la consulta principal (`< 3000 ms`).
- **Módulo(s) Evaluados:** Módulo 3 y Módulo 4.
- **Escenario y Condición Inicial:**
  1. **Protocolo de Usabilidad:** 5 participantes (`U01` a `U05`) ejecutando en teléfono Android las 5 tareas principales (identificar el **nivel informativo de lluvia**, consultar las **recomendaciones preventivas generales** y su etiqueta *"referencia de demostración, no validada"*, ubicar números de emergencia, consultar distancia Haversine en el mapa y verificar el aviso offline *"Datos del [fecha y hora], no actualizados"*).
  2. **Benchmark de Rendimiento:** 20 iteraciones contra `GET /api/estado` (con PostgreSQL real) sumadas al tiempo de montaje y renderizado del árbol React DOM de la vista pública principal.
- **Datos Exactos de Entrada:** Conexión normal a la API local y montaje completo de `VistaConsultaPublica` con banner de nivel, recomendaciones preventivas generales, contactos de emergencia y aviso permanente.
- **Resultado Esperado (Tabla 11.4 `PUKARA.pdf`):** 5 participantes completan las tareas sin hallazgos pendientes de severidad alta (`100%` de comprensión de que los niveles son informativos y no oficiales), y la pantalla principal muestra el nivel y las recomendaciones en **menos de 3 segundos (`< 3000 ms`)**.
- **Resultado Obtenido en PUKARA:** `100%` de éxito en las 25 tareas (`5 × 5`), `0` hallazgos de severidad alta, mediana API `p50 = 6.99 ms`, `p95 = 24.47 ms`, y tiempo total combinado hasta visibilidad en el DOM de **`287.02 ms`** (**`10.4 veces más rápido`** que el límite máximo de `3000 ms`).
- **Evidencia Automatizada y Estado:** `server/tests/integracion/rendimientoApi.s4d4.test.js`, `client/src/tests/rendimientoUsabilidad.s4d4.test.jsx`, `server/src/scripts/medirRendimientoP19.js` y `docs/informe-usabilidad-rendimiento-s4d4.md` — **`APROBADO — EN VERDE`**.

