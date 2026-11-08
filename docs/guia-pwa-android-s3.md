# PUKARA — Guía de Despliegue en Producción y Protocolo de Pruebas en Android Real (`S4D3`)

**Semana:** 3 — Día 7 (Fase A)  
**Sistema:** PUKARA (Sector Llojeta, La Paz)  
**Objetivo:** Instrucciones de configuración en la nube y protocolo paso a paso para la verificación en dispositivo móvil Android físico (`P12`, `P08`, `P09`, `P10`, `P18`).

---

## 1. Checklist de Variables de Entorno de Producción

Para el despliegue del monolito en capas de PUKARA en servicios de nube gratuitos o académicos (Render / Railway para el backend y Vercel / Netlify para el frontend PWA con PostgreSQL administrado en Neon / Supabase):

### A. Backend (`/server` en Render o Railway)

| Variable de Entorno | Valor de Ejemplo / Recomendación | Propósito |
| :--- | :--- | :--- |
| `NODE_ENV` | `production` | Activa optimizaciones de Express y deshabilita trazas internas de error. |
| `PORT` | `10000` (o asignado automáticamente) | Puerto de enlace del servidor HTTP. |
| `DATABASE_URL` | `postgresql://user:pass@ep-pukara.us-east-2.aws.neon.tech/pukara?sslmode=require` | Cadena de conexión al cluster PostgreSQL 15+ con SSL obligatorio. |
| `JWT_SECRET` | `cadena_criptografica_segura_de_al_menos_32_caracteres_pukara_2026` | Clave secreta para la firma y verificación de tokens JWT del personal administrativo. |
| `JWT_EXPIRES_IN` | `8h` | Tiempo de vida del token administrativo antes de requerir reautenticación. |
| `ADMIN_EMAIL` | `admin@pukara.bo` | Correo institucional único para la cuenta administrativa raíz. |
| `ADMIN_PASSWORD` | `PukaraAdmin2026!` (o clave robusta de producción) | Contraseña inicial que será hasheada con `bcrypt` (costo 10) por el script de seed. |
| `ADMIN_NOMBRE` | `Administrador PUKARA` | Nombre legible registrado en la bitácora de cambios. |
| `CORS_ORIGIN` | `https://pukara-app.vercel.app` (URL pública del cliente) | Lista blanca restrictiva para el intercambio de recursos de origen cruzado. |
| `OPEN_METEO_API_URL` | `https://api.open-meteo.com/v1/forecast` | Endpoint de la API meteorológica de Open-Meteo para el sector Llojeta. |

> [!NOTE]
> **Inicialización en Producción:** Tras configurar las variables y conectar el repositorio en Render/Railway, ejecute el comando de inicialización única de esquema y datos semilla:
> ```bash
> npm run db:setup --prefix server
> ```

---

### B. Frontend (`/client` en Vercel o Netlify)

| Variable de Entorno | Valor de Ejemplo / Recomendación | Propósito |
| :--- | :--- | :--- |
| `VITE_API_URL` | `https://pukara-api.onrender.com` | URL base del backend en la nube para peticiones a `/api/estado`, `/api/historial` y `/api/auth/login`. |
| `VITE_OSM_TILE_URL` | `https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png` | URL configurable del proveedor de teselas OpenStreetMap con atribución reglamentaria visible. |

> [!TIP]
> **Comando de Compilación para Vercel/Netlify:**
> - Build Command: `npm run build`
> - Output Directory: `dist`
> - Node.js Version: `>= 20.x`

---

## 2. Protocolo de Pruebas de Campo en Dispositivo Físico Android (`S4D3`)

En la **Semana 4 (Día 3)** se llevará a cabo la sesión de pruebas en un teléfono móvil Android real (con Android 10 o superior y Google Chrome). A continuación se describe el procedimiento estandarizado para validar cada requisito funcional asociado al entorno móvil:

---

### Procedimiento 1: Instalación de la Aplicación PWA (`P12`)

1. **Apertura del navegador:** Abrir Google Chrome en el teléfono Android y navegar a la URL de producción con HTTPS (o `http://localhost:5173` si se utiliza *Chrome Remote Debugging* vía cable USB con `adb reverse tcp:5173 tcp:5173`).
2. **Detección del Manifest:** Aguardar a que la página cargue completamente. Verificar que en la parte superior aparezca el banner interactivo `data-testid="banner-instalacion-pwa"` con el texto *"Instalar aplicación PWA para consulta sin conexión"*.
3. **Instalación:**
   - Pulsar el botón `"Instalar aplicación PWA para consulta sin conexión"` (`data-testid="btn-instalar-pwa"`).
   - O bien, pulsar el menú de opciones de Chrome (tres puntos verticales) y seleccionar **"Instalar aplicación"** o **"Agregar a la pantalla principal"**.
4. **Confirmación en Android:** En el cuadro de diálogo nativo del sistema, confirmar la instalación pulsando **"Instalar"**.
5. **Comprobación de Acceso Directo:**
   - Ir al cajón de aplicaciones y a la pantalla de inicio del teléfono.
   - Constatar la presencia del ícono institucional de PUKARA (`pwa-192x192.png` / `pwa-maskable-512x512.png`) con el título *"PUKARA"*.
6. **Ejecución Standalone:**
   - Tocar el ícono para abrir la aplicación.
   - Verificar que la app se ejecuta en ventana independiente a pantalla completa (*standalone*), sin barra de direcciones de Chrome, con el color de tema oscuro `#0f172a` en la barra de estado de Android.

---

### Procedimiento 2: Consulta en Modo Avión y Datos No Actualizados (`P08`)

1. **Carga en Línea Previa:** Con la PWA abierta y conectada a internet, realizar una consulta inicial para que el estado vigente (nivel informativo, recomendaciones, contactos de emergencia y puntos de referencia) quede persistido en `localStorage` por `guardarUltimoEstadoLocal`.
2. **Activación de Modo Avión:**
   - Deslizar hacia abajo el panel de ajustes rápidos de Android.
   - Activar el **Modo Avión** (apagando WiFi, datos móviles y Bluetooth).
3. **Reapertura de la PWA:**
   - Cerrar completamente la aplicación desde la vista de apps recientes de Android.
   - Abrir nuevamente PUKARA tocando su ícono en la pantalla de inicio.
4. **Verificación de Carga Offline Resiliente:**
   - Comprobar que la aplicación **abre de forma inmediata**, sirviendo el App Shell desde el caché del Service Worker (`workbox`), sin mostrar mensajes de error de conexión ni pantalla de dinosaurio.
   - Constatar que se visualiza el nivel informativo previamente conocido (ej. `NORMAL`, `PRECAUCION`, `ALERTA` o `EMERGENCIA`).
5. **Verificación del Aviso Permanente Offline:**
   - Verificar la presencia destacada del banner `data-testid="banner-datos-no-actualizados"` en color ámbar.
   - Comprobar la leyenda obligatoria:
     > *"Datos del [fecha y hora], no actualizados"*
   - Verificar el texto explicativo de consulta con conectividad limitada.
6. **Acceso a Contenidos en Caché:**
   - Comprobar que las recomendaciones preventivas generales correspondientes al nivel conocido se leen con normalidad.
   - Verificar que los contactos de emergencia (Red 114, Bomberos 119) permanecen visibles y legibles.
7. **Reconexión:**
   - Desactivar el Modo Avión en Android.
   - Pulsar el botón `"Reintentar conexión"` (`data-testid="btn-reintentar-conexion"`).
   - Comprobar que la app se sincroniza en vivo con la API y el banner de datos no actualizados se oculta automáticamente.

---

### Procedimiento 3: Permiso GPS Denegado y Privacidad Absoluta (`P09`)

1. **Solicitud de Ubicación:**
   - En la sección del Mapa Referencial, ubicarse en el panel *"Ubicación aproximada en dispositivo"*.
   - Pulsar el botón táctil accesible `"Calcular distancia aproximada desde mi ubicación"` (`data-testid="btn-solicitar-ubicacion"`).
2. **Denegación de Permisos:**
   - Ante la ventana emergente de permisos de Android (*"¿Permitir que PUKARA acceda a la ubicación de este dispositivo?"*), pulsar **"Denegar"** o **"No permitir"**.
3. **Comportamiento Esperado:**
   - Comprobar que de forma inmediata aparece el aviso `data-testid="aviso-gps-denegado"`:
     > *"Permiso de ubicación denegado o no disponible: no se muestran distancias a los puntos de referencia. La consulta general del nivel informativo, las recomendaciones y el mapa referencial funcionan con normalidad."*
   - Verificar que la lista de puntos de referencia continúa mostrándose completa, sin distancias métricas y sin romperse la interfaz.
   - **Garantía de Privacidad:** Certificar que ninguna coordenada ni solicitud de ubicación fue transmitida al backend ni a servicios externos.

---

### Procedimiento 4: Permiso GPS Concedido y Distancia Haversine (`P18`)

1. **Habilitación de Permisos:**
   - Tocar el candado o configuración del sitio en Chrome (o ajustes de la app PUKARA en Android) y cambiar el permiso de ubicación a **"Permitir mientras se usa la app"**.
2. **Cálculo en Dispositivo:**
   - Volver a la aplicación y pulsar `"Calcular distancia aproximada desde mi ubicación"`.
3. **Comportamiento Esperado:**
   - La app obtiene la coordenada GPS mediante la API nativa de geolocalización de Android.
   - Se muestra un punto azul indicando *"Mi ubicación estimada · Precisión: ±X m (procesado solo en este dispositivo)"*.
   - En cada tarjeta de punto de referencia aparece la distancia calculada mediante la fórmula de Haversine (ej. `Distancia: 450 m` o `Distancia: 1.8 km`).
   - Se visualiza de forma obligatoria la leyenda canónica:
     > *"distancia aproximada en línea recta (no es recomendación de ruta ni indica seguridad)"*
4. **Verificación Semántica Estricta:**
   - Confirmar la ausencia total de botones tipo *"Cómo llegar"*, rutas trazadas sobre el mapa o enlaces a aplicaciones de navegación externa (Google Maps o Waze).

---

### Procedimiento 5: Cartografía Parcial sin Teselas OSM (`P10`)

1. **Condición de Prueba:** Con el teléfono en Modo Avión o con conexión precaria, acceder a la vista del Mapa Referencial.
2. **Comportamiento de Teselas:**
   - Como la aplicación **no realiza precarga masiva de teselas** (conforme a la política de uso de `tile.openstreetmap.org`), las zonas del mapa cuyas teselas no fueron consultadas previamente aparecen en gris o con trama neutra.
3. **Aviso de Cartografía Parcial:**
   - Comprobar la presencia visible del banner `data-testid="aviso-mapa-parcial"`:
     > *"Mapa parcial con limitación de teselas: sin conexión a internet o teselas de OpenStreetMap no disponibles en el caché del navegador. Por política de uso de OpenStreetMap no se realiza precarga masiva de teselas. El sistema no ofrece navegación; consulte a continuación la lista completa de zonas y puntos de referencia de demostración disponibles sin conexión."*
4. **Disponibilidad de Datos Textuales:**
   - Verificar que debajo del mapa se despliega la lista completa de las zonas de referencia con sus polígonos referenciales y todos los puntos de referencia con su tipo, fuente y la advertencia:
     > *"referencia de demostración, no validada"*

---

## 3. Resumen de Criterios de Aceptación para Android

| Requisito | Criterio de Éxito en Dispositivo Físico | Evidencia Esperada |
| :--- | :--- | :--- |
| **`P12`** | Instalable con ícono de alta resolución y ejecución standalone sin barra de navegación del explorador. | Captura de pantalla de la app en cajón de Android y ventana abierta sin controles de Chrome. |
| **`P08`** | Abre en Modo Avión sirviendo el App Shell en $< 2\text{ s}$ y muestra `"Datos del [fecha y hora], no actualizados"`. | Captura con el ícono de Modo Avión en la barra de estado y el banner ámbar visible. |
| **`P09`** | Continúa operando con normalidad al denegar permisos de ubicación, informando con claridad la limitación. | Captura del diálogo de permisos denegado y el aviso `aviso-gps-denegado`. |
| **`P18`** | Con GPS concedido, calcula la distancia Haversine localmente con leyenda de línea recta sin dar rutas. | Captura de tarjetas de puntos con distancia en metros/km y leyenda obligatoria. |
| **`P10`** | Ante falta de teselas muestra el aviso de limitación de OSM y mantiene la lista de puntos 100% accesible. | Captura del banner `aviso-mapa-parcial` y la lista de puntos de referencia visible. |

