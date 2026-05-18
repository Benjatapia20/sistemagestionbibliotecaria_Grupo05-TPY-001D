import { useState, useEffect, useCallback, useRef } from 'react';

export const useSyncConfig = () => {
    const [autoSync, setAutoSync] = useState(() => {
        return localStorage.getItem('biblio_autoSync') !== 'false';
    });

    const [syncInterval, setSyncInterval] = useState(() => {
        const saved = localStorage.getItem('biblio_syncInterval');
        return saved ? parseInt(saved) : 5;
    });

    const [lastSync, setLastSync] = useState<Date | null>(() => {
        const saved = localStorage.getItem('biblio_lastSync');
        return saved ? new Date(saved) : null;
    });

    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

    useEffect(() => {
        localStorage.setItem('biblio_autoSync', String(autoSync));
    }, [autoSync]);

    useEffect(() => {
        localStorage.setItem('biblio_syncInterval', String(syncInterval));
    }, [syncInterval]);

    const markSynced = useCallback(() => {
        const now = new Date();
        setLastSync(now);
        localStorage.setItem('biblio_lastSync', now.toISOString());
    }, []);

    const toggleAutoSync = useCallback(() => {
        setAutoSync(prev => !prev);
    }, []);

    const changeInterval = useCallback((minutes: number) => {
        setSyncInterval(Math.max(1, Math.min(60, minutes)));
    }, []);

    return {
        autoSync,
        toggleAutoSync,
        syncInterval,
        changeInterval,
        lastSync,
        markSynced,
        timerRef
    };
};
