import { supabase } from './supabase';

const syncCaratulaToSupabase = async (caratulaLocalPath: string): Promise<string | null> => {
    try {
        const fileName = caratulaLocalPath.split('/').pop();
        if (!fileName) return null;

        const imagesBaseUrl = import.meta.env.VITE_IMAGES_URL || `http://${window.location.hostname}:3001`;
        const fullLocalUrl = caratulaLocalPath.startsWith('http') ? caratulaLocalPath : `${imagesBaseUrl}${caratulaLocalPath}`;

        console.log(`[Storage] Intentando descargar desde: ${fullLocalUrl}`);

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);
        const response = await fetch(fullLocalUrl, { signal: controller.signal });
        clearTimeout(timeoutId);

        if (!response.ok) {
            console.error(`[Storage] No se pudo descargar la imagen local: ${fullLocalUrl}`);
            return null;
        }

        const blob = await response.blob();

        const { error: uploadError } = await supabase
            .storage
            .from('caratulas')
            .upload(fileName, blob, {
                contentType: 'image/jpeg',
                upsert: true
            });

        if (uploadError) {
            console.error("[Storage] Error en upload:", uploadError);
            return null;
        }

        const { data: { publicUrl } } = supabase
            .storage
            .from('caratulas')
            .getPublicUrl(fileName);

        return publicUrl;
    } catch (error) {
        console.warn("[Storage] Error crítico:", error);
        return null;
    }
};

export const sincronizarConNube = async (): Promise<{ success: boolean; message: string }> => {
    try {
        let librosParaSincronizar: any[] = [];
        let servidorLocalDisponible = false;

        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 3000);
            const resLocal = await fetch(`${import.meta.env.VITE_LOCAL_API_URL}/libros`, { signal: controller.signal });
            clearTimeout(timeoutId);

            if (resLocal.ok) {
                librosParaSincronizar = await resLocal.json();
                servidorLocalDisponible = true;
            }
        } catch (e) {
            console.warn('⚠️ Servidor local offline');
        }

        if (!servidorLocalDisponible) return { success: false, message: 'Servidor local no disponible.' };
        if (librosParaSincronizar.length === 0) return { success: true, message: 'Nada que sincronizar.' };

        const librosActualizados = await Promise.all(
            librosParaSincronizar.map(async (libro) => {
                let caratulaUrl = libro.caratula_url || null;
                const pathCaratula = libro.caratula || '';
                const nombreArchivoLocal = pathCaratula.split('/').pop();

                if (!pathCaratula) return { ...libro, caratula_url: caratulaUrl };

                const yaEstaEnSupabase = caratulaUrl && nombreArchivoLocal && caratulaUrl.includes(nombreArchivoLocal);

                const esRutaLocal = !pathCaratula.startsWith('http') || pathCaratula.includes('192.168.');
                const necesitaSubir = esRutaLocal && !yaEstaEnSupabase;

                if (necesitaSubir) {
                    console.log(`🚀 Sincronizando carátula de "${libro.titulo}"`);
                    const nuevaUrl = await syncCaratulaToSupabase(pathCaratula);
                    if (nuevaUrl) caratulaUrl = nuevaUrl;
                }

                return { ...libro, caratula_url: caratulaUrl };
            })
        );

        const { error: errorSupabase } = await supabase
            .from('libros')
            .upsert(librosActualizados, { onConflict: 'id' });

        if (errorSupabase) throw errorSupabase;

        for (const libro of librosActualizados) {
            try {
                await fetch(`${import.meta.env.VITE_LOCAL_API_URL}/libros?id=eq.${libro.id}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ caratula_url: libro.caratula_url })
                });
            } catch (e) { }
        }

        return { success: true, message: 'Sincronización exitosa' };
    } catch (err) {
        console.error('❌ Error:', err);
        return { success: false, message: 'Error al sincronizar' };
    }
};
