# PUKARA — Informe de Puerta de Calidad Semana 1, Ratificación de Parámetros y Guía de Pre-Despliegue

**Semana:** 1 — Día 7 (Fase B)  
**Sistema:** PUKARA (Sector Llojeta, La Paz)  
**Estado:** Certificado para transición a Semana 2 (Motor de Evaluación y Clasificación)

---

## 1. Cierre Formal de Parámetros Temporales y de Histéresis

A partir de la inspección empírica en tiempo real de la API de Open-Meteo para el sector Llojeta realizada en `S1D3` (`docs/verificacion_open_meteo_llojeta.md`), se ratifican y cierran formalmente los parámetros de gobierno temporal del sistema:

| Parámetro | Valor Ratificado | Justificación Técnica Empírica | Rol en Semana 2 |
| :--- | :---: | :--- | :--- |
| **`separacion_minima_minutos`** | `15` min | El campo `current.interval` de Open-Meteo entrega mediciones con paso de 900 segundos (15 minutos). Muestras con diferencia menor corresponden al mismo cuadro meteorológico o lecturas en caché de red. | Función pura `esMuestraIndependiente` (`S2D2`): exige que dos muestras para descenso por histéresis disten al menos 15 minutos en su `observado_en`. |
| **`t_max_minutos`** | `60` min | La serie `hourly` de Open-Meteo se actualiza en pasos de 1 hora (3600 segundos). Transcurridos 60 minutos sin un dato fresco de observación, la lectura se considera obsoleta. | Regla de integridad `DATOS_DESACTUALIZADOS` (`S2D3`): prohíbe degradar a `NORMAL` por ausencia o retraso de lecturas. |
| **`muestras_descenso`** | `2` muestras | Exigencia de estabilidad temporal para evitar oscilaciones rápidas (*chattering*) ante pausas o reducciones momentáneas de la lluvia. | Histéresis de descenso (`S2D2`): requiere 2 muestras temporales consecutivas e independientes menores al umbral. |
| **`saturacion.habilitada`** | `true` | Regla geológica para cuencas de alta pendiente en La Paz (suelos arcillosos/formación La Paz en Llojeta). | Transición forzada (`S2D2`): Si `acum_72h_mm >= 60` y la `intensidad_mm_h >= 2.5`, el nivel se fuerza a un mínimo de `ALERTA`. |
| **`saturacion.acum_72h_min_mm`** | `60.0` mm | Umbral académico de saturación de suelo antecedente de 3 días. | Condición detonante de saturación. |
| **`saturacion.intensidad_min_mm_h`**| `2.5` mm/h | Intensidad mínima horaria simultánea requerida. | Condición detonante de saturación. |
| **`saturacion.nivel_minimo`** | `'ALERTA'` | Nivel de piso impuesto por la condición de suelo saturado. | Salida forzada del motor de clasificación. |

Todos estos valores se gestionan de forma dinámica en la tabla relacional `configuraciones_reglas.parametros` (versión 1, estado `'vigente'`), sin código duro en el motor, normalizados mediante [`/server/src/services/configuracion.service.js`](file:///home/joel/Documentos/Taller/Proyecto/PUKARA/server/src/services/configuracion.service.js).

---

## 2. Auditoría de Cuotas Gratuitas y Políticas de Servicios Externos

Se validaron las condiciones de uso, cuotas de transferencia y restricciones de los proveedores cloud considerados en la arquitectura de demostración:

### 2.1 Proveedor Meteorológico: Open-Meteo
- **Modalidad:** Nivel gratuito no comercial para investigación y educación.
- **Cuota:** Hasta 10,000 llamadas/día (y 5,000 llamadas/hora).
- **Consumo proyectado en PUKARA:**
  - Gracias al caché en memoria del servidor de 12 minutos ([`lecturas.service.js`](file:///home/joel/Documentos/Taller/Proyecto/PUKARA/server/src/services/lecturas.service.js)), el backend realiza un máximo teórico de 5 consultas externas por hora:
    $$\frac{24 \text{ horas} \times 60 \text{ minutos}}{12 \text{ minutos/llamada}} = 120 \text{ llamadas/día}$$
  - PUKARA consume menos del **1.2% de la cuota diaria gratuita**, garantizando operatividad ininterrumpida sin requerir tarjeta de crédito ni claves API privadas.

### 2.2 Base de Datos Cloud: Neon / Supabase (PostgreSQL Gestionado)
- **Modalidad:** Plan gratuito (*Free Tier*).
- **Almacenamiento:** 0.5 GB (500 MB). Una fila en `lecturas_meteorologicas` pesa aproximadamente ~300 bytes; 500 MB permiten almacenar más de 1,500,000 lecturas históricas (equivalente a más de 30 años a 1 lectura cada 12 min).
- **Comportamiento Serverless (*Compute Auto-suspend*):** Neon suspende el cómputo tras 5 minutos de inactividad para ahorrar recursos y reactiva el cómputo en 1 a 2 segundos ante la primera consulta entrante.
- **Conectividad:** Requiere TLS/SSL obligatorio (`?sslmode=require`). Resuelto de forma transparente en [`pool.js`](file:///home/joel/Documentos/Taller/Proyecto/PUKARA/server/src/db/pool.js) con `construirOpcionesPool()`.

### 2.3 Backend Hosting: Render / Railway
- **Modalidad:** Render Web Services (Free Tier) con 750 horas mensuales de cómputo.
- **Comportamiento ante inactividad (*Cold Start*):** El contenedor entra en suspensión tras 15 minutos sin tráfico HTTP. La primera petición entrante puede tardar entre 30 y 50 segundos en responder mientras el contenedor se aprovisiona.
- **Protocolo de Mitigación para Defensa Académica:** Enviar un `GET /api/salud` 5 a 10 minutos antes de la demostración para reactivar el servicio (*warm-up*).

### 2.4 Frontend Hosting PWA: Vercel / Netlify
- **Modalidad:** Hosting de archivos estáticos (Vite SPA) con CDN global y certificados SSL/TLS automáticos.
- **Integración:** Se conectará en la Semana 2 (`S2D6`) apuntando su proxy o variable `VITE_API_URL` hacia el servicio backend en Render.

### 2.5 Cartografía Base: OpenStreetMap (`tile.openstreetmap.org`)
- **Política de Teselas (Tile Usage Policy):**
  - **PROHIBICIÓN ESTRICTA:** Queda prohibida la descarga masiva o raspado offline de teselas de OpenStreetMap.
  - **REQUISITO OBLIGATORIO:** Las capas Leaflet deben consumir teselas bajo demanda vía URL configurable (`VITE_OSM_TILE_URL`) y exhibir permanentemente la atribución legal visible: `© OpenStreetMap contributors`.

---

## 3. Guía Operativa de 5 Minutos: Despliegue de Demostración (Neon + Render)

Para validar el pre-despliegue en la nube sin alterar el entorno local, siga estos 4 pasos secuenciales:

### Paso 1: Crear Base de Datos en Neon
1. Inicie sesión en [neon.tech](https://neon.tech) y cree un nuevo proyecto gratuito llamado `pukara-db`.
2. En el panel de control, copie la cadena de conexión de PostgreSQL con SSL habilitado. Tendrá un formato como:
   ```bash
   postgresql://pukara_owner:mypassword@ep-cool-cloud.us-east-2.aws.neon.tech/pukara_db?sslmode=require
   ```

### Paso 2: Inicializar Esquema y Semillas en Neon desde Terminal Local
Desde la raíz de la máquina de desarrollo, ejecute en una sola línea la inicialización remota:
```bash
cd server
DATABASE_URL="postgresql://pukara_owner:mypassword@ep-cool-cloud.us-east-2.aws.neon.tech/pukara_db?sslmode=require" DB_SSL=true npm run db:setup
```
*Salida esperada:*
- Migración `001_esquema_inicial.sql` aplicada con éxito creando las 10 tablas.
- Usuario administrador, configuración v1 con 9 umbrales, 4 recomendaciones, bitácora y capas cartográficas (2 polígonos y 6 puntos) insertados de forma idempotente.

### Paso 3: Desplegar el Backend en Render
1. Inicie sesión en [render.com](https://render.com) y cree un nuevo **Web Service**.
2. Conecte el repositorio GitHub de PUKARA o utilice el blueprint [`render.yaml`](file:///home/joel/Documentos/Taller/Proyecto/PUKARA/render.yaml).
3. Configure los parámetros básicos:
   - **Root Directory:** `server`
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Health Check Path:** `/api/salud`
4. Declare las variables de entorno en Render:
   - `NODE_ENV`: `production`
   - `DATABASE_URL`: *(la URL de Neon del Paso 1)*
   - `DB_SSL`: `true`
   - `CORS_ORIGIN`: `http://localhost:5173,https://pukara.vercel.app`
   - `JWT_SECRET`: *(cadena aleatoria segura)*
   - `LLOJETA_LAT`: `-16.5235`
   - `LLOJETA_LON`: `-68.1425`
   - `LECTURAS_CACHE_TTL_MINUTOS`: `12`
5. Haga clic en **Create Web Service**. Espere a que el build finalice y el servicio pase a estado *Live*.

### Paso 4: Ejecutar Verificación Remota de Humo (Smoke Test)
Una vez desplegado en Render, verifique la salud del sistema ejecutando el script CLI desde su terminal:
```bash
cd server
npm run cloud:verificar -- https://pukara-api.onrender.com
```
*Salida esperada:*
```text
================================================================
 PUKARA — Verificación de Pre-Despliegue y Puerta Semana 1
 Destino evaluado: https://pukara-api.onrender.com
 Timestamp:        2026-10-23T23:38:00.000Z
================================================================

[1/3] Comprobando GET /api/salud... ✓ OK (350 ms) — BD: conectado
[2/3] Comprobando primera consulta GET /api/estado (v1)... ✓ OK (820 ms)
      - Lectura ID: 1 (observado_en: ...)
      - Capas: 2 zonas, 6 puntos de orientación
      - Origen respuesta: red_externa
[3/3] Comprobando segunda llamada inmediata (Caché en servidor)... ✓ OK (95 ms) — Respuesta desde 'cache_servidor', ID idéntico 1

================================================================
 [OK] PUERTA SEMANA 1 VERIFICADA EXITOSAMENTE EN: https://pukara-api.onrender.com
 Tiempo total de inspección: 1265 ms
================================================================
```

---

## 4. Certificación Final de Puerta de Calidad Semana 1

Con la ejecución satisfactoria de:
1. `npm test` en `/server` (8 suites / 58 pruebas automatizadas 100% en verde).
2. `npm test` en `/client` (1 suite / 3 pruebas en verde) y `npm run build` sin errores.
3. Auditoría estática de código fuente libre de términos de la Lista Negra (`puerta_semana1.test.js`).
4. Script de pre-despliegue CLI probado con éxito (`verificarDespliegue.js`).

**La Semana 1 queda formalmente concluida y aprobada para dar inicio a la Semana 2.**
