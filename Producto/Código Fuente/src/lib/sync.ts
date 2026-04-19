import { supabase } from './supabase';

export const sincronizarConNube = async () => {
    try {
        let librosParaSincronizar: any[] = [];

        // 1. Obtener libros del servidor local (Docker) si está online
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 3000);
            const resLocal = await fetch(`${import.meta.env.VITE_LOCAL_API_URL}/libros`, { signal: controller.signal });
            clearTimeout(timeoutId);

            if (resLocal.ok) {
                const librosLocales = await resLocal.json();
                librosParaSincronizar = [...librosLocales];
            }
        } catch (e) {
            console.warn('Servidor local inaccesible durante sincronización');
        }

        // 2. Obtener libros guardados offline en la PWA
        const pendientesStr = localStorage.getItem('libros_pendientes');
        let librosPendientes: any[] = [];
        if (pendientesStr) {
            librosPendientes = JSON.parse(pendientesStr);
            // Quitamos el ID negativo temporal para que Supabase genere uno real o inserte limpio
            const pendientesLimpios = librosPendientes.map(({ id, ...resto }) => resto);
            librosParaSincronizar = [...librosParaSincronizar, ...pendientesLimpios];
        }

        if (librosParaSincronizar.length === 0) return;

        // 3. Subir todos los libros a Supabase
        const { error } = await supabase
            .from('libros')
            .upsert(librosParaSincronizar, { onConflict: 'isbn' });

        if (error) throw error;

        // 4. Si fue exitoso, limpiamos la cola offline del celular
        if (librosPendientes.length > 0) {
            localStorage.removeItem('libros_pendientes');
        }

        console.log('✅ Sincronización con la nube exitosa');
    } catch (err) {
        console.error('❌ Falló la sincronización:', err);
    }
};