-- ==============================================================================
-- PUKARA: Migración 001 - Esquema Inicial de Base de Datos (10 Tablas Obligatorias)
-- Sistema para Sector Llojeta, La Paz
-- NOTA: Geometría GeoJSON en JSONB nativo. PROHIBIDO PostGIS y ORMs.
-- ==============================================================================

-- 1. Tabla: usuarios
CREATE TABLE IF NOT EXISTS usuarios (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(100) NOT NULL,
    rol VARCHAR(20) NOT NULL CHECK (rol IN ('administrador')),
    activo BOOLEAN NOT NULL DEFAULT true,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
    actualizado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Tabla: configuraciones_reglas
CREATE TABLE IF NOT EXISTS configuraciones_reglas (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    version INTEGER NOT NULL UNIQUE CHECK (version >= 1),
    estado VARCHAR(10) NOT NULL CHECK (estado IN ('borrador', 'vigente', 'archivada')),
    parametros JSONB NOT NULL,
    creada_por BIGINT NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
    creada_en TIMESTAMPTZ NOT NULL DEFAULT now(),
    activada_en TIMESTAMPTZ NULL,
    motivo TEXT NULL
);

-- Índice único parcial obligatorio: solo puede existir una configuración en estado 'vigente'
CREATE UNIQUE INDEX IF NOT EXISTS idx_unica_configuracion_vigente 
ON configuraciones_reglas (estado) 
WHERE estado = 'vigente';

-- 3. Tabla: umbrales
CREATE TABLE IF NOT EXISTS umbrales (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    configuracion_id BIGINT NOT NULL REFERENCES configuraciones_reglas(id) ON DELETE CASCADE,
    variable VARCHAR(20) NOT NULL CHECK (variable IN ('intensidad_mm_h', 'acum_24h_mm', 'acum_72h_mm')),
    nivel VARCHAR(12) NOT NULL CHECK (nivel IN ('PRECAUCION', 'ALERTA', 'EMERGENCIA')),
    valor NUMERIC(7,2) NOT NULL CHECK (valor >= 0),
    CONSTRAINT uq_umbral_config_var_nivel UNIQUE (configuracion_id, variable, nivel)
);

-- 4. Tabla: lecturas_meteorologicas
CREATE TABLE IF NOT EXISTS lecturas_meteorologicas (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    modalidad VARCHAR(10) NOT NULL CHECK (modalidad IN ('real', 'simulada')),
    fuente VARCHAR(50) NOT NULL,
    observado_en TIMESTAMPTZ NOT NULL,
    recibido_en TIMESTAMPTZ NOT NULL DEFAULT now(),
    intensidad_mm_h NUMERIC(6,2) NULL,
    acum_24h_mm NUMERIC(7,2) NULL,
    acum_72h_mm NUMERIC(7,2) NULL,
    horas_validas_24h SMALLINT NULL CHECK (horas_validas_24h BETWEEN 0 AND 24),
    horas_validas_72h SMALLINT NULL CHECK (horas_validas_72h BETWEEN 0 AND 72),
    estado VARCHAR(10) NOT NULL CHECK (estado IN ('valida', 'incompleta', 'invalida')),
    temperatura NUMERIC(4,1) NULL,
    humedad NUMERIC(5,2) NULL,
    viento NUMERIC(5,1) NULL,
    CONSTRAINT uq_lectura_modalidad_fuente_obs UNIQUE (modalidad, fuente, observado_en)
);

-- Índice de apoyo para consultas por modalidad y orden temporal
CREATE INDEX IF NOT EXISTS idx_lecturas_modalidad_obs 
ON lecturas_meteorologicas (modalidad, observado_en DESC);

-- 5. Tabla: evaluaciones_nivel (NUNCA llamarla 'alertas')
CREATE TABLE IF NOT EXISTS evaluaciones_nivel (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    lectura_id BIGINT NOT NULL REFERENCES lecturas_meteorologicas(id) ON DELETE RESTRICT,
    configuracion_id BIGINT NOT NULL REFERENCES configuraciones_reglas(id) ON DELETE RESTRICT,
    nivel_calculado VARCHAR(12) NOT NULL CHECK (nivel_calculado IN ('NORMAL', 'PRECAUCION', 'ALERTA', 'EMERGENCIA')),
    nivel_vigente VARCHAR(12) NOT NULL CHECK (nivel_vigente IN ('NORMAL', 'PRECAUCION', 'ALERTA', 'EMERGENCIA')),
    estado_sistema VARCHAR(25) NOT NULL CHECK (estado_sistema IN ('NORMAL', 'PRECAUCION', 'ALERTA', 'EMERGENCIA')),
    contador_descenso SMALLINT NOT NULL DEFAULT 0 CHECK (contador_descenso >= 0),
    evaluada_en TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_evaluacion_lectura_config UNIQUE (lectura_id, configuracion_id)
);

CREATE INDEX IF NOT EXISTS idx_evaluaciones_evaluada_en 
ON evaluaciones_nivel (evaluada_en DESC);

-- 6. Tabla: recomendaciones_preventivas (NUNCA llamarla 'protocolos')
CREATE TABLE IF NOT EXISTS recomendaciones_preventivas (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    nivel VARCHAR(12) NOT NULL CHECK (nivel IN ('NORMAL', 'PRECAUCION', 'ALERTA', 'EMERGENCIA')),
    titulo VARCHAR(150) NOT NULL,
    contenido TEXT NOT NULL,
    version INTEGER NOT NULL CHECK (version >= 1),
    estado_publicacion VARCHAR(10) NOT NULL CHECK (estado_publicacion IN ('borrador', 'publicado', 'archivado')),
    origen VARCHAR(25) NOT NULL CHECK (origen IN ('demostracion', 'institucional_verificada')),
    fuente VARCHAR(255) NULL,
    actualizado_por BIGINT NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
    actualizado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_recomendacion_nivel_version UNIQUE (nivel, version)
);

-- 7. Tabla: contactos_emergencia
CREATE TABLE IF NOT EXISTS contactos_emergencia (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    telefono VARCHAR(30) NOT NULL,
    fuente VARCHAR(255) NULL,
    verificado_en DATE NULL,
    activo BOOLEAN NOT NULL DEFAULT true
);

-- 8. Tabla: zonas_referencia
CREATE TABLE IF NOT EXISTS zonas_referencia (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    geometria JSONB NOT NULL,
    fuente VARCHAR(255) NOT NULL,
    fecha_dato DATE NOT NULL,
    vigente_hasta DATE NULL,
    verificada BOOLEAN NOT NULL DEFAULT false,
    advertencia TEXT NOT NULL DEFAULT 'referencia de demostración, no validada'
);

-- 9. Tabla: puntos_referencia
CREATE TABLE IF NOT EXISTS puntos_referencia (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    tipo VARCHAR(50) NULL,
    latitud NUMERIC(9,6) NOT NULL CHECK (latitud BETWEEN -90 AND 90),
    longitud NUMERIC(9,6) NOT NULL CHECK (longitud BETWEEN -180 AND 180),
    fuente VARCHAR(255) NULL,
    estado_verificacion VARCHAR(30) NOT NULL CHECK (estado_verificacion IN ('sin_verificar', 'verificado_por_autoridad')),
    activo BOOLEAN NOT NULL DEFAULT true
);

-- 10. Tabla: bitacora_cambios
CREATE TABLE IF NOT EXISTS bitacora_cambios (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    usuario_id BIGINT NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
    entidad VARCHAR(50) NOT NULL,
    entidad_id BIGINT NOT NULL,
    accion VARCHAR(20) NOT NULL,
    valor_anterior JSONB NULL,
    valor_nuevo JSONB NULL,
    ocurrido_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bitacora_entidad 
ON bitacora_cambios (entidad, entidad_id);

CREATE INDEX IF NOT EXISTS idx_bitacora_ocurrido_en 
ON bitacora_cambios (ocurrido_en DESC);
