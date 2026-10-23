# PUKARA — Diagramas de Arquitectura y Modelo Entidad-Relación

**Sistema web móvil para la consulta de condiciones de lluvias intensas, clasificación informativa y recomendaciones preventivas en el sector Llojeta, La Paz.**

---

## 1. Arquitectura de Monolito en Capas (Figura 1)

El sistema PUKARA está estructurado bajo un patrón de **monolito modular en capas desacopladas**. El cliente móvil (PWA) interactúa de forma exclusiva con el backend a través de endpoints REST en `/api`, protegiendo la privacidad de la ubicación del usuario (cálculo Haversine en el cliente) y aislando la obtención de datos meteorológicos externos.

```mermaid
graph TD
    subgraph Cliente ["Cliente Web Móvil (PWA - /client)"]
        UI["Interfaz de Usuario Mobile-First<br/>(React 18 + Tailwind CSS)"]
        Router["Enrutamiento SPA<br/>(React Router)"]
        Map["Cartografía Referencial<br/>(Leaflet)"]
        GeoClient["Cálculo Local de Distancia<br/>(Fórmula Haversine en Dispositivo)"]
        SW["Service Worker y Caché Offline<br/>(Vite PWA Plugin)"]
        UI --> Router
        UI --> Map
        UI --> GeoClient
        UI --> SW
    end

    subgraph Backend ["Backend Monolítico Express (/server)"]
        Routes["Capa de Rutas REST<br/>(/src/routes)"]
        Middlewares["Middlewares: CORS, JSON,<br/>Auth JWT, Validación<br/>(/src/middleware)"]
        Services["Capa de Servicios de Aplicación<br/>(/src/services)"]
        Engine["Motor de Reglas Funcional Puro<br/>(Pure Functions / Sin Efectos Secundarios)<br/>(/src/engine)"]
        DBPool["Capa de Persistencia Nativa<br/>(Pool de PostgreSQL con pg)<br/>(/src/db)"]

        Routes --> Middlewares
        Middlewares --> Services
        Services --> Engine
        Services --> DBPool
    end

    subgraph Persistencia ["Base de Datos Relacional"]
        PG[("PostgreSQL 16 Nativo<br/>(10 Tablas Relacionales)<br/>Geometría y Datos en JSONB<br/>(PROHIBIDO PostGIS)")]
        DBPool --> PG
    end

    subgraph Externos ["Servicios y Proveedores Externos"]
        OpenMeteo["API Open-Meteo<br/>(Pronóstico y series horarias de lluvia)"]
        OSMTiles["Servidor de Teselas OpenStreetMap<br/>(tile.openstreetmap.org)<br/>(Consumo bajo demanda con atribución)"]
    end

    %% Relaciones cliente-servidor y externos
    UI -- "Peticiones HTTP REST (/api)<br/>(Cero llamadas directas a APIs externas)" --> Routes
    Services -- "Consultas Meteorológicas<br/>(Caché 10-15 min, reintentos controlados)" --> OpenMeteo
    Map -- "Carga de teselas visuales<br/>(Bajo demanda, sin precarga masiva)" --> OSMTiles

    classDef clientStyle fill:#e0f2fe,stroke:#0284c7,stroke-width:2px,color:#0369a1;
    classDef serverStyle fill:#fef3c7,stroke:#d97706,stroke-width:2px,color:#92400e;
    classDef dbStyle fill:#dcfce7,stroke:#16a34a,stroke-width:2px,color:#15803d;
    classDef extStyle fill:#f1f5f9,stroke:#64748b,stroke-width:2px,color:#334155;

    class UI,Router,Map,GeoClient,SW clientStyle;
    class Routes,Middlewares,Services,Engine,DBPool serverStyle;
    class PG dbStyle;
    class OpenMeteo,OSMTiles extStyle;
```

---

## 2. Diagrama Entidad-Relación de las 10 Tablas (Figura 2)

El esquema de base de datos de PUKARA se compone de **10 tablas inmutables**, normalizadas y protegidas mediante restricciones de integridad referencial, índices únicos parciales y tipos de datos `JSONB` nativos.

```mermaid
erDiagram
    usuarios ||--o{ configuraciones_reglas : "crea"
    usuarios ||--o{ recomendaciones_preventivas : "actualiza"
    usuarios ||--o{ bitacora_cambios : "registra_accion"
    configuraciones_reglas ||--|{ umbrales : "define"
    configuraciones_reglas ||--o{ evaluaciones_nivel : "aplica_en"
    lecturas_meteorologicas ||--o{ evaluaciones_nivel : "evaluada_en"

    usuarios {
        bigint id PK
        varchar nombre
        varchar email UK
        varchar password_hash
        varchar rol
        boolean activo
        timestamptz creado_en
        timestamptz actualizado_en
    }

    configuraciones_reglas {
        bigint id PK
        integer version UK
        varchar estado
        jsonb parametros
        bigint creada_por FK
        timestamptz creada_en
        timestamptz activada_en
        text motivo
    }

    umbrales {
        bigint id PK
        bigint configuracion_id FK
        varchar variable
        varchar nivel
        numeric valor
    }

    lecturas_meteorologicas {
        bigint id PK
        varchar modalidad
        varchar fuente
        timestamptz observado_en
        timestamptz recibido_en
        numeric intensidad_mm_h
        numeric acum_24h_mm
        numeric acum_72h_mm
        smallint horas_validas_24h
        smallint horas_validas_72h
        varchar estado
        numeric temperatura
        numeric humedad
        numeric viento
    }

    evaluaciones_nivel {
        bigint id PK
        bigint lectura_id FK
        bigint configuracion_id FK
        varchar nivel_calculado
        varchar nivel_vigente
        varchar estado_sistema
        smallint contador_descenso
        timestamptz evaluada_en
    }

    recomendaciones_preventivas {
        bigint id PK
        varchar nivel
        varchar titulo
        text contenido
        integer version
        varchar estado_publicacion
        varchar origen
        varchar fuente
        bigint actualizado_por FK
        timestamptz actualizado_en
    }

    contactos_emergencia {
        bigint id PK
        varchar nombre
        varchar telefono
        varchar fuente
        date verificado_en
        boolean activo
    }

    zonas_referencia {
        bigint id PK
        varchar nombre
        jsonb geometria
        varchar fuente
        date fecha_dato
        date vigente_hasta
        boolean verificada
        text advertencia
    }

    puntos_referencia {
        bigint id PK
        varchar nombre
        varchar tipo
        numeric latitud
        numeric longitud
        varchar fuente
        varchar estado_verificacion
        boolean activo
    }

    bitacora_cambios {
        bigint id PK
        bigint usuario_id FK
        varchar entidad
        bigint entidad_id
        varchar accion
        jsonb valor_anterior
        jsonb valor_nuevo
        timestamptz ocurrido_en
    }
```

---

### Descripción de Relaciones y Cardinalidades

1. **`usuarios` -> `configuraciones_reglas` (1:N):**
   Un usuario administrador puede proponer y activar múltiples versiones de parámetros de evaluación (`creada_por`).
2. **`configuraciones_reglas` -> `umbrales` (1:N):**
   Cada versión de configuración contiene exactamente 9 tuplas de umbrales cuantitativos (3 métricas x 3 niveles superiores: `PRECAUCION`, `ALERTA`, `EMERGENCIA`). Al eliminarse una configuración, sus umbrales se eliminan en cascada (`ON DELETE CASCADE`).
3. **`configuraciones_reglas` -> `evaluaciones_nivel` (1:N):**
   Cada evaluación histórica queda referenciada a la versión inmutable de umbrales con la que fue calculada (`ON DELETE RESTRICT`).
4. **`lecturas_meteorologicas` -> `evaluaciones_nivel` (1:N):**
   Una lectura meteorológica (real o simulada) da origen a la evaluación del nivel informativo.
5. **`usuarios` -> `recomendaciones_preventivas` (1:N):**
   Un usuario administrador registra o actualiza el texto de las recomendaciones preventivas por nivel (`actualizado_por`).
6. **`usuarios` -> `bitacora_cambios` (1:N):**
   Toda acción administrativa queda registrada en auditoría vinculada al identificador del administrador responsable (`usuario_id`).
7. **Tablas de Catálogo y Consulta Directa:**
   `zonas_referencia`, `puntos_referencia` y `contactos_emergencia` funcionan de forma desacoplada para optimizar las consultas públicas en línea y fuera de línea (PWA Offline).
