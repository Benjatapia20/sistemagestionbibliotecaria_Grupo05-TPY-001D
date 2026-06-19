-- ============================================================
-- FUNCIÓN PARA updated_at AUTOMÁTICO
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- TABLAS
-- ============================================================

CREATE TABLE IF NOT EXISTS autores (
    id SERIAL PRIMARY KEY,
    nombre TEXT NOT NULL,
    biografia TEXT,
    foto TEXT,
    nacionalidad TEXT,
    fecha_nacimiento DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
DROP TRIGGER IF EXISTS trg_autores_updated_at ON autores;
CREATE TRIGGER trg_autores_updated_at
    BEFORE UPDATE ON autores
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE IF NOT EXISTS generos (
    id SERIAL PRIMARY KEY,
    nombre TEXT UNIQUE NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
DROP TRIGGER IF EXISTS trg_generos_updated_at ON generos;
CREATE TRIGGER trg_generos_updated_at
    BEFORE UPDATE ON generos
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE IF NOT EXISTS etiquetas (
    id SERIAL PRIMARY KEY,
    nombre TEXT UNIQUE NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
DROP TRIGGER IF EXISTS trg_etiquetas_updated_at ON etiquetas;
CREATE TRIGGER trg_etiquetas_updated_at
    BEFORE UPDATE ON etiquetas
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE IF NOT EXISTS editoriales (
    id SERIAL PRIMARY KEY,
    nombre TEXT UNIQUE NOT NULL,
    pais TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
DROP TRIGGER IF EXISTS trg_editoriales_updated_at ON editoriales;
CREATE TRIGGER trg_editoriales_updated_at
    BEFORE UPDATE ON editoriales
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE IF NOT EXISTS libros (
    id SERIAL PRIMARY KEY,
    titulo TEXT NOT NULL,
    autor_id INT NOT NULL REFERENCES autores(id) ON DELETE RESTRICT,
    sinopsis TEXT,
    isbn TEXT UNIQUE,
    editorial_id INT NOT NULL REFERENCES editoriales(id) ON DELETE RESTRICT,
    anio_publicacion INT,
    numero_paginas INT,
    idioma TEXT,
    caratula TEXT,
    disponible BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
DROP TRIGGER IF EXISTS trg_libros_updated_at ON libros;
CREATE TRIGGER trg_libros_updated_at
    BEFORE UPDATE ON libros
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE IF NOT EXISTS libros_generos (
    libro_id INT NOT NULL REFERENCES libros(id) ON DELETE CASCADE,
    genero_id INT NOT NULL REFERENCES generos(id) ON DELETE CASCADE,
    PRIMARY KEY (libro_id, genero_id)
);

CREATE TABLE IF NOT EXISTS libros_etiquetas (
    libro_id INT NOT NULL REFERENCES libros(id) ON DELETE CASCADE,
    etiqueta_id INT NOT NULL REFERENCES etiquetas(id) ON DELETE CASCADE,
    PRIMARY KEY (libro_id, etiqueta_id)
);

CREATE TABLE IF NOT EXISTS ejemplares (
    id SERIAL PRIMARY KEY,
    libro_id INT NOT NULL REFERENCES libros(id) ON DELETE CASCADE,
    codigo TEXT UNIQUE NOT NULL,
    estado TEXT NOT NULL DEFAULT 'disponible'
        CHECK (estado IN ('disponible', 'reservado', 'prestado', 'no_disponible')),
    condicion TEXT NOT NULL DEFAULT 'bueno'
        CHECK (condicion IN ('bueno', 'regular', 'dañado', 'perdido')),
    notas TEXT,
    foto_estado TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION codigo_ejemplar()
RETURNS TRIGGER AS $$
DECLARE
    contador INT;
BEGIN
    SELECT COUNT(*) + 1 INTO contador FROM ejemplares WHERE libro_id = NEW.libro_id;
    NEW.codigo = 'LIB-' || NEW.libro_id || '-' || lpad(contador::text, 3, '0');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_ejemplares_codigo ON ejemplares;
CREATE TRIGGER trg_ejemplares_codigo
    BEFORE INSERT ON ejemplares
    FOR EACH ROW EXECUTE FUNCTION codigo_ejemplar();
DROP TRIGGER IF EXISTS trg_ejemplares_updated_at ON ejemplares;
CREATE TRIGGER trg_ejemplares_updated_at
    BEFORE UPDATE ON ejemplares
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE OR REPLACE FUNCTION ejemplar_condicion_estado()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.condicion = 'perdido' AND OLD.condicion != 'perdido' THEN
        IF EXISTS(SELECT 1 FROM prestamos WHERE ejemplar_id = NEW.id AND estado NOT IN ('devuelto', 'rechazado', 'no_disponible')) THEN
            RAISE EXCEPTION 'No se puede marcar como perdido un ejemplar que está en un préstamo activo o pendiente';
        END IF;
        NEW.estado = 'no_disponible';
    ELSIF OLD.condicion = 'perdido' AND NEW.condicion != 'perdido' THEN
        NEW.estado = 'disponible';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_ejemplares_condicion ON ejemplares;
CREATE TRIGGER trg_ejemplares_condicion
    BEFORE UPDATE ON ejemplares
    FOR EACH ROW
    WHEN (OLD.condicion IS DISTINCT FROM NEW.condicion)
    EXECUTE FUNCTION ejemplar_condicion_estado();

CREATE TABLE IF NOT EXISTS usuario (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre_usuario TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    rol TEXT NOT NULL DEFAULT 'usuario'
        CHECK (rol IN ('admin', 'usuario', 'bibliotecario')),
    email TEXT UNIQUE,
    rut TEXT UNIQUE,
    primer_nombre TEXT,
    segundo_nombre TEXT,
    apellido_paterno TEXT,
    apellido_materno TEXT,
    bio TEXT,
    telefono TEXT,
    direccion TEXT,
    foto_perfil TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
DROP TRIGGER IF EXISTS trg_usuario_updated_at ON usuario;
CREATE TRIGGER trg_usuario_updated_at
    BEFORE UPDATE ON usuario
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE IF NOT EXISTS prestamos_grupo (
    id SERIAL PRIMARY KEY,
    usuario_id UUID NOT NULL REFERENCES usuario(id) ON DELETE CASCADE,
    nota_admin TEXT,
    lugar_retiro TEXT,
    pdf_url TEXT,
    codigo TEXT UNIQUE,
    revisor_id UUID REFERENCES usuario(id) ON DELETE SET NULL,
    fecha_devolucion_esperada TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '14 days'),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
DROP TRIGGER IF EXISTS trg_prestamos_grupo_updated_at ON prestamos_grupo;
CREATE TRIGGER trg_prestamos_grupo_updated_at
    BEFORE UPDATE ON prestamos_grupo
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE OR REPLACE FUNCTION generar_codigo_pedido()
RETURNS TRIGGER AS $$
DECLARE
    anio TEXT;
    seq TEXT;
BEGIN
    anio := to_char(NEW.created_at, 'YYYY');
    seq := lpad(NEW.id::TEXT, 4, '0');
    NEW.codigo := 'PED-' || anio || '-' || seq;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_generar_codigo_pedido ON prestamos_grupo;
CREATE TRIGGER trg_generar_codigo_pedido
    BEFORE INSERT ON prestamos_grupo
    FOR EACH ROW
    WHEN (NEW.codigo IS NULL)
    EXECUTE FUNCTION generar_codigo_pedido();

CREATE TABLE IF NOT EXISTS prestamos (
    id SERIAL PRIMARY KEY,
    usuario_id UUID NOT NULL REFERENCES usuario(id) ON DELETE CASCADE,
    libro_id INT REFERENCES libros(id) ON DELETE SET NULL,
    ejemplar_id INT REFERENCES ejemplares(id) ON DELETE RESTRICT,
    grupo_id INT REFERENCES prestamos_grupo(id) ON DELETE SET NULL,
    fecha_prestamo TIMESTAMPTZ NOT NULL DEFAULT now(),
    fecha_devolucion_esperada TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '14 days'),
    fecha_devolucion_real TIMESTAMPTZ,
    estado TEXT NOT NULL DEFAULT 'pendiente'
        CHECK (estado IN ('pendiente', 'en_revision', 'activo', 'devuelto', 'atrasado', 'rechazado', 'no_disponible', 'solicita_aprobacion', 'por_entregar')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
DROP TRIGGER IF EXISTS trg_prestamos_updated_at ON prestamos;
CREATE TRIGGER trg_prestamos_updated_at
    BEFORE UPDATE ON prestamos
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE IF NOT EXISTS resenas (
    id SERIAL PRIMARY KEY,
    usuario_id UUID NOT NULL REFERENCES usuario(id) ON DELETE CASCADE,
    libro_id INT NOT NULL REFERENCES libros(id) ON DELETE CASCADE,
    puntuacion INT NOT NULL CHECK (puntuacion >= 1 AND puntuacion <= 5),
    comentario TEXT,
    fotos TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
DROP TRIGGER IF EXISTS trg_resenas_updated_at ON resenas;
CREATE TRIGGER trg_resenas_updated_at
    BEFORE UPDATE ON resenas
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE IF NOT EXISTS listas (
    id SERIAL PRIMARY KEY,
    nombre TEXT NOT NULL,
    descripcion TEXT,
    imagen TEXT,
    usuario_id UUID NOT NULL REFERENCES usuario(id) ON DELETE CASCADE,
    por_defecto BOOLEAN NOT NULL DEFAULT false,
    publica BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
DROP TRIGGER IF EXISTS trg_listas_updated_at ON listas;
CREATE TRIGGER trg_listas_updated_at
    BEFORE UPDATE ON listas
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE IF NOT EXISTS listas_libros (
    lista_id INT NOT NULL REFERENCES listas(id) ON DELETE CASCADE,
    libro_id INT NOT NULL REFERENCES libros(id) ON DELETE CASCADE,
    PRIMARY KEY (lista_id, libro_id)
);

CREATE TABLE IF NOT EXISTS secciones (
    id SERIAL PRIMARY KEY,
    nombre TEXT NOT NULL,
    descripcion TEXT,
    categoria TEXT NOT NULL,
    x NUMERIC(5,2) NOT NULL,
    y NUMERIC(5,2) NOT NULL,
    icono TEXT DEFAULT '📍',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS configuracion (
    id SERIAL PRIMARY KEY,
    clave TEXT UNIQUE NOT NULL,
    valor TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS notificaciones (
    id SERIAL PRIMARY KEY,
    usuario_id UUID NOT NULL REFERENCES usuario(id) ON DELETE CASCADE,
    titulo TEXT NOT NULL,
    mensaje TEXT,
    leida BOOLEAN NOT NULL DEFAULT false,
    link TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS carrito (
    usuario_id UUID NOT NULL REFERENCES usuario(id) ON DELETE CASCADE,
    libro_id INT NOT NULL REFERENCES libros(id) ON DELETE CASCADE,
    cantidad INT NOT NULL DEFAULT 1 CHECK (cantidad > 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (usuario_id, libro_id)
);

CREATE TABLE IF NOT EXISTS acciones_pendientes (
    id SERIAL PRIMARY KEY,
    accion TEXT NOT NULL,
    datos JSONB NOT NULL,
    procesada BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
DROP TRIGGER IF EXISTS trg_acciones_updated_at ON acciones_pendientes;
CREATE TRIGGER trg_acciones_updated_at
    BEFORE UPDATE ON acciones_pendientes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE IF NOT EXISTS multas (
    id SERIAL PRIMARY KEY,
    usuario_id UUID NOT NULL REFERENCES usuario(id) ON DELETE CASCADE,
    prestamo_id INT NOT NULL REFERENCES prestamos(id) ON DELETE CASCADE,
    monto INT NOT NULL DEFAULT 0,
    dias_atraso INT NOT NULL DEFAULT 0,
    pagada BOOLEAN NOT NULL DEFAULT false,
    id_preferencia_mp TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
DROP TRIGGER IF EXISTS trg_multas_updated_at ON multas;
CREATE TRIGGER trg_multas_updated_at
    BEFORE UPDATE ON multas
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE OR REPLACE FUNCTION marcar_atrasado_y_multar()
RETURNS TRIGGER AS $$
DECLARE
    dias INT;
    monto_diario INT;
    monto_max INT;
    monto_total INT;
    multa_existente BOOLEAN;
BEGIN
    IF NEW.estado = 'activo' AND NEW.fecha_devolucion_esperada < NOW() THEN
        NEW.estado = 'atrasado';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_prestamos_marcar_atrasado ON prestamos;
CREATE TRIGGER trg_prestamos_marcar_atrasado
    BEFORE INSERT OR UPDATE ON prestamos
    FOR EACH ROW EXECUTE FUNCTION marcar_atrasado_y_multar();

CREATE TABLE IF NOT EXISTS categorias_secciones (
    id SERIAL PRIMARY KEY,
    nombre TEXT UNIQUE NOT NULL,
    descripcion TEXT,
    color TEXT NOT NULL DEFAULT 'bg-gray-500',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION actualizar_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_actualizar_secciones ON secciones;
CREATE TRIGGER trigger_actualizar_secciones
    BEFORE UPDATE ON secciones
    FOR EACH ROW
    EXECUTE FUNCTION actualizar_timestamp();

DROP TRIGGER IF EXISTS trigger_actualizar_config ON configuracion;
CREATE TRIGGER trigger_actualizar_config
    BEFORE UPDATE ON configuracion
    FOR EACH ROW
    EXECUTE FUNCTION actualizar_timestamp();

DROP TRIGGER IF EXISTS trigger_actualizar_categorias ON categorias_secciones;
CREATE TRIGGER trigger_actualizar_categorias
    BEFORE UPDATE ON categorias_secciones
    FOR EACH ROW
    EXECUTE FUNCTION actualizar_timestamp();

DROP TRIGGER IF EXISTS trigger_actualizar_notificaciones ON notificaciones;
CREATE TRIGGER trigger_actualizar_notificaciones
    BEFORE UPDATE ON notificaciones
    FOR EACH ROW
    EXECUTE FUNCTION actualizar_timestamp();

-- ============================================================
-- TRIGGER DE VALIDACIÓN Y ESTADO DE EJEMPLAR EN PRÉSTAMOS
-- ============================================================
CREATE OR REPLACE FUNCTION validar_ejemplar_prestamo()
RETURNS TRIGGER AS $$
DECLARE
    ej_condicion TEXT;
    ej_estado TEXT;
    ej_prestado BOOLEAN;
    ej_id INT;
BEGIN
    IF TG_OP = 'DELETE' THEN
        IF OLD.ejemplar_id IS NOT NULL THEN
            UPDATE ejemplares SET estado = 'disponible' WHERE id = OLD.ejemplar_id;
        END IF;
        RETURN OLD;
    END IF;

    IF NEW.ejemplar_id IS NULL THEN
        IF NEW.estado = 'activo' THEN
            RAISE EXCEPTION 'No se puede activar un préstamo sin ejemplar asignado';
        END IF;
        IF TG_OP = 'UPDATE' AND OLD.ejemplar_id IS NOT NULL THEN
            UPDATE ejemplares SET estado = 'disponible' WHERE id = OLD.ejemplar_id;
        END IF;
        RETURN NEW;
    END IF;

    SELECT condicion, estado INTO ej_condicion, ej_estado FROM ejemplares WHERE id = NEW.ejemplar_id;
    IF ej_condicion IS NULL THEN
        RAISE EXCEPTION 'Ejemplar no encontrado';
    END IF;

    IF ej_condicion = 'perdido' THEN
        RAISE EXCEPTION 'El ejemplar está marcado como perdido';
    END IF;

    SELECT EXISTS(
        SELECT 1 FROM prestamos
        WHERE ejemplar_id = NEW.ejemplar_id
          AND id != NEW.id
          AND estado NOT IN ('devuelto', 'rechazado', 'no_disponible')
    ) INTO ej_prestado;
    IF ej_prestado THEN
        RAISE EXCEPTION 'El ejemplar ya está asignado a otro préstamo activo o pendiente';
    END IF;

    IF TG_OP = 'UPDATE' AND OLD.ejemplar_id IS NOT NULL AND OLD.ejemplar_id != NEW.ejemplar_id THEN
        UPDATE ejemplares SET estado = 'disponible' WHERE id = OLD.ejemplar_id;
    END IF;

    IF NEW.estado = 'activo' OR NEW.estado = 'atrasado' THEN
        UPDATE ejemplares SET estado = 'prestado' WHERE id = NEW.ejemplar_id;
    ELSIF NEW.estado IN ('pendiente', 'en_revision', 'por_entregar') THEN
        UPDATE ejemplares SET estado = 'reservado' WHERE id = NEW.ejemplar_id;
    ELSIF NEW.estado IN ('devuelto', 'rechazado', 'no_disponible') THEN
        UPDATE ejemplares SET estado = 'disponible' WHERE id = NEW.ejemplar_id;
        NEW.ejemplar_id = NULL;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_prestamos_validar_ejemplar ON prestamos;
CREATE TRIGGER trg_prestamos_validar_ejemplar
    BEFORE INSERT OR UPDATE ON prestamos
    FOR EACH ROW EXECUTE FUNCTION validar_ejemplar_prestamo();

CREATE OR REPLACE FUNCTION actualizar_disponibilidad_libro()
RETURNS TRIGGER AS $$
DECLARE
    libro_id_var INT;
    disponibles INT;
BEGIN
    libro_id_var := COALESCE(NEW.libro_id, OLD.libro_id);
    SELECT COUNT(*) INTO disponibles FROM ejemplares
    WHERE libro_id = libro_id_var
      AND estado = 'disponible'
      AND condicion IN ('bueno', 'regular', 'dañado');
    
    IF disponibles = 0 THEN
        UPDATE libros SET disponible = false WHERE id = libro_id_var;
    ELSE
        UPDATE libros SET disponible = true WHERE id = libro_id_var AND disponible = false;
    END IF;
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_actualizar_disponibilidad_libro_ejemplar ON ejemplares;
CREATE TRIGGER trg_actualizar_disponibilidad_libro_ejemplar
    AFTER INSERT OR UPDATE OR DELETE ON ejemplares
    FOR EACH ROW EXECUTE FUNCTION actualizar_disponibilidad_libro();

DROP TRIGGER IF EXISTS trg_actualizar_disponibilidad_libro_prestamo ON prestamos;
CREATE TRIGGER trg_actualizar_disponibilidad_libro_prestamo
    AFTER INSERT OR UPDATE OR DELETE ON prestamos
    FOR EACH ROW EXECUTE FUNCTION actualizar_disponibilidad_libro();

-- ============================================================
-- ÍNDICES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_libros_titulo ON libros USING btree (titulo text_pattern_ops);
CREATE INDEX IF NOT EXISTS idx_libros_autor_id ON libros (autor_id);
CREATE INDEX IF NOT EXISTS idx_prestamos_usuario_id ON prestamos (usuario_id);
CREATE INDEX IF NOT EXISTS idx_prestamos_ejemplar_id ON prestamos (ejemplar_id);
CREATE INDEX IF NOT EXISTS idx_prestamos_estado ON prestamos (estado);
CREATE INDEX IF NOT EXISTS idx_prestamos_grupo_id ON prestamos (grupo_id);
CREATE INDEX IF NOT EXISTS idx_autores_nombre ON autores USING btree (nombre text_pattern_ops);
CREATE INDEX IF NOT EXISTS idx_resenas_libro_id ON resenas (libro_id);
CREATE INDEX IF NOT EXISTS idx_resenas_usuario_id ON resenas (usuario_id);
CREATE INDEX IF NOT EXISTS idx_ejemplares_libro_id ON ejemplares (libro_id);
CREATE INDEX IF NOT EXISTS idx_ejemplares_codigo ON ejemplares (codigo);

-- ============================================================
-- PERMISOS
-- ============================================================
GRANT USAGE ON SCHEMA public TO anon;

GRANT SELECT ON autores TO anon;
GRANT SELECT ON generos TO anon;
GRANT SELECT ON etiquetas TO anon;
GRANT SELECT ON editoriales TO anon;
GRANT SELECT ON libros TO anon;
GRANT SELECT ON libros_generos TO anon;
GRANT SELECT ON libros_etiquetas TO anon;
GRANT SELECT ON usuario TO anon;
GRANT SELECT ON prestamos TO anon;
GRANT SELECT ON prestamos_grupo TO anon;
GRANT SELECT ON resenas TO anon;
GRANT SELECT ON ejemplares TO anon;
GRANT SELECT ON listas TO anon;
GRANT SELECT ON listas_libros TO anon;
GRANT SELECT ON secciones TO anon;
GRANT SELECT ON categorias_secciones TO anon;
GRANT SELECT ON configuracion TO anon;
GRANT SELECT ON notificaciones TO anon;
GRANT SELECT ON carrito TO anon;
GRANT SELECT ON acciones_pendientes TO anon;
GRANT SELECT ON multas TO anon;

GRANT INSERT, UPDATE, DELETE ON prestamos TO anon;
GRANT INSERT, UPDATE, DELETE ON prestamos_grupo TO anon;
GRANT INSERT, UPDATE, DELETE ON usuario TO anon;
GRANT INSERT, UPDATE, DELETE ON libros TO anon;
GRANT INSERT, UPDATE, DELETE ON autores TO anon;
GRANT INSERT, UPDATE, DELETE ON generos TO anon;
GRANT INSERT, UPDATE, DELETE ON etiquetas TO anon;
GRANT INSERT, UPDATE, DELETE ON editoriales TO anon;
GRANT INSERT, UPDATE, DELETE ON libros_generos TO anon;
GRANT INSERT, UPDATE, DELETE ON libros_etiquetas TO anon;
GRANT INSERT, UPDATE, DELETE ON resenas TO anon;
GRANT INSERT, UPDATE, DELETE ON ejemplares TO anon;
GRANT INSERT, UPDATE, DELETE ON listas TO anon;
GRANT INSERT, UPDATE, DELETE ON listas_libros TO anon;
GRANT INSERT, UPDATE, DELETE ON secciones TO anon;
GRANT INSERT, UPDATE, DELETE ON categorias_secciones TO anon;
GRANT INSERT, UPDATE, DELETE ON configuracion TO anon;
GRANT INSERT, UPDATE, DELETE ON notificaciones TO anon;
GRANT INSERT, UPDATE, DELETE ON carrito TO anon;
GRANT INSERT, UPDATE, DELETE ON acciones_pendientes TO anon;
GRANT INSERT, UPDATE, DELETE ON multas TO anon;

GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO anon;

-- ============================================================

INSERT INTO configuracion (clave, valor) VALUES
    ('mapa_imagen', ''),
    ('mapa_titulo', 'Mapa de la Biblioteca'),
    ('multa_por_dia', '500'),
    ('multa_maxima', '10000'),
    ('custom_host', '')
ON CONFLICT (clave) DO NOTHING;


