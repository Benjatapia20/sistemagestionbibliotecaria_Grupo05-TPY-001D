CREATE SCHEMA IF NOT EXISTS api;

CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticator LOGIN PASSWORD 'postgres' NOINHERIT;
GRANT anon TO authenticator;

-- ============================================================
-- FUNCIÓN PARA updated_at AUTOMÁTICO
-- ============================================================
CREATE OR REPLACE FUNCTION api.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- TABLAS
-- ============================================================

CREATE TABLE api.autores (
    id SERIAL PRIMARY KEY,
    nombre TEXT NOT NULL,
    biografia TEXT,
    foto TEXT,
    nacionalidad TEXT,
    fecha_nacimiento DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TRIGGER trg_autores_updated_at
    BEFORE UPDATE ON api.autores
    FOR EACH ROW EXECUTE FUNCTION api.update_updated_at_column();

CREATE TABLE api.generos (
    id SERIAL PRIMARY KEY,
    nombre TEXT UNIQUE NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TRIGGER trg_generos_updated_at
    BEFORE UPDATE ON api.generos
    FOR EACH ROW EXECUTE FUNCTION api.update_updated_at_column();

CREATE TABLE api.etiquetas (
    id SERIAL PRIMARY KEY,
    nombre TEXT UNIQUE NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TRIGGER trg_etiquetas_updated_at
    BEFORE UPDATE ON api.etiquetas
    FOR EACH ROW EXECUTE FUNCTION api.update_updated_at_column();

CREATE TABLE api.editoriales (
    id SERIAL PRIMARY KEY,
    nombre TEXT UNIQUE NOT NULL,
    pais TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TRIGGER trg_editoriales_updated_at
    BEFORE UPDATE ON api.editoriales
    FOR EACH ROW EXECUTE FUNCTION api.update_updated_at_column();

CREATE TABLE api.libros (
    id SERIAL PRIMARY KEY,
    titulo TEXT NOT NULL,
    autor_id INT NOT NULL REFERENCES api.autores(id) ON DELETE RESTRICT,
    sinopsis TEXT,
    isbn TEXT UNIQUE,
    editorial_id INT NOT NULL REFERENCES api.editoriales(id) ON DELETE RESTRICT,
    anio_publicacion INT,
    numero_paginas INT,
    idioma TEXT,
    caratula TEXT,
    disponible BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TRIGGER trg_libros_updated_at
    BEFORE UPDATE ON api.libros
    FOR EACH ROW EXECUTE FUNCTION api.update_updated_at_column();

CREATE TABLE api.libros_generos (
    libro_id INT NOT NULL REFERENCES api.libros(id) ON DELETE CASCADE,
    genero_id INT NOT NULL REFERENCES api.generos(id) ON DELETE CASCADE,
    PRIMARY KEY (libro_id, genero_id)
);

CREATE TABLE api.libros_etiquetas (
    libro_id INT NOT NULL REFERENCES api.libros(id) ON DELETE CASCADE,
    etiqueta_id INT NOT NULL REFERENCES api.etiquetas(id) ON DELETE CASCADE,
    PRIMARY KEY (libro_id, etiqueta_id)
);

CREATE TABLE api.ejemplares (
    id SERIAL PRIMARY KEY,
    libro_id INT NOT NULL REFERENCES api.libros(id) ON DELETE CASCADE,
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

CREATE OR REPLACE FUNCTION api.codigo_ejemplar()
RETURNS TRIGGER AS $$
DECLARE
    contador INT;
BEGIN
    SELECT COUNT(*) + 1 INTO contador FROM api.ejemplares WHERE libro_id = NEW.libro_id;
    NEW.codigo = 'LIB-' || NEW.libro_id || '-' || lpad(contador::text, 3, '0');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_ejemplares_codigo
    BEFORE INSERT ON api.ejemplares
    FOR EACH ROW EXECUTE FUNCTION api.codigo_ejemplar();
CREATE TRIGGER trg_ejemplares_updated_at
    BEFORE UPDATE ON api.ejemplares
    FOR EACH ROW EXECUTE FUNCTION api.update_updated_at_column();

CREATE OR REPLACE FUNCTION api.ejemplar_condicion_estado()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.condicion = 'perdido' AND OLD.condicion != 'perdido' THEN
        IF EXISTS(SELECT 1 FROM api.prestamos WHERE ejemplar_id = NEW.id AND estado NOT IN ('devuelto', 'rechazado', 'no_disponible')) THEN
            RAISE EXCEPTION 'No se puede marcar como perdido un ejemplar que está en un préstamo activo o pendiente';
        END IF;
        NEW.estado = 'no_disponible';
    ELSIF OLD.condicion = 'perdido' AND NEW.condicion != 'perdido' THEN
        NEW.estado = 'disponible';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_ejemplares_condicion
    BEFORE UPDATE ON api.ejemplares
    FOR EACH ROW
    WHEN (OLD.condicion IS DISTINCT FROM NEW.condicion)
    EXECUTE FUNCTION api.ejemplar_condicion_estado();

CREATE TABLE api.usuario (
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
CREATE TRIGGER trg_usuario_updated_at
    BEFORE UPDATE ON api.usuario
    FOR EACH ROW EXECUTE FUNCTION api.update_updated_at_column();

CREATE TABLE api.prestamos_grupo (
    id SERIAL PRIMARY KEY,
    usuario_id UUID NOT NULL REFERENCES api.usuario(id) ON DELETE CASCADE,
    nota_admin TEXT,
    lugar_retiro TEXT,
    pdf_url TEXT,
    codigo TEXT UNIQUE,
    revisor_id UUID REFERENCES api.usuario(id) ON DELETE SET NULL,
    fecha_devolucion_esperada TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '14 days'),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TRIGGER trg_prestamos_grupo_updated_at
    BEFORE UPDATE ON api.prestamos_grupo
    FOR EACH ROW EXECUTE FUNCTION api.update_updated_at_column();

CREATE OR REPLACE FUNCTION api.generar_codigo_pedido()
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

CREATE TRIGGER trg_generar_codigo_pedido
    BEFORE INSERT ON api.prestamos_grupo
    FOR EACH ROW
    WHEN (NEW.codigo IS NULL)
    EXECUTE FUNCTION api.generar_codigo_pedido();

CREATE TABLE api.prestamos (
    id SERIAL PRIMARY KEY,
    usuario_id UUID NOT NULL REFERENCES api.usuario(id) ON DELETE CASCADE,
    libro_id INT REFERENCES api.libros(id) ON DELETE SET NULL,
    ejemplar_id INT REFERENCES api.ejemplares(id) ON DELETE RESTRICT,
    grupo_id INT REFERENCES api.prestamos_grupo(id) ON DELETE SET NULL,
    fecha_prestamo TIMESTAMPTZ NOT NULL DEFAULT now(),
    fecha_devolucion_esperada TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '14 days'),
    fecha_devolucion_real TIMESTAMPTZ,
    estado TEXT NOT NULL DEFAULT 'pendiente'
        CHECK (estado IN ('pendiente', 'en_revision', 'activo', 'devuelto', 'atrasado', 'rechazado', 'no_disponible', 'solicita_aprobacion', 'por_entregar')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TRIGGER trg_prestamos_updated_at
    BEFORE UPDATE ON api.prestamos
    FOR EACH ROW EXECUTE FUNCTION api.update_updated_at_column();

CREATE TABLE api.resenas (
    id SERIAL PRIMARY KEY,
    usuario_id UUID NOT NULL REFERENCES api.usuario(id) ON DELETE CASCADE,
    libro_id INT NOT NULL REFERENCES api.libros(id) ON DELETE CASCADE,
    puntuacion INT NOT NULL CHECK (puntuacion >= 1 AND puntuacion <= 5),
    comentario TEXT,
    fotos TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TRIGGER trg_resenas_updated_at
    BEFORE UPDATE ON api.resenas
    FOR EACH ROW EXECUTE FUNCTION api.update_updated_at_column();

CREATE OR REPLACE FUNCTION api.validar_resena()
RETURNS TRIGGER AS $$
DECLARE
    devueltos INT;
    resenas_hechas INT;
BEGIN
    SELECT COUNT(*) INTO devueltos FROM api.prestamos
    WHERE usuario_id = NEW.usuario_id
      AND libro_id = NEW.libro_id
      AND estado = 'devuelto';

    SELECT COUNT(*) INTO resenas_hechas FROM api.resenas
    WHERE usuario_id = NEW.usuario_id
      AND libro_id = NEW.libro_id;

    IF resenas_hechas >= devueltos THEN
        RAISE EXCEPTION 'Ya has reseñado todos los préstamos devueltos de este libro. Pide y devuelve el libro nuevamente para reseñarlo.';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TABLE api.listas (
    id SERIAL PRIMARY KEY,
    nombre TEXT NOT NULL,
    descripcion TEXT,
    imagen TEXT,
    usuario_id UUID NOT NULL REFERENCES api.usuario(id) ON DELETE CASCADE,
    por_defecto BOOLEAN NOT NULL DEFAULT false,
    publica BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TRIGGER trg_listas_updated_at
    BEFORE UPDATE ON api.listas
    FOR EACH ROW EXECUTE FUNCTION api.update_updated_at_column();

CREATE TABLE api.listas_libros (
    lista_id INT NOT NULL REFERENCES api.listas(id) ON DELETE CASCADE,
    libro_id INT NOT NULL REFERENCES api.libros(id) ON DELETE CASCADE,
    PRIMARY KEY (lista_id, libro_id)
);

CREATE TABLE api.secciones (
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

CREATE TABLE api.configuracion (
    id SERIAL PRIMARY KEY,
    clave TEXT UNIQUE NOT NULL,
    valor TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE api.notificaciones (
    id SERIAL PRIMARY KEY,
    usuario_id UUID NOT NULL REFERENCES api.usuario(id) ON DELETE CASCADE,
    titulo TEXT NOT NULL,
    mensaje TEXT,
    leida BOOLEAN NOT NULL DEFAULT false,
    link TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE api.carrito (
    usuario_id UUID NOT NULL REFERENCES api.usuario(id) ON DELETE CASCADE,
    libro_id INT NOT NULL REFERENCES api.libros(id) ON DELETE CASCADE,
    cantidad INT NOT NULL DEFAULT 1 CHECK (cantidad > 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (usuario_id, libro_id)
);

CREATE TABLE api.acciones_pendientes (
    id SERIAL PRIMARY KEY,
    accion TEXT NOT NULL,
    datos JSONB NOT NULL,
    procesada BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TRIGGER trg_acciones_updated_at
    BEFORE UPDATE ON api.acciones_pendientes
    FOR EACH ROW EXECUTE FUNCTION api.update_updated_at_column();

CREATE TABLE api.multas (
    id SERIAL PRIMARY KEY,
    usuario_id UUID NOT NULL REFERENCES api.usuario(id) ON DELETE CASCADE,
    prestamo_id INT NOT NULL REFERENCES api.prestamos(id) ON DELETE CASCADE,
    monto INT NOT NULL DEFAULT 0,
    dias_atraso INT NOT NULL DEFAULT 0,
    pagada BOOLEAN NOT NULL DEFAULT false,
    id_preferencia_mp TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TRIGGER trg_multas_updated_at
    BEFORE UPDATE ON api.multas
    FOR EACH ROW EXECUTE FUNCTION api.update_updated_at_column();

CREATE OR REPLACE FUNCTION api.marcar_atrasado_y_multar()
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

CREATE TRIGGER trg_prestamos_marcar_atrasado
    BEFORE INSERT OR UPDATE ON api.prestamos
    FOR EACH ROW EXECUTE FUNCTION api.marcar_atrasado_y_multar();

CREATE TABLE api.categorias_secciones (
    id SERIAL PRIMARY KEY,
    nombre TEXT UNIQUE NOT NULL,
    descripcion TEXT,
    color TEXT NOT NULL DEFAULT 'bg-gray-500',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION api.actualizar_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_actualizar_secciones
    BEFORE UPDATE ON api.secciones
    FOR EACH ROW
    EXECUTE FUNCTION api.actualizar_timestamp();

CREATE TRIGGER trigger_actualizar_config
    BEFORE UPDATE ON api.configuracion
    FOR EACH ROW
    EXECUTE FUNCTION api.actualizar_timestamp();

CREATE TRIGGER trigger_actualizar_categorias
    BEFORE UPDATE ON api.categorias_secciones
    FOR EACH ROW
    EXECUTE FUNCTION api.actualizar_timestamp();

CREATE TRIGGER trigger_actualizar_notificaciones
    BEFORE UPDATE ON api.notificaciones
    FOR EACH ROW
    EXECUTE FUNCTION api.actualizar_timestamp();

-- ============================================================
-- TRIGGER DE VALIDACIÓN Y ESTADO DE EJEMPLAR EN PRÉSTAMOS
-- ============================================================
CREATE OR REPLACE FUNCTION api.validar_ejemplar_prestamo()
RETURNS TRIGGER AS $$
DECLARE
    ej_condicion TEXT;
    ej_estado TEXT;
    ej_prestado BOOLEAN;
    ej_id INT;
BEGIN
    IF TG_OP = 'DELETE' THEN
        IF OLD.ejemplar_id IS NOT NULL THEN
            UPDATE api.ejemplares SET estado = 'disponible' WHERE id = OLD.ejemplar_id;
        END IF;
        RETURN OLD;
    END IF;

    IF NEW.ejemplar_id IS NULL THEN
        IF NEW.estado = 'activo' THEN
            RAISE EXCEPTION 'No se puede activar un préstamo sin ejemplar asignado';
        END IF;
        IF TG_OP = 'UPDATE' AND OLD.ejemplar_id IS NOT NULL THEN
            UPDATE api.ejemplares SET estado = 'disponible' WHERE id = OLD.ejemplar_id;
        END IF;
        RETURN NEW;
    END IF;

    SELECT condicion, estado INTO ej_condicion, ej_estado FROM api.ejemplares WHERE id = NEW.ejemplar_id;
    IF ej_condicion IS NULL THEN
        RAISE EXCEPTION 'Ejemplar no encontrado';
    END IF;

    IF ej_condicion = 'perdido' THEN
        RAISE EXCEPTION 'El ejemplar está marcado como perdido';
    END IF;

    SELECT EXISTS(
        SELECT 1 FROM api.prestamos
        WHERE ejemplar_id = NEW.ejemplar_id
          AND id != NEW.id
          AND estado NOT IN ('devuelto', 'rechazado', 'no_disponible')
    ) INTO ej_prestado;
    IF ej_prestado THEN
        RAISE EXCEPTION 'El ejemplar ya está asignado a otro préstamo activo o pendiente';
    END IF;

    IF TG_OP = 'UPDATE' AND OLD.ejemplar_id IS NOT NULL AND OLD.ejemplar_id != NEW.ejemplar_id THEN
        UPDATE api.ejemplares SET estado = 'disponible' WHERE id = OLD.ejemplar_id;
    END IF;

    IF NEW.estado = 'activo' OR NEW.estado = 'atrasado' THEN
        UPDATE api.ejemplares SET estado = 'prestado' WHERE id = NEW.ejemplar_id;
    ELSIF NEW.estado IN ('pendiente', 'en_revision', 'por_entregar') THEN
        UPDATE api.ejemplares SET estado = 'reservado' WHERE id = NEW.ejemplar_id;
    ELSIF NEW.estado IN ('devuelto', 'rechazado', 'no_disponible') THEN
        UPDATE api.ejemplares SET estado = 'disponible' WHERE id = NEW.ejemplar_id;
        NEW.ejemplar_id = NULL;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_prestamos_validar_ejemplar
    BEFORE INSERT OR UPDATE ON api.prestamos
    FOR EACH ROW EXECUTE FUNCTION api.validar_ejemplar_prestamo();

CREATE OR REPLACE FUNCTION api.actualizar_disponibilidad_libro()
RETURNS TRIGGER AS $$
DECLARE
    libro_id_var INT;
    disponibles INT;
BEGIN
    libro_id_var := COALESCE(NEW.libro_id, OLD.libro_id);
    SELECT COUNT(*) INTO disponibles FROM api.ejemplares
    WHERE libro_id = libro_id_var
      AND estado = 'disponible'
      AND condicion IN ('bueno', 'regular', 'dañado');
    
    IF disponibles = 0 THEN
        UPDATE api.libros SET disponible = false WHERE id = libro_id_var;
    ELSE
        UPDATE api.libros SET disponible = true WHERE id = libro_id_var AND disponible = false;
    END IF;
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_actualizar_disponibilidad_libro_ejemplar
    AFTER INSERT OR UPDATE OR DELETE ON api.ejemplares
    FOR EACH ROW EXECUTE FUNCTION api.actualizar_disponibilidad_libro();

CREATE TRIGGER trg_actualizar_disponibilidad_libro_prestamo
    AFTER INSERT OR UPDATE OR DELETE ON api.prestamos
    FOR EACH ROW EXECUTE FUNCTION api.actualizar_disponibilidad_libro();

-- ============================================================
-- ÍNDICES
-- ============================================================
CREATE INDEX idx_libros_titulo ON api.libros USING btree (titulo text_pattern_ops);
CREATE INDEX idx_libros_autor_id ON api.libros (autor_id);
CREATE INDEX idx_prestamos_usuario_id ON api.prestamos (usuario_id);
CREATE INDEX idx_prestamos_ejemplar_id ON api.prestamos (ejemplar_id);
CREATE INDEX idx_prestamos_estado ON api.prestamos (estado);
CREATE INDEX idx_prestamos_grupo_id ON api.prestamos (grupo_id);
CREATE INDEX idx_autores_nombre ON api.autores USING btree (nombre text_pattern_ops);
CREATE INDEX idx_resenas_libro_id ON api.resenas (libro_id);
CREATE INDEX idx_resenas_usuario_id ON api.resenas (usuario_id);
CREATE INDEX idx_ejemplares_libro_id ON api.ejemplares (libro_id);
CREATE INDEX idx_ejemplares_codigo ON api.ejemplares (codigo);

-- ============================================================
-- PERMISOS
-- ============================================================
GRANT USAGE ON SCHEMA api TO anon;

GRANT SELECT ON api.autores TO anon;
GRANT SELECT ON api.generos TO anon;
GRANT SELECT ON api.etiquetas TO anon;
GRANT SELECT ON api.editoriales TO anon;
GRANT SELECT ON api.libros TO anon;
GRANT SELECT ON api.libros_generos TO anon;
GRANT SELECT ON api.libros_etiquetas TO anon;
GRANT SELECT ON api.usuario TO anon;
GRANT SELECT ON api.prestamos TO anon;
GRANT SELECT ON api.prestamos_grupo TO anon;
GRANT SELECT ON api.resenas TO anon;
GRANT SELECT ON api.ejemplares TO anon;
GRANT SELECT ON api.listas TO anon;
GRANT SELECT ON api.listas_libros TO anon;
GRANT SELECT ON api.secciones TO anon;
GRANT SELECT ON api.categorias_secciones TO anon;
GRANT SELECT ON api.configuracion TO anon;
GRANT SELECT ON api.notificaciones TO anon;
GRANT SELECT ON api.carrito TO anon;
GRANT SELECT ON api.acciones_pendientes TO anon;
GRANT SELECT ON api.multas TO anon;

GRANT INSERT, UPDATE, DELETE ON api.prestamos TO anon;
GRANT INSERT, UPDATE, DELETE ON api.prestamos_grupo TO anon;
GRANT INSERT, UPDATE, DELETE ON api.usuario TO anon;
GRANT INSERT, UPDATE, DELETE ON api.libros TO anon;
GRANT INSERT, UPDATE, DELETE ON api.autores TO anon;
GRANT INSERT, UPDATE, DELETE ON api.generos TO anon;
GRANT INSERT, UPDATE, DELETE ON api.etiquetas TO anon;
GRANT INSERT, UPDATE, DELETE ON api.editoriales TO anon;
GRANT INSERT, UPDATE, DELETE ON api.libros_generos TO anon;
GRANT INSERT, UPDATE, DELETE ON api.libros_etiquetas TO anon;
GRANT INSERT, UPDATE, DELETE ON api.resenas TO anon;
GRANT INSERT, UPDATE, DELETE ON api.ejemplares TO anon;
GRANT INSERT, UPDATE, DELETE ON api.listas TO anon;
GRANT INSERT, UPDATE, DELETE ON api.listas_libros TO anon;
GRANT INSERT, UPDATE, DELETE ON api.secciones TO anon;
GRANT INSERT, UPDATE, DELETE ON api.categorias_secciones TO anon;
GRANT INSERT, UPDATE, DELETE ON api.configuracion TO anon;
GRANT INSERT, UPDATE, DELETE ON api.notificaciones TO anon;
GRANT INSERT, UPDATE, DELETE ON api.carrito TO anon;
GRANT INSERT, UPDATE, DELETE ON api.acciones_pendientes TO anon;
GRANT INSERT, UPDATE, DELETE ON api.multas TO anon;

GRANT USAGE ON ALL SEQUENCES IN SCHEMA api TO anon;

-- ============================================================
-- DATOS SEMILLA
-- ============================================================

INSERT INTO api.autores (nombre, nacionalidad, fecha_nacimiento) VALUES
    ('Gabriel García Márquez', 'Colombiana', '1927-03-06'),
    ('Isabel Allende', 'Chilena', '1942-08-02'),
    ('Jorge Luis Borges', 'Argentina', '1899-08-24'),
    ('Pablo Neruda', 'Chilena', '1904-07-12'),
    ('Julio Cortázar', 'Argentina', '1914-08-26'),
    ('Mario Vargas Llosa', 'Peruana', '1936-03-28'),
    ('Laura Esquivel', 'Mexicana', '1950-09-30'),
    ('Roberto Bolaño', 'Chilena', '1953-04-28'),
    ('Octavio Paz', 'Mexicana', '1914-03-31'),
    ('Elena Ferrante', 'Italiana', '1943-04-05'),
    ('Haruki Murakami', 'Japonesa', '1949-01-12'),
    ('Chimamanda Ngozi Adichie', 'Nigeriana', '1977-09-15'),
    ('Carlos Ruiz Zafón', 'Española', '1964-09-25'),
    ('Margaret Atwood', 'Canadiense', '1939-11-18'),
    ('George Orwell', 'Británica', '1903-06-25'),
    ('Ursula K. Le Guin', 'Estadounidense', '1929-10-21'),
    ('Milan Kundera', 'Checa', '1929-04-01'),
    ('Gabriela Mistral', 'Chilena', '1889-04-07'),
    ('José Saramago', 'Portuguesa', '1922-11-16'),
    ('Juan Rulfo', 'Mexicana', '1917-05-16'),
    ('Umberto Eco', 'Italiana', '1932-01-05'),
    ('Ray Bradbury', 'Estadounidense', '1920-08-22'),
    ('Paulo Coelho', 'Brasileña', '1947-08-24'),
    ('Antoine de Saint-Exupéry', 'Francesa', '1900-06-29'),
    ('Miguel de Cervantes', 'Española', '1547-09-29'),
    ('Emily Brontë', 'Británica', '1818-07-30'),
    ('F. Scott Fitzgerald', 'Estadounidense', '1896-09-24'),
    ('Fiódor Dostoyevski', 'Rusa', '1821-11-11'),
    ('Jane Austen', 'Británica', '1775-12-16'),
    ('Yuval Noah Harari', 'Israelí', '1976-02-24'),
    ('Harper Lee', 'Estadounidense', '1926-04-28'),
    ('Victor Hugo', 'Francesa', '1802-02-26'),
    ('Marcel Proust', 'Francesa', '1871-07-10'),
    ('Albert Camus', 'Francesa', '1913-11-07'),
    ('Franz Kafka', 'Checa', '1883-07-03');

INSERT INTO api.generos (nombre) VALUES
    ('Novela'), ('Realismo Mágico'), ('Ficción'), ('Filosofía'),
    ('Poesía'), ('Romance'), ('Ciencia Ficción'), ('Ensayo'),
    ('Terror'), ('Distopía'), ('Historia'), ('Aventura'),
    ('Biografía'), ('Drama'), ('Policial'), ('Fantasía');

INSERT INTO api.etiquetas (nombre) VALUES
    ('clásico'), ('premio nobel'), ('latinoamérica'), ('bestseller'),
    ('saga familiar'), ('cuentos'), ('filosofía'), ('laberintos'),
    ('poesía'), ('amor'), ('experimental'), ('contracultura'), ('parís'),
    ('política'), ('distopía'), ('feminismo'), ('japón'), ('ciencia'),
    ('historia'), ('misterio'), ('fantasía'), ('juvenil'), ('épico'),
    ('viajes'), ('guerra'), ('religión'), ('drama');

INSERT INTO api.editoriales (nombre, pais) VALUES
    ('Sudamericana', 'Argentina'),
    ('Plaza & Janés', 'España'),
    ('Sur', 'Argentina'),
    ('Nascimento', 'Chile'),
    ('Alfaguara', 'España'),
    ('Seix Barral', 'España'),
    ('Anagrama', 'España'),
    ('Planeta', 'España'),
    ('Debolsillo', 'España'),
    ('Fondo de Cultura Económica', 'México'),
    ('Minotauro', 'Argentina');

INSERT INTO api.libros (titulo, autor_id, sinopsis, isbn, editorial_id, anio_publicacion, numero_paginas, idioma) VALUES
    ('Cien Años de Soledad',              1, 'La historia de la familia Buendía a lo largo de siete generaciones en el pueblo ficticio de Macondo.',                               '978-0307474728', 1, 1967, 471, 'Español'),
    ('La Casa de los Espíritus',          2, 'La saga de la familia Trueba a lo largo de cuatro generaciones, entrelazando lo personal con lo político.',                        '978-8401352836', 2, 1982, 454, 'Español'),
    ('Ficciones',                         3, 'Una colección de relatos que exploran temas como el infinito, los espejos y los laberintos.',                                       '978-0802130303', 3, 1944, 174, 'Español'),
    ('Veinte Poemas de Amor y una Canción Desesperada', 4, 'Una de las obras poéticas más célebres del siglo XX, que explora el amor y la pérdida.',                   '978-8437603049', 4, 1924,  64, 'Español'),
    ('Rayuela',                           5, 'Una novela innovadora que ofrece múltiples órdenes de lectura y desafía la narrativa tradicional.',                                '978-8437604572', 1, 1963, 627, 'Español'),

    -- Vargas Llosa (6)
    ('La Ciudad y los Perros',            6, 'La historia de un grupo de cadetes en el Colegio Militar Leoncio Prado, una crítica a la sociedad peruana.',                       '978-8420471020', 5, 1963, 448, 'Español'),
    ('Conversación en La Catedral',       6, '¿En qué momento se jodió el Perú? Una profunda exploración de la corrupción y el poder.',                                        '978-8420471037', 5, 1969, 672, 'Español'),
    ('La Fiesta del Chivo',               6, 'La novela que recrea los últimos días del dictador dominicano Rafael Trujillo.',                                                   '978-8420474069', 5, 2000, 568, 'Español'),

    -- Laura Esquivel (7)
    ('Como Agua para Chocolate',          7, 'Tita, la menor de tres hermanas, está condenada a cuidar a su madre. Cada capítulo es una receta de cocina cargada de emociones.',   '978-0385721233', 8, 1989, 256, 'Español'),

    -- Bolaño (8)
    ('2666',                              8, 'Un monumental retrato de la violencia en el norte de México compuesto por cinco partes entrelazadas.',                              '978-8433973184', 7, 2004, 1125, 'Español'),
    ('Los Detectives Salvajes',           8, 'Dos poetas recorren México, Europa y África persiguiendo las huellas de una misteriosa escritora.',                                '978-8433968661', 7, 1998, 624, 'Español'),

    -- Octavio Paz (9)
    ('El Laberinto de la Soledad',        9, 'Un ensayo fundamental sobre la identidad mexicana, sus máscaras y sus rituales.',                                                  '978-9681601751', 10, 1950, 206, 'Español'),

    -- Elena Ferrante (10)
    ('La Amiga Estupenda',               10, 'La historia de la amistad entre Lila y Lenù desde la infancia en un barrio pobre de Nápoles.',                                     '978-8426400703', 8, 2011, 384, 'Español'),

    -- Murakami (11)
    ('Tokio Blues',                      11, 'Toru Watanabe evoca su juventud en el Tokio de los años sesenta, marcada por el amor y la pérdida.',                              '978-8483835067', 9, 1987, 384, 'Español'),
    ('Kafka en la Orilla',               11, 'Un adolescente que huye de casa y un anciano que habla con los gatos protagonizan una historia surrealista.',                      '978-8483835487', 9, 2002, 576, 'Español'),
    ('1Q84',                             11, 'Aomame y Tengo viven en un Tokio paralelo donde dos lunas brillan en el cielo.',                                                    '978-8483835340', 9, 2009, 944, 'Español'),

    -- Chimamanda (12)
    ('Americanah',                       12, 'Ifemelu emigra de Nigeria a Estados Unidos y descubre lo que significa ser negra por primera vez.',                                '978-8439727987', 8, 2013, 608, 'Español'),
    ('Medio Sol Amarillo',               12, 'Dos hermanas gemelas ven sus vidas transformadas por la guerra de Biafra en la Nigeria de los años 60.',                          '978-8439728366', 8, 2006, 544, 'Español'),

    -- Zafón (13)
    ('La Sombra del Viento',            13, 'En la Barcelona de posguerra, Daniel descubre un libro maldito que cambiará su vida para siempre.',                                '978-8408163435', 8, 2001, 576, 'Español'),
    ('El Juego del Ángel',              13, 'Un joven escritor recibe una oferta irresistible de un misterioso editor en la Barcelona de los años 20.',                        '978-8408168294', 8, 2008, 576, 'Español'),
    ('El Prisionero del Cielo',         13, 'Tercera entrega del Cementerio de los Libros Olvidados. Un hombre entra a la librería con un oscuro secreto.',                    '978-8408175650', 8, 2011, 384, 'Español'),

    -- Margaret Atwood (14)
    ('El Cuento de la Criada',          14, 'En la República de Gilead, las criadas son forzadas a procrear para las élites en una distopía patriarcal.',                       '978-8498388015', 8, 1985, 416, 'Español'),

    -- Orwell (15)
    ('1984',                             15, 'Winston Smith intenta rebelarse contra el Partido en un mundo donde el Gran Hermano todo lo ve.',                                 '978-8499890944', 9, 1949, 352, 'Español'),
    ('Rebelión en la Granja',            15, 'Los animales de una granja se rebelan contra los humanos, una alegoría sobre el totalitarismo soviético.',                        '978-8499890951', 9, 1945, 160, 'Español'),

    -- Le Guin (16)
    ('La Mano Izquierda de la Oscuridad', 16, 'Un enviado llega a un planeta donde sus habitantes no tienen género fijo, desafiando toda noción de identidad.',                  '978-8445074022', 11, 1969, 304, 'Español'),
    ('Los Desposeídos',                  16, 'Un físico vive en dos mundos opuestos: uno anarquista y otro capitalista, en busca de la utopía.',                               '978-8445074039', 11, 1974, 384, 'Español'),

    -- Kundera (17)
    ('La Insoportable Levedad del Ser', 17, 'En la Praga de 1968, cuatro personajes se debaten entre el peso del compromiso y la levedad de la libertad.',                      '978-8483835098', 9, 1984, 336, 'Español'),

    -- Gabriela Mistral (18)
    ('Desolación',                       18, 'Una de las obras cumbres de la poesía chilena, donde explora el amor, el dolor y la naturaleza.',                                 '978-9561127142', 4, 1922, 248, 'Español'),

    -- Saramago (19)
    ('Ensayo sobre la Ceguera',         19, 'Una ceguera blanca se propaga por una ciudad, revelando lo peor y lo mejor del ser humano.',                                      '978-8420474427', 8, 1995, 312, 'Español'),
    ('El Evangelio según Jesucristo',   19, 'Una reinterpretación de la vida de Jesús desde una perspectiva profundamente humana y crítica.',                                  '978-8420474441', 8, 1991, 480, 'Español'),

    -- Juan Rulfo (20)
    ('Pedro Páramo',                    20, 'Juan Preciado llega a Comala en busca de su padre y descubre un pueblo habitado por las voces de los muertos.',                   '978-9685208550', 10, 1955, 128, 'Español'),
    ('El Llano en Llamas',              20, 'Una colección de cuentos que retrata la dureza de la vida rural en México tras la Revolución.',                                  '978-9685208567', 10, 1953, 192, 'Español'),

    -- More by existing authors
    ('El Otoño del Patriarca',           1, 'La historia de un dictador caribeño que ha gobernado durante siglos, en una exploración del poder absoluto.',                      '978-0307475282', 1, 1975, 304, 'Español'),
    ('Crónica de una Muerte Anunciada',  1, 'La reconstrucción de un asesinato anunciado en un pueblo, donde todos sabían pero nadie hizo nada.',                              '978-0307475299', 1, 1981, 128, 'Español'),
    ('El Amor en los Tiempos del Cólera', 1, 'La historia de amor de Florentino Ariza y Fermina Daza a lo largo de más de medio siglo.',                                      '978-0307475275', 1, 1985, 464, 'Español'),

    ('Eva Luna',                         2, 'Una joven huérfana cuenta historias para sobrevivir en un país sudamericano sumido en la agitación política.',                    '978-8401383014', 8, 1987, 288, 'Español'),
    ('Paula',                            2, 'Una carta autobiográfica escrita al borde de la cama de su hija enferma, un relato profundamente personal.',                      '978-8401383076', 8, 1994, 368, 'Español'),

    ('El Aleph',                         3, 'Una colección de cuentos que exploran el infinito, el tiempo y los laberintos de la mente.',                                     '978-8420633114', 3, 1949, 208, 'Español'),

    ('Canto General',                    4, 'Una epopeya poética que recorre la historia y la geografía de América Latina desde sus orígenes precolombinos.',                   '978-8437609300', 4, 1950, 568, 'Español'),

    ('Bestiario',                        5, 'Ocho cuentos donde lo cotidiano se transforma en un juego de espejos que refleja lo insólito de la realidad.',                     '978-8420437521', 1, 1951, 168, 'Español'),
    ('Historias de Cronopios y de Famas', 5, 'Un manual de instrucciones para la vida cotidiana contado a través de seres imaginarios.',                                       '978-8420437538', 1, 1962, 160, 'Español'),

    -- Extra variety
    ('El Nombre de la Rosa',            21, 'En una abadía medieval, un fraile investiga una serie de misteriosos asesinatos relacionados con un libro prohibido.',             '978-8426412058', 9, 1980, 536, 'Español'),
    ('Fahrenheit 451',                  22, 'En un futuro donde los libros están prohibidos, un bombero encargado de quemarlos comienza a cuestionar su trabajo.',              '978-8445074879', 11, 1953, 208, 'Español'),

    ('El Alquimista',                   23, 'Un joven pastor andaluz emprende un viaje en busca de un tesoro, encontrando la sabiduría en el camino.',                          '978-8408130451', 8, 1988, 192, 'Español'),
    ('El Principito',                   24, 'Un piloto perdido en el desierto encuentra a un pequeño príncipe de otro planeta que le enseña sobre la vida y el amor.',          '978-8478887194', 8, 1943, 120, 'Español'),

    ('Don Quijote de la Mancha',        25, 'Las aventuras de un hidalgo que enloquece leyendo novelas de caballería y sale a desfacer entuertos.',                           '978-8420412146', 5, 1605, 1136, 'Español'),
    ('Cumbres Borrascosas',            26, 'La pasión tormentosa entre Heathcliff y Catherine en los páramos de Yorkshire, una historia de amor y venganza.',                  '978-8491051275', 8, 1847, 416, 'Español'),

    ('El Gran Gatsby',                  27, 'En los felices años veinte, Jay Gatsby persigue incansablemente el sueño americano y el amor de su vida.',                        '978-8491051282', 8, 1925, 192, 'Español'),
    ('Crimen y Castigo',                28, 'Raskólnikov, un estudiante pobre, comete un asesinato y se enfrenta a las consecuencias psicológicas de su crimen.',               '978-8491051138', 8, 1866, 672, 'Español'),
    ('Orgullo y Prejuicio',            29, 'Elizabeth Bennet y el señor Darcy protagonizan una de las historias de amor más célebres de la literatura.',                        '978-8491051237', 8, 1813, 448, 'Español'),

    ('Sapiens',                         30, 'Un recorrido fascinante por la historia de la humanidad, desde los primeros homínidos hasta la era digital.',                       '978-8499926223', 9, 2014, 496, 'Español'),

    ('Matar a un Ruiseñor',            31, 'En el sur profundo de Estados Unidos, una niña descubre el racismo y la injusticia cuando su padre defiende a un hombre negro.',    '978-8418637230', 8, 1960, 336, 'Español'),

    ('Los Miserables',                 32, 'Jean Valjean busca la redención mientras es perseguido incansablemente por el inspector Javert en la Francia del siglo XIX.',       '978-8491051299', 8, 1862, 1464, 'Español'),
    ('En Busca del Tiempo Perdido',    33, 'Una exploración monumental de la memoria, el amor y el arte a través de la vida de la alta sociedad francesa.',                     '978-8491051305', 8, 1913, 2300, 'Español'),

    ('El Extranjero',                  34, 'Meursault, un hombre indiferente a todo, mata a un árabe en una playa argelina y enfrenta el absurdo de la justicia.',               '978-8420675091', 9, 1942, 128, 'Español'),

    ('La Metamorfosis',                35, 'Gregorio Samsa despierta convertido en un insecto monstruoso y debe enfrentar el rechazo de su familia y la sociedad.',            '978-8420675114', 9, 1915, 104, 'Español'),
    ('El Proceso',                     35, 'Josef K. es arrestado una mañana sin saber por qué, dando inicio a una pesadilla burocrática sin fin.',                              '978-8420675121', 9, 1925, 288, 'Español');

INSERT INTO api.libros_generos (libro_id, genero_id) VALUES
    (1, 1), (1, 2),
    (2, 1), (2, 2),
    (3, 3), (3, 4),
    (4, 5), (4, 6),
    (5, 1),
    -- Vargas Llosa
    (6, 1), (6, 14),
    (7, 1), (7, 14),
    (8, 1), (8, 11),
    -- Esquivel
    (9, 1), (9, 2), (9, 6),
    -- Bolaño
    (10, 1), (10, 14),
    (11, 1), (11, 14),
    -- Paz
    (12, 8), (12, 4),
    -- Ferrante
    (13, 1), (13, 14),
    -- Murakami
    (14, 1), (14, 6),
    (15, 1), (15, 16),
    (16, 1), (16, 3), (16, 7),
    -- Chimamanda
    (17, 1), (17, 14),
    (18, 1), (18, 11),
    -- Zafón
    (19, 1), (19, 15),
    (20, 1), (20, 15),
    (21, 1), (21, 15),
    -- Atwood
    (22, 10), (22, 7),
    -- Orwell
    (23, 3), (23, 10),
    (24, 3), (24, 10),
    -- Le Guin
    (25, 7), (25, 3),
    (26, 7), (26, 3),
    -- Kundera
    (27, 1), (27, 4),
    -- Mistral
    (28, 5),
    -- Saramago
    (29, 1), (29, 4),
    (30, 1), (30, 4),
    -- Rulfo
    (31, 1), (31, 2),
    (32, 3),
    -- García Márquez extra
    (33, 1), (33, 2),
    (34, 1), (34, 2),
    (35, 1), (35, 2), (35, 6),
    -- Allende extra
    (36, 1), (36, 14),
    (37, 13),
    -- Borges extra
    (38, 3), (38, 4),
    -- Neruda extra
    (39, 5),
    -- Cortázar extra
    (40, 3),
    (41, 3),
    -- Extra variety
    (42, 1), (42, 11), (42, 15),
    (43, 7), (43, 10),
    (44, 12), (44, 4),
    (45, 2), (45, 4),
    (46, 1), (46, 12),
    (47, 1), (47, 6),
    (48, 1), (48, 14),
    (49, 1), (49, 14), (49, 15),
    (50, 1), (50, 6),
    (51, 8), (51, 11),
    (52, 1), (52, 14),
    (53, 1), (53, 11),
    (54, 1), (54, 4),
    (55, 1), (55, 4),
    (56, 1), (56, 3),
    (57, 1), (57, 3), (57, 4);

INSERT INTO api.libros_etiquetas (libro_id, etiqueta_id) VALUES
    (1, 1), (1, 2), (1, 3),
    (2, 1), (2, 5), (2, 3),
    (3, 6), (3, 7), (3, 8),
    (4, 9), (4, 10), (4, 1),
    (5, 11), (5, 13),
    (6, 1), (6, 3), (6, 14),
    (7, 1), (7, 14), (7, 3),
    (8, 1), (8, 14), (8, 11),
    (9, 3), (9, 10), (9, 5),
    (10, 1), (10, 3), (10, 14),
    (11, 1), (11, 3), (11, 12),
    (12, 1), (12, 7), (12, 3),
    (13, 1), (13, 5), (13, 16),
    (14, 1), (14, 10), (14, 17),
    (15, 1), (15, 17), (15, 21),
    (16, 1), (16, 17), (16, 21),
    (17, 1), (17, 16), (17, 14),
    (18, 1), (18, 19), (18, 26),
    (19, 1), (19, 3), (19, 20),
    (20, 1), (20, 20), (20, 21),
    (21, 1), (21, 20), (21, 14),
    (22, 10), (22, 15), (22, 16),
    (23, 1), (23, 14), (23, 15),
    (24, 1), (24, 14), (24, 15),
    (25, 7), (25, 21), (25, 18),
    (26, 7), (26, 14), (26, 18),
    (27, 1), (27, 7), (27, 14),
    (28, 1), (28, 9), (28, 2),
    (29, 1), (29, 7), (29, 14),
    (30, 1), (30, 7), (30, 26),
    (31, 1), (31, 3), (31, 2),
    (32, 1), (32, 3), (32, 6),
    (33, 1), (33, 2), (33, 14),
    (34, 1), (34, 2), (34, 6),
    (35, 1), (35, 10), (35, 3),
    (36, 1), (36, 5), (36, 16),
    (37, 1), (37, 5), (37, 16),
    (38, 1), (38, 6), (38, 8),
    (39, 1), (39, 9), (39, 23),
    (40, 1), (40, 6), (40, 11),
    (41, 1), (41, 11), (41, 12),
    (42, 1), (42, 11), (42, 20),
    (43, 1), (43, 7), (43, 15),
    (44, 1), (44, 12), (44, 24),
    (45, 1), (45, 4), (45, 22),
    (46, 1), (46, 23), (46, 12),
    (47, 1), (47, 10), (47, 27),
    (48, 1), (48, 14),
    (49, 1), (49, 14), (49, 27),
    (50, 1), (50, 10), (50, 6),
    (51, 1), (51, 19), (51, 18),
    (52, 1), (52, 14), (52, 26),
    (53, 1), (53, 14), (53, 27),
    (54, 1), (54, 7), (54, 4),
    (55, 1), (55, 7), (55, 4),
    (56, 1), (56, 7),
    (57, 1), (57, 7), (57, 4);

INSERT INTO api.ejemplares (libro_id) VALUES
    (1), (1), (1), (1), (1),
    (2), (2), (2),
    (3), (3), (3), (3),
    (4), (4), (4), (4), (4), (4),
    (5), (5), (5), (5),
    (6), (6), (6),
    (7), (7), (7),
    (8), (8), (8),
    (9), (9),
    (10), (10), (10),
    (11), (11),
    (12), (12),
    (13), (13), (13),
    (14), (14), (14),
    (15), (15),
    (16), (16),
    (17), (17),
    (18), (18),
    (19), (19), (19), (19),
    (20), (20), (20),
    (21), (21),
    (22), (22), (22),
    (23), (23), (23), (23),
    (24), (24),
    (25), (25),
    (26), (26),
    (27), (27), (27),
    (28), (28),
    (29), (29), (29), (29),
    (30), (30),
    (31), (31), (31),
    (32), (32),
    (33), (33), (33),
    (34), (34),
    (35), (35), (35), (35),
    (36), (36),
    (37), (37),
    (38), (38), (38),
    (39), (39),
    (40), (40),
    (41), (41),
    (42), (42), (42),
    (43), (43), (43),
    (44), (44), (44), (44),
    (45), (45), (45),
    (46), (46),
    (47), (47),
    (48), (48), (48),
    (49), (49), (49),
    (50), (50),
    (51), (51), (51),
    (52), (52), (52), (52),
    (53), (53),
    (54), (54),
    (55), (55),
    (56), (56),
    (57), (57), (57);

WITH
u1 AS (
    INSERT INTO api.usuario (id, nombre_usuario, password_hash, rol, email, rut, primer_nombre, segundo_nombre, apellido_paterno, apellido_materno)
    VALUES (gen_random_uuid(), 'jperez', 'password123', 'admin', 'juan.perez@email.com', '12345678-9', 'Juan', 'Carlos', 'Pérez', 'González')
    RETURNING id
),
u2 AS (
    INSERT INTO api.usuario (id, nombre_usuario, password_hash, rol, email, rut, primer_nombre, segundo_nombre, apellido_paterno, apellido_materno)
    VALUES (gen_random_uuid(), 'mgonzalez', 'password123', 'usuario', 'maria.gonzalez@email.com', '98765432-1', 'María', 'José', 'González', 'Silva')
    RETURNING id
),
u3 AS (
    INSERT INTO api.usuario (id, nombre_usuario, password_hash, rol, email, rut, primer_nombre, segundo_nombre, apellido_paterno, apellido_materno)
    VALUES (gen_random_uuid(), 'biblio', 'password123', 'bibliotecario', 'biblio@email.com', '11111111-1', 'Carlos', 'Andrés', 'López', 'Martínez')
    RETURNING id
)
INSERT INTO api.prestamos (usuario_id, libro_id, ejemplar_id, estado)
    (SELECT id, 1, (SELECT id FROM api.ejemplares WHERE libro_id = 1 LIMIT 1), 'activo' FROM u1);

WITH
u1 AS (SELECT id FROM api.usuario WHERE nombre_usuario = 'jperez'),
u2 AS (SELECT id FROM api.usuario WHERE nombre_usuario = 'mgonzalez')
INSERT INTO api.resenas (usuario_id, libro_id, puntuacion, comentario)
    SELECT id, 1, 5, 'Una obra maestra. La mejor novela en español después del Quijote.' FROM u1
    UNION ALL
    SELECT id, 1, 4, 'Me encantó la historia de los Buendía, aunque a veces me perdía con los nombres.' FROM u2
    UNION ALL
    SELECT id, 3, 5, 'Borges en su máxima expresión. Cada cuento es un laberinto mental.' FROM u1;

-- Préstamos atrasados de prueba para multas
WITH u1 AS (SELECT id FROM api.usuario WHERE nombre_usuario = 'jperez')
INSERT INTO api.prestamos (usuario_id, libro_id, ejemplar_id, estado, fecha_prestamo, fecha_devolucion_esperada)
    SELECT id, 2, (SELECT id FROM api.ejemplares WHERE libro_id = 2 LIMIT 1), 'atrasado',
           '2026-05-15'::timestamptz, '2026-06-01'::timestamptz FROM u1
    UNION ALL
    SELECT id, 3, (SELECT id FROM api.ejemplares WHERE libro_id = 3 LIMIT 1), 'atrasado',
           '2026-05-20'::timestamptz, '2026-06-05'::timestamptz FROM u1;

WITH u1 AS (SELECT id FROM api.usuario WHERE nombre_usuario = 'jperez'),
     p AS (SELECT id, libro_id, usuario_id FROM api.prestamos WHERE estado = 'atrasado' AND usuario_id = (SELECT id FROM api.usuario WHERE nombre_usuario = 'jperez'))
INSERT INTO api.multas (usuario_id, prestamo_id, monto, dias_atraso)
    SELECT usuario_id, id, 5000, 10 FROM p WHERE libro_id = 2
    UNION ALL
    SELECT usuario_id, id, 3000, 6 FROM p WHERE libro_id = 3;

WITH
u1 AS (SELECT id FROM api.usuario WHERE nombre_usuario = 'jperez'),
u2 AS (SELECT id FROM api.usuario WHERE nombre_usuario = 'mgonzalez'),
u3 AS (SELECT id FROM api.usuario WHERE nombre_usuario = 'biblio')
INSERT INTO api.listas (nombre, descripcion, usuario_id, por_defecto, publica) VALUES
    ('Favoritos', 'Mis libros favoritos de todos los tiempos.', (SELECT id FROM u1), true, true),
    ('Por leer', 'Libros que quiero leer próximamente.', (SELECT id FROM u1), true, true),
    ('Leídos', 'Libros que ya he leído.', (SELECT id FROM u1), true, true),
    ('Favoritos', 'Mis libros favoritos de todos los tiempos.', (SELECT id FROM u2), true, true),
    ('Por leer', 'Libros que quiero leer próximamente.', (SELECT id FROM u2), true, true),
    ('Leídos', 'Libros que ya he leído.', (SELECT id FROM u2), true, true),
    ('Favoritos', 'Mis libros favoritos de todos los tiempos.', (SELECT id FROM u3), true, true),
    ('Por leer', 'Libros que quiero leer próximamente.', (SELECT id FROM u3), true, true),
    ('Leídos', 'Libros que ya he leído.', (SELECT id FROM u3), true, true);

WITH
l1 AS (SELECT id FROM api.listas WHERE nombre = 'Favoritos' AND usuario_id = (SELECT id FROM api.usuario WHERE nombre_usuario = 'jperez'))
INSERT INTO api.listas_libros (lista_id, libro_id)
    SELECT id, 1 FROM l1
    UNION ALL SELECT id, 3 FROM l1
    UNION ALL SELECT id, 5 FROM l1;

INSERT INTO api.secciones (nombre, descripcion, categoria, x, y, icono) VALUES
    ('Entrada Principal', 'Puerta de acceso principal', 'Acceso', 50, 95, '🚪'),
    ('Mesón de Atención', 'Solicita o devuelve libros aquí', 'Atención', 30, 80, '📋'),
    ('Caja 1', 'Caja de atención rápida', 'Atención', 35, 85, '1️⃣'),
    ('Caja 2', 'Caja de atención general', 'Atención', 40, 85, '2️⃣'),
    ('Caja 3', 'Caja de devoluciones', 'Atención', 45, 85, '3️⃣'),
    ('Auto-Préstamo', 'Retira libros escaneando tu código', 'Atención', 70, 80, '🤖'),
    ('Sala de Lectura Silenciosa', 'Espacio sin ruido para lectura concentrada', 'Lectura', 25, 50, '📚'),
    ('Mesas de Estudio Grupal', 'Mesas grandes para trabajo en equipo', 'Lectura', 75, 50, '👥'),
    ('Sala Multimedia', 'Películas, audiolibros y documentales', 'Multimedia', 50, 55, '🎬'),
    ('Computadores', '6 equipos con acceso a bases de datos', 'Computadores', 65, 30, '💻'),
    ('Zona WiFi', 'Conexión gratuita de alta velocidad', 'WiFi', 40, 30, '📶'),
    ('Impresoras y Fotocopiadoras', 'Impresión blanco/negro y color', 'Servicios', 20, 35, '🖨️'),
    ('Sala de Conferencias', 'Capacidad 30 personas, reserva previa', 'Eventos', 80, 20, '🎤'),
    ('Baños', 'Servicios higiénicos', 'Baños', 15, 65, '🚻'),
    ('Baños', 'Servicios higiénicos', 'Baños', 85, 65, '🚻'),
    ('Cafetería', 'Café, té y snacks. No se permite comer en salas.', 'Cafetería', 50, 15, '☕'),
    ('Lockers', 'Guarda tus pertenencias antes de entrar', 'Servicios', 10, 90, '🔒'),
    ('Estanterías A-F', 'Ficción, Novela, Poesía', 'Libros', 20, 45, '📖'),
    ('Estanterías G-M', 'Historia, Filosofía, Ciencias', 'Libros', 50, 45, '📖'),
    ('Estanterías N-Z', 'Tecnología, Arte, Biografías', 'Libros', 80, 45, '📖'),
    ('Colección de Referencia', 'Diccionarios, enciclopedias, manuales', 'Libros', 50, 65, '📕'),
    ('Sala Infantil', 'Libros y juegos para niños', 'Lectura', 50, 75, '🧒'),
    ('Sala Juvenil', 'Cómics, manga y literatura juvenil', 'Lectura', 85, 75, '🎮');

INSERT INTO api.categorias_secciones (nombre, descripcion, color) VALUES
    ('Acceso', 'Puertas y entradas del edificio', 'bg-blue-500'),
    ('Atención', 'Puntos de atención al público', 'bg-emerald-500'),
    ('Lectura', 'Salas de lectura, mesas de estudio', 'bg-amber-500'),
    ('Multimedia', 'Salas de cine, audio, documentales', 'bg-purple-500'),
    ('Computadores', 'Equipos informáticos de uso público', 'bg-cyan-500'),
    ('WiFi', 'Zonas con conexión inalámbrica', 'bg-sky-500'),
    ('Servicios', 'Impresoras, lockers, fotocopiadoras', 'bg-gray-500'),
    ('Eventos', 'Salas de conferencias y auditorios', 'bg-rose-500'),
    ('Baños', 'Servicios higiénicos', 'bg-indigo-500'),
    ('Cafetería', 'Zona de alimentación', 'bg-orange-500'),
    ('Libros', 'Estanterías y colecciones', 'bg-red-500');

INSERT INTO api.configuracion (clave, valor) VALUES
    ('mapa_imagen', ''),
    ('mapa_titulo', 'Mapa de la Biblioteca'),
    ('multa_por_dia', '500'),
    ('multa_maxima', '10000'),
    ('custom_host', '');

CREATE TRIGGER trg_resenas_validar
    BEFORE INSERT ON api.resenas
    FOR EACH ROW EXECUTE FUNCTION api.validar_resena();
