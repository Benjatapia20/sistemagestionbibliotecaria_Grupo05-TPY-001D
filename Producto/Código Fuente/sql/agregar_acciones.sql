-- Agregar tabla acciones_pendientes a base existente
CREATE TABLE IF NOT EXISTS public.acciones_pendientes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    type TEXT NOT NULL,
    usuario_id UUID NOT NULL,
    payload JSONB NOT NULL,
    aplicado BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_acciones_timestamp ON public.acciones_pendientes(timestamp);
CREATE INDEX IF NOT EXISTS idx_acciones_aplicado ON public.acciones_pendientes(aplicado);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.acciones_pendientes TO web_anon;

SELECT 'Tabla acciones_pendientes creada' AS resultado;
