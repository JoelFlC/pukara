# PUKARA — Aplicación Web Progresiva (PWA) para Consulta de Condiciones de Lluvias Intensas en el Sector Llojeta, La Paz

**Universidad Mayor de San Andrés (UMSA)**  
**Facultad de Ciencias Puras y Naturales — Carrera de Informática**  
- **Asignatura:** INF-266 Taller de Proyecto  
- **Docente:** Ph.D. Brigida Alexandra Carvajal Blanco  
- **Estudiante:** Joel Fernando Flores Choque  
- **Gestión:** 2026  

---

> ### ⚠️ AVISO PERMANENTE OBLIGATORIO
> *"Los niveles Normal, Precaución, Alerta y Emergencia son niveles informativos de lluvia: niveles meteorológicos simulados, calculados con umbrales académicos. No sustituyen alertas ni instrucciones de las autoridades oficiales. PUKARA muestra información bajo consulta y no avisa activamente a la población. Ante una emergencia, atienda las indicaciones oficiales y contacte a los servicios de emergencia."*

---

## 1. Resumen Ejecutivo y Alcance en la Zona Piloto (Llojeta / Bajo Llojeta)

**PUKARA** es una aplicación web progresiva (**PWA**) de consulta ciudadana y demostración académica diseñada para el sector piloto **Llojeta / Bajo Llojeta** (macrodistrito Cotahuma, La Paz — coordenada representativa: **`latitud -16.5235, longitud -68.1425`**).

El sistema ingesta series horarias y lecturas actuales de precipitación desde **Open-Meteo**, calcula el **nivel informativo de lluvia** en cuatro estados canónicos (`NORMAL`, `PRECAUCION`, `ALERTA`, `EMERGENCIA`) junto con los estados de integridad `SIN_DATOS` y `DATOS_DESACTUALIZADOS`, presenta **recomendaciones preventivas generales** con su etiqueta de origen (*"referencia de demostración, no validada"*), expone contactos de emergencia verificados, dibuja cartografía de referencia en tonos neutros con cálculo local de **distancia aproximada en línea recta (no es recomendación de ruta ni indica seguridad)** (*"distancia aproximada en línea recta (no es ruta ni indica seguridad)"*) y opera en modo sin conexión mostrando el último estado almacenado bajo el aviso *"Datos del [fecha y hora], no actualizados"*.

### Los 5 Módulos Arquitectónicos Implementados
1. **Módulo 1 — Ingesta y Series Pluviométricas (Open-Meteo):** Consulta horaria (`hourly=precipitation`) y actual (`current`), normalización UTC, caché en servidor de `12 minutos`, unicidad por `observado_en` y tolerancia a valores nulos o caídas de red (`P02`, `P03`, `P04`).
2. **Módulo 2 — Motor de Evaluación por Umbrales, Histéresis y Saturación:** Funciones puras deterministas para clasificación con `>=` (`P01`), ascenso inmediato (`P13`), histéresis de descenso con 2 muestras independientes consecutivas (`P14`), regla compuesta de saturación de cuenca (`P17`), estados `DATOS_DESACTUALIZADOS` / `SIN_DATOS` (`P15`) y aislamiento entre modo real y simulación (`P11`).
3. **Módulo 3 — Recomendaciones Preventivas, Contactos y Aviso In-App:** Tarjetas de **recomendaciones preventivas generales** rotuladas con *"referencia de demostración, no validada"*, contactos verificados (Red 114 GAMLP, Bomberos 119, Radio Patrullas 110, Defensa Civil 115) y aviso visual in-app cuando cambia el nivel con la aplicación abierta (`P06`).
4. **Módulo 4 — Cartografía Referencial en Tonos Neutros, Haversine en Cliente y PWA Offline:** Polígonos GeoJSON de Llojeta en color neutro, 6 puntos de referencia, cálculo 100% en cliente de distancia en línea recta con Haversine (`P18`), degradación elegante si se deniega el permiso GPS (`P09`) o si faltan teselas (`P10`), e instalación/consulta offline en Android (`P08`, `P12`).
5. **Módulo 5 — Autenticación JWT, Panel Administrativo y Bitácora Inmutable:** Inicio de sesión con `bcrypt` y Rate Limiting, control de acceso por rol `administrador` (`P07`), versionado inmutable de umbrales con validación matemática previa (`P05`, `P16`), inyección de escenarios simulados (`P11`) y auditoría completa en `bitacora_cambios`.

---

## 2. Tabla de los 9 Umbrales Académicos `v1` y Regla Compuesta de Saturación

| Variable Pluviométrica | Nivel `NORMAL` | Nivel `PRECAUCION` (`>=`) | Nivel `ALERTA` (`>=`) | Nivel `EMERGENCIA` (`>=`) | Ventana Mínima Válida |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **Intensidad horaria (`intensidad_mm_h`)** | `< 2.5 mm/h` | **`2.5 mm/h`** | **`6.5 mm/h`** | **`12.0 mm/h`** | `1 / 1` hora válida |
| **Acumulado 24 horas (`acum_24h_mm`)** | `< 10.0 mm` | **`10.0 mm`** | **`25.0 mm`** | **`40.0 mm`** | `24 / 24` horas válidas |
| **Acumulado 72 horas (`acum_72h_mm`)** | `< 25.0 mm` | **`25.0 mm`** | **`60.0 mm`** | **`90.0 mm`** | `72 / 72` horas válidas |

- **Regla Compuesta de Saturación de Suelo (`P17`):** Si `acum_72h_mm >= 60.0 mm` **y** `intensidad_mm_h >= 2.5 mm/h`, el nivel resultante se eleva como mínimo a **`ALERTA`**, aun cuando ninguna variable individual alcance el umbral de `ALERTA` por separado.

---

## 3. Arquitectura y Stack Tecnológico (Monolito en Capas)

- **Frontend (`/client`):** React 19 + Vite 8, Tailwind CSS 4 (diseño *mobile-first* de alto contraste), React Router 7, Leaflet 1.9 con teselas configurables de OpenStreetMap y `vite-plugin-pwa` (Workbox Service Worker + Web App Manifest).
- **Backend (`/server`):** Node.js (`v20+` en modo ESM `"type": "module"`), Express 4, cliente nativo `pg` (`Pool`) hacia PostgreSQL 15+ (sin ORMs ni PostGIS; geometrías GeoJSON almacenadas como `JSONB`), autenticación JWT (`jsonwebtoken`) y hashing `bcrypt`.
- **Base de Datos Relacional (10 Tablas Inmutables en PostgreSQL):**
  `usuarios`, `configuraciones_reglas`, `umbrales`, `lecturas_meteorologicas`, `evaluaciones_nivel`, `recomendaciones_preventivas`, `contactos_emergencia`, `zonas_referencia`, `puntos_referencia` y `bitacora_cambios`.
- **Testing y Aseguramiento de Calidad:** Vitest + Supertest (**34 suites automatizadas / 298 pruebas en verde**: 24 suites en `/server` y 10 suites en `/client`).

---

## 4. Guía Rápida de Inicio y Credenciales de Demostración

Para instrucciones detalladas paso a paso, consulte el **[Manual Breve de Instalación y Ejecución (`docs/manual-instalacion.md`)](docs/manual-instalacion.md)**.

```bash
# 1. Iniciar contenedor PostgreSQL local
docker start pukara-postgres

# 2. Instalar dependencias, migrar las 10 tablas y poblar semillas v1 + capas + admin
npm install --prefix server
cp server/.env.example server/.env
npm run db:migrate --prefix server
npm run db:seed --prefix server
npm run db:seed:capas --prefix server
npm run seed:admin --prefix server

# 3. Instalar dependencias del cliente PWA
npm install --prefix client

# 4. Iniciar servidor backend (http://localhost:3000) y cliente PWA (http://localhost:5173)
npm run dev --prefix server
npm run dev --prefix client -- --host
```

### Credenciales de Demostración del Panel Administrativo (`/admin`)
- **URL del Panel Administrativo:** `http://localhost:5173/admin`
- **Correo electrónico:** `admin@pukara.bo`
- **Contraseña:** `PukaraAdmin2026!`

### Ejecución de Suites de Pruebas y Scripts Verificadores

```bash
# Ejecutar las 24 suites de pruebas del backend (228 tests) y las 10 suites del cliente (70 tests)
npm test --prefix server
npm test --prefix client

# Scripts verificadores de cierre académico (Semana 4)
npm run verify:api --prefix server          # S4D1: Contratos HTTP y colección Postman
npm run verify:resiliencia --prefix server  # S4D2: P02, P03/T5 y aislamiento P11
npm run verify:pwa --prefix client          # S4D3: Build PWA, manifest.webmanifest y sw.js
npm run verify:p19 --prefix server          # S4D4: Benchmark de rendimiento P19 (< 3 segundos)
npm run verify:s4d5 --prefix server         # S4D5: Escenarios históricos 2019/2024 y Seguridad 6.4
npm run verify:evidencias --prefix server   # S4D6: Auditoría del paquete de evidencias
```

---

## 5. Índice del Paquete de Evidencias (Sección 11.5 de `PUKARA.pdf`)

| Entregable Oficial (Sección 11.5) | Documento / Artefacto en el Repositorio | Descripción |
| :--- | :--- | :--- |
| **1. Manual breve de instalación y ejecución** | [`docs/manual-instalacion.md`](docs/manual-instalacion.md) | Guía reproducible de requisitos, Docker PostgreSQL, variables `.env`, migraciones, semillas `v1`, ejecución Wi-Fi en Android y pruebas. |
| **2. Colección exportada de pruebas de API** | [`docs/postman/PUKARA_API_Collection.postman_collection.json`](docs/postman/PUKARA_API_Collection.postman_collection.json) | Colección Postman v2.1 con 19 requests organizados en 5 carpetas y scripts de test automáticos (`pm.test`). |
| **3. Casos de prueba documentados (`P01` a `P19`)** | [`docs/casos-de-prueba-p01-p19.md`](docs/casos-de-prueba-p01-p19.md) | Tabla 11.4 ampliada con datos exactos de entrada, resultados esperados/obtenidos y trazabilidad de las 19 pruebas obligatorias. |
| **4. Reporte de pruebas automáticas y paridad** | [`docs/reporte-pruebas-y-paridad-s4d6.md`](docs/reporte-pruebas-y-paridad-s4d6.md) | Inventario de las 34 suites (`298` pruebas), resolución de marcadores `[Completar]`/`[Verificar]` y matriz de paridad contra `PUKARA.pdf`. |
| **5. Evidencia de integración API (`S4D1`)** | [`docs/verificacion-api-s4d1.md`](docs/verificacion-api-s4d1.md) | Certificación de endpoints públicos y administrativos (`P01`, `P03`, `P04`, `P05`, `P07`, `P16`, `P17`). |
| **6. Evidencia de datos faltantes y fallos (`S4D2`)** | [`docs/verificacion-datos-faltantes-s4d2.md`](docs/verificacion-datos-faltantes-s4d2.md) | Verificación de lecturas incompletas (`P02`), fallo de API (`P03`/`T5`) y aislamiento simulación vs. real (`P11`). |
| **7. Evidencia de funcionamiento offline y Android (`S4D3`)** | [`docs/verificacion-offline-android-s4d3.md`](docs/verificacion-offline-android-s4d3.md) | Protocolo y certificación de modo avión (`P08`), permiso GPS denegado (`P09`), mapa sin teselas (`P10`), instalación Android (`P12`) y Haversine (`P18`). |
| **8. Resultado de usabilidad y rendimiento (`S4D4`)** | [`docs/informe-usabilidad-rendimiento-s4d4.md`](docs/informe-usabilidad-rendimiento-s4d4.md) | Evaluación con 5 participantes (`100%` tareas completadas) y benchmark de carga inicial (`287 ms < 3000 ms` — `P19`). |
| **9. Escenario histórico 2019/2024 y Seguridad (`S4D5`)** | [`docs/escenario-referencia-seguridad-s4d5.md`](docs/escenario-referencia-seguridad-s4d5.md) | Ejecución del motor con series históricas de abril 2019 y noviembre 2024 (Sección 11.3) y revisión de seguridad básica (Sección 6.4). |

