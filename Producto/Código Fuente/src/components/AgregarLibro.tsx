import { useState } from 'react';
import { PlusCircle, Loader2 } from 'lucide-react';

interface Props {
    onLibroAgregado: () => void;
}

export const AgregarLibro = ({ onLibroAgregado }: Props) => {
    const [loading, setLoading] = useState(false);
    const [libro, setLibro] = useState({ titulo: '', autor: '', isbn: '', stock: 1 });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            const response = await fetch(`${import.meta.env.VITE_LOCAL_API_URL}/libros`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Prefer': 'return=representation'
                },
                body: JSON.stringify(libro)
            });

            if (response.ok) {
                setLibro({ titulo: '', autor: '', isbn: '', stock: 1 });
                onLibroAgregado();
            }
        } catch (error) {
            console.error("Error al guardar:", error);
            alert("No se pudo conectar con el servidor local");
        } finally {
            setLoading(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm mb-8">
            <div className="flex items-center gap-2 mb-4 text-blue-600 dark:text-blue-400">
                <PlusCircle className="w-5 h-5" />
                <h3 className="font-bold text-lg">Nuevo Ingreso</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <input
                    type="text"
                    placeholder="Título del libro"
                    required
                    className="bg-slate-50 dark:bg-slate-800 border-none rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                    value={libro.titulo}
                    onChange={e => setLibro({ ...libro, titulo: e.target.value })}
                />
                <input
                    type="text"
                    placeholder="Autor"
                    className="bg-slate-50 dark:bg-slate-800 border-none rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                    value={libro.autor}
                    onChange={e => setLibro({ ...libro, autor: e.target.value })}
                />
                <input
                    type="text"
                    placeholder="ISBN"
                    className="bg-slate-50 dark:bg-slate-800 border-none rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                    value={libro.isbn}
                    onChange={e => setLibro({ ...libro, isbn: e.target.value })}
                />
                <button
                    type="submit"
                    disabled={loading}
                    className="bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg p-2.5 text-sm transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Registrar Libro'}
                </button>
            </div>
        </form>
    );
};