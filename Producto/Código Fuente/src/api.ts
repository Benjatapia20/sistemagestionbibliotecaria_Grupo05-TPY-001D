const LOCAL_URL = import.meta.env.VITE_LOCAL_API_URL;

export const getLibros = async () => {
    try {
        // servidor local
        const response = await fetch(`${LOCAL_URL}/libros`);
        if (!response.ok) throw new Error('Servidor local no responde');

        console.log('Datos cargados desde el servidor local 🏠');
        return await response.json();
    } catch (error) {
        // Supabase o Caché
        console.warn('Servidor local offline, intentando alternativa...');

        return [];
    }
};