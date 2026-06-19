CREATE OR REPLACE FUNCTION api.forzar_id_serial()
RETURNS TRIGGER AS $$
BEGIN
    NEW.id = nextval('api.libros_id_seq');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_libros_forzar_id ON api.libros;
CREATE TRIGGER trg_libros_forzar_id
    BEFORE INSERT ON api.libros
    FOR EACH ROW EXECUTE FUNCTION api.forzar_id_serial();
