# Acta de Verificación Offline, Permisos GPS, Cartografía Parcial y PWA en Dispositivo Android (`S4D3`)

**Proyecto:** PUKARA — Sistema Web/PWA de Monitoreo Pluviométrico y Consulta de Niveles Informativos de Lluvia (Sector Piloto Llojeta / Bajo Llojeta, La Paz)  
**Asignatura:** Taller de Licenciatura I (INF-266) — Universidad Mayor de San Andrés (UMSA)  
**Fase:** Semana 4 — Día 3 (`S4D3`: Verificación de `P06`, `P08`, `P09`, `P10`, `P12` y `P18`)  
**Rama de Ejecución:** `test/offline-permisos-android-s4d3` (fusionada en `main`)

---

## 1. Configuración del Entorno de Prueba Móvil en Dispositivo Físico Android

Para validar la experiencia real de usuario e instalabilidad PWA sin requerir dominio comercial externo, se configuró el entorno en red de área local (Wi-Fi LAN):

- **Dispositivo Móvil de Prueba:** Xiaomi POCO X4 Pro 5G (Android 13 / MIUI, resolución `1080 x 2400 px`, densidad `~395 ppi`).
- **Navegador Móvil:** Google Chrome para Android (soporte nativo de `ServiceWorker`, `CacheStorage`, `Web App Manifest` y `navigator.geolocation`).
- **Servidor Backend (`/server`):** Node.js ESM + Express en el puerto `:3000` conectado al contenedor Docker `pukara-postgres` (PostgreSQL 16).
- **Servidor Frontend / PWA (`/client`):** Vite expuesto en la interfaz de red local con el flag `--host` en el puerto `:5173` (desarrollo) y `:4173` (`vite preview` tras `npm run build`), redirigiendo internamente todas las peticiones `/api/*` hacia `http://127.0.0.1:3000` mediante el proxy configurado en `client/vite.config.js`.
- **Artefactos de Verificación Automatizada:**
  - Suite de integración frontend: `client/src/tests/integracionPwaOffline.s4d3.test.jsx`
  - Auditor de artefactos PWA de producción: `client/scripts/verificarBuildPwaS4D3.js` (`npm run verify:pwa --prefix client`)
  - Directorio de capturas Android: `docs/evidencias/s4d3-android/`

---

## 2. Matriz de Resultados de las Pruebas Académicas (`P06`, `P08`, `P09`, `P10`, `P12`)

| Código | Nombre de la Prueba | Escenario Ejecutado | Resultado Obtenido | Estado |
| :---: | :--- | :--- | :--- | :---: |
| **`P06`** | **Aviso visual in-app ante cambio de nivel** | Con la vista principal abierta en `PRECAUCION`, se actualiza el estado hacia `ALERTA`. | Se despliega el componente `<AvisoCambioNivelInApp/>` (`data-testid="aviso-cambio-nivel-inapp"`, `role="status"`, `aria-live="polite"`), se actualizan las `recomendaciones preventivas generales` al nivel `ALERTA` y se informa explícitamente que es un aviso visual dentro de la aplicación (sin Web Push ni notificaciones en segundo plano). | **[PASS]** |
| **`P08`** | **Modo Avión / Consulta sin conexión** | Primera consulta exitosa en línea (`navigator.onLine = true`) seguida de activación del **Modo Avión** (`navigator.onLine = false` y fallo de red). | El sistema recupera desde `offlineStorage` (`localStorage`) y `CacheStorage` el último `nivel informativo de lluvia` conocido, las recomendaciones preventivas, los contactos de emergencia (`114`, `119`, `160`) y los 6 puntos de referencia, mostrando de forma destacada `"Datos del [fecha y hora], no actualizados"` junto al `<AvisoPermanente/>`. | **[PASS]** |
| **`P09`** | **Permiso de ubicación GPS denegado y privacidad** | Al pulsar `"Calcular distancia aproximada desde mi ubicación"`, se rechaza el permiso en el diálogo de Android (`error.code = 1`, `PERMISSION_DENIED`). | Se muestra el aviso `data-testid="aviso-gps-denegado"` explicando el motivo, no se renderizan distancias numéricas, la consulta general (nivel informativo, recomendaciones, contactos y listado de puntos) opera al 100% y se certifica con espías de red que **ninguna coordenada GPS del usuario se envía al servidor**. | **[PASS]** |
| **`P10`** | **Mapa parcial sin teselas en desconexión** | Navegación cartográfica en Modo Avión o ante evento `tileerror` de OpenStreetMap. | Se despliega el aviso `data-testid="aviso-mapa-parcial"` indicando la limitación de teselas y la prohibición de precarga masiva de `tile.openstreetmap.org`. Permanece 100% accesible el listado textual de las 2 zonas (en color neutro `#475569`) y los 6 puntos de referencia con la leyenda `"referencia de demostración, no validada"`, sin enlaces de navegación externa. | **[PASS]** |
| **`P12`** | **Instalación y flujos principales PWA en Android** | Generación de producción (`npm run build`), auditoría de `dist/` (`npm run verify:pwa`) e instalación en pantalla de inicio en el Xiaomi POCO X4 Pro 5G. | `manifest.webmanifest` válido con `display: "standalone"`, `short_name: "PUKARA"`, íconos PNG reales (`192x192`, `512x512`, `maskable`) con firma binaria `89 50 4E 47` y `sw.js` con `NetworkFirst` (`/api/estado`) y `StaleWhileRevalidate` (contenidos). | **[PASS]** |

---

## 3. Verificación Matemática de Distancia Haversine en el Cliente (`P18`)

El cálculo de proximidad se ejecuta 100% en el navegador móvil mediante `distanciaHaversine` (`client/src/utils/haversine.js`) utilizando el radio medio terrestre $R = 6371\text{ km}$ hacia la coordenada central del sector piloto Llojeta (`lat: -16.5235, lon: -68.1425`):

| # | Ubicación de Prueba (Entorno La Paz / El Alto) | Coordenada Origen (`lat, lon`) | Coordenada Destino (`lat, lon`) | Distancia Haversine Calculada | Tolerancia Máxima | Leyenda Obligatoria Mostrada en UI | Estado |
| :-: | :--- | :---: | :---: | :---: | :---: | :--- | :---: |
| **1** | **Punto Central Sector Llojeta** (Coordenada idéntica) | `-16.5235, -68.1425` | `-16.5235, -68.1425` | **`0.000 km`** (`0 m`) | `< 0.001 km` | `"distancia aproximada en línea recta (no es recomendación de ruta ni indica seguridad)"` | **[PASS]** |
| **2** | **Sector Bajo Llojeta / Av. Costanera** (Cruce Los Sargentos) | `-16.5280, -68.1380` | `-16.5235, -68.1425` | **`0.693 km`** (`693 m`) | `± 0.05 km` | `"distancia aproximada en línea recta (no es recomendación de ruta ni indica seguridad)"` | **[PASS]** |
| **3** | **Plaza Murillo / Centro Histórico de La Paz** | `-16.4957, -68.1335` | `-16.5235, -68.1425` | **`3.236 km`** (`3.24 km`) | `± 0.05 km` | `"distancia aproximada en línea recta (no es recomendación de ruta ni indica seguridad)"` | **[PASS]** |
| **4** | **Ceja de El Alto** | `-16.5048, -68.1624` | `-16.5235, -68.1425` | **`2.970 km`** (`2.97 km`) | `± 0.05 km` | `"distancia aproximada en línea recta (no es recomendación de ruta ni indica seguridad)"` | **[PASS]** |

---

## 4. Guía Rápida de 5 Pasos para Demostración en Vivo del Modo Avión en Android (Defensa Final)

1. **Paso 1 — Conexión inicial y carga en línea:** Con el portátil y el Xiaomi POCO X4 Pro 5G en la misma red Wi-Fi, abrir la aplicación PUKARA instalada en el teléfono y verificar que el indicador superior muestre **"En línea"** con el `nivel informativo de lluvia` vigente y el `<AvisoPermanente/>`.
2. **Paso 2 — Verificación de permisos GPS (`P09` / `P18`):** Desplazarse a la sección del mapa referencial, pulsar el botón de cálculo de distancia desde el dispositivo y mostrar tanto el caso con permiso denegado (`P09`, sin distancias y con explicación clara) como el cálculo local Haversine (`P18`, con la leyenda *"distancia aproximada en línea recta (no es recomendación de ruta ni indica seguridad)"*).
3. **Paso 3 — Activación del Modo Avión (`P08`):** Deslizar el centro de control de Android y activar el **Modo Avión** (cortando Wi-Fi y datos móviles). Observar cómo la interfaz detecta instantáneamente el evento `offline` y despliega el banner ámbar `"Datos del [fecha y hora], no actualizados"`.
4. **Paso 4 — Recarga completa sin red y Mapa Parcial (`P08` + `P10`):** Recargar la aplicación (o cerrarla y volver a abrirla desde el ícono instalado en Android). Demostrar ante el tribunal que el App Shell abre de inmediato gracias al Service Worker, conservando el último nivel conocido, las recomendaciones preventivas generales, los contactos de emergencia con marcado `tel:` y el aviso de cartografía parcial (`P10`) junto con la lista de los 6 puntos rotulados como `"referencia de demostración, no validada"`.
5. **Paso 5 — Desactivación del Modo Avión y sincronización automática:** Desactivar el Modo Avión en el teléfono o pulsar **"Reintentar conexión"**, verificando que el banner offline desaparece automáticamente al restablecerse la comunicación con `GET /api/estado`.

