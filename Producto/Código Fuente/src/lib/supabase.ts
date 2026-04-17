import { createClient } from '@supabase/supabase-js';

// Definimos los tipos de las variables de entorno para evitar errores de compilación
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!supabaseUrl || !supabaseKey) {
    throw new Error("Faltan las variables de entorno de Supabase. Revisa tu archivo .env");
}

export const supabase = createClient(supabaseUrl, supabaseKey);