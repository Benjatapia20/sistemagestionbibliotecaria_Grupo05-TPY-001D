import { useState } from 'react';
import { Loader2, X } from 'lucide-react';

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
    libro: Libro;
    onGuardado: () => void;
    onCancel: () => void;
}

export const EditarLibro = ({ libro, onGuardado, onCancel }: Props) => {
    const [loading, setLoading] = useState(false);
    const [datos, setDatos] = useState({
        titulo: libro.titulo,
        autor: libro.autor || '',
        isbn: libro.isbn || '',
        stock: libro.stock,
        genero: libro.genero || ''
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);

        try {
            console.log('Editando libro en:', `${import.meta.env.VITE_LOCAL_API_URL}/libros?id=eq.${libro.id}`);

            const response = await fetch(`${import.meta.env.VITE_LOCAL_API_URL}/libros?id=eq.${libro.id}`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'Prefer': 'return=representation'
                },
                body: JSON.stringify(datos),
                signal: controller.signal
            });
            clearTimeout(timeoutId);

            console.log('Response status:', response.status);

            if (response.ok) {
                onGuardado();
            } else {
                throw new Error("Servidor local rechazó la petición");
            }
        } catch (error) {
            console.error("Error:", error);
            alert("No se pudo conectar al servidor local. Verifica que estés conectado a la red local.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-xl w-full">
            <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-xl text-slate-900 dark:text-white">Editar Libro</h3>
                <button type="button" onClick={onCancel} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                    <X className="w-6 h-6" />
                </button>
            </div>

            <div className="space-y-3">
                <input
                    type="text"
                    placeholder="Título"
                    required
                    className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-lg p-3 text-sm"
                    value={datos.titulo}
                    onChange={e => setDatos({ ...datos, titulo: e.target.value })}
                />
                <input
                    type="text"
                    placeholder="Autor"
                    className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-lg p-3 text-sm"
                    value={datos.autor}
                    onChange={e => setDatos({ ...datos, autor: e.target.value })}
                />
                <input
                    type="text"
                    placeholder="Género"
                    className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-lg p-3 text-sm"
                    value={datos.genero}
                    onChange={e => setDatos({ ...datos, genero: e.target.value })}
                />
                <div className="flex gap-2">
                    <input
                        type="text"
                        placeholder="ISBN"
                        className="flex-1 bg-slate-50 dark:bg-slate-800 border-none rounded-lg p-3 text-sm"
                        value={datos.isbn}
                        onChange={e => setDatos({ ...datos, isbn: e.target.value })}
                    />
                    <input
                        type="number"
                        min="0"
                        placeholder="Stock"
                        className="w-20 bg-slate-50 dark:bg-slate-800 border-none rounded-lg p-3 text-sm"
                        value={datos.stock}
                        onChange={e => setDatos({ ...datos, stock: parseInt(e.target.value) || 0 })}
                    />
                </div>
            </div>

            <button
                type="submit"
                disabled={loading}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg p-3 text-sm mt-4 disabled:opacity-50 flex items-center justify-center gap-2"
            >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Guardar Cambios'}
            </button>
        </form>
    );
};