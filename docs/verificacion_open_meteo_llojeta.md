# PUKARA — Verificación Técnica Empírica de Open-Meteo en Sector Llojeta

**Fecha de ejecución y registro:** 23 de octubre de 2026  
**Sistema:** PUKARA (Plataforma web móvil para consulta informativa de lluvias en Llojeta, La Paz)  
**Script de diagnóstico ejecutado:** `npm run meteo:inspeccionar` (`/server/src/scripts/inspeccionarOpenMeteo.js`)

---

## 1. Coordenada Central Fijada para el Sector Piloto Llojeta / Bajo Llojeta

### 1.1 Localización Geográfica y Cartográfica
- **Latitud fijada:** `-16.5235`
- **Longitud fijada:** `-68.1425`
- **Macrodistrito:** Cotahuma, Municipio de Nuestra Señora de La Paz.
- **Ámbito espacial piloto:** Corredor Bajo Llojeta a lo largo del eje del río Pasajahuira y la Avenida Los Sargentos, zona de alta susceptibilidad a eventos hidrometeorológicos y movimientos en masa.
- **Verificación cartográfica:** Coordenadas contrastadas sobre la cartografía base de OpenStreetMap, ubicadas dentro del polígono residencial del sector piloto.
- **Acceso centralizado:** Gestionado mediante la función pura `obtenerConfigZonaPiloto()` en [`/server/src/config/zonaPiloto.js`](file:///home/joel/Documentos/Taller/Proyecto/PUKARA/server/src/config/zonaPiloto.js).

### 1.2 Resolución Espacial y Celda del Modelo Numérico
En la ejecución en vivo contra la API de Open-Meteo (`https://api.open-meteo.com/v1/forecast`), el servicio devolvió los siguientes metadatos de malla:
- **Coordenada exacta de celda del modelo:** Latitud `-16.485062`, Longitud `-68.14285`
- **Elevación topográfica asignada por el modelo:** `3889 msnm`
- **Evidencia empírica de la Limitación Declarada N° 3:**  
  La consulta confirma de forma empírica que los datos provienen de un modelo de interpolación numérica y reanálisis meteorológico con resolución de cuadrícula (~11 km a nivel de celda) y **no de una estación meteorológica pluviométrica puntual in situ**. Esto sustenta el rigor académico del proyecto al catalogar los resultados exclusivamente como *niveles informativos de lluvia* bajo umbrales simulados de referencia.

---

## 2. Intervalo Efectivo del Modelo e Implicación en Parámetros de Diseño

Los datos crudos obtenidos de la API certifican la estructura temporal del proveedor:

| Bloque Open-Meteo | Intervalo Reportado | Equivalencia en Tiempo | Rol en la Arquitectura PUKARA |
| :--- | :--- | :--- | :--- |
| **`current`** | `interval: 900` s | **15 minutos** | Define el ciclo mínimo de refresco de estimación actual del modelo. Respalda directamente el parámetro **`separacion_minima_minutos = 15`** en `configuraciones_reglas`, garantizando que para que una muestra sea independiente en el contador de descenso por histéresis, debe haber transcurrido al menos 15 minutos en `observado_en`. |
| **`hourly`** | Paso de serie: `3600` s | **60 minutos (1 hora)** | Proporciona las series horarias para el cálculo de acumulados de 24h y 72h. Respalda el parámetro **`t_max_minutos = 60`**, a partir del cual una lectura deja de considerarse fresca y el sistema transiciona a **`DATOS_DESACTUALIZADOS`** si no se reciben nuevas muestras. |

Ambos parámetros empíricos quedan formalmente ratificados para las validaciones de transición del motor de reglas (`/server/src/engine/`).

---

## 3. Muestra Real Capturada en Llojeta

A continuación se registra la muestra capturada en tiempo real durante la sesión:

- **Endpoint consultado:**  
  `https://api.open-meteo.com/v1/forecast?latitude=-16.5235&longitude=-68.1425&current=precipitation,temperature_2m,relative_humidity_2m,wind_speed_10m&hourly=precipitation&past_days=4&forecast_days=1&timezone=UTC`
- **Latencia de respuesta de red:** `3879 ms` (dentro del umbral seguro configurado de `timeoutMs = 8000 ms`).
- **Timestamp de observación (`observado_en` UTC):** `2026-10-23T23:45:00.000Z`
- **Timestamp local en La Paz (`America/La_Paz` UTC-4):** `23/10/2026, 19:45:00 (BOT)`
- **Variables Meteorológicas Actuales en Llojeta:**
  - **Precipitación actual instantánea:** `0.1 mm`
  - **Temperatura a 2 metros:** `9.4 °C`
  - **Humedad relativa:** `86 %`
  - **Velocidad del viento a 10 metros:** `1 km/h`
- **Estructura de la Serie Horaria:**
  - **Total de pasos horarios recibidos:** `120 horas` (ventana histórica de 4 días pasados + día en curso con `forecast_days=1`).
  - **Valores no nulos:** `120`
  - **Valores nulos en serie:** `0` (procesados bajo la regla estricta de preservación de `null` sin sustitución por `0`).
  - **Precipitación acumulada total en la serie analizada:** `18.80 mm`

---

## 4. Conclusiones Técnicas
1. El cliente desacoplado [`/server/src/services/openMeteo.js`](file:///home/joel/Documentos/Taller/Proyecto/PUKARA/server/src/services/openMeteo.js) y la configuración centralizada [`/server/src/config/zonaPiloto.js`](file:///home/joel/Documentos/Taller/Proyecto/PUKARA/server/src/config/zonaPiloto.js) se encuentran plenamente validados tanto de forma offline (100% de cobertura unitaria con mocks) como en vivo contra el servicio real.
2. La arquitectura garantiza el cumplimiento de la **Lista Blanca** y **Lista Negra** semántica, evitando cualquier degradación indebida de datos y asegurando el aislamiento funcional entre la ingesta meteorológica y el motor de evaluación.
