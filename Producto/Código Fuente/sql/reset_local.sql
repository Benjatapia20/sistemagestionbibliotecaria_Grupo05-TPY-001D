-- =====================================================================
-- RESET LOCAL - Borrar TODO y recrear limpio
-- =====================================================================
-- Ejecutar en Adminer/pgAdmin (Docker local)
-- =====================================================================

-- 1. Revocar permisos de web_anon
REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM web_anon;
REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public FROM web_anon;
REVOKE ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA public FROM web_anon;
REVOKE ALL PRIVILEGES ON SCHEMA public FROM web_anon;

-- 2. Eliminar triggers
DROP TRIGGER IF EXISTS trigger_usuarios_updated_at ON public.usuarios;
DROP TRIGGER IF EXISTS trigger_libros_updated_at ON public.libros;

-- 3. Eliminar tablas
DROP TABLE IF EXISTS public.acciones_pendientes CASCADE;
DROP TABLE IF EXISTS public.prestamos CASCADE;
DROP TABLE IF EXISTS public.favoritos CASCADE;
DROP TABLE IF EXISTS public.config_prestamos CASCADE;
DROP TABLE IF EXISTS public.cuentas_temporales CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;
DROP TABLE IF EXISTS public.usuarios CASCADE;
DROP TABLE IF EXISTS public.libros CASCADE;

-- 4. Eliminar funciones
DROP FUNCTION IF EXISTS login_local(TEXT, TEXT) CASCADE;
DROP FUNCTION IF EXISTS registrar_usuario_local(TEXT, TEXT, TEXT) CASCADE;
DROP FUNCTION IF EXISTS calcular_multa(UUID) CASCADE;
DROP FUNCTION IF EXISTS obtener_prestamos_activos(VARCHAR) CASCADE;
DROP FUNCTION IF EXISTS actualizar_updated_at() CASCADE;
DROP FUNCTION IF EXISTS aprobar_prestamo_op(UUID) CASCADE;
DROP FUNCTION IF EXISTS rechazar_prestamo_op(UUID) CASCADE;
DROP FUNCTION IF EXISTS solicitar_devolucion_op(UUID, TEXT, TEXT) CASCADE;
DROP FUNCTION IF EXISTS aprobar_devolucion_op(UUID, TEXT, NUMERIC) CASCADE;
DROP FUNCTION IF EXISTS rechazar_devolucion_op(UUID) CASCADE;
DROP FUNCTION IF EXISTS solicitar_renovacion_op(UUID) CASCADE;
DROP FUNCTION IF EXISTS aprobar_renovacion_op(UUID, INT) CASCADE;
DROP FUNCTION IF EXISTS rechazar_renovacion_op(UUID) CASCADE;

-- 5. Eliminar vistas
DROP VIEW IF EXISTS vista_prestamos_completos CASCADE;
DROP VIEW IF EXISTS vista_favoritos_completos CASCADE;

-- 6. Eliminar rol
DROP ROLE IF EXISTS web_anon;

-- 7. Verificar
SELECT tablename FROM pg_tables WHERE schemaname = 'public';
-- Debe devolver 0 filas

-- =====================================================================
-- RECREAR TODO LIMPIO
-- =====================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- TABLAS
-- ============================================================

CREATE TABLE public.usuarios (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    username TEXT UNIQUE,
    email TEXT UNIQUE,
    nombre_completo TEXT,
    password TEXT,
    rol TEXT NOT NULL DEFAULT 'usuario',
    tipo_auth TEXT NOT NULL DEFAULT 'local',
    auth_ref_id TEXT,
    activo BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_usuarios_username ON public.usuarios(username);
CREATE INDEX idx_usuarios_email ON public.usuarios(email);
CREATE INDEX idx_usuarios_rol ON public.usuarios(rol);

CREATE TABLE public.libros (
    id SERIAL PRIMARY KEY,
    titulo TEXT NOT NULL,
    autor TEXT,
    isbn TEXT,
    genero TEXT,
    stock INT DEFAULT 0,
    caratula TEXT,
    caratula_url TEXT,
    editorial TEXT,
    anio_publication INT,
    sinopsis TEXT,
    idioma TEXT,
    paginas INT,
    ubicacion TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_libros_titulo ON public.libros(titulo);
CREATE INDEX idx_libros_autor ON public.libros(autor);
CREATE INDEX idx_libros_genero ON public.libros(genero);

CREATE TABLE public.favoritos (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    usuario_id UUID NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
    libro_id INT NOT NULL REFERENCES public.libros(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(usuario_id, libro_id)
);
CREATE INDEX idx_favoritos_usuario ON public.favoritos(usuario_id);
CREATE INDEX idx_favoritos_libro ON public.favoritos(libro_id);

CREATE TABLE public.prestamos (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    usuario_id UUID NOT NULL REFERENCES public.usuarios(id) ON DELETE RESTRICT,
    libro_id INT NOT NULL REFERENCES public.libros(id) ON DELETE RESTRICT,
    estado VARCHAR(25) NOT NULL DEFAULT 'solicitado',
    fecha_solicitud TIMESTAMPTZ DEFAULT NOW(),
    fecha_aprobacion TIMESTAMPTZ,
    fecha_devolucion_esperada TIMESTAMPTZ NOT NULL,
    fecha_devolucion_real TIMESTAMPTZ,
    multa DECIMAL(10,2) DEFAULT 0,
    multa_pagada BOOLEAN DEFAULT FALSE,
    observaciones TEXT,
    observaciones_devolucion TEXT,
    estado_libro_devolucion VARCHAR(50),
    fecha_solicitud_devolucion TIMESTAMPTZ,
    fecha_solicitud_renovacion TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_prestamos_usuario ON public.prestamos(usuario_id);
CREATE INDEX idx_prestamos_libro ON public.prestamos(libro_id);
CREATE INDEX idx_prestamos_usuario_estado ON public.prestamos(usuario_id, estado);
CREATE INDEX idx_prestamos_estado ON public.prestamos(estado);

CREATE TABLE public.config_prestamos (
    id INT PRIMARY KEY DEFAULT 1,
    dias_maximos_prestamo INT DEFAULT 14,
    multa_por_dia DECIMAL(10,2) DEFAULT 100,
    max_prestamos_activos INT DEFAULT 3,
    renovaciones_permitidas INT DEFAULT 1
);
INSERT INTO public.config_prestamos VALUES (1, 14, 100, 3, 1) ON CONFLICT DO NOTHING;

CREATE TABLE public.acciones_pendientes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    type TEXT NOT NULL,
    usuario_id UUID NOT NULL,
    payload JSONB NOT NULL,
    aplicado BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_acciones_ts ON public.acciones_pendientes(timestamp);
CREATE INDEX idx_acciones_apl ON public.acciones_pendientes(aplicado);
CREATE INDEX idx_acciones_usr ON public.acciones_pendientes(usuario_id);

CREATE TABLE public.cuentas_temporales (
    username TEXT PRIMARY KEY,
    password TEXT NOT NULL,
    rol TEXT NOT NULL DEFAULT 'usuario',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    auth_id TEXT,
    email TEXT,
    usuario_id UUID REFERENCES public.usuarios(id) ON DELETE SET NULL
);

CREATE TABLE public.profiles (
    id UUID PRIMARY KEY,
    rol TEXT NOT NULL DEFAULT 'usuario',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    usuario_id UUID REFERENCES public.usuarios(id) ON DELETE SET NULL
);

-- ============================================================
-- TRIGGERS
-- ============================================================

CREATE OR REPLACE FUNCTION actualizar_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_usuarios_updated_at BEFORE UPDATE ON public.usuarios FOR EACH ROW EXECUTE FUNCTION actualizar_updated_at();
CREATE TRIGGER trigger_libros_updated_at BEFORE UPDATE ON public.libros FOR EACH ROW EXECUTE FUNCTION actualizar_updated_at();

-- ============================================================
-- FUNCIONES ATÓMICAS (evitan race conditions)
-- ============================================================

CREATE OR REPLACE FUNCTION aprobar_prestamo_op(prestamo_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_prestamo RECORD;
    v_stock_actual INT;
BEGIN
    SELECT * INTO v_prestamo FROM public.prestamos WHERE id = prestamo_id FOR UPDATE;
    IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'message', 'Préstamo no encontrado'); END IF;
    IF v_prestamo.estado != 'solicitado' THEN RETURN jsonb_build_object('success', false, 'message', 'Ya procesado'); END IF;
    SELECT stock INTO v_stock_actual FROM public.libros WHERE id = v_prestamo.libro_id FOR UPDATE;
    IF v_stock_actual <= 0 THEN RETURN jsonb_build_object('success', false, 'message', 'Sin stock'); END IF;
    UPDATE public.libros SET stock = stock - 1, updated_at = NOW() WHERE id = v_prestamo.libro_id;
    UPDATE public.prestamos SET estado = 'activo', fecha_aprobacion = NOW() WHERE id = prestamo_id;
    RETURN jsonb_build_object('success', true, 'message', 'Aprobado');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION rechazar_prestamo_op(prestamo_id UUID)
RETURNS JSONB AS $$
DECLARE v_prestamo RECORD;
BEGIN
    SELECT * INTO v_prestamo FROM public.prestamos WHERE id = prestamo_id FOR UPDATE;
    IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'message', 'Préstamo no encontrado'); END IF;
    IF v_prestamo.estado != 'solicitado' THEN RETURN jsonb_build_object('success', false, 'message', 'Ya procesado'); END IF;
    UPDATE public.prestamos SET estado = 'rechazado' WHERE id = prestamo_id;
    RETURN jsonb_build_object('success', true, 'message', 'Rechazado');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION solicitar_devolucion_op(prestamo_id UUID, p_estado_libro TEXT, p_observaciones TEXT DEFAULT NULL)
RETURNS JSONB AS $$
DECLARE v_prestamo RECORD;
BEGIN
    SELECT * INTO v_prestamo FROM public.prestamos WHERE id = prestamo_id FOR UPDATE;
    IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'message', 'Préstamo no encontrado'); END IF;
    IF v_prestamo.estado NOT IN ('activo', 'vencido') THEN RETURN jsonb_build_object('success', false, 'message', 'Solo activos o vencidos'); END IF;
    UPDATE public.prestamos SET estado = 'devolucion_solicitada', fecha_solicitud_devolucion = NOW(), estado_libro_devolucion = p_estado_libro, observaciones_devolucion = COALESCE(p_observaciones, observaciones) WHERE id = prestamo_id;
    RETURN jsonb_build_object('success', true, 'message', 'Devolución solicitada');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION aprobar_devolucion_op(prestamo_id UUID, p_estado_libro TEXT DEFAULT NULL, p_multa NUMERIC DEFAULT 0)
RETURNS JSONB AS $$
DECLARE
    v_prestamo RECORD;
    v_multa NUMERIC;
BEGIN
    SELECT * INTO v_prestamo FROM public.prestamos WHERE id = prestamo_id FOR UPDATE;
    IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'message', 'Préstamo no encontrado'); END IF;
    IF v_prestamo.estado != 'devolucion_solicitada' THEN RETURN jsonb_build_object('success', false, 'message', 'Sin solicitud de devolución'); END IF;
    UPDATE public.libros SET stock = stock + 1, updated_at = NOW() WHERE id = v_prestamo.libro_id;
    v_multa := COALESCE(p_multa, 0);
    UPDATE public.prestamos SET estado = 'devuelto', fecha_devolucion_real = NOW(), estado_libro_devolucion = COALESCE(p_estado_libro, estado_libro_devolucion), multa = v_multa WHERE id = prestamo_id;
    RETURN jsonb_build_object('success', true, 'message', 'Devuelto', 'multa', v_multa);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION rechazar_devolucion_op(prestamo_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_prestamo RECORD;
    v_ea TEXT;
BEGIN
    SELECT * INTO v_prestamo FROM public.prestamos WHERE id = prestamo_id FOR UPDATE;
    IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'message', 'Préstamo no encontrado'); END IF;
    IF v_prestamo.estado != 'devolucion_solicitada' THEN RETURN jsonb_build_object('success', false, 'message', 'Estado incorrecto'); END IF;
    v_ea := CASE WHEN NOW() > v_prestamo.fecha_devolucion_esperada THEN 'vencido' ELSE 'activo' END;
    UPDATE public.prestamos SET estado = v_ea WHERE id = prestamo_id;
    RETURN jsonb_build_object('success', true, 'message', 'Devolución rechazada');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION solicitar_renovacion_op(prestamo_id UUID)
RETURNS JSONB AS $$
DECLARE v_prestamo RECORD;
BEGIN
    SELECT * INTO v_prestamo FROM public.prestamos WHERE id = prestamo_id FOR UPDATE;
    IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'message', 'Préstamo no encontrado'); END IF;
    IF v_prestamo.estado NOT IN ('activo', 'vencido') THEN RETURN jsonb_build_object('success', false, 'message', 'Solo activos o vencidos'); END IF;
    UPDATE public.prestamos SET estado = 'renovacion_solicitada', fecha_solicitud_renovacion = NOW() WHERE id = prestamo_id;
    RETURN jsonb_build_object('success', true, 'message', 'Renovación solicitada');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION aprobar_renovacion_op(prestamo_id UUID, p_dias_extension INT DEFAULT 14)
RETURNS JSONB AS $$
DECLARE
    v_prestamo RECORD;
    v_nueva TIMESTAMPTZ;
BEGIN
    SELECT * INTO v_prestamo FROM public.prestamos WHERE id = prestamo_id FOR UPDATE;
    IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'message', 'Préstamo no encontrado'); END IF;
    IF v_prestamo.estado != 'renovacion_solicitada' THEN RETURN jsonb_build_object('success', false, 'message', 'Estado incorrecto'); END IF;
    v_nueva := GREATEST(v_prestamo.fecha_devolucion_esperada, NOW()) + (p_dias_extension || ' days')::INTERVAL;
    UPDATE public.prestamos SET estado = 'activo', fecha_devolucion_esperada = v_nueva WHERE id = prestamo_id;
    RETURN jsonb_build_object('success', true, 'message', 'Renovado', 'nueva_fecha', v_nueva);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION rechazar_renovacion_op(prestamo_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_prestamo RECORD;
    v_ea TEXT;
BEGIN
    SELECT * INTO v_prestamo FROM public.prestamos WHERE id = prestamo_id FOR UPDATE;
    IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'message', 'Préstamo no encontrado'); END IF;
    IF v_prestamo.estado != 'renovacion_solicitada' THEN RETURN jsonb_build_object('success', false, 'message', 'Estado incorrecto'); END IF;
    v_ea := CASE WHEN NOW() > v_prestamo.fecha_devolucion_esperada THEN 'vencido' ELSE 'activo' END;
    UPDATE public.prestamos SET estado = v_ea WHERE id = prestamo_id;
    RETURN jsonb_build_object('success', true, 'message', 'Renovación rechazada');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- PERMISOS PARA POSTGREST
-- ============================================================

DO $$ BEGIN
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'web_anon') THEN
        CREATE ROLE web_anon NOLOGIN;
    END IF;
END $$;

GRANT USAGE ON SCHEMA public TO web_anon;
GRANT ALL ON ALL TABLES IN SCHEMA public TO web_anon;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO web_anon;

GRANT SELECT, INSERT, UPDATE ON public.usuarios TO web_anon;
GRANT SELECT, INSERT, UPDATE ON public.libros TO web_anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.favoritos TO web_anon;
GRANT SELECT, INSERT, UPDATE ON public.prestamos TO web_anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.acciones_pendientes TO web_anon;
GRANT SELECT, UPDATE ON public.config_prestamos TO web_anon;
GRANT SELECT, INSERT, UPDATE ON public.cuentas_temporales TO web_anon;
GRANT SELECT, INSERT, UPDATE ON public.profiles TO web_anon;

GRANT EXECUTE ON FUNCTION aprobar_prestamo_op(UUID) TO web_anon;
GRANT EXECUTE ON FUNCTION rechazar_prestamo_op(UUID) TO web_anon;
GRANT EXECUTE ON FUNCTION solicitar_devolucion_op(UUID, TEXT, TEXT) TO web_anon;
GRANT EXECUTE ON FUNCTION aprobar_devolucion_op(UUID, TEXT, NUMERIC) TO web_anon;
GRANT EXECUTE ON FUNCTION rechazar_devolucion_op(UUID) TO web_anon;
GRANT EXECUTE ON FUNCTION solicitar_renovacion_op(UUID) TO web_anon;
GRANT EXECUTE ON FUNCTION aprobar_renovacion_op(UUID, INT) TO web_anon;
GRANT EXECUTE ON FUNCTION rechazar_renovacion_op(UUID) TO web_anon;

-- ============================================================
-- DATOS DE PRUEBA
-- ============================================================

-- Admin (password: admin123)
INSERT INTO public.usuarios (username, email, nombre_completo, password, rol, tipo_auth) VALUES
('admin', 'admin@biblioteca.local', 'Administrador', '$2b$10$rJ3z4uB5JABS6bfAp5v2O.nh.ljhsctqdU3szeoGNaIpMyM3UbB9y', 'admin', 'local');

INSERT INTO public.cuentas_temporales (username, password, rol, email, usuario_id)
SELECT username, password, rol, email, id FROM public.usuarios WHERE tipo_auth = 'local';

INSERT INTO public.libros (titulo, autor, isbn, genero, stock, editorial, anio_publication, sinopsis, idioma, paginas, ubicacion) VALUES
('Cien años de soledad', 'Gabriel García Márquez', '978-0307474728', 'Novela', 5, 'Editorial Sudamericana', 1967, 'La historia de la familia Buendía en Macondo.', 'Español', 471, 'Estante A1'),
('Don Quijote de la Mancha', 'Miguel de Cervantes', '978-8437619651', 'Novela', 3, 'Alfaguara', 1605, 'Las aventuras del ingenioso hidalgo Don Quijote.', 'Español', 863, 'Estante A2'),
('El principito', 'Antoine de Saint-Exupéry', '978-0156012195', 'Fábula', 8, 'Reynal & Hitchcock', 1943, 'Un piloto perdido encuentra a un pequeño príncipe.', 'Español', 96, 'Estante B1'),
('1984', 'George Orwell', '978-0451524935', 'Ciencia ficción', 4, 'Secker & Warburg', 1949, 'Winston Smith lucha por su humanidad.', 'Español', 328, 'Estante C1'),
('Rayuela', 'Julio Cortázar', '978-8437619652', 'Novela', 2, 'Editorial Sudamericana', 1963, 'Novela experimental de múltiples lecturas.', 'Español', 600, 'Estante A3'),
('La casa de los espíritus', 'Isabel Allende', '978-0307474729', 'Novela', 6, 'Plaza & Janés', 1982, 'La saga de la familia Trueba.', 'Español', 433, 'Estante A4');

-- ============================================================
-- VERIFICACIÓN
-- ============================================================

SELECT 'Usuarios: ' || COUNT(*) AS resultado FROM public.usuarios;
SELECT 'Libros: ' || COUNT(*) AS resultado FROM public.libros;
SELECT 'Admin: ' || COUNT(*) AS resultado FROM public.usuarios WHERE username = 'admin' AND rol = 'admin';
