-- =====================================================================
-- BORRAR BASE DE DATOS LOCAL COMPLETA
-- =====================================================================
-- Ejecutar en Adminer/pgAdmin (Docker local)
-- Elimina TODAS las tablas, funciones, vistas y permisos
-- =====================================================================

-- 1. Revocar TODOS los permisos de web_anon (incluyendo funciones)
REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM web_anon;
REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public FROM web_anon;
REVOKE ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA public FROM web_anon;
REVOKE ALL PRIVILEGES ON SCHEMA public FROM web_anon;

-- 2. Eliminar tablas (orden inverso a dependencias)
DROP TABLE IF EXISTS public.prestamos CASCADE;
DROP TABLE IF EXISTS public.favoritos CASCADE;
DROP TABLE IF EXISTS public.config_prestamos CASCADE;
DROP TABLE IF EXISTS public.cuentas_temporales CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;
DROP TABLE IF EXISTS public.usuarios CASCADE;
DROP TABLE IF EXISTS public.libros CASCADE;

-- 3. Eliminar funciones y triggers
DROP FUNCTION IF EXISTS login_local(TEXT, TEXT) CASCADE;
DROP FUNCTION IF EXISTS registrar_usuario_local(TEXT, TEXT, TEXT) CASCADE;
DROP FUNCTION IF EXISTS calcular_multa(UUID) CASCADE;
DROP FUNCTION IF EXISTS obtener_prestamos_activos(VARCHAR) CASCADE;
DROP FUNCTION IF EXISTS actualizar_updated_at() CASCADE;

-- 4. Eliminar vistas
DROP VIEW IF EXISTS vista_prestamos_completos CASCADE;
DROP VIEW IF EXISTS vista_favoritos_completos CASCADE;

-- 5. Eliminar rol (ahora no tiene dependencias)
DROP ROLE IF EXISTS web_anon;

-- 6. Verificar que quedó limpio
SELECT tablename FROM pg_tables WHERE schemaname = 'public';
-- Debería devolver 0 filas
