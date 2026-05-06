import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

interface Favorito {
    id: string;
    usuario_id: string;
    libro_id: number;
}

export const useFavorites = (userId: string | undefined, useLocal: boolean) => {
    const [favoritos, setFavoritos] = useState<Set<number>>(new Set());
    const [loading, setLoading] = useState(false);

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
        
        // Optimistic UI Update
        setFavoritos(prev => {
            const next = new Set(prev);
            if (isFavorite) next.delete(libroId);
            else next.add(libroId);
            return next;
        });

        try {
            if (useLocal) {
                const localApi = import.meta.env.VITE_LOCAL_API_URL || 'http://localhost:3000';
                if (isFavorite) {
                    await fetch(`${localApi}/favoritos?usuario_id=eq.${userId}&libro_id=eq.${libroId}`, {
                        method: 'DELETE'
                    });
                } else {
                    await fetch(`${localApi}/favoritos`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ usuario_id: userId, libro_id: libroId })
                    });
                }
            } else {
                if (isFavorite) {
                    await supabase
                        .from('favoritos')
                        .delete()
                        .match({ usuario_id: userId, libro_id: libroId });
                } else {
                    await supabase
                        .from('favoritos')
                        .insert([{ usuario_id: userId, libro_id: libroId }]);
                }
            }
        } catch (error) {
            console.error('Error toggling favorite:', error);
            // Revert Optimistic Update on error
            setFavoritos(prev => {
                const next = new Set(prev);
                if (isFavorite) next.add(libroId);
                else next.delete(libroId);
                return next;
            });
        }
    };

    return {
        favoritos,
        toggleFavorite,
        loading
    };
};
