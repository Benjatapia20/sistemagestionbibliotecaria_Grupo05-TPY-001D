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

    const getImagenSrc = (libro: Libro) => {
        return localServerOnline ? (libro.caratula || '') : (libro.caratula_url || libro.caratula || '');
    };

    if (loading) return (
        <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600"></div>
        </div>
    );

    return (
        <div className="p-4 md:p-8">
            {/* Título */}
            <div className="mb-8">
                <h2 className="text-3xl font-bold text-slate-900 dark:text-white">Mi Biblioteca</h2>
                <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">{libros.length} libros disponibles</p>
            </div>

            {/* Grid de portadas estilo Netflix */}
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 gap-4">
                {libros.map((libro) => (
                    <div 
                        key={libro.id} 
                        className="group cursor-pointer"
                    >
                        {/* Portada */}
                        <div className="relative aspect-[2/3] rounded-md overflow-hidden bg-slate-200 dark:bg-slate-800">
                            {getImagenSrc(libro) ? (
                                <img 
                                    src={getImagenSrc(libro)} 
                                    alt={libro.titulo}
                                    className="w-full h-full object-cover"
                                />
                            ) : (
                                <div className="w-full h-full bg-slate-300 dark:bg-slate-700 flex items-center justify-center">
                                    <span className="text-3xl">📚</span>
                                </div>
                            )}
                            
                            {/* Info overlay */}
                            <div className="absolute inset-0 bg-black/80 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex flex-col justify-end p-3">
                                <h3 className="text-white font-bold text-sm leading-tight line-clamp-2">
                                    {libro.titulo}
                                </h3>
                                <p className="text-gray-300 text-xs mt-1 line-clamp-1">
                                    {libro.autor}
                                </p>
                                <span className={`text-xs mt-2 ${libro.stock > 0 ? 'text-green-400' : 'text-red-400'}`}>
                                    {libro.stock > 0 ? `${libro.stock} disponibles` : 'Agotado'}
                                </span>
                            </div>
                        </div>

                        {/* Título debajo */}
                        <div className="mt-2">
                            <h3 className="text-slate-900 dark:text-white text-sm font-medium line-clamp-1">{libro.titulo}</h3>
                        </div>
                    </div>
                ))}
            </div>

            {libros.length === 0 && (
                <div className="flex flex-col items-center justify-center h-64 text-slate-500 dark:text-slate-400">
                    <span className="text-5xl mb-4">📚</span>
                    <p className="text-lg">No hay libros en tu biblioteca</p>
                </div>
            )}
        </div>
    );
};