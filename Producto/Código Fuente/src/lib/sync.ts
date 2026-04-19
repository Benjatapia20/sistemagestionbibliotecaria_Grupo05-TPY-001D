import { supabase } from './supabase';

export const sincronizarConNube = async () => {
    try {
        // Obtener libros del servidor local (Docker)
        const resLocal = await fetch(`${import.meta.env.VITE_LOCAL_API_URL}/libros`);
        const librosLocales = await resLocal.json();

        if (librosLocales.length === 0) return;

        // 2. Subirlos a Supabase usando 'upsert'
        // El upsert usa el 'isbn' para saber si el libro ya existe y actualizarlo,
        // o crearlo si es nuevo.
        const { error } = await supabase
            .from('libros')
            .upsert(librosLocales, { onConflict: 'isbn' });

        if (error) throw error;

        console.log('✅ Sincronización con la nube exitosa');
    } catch (err) {
        console.error('❌ Falló la sincronización:', err);
    }
};