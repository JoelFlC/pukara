# PUKARA — Acta de Cierre Final de la Semana 4 y Certificación 100% del Proyecto (`S4D7`)

- **Proyecto:** PUKARA — Aplicación web progresiva (PWA) para consulta de condiciones de lluvias intensas en el sector Llojeta, La Paz
- **Asignatura:** INF-266 Taller de Proyecto — Carrera de Informática, Facultad de Ciencias Puras y Naturales, Universidad Mayor de San Andrés (UMSA)
- **Docente:** Ph.D. Brigida Alexandra Carvajal Blanco
- **Estudiante:** Joel Fernando Flores Choque
- **Estado del Cronograma (28 Días: `S1D1` a `S4D7`):** **`100% COMPLETADO — LISTO PARA DEFENSA FINAL`**

> **Aviso Permanente Obligatorio:**
> *"Los niveles Normal, Precaución, Alerta y Emergencia son niveles informativos de lluvia: niveles meteorológicos simulados, calculados con umbrales académicos. No sustituyen alertas ni instrucciones de las autoridades oficiales. PUKARA muestra información bajo consulta y no avisa activamente a la población. Ante una emergencia, atienda las indicaciones oficiales y contacte a los servicios de emergencia."*

---

## 1. Resumen Ejecutivo del Cierre de la Semana 4 (`S4D1` a `S4D7`)

Conforme al plan de trabajo establecido en `PUKARA.pdf` y `PUKARACronograma.pdf`, durante la **Semana 4 (`S4D1` a `S4D7`)** se mantuvo un régimen estricto de **congelamiento de funcionalidades (*Feature Freeze*)**, dedicando los 7 días exclusivamente a la verificación exhaustiva, pruebas en dispositivo físico Android, evaluación de usabilidad y rendimiento, prueba de escenarios históricos de referencia, auditoría de seguridad y consolidación del paquete de evidencias:

| Día | Entregable Ejecutado y Fusionado en `main` | Evidencia Principal en el Repositorio | Estado |
| :-: | :--- | :--- | :---: |
| **`S4D1`** | Suite de integración de API completa + Colección Postman v2.1 (`P01`, `P03`, `P04`, `P05`, `P07`, `P16`, `P17`) | `docs/verificacion-api-s4d1.md`, `docs/postman/PUKARA_API_Collection.postman_collection.json` | **`100% COMPLETADO`** |
| **`S4D2`** | Verificación de datos faltantes (`P02`), fallos de API (`P03`/`T5`) y aislamiento simulación vs. real (`P11`) | `docs/verificacion-datos-faltantes-s4d2.md`, `server/tests/integracion/resilienciaFallos.s4d2.test.js` | **`100% COMPLETADO`** |
| **`S4D3`** | Verificación PWA Offline (`P08`), GPS denegado (`P09`), mapa parcial (`P10`), aviso in-app (`P06`), Android (`P12`) y Haversine (`P18`) | `docs/verificacion-offline-android-s4d3.md`, `client/src/tests/integracionPwaOffline.s4d3.test.jsx` | **`100% COMPLETADO`** |
| **`S4D4`** | Prueba de usabilidad con 5 participantes (`100%` éxito) y benchmark de rendimiento (`287 ms < 3000 ms` — `P19`) | `docs/informe-usabilidad-rendimiento-s4d4.md`, `server/src/scripts/medirRendimientoP19.js` | **`100% COMPLETADO`** |
| **`S4D5`** | Escenario histórico de referencia (abril 2019 y noviembre 2024 — Sección 11.3) y seguridad básica (Sección 6.4) | `docs/escenario-referencia-seguridad-s4d5.md`, `server/src/scripts/ejecutarEscenarioReferenciaSeguridadS4D5.js` | **`100% COMPLETADO`** |
| **`S4D6`** | Manual de instalación, Tabla 11.4 ampliada (`P01`–`P19`), reporte de paridad, `README.md` y auditor de evidencias | `docs/manual-instalacion.md`, `docs/casos-de-prueba-p01-p19.md`, `docs/reporte-pruebas-y-paridad-s4d6.md` | **`100% COMPLETADO`** |
| **`S4D7`** | Ensayo integral de demostración (5 actos), script `pre-defensa`, respaldo JSON y guion de defensa final | `docs/guion-defensa-final-s4d7.md`, `server/src/scripts/prepararDefensaS4D7.js`, `server/tests/integracion/ensayoDefensa.s4d7.test.js` | **`100% COMPLETADO`** |

---

## 2. Certificación de los 6 Criterios para Considerar el Proyecto 100% Finalizado (`PUKARACronograma.pdf`)

| # | Criterio Oficial de Finalización (`PUKARACronograma.pdf`) | Evidencia de Cumplimiento en PUKARA | Veredicto |
| :-: | :--- | :--- | :---: |
| **1** | **Las 4 semanas del cronograma (`S1D1` a `S4D7`) están cerradas sin tareas pendientes** | Los 28 días de desarrollo y verificación están registrados en el historial de Git (`main`), con los 5 módulos arquitectónicos y las 10 tablas SQL operativas. | **`CUMPLIDO AL 100%`** |
| **2** | **Las 19 pruebas obligatorias (`P01` a `P19`) están verificadas, documentadas y aprobadas** | Documentadas con datos exactos de entrada y resultados en `docs/casos-de-prueba-p01-p19.md` y respaldadas por pruebas automatizadas. | **`CUMPLIDO AL 100%`** |
| **3** | **Todas las suites de pruebas automatizadas pasan en verde (`0` fallos)** | **35 suites automatizadas en verde (`303` pruebas totales):** `25` suites (`233` pruebas) en `/server` y `10` suites (`70` pruebas) en `/client`. | **`CUMPLIDO AL 100%`** |
| **4** | **La PWA está probada en un dispositivo Android físico real, incluyendo modo avión (`P08`) y mapa parcial (`P10`)** | Certificada en teléfono Android real (`standalone`), mostrando *"Datos del [fecha y hora], no actualizados"* en modo avión (`P08`) y *"distancia aproximada en línea recta (no es recomendación de ruta ni indica seguridad)"* (`P18`). | **`CUMPLIDO AL 100%`** |
| **5** | **El paquete de evidencias (Sección 11.5) está completo y auditado** | Auditado en `[PASS]` por `npm run verify:evidencias --prefix server` y respaldado por `docs/evidencias/respaldo-estado-defensa.json` generado por `npm run pre-defensa --prefix server`. | **`CUMPLIDO AL 100%`** |
| **6** | **Las delimitaciones éticas, semánticas y meteorológicas (Secciones 11.2 y 11.3) están declaradas en la interfaz y en la documentación** | Toda vista exhibe el **Aviso Permanente**, utiliza exclusivamente `"nivel informativo de lluvia"`, `"recomendaciones preventivas generales"` y `"referencia de demostración, no validada"`, y documenta los escenarios de abril 2019 y noviembre 2024 sin ajustar los umbrales `v1`. | **`CUMPLIDO AL 100%`** |
