# PUKARA — Catálogo de Capas y Puntos Geográficos de Referencia (Sector Llojeta, La Paz)

**Fecha de registro:** 23 de octubre de 2026  
**Sistema:** PUKARA (Plataforma web móvil para consulta informativa de lluvias en Llojeta, La Paz)  
**Marco de referencia:** Cartografía base OpenStreetMap (OSM)  
**Clasificación de datos:** Referencia de demostración, no validada por autoridades municipales ni de protección civil.

---

## 1. Coordenada Central de Consulta del Sector Piloto
- **Ubicación:** Sector Llojeta / Bajo Llojeta, Macrodistrito Cotahuma, Municipio de Nuestra Señora de La Paz.
- **Eje de referencia:** Corredor río Pasajahuira / Avenida Los Sargentos.
- **Latitud fijada:** `-16.5235`
- **Longitud fijada:** `-68.1425`
- **Nota de alcance:** El nivel informativo de lluvia se calcula con una sola consulta meteorológica para toda la zona piloto y no varía espacialmente entre polígonos.

---

## 2. Polígonos de Zonas de Referencia (`zonas_referencia`)
Almacenados en PostgreSQL como objetos GeoJSON RFC 7946 en columna `JSONB` (`geometria`), con advertencia obligatoria permanente: *"referencia de demostración, no validada"*. En el cliente se visualizan exclusivamente con tono neutro (sin colorear por nivel de lluvia).

| ID | Nombre de Zona de Referencia | Tipo GeoJSON | Coordenadas del Polígono `[longitud, latitud]` | Verificada | Advertencia |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **1** | Sector Piloto Llojeta — Cuenca Media (Referencial) | `Polygon` | `[[-68.1510, -16.5175], [-68.1380, -16.5175], [-68.1380, -16.5250], [-68.1510, -16.5250], [-68.1510, -16.5175]]` | `false` | `referencia de demostración, no validada` |
| **2** | Subsector Bajo Llojeta — Corredor Pasajahuira / Los Sargentos (Referencial) | `Polygon` | `[[-68.1455, -16.5230], [-68.1335, -16.5230], [-68.1335, -16.5305], [-68.1455, -16.5305], [-68.1455, -16.5230]]` | `false` | `referencia de demostración, no validada` |

---

## 3. Puntos de Referencia Cartográfica para Orientación Urbana (`puntos_referencia`)
Puntos destacados de la trama urbana de Llojeta para orientación referencial del usuario y cálculo de distancia lineal en dispositivo.

> [!IMPORTANT]
> **REGLAS SEMÁNTICAS Y DE SEGURIDAD OPERACIONAL:**
> Queda terminantemente prohibido catalogar estos puntos como "zonas seguras", "refugios de evacuación" o "puntos de encuentro seguros".
> Todos los puntos se catalogan estrictamente con `estado_verificacion: 'sin_verificar'`.
> La distancia calculada en el navegador móvil mediante la fórmula Haversine debe rotularse siempre como: *"distancia aproximada en línea recta (no es ruta ni indica seguridad)"*.

| ID | Nombre del Punto de Referencia | Tipo | Latitud | Longitud | Estado Verificación | Activo |
| :---: | :--- | :--- | :---: | :---: | :---: | :---: |
| **1** | Cruce Av. Los Sargentos — Acceso Bajo Llojeta (Referencia vial) | `hito_vial_referencial` | `-16.526800` | `-68.137200` | `sin_verificar` | `true` |
| **2** | Entorno Cementerio Jardín — Llojeta (Referencia urbana) | `referencia_urbana` | `-16.522900` | `-68.143400` | `sin_verificar` | `true` |
| **3** | Parada Teleférico Línea Morada — Faro Murillo / Conexión Cotahuma (Referencia transporte) | `transporte_referencial` | `-16.515200` | `-68.148900` | `sin_verificar` | `true` |
| **4** | Puente / Eje Av. Costanera — Confluencia Bajo Llojeta (Referencia vial) | `hito_vial_referencial` | `-16.529400` | `-68.134100` | `sin_verificar` | `true` |
| **5** | Plaza / Cancha El Vergel — Llojeta (Referencia barrial) | `referencia_barrial` | `-16.521100` | `-68.146800` | `sin_verificar` | `true` |
| **6** | Vía Principal Max Fernández — Llojeta Alto (Referencia vial) | `hito_vial_referencial` | `-16.519300` | `-68.140500` | `sin_verificar` | `true` |

---

## 4. Directorio Inicial de Contactos de Emergencia (`contactos_emergencia`)
Líneas telefónicas de atención de emergencias oficiales en el Municipio de Nuestra Señora de La Paz:

1. **Red 114 — Emergencias GAMLP (Alcaldía La Paz):** Teléfono `114`
2. **Dirección Departamental de Bomberos (La Paz):** Teléfono `119`
3. **Radio Patrulla 110 (Policía Boliviana):** Teléfono `110`

---

## 5. Idempotencia y Administración
La carga de capas y puntos se realiza mediante el script idempotente `/server/src/db/seedCapas.js` (invocable vía `npm run db:seed:capas` o dentro de `npm run db:seed`). La lógica comprueba previamente la existencia del nombre de cada zona y punto antes de insertar o actualizar, evitando duplicación de registros en PostgreSQL.
