<div align="center">

<img src="client/public/assets/mascota/zorritoSaludo.png" alt="Zorrito PUKARA saludando" width="165" />
&nbsp;&nbsp;
<img src="client/public/pukara.png" alt="PUKARA" width="320" />

<h3>Aplicación Web Progresiva (PWA) para Consulta de Condiciones de Lluvias Intensas<br />Sector Llojeta / Bajo Llojeta · La Paz, Bolivia</h3>

![React 19 + Vite](https://img.shields.io/badge/Frontend-React_19_%2B_Vite_8-1E293B?style=for-the-badge&logo=react&logoColor=38BDF8)
![Node.js + PostgreSQL](https://img.shields.io/badge/Backend-Node.js_%2B_PostgreSQL_15-0F172A?style=for-the-badge&logo=postgresql&logoColor=60A5FA)
![Swiss Grid + Claymorphism](https://img.shields.io/badge/Design-Swiss_Grid_%2B_Claymorphism-E2E8F0?style=for-the-badge&labelColor=334155)
![PWA Workbox](https://img.shields.io/badge/Offline_First-PWA_Workbox-0D9488?style=for-the-badge)
![Tests](https://img.shields.io/badge/Calidad-43_Suites_%C2%B7_344_Tests_PASS-15803D?style=for-the-badge)

</div>

<br />

| Campo Académico | Detalle Institucional |
| :--- | :--- |
| **Universidad** | Universidad Mayor de San Andrés (UMSA) |
| **Facultad y Carrera** | Facultad de Ciencias Puras y Naturales — Carrera de Informática |
| **Asignatura** | INF-266 Taller de Proyecto |
| **Docente** | Ph.D. Brigida Alexandra Carvajal Blanco |
| **Estudiante** | Joel Fernando Flores Choque |
| **Gestión** | 2026 |

---

> [!WARNING]
> ### AVISO PERMANENTE OBLIGATORIO
> *"Los niveles Normal, Precaución, Alerta y Emergencia son niveles informativos de lluvia: niveles meteorológicos simulados, calculados con umbrales académicos. No sustituyen alertas ni instrucciones de las autoridades oficiales. PUKARA muestra información bajo consulta y no avisa activamente a la población. Ante una emergencia, atienda las indicaciones oficiales y contacte a los servicios de emergencia."*

---

## 1. Resumen Ejecutivo y Estética Visual (Swiss Grid + Claymorfismo Responsive)

**PUKARA** es una aplicación web progresiva (**PWA**) de consulta ciudadana, accesibilidad preventiva y demostración académica diseñada para el sector piloto **Llojeta / Bajo Llojeta** (macrodistrito Cotahuma, La Paz — coordenada representativa: **`latitud -16.5235, longitud -68.1425`**).

El sistema ingesta series horarias y lecturas actuales de precipitación desde **Open-Meteo**, calcula el **nivel informativo de lluvia** en cuatro estados canónicos (`NORMAL`, `PRECAUCION`, `ALERTA`, `EMERGENCIA`) junto con los estados de integridad `SIN_DATOS` y `DATOS_DESACTUALIZADOS`, presenta **recomendaciones preventivas generales** con su etiqueta de origen (*"referencia de demostración, no validada"*), expone contactos verificados, dibuja cartografía de referencia en tonos neutros con cálculo local de **distancia aproximada en línea recta (no es ruta ni indica seguridad)** y opera sin conexión mostrando el último estado almacenado bajo el aviso *"Datos del [fecha y hora], no actualizados"*.

### Lineamientos Visuales (`DESIGN.md`)
- **Retícula y Profundidad:** Arquitectura **Swiss Grid** combinada con **Claymorfismo sutil** sobre superficie base `#F6F8FA` y contenedores táctiles en niveles pastel con contraste AAA.
- **Tipografía y Ergonomía Inclusiva:** Jerarquía legible en `Plus Jakarta Sans` + `Inter` (`>= 16px` en textos de lectura) y controles táctiles de `>= 48px` pensados tanto para jóvenes como para adultos mayores.
- **Scrollytelling Responsive y Movimiento Seguro:** Experiencia *mobile-first* adaptable a escritorio (`1200px+`), barra inferior móvil y microinteracciones orgánicas con respeto estricto a `prefers-reduced-motion`.

---

## 2. Capacidades Interactivas e Inclusivas (Fases 1, 2 y 2.5)

### A. Avisos Preventivos Locales (100% Offline)
- **Motor Acústico Web Audio API (`audioAvisos.js`):** Síntesis en el navegador sin archivos externos ni red, diferenciada por nivel (`NORMAL`, `PRECAUCION`, `ALERTA`) y sirena dual de alta urgencia con compresor dinámico para `EMERGENCIA`.
- **Vibración, Notificaciones y Pulso Visual:** Patrones hápticos diferenciados (`navigator.vibrate`), notificaciones locales PWA mediante Service Worker cuando la pestaña está en segundo plano y pulso visual de fondo blanco ↔ rojo (`< 3 Hz`, respetando `prefers-reduced-motion`) durante escenarios de `EMERGENCIA`.
- **Control Rápido Sin Ruido Visual:** El interruptor de avisos sonoros preventivos vive integrado en el diálogo del asistente y se acompaña de un botón rápido *"Detener sonido"* cuando un tono está activo.

### B. Asistente Preventivo "Zorrito", Voz TTS y Checklist Familiar Offline
El módulo inclusivo acompaña al ciudadano con lectura por voz en el dispositivo (Web Speech API con prioridad de voces en español y ejecución síncrona compatible con Android Chrome), botones de audio en el banner principal, recomendaciones y las cuatro tarjetas meteorológicas, además de un **Checklist Familiar Offline** de 6 ítems esenciales persistido en `localStorage`.

<div align="center">

| Saludo Inicial | En Espera (Recuadro) | Lectura por Voz (TTS) | Precaución / Emergencia |
| :---: | :---: | :---: | :---: |
| <img src="client/public/assets/mascota/zorritoSaludo.png" alt="Zorrito saludando" width="88" /> | <img src="client/public/assets/mascota/zorrito.png" alt="Zorrito en espera" width="88" /> | <img src="client/public/assets/mascota/zorritoCartel.png" alt="Zorrito con cartel informativo" width="88" /> | <img src="client/public/assets/mascota/zorritoMegafono.png" alt="Zorrito con megáfono" width="88" /> |
| Entrada animada al centro con bienvenida y transición sutil al recuadro. | Estado reposo en esquina inferior derecha con acceso al chat y checklist. | Sale del recuadro en mayor tamaño sosteniendo su cartel al reproducir voz. | Reacción animada con megáfono y halo difuso cuando el nivel es `ALERTA` o `EMERGENCIA`. |

</div>

### C. Asistente Híbrido con LLM en Cascada (`POST /api/asistente`)
- **Cascada de 3 Niveles con Tolerancia a Fallos:**
  1. **Nivel 1 — LLM en la Nube:** Groq o Google Gemini (opcional mediante variables de entorno en `server/.env`).
  2. **Nivel 2 — LLM Local Privado:** Ollama local (`http://127.0.0.1:11434/api/chat`, modelo ligero `qwen2.5:0.5b`).
  3. **Nivel 3 — Motor Determinista Offline:** Respuestas seguras basadas en contexto en vivo y base de conocimiento local cuando no hay proveedores activos o no hay conexión.
- **Guardrails Semánticos y Protección:** Censura estricta de términos prohibidos en prompt y salida (`asistenteGuardrails.js`), prohibición de reclasificar niveles (el motor determinista permanece intacto) y *rate limiting* de `20 req/min` por IP.

---

## 3. Los 5 Módulos Arquitectónicos Core y Umbrales Académicos `v1`

### Los 5 Módulos Arquitectónicos Implementados
1. **Módulo 1 — Ingesta y Series Pluviométricas (Open-Meteo):** Consulta horaria (`hourly=precipitation`) y actual (`current`), normalización UTC, caché en servidor de `12 minutos`, unicidad por `observado_en` y tolerancia a valores nulos o caídas de red (`P02`, `P03`, `P04`).
2. **Módulo 2 — Motor de Evaluación por Umbrales, Histéresis y Saturación:** Funciones puras deterministas para clasificación con `>=` (`P01`), ascenso inmediato (`P13`), histéresis de descenso con 2 muestras independientes consecutivas (`P14`), regla compuesta de saturación de cuenca (`P17`), estados `DATOS_DESACTUALIZADOS` / `SIN_DATOS` (`P15`) y aislamiento entre modo real y simulación (`P11`).
3. **Módulo 3 — Recomendaciones Preventivas, Contactos y Aviso In-App:** Tarjetas de **recomendaciones preventivas generales** rotuladas con *"referencia de demostración, no validada"*, contactos verificados (Red 114 GAMLP, Bomberos 119, Radio Patrullas 110, Defensa Civil 115) y aviso visual in-app cuando cambia el nivel con la aplicación abierta (`P06`).
4. **Módulo 4 — Cartografía Referencial en Tonos Neutros, Haversine en Cliente y PWA Offline:** Polígonos GeoJSON de Llojeta en color neutro, 6 puntos de referencia, cálculo 100% en cliente de **distancia aproximada en línea recta** con Haversine (`P18`), degradación elegante si se deniega el permiso GPS (`P09`) o si faltan teselas (`P10`), e instalación/consulta offline en Android (`P08`, `P12`).
5. **Módulo 5 — Autenticación JWT, Panel Administrativo y Bitácora Inmutable:** Inicio de sesión con `bcrypt` y Rate Limiting, control de acceso por rol `administrador` (`P07`), versionado inmutable de umbrales con validación matemática previa (`P05`, `P16`), inyección de escenarios simulados (`P11`) y auditoría completa en `bitacora_cambios`.

### Tabla de los 9 Umbrales Académicos `v1` y Regla Compuesta de Saturación

| Variable Pluviométrica | Nivel `NORMAL` | Nivel `PRECAUCION` (`>=`) | Nivel `ALERTA` (`>=`) | Nivel `EMERGENCIA` (`>=`) | Ventana Mínima Válida |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **Intensidad horaria (`intensidad_mm_h`)** | `< 2.5 mm/h` | **`2.5 mm/h`** | **`6.5 mm/h`** | **`12.0 mm/h`** | `1 / 1` hora válida |
| **Acumulado 24 horas (`acum_24h_mm`)** | `< 10.0 mm` | **`10.0 mm`** | **`25.0 mm`** | **`40.0 mm`** | `24 / 24` horas válidas |
| **Acumulado 72 horas (`acum_72h_mm`)** | `< 25.0 mm` | **`25.0 mm`** | **`60.0 mm`** | **`90.0 mm`** | `72 / 72` horas válidas |

- **Regla Compuesta de Saturación de Suelo (`P17`):** Si `acum_72h_mm >= 60.0 mm` **y** `intensidad_mm_h >= 2.5 mm/h`, el nivel resultante se eleva como mínimo a **`ALERTA`**, aun cuando ninguna variable individual alcance el umbral de `ALERTA` por separado.

---

## 4. Arquitectura y Stack Tecnológico (Monolito en Capas)

- **Frontend (`/client`):** React 19 + Vite 8, Tailwind CSS 4 (*mobile-first*, Swiss Grid + Claymorfismo), React Router 7, Leaflet 1.9 con teselas configurables de OpenStreetMap, Web Audio API + Web Speech API y `vite-plugin-pwa` (Workbox Service Worker + Web App Manifest).
- **Backend (`/server`):** Node.js (`v20+` en modo ESM `"type": "module"`), Express 4, cliente nativo `pg` (`Pool`) hacia PostgreSQL 15+ (sin ORMs ni PostGIS; geometrías GeoJSON almacenadas como `JSONB`), autenticación JWT (`jsonwebtoken`), hashing `bcrypt` y servicio híbrido en cascada para el asistente.
- **Base de Datos Relacional (10 Tablas Inmutables en PostgreSQL):**
  `usuarios`, `configuraciones_reglas`, `umbrales`, `lecturas_meteorologicas`, `evaluaciones_nivel`, `recomendaciones_preventivas`, `contactos_emergencia`, `zonas_referencia`, `puntos_referencia` y `bitacora_cambios`.
- **Testing y Aseguramiento de Calidad:** Vitest + Supertest (**43 suites automatizadas / 344 pruebas en verde**: `26` suites / `239` pruebas en `/server` y `17` suites / `105` pruebas en `/client`).

---

## 5. Guía Rápida de Inicio, Configuración LLM Opcional y Credenciales `/admin`

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

### Configuración Opcional del Asistente Híbrido (LLM en Cascada)
Si deseas habilitar respuestas generativas por encima del modo determinista offline:
- **Opción Local (Ollama):** ejecuta `ollama run qwen2.5:0.5b` (el backend consulta automáticamente `http://127.0.0.1:11434/api/chat`).
- **Opción Cloud (Groq o Gemini):** define `LLM_PROVIDER` y `GROQ_API_KEY` o `GEMINI_API_KEY` en `server/.env` (ver [`server/.env.example`](server/.env.example)).

### Credenciales de Demostración del Panel Administrativo (`/admin`)
- **URL del Panel Administrativo:** `http://localhost:5173/admin`
- **Correo electrónico:** `admin@pukara.bo`
- **Contraseña:** `PukaraAdmin2026!`

### Ejecución de Suites de Pruebas y Scripts Verificadores

```bash
# Ejecutar las 26 suites del backend (239 tests) y las 17 suites del cliente (105 tests)
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

## 6. Índice del Paquete de Evidencias (Sección 11.5 de `PUKARA.pdf`)

| Entregable Oficial (Sección 11.5) | Documento / Artefacto en el Repositorio | Descripción |
| :--- | :--- | :--- |
| **1. Manual breve de instalación y ejecución** | [`docs/manual-instalacion.md`](docs/manual-instalacion.md) | Guía reproducible de requisitos, Docker PostgreSQL, variables `.env`, migraciones, semillas `v1`, ejecución Wi-Fi en Android y pruebas. |
| **2. Colección exportada de pruebas de API** | [`docs/postman/PUKARA_API_Collection.postman_collection.json`](docs/postman/PUKARA_API_Collection.postman_collection.json) | Colección Postman v2.1 con 19 requests organizados en 5 carpetas y scripts de test automáticos (`pm.test`). |
| **3. Casos de prueba documentados (`P01` a `P19`)** | [`docs/casos-de-prueba-p01-p19.md`](docs/casos-de-prueba-p01-p19.md) | Tabla 11.4 ampliada con datos exactos de entrada, resultados esperados/obtenidos y trazabilidad de las 19 pruebas obligatorias. |
| **4. Reporte de pruebas automáticas y paridad** | [`docs/reporte-pruebas-y-paridad-s4d6.md`](docs/reporte-pruebas-y-paridad-s4d6.md) | Inventario base de certificación, resolución de marcadores `[Completar]`/`[Verificar]` y matriz de paridad contra `PUKARA.pdf`. |
| **5. Evidencia de integración API (`S4D1`)** | [`docs/verificacion-api-s4d1.md`](docs/verificacion-api-s4d1.md) | Certificación de endpoints públicos y administrativos (`P01`, `P03`, `P04`, `P05`, `P07`, `P16`, `P17`). |
| **6. Evidencia de datos faltantes y fallos (`S4D2`)** | [`docs/verificacion-datos-faltantes-s4d2.md`](docs/verificacion-datos-faltantes-s4d2.md) | Verificación de lecturas incompletas (`P02`), fallo de API (`P03`/`T5`) y aislamiento simulación vs. real (`P11`). |
| **7. Evidencia de funcionamiento offline y Android (`S4D3`)** | [`docs/verificacion-offline-android-s4d3.md`](docs/verificacion-offline-android-s4d3.md) | Protocolo y certificación de modo avión (`P08`), permiso GPS denegado (`P09`), mapa sin teselas (`P10`), instalación Android (`P12`) y Haversine (`P18`). |
| **8. Resultado de usabilidad y rendimiento (`S4D4`)** | [`docs/informe-usabilidad-rendimiento-s4d4.md`](docs/informe-usabilidad-rendimiento-s4d4.md) | Evaluación con 5 participantes (`100%` tareas completadas) y benchmark de carga inicial (`< 3000 ms` — `P19`). |
| **9. Escenario histórico 2019/2024 y Seguridad (`S4D5`)** | [`docs/escenario-referencia-seguridad-s4d5.md`](docs/escenario-referencia-seguridad-s4d5.md) | Ejecución del motor con series históricas de abril 2019 y noviembre 2024 (Sección 11.3) y revisión de seguridad básica (Sección 6.4). |
