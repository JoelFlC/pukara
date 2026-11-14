# PUKARA — Memoria de Arquitectura, Gobernanza y Reglas de Desarrollo

Este documento define las directrices inmutables y de obligado cumplimiento para todo agente y desarrollador en el repositorio **PUKARA** (Sector Llojeta, La Paz).

---

## 1. Stack Tecnológico y Arquitectura de Monolito en Capas
- **Frontend (`/client`):** React 18+ con Vite, Tailwind CSS (enfoque mobile-first), React Router, Leaflet con OpenStreetMap, `vite-plugin-pwa`.
- **Backend (`/server`):** Node.js en modo ESM (`"type": "module"`), Express, PostgreSQL nativo mediante `pg` (Pool).
  - **PROHIBICIÓN ESTRICTA:** Prohibido el uso de ORMs (como Prisma o TypeORM) y de PostGIS. La geometría GeoJSON se gestiona exclusivamente como `JSONB` nativo.
  - Autenticación administrativa con JWT y hashing de contraseñas con `bcrypt`.
  - **Nota Operativa de Entorno:** PostgreSQL local corre en Docker bajo el contenedor `pukara-postgres` (`docker start pukara-postgres`).
- **Estructura Backend Obligatoria:**
  `/server/src/{routes, services, engine, db, middleware}` y `/server/tests`.
- **Testing Automatizado:** Vitest + Supertest en `/server/tests/`. Cobertura y pruebas en verde obligatorias.
- **Exclusiones Explícitas:** Quedan fuera del alcance Capacitor/APK nativo, Web Push/notificaciones en segundo plano y microservicios.

---

## 2. Semántica y Seguridad Operacional (Lista Negra vs. Lista Blanca)
- **LISTA NEGRA (TERMINANTEMENTE PROHIBIDO en UI, código, rutas, variables o base de datos):**
  `"alerta oficial"`, `"orden de evacuación"`, `"evacuar"`, `"ruta segura"`, `"zona segura"`, `"refugio verificado"`, botones o enlaces tipo `"Cómo llegar"` y redirecciones a Google Maps o Waze.
- **LISTA BLANCA (OBLIGATORIO):**
  `"nivel informativo de lluvia"` con los 4 estados canónicos: `NORMAL`, `PRECAUCION`, `ALERTA`, `EMERGENCIA`.
  `"recomendaciones preventivas generales"`, `"referencia de demostración, no validada"`.
- **Aviso Permanente (OBLIGATORIO en toda vista/interfaz de usuario):**
  > *"Los niveles Normal, Precaución, Alerta y Emergencia son niveles informativos de lluvia: niveles meteorológicos simulados, calculados con umbrales académicos. No sustituyen alertas ni instrucciones de las autoridades oficiales. PUKARA muestra información bajo consulta y no avisa activamente a la población. Ante una emergencia, atienda las indicaciones oficiales y contacte a los servicios de emergencia."*

---

## 3. Contrato Inmutable de Base de Datos (10 Tablas SQL)
Los nombres exactos e inmutables del esquema relacional son:
1. `usuarios`
2. `configuraciones_reglas`
3. `umbrales`
4. `lecturas_meteorologicas`
5. `evaluaciones_nivel`
6. `recomendaciones_preventivas`
7. `contactos_emergencia`
8. `zonas_referencia`
9. `puntos_referencia`
10. `bitacora_cambios`

---

## 4. Rigor del Motor de Evaluación (`Pure Functions First`)
- **Aislamiento Funcional:** Todo algoritmo en `/server/src/engine/` debe implementarse y validarse con pruebas unitarias como funciones puras antes de integrarse con Express o PostgreSQL.
- **Estados de Integridad de Datos:** `SIN_DATOS` y `DATOS_DESACTUALIZADOS` son estados de primer orden. **PROHIBIDO** degradar a `NORMAL` por ausencia o antigüedad de lecturas.
- **Manejo de Nulos:** Huecos o valores nulos en series horarias de Open-Meteo catalogan el acumulado como incompleto. **PROHIBIDO** asumir 0 mm ante datos faltantes.
- **Dinámica de Transición e Histéresis:**
  - El ascenso de nivel es inmediato cuando la métrica alcanza o supera el umbral (`>=`).
  - El descenso requiere histéresis: exige 2 muestras temporales consecutivas e independientes en `observado_en` (descartando lecturas duplicadas de caché de 10-15 min) y desciende hacia el mayor de los dos niveles inferiores.
  - **Regla de Saturación de Suelo:** Si `acum_72h_mm >= 60` y la `intensidad_mm_h >= 2.5`, el nivel resultante se fuerza a un mínimo de `ALERTA`.
- **Aislamiento de Simulación y Versionado:**
  - Las lecturas con `modalidad = 'simulada'` se ejecutan en memoria/aisladas y **NUNCA** alteran el estado real, lecturas reales ni el `contador_descenso`.
  - Los umbrales se versionan de forma inmutable; la creación de una nueva versión no recalcula evaluaciones históricas previas.

---

## 5. Restricciones Geográficas, Cartografía y PWA Offline
- **Visualización Cartográfica:** Polígonos y zonas de referencia se dibujan en tono neutro en el mapa. El nivel informativo es un banner global y **NO** debe colorear los polígonos geográficos.
- **Cálculo de Distancia:** La fórmula Haversine se calcula 100% en el cliente (dispositivo móvil). El GPS del usuario jamás se envía al backend. La distancia debe rotularse como: *"distancia aproximada en línea recta (no es ruta ni indica seguridad)"*. La consulta general permanece totalmente funcional si el usuario deniega permisos de geolocalización.
- **Uso Responsable de Teselas:** Prohibida la precarga o descarga masiva de teselas de `tile.openstreetmap.org`. La URL del proveedor es configurable vía variable de entorno con atribución visible. En modo offline se muestra el aviso: *"Datos del [fecha y hora], no actualizados"*.

---

## 6. Gobernanza Git y Cierre de Sesiones
- Todo desarrollo se realiza en ramas de funcionalidad con prefijo `feat/<nombre-tarea>`.
- Formato obligatorio de commits: `S<semana>D<dia>: <resumen en imperativo>` (ejemplo: `S1D1: Configuración de entorno base y endpoint de salud`).
- **Criterio de Aceptación:** Ninguna sesión puede darse por concluida si existen pruebas automatizadas fallidas (`vitest` en rojo).

---

## 7. Estado Actual del Proyecto y Puerta de Calidad (Cierre Semana 3)
- **Semanas 1, 2 y 3 (`S1D1` a `S3D7`) completadas al 100% en `main`:**
  - Los 5 módulos arquitectónicos se encuentran implementados y plenamente integrados:
    - Módulo 1: Ingesta pluviométrica resiliente desde Open-Meteo y series horarias.
    - Módulo 2: Motor de evaluación por umbrales, histéresis y saturación de cuenca.
    - Módulo 3: Recomendaciones preventivas con etiqueta de origen, contactos verificados y aviso visual in-app.
    - Módulo 4: Cartografía referencial en tonos neutros, Haversine en el cliente y PWA offline.
    - Módulo 5: Autenticación JWT, panel administrativo y bitácora de auditoría inmutable.
  - Certificación integral: 27 suites de pruebas automatizadas en riguroso verde (19 suites / 197 pruebas en `/server` y 8 suites / 61 pruebas en `/client`).
- **Régimen de Congelamiento de Funcionalidades (Feature Freeze Vigente):**
  - Conforme al cierre de la Semana 3, rige congelamiento estricto de funcionalidades para toda la Semana 4 (`S4D1` a `S4D7`).
  - **PROHIBIDO** agregar nuevas funcionalidades, nuevos endpoints o alterar el esquema de base de datos durante la Semana 4.
  - El alcance exclusivo de la Semana 4 comprende:
    1. Verificación y validación cruzada de las 19 pruebas académicas obligatorias (`P01` a `P19`).
    2. Protocolo de campo en dispositivo físico Android real (instalación PWA, modo avión `P08`, mapa parcial `P10` e instalación `P12`).
    3. Evaluación de usabilidad, accesibilidad y rendimiento en dispositivos móviles (`P19`).
    4. Simulación de los escenarios históricos de referencia (abril 2019 y noviembre 2024 en Llojeta).
    5. Documentación de cierre del proyecto y preparación para la defensa académica.
- **Avance de la Semana 4 (`S4D1` a `S4D7`):**
  - `S4D1` completado (Suite de integración API completa + Colección Postman v2.1 + `P01`, `P03`, `P04`, `P05`, `P07`, `P16`, `P17` verificadas — 21 suites / 212 pruebas en `/server` y 8 suites / 61 pruebas en `/client`).
  - `S4D2` completado (Verificación de datos faltantes `P02`, fallos de API `P03`/`T5` y aislamiento simulación vs real `P11` documentados y en verde — 22 suites / 217 pruebas en `/server` y 8 suites / 61 pruebas en `/client`).
  - `S4D3` completado (Verificación PWA Offline `P08`, GPS denegado `P09`, Mapa sin teselas `P10`, Aviso in-app `P06`, Instalación Android `P12` y Haversine 4 ubicaciones `P18` en verde — 22 suites / 217 pruebas en `/server` y 9 suites / 68 pruebas en `/client`).
  - `S4D4` completado (Prueba de usabilidad con 5 participantes y medición de rendimiento `P19` `< 3s` certificadas y en verde — 23 suites / 220 pruebas en `/server` y 10 suites / 70 pruebas en `/client`).
  - `S4D5` completado (Escenario de referencia histórico abril 2019 y noviembre 2024 — Sección 11.3 — y auditoría automatizada de seguridad básica — Sección 6.4 — en verde — 24 suites / 228 pruebas en `/server` y 10 suites / 70 pruebas en `/client`).
  - `S4D6` completado (Manual de instalación, Tabla 11.4 ampliada P01-P19, Reporte de pruebas y paridad, y README.md final completados y auditados — 24 suites / 228 pruebas en `/server` y 10 suites / 70 pruebas en `/client`).
  - `S4D7` completado (Guion de defensa final, script `pre-defensa`, respaldo JSON de despliegue, suite de ensayo integral en 5 actos y cierre de Semana 4 — 25 suites / 233 pruebas en `/server` y 10 suites / 70 pruebas en `/client` — **35 suites / 303 pruebas totales en riguroso verde**).
- **ESTADO FINAL DEL PROYECTO:** **Semanas 1, 2, 3 y 4 (`S1D1` a `S4D7`) 100% COMPLETADAS — PROYECTO CERRADO Y LISTO PARA DEFENSA FINAL.**
