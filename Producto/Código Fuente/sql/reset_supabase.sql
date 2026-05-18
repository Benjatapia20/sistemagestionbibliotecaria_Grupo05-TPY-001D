-- =====================================================================
-- RESET SUPABASE - Borrar TODO y recrear limpio
-- =====================================================================
-- Ejecutar en SQL Editor de Supabase
-- =====================================================================

-- Eliminar triggers primero
DROP TRIGGER IF EXISTS sync_auth_users ON auth.users;
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS trigger_usuarios_updated_at ON public.usuarios;
DROP TRIGGER IF EXISTS trigger_libros_updated_at ON public.libros;

-- Eliminar politicas RLS individualmente
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT policyname, tablename FROM pg_policies WHERE schemaname = 'public') LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.policyname, r.tablename);
    END LOOP;
END $$;

-- Eliminar vistas
DROP VIEW IF EXISTS vista_prestamos_completos CASCADE;
DROP VIEW IF EXISTS vista_favoritos_completos CASCADE;

-- Eliminar tablas
DROP TABLE IF EXISTS public.acciones_pendientes CASCADE;
DROP TABLE IF EXISTS public.prestamos CASCADE;
DROP TABLE IF EXISTS public.favoritos CASCADE;
DROP TABLE IF EXISTS public.config_prestamos CASCADE;
DROP TABLE IF EXISTS public.cuentas_temporales CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;
DROP TABLE IF EXISTS public.usuarios CASCADE;
DROP TABLE IF EXISTS public.libros CASCADE;

-- Eliminar funciones
DROP FUNCTION IF EXISTS sync_auth_to_usuarios CASCADE;
DROP FUNCTION IF EXISTS handle_new_user CASCADE;
DROP FUNCTION IF EXISTS sync_profiles_rol CASCADE;
DROP FUNCTION IF EXISTS is_admin CASCADE;
DROP FUNCTION IF EXISTS get_usuario_id CASCADE;
DROP FUNCTION IF EXISTS calcular_multa CASCADE;
DROP FUNCTION IF EXISTS actualizar_updated_at CASCADE;

-- =====================================================================
-- RECREAR TODO LIMPIO
-- =====================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Tablas
CREATE TABLE public.usuarios (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    username TEXT UNIQUE, email TEXT UNIQUE, nombre_completo TEXT,
    rol TEXT DEFAULT 'usuario', tipo_auth TEXT DEFAULT 'supabase',
    auth_ref_id TEXT, activo BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_usuarios_username ON public.usuarios(username);
CREATE INDEX idx_usuarios_email ON public.usuarios(email);
CREATE INDEX idx_usuarios_rol ON public.usuarios(rol);

CREATE TABLE public.libros (
    id SERIAL PRIMARY KEY, titulo TEXT NOT NULL, autor TEXT, isbn TEXT,
    genero TEXT, stock INT DEFAULT 0, caratula TEXT, caratula_url TEXT,
    editorial TEXT, anio_publication INT, sinopsis TEXT, idioma TEXT,
    paginas INT, ubicacion TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.favoritos (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    usuario_id UUID NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
    libro_id INT NOT NULL REFERENCES public.libros(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(usuario_id, libro_id)
);

CREATE TABLE public.prestamos (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    usuario_id UUID NOT NULL REFERENCES public.usuarios(id) ON DELETE RESTRICT,
    libro_id INT NOT NULL REFERENCES public.libros(id) ON DELETE RESTRICT,
    estado VARCHAR(25) DEFAULT 'solicitado',
    fecha_solicitud TIMESTAMPTZ DEFAULT NOW(), fecha_aprobacion TIMESTAMPTZ,
    fecha_devolucion_esperada TIMESTAMPTZ NOT NULL, fecha_devolucion_real TIMESTAMPTZ,
    multa DECIMAL(10,2) DEFAULT 0, multa_pagada BOOLEAN DEFAULT FALSE,
    observaciones TEXT, observaciones_devolucion TEXT,
    estado_libro_devolucion VARCHAR(50),
    fecha_solicitud_devolucion TIMESTAMPTZ, fecha_solicitud_renovacion TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.config_prestamos (
    id INT PRIMARY KEY DEFAULT 1,
    dias_maximos_prestamo INT DEFAULT 14, multa_por_dia DECIMAL(10,2) DEFAULT 100,
    max_prestamos_activos INT DEFAULT 3, renovaciones_permitidas INT DEFAULT 1
);
INSERT INTO public.config_prestamos VALUES (1, 14, 100, 3, 1) ON CONFLICT DO NOTHING;

CREATE TABLE public.acciones_pendientes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    timestamp TIMESTAMPTZ DEFAULT NOW(), type TEXT NOT NULL,
    usuario_id UUID NOT NULL, payload JSONB NOT NULL,
    aplicado BOOLEAN DEFAULT FALSE, created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_acciones_ts ON public.acciones_pendientes(timestamp);
CREATE INDEX idx_acciones_apl ON public.acciones_pendientes(aplicado);

CREATE TABLE public.cuentas_temporales (
    username TEXT PRIMARY KEY, password TEXT NOT NULL,
    rol TEXT DEFAULT 'usuario', created_at TIMESTAMPTZ DEFAULT NOW(),
    auth_id TEXT, email TEXT,
    usuario_id UUID REFERENCES public.usuarios(id) ON DELETE SET NULL
);

CREATE TABLE public.profiles (
    id UUID PRIMARY KEY, rol TEXT DEFAULT 'usuario',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    usuario_id UUID REFERENCES public.usuarios(id) ON DELETE SET NULL
);
ALTER TABLE public.profiles DISABLE ROW LEVEL SECURITY;

-- Funciones
CREATE OR REPLACE FUNCTION actualizar_updated_at()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$ LANGUAGE plpgsql;

CREATE TRIGGER t_usuarios_updated BEFORE UPDATE ON public.usuarios FOR EACH ROW EXECUTE FUNCTION actualizar_updated_at();
CREATE TRIGGER t_libros_updated BEFORE UPDATE ON public.libros FOR EACH ROW EXECUTE FUNCTION actualizar_updated_at();

CREATE OR REPLACE FUNCTION sync_auth_to_usuarios()
RETURNS TRIGGER AS $$
DECLARE v_username TEXT; v_existing_id UUID;
BEGIN
    v_username := COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1));
    SELECT id INTO v_existing_id FROM public.usuarios WHERE username = v_username;
    IF v_existing_id IS NOT NULL THEN
        UPDATE public.usuarios SET email = NEW.email, tipo_auth = 'supabase', auth_ref_id = NEW.id::text, rol = COALESCE(NEW.raw_user_meta_data->>'old_role', rol), updated_at = NOW() WHERE id = v_existing_id;
    ELSE
        INSERT INTO public.usuarios (id, email, username, tipo_auth, auth_ref_id, rol) VALUES (NEW.id, NEW.email, v_username, 'supabase', NEW.id::text, COALESCE(NEW.raw_user_meta_data->>'old_role', 'usuario'));
    END IF;
    RETURN NEW;
EXCEPTION WHEN OTHERS THEN RETURN NEW;
END; $$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER sync_auth_users AFTER INSERT OR UPDATE ON auth.users FOR EACH ROW EXECUTE FUNCTION sync_auth_to_usuarios();

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, rol) VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'old_role', 'usuario')) ON CONFLICT DO NOTHING;
    RETURN NEW;
EXCEPTION WHEN OTHERS THEN RETURN NEW;
END; $$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION handle_new_user();

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
DECLARE v_uid UUID;
BEGIN
    v_uid := auth.uid(); IF v_uid IS NULL THEN RETURN FALSE; END IF;
    IF EXISTS (SELECT 1 FROM public.usuarios WHERE (id = v_uid OR auth_ref_id = v_uid::text) AND rol = 'admin') THEN RETURN TRUE; END IF;
    IF EXISTS (SELECT 1 FROM public.profiles WHERE id = v_uid AND rol = 'admin') THEN RETURN TRUE; END IF;
    RETURN FALSE;
END; $$ LANGUAGE plpgsql SECURITY DEFINER;

-- RLS
ALTER TABLE public.usuarios ENABLE ROW LEVEL SECURITY;
CREATE POLICY "usr_select" ON public.usuarios FOR SELECT USING (id = auth.uid() OR auth_ref_id = auth.uid()::text OR public.is_admin());
CREATE POLICY "usr_update" ON public.usuarios FOR UPDATE USING (id = auth.uid() OR auth_ref_id = auth.uid()::text) WITH CHECK (id = auth.uid() OR auth_ref_id = auth.uid()::text);
CREATE POLICY "usr_insert" ON public.usuarios FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "usr_admin" ON public.usuarios FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

ALTER TABLE public.libros ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lib_select" ON public.libros FOR SELECT USING (true);
CREATE POLICY "lib_admin" ON public.libros FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

ALTER TABLE public.favoritos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fav_select" ON public.favoritos FOR SELECT USING (usuario_id = auth.uid() OR usuario_id IN (SELECT id FROM public.usuarios WHERE auth_ref_id = auth.uid()::text));
CREATE POLICY "fav_insert" ON public.favoritos FOR INSERT WITH CHECK (usuario_id = auth.uid() OR usuario_id IN (SELECT id FROM public.usuarios WHERE auth_ref_id = auth.uid()::text));
CREATE POLICY "fav_delete" ON public.favoritos FOR DELETE USING (usuario_id = auth.uid() OR usuario_id IN (SELECT id FROM public.usuarios WHERE auth_ref_id = auth.uid()::text));
CREATE POLICY "fav_admin" ON public.favoritos FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

ALTER TABLE public.prestamos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "prs_select" ON public.prestamos FOR SELECT USING (usuario_id = auth.uid() OR usuario_id IN (SELECT id FROM public.usuarios WHERE auth_ref_id = auth.uid()::text));
CREATE POLICY "prs_insert" ON public.prestamos FOR INSERT WITH CHECK (usuario_id = auth.uid() OR usuario_id IN (SELECT id FROM public.usuarios WHERE auth_ref_id = auth.uid()::text));
CREATE POLICY "prs_update" ON public.prestamos FOR UPDATE USING (usuario_id = auth.uid() OR usuario_id IN (SELECT id FROM public.usuarios WHERE auth_ref_id = auth.uid()::text)) WITH CHECK (usuario_id = auth.uid() OR usuario_id IN (SELECT id FROM public.usuarios WHERE auth_ref_id = auth.uid()::text));
CREATE POLICY "prs_admin_select" ON public.prestamos FOR SELECT USING (public.is_admin());
CREATE POLICY "prs_admin_all" ON public.prestamos FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

ALTER TABLE public.config_prestamos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cfg_select" ON public.config_prestamos FOR SELECT USING (true);
CREATE POLICY "cfg_update" ON public.config_prestamos FOR UPDATE USING (public.is_admin()) WITH CHECK (public.is_admin());

ALTER TABLE public.acciones_pendientes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "acc_select" ON public.acciones_pendientes FOR SELECT USING (usuario_id = auth.uid() OR usuario_id IN (SELECT id FROM public.usuarios WHERE auth_ref_id = auth.uid()::text));
CREATE POLICY "acc_insert" ON public.acciones_pendientes FOR INSERT WITH CHECK (usuario_id = auth.uid() OR usuario_id IN (SELECT id FROM public.usuarios WHERE auth_ref_id = auth.uid()::text));
CREATE POLICY "acc_update" ON public.acciones_pendientes FOR UPDATE USING (usuario_id = auth.uid() OR usuario_id IN (SELECT id FROM public.usuarios WHERE auth_ref_id = auth.uid()::text)) WITH CHECK (usuario_id = auth.uid() OR usuario_id IN (SELECT id FROM public.usuarios WHERE auth_ref_id = auth.uid()::text));
CREATE POLICY "acc_admin" ON public.acciones_pendientes FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

ALTER TABLE public.cuentas_temporales ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ct_select" ON public.cuentas_temporales FOR SELECT USING (true);
CREATE POLICY "ct_insert" ON public.cuentas_temporales FOR INSERT WITH CHECK (true);

-- Datos de prueba
INSERT INTO public.libros (titulo, autor, isbn, genero, stock) VALUES
('Cien años de soledad', 'Gabriel García Márquez', '978-0307474728', 'Novela', 5),
('Don Quijote de la Mancha', 'Miguel de Cervantes', '978-8437619651', 'Novela', 3),
('El principito', 'Antoine de Saint-Exupéry', '978-0156012195', 'Fábula', 8),
('1984', 'George Orwell', '978-0451524935', 'Ciencia ficción', 4),
('Rayuela', 'Julio Cortázar', '978-8437619652', 'Novela', 2),
('La casa de los espíritus', 'Isabel Allende', '978-0307474729', 'Novela', 6);

SELECT 'Supabase reseteado y listo' AS resultado;
