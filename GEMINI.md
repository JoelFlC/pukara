# PUKARA — Memoria de Arquitectura, Gobernanza y Reglas de Desarrollo

Este documento define las directrices inmutables y de obligado cumplimiento para todo agente y desarrollador en el repositorio **PUKARA** (Sector Llojeta, La Paz).

---

## 1. Stack Tecnológico y Arquitectura de Monolito en Capas
- **Frontend (`/client`):** React 18+ con Vite, Tailwind CSS (enfoque mobile-first), React Router, Leaflet con OpenStreetMap, `vite-plugin-pwa`.
- **Backend (`/server`):** Node.js en modo ESM (`"type": "module"`), Express, PostgreSQL nativo mediante `pg` (Pool).
  - **PROHIBICIÓN ESTRICTA:** Prohibido el uso de ORMs (como Prisma o TypeORM) y de PostGIS. La geometría GeoJSON se gestiona exclusivamente como `JSONB` nativo.
  - Autenticación administrativa con JWT y hashing de contraseñas con `bcrypt`.
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
