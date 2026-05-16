-- =====================================================================
-- CREAR BASE DE DATOS SUPABASE COMPLETA - LISTA PARA USAR
-- =====================================================================
-- Ejecutar en SQL Editor de Supabase
-- Crea todas las tablas, RLS policies, triggers, funciones y datos
-- =====================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =====================================================================
-- TABLA: USUARIOS (Fuente unificada)
-- =====================================================================

DROP TABLE IF EXISTS public.usuarios CASCADE;
CREATE TABLE public.usuarios (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    username TEXT UNIQUE,
    email TEXT UNIQUE,
    nombre_completo TEXT,
    rol TEXT NOT NULL DEFAULT 'usuario',
    tipo_auth TEXT NOT NULL DEFAULT 'supabase',
    auth_ref_id TEXT,
    activo BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_usuarios_username ON public.usuarios(username);
CREATE INDEX idx_usuarios_email ON public.usuarios(email);
CREATE INDEX idx_usuarios_rol ON public.usuarios(rol);

CREATE OR REPLACE FUNCTION actualizar_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_usuarios_updated_at
    BEFORE UPDATE ON public.usuarios
    FOR EACH ROW EXECUTE FUNCTION actualizar_updated_at();

-- =====================================================================
-- TABLA: LIBROS
-- =====================================================================

DROP TABLE IF EXISTS public.libros CASCADE;
CREATE TABLE public.libros (
    id SERIAL PRIMARY KEY,
    titulo TEXT NOT NULL,
    autor TEXT,
    isbn TEXT,
    genero TEXT,
    stock INTEGER DEFAULT 0,
    caratula TEXT,
    caratula_url TEXT,
    editorial TEXT,
    anio_publication INT,
    sinopsis TEXT,
    idioma TEXT,
    paginas INT,
    ubicacion TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_libros_titulo ON public.libros(titulo);
CREATE INDEX idx_libros_autor ON public.libros(autor);
CREATE INDEX idx_libros_genero ON public.libros(genero);

CREATE TRIGGER trigger_libros_updated_at
    BEFORE UPDATE ON public.libros
    FOR EACH ROW EXECUTE FUNCTION actualizar_updated_at();

-- =====================================================================
-- TABLA: FAVORITOS
-- =====================================================================

DROP TABLE IF EXISTS public.favoritos CASCADE;
CREATE TABLE public.favoritos (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    usuario_id UUID NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
    libro_id INT NOT NULL REFERENCES public.libros(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(usuario_id, libro_id)
);

CREATE INDEX idx_favoritos_usuario ON public.favoritos(usuario_id);
CREATE INDEX idx_favoritos_libro ON public.favoritos(libro_id);

-- =====================================================================
-- TABLA: PRÉSTAMOS
-- =====================================================================

DROP TABLE IF EXISTS public.prestamos CASCADE;
CREATE TABLE public.prestamos (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    usuario_id UUID NOT NULL REFERENCES public.usuarios(id) ON DELETE RESTRICT,
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

CREATE INDEX idx_prestamos_usuario ON public.prestamos(usuario_id);
CREATE INDEX idx_prestamos_libro ON public.prestamos(libro_id);
CREATE INDEX idx_prestamos_usuario_estado ON public.prestamos(usuario_id, estado);
CREATE INDEX idx_prestamos_estado ON public.prestamos(estado);

-- =====================================================================
-- TABLA: CONFIG PRÉSTAMOS
-- =====================================================================

DROP TABLE IF EXISTS public.config_prestamos CASCADE;
CREATE TABLE public.config_prestamos (
    id INT PRIMARY KEY DEFAULT 1,
    dias_maximos_prestamo INT DEFAULT 14,
    multa_por_dia DECIMAL(10,2) DEFAULT 100,
    max_prestamos_activos INT DEFAULT 3,
    renovaciones_permitidas INT DEFAULT 1
);

INSERT INTO public.config_prestamos (id, dias_maximos_prestamo, multa_por_dia, max_prestamos_activos, renovaciones_permitidas)
VALUES (1, 14, 100, 3, 1);

-- =====================================================================
-- TABLAS LEGACY
-- =====================================================================

DROP TABLE IF EXISTS public.cuentas_temporales CASCADE;
CREATE TABLE public.cuentas_temporales (
    username TEXT PRIMARY KEY,
    password TEXT NOT NULL,
    rol TEXT NOT NULL DEFAULT 'usuario',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    auth_id TEXT,
    email TEXT,
    usuario_id UUID REFERENCES public.usuarios(id) ON DELETE SET NULL
);

DROP TABLE IF EXISTS public.profiles CASCADE;
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY,
    rol TEXT NOT NULL DEFAULT 'usuario',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    usuario_id UUID REFERENCES public.usuarios(id) ON DELETE SET NULL
);

-- RLS DESHABILITADO en profiles para evitar recursión infinita
ALTER TABLE public.profiles DISABLE ROW LEVEL SECURITY;

-- =====================================================================
-- TRIGGERS PARA SINCRONIZAR AUTH.USERS CON USUARIOS
-- =====================================================================

-- Trigger: crear usuario en tabla usuarios al registrarse en Supabase
CREATE OR REPLACE FUNCTION sync_auth_to_usuarios()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.usuarios (id, email, username, tipo_auth, auth_ref_id, rol)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)),
        'supabase',
        NEW.id::text,
        COALESCE(NEW.raw_user_meta_data->>'old_role', 'usuario')
    )
    ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email,
        username = COALESCE(EXCLUDED.username, split_part(EXCLUDED.email, '@', 1)),
        updated_at = NOW();

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS sync_auth_users ON auth.users;
CREATE TRIGGER sync_auth_users
    AFTER INSERT OR UPDATE ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION sync_auth_to_usuarios();

-- Trigger original para profiles (compatibilidad)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, rol)
    VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'old_role', 'usuario'))
    ON CONFLICT (id) DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();

-- Trigger: sincronizar rol de profiles a usuarios
CREATE OR REPLACE FUNCTION sync_profiles_rol()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE public.usuarios
    SET rol = NEW.rol, updated_at = NOW()
    WHERE auth_ref_id = NEW.id::text OR id = NEW.usuario_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS sync_profiles_rol_trigger ON public.profiles;
CREATE TRIGGER sync_profiles_rol_trigger
    AFTER UPDATE OF rol ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION sync_profiles_rol();

-- =====================================================================
-- FUNCIÓN is_admin() UNIFICADA
-- =====================================================================

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
DECLARE
    v_uid UUID;
BEGIN
    v_uid := auth.uid();
    IF v_uid IS NULL THEN
        RETURN FALSE;
    END IF;

    -- Verificar en usuarios (tabla principal)
    IF EXISTS (SELECT 1 FROM public.usuarios WHERE id = v_uid AND rol = 'admin') THEN
        RETURN TRUE;
    END IF;

    -- Verificar en profiles (compatibilidad)
    IF EXISTS (SELECT 1 FROM public.profiles WHERE id = v_uid AND rol = 'admin') THEN
        RETURN TRUE;
    END IF;

    RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================================
-- FUNCIÓN calcular_multa
-- =====================================================================

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

-- =====================================================================
-- VISTAS
-- =====================================================================

CREATE OR REPLACE VIEW vista_prestamos_completos AS
SELECT
    p.*,
    l.titulo AS libro_titulo,
    l.autor AS libro_autor,
    u.username AS usuario_username,
    u.email AS usuario_email
FROM public.prestamos p
JOIN public.libros l ON p.libro_id = l.id
JOIN public.usuarios u ON p.usuario_id = u.id;

CREATE OR REPLACE VIEW vista_favoritos_completos AS
SELECT
    f.*,
    l.titulo AS libro_titulo,
    l.autor AS libro_autor,
    l.stock AS libro_stock,
    u.username AS usuario_username,
    u.email AS usuario_email
FROM public.favoritos f
JOIN public.libros l ON f.libro_id = l.id
JOIN public.usuarios u ON f.usuario_id = u.id;

-- =====================================================================
-- ROW LEVEL SECURITY (RLS)
-- =====================================================================

-- --- USUARIOS ---
ALTER TABLE public.usuarios ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Usuarios pueden ver su propio perfil" ON public.usuarios;
CREATE POLICY "Usuarios pueden ver su propio perfil" ON public.usuarios FOR SELECT
    USING (auth.uid() = id OR public.is_admin());

DROP POLICY IF EXISTS "Usuarios pueden actualizar su propio perfil" ON public.usuarios;
CREATE POLICY "Usuarios pueden actualizar su propio perfil" ON public.usuarios FOR UPDATE
    USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Admins pueden gestionar usuarios" ON public.usuarios;
CREATE POLICY "Admins pueden gestionar usuarios" ON public.usuarios FOR ALL
    USING (public.is_admin()) WITH CHECK (public.is_admin());

-- --- LIBROS ---
ALTER TABLE public.libros ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Todos pueden ver libros" ON public.libros;
CREATE POLICY "Todos pueden ver libros" ON public.libros FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admins pueden gestionar libros" ON public.libros;
CREATE POLICY "Admins pueden gestionar libros" ON public.libros FOR ALL
    USING (public.is_admin()) WITH CHECK (public.is_admin());

-- --- FAVORITOS ---
ALTER TABLE public.favoritos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Usuarios pueden ver sus propios favoritos" ON public.favoritos;
CREATE POLICY "Usuarios pueden ver sus propios favoritos" ON public.favoritos FOR SELECT
    USING (auth.uid() = usuario_id);

DROP POLICY IF EXISTS "Usuarios pueden insertar sus propios favoritos" ON public.favoritos;
CREATE POLICY "Usuarios pueden insertar sus propios favoritos" ON public.favoritos FOR INSERT
    WITH CHECK (auth.uid() = usuario_id);

DROP POLICY IF EXISTS "Usuarios pueden eliminar sus propios favoritos" ON public.favoritos;
CREATE POLICY "Usuarios pueden eliminar sus propios favoritos" ON public.favoritos FOR DELETE
    USING (auth.uid() = usuario_id);

-- --- PRÉSTAMOS ---
ALTER TABLE public.prestamos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Usuarios pueden ver sus propios préstamos" ON public.prestamos;
CREATE POLICY "Usuarios pueden ver sus propios préstamos" ON public.prestamos FOR SELECT
    USING (auth.uid() = usuario_id);

DROP POLICY IF EXISTS "Usuarios pueden solicitar préstamos" ON public.prestamos;
CREATE POLICY "Usuarios pueden solicitar préstamos" ON public.prestamos FOR INSERT
    WITH CHECK (auth.uid() = usuario_id);

DROP POLICY IF EXISTS "Usuarios pueden solicitar devolucion" ON public.prestamos;
CREATE POLICY "Usuarios pueden solicitar devolucion" ON public.prestamos FOR UPDATE
    USING (auth.uid() = usuario_id) WITH CHECK (auth.uid() = usuario_id);

DROP POLICY IF EXISTS "Usuarios pueden solicitar renovacion" ON public.prestamos;
CREATE POLICY "Usuarios pueden solicitar renovacion" ON public.prestamos FOR UPDATE
    USING (auth.uid() = usuario_id) WITH CHECK (auth.uid() = usuario_id);

DROP POLICY IF EXISTS "Admins pueden ver todos los préstamos" ON public.prestamos;
CREATE POLICY "Admins pueden ver todos los préstamos" ON public.prestamos FOR SELECT
    USING (public.is_admin());

DROP POLICY IF EXISTS "Admins pueden gestionar préstamos" ON public.prestamos;
CREATE POLICY "Admins pueden gestionar préstamos" ON public.prestamos FOR ALL
    USING (public.is_admin()) WITH CHECK (public.is_admin());

-- --- CONFIG PRÉSTAMOS ---
ALTER TABLE public.config_prestamos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Todos pueden ver configuración de préstamos" ON public.config_prestamos;
CREATE POLICY "Todos pueden ver configuración de préstamos" ON public.config_prestamos FOR SELECT USING (true);

DROP POLICY IF EXISTS "Solo admins pueden modificar configuración" ON public.config_prestamos;
CREATE POLICY "Solo admins pueden modificar configuración" ON public.config_prestamos FOR UPDATE
    USING (public.is_admin()) WITH CHECK (public.is_admin());

-- --- CUENTAS TEMPORALES ---
ALTER TABLE public.cuentas_temporales ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Todos pueden ver cuentas temporales" ON public.cuentas_temporales;
CREATE POLICY "Todos pueden ver cuentas temporales" ON public.cuentas_temporales FOR SELECT USING (true);

DROP POLICY IF EXISTS "Cualquiera puede insertar cuentas temporales" ON public.cuentas_temporales;
CREATE POLICY "Cualquiera puede insertar cuentas temporales" ON public.cuentas_temporales FOR INSERT WITH CHECK (true);

-- =====================================================================
-- DATOS DE PRUEBA
-- =====================================================================

INSERT INTO public.libros (titulo, autor, isbn, genero, stock, editorial, anio_publication, sinopsis, idioma, paginas, ubicacion) VALUES
('Cien años de soledad', 'Gabriel García Márquez', '978-0307474728', 'Novela', 5, 'Editorial Sudamericana', 1967, 'La historia de la familia Buendía en Macondo.', 'Español', 471, 'Estante A1'),
('Don Quijote de la Mancha', 'Miguel de Cervantes', '978-8437619651', 'Novela', 3, 'Alfaguara', 1605, 'Las aventuras del ingenioso hidalgo Don Quijote.', 'Español', 863, 'Estante A2'),
('El principito', 'Antoine de Saint-Exupéry', '978-0156012195', 'Fábula', 8, 'Reynal & Hitchcock', 1943, 'Un piloto perdido encuentra a un pequeño príncipe.', 'Español', 96, 'Estante B1'),
('1984', 'George Orwell', '978-0451524935', 'Ciencia ficción', 4, 'Secker & Warburg', 1949, 'Winston Smith lucha por su humanidad.', 'Español', 328, 'Estante C1'),
('Rayuela', 'Julio Cortázar', '978-8437619652', 'Novela', 2, 'Editorial Sudamericana', 1963, 'Novela experimental de múltiples lecturas.', 'Español', 600, 'Estante A3'),
('La casa de los espíritus', 'Isabel Allende', '978-0307474729', 'Novela', 6, 'Plaza & Janés', 1982, 'La saga de la familia Trueba.', 'Español', 433, 'Estante A4');

-- =====================================================================
-- NOTAS IMPORTANTES:
-- =====================================================================
-- 1. La tabla `usuarios` es la fuente unificada de todos los usuarios
-- 2. El trigger `sync_auth_to_usuarios` crea automáticamente un registro
--    en `usuarios` cuando alguien se registra en Supabase Auth
-- 3. La función `is_admin()` verifica tanto en `usuarios` como en `profiles`
-- 4. Para crear un admin: UPDATE public.usuarios SET rol = 'admin' WHERE email = 'tu@email.com';
-- 5. `profiles` tiene RLS deshabilitado para evitar recursión infinita
-- =====================================================================
