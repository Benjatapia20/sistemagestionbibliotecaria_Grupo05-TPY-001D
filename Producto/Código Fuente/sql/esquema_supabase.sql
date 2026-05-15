-- =====================================================================
-- SISTEMA DE GESTIÓN BIBLIOTECARIA - BASE DE DATOS SUPABASE (Nube)
-- =====================================================================
-- Ejecutar en el SQL Editor de Supabase
-- =====================================================================

-- Extensión necesaria para generar UUIDs (ya incluida en Supabase)
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
-- SECCIÓN 5: POLICIES DE SEGURIDAD (ROW LEVEL SECURITY)
-- =====================================================================

-- --- FAVORITOS ---
ALTER TABLE public.favoritos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Usuarios pueden ver sus propios favoritos" ON public.favoritos;
CREATE POLICY "Usuarios pueden ver sus propios favoritos" 
ON public.favoritos FOR SELECT 
USING (auth.uid()::text = usuario_id);

DROP POLICY IF EXISTS "Usuarios pueden insertar sus propios favoritos" ON public.favoritos;
CREATE POLICY "Usuarios pueden insertar sus propios favoritos" 
ON public.favoritos FOR INSERT 
WITH CHECK (auth.uid()::text = usuario_id);

DROP POLICY IF EXISTS "Usuarios pueden eliminar sus propios favoritos" ON public.favoritos;
CREATE POLICY "Usuarios pueden eliminar sus propios favoritos" 
ON public.favoritos FOR DELETE 
USING (auth.uid()::text = usuario_id);

-- --- PRÉSTAMOS ---
ALTER TABLE public.prestamos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Usuarios pueden ver sus propios préstamos" ON public.prestamos;
CREATE POLICY "Usuarios pueden ver sus propios préstamos" 
ON public.prestamos FOR SELECT 
USING (auth.uid()::text = usuario_id);

DROP POLICY IF EXISTS "Usuarios pueden solicitar préstamos" ON public.prestamos;
CREATE POLICY "Usuarios pueden solicitar préstamos" 
ON public.prestamos FOR INSERT 
WITH CHECK (auth.uid()::text = usuario_id);

DROP POLICY IF EXISTS "Usuarios pueden solicitar devolucion" ON public.prestamos;
CREATE POLICY "Usuarios pueden solicitar devolucion" 
ON public.prestamos FOR UPDATE 
USING (auth.uid()::text = usuario_id)
WITH CHECK (auth.uid()::text = usuario_id);

DROP POLICY IF EXISTS "Usuarios pueden solicitar renovacion" ON public.prestamos;
CREATE POLICY "Usuarios pueden solicitar renovacion" 
ON public.prestamos FOR UPDATE 
USING (auth.uid()::text = usuario_id)
WITH CHECK (auth.uid()::text = usuario_id);

DROP POLICY IF EXISTS "Admins pueden ver todos los préstamos" ON public.prestamos;
CREATE POLICY "Admins pueden ver todos los préstamos" 
ON public.prestamos FOR SELECT 
USING (
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() AND rol = 'admin'
    )
);

DROP POLICY IF EXISTS "Admins pueden gestionar préstamos" ON public.prestamos;
CREATE POLICY "Admins pueden gestionar préstamos" 
ON public.prestamos FOR ALL 
USING (
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() AND rol = 'admin'
    )
);

-- --- CONFIG PRÉSTAMOS ---
ALTER TABLE public.config_prestamos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Todos pueden ver configuración de préstamos" ON public.config_prestamos;
CREATE POLICY "Todos pueden ver configuración de préstamos" 
ON public.config_prestamos FOR SELECT 
USING (true);

DROP POLICY IF EXISTS "Solo admins pueden modificar configuración" ON public.config_prestamos;
CREATE POLICY "Solo admins pueden modificar configuración" 
ON public.config_prestamos FOR UPDATE 
USING (
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() AND rol = 'admin'
    )
);

-- --- CUENTAS TEMPORALES ---
ALTER TABLE public.cuentas_temporales ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Usuarios pueden ver su cuenta temporal" ON public.cuentas_temporales;
CREATE POLICY "Usuarios pueden ver su cuenta temporal" 
ON public.cuentas_temporales FOR SELECT 
USING (auth.uid()::text = auth_id OR username = current_user);

-- =====================================================================
-- SECCIÓN 6: FUNCIONES AUXILIARES
-- =====================================================================

-- Función para calcular multa por atraso
CREATE OR REPLACE FUNCTION calcular_multa(prestamo_id UUID)
RETURNS DECIMAL(10,2) AS $$
DECLARE
    v_prestamo RECORD;
    v_config RECORD;
    v_dias_atraso INT;
    v_multa DECIMAL(10,2);
BEGIN
    SELECT * INTO v_prestamo FROM public.prestamos WHERE id = prestamo_id;
    SELECT * INTO v_config FROM public.config_prestamos WHERE id = 1;
    
    IF v_prestamo.fecha_devolucion_real IS NULL THEN
        v_dias_atraso := GREATEST(0, EXTRACT(DAY FROM (NOW() - v_prestamo.fecha_devolucion_esperada))::INT);
    ELSE
        v_dias_atraso := GREATEST(0, EXTRACT(DAY FROM (v_prestamo.fecha_devolucion_real - v_prestamo.fecha_devolucion_esperada))::INT);
    END IF;
    
    v_multa := v_dias_atraso * v_config.multa_por_dia;
    
    IF v_prestamo.estado_libro_devolucion = 'danado' THEN
        v_multa := v_multa + (v_config.multa_por_dia * 7);
    ELSIF v_prestamo.estado_libro_devolucion = 'perdido' THEN
        v_multa := v_multa + (v_config.multa_por_dia * 30);
    END IF;
    
    RETURN v_multa;
END;
$$ LANGUAGE plpgsql;

-- Función para obtener préstamos activos de un usuario
CREATE OR REPLACE FUNCTION obtener_prestamos_activos(p_usuario_id VARCHAR(255))
RETURNS INT AS $$
DECLARE
    v_count INT;
BEGIN
    SELECT COUNT(*) INTO v_count 
    FROM public.prestamos 
    WHERE usuario_id = p_usuario_id AND estado = 'activo';
    RETURN v_count;
END;
$$ LANGUAGE plpgsql;
