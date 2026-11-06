# PUKARA — Guía de Despliegue del Esqueleto de Extremo a Extremo (Semana 2)

Este documento detalla la arquitectura, procedimiento paso a paso y comandos verificados para desplegar el sistema completo de **PUKARA** en plataformas de capa gratuita en la nube (Neon/Supabase + Render/Railway + Vercel/Netlify), asegurando conectividad segura con PostgreSQL nativo, soporte CORS y validación con pruebas de humo.

---

## 1. Topología de Despliegue

```
 ┌────────────────────────────────────────────────────────┐
 │                    CLIENTE WEB PWA                     │
 │     Vercel / Netlify (SPA con React 18 + Vite)         │
 │     Variable: VITE_API_URL=https://pukara-api.onrender.com
 └───────────────────────────┬────────────────────────────┘
                             │ HTTPS / CORS
 ┌───────────────────────────▼────────────────────────────┐
 │                  BACKEND MONOLÍTICO                    │
 │         Render / Railway (Node.js ESM + Express)       │
 │         Comandos: npm install && npm start             │
 └───────────────────────────┬────────────────────────────┘
                             │ PostgreSQL TLS (pg nativo)
 ┌───────────────────────────▼────────────────────────────┐
 │                BASE DE DATOS RELACIONAL                │
 │         Neon / Supabase (PostgreSQL 15+ gestionado)    │
 │         10 tablas SQL + JSONB (Cero ORMs, Cero PostGIS)│
 └────────────────────────────────────────────────────────┘
```

---

## 2. Paso 1: Aprovisionamiento de PostgreSQL (Neon o Supabase)

1. Crear un proyecto en [Neon](https://neon.tech) o [Supabase](https://supabase.com).
2. Obtener la cadena de conexión URI (Connection String).
   - Ejemplo Neon:
     ```text
     postgresql://pukara_user:PassSeguro123!@ep-cool-lake-123456.us-east-2.aws.neon.tech/neondb?sslmode=require
     ```
3. Guardar las credenciales para configurar el backend.

---

## 3. Paso 2: Inicialización del Esquema y Semillas

Desde tu terminal local o mediante la consola de despliegue, ejecuta las migraciones nativas y los datos semilla sobre la base de datos remota:

```bash
# Exportar temporalmente la cadena de conexión remota con SSL activo
export DATABASE_URL="postgresql://pukara_user:PassSeguro123!@ep-cool-lake-123456.us-east-2.aws.neon.tech/neondb?sslmode=require"
export DB_SSL="true"

# Ejecutar migraciones (creación de las 10 tablas relacionales)
npm run db:migrate --prefix server

# Ejecutar seeds iniciales (usuario administrador, versión 1 de reglas, umbrales y recomendaciones)
npm run db:seed --prefix server

# Ejecutar capas de referencia geográfica de Llojeta
npm run db:seed:capas --prefix server

# Verificar el estado de despliegue de la BD
npm run cloud:verificar --prefix server
```

---

## 4. Paso 3: Despliegue del Backend (Render o Railway)

### Opción Recomendada: Render (Web Service)
1. Conectar el repositorio GitHub y seleccionar la rama de trabajo (ej. `main` o `feat/motor-reglas`).
2. Configurar el servicio con los siguientes parámetros:
   - **Root Directory:** `server`
   - **Environment:** `Node`
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
3. Configurar las **Variables de Entorno (Environment Variables)**:
   - `NODE_ENV`: `production`
   - `PORT`: `10000` (o el asignado automáticamente por Render)
   - `DATABASE_URL`: `postgresql://pukara_user:...@ep-name.region.aws.neon.tech/neondb?sslmode=require`
   - `DB_SSL`: `true`
   - `DB_CONNECT_TIMEOUT_MS`: `10000`
   - `CORS_ORIGIN`: `https://tu-cliente-pukara.vercel.app` (o `*` para pruebas iniciales)
   - `JWT_SECRET`: `<generar-cadena-aleatoria-segura-64-caracteres>`
   - `OPEN_METEO_BASE_URL`: `https://api.open-meteo.com/v1/forecast`
   - `LLOJETA_LAT`: `-16.5235`
   - `LLOJETA_LON`: `-68.1425`
   - `LECTURAS_CACHE_TTL_MINUTOS`: `12`
4. Desplegar el servicio y anotar la URL generada (ej. `https://pukara-backend.onrender.com`).

---

## 5. Paso 4: Despliegue del Frontend (Vercel o Netlify)

### Opción Recomendada: Vercel
1. Importar el repositorio GitHub en [Vercel](https://vercel.com).
2. Configurar los parámetros de proyecto:
   - **Framework Preset:** `Vite`
   - **Root Directory:** `client`
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`
3. Configurar las **Variables de Entorno**:
   - `VITE_API_URL`: `https://pukara-backend.onrender.com` (la URL de tu backend en Render sin barra final).
   - `VITE_OSM_TILE_URL`: `https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png`
   - `VITE_OSM_ATTRIBUTION`: `&copy; OpenStreetMap contributors`
4. Desplegar el proyecto. Una vez finalizado, copia la URL pública de Vercel (ej. `https://pukara.vercel.app`) y actualiza la variable `CORS_ORIGIN` en el backend si estaba restringida.

---

## 6. Paso 5: Batería de Pruebas de Humo (`curl`)

Ejecuta estos comandos contra la URL pública de tu backend desplegado (`https://tu-backend.onrender.com`) para validar el funcionamiento del esqueleto completo:

### 1. Comprobar salud y conectividad a PostgreSQL
```bash
curl -X GET "https://tu-backend.onrender.com/api/salud" -H "Accept: application/json"
```
**Respuesta esperada (HTTP 200):**
```json
{
  "estado": "ok",
  "servicio": "pukara-server",
  "base_de_datos": "conectada",
  "timestamp": "2026-11-06T..."
}
```

### 2. Consultar el estado público en modalidad real
```bash
curl -X GET "https://tu-backend.onrender.com/api/estado?modalidad=real" -H "Accept: application/json"
```
**Respuesta esperada (HTTP 200):**
- Contiene `ok: true`.
- `modalidad: "real"`.
- `es_simulacion: false`.
- `aviso_permanente`: Texto legal canónico completo.
- `estado_sistema`: `NORMAL`, `PRECAUCION`, `ALERTA` o `EMERGENCIA`.
- `zona_piloto`: Coordenadas centrales de Llojeta (`-16.5235`, `-68.1425`).
- `recomendaciones_nivel_vigente`: Lista de recomendaciones asociadas al nivel vigente.

### 3. Consultar el historial de evaluaciones
```bash
curl -X GET "https://tu-backend.onrender.com/api/historial?modalidad=real&limite=5" -H "Accept: application/json"
```
**Respuesta esperada (HTTP 200):**
- Contiene `modalidad: "real"`, `total: N`, y un arreglo `items` con las evaluaciones cronológicas inmutables.

### 4. Inyectar una lectura simulada (Prueba P11 de aislamiento)
```bash
curl -X POST "https://tu-backend.onrender.com/api/simulacion/lectura" \
  -H "Content-Type: application/json" \
  -d '{
    "intensidad_mm_h": 15.0,
    "acum_24h_mm": 50.0,
    "acum_72h_mm": 100.0,
    "horas_validas_24h": 24,
    "horas_validas_72h": 72
  }'
```
**Respuesta esperada (HTTP 201):**
- Contiene `evaluacion.nivel_vigente: "EMERGENCIA"`.

### 5. Verificar que el modo simulación está aislado y no alteró el flujo real
```bash
# 5.A El modo simulado debe reportar EMERGENCIA y es_simulacion: true
curl -X GET "https://tu-backend.onrender.com/api/estado?modalidad=simulada"

# 5.B El modo real debe permanecer intacto
curl -X GET "https://tu-backend.onrender.com/api/estado?modalidad=real"
```

### 6. Limpieza de datos simulados
```bash
curl -X DELETE "https://tu-backend.onrender.com/api/simulacion"
```
**Respuesta esperada (HTTP 200):**
```json
{
  "mensaje": "Datos de simulación eliminados correctamente",
  "lecturas_eliminadas": 1,
  "evaluaciones_eliminadas": 1
}
```

---

## 7. Verificación Semántica y Lista Negra

Antes de dar por concluido cualquier despliegue, verifica que la interfaz web:
- **NO** contenga las frases prohibidas: `"alerta oficial"`, `"orden de evacuación"`, `"evacuar"`, `"ruta segura"`, `"zona segura"`, ni botones `"Cómo llegar"`.
- Mantenga el **Aviso Permanente Oficial** visible en todo momento.
- Muestre los polígonos y puntos cartográficos con la leyenda obligatoria: *"referencia de demostración, no validada"*.
