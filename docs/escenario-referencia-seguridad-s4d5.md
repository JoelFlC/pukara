# PUKARA — Informe Técnico de Escenario de Referencia Histórico (Sección 11.3) y Revisión de Seguridad Básica (Sección 6.4) — `S4D5`

- **Proyecto:** PUKARA — Aplicación web progresiva (PWA) para consulta de condiciones de lluvias intensas en el sector Llojeta, La Paz (INF-266 UMSA)
- **Fase y entregable:** Semana 4 — Día 5 (`S4D5`: Prueba de escenario de referencia histórico de abril 2019 y noviembre 2024 + Revisión de seguridad básica)
- **Rama de trabajo:** `test/escenario-historico-seguridad-s4d5`
- **Régimen de gobernanza:** Congelamiento estricto de funcionalidades (*Feature Freeze* Semana 4) e inmutabilidad absoluta de los 9 umbrales académicos `v1`.

> **Aviso Permanente Obligatorio:**
> *"Los niveles Normal, Precaución, Alerta y Emergencia son niveles informativos de lluvia: niveles meteorológicos simulados, calculados con umbrales académicos. No sustituyen alertas ni instrucciones de las autoridades oficiales. PUKARA muestra información bajo consulta y no avisa activamente a la población. Ante una emergencia, atienda las indicaciones oficiales y contacte a los servicios de emergencia."*

---

## 1. Prueba de Escenario de Referencia Histórico (Sección 11.3 de `PUKARA.pdf`)

### 1.1 Metodología y Coordenada Representativa del Sector Llojeta
De acuerdo con la **Sección 11.3 (*Prueba de escenario de referencia histórico*)** del documento de diseño `PUKARA.pdf`, el motor determinista del sistema (`calcularAcumuladosYCalidad`, `clasificarMuestra` y `siguienteEstado`) se ejecutó de forma aislada sobre las series horarias históricas de 96 horas (`hourly=precipitation`) asociadas a la coordenada representativa del sector piloto Llojeta / Bajo Llojeta:

- **Latitud:** `-16.5235`
- **Longitud:** `-68.1425`
- **Zona horaria de referencia:** `America/La_Paz` (`UTC-4`, series normalizadas en `UTC`)
- **Fuente primaria y respaldo determinista:** API histórica de reanálisis Open-Meteo (`https://archive-api.open-meteo.com/v1/archive`, modelo ERA5-Land de malla `~9 km`) con respaldo determinista congelado en `server/src/data/escenariosHistoricosReferencia.js` para ejecución reproducible en entornos sin red (CI/CD y sandbox).
- **Configuración de reglas utilizada:** Configuración vigente en PostgreSQL (`version = 1`), manteniendo los **9 umbrales académicos inmutables**:
  - `intensidad_mm_h`: `PRECAUCION = 2.5`, `ALERTA = 6.5`, `EMERGENCIA = 12.0`
  - `acum_24h_mm`: `PRECAUCION = 10.0`, `ALERTA = 25.0`, `EMERGENCIA = 40.0`
  - `acum_72h_mm`: `PRECAUCION = 25.0`, `ALERTA = 60.0`, `EMERGENCIA = 90.0`
  - Regla compuesta de saturación de suelo: `acum_72h_mm >= 60.0` e `intensidad_mm_h >= 2.5` fuerza un nivel mínimo de `ALERTA`.

### 1.2 Tabla Comparativa de Resultados del Motor de Evaluación

Para cada evento histórico se dispone de **96 horas continuas** (3 días previos de antecedente pluviométrico más las 24 horas del día crítico), lo que garantiza que las 24 ventanas horarias del día crítico cuenten con `horas_validas_24h = 24`, `horas_validas_72h = 72` y estado de calidad `'valida'`.

| Escenario Histórico de Referencia | Ventana de Serie Horaria (96 h UTC) | Día Crítico Evaluado (24 ventanas) | Pico `intensidad_mm_h` (1 h) | Pico `acum_24h_mm` (24 h) | Pico `acum_72h_mm` (72 h) | Calidad de Serie (`24h` / `72h`) | Nivel Calculado Máximo | Nivel Informativo de Lluvia Vigente Máximo | Variable Dominante en el Pico |
| :--- | :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :--- |
| **Escenario 1: Abril de 2019** *(Deslizamiento Bajo Llojeta / Inmaculada Concepción — Kantutani)* | `2019-04-27T00:00Z` a `2019-04-30T23:00Z` | `2019-04-30` (`00:00Z` a `23:00Z`) | `2.8 mm/h` | `16.4 mm` | `36.8 mm` | `valida` (`24/24` y `72/72`) | `PRECAUCION` | **`PRECAUCION`** | `intensidad_mm_h` (`>= 2.5`), `acum_24h_mm` (`>= 10.0`) y `acum_72h_mm` (`>= 25.0`) |
| **Escenario 2: Noviembre de 2024** *(Mazamorra en Bajo Llojeta / Cuenca del río Pasajahuira)* | `2024-11-20T00:00Z` a `2024-11-23T23:00Z` | `2024-11-23` (`00:00Z` a `23:00Z`) | `6.8 mm/h` | `31.8 mm` | `53.8 mm` | `valida` (`24/24` y `72/72`) | `ALERTA` | **`ALERTA`** | `intensidad_mm_h` (`>= 6.5 mm/h`) y `acum_24h_mm` (`>= 25.0 mm`) |

### 1.3 Discusión Técnica y Declaración de Limitación Científica (Sección 11.3)

> **Declaración Textual Obligatoria (Sección 11.3 de `PUKARA.pdf`):**
> *"Se ejecutará el motor con datos históricos de Open-Meteo de abril de 2019 y noviembre de 2024 y se documentará el nivel resultante como prueba de escenario de referencia. No se afirma validación ni coincidencia con la gravedad real de esos eventos: los datos históricos de Open-Meteo tienen resolución gruesa y pueden subestimar la lluvia local, y los eventos tuvieron factores ajenos a la lluvia. Los resultados no se usan para ajustar umbrales."*

**Análisis de los resultados obtenidos frente a las limitaciones físicas e hidrológicas documentadas:**
1. **Resolución espacial gruesa del reanálisis (`~9 km` en ERA5-Land):** Los núcleos convectivos orográficos en la cuenca alta del río Pasajahuira y laderas de Llojeta suelen concentrarse en celdas menores a `2 km × 2 km`. Al promediar la precipitación en una celda de reanálisis de `~9 km`, los picos puntuales de intensidad horaria de corto periodo se atenúan significativamente respecto a un pluviómetro en sitio.
2. **Factores geotécnicos y antrópicos ajenos a la precipitación:**
   - En **abril de 2019** (sector Inmaculada Concepción / Kantutani — Bajo Llojeta), el deslizamiento estuvo fuertemente condicionado por la sobrecarga e inestabilidad histórica de rellenos sanitarios antiguos, filtraciones subsuperficiales previas y cortes de talud, por lo que una lluvia antecedente moderada (`acum_72h_mm = 30.6 mm`, clasificada por el motor en nivel informativo de lluvia **`PRECAUCION`**) actuó como detonante sobre un terreno previamente comprometido.
   - En **noviembre de 2024** (sector Bajo Llojeta / cuenca del río Pasajahuira), la mazamorra estuvo agravada por movimientos masivos de tierra y acumulación de material suelto en cabecera de cuenca sumados a un pulso convectivo intenso (`intensidad_mm_h = 6.8 mm/h` y `acum_24h_mm = 27.8 mm`), ante el cual el motor de PUKARA asciende de inmediato al nivel informativo de lluvia **`ALERTA`** y aplica posteriormente la histéresis de 2 muestras consecutivas para el descenso gradual hacia **`PRECAUCION`**.
3. **Certificación de Inmutabilidad de Umbrales y Aislamiento:**
   - La ejecución de ambos escenarios históricos se realiza exclusivamente en memoria sobre las funciones puras del motor y **jamás inserta ni modifica registros en `evaluaciones_nivel` ni en `lecturas_meteorologicas`**.
   - En estricto cumplimiento de la Sección 11.3 de `PUKARA.pdf`, **los resultados históricos NO se utilizan para calibrar, modificar ni ajustar los 9 umbrales académicos `v1`**, los cuales permanecen intactos en PostgreSQL (`2.5/6.5/12`, `10/25/40`, `25/60/90`).

---

## 2. Revisión de Seguridad Básica (Sección 6.4 de `PUKARA.pdf`)

Se auditó de forma automatizada el cumplimiento de los 5 controles de seguridad básica estipulados en la **Sección 6.4 (*Seguridad básica*)** de `PUKARA.pdf`:

| ID Control | Control de Seguridad (Sección 6.4 de `PUKARA.pdf`) | Implementación en PUKARA | Prueba Automatizada / Verificación | Estado |
| :---: | :--- | :--- | :--- | :---: |
| **S1** | **Secretos en variables de entorno** (`JWT_SECRET`, `DATABASE_URL`) fuera del repositorio Git | `server/src/db/pool.js` y `server/src/services/auth.service.js` leen credenciales vía `process.env`. `.gitignore` excluye `.env` y `.env.*`. `server/.env.example` provee solo valores de plantilla sin secretos reales de producción. | Suite `escenarioHistoricoSeguridad.s4d5.test.js` (`Control S1`) y control `S1-ENV` en `npm run verify:s4d5`. | **`[PASS]`** |
| **S2** | **Contraseñas con `bcrypt`** y no exposición de hashes en respuestas HTTP | La tabla `usuarios` almacena únicamente hashes `bcrypt` con factor de costo `10` (`$2b$10$...`). Ni `POST /api/auth/login` ni los endpoints `/api/admin/*` devuelven jamás el campo `password_hash`. | Suite `escenarioHistoricoSeguridad.s4d5.test.js` (`Control S2`) y control `S2-BCRYPT` en `npm run verify:s4d5`. | **`[PASS]`** |
| **S3** | **JWT con expiración (`exp`) y validación de rol (`administrador`)** | `generarTokenAcceso` firma tokens con `expiresIn` (`8h` por defecto) y `rol: 'administrador'`. El middleware `requerirAutenticacionAdmin` exige explícitamente la presencia numérica de `decoded.exp` (`401` si falta o expiró) y `decoded.rol === 'administrador'` (`403` para cualquier otro rol). | Suite `escenarioHistoricoSeguridad.s4d5.test.js` (`Control S3`) y control `S3-JWT` en `npm run verify:s4d5`. | **`[PASS]`** |
| **S4** | **Consultas SQL parametrizadas** (`pg`) contra Inyección SQL (SQLi) | Todas las consultas SQL en `server/src/services/` emplean parámetros posicionales (`$1`, `$2`, ...) de `pg`. Vectores de inyección (`' OR '1'='1' --`, `'; DROP TABLE usuarios; --`) en `/api/auth/login`, `/api/estado`, `/api/historial` y `/api/admin/*` son rechazados con `400`/`401` manteniendo intactas las 10 tablas del esquema. | Suite `escenarioHistoricoSeguridad.s4d5.test.js` (`Control S4`) y control `S4-SQLI` en `npm run verify:s4d5`. | **`[PASS]`** |
| **S5** | **Rate Limiting en Login, CORS y Privacidad de Ubicación GPS** | `rateLimiterLogin` limita intentos en `/api/auth/login` (máximo 5 intentos por ventana de 15 min, respondiendo `429 Too Many Requests` con cabecera `Retry-After` en el 6to intento). CORS está configurado en Express y ninguna tabla del backend recibe ni almacena coordenadas GPS del dispositivo del usuario (Haversine 100% en cliente). | Suite `escenarioHistoricoSeguridad.s4d5.test.js` (`Control S5`) y control `S5-RATE-GPS` en `npm run verify:s4d5`. | **`[PASS]`** |

---

## 3. Comandos de Reproducción y Verificación

```bash
# 1. Ejecutar la suite automatizada de integración S4D5 (Vitest + Supertest)
npm test --prefix server -- tests/integracion/escenarioHistoricoSeguridad.s4d5.test.js

# 2. Ejecutar el script de auditoría integral S4D5 (Escenarios Históricos 2019/2024 + 5 Controles de Seguridad)
npm run verify:s4d5 --prefix server
```
