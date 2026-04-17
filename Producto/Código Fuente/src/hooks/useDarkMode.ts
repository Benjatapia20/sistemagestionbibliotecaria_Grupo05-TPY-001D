import { useEffect, useState } from 'react';

export function useDarkMode() {
    const [isDark, setIsDark] = useState(() => {
        // Revisar si el usuario ya tenía una preferencia guardada
        const saved = localStorage.getItem('theme');
        if (saved) return saved === 'dark';
        // Si no, revisar la preferencia del sistema operativo
        return window.matchMedia('(prefers-color-scheme: dark)').matches;
    });

    useEffect(() => {
        const root = window.document.documentElement;
        if (isDark) {
            root.classList.add('dark');
            localStorage.setItem('theme', 'dark');
        } else {
            root.classList.remove('dark');
            localStorage.setItem('theme', 'light');
        }
    }, [isDark]);

    return { isDark, toggleTheme: () => setIsDark(!isDark) };
}