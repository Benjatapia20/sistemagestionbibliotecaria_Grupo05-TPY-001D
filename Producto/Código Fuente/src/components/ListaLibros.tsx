import { useEffect, useState } from 'react';

interface Libro {
    id: number;
    titulo: string;
    autor: string;
    isbn: string;
    stock: number;
}

interface Props {
    onDataLoaded?: (total: number) => void;
}

export const ListaLibros = ({ onDataLoaded }: Props) => {
    const [libros, setLibros] = useState<Libro[]>([]);
    const [loading, setLoading] = useState(true);

    const cargarLibros = async () => {
        try {

            const response = await fetch(`${import.meta.env.VITE_LOCAL_API_URL}/libros`);
            const data = await response.json();
            setLibros(data);
            if (onDataLoaded) {
                onDataLoaded(data.length);
            }
        } catch (error) {
            console.error("Error al conectar con el servidor local:", error);
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

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {libros.map((libro) => (
                    <div key={libro.id} className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 transition-colors duration-300">
                        <div className="flex justify-between items-start">
                            <div>
                                <h3 className="text-lg font-semibold text-slate-900 dark:text-white">{libro.titulo}</h3>
                                <p className="text-slate-600 dark:text-slate-400">{libro.autor}</p>
                            </div>
                            <span className="bg-green-100 text-green-800 text-xs font-medium px-2.5 py-0.5 rounded-full dark:bg-green-900 dark:text-green-300">
                                Stock: {libro.stock}
                            </span>
                        </div>
                        <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-700">
                            <p className="text-sm text-slate-500 dark:text-slate-500 font-mono">ISBN: {libro.isbn}</p>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};