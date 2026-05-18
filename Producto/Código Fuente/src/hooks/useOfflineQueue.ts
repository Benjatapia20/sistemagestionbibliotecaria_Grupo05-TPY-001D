import { useState, useCallback } from 'react';

export interface QueuedAction {
    id: string;
    type: 'toggle_favorite' | 'solicitar_prestamo' | 'aprobar_prestamo' | 'rechazar_prestamo' |
          'solicitar_devolucion' | 'aprobar_devolucion' | 'rechazar_devolucion' |
          'solicitar_renovacion' | 'aprobar_renovacion' | 'rechazar_renovacion';
    payload: any;
    userId: string;
    timestamp: number;
}

const STORAGE_KEY = 'biblio_offline_queue';

export const useOfflineQueue = () => {
    const [queueCount, setQueueCount] = useState(() => {
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            return saved ? JSON.parse(saved).length : 0;
        } catch {
            return 0;
        }
    });

    const getQueue = useCallback((): QueuedAction[] => {
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            return saved ? JSON.parse(saved) : [];
        } catch {
            return [];
        }
    }, []);

    const addToQueue = useCallback((action: Omit<QueuedAction, 'id' | 'timestamp'>) => {
        const queue = getQueue();
        const newAction: QueuedAction = {
            ...action,
            id: `q-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            timestamp: Date.now()
        };
        queue.push(newAction);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
        setQueueCount(queue.length);
        return newAction;
    }, [getQueue]);

    const removeFromQueue = useCallback((actionId: string) => {
        const queue = getQueue().filter(a => a.id !== actionId);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
        setQueueCount(queue.length);
    }, [getQueue]);

    const clearQueue = useCallback(() => {
        localStorage.removeItem(STORAGE_KEY);
        setQueueCount(0);
    }, []);

    const processQueue = useCallback(async (localApi: string): Promise<{ success: number; failed: number }> => {
        const queue = getQueue();
        if (queue.length === 0) return { success: 0, failed: 0 };

        let success = 0;
        let failed = 0;
        const remaining: QueuedAction[] = [];

        for (const action of queue) {
            try {
                const ok = await executeQueuedAction(action, localApi);
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

        localStorage.setItem(STORAGE_KEY, JSON.stringify(remaining));
        setQueueCount(remaining.length);
        return { success, failed };
    }, [getQueue]);

    return {
        queueCount,
        addToQueue,
        removeFromQueue,
        clearQueue,
        processQueue,
        getQueue
    };
};

async function executeQueuedAction(action: QueuedAction, localApi: string): Promise<boolean> {
    const headers = { 'Content-Type': 'application/json' };

    switch (action.type) {
        case 'toggle_favorite': {
            const { libroId, isFavorite } = action.payload;
            if (isFavorite) {
                const res = await fetch(`${localApi}/favoritos?usuario_id=eq.${action.userId}&libro_id=eq.${libroId}`, { method: 'DELETE' });
                return res.ok;
            } else {
                const res = await fetch(`${localApi}/favoritos`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({ usuario_id: action.userId, libro_id: libroId })
                });
                return res.ok;
            }
        }

        case 'solicitar_prestamo': {
            const res = await fetch(`${localApi}/prestamos`, {
                method: 'POST',
                headers: { ...headers, 'Prefer': 'return=representation' },
                body: JSON.stringify(action.payload.prestamo)
            });
            return res.ok;
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
                method: 'PATCH',
                headers,
                body: JSON.stringify(updates)
            });
            return res.ok;
        }

        default:
            return false;
    }
}
