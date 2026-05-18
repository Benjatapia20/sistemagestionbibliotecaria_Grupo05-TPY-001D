-- =====================================================================
-- FUNCIONES ATÓMICAS para préstamos (evitan race conditions de stock)
-- =====================================================================
-- Ejecutar en Adminer/pgAdmin (Docker local)
-- =====================================================================

-- Aprobar préstamo con verificación atómica de stock
CREATE OR REPLACE FUNCTION aprobar_prestamo_op(prestamo_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_prestamo RECORD;
    v_stock_actual INT;
BEGIN
    -- Bloquear el préstamo para evitar concurrencia
    SELECT * INTO v_prestamo FROM public.prestamos WHERE id = prestamo_id FOR UPDATE;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'message', 'Préstamo no encontrado');
    END IF;
    
    IF v_prestamo.estado != 'solicitado' THEN
        RETURN jsonb_build_object('success', false, 'message', 'El préstamo ya fue procesado');
    END IF;
    
    -- Verificar stock disponible
    SELECT stock INTO v_stock_actual FROM public.libros WHERE id = v_prestamo.libro_id FOR UPDATE;
    
    IF v_stock_actual <= 0 THEN
        RETURN jsonb_build_object('success', false, 'message', 'No hay stock disponible');
    END IF;
    
    -- Decrementar stock
    UPDATE public.libros SET stock = stock - 1, updated_at = NOW()
    WHERE id = v_prestamo.libro_id;
    
    -- Aprobar préstamo
    UPDATE public.prestamos
    SET estado = 'activo', fecha_aprobacion = NOW()
    WHERE id = prestamo_id;
    
    RETURN jsonb_build_object('success', true, 'message', 'Préstamo aprobado');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Rechazar préstamo
CREATE OR REPLACE FUNCTION rechazar_prestamo_op(prestamo_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_prestamo RECORD;
BEGIN
    SELECT * INTO v_prestamo FROM public.prestamos WHERE id = prestamo_id FOR UPDATE;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'message', 'Préstamo no encontrado');
    END IF;
    
    IF v_prestamo.estado != 'solicitado' THEN
        RETURN jsonb_build_object('success', false, 'message', 'El préstamo ya fue procesado');
    END IF;
    
    UPDATE public.prestamos SET estado = 'rechazado' WHERE id = prestamo_id;
    
    RETURN jsonb_build_object('success', true, 'message', 'Préstamo rechazado');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Solicitar devolución
CREATE OR REPLACE FUNCTION solicitar_devolucion_op(
    prestamo_id UUID,
    p_estado_libro TEXT,
    p_observaciones TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_prestamo RECORD;
BEGIN
    SELECT * INTO v_prestamo FROM public.prestamos WHERE id = prestamo_id FOR UPDATE;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'message', 'Préstamo no encontrado');
    END IF;
    
    IF v_prestamo.estado NOT IN ('activo', 'vencido') THEN
        RETURN jsonb_build_object('success', false, 'message', 'Solo préstamos activos o vencidos');
    END IF;
    
    UPDATE public.prestamos
    SET estado = 'devolucion_solicitada',
        fecha_solicitud_devolucion = NOW(),
        estado_libro_devolucion = p_estado_libro,
        observaciones_devolucion = COALESCE(p_observaciones, observaciones)
    WHERE id = prestamo_id;
    
    RETURN jsonb_build_object('success', true, 'message', 'Devolución solicitada');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Aprobar devolución (incrementa stock)
CREATE OR REPLACE FUNCTION aprobar_devolucion_op(
    prestamo_id UUID,
    p_estado_libro TEXT DEFAULT NULL,
    p_multa NUMERIC DEFAULT 0
)
RETURNS JSONB AS $$
DECLARE
    v_prestamo RECORD;
    v_multa NUMERIC;
BEGIN
    SELECT * INTO v_prestamo FROM public.prestamos WHERE id = prestamo_id FOR UPDATE;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'message', 'Préstamo no encontrado');
    END IF;
    
    IF v_prestamo.estado != 'devolucion_solicitada' THEN
        RETURN jsonb_build_object('success', false, 'message', 'Préstamo no está pendiente de devolución');
    END IF;
    
    -- Incrementar stock
    UPDATE public.libros SET stock = stock + 1, updated_at = NOW()
    WHERE id = v_prestamo.libro_id;
    
    -- Marcar como devuelto
    v_multa := COALESCE(p_multa, 0);
    UPDATE public.prestamos
    SET estado = 'devuelto',
        fecha_devolucion_real = NOW(),
        estado_libro_devolucion = COALESCE(p_estado_libro, estado_libro_devolucion),
        multa = v_multa
    WHERE id = prestamo_id;
    
    RETURN jsonb_build_object('success', true, 'message', 'Devolución aprobada', 'multa', v_multa);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Rechazar devolución
CREATE OR REPLACE FUNCTION rechazar_devolucion_op(prestamo_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_prestamo RECORD;
    v_estado_anterior TEXT;
BEGIN
    SELECT * INTO v_prestamo FROM public.prestamos WHERE id = prestamo_id FOR UPDATE;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'message', 'Préstamo no encontrado');
    END IF;
    
    IF v_prestamo.estado != 'devolucion_solicitada' THEN
        RETURN jsonb_build_object('success', false, 'message', 'Estado incorrecto');
    END IF;
    
    v_estado_anterior := CASE WHEN NOW() > v_prestamo.fecha_devolucion_esperada THEN 'vencido' ELSE 'activo' END;
    
    UPDATE public.prestamos SET estado = v_estado_anterior WHERE id = prestamo_id;
    
    RETURN jsonb_build_object('success', true, 'message', 'Devolución rechazada');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Solicitar renovación
CREATE OR REPLACE FUNCTION solicitar_renovacion_op(prestamo_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_prestamo RECORD;
BEGIN
    SELECT * INTO v_prestamo FROM public.prestamos WHERE id = prestamo_id FOR UPDATE;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'message', 'Préstamo no encontrado');
    END IF;
    
    IF v_prestamo.estado NOT IN ('activo', 'vencido') THEN
        RETURN jsonb_build_object('success', false, 'message', 'Solo activos o vencidos');
    END IF;
    
    UPDATE public.prestamos
    SET estado = 'renovacion_solicitada',
        fecha_solicitud_renovacion = NOW()
    WHERE id = prestamo_id;
    
    RETURN jsonb_build_object('success', true, 'message', 'Renovación solicitada');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Aprobar renovación
CREATE OR REPLACE FUNCTION aprobar_renovacion_op(prestamo_id UUID, p_dias_extension INT DEFAULT 14)
RETURNS JSONB AS $$
DECLARE
    v_prestamo RECORD;
    v_nueva_fecha TIMESTAMP WITH TIME ZONE;
BEGIN
    SELECT * INTO v_prestamo FROM public.prestamos WHERE id = prestamo_id FOR UPDATE;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'message', 'Préstamo no encontrado');
    END IF;
    
    IF v_prestamo.estado != 'renovacion_solicitada' THEN
        RETURN jsonb_build_object('success', false, 'message', 'Estado incorrecto');
    END IF;
    
    v_nueva_fecha := GREATEST(v_prestamo.fecha_devolucion_esperada, NOW()) + (p_dias_extension || ' days')::INTERVAL;
    
    UPDATE public.prestamos
    SET estado = 'activo',
        fecha_devolucion_esperada = v_nueva_fecha
    WHERE id = prestamo_id;
    
    RETURN jsonb_build_object('success', true, 'message', 'Renovación aprobada', 'nueva_fecha', v_nueva_fecha);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Rechazar renovación
CREATE OR REPLACE FUNCTION rechazar_renovacion_op(prestamo_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_prestamo RECORD;
    v_estado_anterior TEXT;
BEGIN
    SELECT * INTO v_prestamo FROM public.prestamos WHERE id = prestamo_id FOR UPDATE;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'message', 'Préstamo no encontrado');
    END IF;
    
    IF v_prestamo.estado != 'renovacion_solicitada' THEN
        RETURN jsonb_build_object('success', false, 'message', 'Estado incorrecto');
    END IF;
    
    v_estado_anterior := CASE WHEN NOW() > v_prestamo.fecha_devolucion_esperada THEN 'vencido' ELSE 'activo' END;
    
    UPDATE public.prestamos SET estado = v_estado_anterior WHERE id = prestamo_id;
    
    RETURN jsonb_build_object('success', true, 'message', 'Renovación rechazada');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Permisos para web_anon
GRANT EXECUTE ON FUNCTION aprobar_prestamo_op(UUID) TO web_anon;
GRANT EXECUTE ON FUNCTION rechazar_prestamo_op(UUID) TO web_anon;
GRANT EXECUTE ON FUNCTION solicitar_devolucion_op(UUID, TEXT, TEXT) TO web_anon;
GRANT EXECUTE ON FUNCTION aprobar_devolucion_op(UUID, TEXT, NUMERIC) TO web_anon;
GRANT EXECUTE ON FUNCTION rechazar_devolucion_op(UUID) TO web_anon;
GRANT EXECUTE ON FUNCTION solicitar_renovacion_op(UUID) TO web_anon;
GRANT EXECUTE ON FUNCTION aprobar_renovacion_op(UUID, INT) TO web_anon;
GRANT EXECUTE ON FUNCTION rechazar_renovacion_op(UUID) TO web_anon;

SELECT 'Funciones atómicas creadas' AS resultado;
