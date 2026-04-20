import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

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
    onDataLoaded?: (total: number) => void;
}

export const ListaLibros = ({ onDataLoaded }: Props) => {
    const [libros, setLibros] = useState<Libro[]>([]);
    const [loading, setLoading] = useState(true);
    const [localServerOnline, setLocalServerOnline] = useState<boolean | null>(null);

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
            setLocalServerOnline(true);
            if (onDataLoaded) {
                onDataLoaded(data.length);
            }
        } catch (error) {
            console.warn("Servidor local no disponible, cargando desde Supabase...", error);
            setLocalServerOnline(false);
            try {
                const { data: supabaseData, error: supabaseError } = await supabase
                    .from('libros')
                    .select('*')
                    .order('id', { ascending: false });

                if (supabaseError) throw supabaseError;

                let dataToSet = supabaseData || [];

                setLibros(dataToSet);
                if (onDataLoaded) onDataLoaded(dataToSet.length);
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

    if (loading) return <div className="p-8 text-center dark:text-white">Cargando biblioteca...</div>;

    return (
        <div className="p-4 md:p-8">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-slate-800 dark:text-white">Inventario de Libros</h2>
                <button
                    onClick={cargarLibros}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors"
                >
                    Actualizar
                </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {libros.map((libro) => (
                    <div key={libro.id} className="bg-white dark:bg-slate-800 p-5 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 transition-all hover:shadow-md flex flex-col sm:flex-row gap-5">

                        {/* Carátula */}
                        {libro.caratula || libro.caratula_url ? (
                            <div className="w-full sm:w-28 h-40 shrink-0 rounded-xl overflow-hidden border border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 flex items-center justify-center">
                                <img 
                                    src={localServerOnline ? (libro.caratula || '') : (libro.caratula_url || libro.caratula || '')} 
                                    alt={`Carátula de ${libro.titulo}`} 
                                    className="object-cover w-full h-full"
                                />
                            </div>
                        ) : (
                            <div className="w-full sm:w-28 h-40 shrink-0 rounded-xl border border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 flex flex-col items-center justify-center text-slate-300 dark:text-slate-600">
                                <svg className="w-10 h-10 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                                </svg>
                                <span className="text-[10px] uppercase font-bold tracking-wider">Sin portada</span>
                            </div>
                        )}

                        {/* Información del Libro */}
                        <div className="flex-1 flex flex-col min-w-0">
                            <div className="flex justify-between items-start gap-4 mb-1">
                                <div className="min-w-0">
                                    <h3 className="text-xl font-bold text-slate-900 dark:text-white leading-tight truncate" title={libro.titulo}>
                                        {libro.titulo}
                                    </h3>
                                    <p className="text-slate-500 dark:text-slate-400 font-medium truncate mt-0.5">{libro.autor}</p>
                                </div>
                                <span className="bg-green-100 text-green-800 text-xs font-bold px-3 py-1 rounded-lg dark:bg-green-900 dark:text-green-300 whitespace-nowrap border border-green-200 dark:border-green-800">
                                    Stock: {libro.stock}
                                </span>
                            </div>

                            {libro.genero && (
                                <div className="mt-2">
                                    <span className="inline-block bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 text-xs font-semibold px-2.5 py-1 rounded-md">
                                        {libro.genero}
                                    </span>
                                </div>
                            )}

                            <div className="mt-auto pt-4 flex items-center justify-between border-t border-slate-100 dark:border-slate-700/50">
                                <span className="text-xs font-mono text-slate-400 dark:text-slate-500">ISBN: {libro.isbn}</span>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};