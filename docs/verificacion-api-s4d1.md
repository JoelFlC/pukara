# PUKARA — Certificación e Integración de Contratos HTTP de la API (`S4D1`)

## 1. Resumen Ejecutivo

Este documento certifica la verificación de extremo a extremo (End-to-End) de todos los contratos HTTP del backend de **PUKARA** correspondientes al **Día 1 de la Semana 4 (`S4D1`)**, bajo el régimen de congelamiento estricto de funcionalidades (*Feature Freeze*).

La verificación cubre de forma automatizada y reproducible:
- **Consulta pública e ingesta meteorológica resiliente:** Endpoints `/api/salud`, `/api/estado` (contrato `v1`) y `/api/historial`, incluyendo el comportamiento de respaldo ante fallos del proveedor externo Open-Meteo (`P03`) y la unicidad de muestras en ventana de caché de 12 minutos (`P04`).
- **Seguridad, autenticación JWT y control de acceso por rol (`P07`):** Verificación del rechazo sistemático con `HTTP 401` ante ausencia, alteración o expiración de token Bearer, y con `HTTP 403` ante roles sin privilegios administrativos (`operador`, `publico`) en la totalidad del espacio `/api/admin/*`.
- **Motor de evaluación, saturación de cuenca y versionado inmutable (`P01`, `P05`, `P16`, `P17`):** Validación HTTP de las fronteras exactas de clasificación (`>=`), activación del nivel informativo mínimo `ALERTA` por saturación acumulada de 72 horas (`60 mm` + `2.5 mm/h`), rechazo `HTTP 400` de umbrales incoherentes, activación transaccional de nuevas versiones de reglas con reinicio de `contador_descenso = 0` sin recalcular evaluaciones históricas previas y auditoría en `bitacora_cambios`.
- **Aislamiento estricto del modo simulación (`P11`):** Inyección de escenarios meteorológicos simulados y limpieza total sin alterar las lecturas reales ni el estado vigente de consulta pública.

> **Aviso Permanente Institucional:**  
> *"Los niveles Normal, Precaución, Alerta y Emergencia son niveles informativos de lluvia: niveles meteorológicos simulados, calculados con umbrales académicos. No sustituyen alertas ni instrucciones de las autoridades oficiales. PUKARA muestra información bajo consulta y no avisa activamente a la población. Ante una emergencia, atienda las indicaciones oficiales y contacte a los servicios de emergencia."*

---

## 2. Matriz Completa de Endpoints del Sistema

| Método | Ruta | Autenticación | Código Esperado | Prueba Académica Asociada | Descripción / Contrato | Estado |
| :--- | :--- | :--- | :---: | :---: | :--- | :---: |
| `GET` | `/api/salud` | Pública | `200 OK` | `S1D1` / Base | Estado del servicio Express y conexión activa con PostgreSQL (`base_de_datos: "conectado"`). | `[PASS]` |
| `GET` | `/api/estado` | Pública | `200 OK` | `P01`, `P03`, `P04`, `P06` | Entrega contrato `v1`: `nivel_vigente`, `estado_sistema`, lectura y antigüedad, `aviso_permanente`, 4 `recomendaciones_publicadas`, `contactos_emergencia`, 2 `zonas_referencia` GeoJSON (`"referencia de demostración, no validada"`) y 6 `puntos_referencia`. | `[PASS]` |
| `GET` | `/api/estado?modalidad=simulada` | Pública | `200 OK` | `P11` | Consulta aislada del estado en modalidad simulada con `es_simulacion: true` y `banner_simulacion`. | `[PASS]` |
| `GET` | `/api/historial` | Pública | `200 OK` | `P04`, `P11` | Historial paginado (`?modalidad=real\|simulada&limite=10&offset=0`) de evaluaciones y lecturas asociadas. | `[PASS]` |
| `POST` | `/api/simulacion/lectura` | Pública / Demo | `201 Created` | `P01`, `P11`, `P17` | Inyecta una lectura con `modalidad = 'simulada'`, ejecuta el motor de evaluación y devuelve `lectura`, `clasificacion` y `evaluacion` sin alterar datos reales. | `[PASS]` |
| `DELETE` | `/api/simulacion` | Pública / Demo | `200 OK` | `P11` | Elimina todas las lecturas y evaluaciones simuladas, restableciendo la vista al estado real. | `[PASS]` |
| `POST` | `/api/auth/login` | Pública | `200 OK` / `401` | `P07` | Autentica credenciales con `bcrypt` y emite token JWT Bearer con `rol: "administrador"`. Rechaza credenciales inválidas con `401 CREDENCIALES_INVALIDAS`. | `[PASS]` |
| `GET` | `/api/auth/perfil` | Bearer JWT | `200 OK` / `401` | `P07` | Verifica la validez del token activo y retorna el perfil del administrador en sesión (`alias: /api/auth/verificar`). | `[PASS]` |
| `GET` | `/api/admin/configuraciones` | Bearer JWT (`administrador`) | `200 OK` / `401` / `403` | `P05`, `P07` | Lista todas las versiones de `configuraciones_reglas` (`vigente`, `borrador`, `archivada`) con sus 9 umbrales. | `[PASS]` |
| `POST` | `/api/admin/configuraciones` | Bearer JWT (`administrador`) | `201 Created` / `400` | `P05`, `P07`, `P16` | Crea una nueva versión de reglas. Rechaza con `400 CONFIGURACION_INVALIDA` si `PRECAUCION >= ALERTA`, `ALERTA >= EMERGENCIA`, valores negativos o `acum_24h_mm > acum_72h_mm`. | `[PASS]` |
| `POST` | `/api/admin/configuraciones/:id/activar` | Bearer JWT (`administrador`) | `200 OK` / `404` | `P05`, `P07` | Activa una versión de configuración, archiva la anterior, reinicia `contador_descenso = 0` sin recalcular evaluaciones pasadas y registra en `bitacora_cambios`. | `[PASS]` |
| `GET` | `/api/admin/recomendaciones` | Bearer JWT (`administrador`) | `200 OK` | `P07`, `P15` | Lista las recomendaciones preventivas generales con su etiqueta `origen` (`institucional` o `demostracion`). | `[PASS]` |
| `POST` | `/api/admin/recomendaciones` | Bearer JWT (`administrador`) | `201 Created` | `P07`, `P15` | Registra o actualiza la recomendación preventiva de un nivel informativo y audita en `bitacora_cambios`. | `[PASS]` |
| `PUT` | `/api/admin/recomendaciones/:id` | Bearer JWT (`administrador`) | `200 OK` | `P07`, `P15` | Actualiza título, contenido, origen y estado publicado de una recomendación preventiva registrando `valor_anterior` y `valor_nuevo`. | `[PASS]` |
| `GET` | `/api/admin/contactos` | Bearer JWT (`administrador`) | `200 OK` | `P07`, `P15` | Lista el directorio de contactos de emergencia con `fuente`, `verificado_en` y estado `activo`. | `[PASS]` |
| `POST` | `/api/admin/contactos` | Bearer JWT (`administrador`) | `201 Created` | `P07`, `P15` | Crea un nuevo contacto de emergencia institucional y audita el alta en `bitacora_cambios`. | `[PASS]` |
| `PUT` | `/api/admin/contactos/:id` | Bearer JWT (`administrador`) | `200 OK` | `P07`, `P15` | Actualiza números telefónicos, fuente de verificación o vigencia de un contacto de emergencia. | `[PASS]` |
| `GET` | `/api/admin/capas` | Bearer JWT (`administrador`) | `200 OK` | `P07`, `P09` | Obtiene el catálogo administrativo de `zonas_referencia` (2 polígonos GeoJSON) y `puntos_referencia` (6 puntos). | `[PASS]` |
| `PUT` | `/api/admin/zonas/:id` | Bearer JWT (`administrador`) | `200 OK` / `400` | `P07`, `P09` | Actualiza nombre, descripción, geometría GeoJSON (`Polygon`/`MultiPolygon`) o visibilidad de una zona referencial. | `[PASS]` |
| `PUT` | `/api/admin/puntos/:id` | Bearer JWT (`administrador`) | `200 OK` / `400` | `P07`, `P09` | Actualiza metadatos, coordenadas o `estado_verificacion` (`no_verificado` / `referencia_preliminar`) de un punto referencial. | `[PASS]` |
| `GET` | `/api/admin/bitacora` | Bearer JWT (`administrador`) | `200 OK` | `P05`, `P07`, `P15` | Consulta paginada y filtrable por `entidad` de la tabla inmutable `bitacora_cambios` (`valor_anterior` vs. `valor_nuevo`). | `[PASS]` |
| `POST` | `/api/admin/simulacion/lectura` | Bearer JWT (`administrador`) | `201 Created` | `P07`, `P11` | Variante administrativa autenticada para inyección de lecturas simuladas. | `[PASS]` |
| `DELETE` | `/api/admin/simulacion` | Bearer JWT (`administrador`) | `200 OK` | `P07`, `P11` | Variante administrativa autenticada para limpieza de lecturas y evaluaciones simuladas. | `[PASS]` |

---

## 3. Instrucciones de Uso: Colección Postman Oficial

El archivo exportable se encuentra en:
`docs/postman/PUKARA_API_Collection.postman_collection.json`

### Paso a paso para importar y ejecutar en Postman:
1. Abra **Postman** y haga clic en el botón **Import** (esquina superior izquierda).
2. Seleccione el archivo `docs/postman/PUKARA_API_Collection.postman_collection.json`.
3. En el panel de colecciones, seleccione **PUKARA — Colección Oficial de Integración API (S4D1)** y revise la pestaña **Variables**:
   - `baseUrl`: por defecto `http://localhost:3000` (modificable si apunta a otra IP de red local o entorno desplegado).
   - `adminToken`: se autocompleta automáticamente al ejecutar la petición de Login.
   - `configBorradorId`: se autocompleta al crear una nueva versión de umbrales en la carpeta `03`.
4. **Orden recomendado de ejecución (o mediante Collection Runner):**
   - **Carpeta `01 - Salud y Consulta Pública`:** Verifica `/api/salud`, `/api/estado` y `/api/historial`.
   - **Carpeta `02 - Autenticación y Seguridad (P07)`:** Comprueba los rechazos `401` (credenciales inválidas, petición sin token y token adulterado) y ejecuta **Login Exitoso**, cuyo script de post-respuesta guarda automáticamente el JWT en `{{adminToken}}`.
   - **Carpeta `03 - Administración de Reglas y Umbrales (P05, P16)`:** Comprueba el rechazo `400` de umbrales incoherentes (`P16`), crea una configuración borrador válida (`P05`) y la activa.
   - **Carpeta `04 - Administración de Contenidos, Capas y Bitácora`:** Ejecuta lecturas y actualizaciones auditadas sobre recomendaciones preventivas, contactos de emergencia, capas GeoJSON y consulta `GET /api/admin/bitacora`.
   - **Carpeta `05 - Modo Simulación y Demostración (P11)`:** Inyecta el escenario de saturación de suelo (`P17`), verifica el aislamiento en `/api/estado?modalidad=simulada` vs. `/api/estado` real y finaliza con `DELETE /api/simulacion` para dejar la base de datos limpia.

---

## 4. Ejecución de Suites de Integración y Script de Verificación en Vivo

### 4.1 Ejecutar la suite automatizada de integración (`S4D1`) con Vitest y Supertest
Desde la raíz del proyecto (con el contenedor Docker `pukara-postgres` activo):

```bash
npm test --prefix server
```

O para ejecutar exclusivamente la suite de integración `S4D1`:

```bash
npx --prefix server vitest run tests/integracion/apiCompleta.s4d1.test.js
```

### 4.2 Ejecutar el script de verificación en vivo (`verify:api`)
El script `server/src/scripts/verificarApiDespliegue.js` verifica todos los contratos principales sobre `API_BASE_URL` (por defecto `http://127.0.0.1:3000`; si el servidor no está corriendo en ese puerto, levanta automáticamente una instancia efímera local de la aplicación Express para completar la inspección y limpia cualquier dato simulado antes de finalizar):

```bash
npm run verify:api --prefix server
```

