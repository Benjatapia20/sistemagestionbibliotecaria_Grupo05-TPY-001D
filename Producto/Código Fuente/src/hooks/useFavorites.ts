import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useOfflineQueue } from './useOfflineQueue';

interface Favorito {
    id: string;
    usuario_id: string;
    libro_id: number;
}

export const useFavorites = (userId: string | undefined, useLocal: boolean) => {
    const [favoritos, setFavoritos] = useState<Set<number>>(new Set());
    const [loading, setLoading] = useState(false);
    const { addToQueue } = useOfflineQueue();

    const fetchFavoritos = useCallback(async () => {
        if (!userId) return;
        setLoading(true);

        try {
            if (useLocal) {
                const localApi = import.meta.env.VITE_LOCAL_API_URL || 'http://localhost:3000';
                const res = await fetch(`${localApi}/favoritos?usuario_id=eq.${userId}`);
                if (res.ok) {
                    const data: Favorito[] = await res.json();
                    setFavoritos(new Set(data.map(f => f.libro_id)));
                }
            } else {
                const { data, error } = await supabase
                    .from('favoritos')
                    .select('libro_id')
                    .eq('usuario_id', userId);
                
                if (!error && data) {
                    setFavoritos(new Set(data.map(f => f.libro_id)));
                }
            }
        } catch (error) {
            console.error('Error fetching favorites:', error);
        } finally {
            setLoading(false);
        }
    }, [userId, useLocal]);

    useEffect(() => {
        fetchFavoritos();
    }, [fetchFavoritos]);

    const toggleFavorite = async (libroId: number) => {
        if (!userId) return;

        const isFavorite = favoritos.has(libroId);
        
        setFavoritos(prev => {
            const next = new Set(prev);
            if (isFavorite) next.delete(libroId);
            else next.add(libroId);
            return next;
        });

        const localApi = import.meta.env.VITE_LOCAL_API_URL || 'http://localhost:3000';

        try {
            if (isFavorite) {
                const res = await fetch(`${localApi}/favoritos?usuario_id=eq.${userId}&libro_id=eq.${libroId}`, {
                    method: 'DELETE'
                });
                if (!res.ok) throw new Error('Local API error');
            } else {
                const res = await fetch(`${localApi}/favoritos`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ usuario_id: userId, libro_id: libroId })
                });
                if (!res.ok) throw new Error('Local API error');
            }

            // Guardar en acciones_pendientes para trazabilidad
            try {
                await fetch(`${localApi}/acciones_pendientes`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        type: 'toggle_favorite',
                        usuario_id: userId,
                        payload: { libro_id: libroId, is_favorite: !isFavorite },
                        aplicado: true
                    })
                });
            } catch {}
        } catch {
            // API local no disponible: encolar en localStorage y acciones_pendientes
            addToQueue({
                type: 'toggle_favorite',
                payload: { libroId, isFavorite },
                userId
            });

            try {
                await fetch(`${localApi}/acciones_pendientes`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        type: 'toggle_favorite',
                        usuario_id: userId,
                        payload: { libro_id: libroId, is_favorite: !isFavorite },
                        aplicado: false
                    })
                });
            } catch {}
        }
    };

    return {
        favoritos,
        toggleFavorite,
        loading
    };
};
