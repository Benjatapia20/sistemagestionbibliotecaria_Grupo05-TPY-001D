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

export const sincronizarConNube = async (): Promise<{ success: boolean; message: string; queueProcessed?: number }> => {
    try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
            return { success: false, message: 'Debes verificar tu cuenta con correo para sincronizar.' };
        }

        const localApi = import.meta.env.VITE_LOCAL_API_URL;

        // 0. Procesar cola de localStorage primero
        let queueProcessed = 0;
        try {
            const saved = localStorage.getItem('biblio_offline_queue');
            if (saved) {
                const queue = JSON.parse(saved);
                if (queue.length > 0) {
                    console.log(`[Sync] Procesando ${queue.length} acciones pendientes (localStorage)...`);
                    const result = await processQueueDirect(queue, localApi);
                    queueProcessed = result.success;
                }
            }
        } catch (e) { console.warn('[Sync] Error cola localStorage:', e); }

        // 1. Procesar acciones_pendientes de la tabla local
        let accionesProcesadas = 0;
        try {
            const resAcc = await fetch(`${localApi}/acciones_pendientes?aplicado=eq.false&order=timestamp.asc`);
            if (resAcc.ok) {
                const acciones = await resAcc.json();
                if (acciones.length > 0) {
                    console.log(`[Sync] Procesando ${acciones.length} acciones de la tabla...`);
                    for (const acc of acciones) {
                        try {
                            const ok = await executeTableAction(acc, localApi);
                            if (ok) {
                                await fetch(`${localApi}/acciones_pendientes?id=eq.${acc.id}`, {
                                    method: 'PATCH',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ aplicado: true })
                                });
                                accionesProcesadas++;
                            }
                        } catch (e) { console.warn(`[Sync] Error acción ${acc.id}:`, e); }
                    }
                }
            }
        } catch (e) { console.warn('[Sync] Error procesando acciones:', e); }

        let librosParaSincronizar: any[] = [];
        let servidorLocalDisponible = false;
        let librosSubidos = 0;
        let usuariosSincronizados = 0;
        let favoritosSincronizados = 0;
        let prestamosSincronizados = 0;

        try {
            // A. Sincronizar Usuarios, Favoritos y Préstamos primero
            usuariosSincronizados = await sincronizarUsuarios();
            favoritosSincronizados = await sincronizarFavoritos();
            prestamosSincronizados = await sincronizarPrestamos();

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
            message: `Sync exitoso: ${librosSubidos} libros, ${usuariosSincronizados} usuarios, ${favoritosSincronizados} favoritos, ${prestamosSincronizados} préstamos.${accionesProcesadas > 0 ? ` ${accionesProcesadas} acciones aplicadas.` : ''}${queueProcessed > 0 ? ` ${queueProcessed} pendientes de cola.` : ''}`,
            queueProcessed: queueProcessed + accionesProcesadas
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
        const res = await fetch(`${localApi}/usuarios`);
        const usuariosLocales = await res.json();

        if (!usuariosLocales || usuariosLocales.length === 0) return 0;

        for (const usuario of usuariosLocales) {
            console.log(`[Sync] Sincronizando usuario: ${usuario.username}`);
            const { error } = await supabase
                .from('usuarios')
                .upsert({
                    id: usuario.id,
                    username: usuario.username,
                    email: usuario.email,
                    rol: usuario.rol,
                    tipo_auth: usuario.tipo_auth,
                    auth_ref_id: usuario.auth_ref_id,
                    activo: usuario.activo,
                    created_at: usuario.created_at
                }, { onConflict: 'id' });
            
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
}

async function sincronizarFavoritos(): Promise<number> {
    const localApi = import.meta.env.VITE_LOCAL_API_URL;
    let sincronizados = 0;

    try {
        const res = await fetch(`${localApi}/favoritos`);
        if (!res.ok) return 0;
        
        const favoritosLocales = await res.json();
        if (!favoritosLocales || favoritosLocales.length === 0) return 0;

        console.log(`[Sync] Sincronizando ${favoritosLocales.length} favoritos...`);
        
        const { error } = await supabase
            .from('favoritos')
            .upsert(
                favoritosLocales.map((fav: any) => ({
                    id: fav.id,
                    usuario_id: fav.usuario_id,
                    libro_id: fav.libro_id,
                    created_at: fav.created_at
                })), 
                { onConflict: 'usuario_id,libro_id' }
            );
        
        if (error) {
            console.error(`[Sync] Error sincronizando favoritos:`, error.message);
        } else {
            sincronizados = favoritosLocales.length;
        }
    } catch (e) {
        console.error("Error sincronizando favoritos:", e);
    }

    return sincronizados;
}

async function sincronizarPrestamos(): Promise<number> {
    const localApi = import.meta.env.VITE_LOCAL_API_URL;
    let sincronizados = 0;

    try {
        const res = await fetch(`${localApi}/prestamos`);
        if (!res.ok) return 0;
        
        const prestamosLocales = await res.json();
        if (!prestamosLocales || prestamosLocales.length === 0) return 0;

        console.log(`[Sync] Sincronizando ${prestamosLocales.length} préstamos...`);
        
        for (const prestamo of prestamosLocales) {
            const { error } = await supabase
                .from('prestamos')
                .upsert({
                    id: prestamo.id,
                    usuario_id: prestamo.usuario_id,
                    libro_id: prestamo.libro_id,
                    estado: prestamo.estado,
                    fecha_solicitud: prestamo.fecha_solicitud,
                    fecha_aprobacion: prestamo.fecha_aprobacion,
                    fecha_devolucion_esperada: prestamo.fecha_devolucion_esperada,
                    fecha_devolucion_real: prestamo.fecha_devolucion_real,
                    multa: prestamo.multa,
                    multa_pagada: prestamo.multa_pagada,
                    observaciones: prestamo.observaciones,
                    estado_libro_devolucion: prestamo.estado_libro_devolucion,
                    created_at: prestamo.created_at
                }, { onConflict: 'id' });
            
            if (error) {
                console.error(`[Sync] Error sincronizando préstamo ${prestamo.id}:`, error.message);
            } else {
                sincronizados++;
            }
        }
    } catch (e) {
        console.error("Error sincronizando préstamos:", e);
    }

    return sincronizados;
}

interface QueueItem {
    id: string;
    type: string;
    payload: any;
    userId: string;
    timestamp: number;
}

async function processQueueDirect(queue: QueueItem[], localApi: string): Promise<{ success: number; failed: number }> {
    let success = 0;
    let failed = 0;
    const remaining: QueueItem[] = [];

    for (const action of queue) {
        try {
            const headers = { 'Content-Type': 'application/json' };
            let ok = false;

            switch (action.type) {
                case 'toggle_favorite': {
                    const { libroId, isFavorite } = action.payload;
                    if (isFavorite) {
                        const res = await fetch(`${localApi}/favoritos?usuario_id=eq.${action.userId}&libro_id=eq.${libroId}`, { method: 'DELETE' });
                        ok = res.ok;
                    } else {
                        const res = await fetch(`${localApi}/favoritos`, {
                            method: 'POST', headers,
                            body: JSON.stringify({ usuario_id: action.userId, libro_id: libroId })
                        });
                        ok = res.ok;
                    }
                    break;
                }
                case 'solicitar_prestamo': {
                    const res = await fetch(`${localApi}/prestamos`, {
                        method: 'POST',
                        headers: { ...headers, 'Prefer': 'return=representation' },
                        body: JSON.stringify(action.payload.prestamo)
                    });
                    ok = res.ok;
                    break;
                }
                case 'aprobar_prestamo':
                case 'rechazar_prestamo':
                case 'solicitar_devolucion':
                case 'aprobar_devolucion':
                case 'rechazar_devolucion':
                case 'solicitar_renovacion':
                case 'aprobar_renovacion':
                case 'rechazar_renovacion': {
                    const { prestamoId, updates } = action.payload;
                    const res = await fetch(`${localApi}/prestamos?id=eq.${prestamoId}`, {
                        method: 'PATCH', headers,
                        body: JSON.stringify(updates)
                    });
                    ok = res.ok;
                    break;
                }
            }

            if (ok) {
                success++;
            } else {
                failed++;
                remaining.push(action);
            }
        } catch {
            failed++;
            remaining.push(action);
        }
    }

    localStorage.setItem('biblio_offline_queue', JSON.stringify(remaining));
    return { success, failed };
}

async function executeTableAction(acc: any, localApi: string): Promise<boolean> {
    const headers = { 'Content-Type': 'application/json' };
    const payload = acc.payload;
    const rpc = async (fn: string, body: Record<string, any>) => {
        const res = await fetch(`${localApi}/rpc/${fn}`, { method: 'POST', headers, body: JSON.stringify(body) });
        return res.ok;
    };

    switch (acc.type) {
        case 'toggle_favorite': {
            const { libro_id, is_favorite } = payload;
            if (is_favorite) {
                const res = await fetch(`${localApi}/favoritos?usuario_id=eq.${acc.usuario_id}&libro_id=eq.${libro_id}`, { method: 'DELETE' });
                return res.ok;
            }
            const res = await fetch(`${localApi}/favoritos`, { method: 'POST', headers, body: JSON.stringify({ usuario_id: acc.usuario_id, libro_id: libro_id }) });
            return res.ok;
        }
        case 'solicitar_prestamo': {
            const res = await fetch(`${localApi}/prestamos`, { method: 'POST', headers: { ...headers, 'Prefer': 'return=representation' }, body: JSON.stringify(payload.prestamo) });
            return res.ok;
        }
        case 'aprobar_prestamo':
            return rpc('aprobar_prestamo_op', { prestamo_id: payload.prestamoId || payload.prestamo_id });
        case 'rechazar_prestamo':
            return rpc('rechazar_prestamo_op', { prestamo_id: payload.prestamoId || payload.prestamo_id });
        case 'solicitar_devolucion':
            return rpc('solicitar_devolucion_op', { prestamo_id: payload.prestamoId || payload.prestamo_id, p_estado_libro: payload.estadoLibro || 'buen_estado', p_observaciones: '' });
        case 'aprobar_devolucion':
            return rpc('aprobar_devolucion_op', { prestamo_id: payload.prestamoId || payload.prestamo_id, p_multa: payload.multa || 0 });
        case 'rechazar_devolucion':
            return rpc('rechazar_devolucion_op', { prestamo_id: payload.prestamoId || payload.prestamo_id });
        case 'solicitar_renovacion':
            return rpc('solicitar_renovacion_op', { prestamo_id: payload.prestamoId || payload.prestamo_id });
        case 'aprobar_renovacion':
            return rpc('aprobar_renovacion_op', { prestamo_id: payload.prestamoId || payload.prestamo_id });
        case 'rechazar_renovacion':
            return rpc('rechazar_renovacion_op', { prestamo_id: payload.prestamoId || payload.prestamo_id });
        default: return false;
    }
}
