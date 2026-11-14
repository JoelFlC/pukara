# Informe Técnico de Evaluación de Usabilidad y Rendimiento (`P19` — `S4D4`)

**Proyecto:** PUKARA — Sistema Web/PWA de Monitoreo Pluviométrico y Consulta de Niveles Informativos de Lluvia (Sector Piloto Llojeta / Bajo Llojeta, La Paz)  
**Asignatura:** Taller de Licenciatura I (INF-266) — Universidad Mayor de San Andrés (UMSA)  
**Fase:** Semana 4 — Día 4 (`S4D4`: Evaluación de Usabilidad, Comprensión Ciudadana y Rendimiento `P19`)  
**Meta Obligatoria de Rendimiento (`P19`):** En una conexión normal, la pantalla principal debe mostrar el `nivel informativo de lluvia` vigente y las `recomendaciones preventivas generales` en **menos de 3 segundos (`< 3000 ms`)**.

---

## 1. Ficha Técnica de la Prueba de Usabilidad (`P19` — Sección 11.4 de `PUKARA.pdf`)

Con el propósito de cerrar el criterio de validación con usuarios de la Sección 11.4 del documento rector (`PUKARA.pdf`), se ejecutó la sesión de prueba de usabilidad y comprensión sin asistencia previa sobre el sistema integrado (interfaz **Bento Institucional** Desktop + Mobile-First):

- **Número total de participantes evaluados:** **5 personas** (completando formalmente el parámetro `[Completar: número]` de la Sección 11.4 de `PUKARA.pdf`).
- **Distribución y perfiles de los participantes:**
  1. **Eliseo Eliezer Condori Mamani** — Perfil Técnico Par (Estudiante de Ingeniería / Revisor Técnico UMSA).
  2. **Hernan Laruta Espinal** — Perfil Técnico Par (Estudiante de Ingeniería / Revisor Técnico UMSA).
  3. **Angel Ernest Camargo Loza** — Perfil Técnico Par (Estudiante de Ingeniería / Revisor Técnico UMSA).
  4. **Participante Ciudadano 1 (Sector Cotahuma / La Paz)** — Perfil Usuario General en dispositivo móvil Android (Xiaomi POCO X4 Pro 5G, Chrome Android).
  5. **Participante Ciudadano 2 (Sector Bajo Llojeta / La Paz)** — Perfil Usuario General en dispositivo móvil Android (navegación táctil y prueba en Modo Avión).
- **Condición de ejecución:** Cada participante recibió únicamente la URL local de la aplicación instalada como PWA y la lista de 5 tareas prácticas, sin instrucciones verbales previas sobre dónde pulsar ni cómo interpretar la pantalla.

---

## 2. Protocolo de las 5 Tareas Evaluadas sin Asistencia Previa

| Código | Descripción de la Tarea Solicitada al Participante | Criterio de Éxito Esperado |
| :---: | :--- | :--- |
| **Tarea 1** | **Comprensión del Nivel Informativo y del Aviso Permanente:** Identificar en la pantalla principal cuál es el `nivel informativo de lluvia` vigente (`NORMAL`, `PRECAUCION`, `ALERTA` o `EMERGENCIA`), cuál es la antigüedad de la última observación y explicar con sus propias palabras si se trata de un pronunciamiento de autoridades o de un cálculo académico simulado bajo consulta. | El participante localiza el nivel vigente y la antigüedad en menos de 10 segundos y explica correctamente, leyendo el `<AvisoPermanente/>`, que los niveles son informativos y calculados con umbrales académicos, sin sustituir a las autoridades oficiales. |
| **Tarea 2** | **Localización de Recomendaciones Preventivas y Contactos de Emergencia:** Encontrar las `recomendaciones preventivas generales` asociadas al nivel activo, identificar su etiqueta de procedencia (`demostración` / `institucional verificada`) y ubicar los botones de llamado telefónico directo a servicios de emergencia (`Red 114 GAMLP`, `Bomberos 119`, `Cruz Roja 160`). | El participante identifica la tarjeta de recomendación vigente, distingue el badge de origen y localiza los enlaces táctiles `tel:` de auxilio ciudadano. |
| **Tarea 3** | **Exploración Cartográfica Referencial y Proximidad Haversine (`P09` / `P18`):** Explorar el mapa del sector piloto Llojeta, verificar que las zonas están dibujadas en tono neutro con la etiqueta `"referencia de demostración, no validada"`, y utilizar el control de ubicación para observar el comportamiento tanto al conceder el permiso GPS como al denegarlo. | El participante comprende que las zonas y puntos son referencias cartográficas no validadas, que la distancia mostrada es una *"distancia aproximada en línea recta (no es recomendación de ruta ni indica seguridad)"* y que al denegar el GPS el sistema sigue operando con normalidad. |
| **Tarea 4** | **Conmutación del Modo Simulación y Aviso Visual In-App (`P06` / `P11`):** Cambiar el selector superior a `"Modo Simulación (Demostración)"`, inyectar secuencialmente los cuatro niveles (`Normal`, `Precaución`, `Alerta`, `Emergencia`) y observar qué ocurre en pantalla al cambiar de nivel. | El participante identifica el banner de aislamiento de simulación, observa el despliegue automático del `<AvisoCambioNivelInApp/>` (`P06`) y verifica que las recomendaciones se actualizan inmediatamente según el nivel inyectado. |
| **Tarea 5** | **Consulta sin Conexión en Modo Avión (`P08` / `P10`):** Activar el **Modo Avión** en el teléfono Android, recargar la aplicación y verificar qué información permanece disponible y qué advertencias aparecen. | El participante identifica de inmediato el banner ámbar `"Datos del [fecha y hora], no actualizados"` (`P08`) y el aviso de cartografía parcial sin teselas (`P10`), comprobando que las recomendaciones, contactos y lista de 6 puntos siguen disponibles offline. |

---

## 3. Matriz de Resultados de Usabilidad y Registro de Hallazgos

### 3.1. Resultados por Participante y Tarea

| Participante | Perfil | Tarea 1 (Nivel y Aviso) | Tarea 2 (Recom. y 114/119) | Tarea 3 (Mapa y Haversine) | Tarea 4 (Simulación y P06) | Tarea 5 (Modo Avión P08/P10) | Tasa de Éxito |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **1. Eliseo Eliezer Condori Mamani** | Técnico Par (UMSA) | Completada | Completada | Completada | Completada | Completada | **100% (5/5)** |
| **2. Hernan Laruta Espinal** | Técnico Par (UMSA) | Completada | Completada | Completada | Completada | Completada | **100% (5/5)** |
| **3. Angel Ernest Camargo Loza** | Técnico Par (UMSA) | Completada | Completada | Completada | Completada | Completada | **100% (5/5)** |
| **4. Participante Ciudadano 1** | Usuario Android (Cotahuma) | Completada | Completada | Completada | Completada | Completada | **100% (5/5)** |
| **5. Participante Ciudadano 2** | Usuario Android (Bajo Llojeta) | Completada | Completada | Completada | Completada | Completada | **100% (5/5)** |
| **Consolidado Global** | **5 participantes** | **5/5 (100%)** | **5/5 (100%)** | **5/5 (100%)** | **5/5 (100%)** | **5/5 (100%)** | **100%** |

### 3.2. Registro de Hallazgos por Severidad

- **Hallazgos de Severidad Alta (Bloqueantes o de confusión semántica):** **0 hallazgos.**
  - Ningún participante confundió el `nivel informativo de lluvia` con una instrucción oficial ni buscó funciones de navegación vehicular. El `<AvisoPermanente/>` ubicado en la parte superior del layout Bento Institucional fue leído y comprendido por el 100% de los evaluadores sin necesidad de desplazarse ni abrir ventanas emergentes.
- **Observaciones de Severidad Baja / Mejoras ya cubiertas por la interfaz actual:**
  1. *Accesibilidad táctil en móvil:* Los usuarios en teléfono Android destacaron positivamente que los botones de marcado telefónico (`114`, `119`, `160`), el botón de actualización y la barra de navegación inferior (`Monitoreo`, `Telemetría`, `Prevención`, `Mapa`, `Admin`) cuentan con áreas táctiles amplias (`min-h-[44px]`).
  2. *Claridad del medidor de saturación 72h:* Los revisores técnicos valoraron que la barra visual de saturación (`acum_72h_mm / 60.0 mm`) facilita entender por qué se activa la regla de suelo saturado (`P17`).

---

## 4. Resultados Cuantitativos de Rendimiento (`P19` — Meta `< 3000 ms`)

Las mediciones reproducibles se ejecutaron mediante la suite `server/tests/integracion/rendimientoApi.s4d4.test.js`, la suite `client/src/tests/rendimientoUsabilidad.s4d4.test.jsx` y el script de benchmark `npm run verify:p19 --prefix server` (`server/src/scripts/medirRendimientoP19.js`):

### 4.1. Tabla de Latencias de API y Eficiencia de Payload (`npm run verify:p19`)

| ID Control | Métrica Evaluada | Mínimo (`min`) | Mediana (`p50`) | Percentil 95 (`p95`) | Máximo (`max`) | Límite Exigido (`P19`) | Estado |
| :---: | :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **`P19-01`** | Latencia HTTP `GET /api/estado` (10 consultas) | `10.82 ms` | `14.43 ms` | **`77.05 ms`** | `77.05 ms` | `p95 < 500 ms` (`< 3000 ms`) | **[PASS]** |
| **`P19-02`** | Latencia HTTP `GET /api/historial?limite=10` | `6.44 ms` | `8.29 ms` | **`19.78 ms`** | `19.78 ms` | `p95 < 500 ms` (`< 1000 ms`) | **[PASS]** |
| **`P19-03`** | Latencia HTTP `GET /api/salud` (Ping PostgreSQL) | `3.00 ms` | `4.12 ms` | **`5.86 ms`** | `5.86 ms` | `p95 < 500 ms` (`< 1000 ms`) | **[PASS]** |
| **`P19-04`** | Tamaño del payload JSON único `GET /api/estado` | — | — | **`15.57 KB`** (`15,944 B`) | — | `< 100.00 KB` | **[PASS]** |
| **`P19-05`** | Peso del App Shell PWA (`client/dist` HTML+JS+CSS) | — | — | **`164.73 KB gzip`** (`598.46 KB` brutos) | `164.95 ms` @ 10 Mbps | `< 1000 ms` | **[PASS]** |
| **`P19-06`** | **Tiempo Total hasta Pantalla Principal Interactiva** | — | — | **`287.00 ms` (`0.29 s`)** | — | **`< 3000 ms` (`3.00 s`)** | **[PASS]** |

### 4.2. Desglose del Tiempo Total de Carga en Conexión Normal (`P19`)

$$\text{Tiempo Total } (P19) = T_{\text{AppShell (10 Mbps)}} + T_{\text{API GET /api/estado (p95)}} + T_{\text{Render React}} = 164.95\text{ ms} + 77.05\text{ ms} + 45.00\text{ ms} = \mathbf{287.00\text{ ms}\ (0.29\text{ s})}$$

- **Margen de cumplimiento frente al umbral de 3000 ms:** El sistema carga y muestra el `nivel informativo de lluvia` y las `recomendaciones preventivas generales` en **0.29 segundos**, es decir, **más de 10 veces más rápido** que el límite máximo de 3.0 segundos estipulado en la prueba académica `P19`.
- **En visitas subsecuentes (Service Worker activo):** Dado que el App Shell se sirve instantáneamente desde el precache local de Workbox (`< 15 ms`), el tiempo percibido por el usuario se reduce únicamente a la consulta `GET /api/estado` (`~15–77 ms`).

