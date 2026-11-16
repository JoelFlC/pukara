# PUKARA — Plan Maestro de Implementación Segura del Rediseño Visual (*Swiss Grid + Claymorphism + Scrollytelling*)

- **Proyecto:** PUKARA — Aplicación Web Progresiva (PWA) para Consulta de Condiciones de Lluvias Intensas en el Sector Llojeta, La Paz (INF-266 UMSA)
- **Rama de Trabajo:** `feat/rediseño-swiss-clay-ui`
- **Meta de Calidad Innegociable:** **0 regresiones funcionales — Las 35 suites automatizadas (`303` pruebas: `25` suites en `/server` + `10` suites en `/client`) deben permanecer al 100% en verde.**

> **Aviso Permanente Obligatorio:**
> *"Los niveles Normal, Precaución, Alerta y Emergencia son niveles informativos de lluvia: niveles meteorológicos simulados, calculados con umbrales académicos. No sustituyen alertas ni instrucciones de las autoridades oficiales. PUKARA muestra información bajo consulta y no avisa activamente a la población. Ante una emergencia, atienda las indicaciones oficiales y contacte a los servicios de emergencia."*

---

## 1. Estrategia de Evolución Visual con Riesgo Cero (*Zero-Breakage Strategy*)

Tras inspeccionar los 15 componentes de `client/src/components/`, las páginas de `client/src/pages/` y las 10 suites de prueba de `/client` (`70` tests), se constató que las pruebas evalúan los componentes mediante:
1. **Selectores explícitos `data-testid` y atributos ARIA** (`role="status"`, `role="alert"`, `role="region"`, `aria-live="polite"`).
2. **Subcadenas exactas de la Lista Blanca** (en `renderToStaticMarkup`), verificación de enlaces `href="tel:..."`, atribución a `OpenStreetMap` y la constante exportada `ESTILO_ZONA_NEUTRO` (`color: '#475569'`, `fillColor: '#64748b'`).
3. **Auditorías estáticas y dinámicas contra la Lista Negra** (`puerta_semana1.test.js`, `puerta_semana3.test.js` y `PuertaSemana3UI.test.jsx`), que escanean tanto el HTML renderizado como el código fuente de `client/src/` para asegurar 0 ocurrencias de frases prohibidas.

Por lo tanto, el rediseño visual transforma la **estructura de retícula Suiza (12 columnas), la tipografía (`Plus Jakarta Sans` + `Inter` con mínimo de `16px` para adultos mayores), los contenedores `.clay-card` / `.clay-pill` / `.clay-btn-*` y la narrativa *Scrollytelling* por capítulos**, preservando intactos el 100% de las firmas de props, funciones exportadas, `data-testid` y textos reglamentarios.

---

## 2. Plan de Ejecución en 4 Fases Controladas

### Fase 1: Base Tipográfica, Tokens CSS y Clases Utilitarias Claymórficas
**Archivos a intervenir:**
1. **`client/index.html`:**
   - Incorporar la carga optimizada de Google Fonts para `Plus Jakarta Sans` (`600`, `700`, `800`) e `Inter` (`400`, `500`, `600`) con `display=swap` (sin bloquear el renderizado ni afectar el presupuesto de `P19 < 3000 ms`).
   - Ajustar las clases base del `<body>` al lienzo cálido antirreflejo `#F6F8FA` y tinta `#111C2D`.
2. **`client/src/index.css`:**
   - Definir las variables CSS del sistema (`--bg-canvas`, `--surface-clay`, `--ink-primary`, `--primary-civic` y tokens semánticos Pastel Clay para `NORMAL`, `PRECAUCION`, `ALERTA` y `EMERGENCIA`).
   - Implementar las clases utilitarias `.clay-card`, `.clay-card-sm`, `.clay-pill`, `.clay-btn-primary`, `.clay-btn-secondary`, `.clay-btn-danger`, `.clay-input`, `.swiss-chapter-badge` y `.telemetry-num`.
3. **Verificación de Fase 1:** Ejecutar `npm test --prefix client` y `npm run build --prefix client`.

---

### Fase 2: Rediseño *Scrollytelling* de la Página Principal (`/`) y Componentes Públicos
**Archivos a intervenir:**
1. **`client/src/components/AvisoPermanente.jsx`:**
   - Estilizar como banda institucional `.clay-card` con acento izquierdo `#3525CD`, tipografía `body-md` (`16px`) de alto contraste AAA y `data-testid="aviso-permanente"` intacto (sin botón de cierre).
2. **`client/src/components/EstadoPwaBanner.jsx`, `BannerModoOffline.jsx`, `BannerModoSimulacion.jsx` y `AvisoCambioNivelInApp.jsx`:**
   - Aplicar superficies `.clay-card`, píldoras `.clay-pill` y botones táctiles de `48px`–`52px` con micro-compresión `:active`, preservando todos los `data-testid` (`banner-instalacion-pwa`, `btn-instalar-pwa`, `banner-datos-no-actualizados`, `aviso-datos-offline`, `btn-reintentar-conexion`, `aviso-cambio-nivel-inapp`) y textos obligatorios.
3. **`client/src/components/BannerNivelInformativo.jsx`:**
   - Transformar en la tarjeta **Hero Diagnóstico Suizo + Clay** con los pasteles semánticos (`Mint Clay` para `NORMAL`, `Butter Yellow Clay` para `PRECAUCION`, `Soft Peach Clay` para `ALERTA`, `Soft Coral Clay` para `EMERGENCIA`), titular `display-hero` / `headline-lg`, barra Clay de saturación 72h / 60mm y simulador rápido en 1 clic con botones de `48px`.
4. **`client/src/components/TarjetaLecturaMeteorologica.jsx`:**
   - Destacar las 3 variables pluviométricas rectoras (`Intensidad (1h)`, `Acumulado 24h`, `Acumulado 72h`) con cifras `telemetry-num` (`44px`, `tabular-nums`) en tarjetas `.clay-card` amplias y agrupar de forma limpia las 3 variables atmosféricas (`Temperatura`, `Humedad`, `Viento (10m)`), manteniendo intacto el manejo de `SIN DATOS METEOROLÓGICOS REGISTRADOS` y `Acumulado incompleto (X/24 h)` sin asumir `0 mm`.
5. **`client/src/components/SeccionRecomendaciones.jsx` y `RecomendacionesNivelVigente.jsx` (Capítulo 01 — Guía Preventiva):**
   - Incorporar encabezado suizo `01 CAPÍTULO UNO — GUÍA PREVENTIVA`, tarjeta principal del nivel vigente con lectura en `18px` (`body-lg`) para adultos mayores y grilla comparativa de las 4 tarjetas Clay (`NORMAL`, `PRECAUCION`, `ALERTA`, `EMERGENCIA`) con sus etiquetas de origen (`Origen: Institucional verificada` / `Origen: Demostración (contenido académico)`).
6. **`client/src/components/MapaReferencial.jsx` (Capítulo 02 — Cartografía de Referencia):**
   - Incorporar encabezado suizo `02 CAPÍTULO DOS — CARTOGRAFÍA DE REFERENCIA`, vista dividida de 12 columnas con contenedor `.clay-card` para Leaflet, `ESTILO_ZONA_NEUTRO` inalterado (`#475569` / `#64748b`), botón GPS de `50px` (`data-testid="btn-solicitar-ubicacion"`) y tarjetas Clay para las 2 zonas y 6 puntos con `data-testid="distancia-haversine"`.
7. **`client/src/components/SeccionContactosEmergencia.jsx`, `HistorialEvaluaciones.jsx` y `ResumenZonaPiloto.jsx` (Capítulo 03 — Asistencia Oficial y Trazabilidad):**
   - Incorporar encabezado suizo `03 CAPÍTULO TRES — ASISTENCIA OFICIAL`, tarjetas Clay de llamada rápida con números en `telemetry-num` y botones `href="tel:..."` de `54px` de altura para adultos mayores.
8. **`client/src/pages/InicioPage.jsx`:**
   - Orquestar la secuencia *Scrollytelling* sobre la retícula Suiza (`max-w-[1200px]`), incorporando en el Hero derecho la **Escala Interactiva de los 4 Niveles Informativos de Lluvia** junto al ámbito espacial de Llojeta, navegación superior con píldoras por capítulos y barra inferior móvil ergonómica.
9. **Verificación de Fase 2:** Ejecutar las 10 suites de `/client` (`npm test --prefix client`) y verificar que las 70 pruebas pasen en verde.

---

### Fase 3: Rediseño Coherente del Login y Consola de Administración (`/admin`)
**Archivos a intervenir:**
1. **`client/src/components/AdminLogin.jsx`:**
   - Aplicar tarjeta central `.clay-card` sobre lienzo `#F6F8FA`, campos `.clay-input` de `48px+`, etiquetas de `14px`–`16px`, botón `.clay-btn-primary` (`#3525CD`) de `52px` e integración limpia de `<AvisoPermanente/>`.
2. **`client/src/components/PanelAdministracion.jsx`:**
   - Aplicar cabecera institucional Suiza, navegación de las 6 secciones mediante píldoras Clay activas (`1. Umbrales y Reglas (P05/P16)`, `2. Textos Preventivos`, `3. Contactos de Emergencia`, `4. Capas y Referencias`, `5. Modo Demostración`, `6. Bitácora de Cambios`), formularios con `.clay-input` y tablas legibles de alto contraste.
3. **Verificación de Fase 3:** Ejecutar `npm test --prefix client` (específicamente `PanelAdmin.test.jsx` y `PuertaSemana3UI.test.jsx`).

---

### Fase 4: Certificación Integral de Regresión, Rendimiento (`P19 < 3s`) y PWA
1. Ejecutar las **10 suites de `/client` (`70` pruebas)** y las **25 suites de `/server` (`233` pruebas)** = **`35` suites / `303` pruebas en verde**.
2. Ejecutar `npm run build --prefix client` y `npm run verify:pwa --prefix client` (`7/7 [PASS]`).
3. Ejecutar `npm run verify:p19 --prefix server` (`< 3000 ms`) y `npm run verify:evidencias --prefix server` (`5/5 [PASS]`).

---

## 3. Matriz de Trazabilidad Componente × Tests (Garantía de 0 Regresiones)

| Componente en `client/src/` | Suites de Prueba que lo Evalúan | `data-testid`, Roles, Exportaciones y Textos Inmutables que se Preservan |
| :--- | :--- | :--- |
| **`AvisoPermanente.jsx`** | `inicio.test.jsx`, `esqueleto.s2d6.test.jsx`, `PanelAdmin.test.jsx`, `PuertaSemana3UI.test.jsx`, `ConsultaOfflineP08P10.test.jsx`, `integracionPwaOffline.s4d3.test.jsx`, `rendimientoUsabilidad.s4d4.test.jsx` | `data-testid="aviso-permanente"`, título `Aviso Permanente Institucional`, texto canónico íntegro, **prohibido** incluir etiquetas `<button>`, `Cerrar` o `×`. |
| **`BannerNivelInformativo.jsx`** | `inicio.test.jsx`, `esqueleto.s2d6.test.jsx`, `PuertaSemana3UI.test.jsx`, `ConsultaOfflineP08P10.test.jsx`, `integracionPwaOffline.s4d3.test.jsx`, `rendimientoUsabilidad.s4d4.test.jsx` | Títulos `Nivel informativo de lluvia: NORMAL \| PRECAUCIÓN \| ALERTA \| EMERGENCIA`, `Estado: SIN DATOS METEOROLÓGICOS VÁLIDOS`, `DATOS DESACTUALIZADOS (supera el límite de vigencia T_max)`, `Último nivel informativo conocido`, `Regla de saturación aplicada`, `Clasificación parcial: una o más ventanas de acumulación (24h/72h) tienen horas faltantes y fueron excluidas del cálculo.`, `Versión de configuración: v`, `Histéresis (contador descenso):`, `Antigüedad:`. |
| **`TarjetaLecturaMeteorologica.jsx`** | `inicio.test.jsx`, `esqueleto.s2d6.test.jsx`, `PuertaSemana3UI.test.jsx`, `integracionPwaOffline.s4d3.test.jsx`, `rendimientoUsabilidad.s4d4.test.jsx` | `Estado: SIN DATOS METEOROLÓGICOS REGISTRADOS`, `Acumulado incompleto (`, `/24 h)`, `/72 h)`, `horas válidas`, `Nota de calidad de datos:`, unidades `mm/h`, `mm`, `°C`, `%`, `km/h` y prohibición de mostrar `0 mm` cuando el acumulado es `null`. |
| **`BannerModoSimulacion.jsx`** | `inicio.test.jsx`, `esqueleto.s2d6.test.jsx`, `rendimientoUsabilidad.s4d4.test.jsx` | Exportación `ESCENARIOS_DEMOSTRACION`, botones `Datos Reales (Open-Meteo)` y `Modo Simulación (Demostración)`, texto `MODO SIMULACIÓN ACADÉMICA ACTIVO — Los datos y el nivel mostrados son simulados para demostración y NO alteran el estado meteorológico real.`, botones `Simular Normal`, `Simular Precaución`, `Simular Alerta`, `Simular Emergencia`, `Limpiar Simulación`. |
| **`SeccionRecomendaciones.jsx`** y **`RecomendacionesNivelVigente.jsx`** | `inicio.test.jsx`, `esqueleto.s2d6.test.jsx`, `RecomendacionesAvisoP06.test.jsx`, `PuertaSemana3UI.test.jsx`, `ConsultaOfflineP08P10.test.jsx`, `integracionPwaOffline.s4d3.test.jsx`, `rendimientoUsabilidad.s4d4.test.jsx` | `Recomendaciones Preventivas para ${nivel}`, badges `Origen: Institucional verificada` y `Origen: Demostración (contenido académico)` (y `institucional_verificada` / `demostracion` en `RecomendacionesNivelVigente`), `Versión: v`, pie `Recomendaciones preventivas generales de carácter informativo. El sistema no emite instrucciones de desplazamiento ni sustituye a las autoridades competentes.`. |
| **`SeccionContactosEmergencia.jsx`** | `RecomendacionesAvisoP06.test.jsx`, `PuertaSemana3UI.test.jsx`, `ConsultaOfflineP08P10.test.jsx`, `integracionPwaOffline.s4d3.test.jsx`, `rendimientoUsabilidad.s4d4.test.jsx` | `Contactos de Emergencia — La Paz / Cotahuma`, enlaces `href="tel:${contacto.telefono}"`, `Verificado el:`, `Verificación documental pendiente con fuente oficial`, y aviso `Ante una emergencia real en el sector Llojeta / Bajo Llojeta, comuníquese directamente con los servicios oficiales de emergencia.`. |
| **`AvisoCambioNivelInApp.jsx`** | `RecomendacionesAvisoP06.test.jsx`, `PuertaSemana3UI.test.jsx`, `integracionPwaOffline.s4d3.test.jsx`, `rendimientoUsabilidad.s4d4.test.jsx` | `data-testid="aviso-cambio-nivel-inapp"`, `role="status"`, `aria-live="polite"`, `Cambio en el nivel informativo de lluvia: de ${nivelAnterior} a ${nivelNuevo}`, nota `Aviso visual dentro de la aplicación (solo mientras la aplicación permanece abierta; no es una notificación remota ni sustituye canales oficiales).` y botón `Entendido / Cerrar aviso`. |
| **`BannerModoOffline.jsx`** | `PuertaSemana3UI.test.jsx`, `ConsultaOfflineP08P10.test.jsx`, `integracionPwaOffline.s4d3.test.jsx` | `data-testid="banner-datos-no-actualizados"`, `data-testid="aviso-datos-offline"`, `data-testid="btn-reintentar-conexion"`, `role="status"`, `aria-live="polite"`, `Consulta con Conectividad Limitada`, `Modo sin conexión o conectividad limitada` y texto `Datos del [fecha y hora], no actualizados`. |
| **`EstadoPwaBanner.jsx`** | `PwaInstalableS3D5.test.jsx`, `PuertaSemana3UI.test.jsx`, `integracionPwaOffline.s4d3.test.jsx` | `data-testid="banner-instalacion-pwa"`, `data-testid="btn-instalar-pwa"`, `Instalar PUKARA en este dispositivo`, `Instalar aplicación PWA para consulta sin conexión`. |
| **`MapaReferencial.jsx`** | `MapaHaversineP09P18.test.jsx`, `ConsultaOfflineP08P10.test.jsx`, `PuertaSemana3UI.test.jsx`, `integracionPwaOffline.s4d3.test.jsx`, `rendimientoUsabilidad.s4d4.test.jsx` | Exportaciones `ESTILO_ZONA_NEUTRO` (`color: '#475569'`, `fillColor: '#64748b'`), `manejarExitoGeolocalizacion`, `manejarErrorGeolocalizacion`; `data-testid`s: `nota-indicador-global`, `aviso-mapa-parcial`, `mapa-leaflet-contenedor`, `btn-solicitar-ubicacion`, `btn-ocultar-ubicacion`, `aviso-gps-denegado`, `aviso-gps-concedido`, `seccion-zonas-referencia`, `tarjeta-zona`, `seccion-puntos-referencia`, `tarjeta-punto`, `distancia-haversine`; textos de política OSM, GPS denegado y leyenda Haversine. |
| **`AdminLogin.jsx`** y **`PanelAdministracion.jsx`** | `PanelAdmin.test.jsx`, `PuertaSemana3UI.test.jsx` | `Acceso Administrativo`, `Correo Institucional`, `Contraseña`, `Iniciar Sesión`, `Volver a la Consulta Pública`, `Panel de Administración PUKARA`, `Cerrar sesión`, las 6 pestañas (`1. Umbrales y Reglas (P05/P16)` a `6. Bitácora de Cambios`) y `<AvisoPermanente/>`. |
