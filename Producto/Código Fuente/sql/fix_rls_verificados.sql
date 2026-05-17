-- =====================================================================
-- FIX COMPLETO RLS: POLITICAS + TRIGGERS + INSERT
-- =====================================================================
-- Ejecutar en SQL Editor de Supabase
-- =====================================================================

-- 1. Trigger sync_auth_to_usuarios corregido
CREATE OR REPLACE FUNCTION sync_auth_to_usuarios()
RETURNS TRIGGER AS $$
DECLARE
    v_username TEXT;
    v_existing_id UUID;
BEGIN
    v_username := COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1));

    SELECT id INTO v_existing_id FROM public.usuarios WHERE username = v_username;

    IF v_existing_id IS NOT NULL THEN
        UPDATE public.usuarios
        SET email = NEW.email, tipo_auth = 'supabase',
            auth_ref_id = NEW.id::text,
            rol = COALESCE(NEW.raw_user_meta_data->>'old_role', rol),
            updated_at = NOW()
        WHERE id = v_existing_id;
    ELSE
        INSERT INTO public.usuarios (id, email, username, tipo_auth, auth_ref_id, rol)
        VALUES (NEW.id, NEW.email, v_username, 'supabase', NEW.id::text,
                COALESCE(NEW.raw_user_meta_data->>'old_role', 'usuario'));
    END IF;

    RETURN NEW;
EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'sync_auth_to_usuarios error: %', SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. is_admin corregido (busca por id O auth_ref_id)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
DECLARE
    v_uid UUID;
BEGIN
    v_uid := auth.uid();
    IF v_uid IS NULL THEN RETURN FALSE; END IF;

    IF EXISTS (SELECT 1 FROM public.usuarios
               WHERE (id = v_uid OR auth_ref_id = v_uid::text)
               AND rol = 'admin') THEN
        RETURN TRUE;
    END IF;

    IF EXISTS (SELECT 1 FROM public.profiles
               WHERE id = v_uid AND rol = 'admin') THEN
        RETURN TRUE;
    END IF;

    RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Recrear politicas RLS

-- USUARIOS (con INSERT policy faltante)
ALTER TABLE public.usuarios ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Usuarios pueden ver su propio perfil" ON public.usuarios;
CREATE POLICY "Usuarios pueden ver su propio perfil" ON public.usuarios FOR SELECT
    USING (id = auth.uid() OR auth_ref_id = auth.uid()::text OR public.is_admin());

DROP POLICY IF EXISTS "Usuarios pueden actualizar su propio perfil" ON public.usuarios;
CREATE POLICY "Usuarios pueden actualizar su propio perfil" ON public.usuarios FOR UPDATE
    USING (id = auth.uid() OR auth_ref_id = auth.uid()::text)
    WITH CHECK (id = auth.uid() OR auth_ref_id = auth.uid()::text);

DROP POLICY IF EXISTS "Usuarios autenticados pueden insertar perfil" ON public.usuarios;
CREATE POLICY "Usuarios autenticados pueden insertar perfil" ON public.usuarios FOR INSERT
    WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Admins pueden gestionar usuarios" ON public.usuarios;
CREATE POLICY "Admins pueden gestionar usuarios" ON public.usuarios FOR ALL
    USING (public.is_admin()) WITH CHECK (public.is_admin());

-- FAVORITOS
ALTER TABLE public.favoritos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Usuarios pueden ver sus propios favoritos" ON public.favoritos;
CREATE POLICY "Usuarios pueden ver sus propios favoritos" ON public.favoritos FOR SELECT
    USING (usuario_id = auth.uid()
           OR usuario_id IN (SELECT id FROM public.usuarios WHERE auth_ref_id = auth.uid()::text));

DROP POLICY IF EXISTS "Usuarios pueden insertar sus propios favoritos" ON public.favoritos;
CREATE POLICY "Usuarios pueden insertar sus propios favoritos" ON public.favoritos FOR INSERT
    WITH CHECK (usuario_id = auth.uid()
                OR usuario_id IN (SELECT id FROM public.usuarios WHERE auth_ref_id = auth.uid()::text));

DROP POLICY IF EXISTS "Usuarios pueden eliminar sus propios favoritos" ON public.favoritos;
CREATE POLICY "Usuarios pueden eliminar sus propios favoritos" ON public.favoritos FOR DELETE
    USING (usuario_id = auth.uid()
           OR usuario_id IN (SELECT id FROM public.usuarios WHERE auth_ref_id = auth.uid()::text));

DROP POLICY IF EXISTS "Admins pueden gestionar favoritos" ON public.favoritos;
CREATE POLICY "Admins pueden gestionar favoritos" ON public.favoritos FOR ALL
    USING (public.is_admin()) WITH CHECK (public.is_admin());

-- PRESTAMOS
ALTER TABLE public.prestamos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Usuarios pueden ver sus propios préstamos" ON public.prestamos;
CREATE POLICY "Usuarios pueden ver sus propios préstamos" ON public.prestamos FOR SELECT
    USING (usuario_id = auth.uid()
           OR usuario_id IN (SELECT id FROM public.usuarios WHERE auth_ref_id = auth.uid()::text));

DROP POLICY IF EXISTS "Usuarios pueden solicitar préstamos" ON public.prestamos;
CREATE POLICY "Usuarios pueden solicitar préstamos" ON public.prestamos FOR INSERT
    WITH CHECK (usuario_id = auth.uid()
                OR usuario_id IN (SELECT id FROM public.usuarios WHERE auth_ref_id = auth.uid()::text));

DROP POLICY IF EXISTS "Usuarios pueden solicitar devolucion" ON public.prestamos;
CREATE POLICY "Usuarios pueden solicitar devolucion" ON public.prestamos FOR UPDATE
    USING (usuario_id = auth.uid()
           OR usuario_id IN (SELECT id FROM public.usuarios WHERE auth_ref_id = auth.uid()::text))
    WITH CHECK (usuario_id = auth.uid()
                OR usuario_id IN (SELECT id FROM public.usuarios WHERE auth_ref_id = auth.uid()::text));

DROP POLICY IF EXISTS "Usuarios pueden solicitar renovacion" ON public.prestamos;
CREATE POLICY "Usuarios pueden solicitar renovacion" ON public.prestamos FOR UPDATE
    USING (usuario_id = auth.uid()
           OR usuario_id IN (SELECT id FROM public.usuarios WHERE auth_ref_id = auth.uid()::text))
    WITH CHECK (usuario_id = auth.uid()
                OR usuario_id IN (SELECT id FROM public.usuarios WHERE auth_ref_id = auth.uid()::text));

SELECT 'Fix RLS completo - listo' AS resultado;
