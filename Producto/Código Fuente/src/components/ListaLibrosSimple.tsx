import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Edit2 } from 'lucide-react';

interface Libro {
    id: number;
    titulo: string;
    autor: string;
    isbn: string;
    stock: number;
    genero?: string;
    caratula?: string;
    caratula_url?: string;
}

interface Props {
    onEditar?: (libro: Libro) => void;
}

export const ListaLibrosSimple = ({ onEditar }: Props) => {
    const [libros, setLibros] = useState<Libro[]>([]);
    const [loading, setLoading] = useState(true);

    const cargarLibros = async () => {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000);

        try {
            const response = await fetch(`${import.meta.env.VITE_LOCAL_API_URL}/libros`, {
                signal: controller.signal
            });
            clearTimeout(timeoutId);
            if (!response.ok) throw new Error("Servidor local no disponible");
            const data = await response.json();
            setLibros(data);
        } catch (error) {
            console.warn("Servidor local no disponible, cargando desde Supabase...", error);
            try {
                const { data: supabaseData, error: supabaseError } = await supabase
                    .from('libros')
                    .select('*')
                    .order('id', { ascending: false });

                if (supabaseError) throw supabaseError;
                setLibros(supabaseData || []);
            } catch (fallbackError) {
                console.error("No se pudo conectar a ninguna base de datos:", fallbackError);
            }
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        cargarLibros();
    }, []);

    if (loading) return <div className="p-4 text-center dark:text-white">Cargando...</div>;

    return (
        <div className="space-y-2">
            {libros.map((libro) => (
                <div key={libro.id} className="flex items-center justify-between p-3 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
                    <div className="flex-1 min-w-0">
                        <p className="font-semibold text-slate-900 dark:text-white truncate">{libro.titulo}</p>
                        <p className="text-sm text-slate-500 dark:text-slate-400 truncate">{libro.autor}</p>
                    </div>
                    <button
                        onClick={() => onEditar?.(libro)}
                        className="ml-3 p-2 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-colors"
                    >
                        <Edit2 className="w-4 h-4" />
                    </button>
                </div>
            ))}
            {libros.length === 0 && (
                <p className="text-center text-slate-500 dark:text-slate-400 py-4">No hay libros registrados</p>
            )}
        </div>
    );
};
