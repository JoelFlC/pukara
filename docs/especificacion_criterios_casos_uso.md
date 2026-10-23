# PUKARA — Especificación de Requerimientos, Casos de Uso y Criterios de Aceptación (P01–P19)

**Sistema web móvil para la consulta de condiciones de lluvias intensas, clasificación informativa y recomendaciones preventivas en el sector Llojeta, La Paz.**

---

## 1. Perfiles de Usuario

### 1.1 Perfil Público (Sin Autenticación)
- **Acceso:** Libre y sin registro desde cualquier navegador web móvil (PWA).
- **Alcance Operacional:**
  - Consulta en tiempo real del **nivel informativo de lluvia** vigente (`NORMAL`, `PRECAUCION`, `ALERTA`, `EMERGENCIA`) o estados de disponibilidad (`SIN_DATOS`, `DATOS_DESACTUALIZADOS`).
  - Visualización del timestamp de la última lectura meteorológica y antigüedad de los datos.
  - Lectura de **recomendaciones preventivas generales** asociadas al nivel vigente, visualizando su etiqueta de origen institucional o académico.
  - Directorio telefónico de **contactos de emergencia** con enlace de marcación directa (`tel:`).
  - Visualización de mapa referencial con polígonos y puntos del sector Llojeta en color neutro (sin colorear por nivel).
  - Cálculo opcional en el propio dispositivo de la **distancia aproximada en línea recta** mediante Haversine respecto a puntos de referencia (sin enviar coordenadas GPS al servidor).
  - Soporte de consulta fuera de línea (PWA Offline) mostrando la última información sincronizada con el aviso explícito de datos no actualizados.

### 1.2 Perfil Administrador (Autenticado con JWT)
- **Acceso:** Restringido mediante credenciales institucionales, generación de token JWT y validación por middleware.
- **Alcance Operacional:**
  - Gestión de versiones inmutables de umbrales meteorológicos (intensidad horaria, acumulados de 24h y 72h) con validación matemática obligatoria de coherencia y monotonía creciente.
  - Creación, actualización y desactivación de recomendaciones preventivas generales y contactos de emergencia.
  - Administración de atributos descriptivos de zonas y puntos de referencia en Llojeta.
  - Ejecución del **Modo Simulación**: inyección de parámetros meteorológicos ficticios para evaluación interactiva en memoria, estrictamente aislada del flujo real.
  - Auditoría del historial de modificaciones a través de la tabla `bitacora_cambios`.

---

## 2. Casos de Uso Principales

### CU-01: Consulta Pública en Línea del Nivel Informativo
- **Actor:** Usuario Público.
- **Precondiciones:** Dispositivo con conectividad a Internet.
- **Flujo Principal:**
  1. El usuario accede a la URL base de PUKARA.
  2. La aplicación solicita al backend el nivel informativo de lluvia vigente.
  3. El frontend despliega el banner global con el nivel (`NORMAL`, `PRECAUCION`, `ALERTA` o `EMERGENCIA`), la hora de observación y las recomendaciones preventivas.
  4. La interfaz renderiza de forma fija y visible el **Aviso Permanente** de responsabilidad académica e informativa.
- **Excepción:** Si no hay datos disponibles o la lectura supera la ventana de vigencia, se despliega `SIN_DATOS` o `DATOS_DESACTUALIZADOS`.

### CU-02: Consulta Pública Fuera de Línea (Modo PWA Offline)
- **Actor:** Usuario Público.
- **Precondiciones:** La PWA fue cargada previamente al menos una vez; el dispositivo pierde conectividad o entra en modo avión.
- **Flujo Principal:**
  1. El usuario abre la PWA PUKARA en su navegador o acceso directo instalado.
  2. El Service Worker sirve la aplicación y los últimos datos almacenados localmente.
  3. Se despliega de forma destacada el aviso: *"Datos del [fecha y hora], no actualizados"*.
  4. Los contactos de emergencia y recomendaciones previas permanecen legibles.

### CU-03: Consulta Cartográfica y Distancia Referencial en Dispositivo
- **Actor:** Usuario Público.
- **Precondiciones:** Carga de vista de mapa referencial.
- **Flujo Principal:**
  1. El frontend descarga la capa GeoJSON de zonas y puntos de Llojeta (almacenada como `JSONB` en backend).
  2. El mapa renderiza los polígonos en color neutro (independiente del nivel de lluvia).
  3. Si el usuario concede permiso de geolocalización, el navegador calcula la distancia Haversine al punto referencial más próximo en el propio cliente.
  4. La interfaz etiqueta la distancia como: *"distancia aproximada en línea recta (no es ruta ni indica seguridad)"*.
- **Excepción (GPS Denegado):** La aplicación continúa funcionando normalmente, omitiendo únicamente la distancia lineal y permitiendo explorar el mapa manualmente.

### CU-04: Gestión Administrativa de Umbrales y Versionado Inmutable
- **Actor:** Usuario Administrador.
- **Precondiciones:** Sesión iniciada con token JWT vigente.
- **Flujo Principal:**
  1. El administrador ingresa a la vista de configuración y define nuevos valores de umbrales.
  2. El backend valida matemáticamente la coherencia:
     `NORMAL < PRECAUCION < ALERTA < EMERGENCIA` en todas las métricas.
  3. Si es válida, se inserta una nueva tupla versionada en `umbrales` y se registra en `bitacora_cambios`.
  4. Las evaluaciones históricas previas conservan inalterada la referencia a la versión con la que fueron calculadas.

### CU-05: Demostración en Modo Simulación
- **Actor:** Usuario Administrador.
- **Precondiciones:** Administrador autenticado.
- **Flujo Principal:**
  1. El administrador selecciona una fecha histórica o ingresa valores manuales de lluvia (`modalidad = 'simulada'`).
  2. El motor en `/server/src/engine/` procesa las lecturas de forma aislada en memoria.
  3. Se proyecta el resultado de la clasificación en un panel de previsualización rotulado como: *"referencia de demostración, no validada"*.
  4. El estado operativo real, la caché pública y el contador de descenso permanecen intactos.

---

## 3. Matriz de Criterios de Aceptación y Pruebas Obligatorias (P01 – P19)

| Código | Criterio de Aceptación / Caso de Prueba | Condición de Entrada / Estímulo | Resultado Esperado |
| :--- | :--- | :--- | :--- |
| **P01** | Umbral igual al límite exacto (`>=`) | La lectura meteorológica alcanza exactamente el valor límite definido para un nivel (ej. intensidad = 10.0 mm/h). | El motor asigna el nivel superior inmediatamente (`>=`). |
| **P02** | Lecturas horarias incompletas | La serie temporal de Open-Meteo contiene horas con valor nulo o faltante en la ventana de 24h o 72h. | El motor marca el acumulado como incompleto; **PROHIBIDO** asumir 0 mm. |
| **P03** | Falla de conectividad con API externa | El servicio de Open-Meteo no responde, devuelve timeout o error HTTP 5xx. | El sistema utiliza el último dato válido dentro de su ventana de vigencia o transiciona a `SIN_DATOS`. No arroja error 500 no controlado. |
| **P04** | Mecanismo de caché meteorológica | Solicitudes entrantes dentro de la ventana de 10 a 15 minutos desde la última lectura válida. | El backend responde con la lectura cacheada sin emitir peticiones redundantes a Open-Meteo. |
| **P05** | Versionado inmutable de parámetros | Un administrador modifica los umbrales de evaluación. | Se crea una nueva versión de umbrales. Las evaluaciones previas no son recalculadas y la auditoría se guarda en `bitacora_cambios`. |
| **P06** | Retroalimentación visual in-app | Cambio de nivel meteorológico en la evaluación vigente. | El banner global actualiza color, icono y texto del nivel de lluvia, manteniendo polígonos de mapa en color neutro. |
| **P07** | Control de acceso no autorizado | Petición a endpoints `/api/admin/*` sin cabecera `Authorization` o con token JWT inválido/expirado. | El backend rechaza la solicitud de forma inmediata con código HTTP `401 Unauthorized` o `403 Forbidden`. |
| **P08** | Resiliencia PWA Offline (Modo Avión) | Dispositivo sin conexión de red o con modo avión activo tras haber visitado la PWA. | La aplicación abre mediante Service Worker y despliega visiblemente: *"Datos del [fecha y hora], no actualizados"*. |
| **P09** | Resiliencia ante GPS denegado | El usuario rechaza la solicitud de geolocalización en el navegador móvil. | La aplicación se mantiene 100% interactiva; se oculta la distancia calculada y no se genera error en consola. |
| **P10** | Fallback cartográfico sin teselas | Conectividad deficiente para descargar teselas de OpenStreetMap. | El contenedor del mapa muestra marco de referencia con mensaje informativo y polígonos vectoriales cargados en caché. |
| **P11** | Aislamiento estricto de Simulación vs Real | Ejecución de simulación con valores extremos de lluvia (`modalidad = 'simulada'`). | El estado público real y el `contador_descenso` real no sufren variación alguna. |
| **P12** | Instalabilidad en Android | Auditoría de PWA Lighthouse / manifest web y service worker registrado. | Manifest con iconos correctos, `display: standalone` y service worker funcional para instalación como PWA. |
| **P13** | Ascenso multinivel inmediato | Una lectura pasa repentinamente de valores de `NORMAL` a valores de `EMERGENCIA`. | El motor asciende directamente a `EMERGENCIA` en una única evaluación (sin exigir pasos intermedios). |
| **P14** | Descenso con histéresis y contador | Condiciones de lluvia cesan o disminuyen por debajo del umbral actual. | El nivel solo desciende tras 2 muestras temporales independientes consecutivas (`observado_en` distinto, descartando caché) hacia el nivel mayor de los dos inferiores. |
| **P15** | Integridad de datos (`SIN_DATOS` / `DESACTUALIZADOS`) | Lecturas ausentes por más de la ventana de expiración permitida. | El sistema clasifica el estado explícitamente como `DATOS_DESACTUALIZADOS` o `SIN_DATOS`. **PROHIBIDO** mostrar `NORMAL`. |
| **P16** | Rechazo de configuración incoherente | Intento de guardar umbrales donde `PRECAUCION >= ALERTA` o valores negativos. | La API responde con error `400 Bad Request` y la base de datos aborta la transacción sin persistir cambios. |
| **P17** | Regla de saturación de suelo | Lectura con `acum_72h_mm = 60.0` e `intensidad_mm_h = 2.5` vs `59.9` mm. | Con `>= 60.0` y `>= 2.5` fuerza nivel mínimo `ALERTA` aun si otros criterios estuviesen en `NORMAL` o `PRECAUCION`. Con `59.9` mm no activa la regla de saturación. |
| **P18** | Precisión Haversine en cliente | Coordenadas simuladas en Llojeta con respecto a punto de referencia. | Cálculo exacto de distancia en km con 1 decimal; rotulado obligatorio *"distancia aproximada en línea recta (no es ruta ni indica seguridad)"*. Coordenadas nunca viajan a la red. |
| **P19** | Carga `< 3 s` y usabilidad mobile-first | Acceso inicial bajo emulación de red 3G/4G móvil. | First Contentful Paint y Time to Interactive inferiores a 3 segundos; tipografía y botones táctiles optimizados para pulgar. |
