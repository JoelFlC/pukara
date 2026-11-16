# PUKARA — Especificación Completa del Sistema de Diseño: *Swiss Grid + Restrained Claymorphism + Scrollytelling*

- **Documento:** Especificación de Arquitectura Visual, Tokens, Componentes y Accesibilidad Intergeneracional
- **Rama de Trabajo:** `feat/rediseño-swiss-clay-ui`
- **Alcance:** Vista Pública Principal (`/`) y Consola de Administración (`/admin`) en `/client`

> **Aviso Permanente Obligatorio:**
> *"Los niveles Normal, Precaución, Alerta y Emergencia son niveles informativos de lluvia: niveles meteorológicos simulados, calculados con umbrales académicos. No sustituyen alertas ni instrucciones de las autoridades oficiales. PUKARA muestra información bajo consulta y no avisa activamente a la población. Ante una emergencia, atienda las indicaciones oficiales y contacte a los servicios de emergencia."*

---

## 1. Fundamentos de Diseño: Por Qué *Swiss Grid + Claymorphism + Scrollytelling*

### 1.1. Los Tres Pilares Visuales
1. **Diseño Suizo (*International Typographic Style*):**
   - Organización espacial gobernada por una **retícula matemática de 12 columnas en Desktop** (`max-w-[1200px]`, márgenes laterales de `24px`–`32px`, `gap-6`), **8 columnas en Tablet** y **4 columnas en Móvil**.
   - Jerarquía visual conducida por el contraste de escala tipográfica, alineación izquierda constante y encabezados numerados de capítulo (`01 CAPÍTULO UNO`, `02 CAPÍTULO DOS`, `03 CAPÍTULO TRES`) que orientan la lectura vertical sin esfuerzo.
2. **Claymorfismo Sutil (*Restrained Claymorphism*):**
   - Frente a las interfaces planas frías o los tableros oscuros intimidantes, las tarjetas de PUKARA utilizan superficies mate blancas (`#FFFFFF`) y pasteles suaves con **volumen táctil sutil** (bordes redondeados de `20px`–`24px`, sombra exterior suave multicapa y doble bisel interno `inset` superior/inferior).
   - Los botones y tarjetas interactivas comunican claramente que son pulsables gracias a su elevación amigable y su respuesta física al tacto (`scale(0.985)` en estado `:active`).
3. **Narrativa *Scrollytelling* de Calma Cívica:**
   - La página principal acompaña al ciudadano en orden de prioridad cognitiva:
     1. **¿Cuál es el nivel informativo de lluvia hoy en Llojeta?** *(Hero Diagnóstico + Escala de 4 Niveles + Telemetría Esencial).*
     2. **¿Qué recomendaciones preventivas generales debo consultar?** *(Capítulo 01 — Guía de Acción Preventiva en 4 columnas Clay).*
     3. **¿Dónde se ubica el sector piloto y a qué distancia en línea recta están los puntos referenciales?** *(Capítulo 02 — Cartografía Referencial en Tono Neutro y Cercanía Haversine).*
     4. **¿A qué teléfonos oficiales debo llamar ante una emergencia?** *(Capítulo 03 — Teléfonos Rápidos de Emergencia y Bitácora Histórica).*

---

## 2. Reglas de Accesibilidad Intergeneracional (Jóvenes a Adultos Mayores)

| Regla de Ergonomía | Especificación Obligatoria en PUKARA | Beneficio para Adultos Mayores y Consulta Rápida |
| :--- | :--- | :--- |
| **Tamaño mínimo de cuerpo de texto** | **`16px` (`1rem`, `body-md`)** en todo texto de lectura ciudadana; **`18px`–`20px`** en descripciones del nivel vigente y recomendaciones preventivas. | Elimina el esfuerzo ocular y la necesidad de hacer pellizco/zoom en pantallas móviles. |
| **Altura mínima de objetivos táctiles** | **`48px` a `54px`** (`min-h-[48px]` / `min-h-[54px]`) con separación mínima de `8px`–`12px` entre botones contiguos. | Previene pulsaciones accidentales en personas con menor precisión motriz o bajo lluvia. |
| **Cifras tabulares gigantes (`telemetry-num`)** | **`36px` a `44px`** (`font-extrabold tabular-nums`) para `intensidad_mm_h`, `acum_24h_mm`, `acum_72h_mm` y números cortos de auxilio (`114`, `119`, `110`, `115`). | Permite captar las métricas clave en menos de 1 segundo sin leer tablas densas. |
| **Contraste cromático WCAG AAA** | Texto primario `#111C2D` / `#1E293B` sobre `#FFFFFF` o `#F6F8FA` (relación `> 13:1`); acentos de nivel oscurecidos (`#006C4A`, `#92400E`, `#9A3412`, `#97000C`) sobre fondos pastel suaves. | Garantiza legibilidad plena incluso bajo luz solar directa en exteriores de La Paz. |
| **Cero sobrecarga cognitiva** | Información técnica secundaria (trazabilidad de versión `v1`, histéresis `0/2` o tabla histórica) agrupada limpiamente en bloques inferiores o pies de tarjeta estructurados. | Prioriza en primer plano el nivel informativo y la recomendación preventiva vigente. |

---

## 3. Arquitectura de Tokens CSS (`client/src/index.css`)

```css
:root {
  /* Familias Tipográficas Suizas */
  --font-display: 'Plus Jakarta Sans', system-ui, -apple-system, sans-serif;
  --font-sans: 'Inter', system-ui, -apple-system, sans-serif;
  --font-mono: 'JetBrains Mono', ui-monospace, SFMono-Regular, monospace;

  /* Lienzo y Superficies Clay */
  --bg-canvas: #F6F8FA;
  --bg-canvas-alt: #F9F9FF;
  --surface-clay: #FFFFFF;
  --surface-clay-muted: #F0F3FF;
  --surface-clay-accent: #E7EEFF;

  /* Tinta y Tipografía */
  --ink-primary: #111C2D;
  --ink-slate: #1E293B;
  --ink-secondary: #464555;
  --ink-muted: #475569;

  /* Color Primario Cívico (Índigo Institucional) */
  --primary-civic: #3525CD;
  --primary-civic-hover: #4F46E5;
  --primary-civic-soft: #EEF2FF;
  --primary-civic-pill: #E2DFFF;

  /* Semántica de los 4 Niveles Informativos de Lluvia */
  --level-normal-bg: #ECFDF5;
  --level-normal-surface: #D1FAE5;
  --level-normal-ink: #006C4A;
  --level-normal-accent: #059669;

  --level-precaucion-bg: #FEF3C7;
  --level-precaucion-border: #FDE68A;
  --level-precaucion-ink: #92400E;
  --level-precaucion-accent: #D97706;

  --level-alerta-bg: #FFEDD5;
  --level-alerta-border: #FED7AA;
  --level-alerta-ink: #9A3412;
  --level-alerta-accent: #C2410C;

  --level-emergencia-bg: #FEE2E2;
  --level-emergencia-surface: #FFDAD6;
  --level-emergencia-ink: #97000C;
  --level-emergencia-accent: #DC2626;
}
```

---

## 4. Diseño Detallado de los Bloques Scrollytelling en la Vista Pública (`/`)

### Bloque 0: Barra Superior Institucional, `<AvisoPermanente/>` y Banners de Estado
- **Header Sticky Suizo:**
  - Marca institucional `PUKARA` con sello `Sector Llojeta` y estado de red (`En línea` / `Sin conexión`).
  - Navegación por capítulos con píldoras suaves: `Estado en Vivo (#monitoreo)`, `01 Guía Preventiva (#prevencion)`, `02 Mapa Referencial (#mapa)`, `03 Teléfonos Rápidos (#contactos)` y botón `Acceso Admin →` (`/admin`).
  - Selector segmentado táctil (`min-h-[48px]`): `Datos Reales (Open-Meteo)` vs. `Modo Simulación (Demostración)` + botón `Actualizar`.
- **Cinta Invariable `<AvisoPermanente/>`:**
  - Tarjeta `.clay-card` compacta con borde izquierdo institucional `#3525CD`, ícono informativo y el texto canónico íntegro en tamaño legible.
- **Banners Condicionales de Resiliencia (`<EstadoPwaBanner/>`, `<BannerModoOffline/>`, `<BannerModoSimulacion/>`, `<AvisoCambioNivelInApp/>`):**
  - Mantienen intactos sus `data-testid` y textos reglamentarios, estilizados con superficies `.clay-card` y botones `.clay-btn-primary` / `.clay-btn-secondary` de `48px+`.

### Bloque Hero: Diagnóstico Principal + Escala de 4 Niveles + Telemetría Pluviométrica
- **Columna Izquierda (`lg:col-span-7` — `<BannerNivelInformativo/>`):**
  - Píldora `.clay-pill` del nivel vigente (`NORMAL`, `PRECAUCIÓN`, `ALERTA`, `EMERGENCIA`) o estados de integridad (`SIN DATOS METEOROLÓGICOS VÁLIDOS` / `DATOS DESACTUALIZADOS`).
  - Titular `display-hero` / `headline-lg` claro y directo: `"Nivel informativo de lluvia: [NIVEL]"`.
  - Descripción calmada en `body-lg` (`18px`), medidor visual de saturación de suelo (`acum_72h_mm / 60.0mm`), hora de observación en Bolivia (`America/La_Paz`), antigüedad y botonera de demostración en 1 clic (`Normal`, `Precaución`, `Alerta`, `Emergencia`).
- **Columna Derecha (`lg:col-span-5` — Tarjeta Escala de 4 Niveles y Ámbito Espacial):**
  - Escalera visual de los **4 Niveles Informativos de Lluvia** (`Normal`, `Precaución`, `Alerta`, `Emergencia`) mostrando sus umbrales académicos v1 y resaltando con `.clay-pill` el escalón actualmente activo, acompañada del resumen del sector piloto Llojeta (`Lat -16.5235 · Lon -68.1425`).
- **Franja de Telemetría (`#telemetria` — `<TarjetaLecturaMeteorologica/>`):**
  - **3 Tarjetas Principales Clay de Gran Formato (`telemetry-num` `44px`):**
    1. **Intensidad Horaria (1h):** valor en `mm/h` (umbral `2.5 / 6.5 / 12.0`).
    2. **Acumulado 24 Horas:** valor en `mm` o aviso de `Acumulado incompleto (X/24 h)` sin asumir `0 mm`.
    3. **Acumulado 72 Horas (Saturación):** valor en `mm` o `Acumulado incompleto (X/72 h)` frente al umbral de `60mm`.
  - **3 Tarjetas Atmosféricas Complementarias:** Temperatura (`°C`), Humedad (`%`) y Viento (`km/h`), más la barra de procedencia `Fuente: Open-Meteo (modelo meteorológico)`.

### Capítulo 01: Guía de Acción Preventiva (`#prevencion` — `<SeccionRecomendaciones/>`)
- **Encabezado Editorial Suizo:** `01 CAPÍTULO UNO — GUÍA PREVENTIVA` · `Recomendaciones Preventivas Generales por Nivel Informativo`.
- **Recomendación Vigente Destacada:** Tarjeta `.clay-card` en el tono pastel Clay del nivel activo, con texto en `body-lg` (`18px`), etiqueta de origen (`Origen: Institucional verificada` u `Origen: Demostración (contenido académico)`), fuente y versión.
- **Matriz Comparativa de los 4 Niveles:** En desktop y al desplegar el conmutador accesible, muestra las 4 tarjetas Clay (`NORMAL`, `PRECAUCION`, `ALERTA`, `EMERGENCIA`) con su distintivo `(Vigente)` y el recordatorio legal obligatorio del Módulo 3.

### Capítulo 02: Cartografía de Referencia y Cercanía (`#mapa` — `<MapaReferencial/>`)
- **Encabezado Editorial Suizo:** `02 CAPÍTULO DOS — CARTOGRAFÍA DE REFERENCIA` · `Mapa del Sector Piloto Llojeta / Bajo Llojeta`.
- **Nota de Indicador Global (`data-testid="nota-indicador-global"`):** Explica con claridad que el nivel informativo es global para el sector y que los polígonos se representan siempre en color neutro (`#475569` / `#64748b`).
- **Vista Dividida Suiza (12 Columnas):**
  - **Izquierda (`lg:col-span-7`):** Contenedor `.clay-card` con el lienzo Leaflet (`data-testid="mapa-leaflet-contenedor"`), atribución a OpenStreetMap y soporte de aviso `data-testid="aviso-mapa-parcial"` (`P10`).
  - **Derecha (`lg:col-span-5`):**
    - Tarjeta de control GPS local con botón `data-testid="btn-solicitar-ubicacion"` (`min-h-[50px]`), aviso `data-testid="aviso-gps-denegado"` (`P09`) y `data-testid="aviso-gps-concedido"`.
    - Lista de **Zonas de Referencia** (`data-testid="seccion-zonas-referencia"`) y **Puntos de Referencia** (`data-testid="seccion-puntos-referencia"`) con distancias `data-testid="distancia-haversine"`, la frase `"distancia aproximada en línea recta (no es recomendación de ruta ni indica seguridad)"` (`P18`) y el sello `"referencia de demostración, no validada"`.

### Capítulo 03: Teléfonos Rápidos de Emergencia y Trazabilidad (`#contactos` y `#historial`)
- **Encabezado Editorial Suizo:** `03 CAPÍTULO TRES — ASISTENCIA OFICIAL` · `Contactos de Emergencia — La Paz / Cotahuma`.
- **Tarjetas Táctiles de Llamada Directa (`<SeccionContactosEmergencia/>`):**
  - Diseño pensado especialmente para adultos mayores: cada línea verificada (`Red 114 — Emergencias GAMLP`, `Bomberos Antofagasta La Paz 119`, `Radio Patrullas 110`, `Defensa Civil 115`) presenta un botón `.clay-btn-danger` / `.clay-btn-primary` de `54px` de altura con el número en tipografía grande (`telemetry-num`) y enlace directo `href="tel:..."`.
- **Bloques de Trazabilidad Ciudadana (`<HistorialEvaluaciones/>` y `<ResumenZonaPiloto/>`):**
  - Tabla limpia en tarjeta `.clay-card` con las últimas evaluaciones del motor y ficha espacial del sector piloto.
