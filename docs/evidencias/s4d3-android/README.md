# Índice de Evidencias Visuales en Dispositivo Físico Android — Semana 4 Día 3 (`S4D3`)

Este directorio almacena las capturas de pantalla estandarizadas obtenidas durante el protocolo de validación en dispositivo físico Android (**Xiaomi POCO X4 Pro 5G** · Android Chrome) para la defensa académica de **PUKARA** (INF-266 UMSA — Sector Piloto Llojeta / Bajo Llojeta, La Paz).

---

## Nombres Estandarizados de Capturas de Pantalla

| Archivo Estandarizado | Prueba Académica | Descripción de la Evidencia Visual |
| :--- | :---: | :--- |
| `01-pwa-instalada-p12.png` | **`P12`** | Aplicación PUKARA instalada en la pantalla de inicio de Android y abierta en modo `standalone` (sin barra de direcciones del navegador), mostrando el `<AvisoPermanente/>`, el banner de `nivel informativo de lluvia` y los bloques principales. |
| `02-modo-avion-banner-p08.png` | **`P08`** | Dispositivo móvil con **Modo Avión** activo en la barra de estado de Android, desplegando el `<BannerModoOffline/>` con la leyenda obligatoria `"Datos del [fecha y hora], no actualizados"`, el último nivel conocido almacenado en `localStorage`, las recomendaciones preventivas generales y los contactos de emergencia. |
| `03-gps-denegado-p09.png` | **`P09`** | Vista tras denegar el permiso de ubicación en Android (`PERMISSION_DENIED`), mostrando el bloque `data-testid="aviso-gps-denegado"` con la explicación del motivo, sin distancias numéricas calculadas y con la consulta general 100% operativa. |
| `04-mapa-parcial-sin-teselas-p10.png` | **`P10`** | Sección cartográfica en desconexión mostrando el aviso `data-testid="aviso-mapa-parcial"` (*"Mapa parcial con limitación de teselas"*), junto con la lista textual completa de las 2 zonas y los 6 puntos de referencia con su etiqueta `"referencia de demostración, no validada"`. |
| `05-aviso-cambio-nivel-p06.png` | **`P06`** | Vista principal abierta mostrando el `<AvisoCambioNivelInApp/>` (`data-testid="aviso-cambio-nivel-inapp"`, `role="status"`, `aria-live="polite"`) al cambiar el `nivel informativo de lluvia` de `PRECAUCION` a `ALERTA`, junto con la nota de alcance in-app. |

