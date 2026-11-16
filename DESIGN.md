# PUKARA — Sistema de Diseño Oficial: *Swiss Grid + Restrained Claymorphism + Scrollytelling Cívico* (`DESIGN.md`)

- **Proyecto:** PUKARA — Aplicación Web Progresiva (PWA) para Consulta de Condiciones de Lluvias Intensas en el Sector Llojeta, La Paz
- **Asignatura:** INF-266 Taller de Proyecto — Carrera de Informática, UMSA
- **Enfoque Visual y Ergonómico:** Diseño Suizo (Estilo Tipográfico Internacional) + Claymorfismo Sutil (Táctil y Amigable) + Minimalismo Funcional guiado por *Scrollytelling* Intergeneracional (Jóvenes a Adultos Mayores)
- **Especificación Técnica Extendida:** Consulte [`docs/sistema-diseno-swiss-clay.md`](docs/sistema-diseno-swiss-clay.md) y el Plan Maestro de Implementación en [`docs/plan-implementacion-rediseño-ui.md`](docs/plan-implementacion-rediseño-ui.md).

> **Aviso Permanente Obligatorio (Invariable en toda vista):**
> *"Los niveles Normal, Precaución, Alerta y Emergencia son niveles informativos de lluvia: niveles meteorológicos simulados, calculados con umbrales académicos. No sustituyen alertas ni instrucciones de las autoridades oficiales. PUKARA muestra información bajo consulta y no avisa activamente a la población. Ante una emergencia, atienda las indicaciones oficiales y contacte a los servicios de emergencia."*

---

## 1. Filosofía Visual y Principios de Accesibilidad Intergeneracional

El sistema de diseño de **PUKARA** resuelve un desafío crítico de comunicación ciudadana: **transmitir información pluviométrica con autoridad técnica, cero ansiedad visual y legibilidad inmediata para usuarios desde jóvenes hasta adultos mayores**.

1. **Diseño Suizo (Estilo Tipográfico Internacional):**
   - Retícula matemática modular de **12 columnas en Desktop** (`max-w-[1200px]`, `gap-6` / `24px`), **8 columnas en Tablet** y **4 columnas en Móvil**.
   - Alineación izquierda rigurosa con espina vertical limpia, numeración editorial de secciones (`CAPÍTULO 01`, `CAPÍTULO 02`, `CAPÍTULO 03`) y generoso espacio en blanco antirreflejo que evita el desorden visual.
2. **Claymorfismo Sutil (*Restrained Claymorphism*):**
   - Superficies mate suavemente moldeadas con volumen táctil tridimensional discreto: esquinas redondeadas amigables (`16px` a `24px`), doble sombra exterior difusa de baja opacidad combinada con bisel interior superior blanco (`inset`) y borde *hairline* de `1px`.
   - Micro-compresión física al presionar controles táctiles (`transform: scale(0.985)` en `:active`), brindando confirmación inmediata de pulsación a personas mayores.
3. **Scrollytelling Guiado Paso a Paso (Cero Sobrecarga Cognitiva):**
   - En lugar de saturar la pantalla con múltiples paneles densos simultáneos, la consulta pública se estructura como un recorrido vertical pausado y lógico:
     - **Apertura (Hero Diagnóstico + Escala de 4 Niveles + Telemetría Esencial)**
     - **Capítulo 01 — Guía de Acción Preventiva**
     - **Capítulo 02 — Cartografía de Referencia y Cercanía en Línea Recta**
     - **Capítulo 03 — Teléfonos Rápidos de Emergencia y Trazabilidad**
4. **Accesibilidad Universal y Ergonomía para Adultos Mayores (WCAG AAA):**
   - **Prohibido el texto diminuto en lectura principal:** El tamaño mínimo absoluto para cualquier párrafo o dato de lectura ciudadana es **`16px` (`body-md`)**, escalando a `18px` (`body-lg`) y `20px` (`body-xl`) en mensajes preventivos principales.
   - **Áreas táctiles generosas:** Todos los botones, selectores de modalidad, controles GPS y enlaces telefónicos `tel:` poseen una altura mínima de **`48px` a `54px`**.
   - **Contraste AAA sin deslumbramiento:** Tinta carbón pizarra (`#111C2D` / `#1E293B`) sobre lienzo mate cálido (`#F6F8FA` / `#F9F9FF`).

---

## 2. Tokens de Color (Calma Cívica + Pasteles Clay Semánticos)

### 2.1. Superficies y Tinta Base

| Token CSS | Valor Hexadecimal | Rol en la Interfaz |
| :--- | :---: | :--- |
| `--bg-canvas` | `#F6F8FA` | Lienzo general de la aplicación (blanco cálido mate antirreflejo). |
| `--bg-canvas-alt` | `#F9F9FF` | Variación luminosa para bloques editoriales de capítulo. |
| `--surface-clay` | `#FFFFFF` | Superficie primaria de tarjetas `.clay-card`. |
| `--surface-clay-muted` | `#F0F3FF` | Contenedor secundario suave para metadatos y píldoras informativas. |
| `--surface-clay-accent` | `#E7EEFF` | Contenedor destacado para controles activos y cabeceras de tabla. |
| `--ink-primary` | `#111C2D` / `#1E293B` | Tinta principal de máximo contraste (WCAG AAA `> 13:1`). |
| `--ink-secondary` | `#464555` / `#475569` | Tinta secundaria para descripciones y subtítulos. |
| `--primary-civic` | `#3525CD` / `#4F46E5` | Índigo cívico institucional para acciones primarias y foco accesible. |
| `--primary-civic-soft` | `#EEF2FF` / `#E2DFFF` | Fondo pastel índigo para píldoras activas y navegación. |

### 2.2. Semántica de los 4 Niveles Informativos de Lluvia (Pastel Clay + Acento AAA)

| Nivel Informativo Canónico | Fondo Pastel Clay (`bg`) | Borde / Bisel (`border`) | Acento y Texto Principal (`ink`) | Indicador Luminoso (`dot`) |
| :--- | :---: | :---: | :---: | :---: |
| **`NORMAL`** *(Mint Clay)* | `#ECFDF5` / `#D1FAE5` | `#A7F3D0` | `#059669` / `#006C4A` | `#10B981` |
| **`PRECAUCION`** *(Butter Yellow Clay)* | `#FEF3C7` | `#FDE68A` | `#D97706` / `#92400E` | `#F59E0B` |
| **`ALERTA`** *(Soft Peach Clay)* | `#FFEDD5` | `#FED7AA` | `#C2410C` / `#9A3412` | `#F97316` |
| **`EMERGENCIA`** *(Soft Coral Clay)* | `#FEE2E2` / `#FFDAD6` | `#FECACA` | `#DC2626` / `#97000C` | `#EF4444` |

> **Regla Cartográfica Inmutable:** Los polígonos GeoJSON de `zonas_referencia` en Leaflet **NUNCA** adoptan los colores de los niveles informativos; se dibujan siempre en tono neutro fijo (`color: '#475569'`, `fillColor: '#64748b'`, `fillOpacity: 0.22`).

---

## 3. Escala Tipográfica Suiza (`Plus Jakarta Sans` + `Inter`)

| Token Tipográfico | Familia | Tamaño (Desktop / Móvil) | Peso | Line-Height / Tracking | Uso Específico |
| :--- | :--- | :---: | :---: | :---: | :--- |
| **`display-hero`** | `Plus Jakarta Sans` | `56px` / `36px` | `800` | `64px` / `44px` (`-0.03em`) | Titular diagnóstico principal del Hero. |
| **`headline-lg`** | `Plus Jakarta Sans` | `36px` / `28px` | `700` | `44px` / `36px` (`-0.02em`) | Títulos de los Capítulos `01`, `02` y `03`. |
| **`headline-md`** | `Plus Jakarta Sans` | `24px` | `700` | `32px` (`-0.015em`) | Subtítulos de tarjetas principales y modales. |
| **`headline-sm`** | `Plus Jakarta Sans` | `20px` | `600` | `28px` | Encabezados de tarjetas de recomendaciones y contactos. |
| **`telemetry-num`** | `Plus Jakarta Sans` | `44px` / `36px` | `800` | `1.1` (`-0.02em`, `tabular-nums`) | Cifras de lluvia (`mm/h`, `mm`) y números de emergencia (`114`, `119`). |
| **`body-xl`** | `Inter` | `20px` (`1.25rem`) | `400`–`500` | `1.6` | Resumen humano del estado en el Hero. |
| **`body-lg`** | `Inter` | `18px` (`1.125rem`) | `400`–`500` | `1.6` | Contenido de recomendaciones preventivas vigentes. |
| **`body-md`** | `Inter` | `16px` (`1.0rem`) | `400` | `1.55` | **Mínimo absoluto para lectura de cuerpo ciudadano.** |
| **`label-lg`** | `Plus Jakarta Sans` | `16px` | `600` | `1.4` | Texto de botones táctiles y pestañas de navegación. |
| **`label-md`** | `Plus Jakarta Sans` | `14px` | `600` | `1.4` | Etiquetas de formularios, badges y metadatos técnicos. |
| **`label-sm`** | `Plus Jakarta Sans` | `12px` | `700` | `1.3` (`0.05em`, `uppercase`) | Numeración de capítulo suizo (`01 CAPÍTULO UNO`) y sellos de versión. |

---

## 4. Clases Utilitarias de Elevación Claymórfica

```css
/* Superficie de tarjeta Clay en reposo */
.clay-card {
  background-color: #FFFFFF;
  border-radius: 1.5rem; /* 24px */
  border: 1px solid rgba(30, 41, 59, 0.06);
  box-shadow:
    0 8px 20px -4px rgba(30, 41, 59, 0.06),
    0 2px 6px -1px rgba(30, 41, 59, 0.04),
    inset 0 1px 2px 0 rgba(255, 255, 255, 0.9),
    inset 0 -2px 4px 0 rgba(30, 41, 59, 0.03);
}

/* Píldora o badge pastel con relieve táctil */
.clay-pill {
  border-radius: 9999px;
  box-shadow:
    0 4px 12px -2px rgba(30, 41, 59, 0.08),
    inset 0 2px 3px 0 rgba(255, 255, 255, 0.6),
    inset 0 -2px 3px 0 rgba(0, 0, 0, 0.04);
}

/* Botones táctiles accesibles (48px - 54px) con micro-compresión */
.clay-btn-primary,
.clay-btn-secondary,
.clay-btn-danger {
  min-height: 50px;
  border-radius: 9999px;
  transition: transform 150ms ease, box-shadow 150ms ease, background-color 150ms ease;
}
.clay-btn-primary:active,
.clay-btn-secondary:active,
.clay-btn-danger:active {
  transform: scale(0.985);
}

/* Campos de entrada suavemente hundidos para /admin */
.clay-input {
  min-height: 48px;
  background-color: #FFFFFF;
  border: 1.5px solid #CBD5E1;
  border-radius: 0.875rem;
  box-shadow: inset 0 2px 4px rgba(30, 41, 59, 0.05);
}
.clay-input:focus {
  border-color: #4F46E5;
  outline: 2px solid rgba(79, 70, 229, 0.2);
}
```

---

## 5. Guardrails Semánticos y Conciliación con las 35 Suites de Prueba

1. **Lista Blanca Obligatoria:** Toda vista conserva íntegros los textos verificados por las suites automatizadas:
   - `"nivel informativo de lluvia"` (`Nivel informativo de lluvia: NORMAL | PRECAUCIÓN | ALERTA | EMERGENCIA`).
   - `"recomendaciones preventivas generales"`.
   - `"referencia de demostración, no validada"`.
   - `"distancia aproximada en línea recta (no es recomendación de ruta ni indica seguridad)"`.
   - `"Datos del [fecha y hora], no actualizados"`.
2. **Prohibición Estricta de Lista Negra y Sensores Inexistentes:** Prohibido incluir términos de la lista negra ni referencias a sensores geotécnicos o sísmicos que no forman parte de la arquitectura real basada en Open-Meteo.
