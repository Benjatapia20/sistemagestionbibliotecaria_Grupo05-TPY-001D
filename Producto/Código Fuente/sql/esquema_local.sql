-- =====================================================================
-- SISTEMA DE GESTIÓN BIBLIOTECARIA - BASE DE DATOS LOCAL (Docker)
-- =====================================================================
-- Ejecutar en Adminer/pgAdmin conectado a tu Docker local
-- =====================================================================

-- Extensión necesaria para generar UUIDs
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =====================================================================
-- SECCIÓN 1: TABLA DE FAVORITOS
-- =====================================================================

DROP TABLE IF EXISTS public.favoritos CASCADE;
CREATE TABLE public.favoritos (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    usuario_id VARCHAR(255) NOT NULL,
    libro_id INT NOT NULL REFERENCES public.libros(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(usuario_id, libro_id)
);

-- =====================================================================
-- SECCIÓN 2: TABLA DE PRÉSTAMOS
-- =====================================================================

DROP TABLE IF EXISTS public.prestamos CASCADE;
CREATE TABLE public.prestamos (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    usuario_id VARCHAR(255) NOT NULL,
    libro_id INT NOT NULL REFERENCES public.libros(id) ON DELETE RESTRICT,
    estado VARCHAR(25) NOT NULL DEFAULT 'solicitado',
    fecha_solicitud TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    fecha_aprobacion TIMESTAMP WITH TIME ZONE,
    fecha_devolucion_esperada TIMESTAMP WITH TIME ZONE NOT NULL,
    fecha_devolucion_real TIMESTAMP WITH TIME ZONE,
    multa DECIMAL(10,2) DEFAULT 0,
    multa_pagada BOOLEAN DEFAULT FALSE,
    observaciones TEXT,
    observaciones_devolucion TEXT,
    estado_libro_devolucion VARCHAR(50),
    fecha_solicitud_devolucion TIMESTAMP WITH TIME ZONE,
    fecha_solicitud_renovacion TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índice para búsquedas rápidas por usuario y estado
CREATE INDEX idx_prestamos_usuario_estado ON public.prestamos(usuario_id, estado);
CREATE INDEX idx_prestamos_libro_estado ON public.prestamos(libro_id, estado);

-- =====================================================================
-- SECCIÓN 3: CONFIGURACIÓN DE PRÉSTAMOS
-- =====================================================================

DROP TABLE IF EXISTS public.config_prestamos CASCADE;
CREATE TABLE public.config_prestamos (
    id INT PRIMARY KEY DEFAULT 1,
    dias_maximos_prestamo INT DEFAULT 14,
    multa_por_dia DECIMAL(10,2) DEFAULT 100,
    max_prestamos_activos INT DEFAULT 3,
    renovaciones_permitidas INT DEFAULT 1
);

-- Insertar configuración por defecto
INSERT INTO public.config_prestamos (id, dias_maximos_prestamo, multa_por_dia, max_prestamos_activos, renovaciones_permitidas)
VALUES (1, 14, 100, 3, 1)
ON CONFLICT (id) DO NOTHING;

-- =====================================================================
-- SECCIÓN 4: CUENTAS TEMPORALES (para autenticación local)
-- =====================================================================

DROP TABLE IF EXISTS public.cuentas_temporales CASCADE;
CREATE TABLE public.cuentas_temporales (
    username TEXT PRIMARY KEY,
    password TEXT NOT NULL,
    rol TEXT NOT NULL DEFAULT 'usuario',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    auth_id TEXT,
    email TEXT
);

-- =====================================================================
-- SECCIÓN 5: PERMISOS PARA POSTGREST (ROL web_anon)
-- =====================================================================

-- Crear rol si no existe
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'web_anon') THEN
        CREATE ROLE web_anon NOLOGIN;
    END IF;
END
$$;

-- Permisos generales en schema public
GRANT USAGE ON SCHEMA public TO web_anon;
GRANT ALL ON ALL TABLES IN SCHEMA public TO web_anon;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO web_anon;

-- Permisos específicos para tabla prestamos
GRANT SELECT, INSERT, UPDATE ON public.prestamos TO web_anon;

-- Permisos para tabla config_prestamos
GRANT SELECT, UPDATE ON public.config_prestamos TO web_anon;

-- Permisos para tabla favoritos
GRANT SELECT, INSERT, DELETE ON public.favoritos TO web_anon;

-- Permisos para tabla cuentas_temporales
GRANT SELECT, INSERT, UPDATE ON public.cuentas_temporales TO web_anon;

-- Permisos para tabla libros
GRANT SELECT, INSERT, UPDATE ON public.libros TO web_anon;
