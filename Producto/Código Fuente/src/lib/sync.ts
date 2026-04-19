import { supabase } from './supabase';

const syncCaratulaToSupabase = async (caratulaLocalUrl: string, isbn: string): Promise<string | null> => {
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);

        const response = await fetch(caratulaLocalUrl, { signal: controller.signal });
        clearTimeout(timeoutId);

        if (!response.ok) {
            console.warn("No se pudo descargar la imagen local para subir a Supabase");
            return null;
        }

        const blob = await response.blob();
        const fileName = `${isbn || 'sin-isbn'}-${Date.now()}.jpg`;

        const { error: uploadError } = await supabase
            .storage
            .from('caratulas')
            .upload(fileName, blob, {
                contentType: 'image/jpeg',
                upsert: false
            });

        if (uploadError) {
            console.warn("Error subiendo imagen a Supabase:", uploadError);
            return null;
        }

        const { data: { publicUrl } } = supabase
            .storage
            .from('caratulas')
            .getPublicUrl(fileName);

        return publicUrl;
    } catch (error) {
        console.warn("Error sincronizando carátula a Supabase:", error);
        return null;
    }
};

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
            // Quitamos el ID negativo temporal para que Supabase genere uno real
            const pendientesLimpios = librosPendientes.map(({ id, ...resto }) => resto);
            librosParaSincronizar = [...librosParaSincronizar, ...pendientesLimpios];
        }

        if (librosParaSincronizar.length === 0) return;

        // 3. Por cada libro, sincronizar carátula a Supabase si existe y no tiene URL de Supabase
        const librosConCaratulaUrl = await Promise.all(
            librosParaSincronizar.map(async (libro) => {
                let caratulaUrl = libro.caratula_url || null;

                // Si tiene carátula local y no tiene URL de Supabase, subirla
                if (libro.caratula && !caratulaUrl && libro.caratula.startsWith('http')) {
                    caratulaUrl = await syncCaratulaToSupabase(libro.caratula, libro.isbn);
                }

                return {
                    titulo: libro.titulo,
                    autor: libro.autor,
                    isbn: libro.isbn,
                    stock: libro.stock,
                    genero: libro.genero,
                    caratula: libro.caratula,
                    caratula_url: caratulaUrl
                };
            })
        );

        // 4. Subir todos los libros a Supabase
        const { error } = await supabase
            .from('libros')
            .upsert(librosConCaratulaUrl, { onConflict: 'isbn' });

        if (error) throw error;

        // 5. Si fue exitoso, limpiamos la cola offline
        if (librosPendientes.length > 0) {
            localStorage.removeItem('libros_pendientes');
        }

        console.log('✅ Sincronización con la nube exitosa');
    } catch (err) {
        console.error('❌ Falló la sincronización:', err);
    }
};