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
        let librosSubidos = 0;
        let usuariosSincronizados = 0;

        const localApi = import.meta.env.VITE_LOCAL_API_URL;

        try {
            // A. Sincronizar Usuarios primero
            usuariosSincronizados = await sincronizarUsuarios();

            // B. Obtener libros locales
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 3000);
            const resLocal = await fetch(`${localApi}/libros`, { signal: controller.signal });
            clearTimeout(timeoutId);

            if (resLocal.ok) {
                librosParaSincronizar = await resLocal.json();
                servidorLocalDisponible = true;
            }
        } catch (e) {
            console.warn('⚠️ Servidor local offline');
        }

        if (!servidorLocalDisponible) return { success: false, message: 'Servidor local no disponible.' };
        if (librosParaSincronizar.length === 0) return { success: true, message: `Nada que sincronizar. Usuarios sincronizados: ${usuariosSincronizados}` };

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
        librosSubidos = librosActualizados.length;

        for (const libro of librosActualizados) {
            try {
                await fetch(`${localApi}/libros?id=eq.${libro.id}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ caratula_url: libro.caratula_url })
                });
            } catch (e) { }
        }

        return {
            success: true,
            message: `Sincronización exitosa: ${librosSubidos} libros actualizados y ${usuariosSincronizados} usuarios sincronizados.`,
        };
    } catch (error: any) {
        console.error("Error crítico en la sincronización:", error);
        return {
            success: false,
            message: `Error: ${error.message}`,
        };
    }
};

async function sincronizarUsuarios(): Promise<number> {
    const localApi = import.meta.env.VITE_LOCAL_API_URL;
    let sincronizados = 0;

    try {
        const res = await fetch(`${localApi}/cuentas_temporales`);
        const usuariosLocales = await res.json();

        if (!usuariosLocales || usuariosLocales.length === 0) return 0;

        for (const usuario of usuariosLocales) {
            console.log(`[Sync] Sincronizando usuario: ${usuario.username}`);
            const { error } = await supabase
                .from('cuentas_temporales')
                .upsert({
                    username: usuario.username,
                    password: usuario.password,
                    rol: usuario.rol,
                    created_at: usuario.created_at
                }, { onConflict: 'username' });
            
            if (error) {
                console.error(`[Sync] Error con usuario ${usuario.username}:`, error.message);
            } else {
                sincronizados++;
            }
        }
    } catch (e) {
        console.error("Error sincronizando usuarios:", e);
    }

    return sincronizados;
};
