# PUKARA — Manual Breve de Instalación, Configuración y Ejecución (`S4D6`)

- **Proyecto:** PUKARA — Aplicación web progresiva (PWA) para consulta de condiciones de lluvias intensas en el sector Llojeta, La Paz
- **Asignatura:** INF-266 Taller de Proyecto — Carrera de Informática, Facultad de Ciencias Puras y Naturales, Universidad Mayor de San Andrés (UMSA)
- **Docente:** Ph.D. Brigida Alexandra Carvajal Blanco
- **Estudiante:** Joel Fernando Flores Choque
- **Gestión:** 2026

> **Aviso Permanente Obligatorio:**
> *"Los niveles Normal, Precaución, Alerta y Emergencia son niveles informativos de lluvia: niveles meteorológicos simulados, calculados con umbrales académicos. No sustituyen alertas ni instrucciones de las autoridades oficiales. PUKARA muestra información bajo consulta y no avisa activamente a la población. Ante una emergencia, atienda las indicaciones oficiales y contacte a los servicios de emergencia."*

---

## 1. Requisitos Previos del Entorno

Para instalar, ejecutar y verificar localmente el monolito en capas de **PUKARA** (`/server` + `/client`), el entorno de desarrollo debe contar con:

| Componente | Versión Mínima Recomendada | Propósito en la Arquitectura |
| :--- | :--- | :--- |
| **Node.js** | `v20.0.0+` (modo ESM nativo `"type": "module"`) | Ejecución del backend Express, motor de evaluación, Vitest y herramientas de compilación Vite. |
| **npm** | `v10.0.0+` | Gestión de paquetes independientes en `/server` y `/client`. |
| **Docker** / **PostgreSQL** | PostgreSQL `15+` (contenedor `pukara-postgres`) | Almacenamiento relacional nativo (`pg` Pool) de las 10 tablas inmutables y geometrías GeoJSON en `JSONB`. |
| **Git** | `v2.34+` | Control de versiones y trazabilidad de ramas. |
| **Navegador Web Moderno** | Google Chrome (Desktop `v120+` y Android `v120+`) | Renderizado de la PWA, Service Worker offline, geolocalización en el cliente y pruebas en dispositivo físico. |

---

## 2. Configuración de Base de Datos PostgreSQL y Variables de Entorno

### 2.1. Arranque de PostgreSQL en Docker (`127.0.0.1:5432`)

Si aún no existe el contenedor local `pukara-postgres`, créelo e inícielo ejecutando:

```bash
# Crear e iniciar contenedor PostgreSQL 15 por primera vez
docker run -d \
  --name pukara-postgres \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=pukara_db \
  -p 5432:5432 \
  postgres:15-alpine

# Si el contenedor ya existe en el equipo, simplemente iniciarlo:
docker start pukara-postgres
```

### 2.2. Variables de Entorno del Backend (`server/.env`)

Copie la plantilla `server/.env.example` hacia `server/.env`:

```bash
cp server/.env.example server/.env
```

Verifique los valores principales en `server/.env`:

```ini
PORT=3000
NODE_ENV=development
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/pukara_db
DB_SSL=false
DB_CONNECT_TIMEOUT_MS=10000
CORS_ORIGIN=http://localhost:5173
CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
JWT_SECRET=pukara_dev_jwt_secret_llojeta_2026_umsa
JWT_EXPIRES_IN=8h
LOGIN_RATE_LIMIT_WINDOW_MS=900000
LOGIN_RATE_LIMIT_MAX=5
OPEN_METEO_BASE_URL=https://api.open-meteo.com/v1/forecast
OPEN_METEO_TIMEOUT_MS=8000
OPEN_METEO_TIMEZONE=UTC
LLOJETA_LAT=-16.5235
LLOJETA_LON=-68.1425
LECTURAS_CACHE_TTL_MINUTOS=12
ADMIN_EMAIL=admin@pukara.bo
ADMIN_PASSWORD=PukaraAdmin2026!
ADMIN_NOMBRE=Administrador PUKARA
```

---

## 3. Instalación de Dependencias, Migraciones y Datos Semilla (`v1`)

### 3.1. Backend (`/server`) — Instalación, Esquema de 10 Tablas y Semillas

Desde la raíz del repositorio, instale las dependencias del servidor y ejecute las migraciones y semillas iniciales:

```bash
# 1. Instalar dependencias del backend
npm install --prefix server

# 2. Ejecutar migración SQL de las 10 tablas inmutables (usuarios, configuraciones_reglas,
#    umbrales, lecturas_meteorologicas, evaluaciones_nivel, recomendaciones_preventivas,
#    contactos_emergencia, zonas_referencia, puntos_referencia, bitacora_cambios)
npm run db:migrate --prefix server

# 3. Cargar datos semilla base (configuración v1 vigente con los 9 umbrales académicos:
#    2.5/6.5/12 mm/h en 1h, 10/25/40 mm en 24h, 25/60/90 mm en 72h, regla de saturación
#    acum_72h >= 60 + intensidad >= 2.5 -> ALERTA, recomendaciones preventivas generales
#    con etiqueta "referencia de demostración, no validada" y contactos de emergencia verificados)
npm run db:seed --prefix server

# 4. Cargar capas cartográficas de referencia en Llojeta (2 zonas poligonales GeoJSON en JSONB
#    y 6 puntos de referencia con estado_verificacion = 'sin_verificar')
npm run db:seed:capas --prefix server

# 5. Asegurar cuenta administrativa por defecto (admin@pukara.bo / PukaraAdmin2026!)
npm run seed:admin --prefix server
```

> **Atajo equivalente:** Puede ejecutar `npm run db:setup --prefix server` para correr migración y semilla principal en un solo paso.

### 3.2. Frontend (`/client`) — Instalación de Dependencias

```bash
# Instalar dependencias del cliente React + Vite + Tailwind CSS + Leaflet + PWA
npm install --prefix client
```

---

## 4. Ejecución en Modo Desarrollo, Build de Producción y Pruebas en Android Físico (Wi-Fi Host)

### 4.1. Arranque en Modo Desarrollo Local

Abra dos terminales desde la raíz del proyecto:

```bash
# Terminal 1 — Servidor Backend Express en http://localhost:3000
npm run dev --prefix server
# (o `npm start --prefix server` para ejecución estándar sin watch)
```

```bash
# Terminal 2 — Cliente PWA en http://localhost:5173 expuesto en red local
npm run dev --prefix client -- --host
# (o `npm start --prefix client`)
```

- **Consulta Pública (Módulos 1 al 4):** `http://localhost:5173/`
  - Muestra el **nivel informativo de lluvia** (`NORMAL`, `PRECAUCION`, `ALERTA` o `EMERGENCIA`), las **recomendaciones preventivas generales** con su etiqueta *"referencia de demostración, no validada"*, los contactos de emergencia verificados, el mapa de referencia en tono neutro y el cálculo de *"distancia aproximada en línea recta (no es recomendación de ruta ni indica seguridad)"* (*"distancia aproximada en línea recta (no es ruta ni indica seguridad)"*).
  - Cuando se consulta sin conexión a internet (modo avión `P08`), despliega el último estado almacenado con el aviso: *"Datos del [fecha y hora], no actualizados"*.
- **Panel de Administración (Módulo 5):** `http://localhost:5173/admin`
  - **Correo:** `admin@pukara.bo`
  - **Contraseña:** `PukaraAdmin2026!`

### 4.2. Compilación de Producción PWA y Acceso desde Dispositivo Android Físico por Wi-Fi

Para probar la instalación de la PWA (`manifest.webmanifest` + Service Worker Workbox `sw.js`) desde un teléfono Android conectado a la misma red Wi-Fi:

```bash
# 1. Compilar el paquete de producción PWA en client/dist/
npm run build --prefix client

# 2. Servir el build de producción escuchando en todas las interfaces de red
npm run preview --prefix client -- --host
```

1. Identifique la dirección IP local de la computadora (`hostname -I`, por ejemplo `192.168.1.45`).
2. En el teléfono Android, abra Chrome y navegue a `http://<IP_LOCAL_LAPTOP>:4173` (en preview) o `http://<IP_LOCAL_LAPTOP>:5173` (en desarrollo).
3. Utilice la opción **"Instalar aplicación"** / **"Añadir a la pantalla de inicio"** para verificar el modo `standalone` (`P12`), el modo avión (`P08`), el permiso de GPS denegado (`P09`) y el mapa parcial sin teselas (`P10`).

---

## 5. Comandos de Verificación y Suites Automatizadas

### 5.1. Ejecución de las 34 Suites de Pruebas Automatizadas (Vitest + Supertest)

```bash
# Ejecutar las 24 suites del backend (/server — 228 pruebas)
npm test --prefix server

# Ejecutar las 10 suites del frontend (/client — 70 pruebas)
npm test --prefix client
```

### 5.2. Ejecución de los Scripts Verificadores de la Semana 4 (`S4D1` a `S4D6`)

```bash
# S4D1: Verificación de contratos HTTP, colección Postman y pruebas P01, P03, P04, P05, P07, P16, P17
npm run verify:api --prefix server

# S4D2: Verificación de datos faltantes (P02), fallos de API (P03/T5) y aislamiento simulación vs real (P11)
npm run verify:resiliencia --prefix server

# S4D3: Verificación de artefactos del build PWA (manifest.webmanifest, sw.js e íconos)
npm run verify:pwa --prefix client

# S4D4: Benchmark reproducible de rendimiento de consulta principal (< 3 segundos — P19)
npm run verify:p19 --prefix server

# S4D5: Evaluación de escenarios históricos (abril 2019 y noviembre 2024) y auditoría de seguridad (Sección 6.4)
npm run verify:s4d5 --prefix server

# S4D6: Auditoría integral del paquete de evidencias documentales y semántica del proyecto
npm run verify:evidencias --prefix server
```

