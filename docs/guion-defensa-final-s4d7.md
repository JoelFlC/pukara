# PUKARA — Guion Cronometrado de Defensa Final en Vivo y Banco de Respuestas ante el Tribunal (`S4D7`)

- **Proyecto:** PUKARA — Aplicación web progresiva (PWA) para consulta de condiciones de lluvias intensas en el sector Llojeta, La Paz
- **Asignatura:** INF-266 Taller de Proyecto — Carrera de Informática, Facultad de Ciencias Puras y Naturales, Universidad Mayor de San Andrés (UMSA)
- **Docente:** Ph.D. Brigida Alexandra Carvajal Blanco
- **Estudiante:** Joel Fernando Flores Choque
- **Gestión:** 2026

> **Aviso Permanente Obligatorio:**
> *"Los niveles Normal, Precaución, Alerta y Emergencia son niveles informativos de lluvia: niveles meteorológicos simulados, calculados con umbrales académicos. No sustituyen alertas ni instrucciones de las autoridades oficiales. PUKARA muestra información bajo consulta y no avisa activamente a la población. Ante una emergencia, atienda las indicaciones oficiales y contacte a los servicios de emergencia."*

---

## 1. Checklist Operativo: 10 Minutos Antes de Entrar a la Defensa

Ejecute esta lista de verificación 10 minutos antes de iniciar la presentación frente al tribunal:

- [ ] **1. Iniciar PostgreSQL local (`pukara-postgres`):**
  ```bash
  docker start pukara-postgres
  ```
- [ ] **2. Ejecutar el script de precalentamiento y respaldo (`pre-defensa`):**
  ```bash
  npm run pre-defensa --prefix server
  ```
  *Verifica las 10 tablas, garantiza que la configuración `version = 1` con los 9 umbrales académicos esté vigente, limpia simulaciones previas, precalienta la lectura real de Llojeta (`< 200 ms`), genera `docs/evidencias/respaldo-estado-defensa.json` e imprime la dirección IP local Wi-Fi.*
- [ ] **3. Levantar Servidor Backend (`:3000`) y Cliente PWA (`:5173 --host`):**
  ```bash
  # Terminal 1 (Backend Express)
  npm start --prefix server

  # Terminal 2 (Cliente PWA expuesto en red local)
  npm run dev --prefix client -- --host
  ```
- [ ] **4. Preparar Navegador en Laptop y Dispositivo Físico Android (Xiaomi POCO X4 Pro 5G):**
  - En la laptop: Abrir Pestaña 1 en `http://localhost:5173/` (Vista Pública) y Pestaña 2 en `http://localhost:5173/admin` (Panel Administrativo con credenciales `admin@pukara.bo` / `PukaraAdmin2026!`).
  - En el teléfono Android (conectado al mismo Wi-Fi / Hotspot local): Abrir `http://<IP_LOCAL_LAPTOP>:5173` y verificar que el ícono instalado de **PUKARA** en la pantalla de inicio abre en modo `standalone` (`P12`) y tiene cargado el último snapshot local.

---

## 2. Guion Cronometrado de Demostración en Vivo (5 Actos — 12 Minutos)

### Acto 1 (2 minutos) — Contexto de Llojeta, Delimitación Ética y Consulta Real en Vivo
1. **Planteamiento del Problema:** Explicar que el sector piloto **Llojeta / Bajo Llojeta** (`latitud -16.5235, longitud -68.1425`) presenta alta susceptibilidad ante lluvias intensas en la cuenca del río Pasajahuira, y que **PUKARA** ofrece una herramienta web progresiva de consulta rápida, resiliente y transparente.
2. **Lectura del Aviso Permanente:** Señalar en la parte superior/inferior de la interfaz Bento Institucional el **Aviso Permanente**, destacando que el sistema calcula un **nivel informativo de lluvia** con umbrales académicos bajo consulta y no sustituye instrucciones de autoridades.
3. **Consulta de Datos Reales (`GET /api/estado`):** Mostrar en vivo la tarjeta meteorológica con los datos reales de Open-Meteo para Llojeta (`intensidad_mm_h`, `acum_24h_mm`, `acum_72h_mm`, hora de observación y estado de calidad `24/24` y `72/72` horas válidas).

---

### Acto 2 (3 minutos) — Demostración del Modo Simulación con los Cuatro Niveles (`P01`, `P06`, `P11`, `P17`)
1. **Activación del Modo Simulación:** Cambiar al selector de demostración académica (donde aparece el banner `DATOS SIMULADOS DE DEMOSTRACIÓN ACADÉMICA`) e inyectar secuencialmente los 4 escenarios:
   - **`NORMAL`** (`0.8 mm/h`, `3.0 mm` en 24h, `8.0 mm` en 72h).
   - **`PRECAUCION`** (`2.5 mm/h` exactos — demostrando en vivo `P01` con comparación `>=`).
   - **`ALERTA` por Regla Compuesta de Saturación (`P17`):** Inyectar `acum_72h_mm = 60.0 mm` e `intensidad_mm_h = 2.5 mm/h` con `acum_24h_mm = 5.0 mm`, mostrando cómo la saturación antecedente de 72 horas combinada con lluvia activa fuerza el ascenso mínimo a `ALERTA`.
   - **`EMERGENCIA`** (`14.0 mm/h`, `46.0 mm` en 24h, `96.0 mm` en 72h — demostrando ascenso inmediato `P13` y el **aviso visual in-app** `P06`).
2. **Etiqueta de Recomendaciones y Aislamiento (`P11`):** Mostrar que en cada cambio de nivel se actualizan las **recomendaciones preventivas generales** con su etiqueta obligatoria *"referencia de demostración, no validada"*, y regresar a la vista **Real** para demostrar que el estado real y su `contador_descenso` jamás fueron alterados (`P11`).

---

### Acto 3 (3 minutos) — Demostración en Dispositivo Físico Android: PWA, Haversine, GPS Denegado y Modo Avión (`P08`, `P09`, `P10`, `P12`, `P18`)
1. **Apertura de PWA Instalada en Android (`P12`):** Mostrar la aplicación corriendo en ventana independiente (`standalone`) en el teléfono Xiaomi POCO X4 Pro 5G.
2. **Cartografía en Tono Neutro y Distancia Haversine (`P18` / `P09`):**
   - Mostrar las 2 zonas poligonales GeoJSON de Llojeta dibujadas en tono neutro (sin colorear por nivel de lluvia) y los 6 puntos de referencia con la leyenda *"referencia de demostración, no validada"*.
   - Mostrar el cálculo 100% en cliente de la *"distancia aproximada en línea recta (no es recomendación de ruta ni indica seguridad)"* (*"distancia aproximada en línea recta (no es ruta ni indica seguridad)"*), y qué ocurre cuando se deniega el permiso de GPS (`P09`: la consulta general sigue operativa sin distancias numéricas y jamás se envía ubicación al servidor).
3. **Corte de Red en Vivo — Modo Avión (`P08` y `P10`):**
   - Activar el **Modo Avión** en el teléfono Android y recargar/abrir la PWA.
   - Mostrar la aparición inmediata del aviso obligatorio: **"Datos del [fecha y hora], no actualizados"** (`P08`), conservando visibles el último nivel informativo de lluvia, las recomendaciones preventivas generales, los contactos de emergencia verificados y la lista de puntos junto al aviso de mapa parcial sin teselas (`P10`).

---

### Acto 4 (2 minutos) — Panel de Administración, Validación `P16`, Versionado `P05` y Bitácora (`P07`)
1. **Autenticación y Seguridad (`P07`):** Ingresar a `/admin` con `admin@pukara.bo` / `PukaraAdmin2026!`.
2. **Candado de Coherencia Matemática (`P16`):** Intentar guardar un umbral donde `PRECAUCION (8.0) >= ALERTA (6.5)` o donde el umbral de `24h` supere al de `72h`, mostrando el rechazo inmediato HTTP `400`.
3. **Versionado Inmutable (`P05`) y Bitácora de Cambios:** Crear una versión válida de umbrales y abrir la pestaña **Bitácora de Cambios** (`bitacora_cambios`), mostrando el registro inmutable con el autor, timestamp UTC y la comparación JSON `valor_anterior` vs. `valor_nuevo`.

---

### Acto 5 (2 minutos) — Certificación de Ingeniería de Software y Escenarios Históricos (2019 y 2024)
1. **Suites Automatizadas y Rendimiento (`P19`):** Mostrar en terminal las **35 suites automatizadas en verde (`303` pruebas)** y el benchmark `npm run verify:p19 --prefix server` (`287 ms < 3000 ms`).
2. **Escenarios Históricos de Referencia (Sección 11.3):** Mostrar la salida de `npm run verify:s4d5 --prefix server` sobre las series históricas de **abril de 2019** (`PRECAUCION`) y **noviembre de 2024** (`ALERTA`) en Llojeta, destacando la declaración científica de la Sección 11.3 y que los 9 umbrales académicos `v1` permanecen inmutables.

---

## 3. Banco de Respuestas Técnicas ante Preguntas del Tribunal (8 Preguntas Clave)

### Pregunta 1: *¿Por qué los umbrales del sistema son académicos y no se declara una validación meteorológica o geotécnica real?*
- **Respuesta Técnica (Sección 11.2 de `PUKARA.pdf`):** En ingeniería de software aplicada a sistemas socio-técnicos, es indispensable distinguir entre la **verificación del software** (demostrar que el motor evalúa sin defectos las reglas matemáticas, histéresis, estados de integridad y modo offline, lo cual está cubierto al 100% por `P01`–`P19`) y la **validación hidrometeorológica/geotécnica de campo**, la cual requiere series pluviográficas locales multianuales en la microcuenca del río Pasajahuira, piezometría de taludes y competencia legal del SENAMHI y del GAMLP. Por responsabilidad ética y operacional, PUKARA declara sus umbrales como académicos (`2.5/6.5/12`, `10/25/40`, `25/60/90`) y muestra permanentemente su alcance informativo.

### Pregunta 2: *¿Qué ocurrió al ejecutar el motor con los datos históricos de los eventos reales de abril de 2019 y noviembre de 2024 en Llojeta?*
- **Respuesta Técnica (Sección 11.3 de `PUKARA.pdf`):** Al evaluar las series de 96 horas de Open-Meteo Archive (modelo de reanálisis ERA5-Land) con los umbrales `v1`, el motor clasificó **abril de 2019** en **`PRECAUCION`** (`pico 1h = 2.8 mm/h`, `72h = 36.8 mm`) y **noviembre de 2024** en **`ALERTA`** (`pico 1h = 6.8 mm/h`, `24h = 31.8 mm`, `72h = 53.8 mm`). Tal como documenta la Sección 11.3, esto confirma dos hechos científicos: (1) el reanálisis satelital/numérico tiene una malla gruesa de `~9 km` que suaviza núcleos convectivos puntuales de quebrada, y (2) ambos desastres involucraron factores antropogénicos y geotécnicos ajenos a la lluvia (rellenos sanitarios antiguos en Kantutani 2019 y movimientos de tierra en cabecera de cuenca en Bajo Llojeta 2024). Conforme al diseño, estos resultados se documentan como escenario de referencia y **no se usan para ajustar los umbrales `v1`**.

### Pregunta 3: *¿Cómo evita el motor de PUKARA que el nivel informativo oscile bruscamente cuando la lluvia sube y baja cerca de un límite?*
- **Respuesta Técnica (Sección 9.6 — Máquina de Estados `T1`–`T7`, `P13` y `P14`):** El motor implementa una máquina de estados asimétrica con **histéresis de descenso**:
  - **Ascenso inmediato (`T1` / `P13`):** Por principio precautorio, si una muestra válida alcanza o supera (`>=`) el umbral de un nivel superior, el `nivel_vigente` sube de inmediato en esa misma muestra y reinicia `contador_descenso = 0`.
  - **Descenso amortiguado (`T3` y `T4` / `P14`):** Para bajar de nivel se exigen **2 muestras consecutivas e independientes en el tiempo** (`observado_en` separadas por al menos `15 minutos`, descartando consultas repetidas de caché `P04`). Además, al completarse la segunda muestra inferior, el sistema desciende hacia **el mayor de los dos niveles inferiores observados** (por ejemplo, si estando en `ALERTA` recibe `PRECAUCION` y luego `NORMAL`, desciende primero a `PRECAUCION`, nunca de golpe a `NORMAL`).

### Pregunta 4: *¿Qué sucede si la API de Open-Meteo se cae o entrega horas con valores nulos? ¿El sistema vuelve a nivel Normal?*
- **Respuesta Técnica (`P02`, `P03`, `P15`, Transiciones `T5`, `T6`, `T7`):** **Jamás se degrada a `NORMAL` por falta de datos ni se asume `0 mm` ante valores nulos:**
  - Si una serie horaria trae valores `null` (`P02`), la ventana afectada (`24h` o `72h`) se marca como incompleta (`null`) y el motor clasifica con las variables válidas restantes (`clasificacion_parcial = true`), o declara la muestra `invalida` si ninguna de las tres está completa.
  - Si Open-Meteo no responde (`P03` / `T5`), se conserva el último estado válido y el `contador_descenso` sin cambios.
  - Si la antigüedad de la última lectura supera `t_max_minutos = 60` (`P15` / `T6`), el sistema deriva el estado de primer orden **`DATOS_DESACTUALIZADOS`**, mostrando explícitamente el último nivel conocido junto con los minutos de antigüedad.

### Pregunta 5: *¿Por qué en modo avión no se precargan todas las teselas del mapa de La Paz para tener zoom ilimitado sin conexión?*
- **Respuesta Técnica (Sección 9.4 y `P10`):** La política de uso de los servidores gratuitos de OpenStreetMap (`tile.openstreetmap.org`) prohíbe expresamente la descarga masiva automatizada (*bulk tile scraping*) desde aplicaciones cliente, pudiendo ocasionar el bloqueo por IP del servicio. Por ello, PUKARA almacena localmente en `localStorage` los polígonos GeoJSON de las 2 zonas y las coordenadas de los 6 puntos de referencia de Llojeta: si faltan teselas (`P10`), el usuario sigue viendo los polígonos en tono neutro, su lista completa de puntos de referencia y el cálculo local de distancia Haversine.

### Pregunta 6: *¿Por qué almacenaron las geometrías como `JSONB` nativo en PostgreSQL en lugar de instalar la extensión PostGIS?*
- **Respuesta Técnica (Secciones 9.3 y 9.5):** En **PUKARA**, los polígonos de las zonas de referencia se entregan íntegros en formato estándar RFC 7946 GeoJSON para su renderizado en Leaflet, y el único cálculo métrico requerido es la distancia en línea recta desde el usuario hasta los 6 puntos de referencia, el cual se ejecuta **100% en el navegador móvil mediante la fórmula esférica de Haversine** (`P18`). Al no requerirse intersecciones espaciales pesadas en base de datos, el tipo nativo `JSONB` de PostgreSQL elimina la dependencia de PostGIS, simplifica el despliegue en contenedores ligeros y mantiene latencias de consulta de `~7 ms` (`P19`).

### Pregunta 7: *¿Cómo garantiza PUKARA la privacidad de la ubicación GPS de los vecinos que consultan la aplicación?*
- **Respuesta Técnica (Sección 6.4, `P09` y `P18`):** La ubicación obtenida mediante `navigator.geolocation.getCurrentPosition` se procesa exclusivamente en la memoria volátil del navegador del teléfono para ejecutar `calcularDistanciaHaversineKm()` contra los puntos ya descargados. No existe ningún endpoint ni columna en las 10 tablas de PostgreSQL que reciba o almacene coordenadas del usuario (verificado por el control de seguridad `S5-RATE-GPS`), y si el ciudadano rechaza el permiso (`P09`), toda la consulta general continúa funcionando sin restricciones.

### Pregunta 8: *Si un administrador modifica los umbrales en el panel administrativo, ¿se alteran o recalculan las evaluaciones históricas pasadas?*
- **Respuesta Técnica (Sección 9.5 y `P05`):** No. La tabla `configuraciones_reglas` implementa un esquema de **versionado inmutable**: cada modificación crea una nueva fila con `version = N + 1`, archiva la versión anterior (`estado = 'archivada'`), reinicia el `contador_descenso = 0` para las evaluaciones futuras y registra el cambio en `bitacora_cambios`. Cada registro en `evaluaciones_nivel` posee una clave foránea inmutable `configuracion_id` que apunta exactamente a la versión de reglas con la que fue calculado en su momento.
