import { useState, useEffect } from 'react';

export const useConfig = () => {
    const [useLocal, setUseLocal] = useState(() => {
        const saved = localStorage.getItem('biblio_useLocal');
        return saved !== null ? JSON.parse(saved) : true;
    });

    useEffect(() => {
        localStorage.setItem('biblio_useLocal', JSON.stringify(useLocal));
    }, [useLocal]);

    const toggleUseLocal = () => setUseLocal(!useLocal);

    return { useLocal, setUseLocal, toggleUseLocal };
};
