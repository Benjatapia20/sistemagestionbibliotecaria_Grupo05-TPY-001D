-- =====================================================================
-- CREAR BASE DE DATOS LOCAL COMPLETA - LISTA PARA USAR
-- =====================================================================
-- Ejecutar en Adminer/pgAdmin (Docker local) DESPUÉS de borrar
-- Crea todas las tablas, funciones, permisos y datos de prueba
-- =====================================================================

-- Extensión para UUIDs
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =====================================================================
-- TABLA: USUARIOS (Fuente unificada)
-- =====================================================================

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
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_usuarios_username ON public.usuarios(username);
CREATE INDEX idx_usuarios_email ON public.usuarios(email);
CREATE INDEX idx_usuarios_rol ON public.usuarios(rol);

-- =====================================================================
-- TABLA: LIBROS
-- =====================================================================

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

-- =====================================================================
-- TABLA: FAVORITOS
-- =====================================================================

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
-- TABLAS LEGACY (vinculadas a usuarios)
-- =====================================================================

CREATE TABLE public.cuentas_temporales (
    username TEXT PRIMARY KEY,
    password TEXT NOT NULL,
    rol TEXT NOT NULL DEFAULT 'usuario',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    auth_id TEXT,
    email TEXT,
    usuario_id UUID REFERENCES public.usuarios(id) ON DELETE SET NULL
);

CREATE TABLE public.profiles (
    id UUID PRIMARY KEY,
    rol TEXT NOT NULL DEFAULT 'usuario',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    usuario_id UUID REFERENCES public.usuarios(id) ON DELETE SET NULL
);

-- =====================================================================
-- TRIGGERS
-- =====================================================================

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

CREATE TRIGGER trigger_libros_updated_at
    BEFORE UPDATE ON public.libros
    FOR EACH ROW EXECUTE FUNCTION actualizar_updated_at();

-- =====================================================================
-- FUNCIONES DE AUTENTICACIÓN
-- =====================================================================

CREATE OR REPLACE FUNCTION login_local(p_username TEXT, p_password TEXT)
RETURNS TABLE (
    id UUID,
    username TEXT,
    email TEXT,
    rol TEXT,
    tipo_auth TEXT,
    activo BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    SELECT u.id, u.username, u.email, u.rol, u.tipo_auth, u.activo
    FROM public.usuarios u
    WHERE u.username = p_username
      AND u.tipo_auth = 'local'
      AND u.activo = TRUE
      AND u.password = p_password;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION registrar_usuario_local(
    p_username TEXT,
    p_password TEXT,
    p_email TEXT DEFAULT NULL
)
RETURNS TABLE (
    id UUID,
    username TEXT,
    rol TEXT
) AS $$
DECLARE
    v_id UUID;
BEGIN
    INSERT INTO public.usuarios (username, password, rol, tipo_auth, email)
    VALUES (p_username, p_password, 'usuario', 'local', p_email)
    RETURNING id INTO v_id;

    INSERT INTO public.cuentas_temporales (username, password, rol, email, usuario_id)
    VALUES (p_username, p_password, 'usuario', p_email, v_id)
    ON CONFLICT (username) DO NOTHING;

    RETURN QUERY SELECT u.id, u.username, u.rol FROM public.usuarios u WHERE u.id = v_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================================
-- PERMISOS PARA POSTGREST
-- =====================================================================

DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'web_anon') THEN
        CREATE ROLE web_anon NOLOGIN;
    END IF;
END
$$;

GRANT USAGE ON SCHEMA public TO web_anon;
GRANT ALL ON ALL TABLES IN SCHEMA public TO web_anon;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO web_anon;
GRANT SELECT, INSERT, UPDATE ON public.usuarios TO web_anon;
GRANT SELECT, INSERT, UPDATE ON public.libros TO web_anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.favoritos TO web_anon;
GRANT SELECT, INSERT, UPDATE ON public.prestamos TO web_anon;
GRANT SELECT, UPDATE ON public.config_prestamos TO web_anon;
GRANT SELECT, INSERT, UPDATE ON public.cuentas_temporales TO web_anon;
GRANT SELECT, INSERT, UPDATE ON public.profiles TO web_anon;
GRANT EXECUTE ON FUNCTION login_local(TEXT, TEXT) TO web_anon;
GRANT EXECUTE ON FUNCTION registrar_usuario_local(TEXT, TEXT, TEXT) TO web_anon;

-- =====================================================================
-- DATOS DE PRUEBA
-- =====================================================================

-- Admin (password: admin123)
INSERT INTO public.usuarios (username, email, nombre_completo, password, rol, tipo_auth) VALUES
('admin', 'admin@biblioteca.local', 'Administrador', '$2b$10$Ui5xGuKqwBt0dNMNaNxaiOlJro8X4aH1wCZtGaXbKT5.maA9TQlGi', 'admin', 'local');

-- Vincular con cuentas_temporales
INSERT INTO public.cuentas_temporales (username, password, rol, email, usuario_id)
SELECT username, password, rol, email, id FROM public.usuarios WHERE tipo_auth = 'local';

-- Libros de ejemplo
INSERT INTO public.libros (titulo, autor, isbn, genero, stock, editorial, anio_publication, sinopsis, idioma, paginas, ubicacion) VALUES
('Cien años de soledad', 'Gabriel García Márquez', '978-0307474728', 'Novela', 5, 'Editorial Sudamericana', 1967, 'La historia de la familia Buendía en Macondo.', 'Español', 471, 'Estante A1'),
('Don Quijote de la Mancha', 'Miguel de Cervantes', '978-8437619651', 'Novela', 3, 'Alfaguara', 1605, 'Las aventuras del ingenioso hidalgo Don Quijote.', 'Español', 863, 'Estante A2'),
('El principito', 'Antoine de Saint-Exupéry', '978-0156012195', 'Fábula', 8, 'Reynal & Hitchcock', 1943, 'Un piloto perdido encuentra a un pequeño príncipe.', 'Español', 96, 'Estante B1'),
('1984', 'George Orwell', '978-0451524935', 'Ciencia ficción', 4, 'Secker & Warburg', 1949, 'Winston Smith lucha por su humanidad.', 'Español', 328, 'Estante C1'),
('Rayuela', 'Julio Cortázar', '978-8437619652', 'Novela', 2, 'Editorial Sudamericana', 1963, 'Novela experimental de múltiples lecturas.', 'Español', 600, 'Estante A3'),
('La casa de los espíritus', 'Isabel Allende', '978-0307474729', 'Novela', 6, 'Plaza & Janés', 1982, 'La saga de la familia Trueba.', 'Español', 433, 'Estante A4');

-- =====================================================================
-- VERIFICACIÓN
-- =====================================================================

SELECT 'Usuarios: ' || COUNT(*) AS resultado FROM public.usuarios;
SELECT 'Libros: ' || COUNT(*) AS resultado FROM public.libros;
SELECT 'Admin existe: ' || COUNT(*) AS resultado FROM public.usuarios WHERE username = 'admin' AND rol = 'admin';
