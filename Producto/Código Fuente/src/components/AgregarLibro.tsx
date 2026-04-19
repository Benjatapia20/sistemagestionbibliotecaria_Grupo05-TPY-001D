import { useState } from 'react';
import { PlusCircle, Loader2, X } from 'lucide-react';

interface Props {
    onLibroAgregado: () => void;
    onCancel?: () => void;
}

export const AgregarLibro = ({ onLibroAgregado, onCancel }: Props) => {
    const [loading, setLoading] = useState(false);
    const [libro, setLibro] = useState({ titulo: '', autor: '', isbn: '', stock: 1, genero: '', caratula: '' });

    const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setLibro(prev => ({ ...prev, caratula: reader.result as string }));
            };
            reader.readAsDataURL(file);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000); // 3 segundos máximo

        try {
            let caratulaFinal = libro.caratula;

            // Si la carátula es un Base64 (imagen nueva seleccionada), la subimos al nuevo servidor
            if (caratulaFinal && caratulaFinal.startsWith('data:image')) {
                const uploadResponse = await fetch(`http://${window.location.hostname}:3001/upload`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ base64Image: caratulaFinal }),
                    signal: controller.signal
                });

                if (uploadResponse.ok) {
                    const uploadData = await uploadResponse.json();
                    // Usamos la URL que nos devuelve el servidor para guardar en la BD
                    caratulaFinal = `http://${window.location.hostname}:3001${uploadData.url}`;
                } else {
                    console.warn("No se pudo subir la imagen al servidor 3001");
                }
            }

            const libroFinal = { ...libro, caratula: caratulaFinal };

            const response = await fetch(`${import.meta.env.VITE_LOCAL_API_URL}/libros`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Prefer': 'return=representation'
                },
                body: JSON.stringify(libroFinal),
                signal: controller.signal
            });
            clearTimeout(timeoutId);

            if (response.ok) {
                setLibro({ titulo: '', autor: '', isbn: '', stock: 1, genero: '', caratula: '' });
                onLibroAgregado();
            } else {
                throw new Error("Servidor local rechazó la petición");
            }
        } catch (error) {
            console.warn("Servidor local no disponible, guardando en dispositivo offline...", error);

            // Cola Offline: Guardar en localStorage
            const pendientesStr = localStorage.getItem('libros_pendientes');
            const pendientes = pendientesStr ? JSON.parse(pendientesStr) : [];

            // Asignamos un ID temporal negativo solo para el renderizado visual
            const nuevoLibroOffline = { ...libro, id: -Date.now() };
            pendientes.push(nuevoLibroOffline);
            localStorage.setItem('libros_pendientes', JSON.stringify(pendientes));

            alert("Estás sin conexión al servidor principal. El libro se ha guardado en tu dispositivo y se sincronizará cuando haya internet.");
            setLibro({ titulo: '', autor: '', isbn: '', stock: 1, genero: '', caratula: '' });
            onLibroAgregado();
        } finally {
            setLoading(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-xl w-full">
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400">
                    <PlusCircle className="w-6 h-6" />
                    <h3 className="font-bold text-xl">Nuevo Ingreso</h3>
                </div>
                {onCancel && (
                    <button
                        type="button"
                        onClick={onCancel}
                        className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors p-1"
                    >
                        <X className="w-6 h-6" />
                    </button>
                )}
            </div>

            <div className="flex flex-col gap-4">
                <input
                    type="text"
                    placeholder="Título del libro"
                    required
                    className="bg-slate-50 dark:bg-slate-800 border-none rounded-lg p-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-shadow"
                    value={libro.titulo}
                    onChange={e => setLibro({ ...libro, titulo: e.target.value })}
                />
                <input
                    type="text"
                    placeholder="Autor"
                    className="bg-slate-50 dark:bg-slate-800 border-none rounded-lg p-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-shadow"
                    value={libro.autor}
                    onChange={e => setLibro({ ...libro, autor: e.target.value })}
                />
                <input
                    type="text"
                    placeholder="Género literario"
                    className="bg-slate-50 dark:bg-slate-800 border-none rounded-lg p-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-shadow"
                    value={libro.genero}
                    onChange={e => setLibro({ ...libro, genero: e.target.value })}
                />
                <div className="flex gap-4">
                    <input
                        type="text"
                        placeholder="ISBN"
                        className="flex-1 bg-slate-50 dark:bg-slate-800 border-none rounded-lg p-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-shadow"
                        value={libro.isbn}
                        onChange={e => setLibro({ ...libro, isbn: e.target.value })}
                    />
                    <input
                        type="number"
                        min="1"
                        placeholder="Stock"
                        className="w-24 bg-slate-50 dark:bg-slate-800 border-none rounded-lg p-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-shadow"
                        value={libro.stock}
                        onChange={e => setLibro({ ...libro, stock: parseInt(e.target.value) || 1 })}
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                        Carátula del libro (Imagen)
                    </label>
                    <div className="flex items-center justify-center w-full">
                        <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-slate-300 border-dashed rounded-xl cursor-pointer bg-slate-50 dark:hover:bg-slate-800 dark:bg-slate-800/50 hover:bg-slate-100 dark:border-slate-700 dark:hover:border-slate-600 overflow-hidden relative transition-colors">
                            {libro.caratula ? (
                                <img src={libro.caratula} alt="Carátula previsualización" className="object-contain h-full w-full" />
                            ) : (
                                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                                    <svg className="w-8 h-8 mb-3 text-slate-400 dark:text-slate-500" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 20 16">
                                        <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 13h3a3 3 0 0 0 0-6h-.025A5.56 5.56 0 0 0 16 6.5 5.5 5.5 0 0 0 5.207 5.021C5.137 5.017 5.071 5 5 5a4 4 0 0 0 0 8h2.167M10 15V6m0 0L8 8m2-2 2 2" />
                                    </svg>
                                    <p className="text-sm text-slate-500 dark:text-slate-400"><span className="font-semibold text-blue-600 dark:text-blue-400">Sube una imagen</span> o arrástrala</p>
                                </div>
                            )}
                            <input type="file" className="hidden" accept="image/*" onChange={handleImageChange} />
                        </label>
                    </div>
                </div>

                <button
                    type="submit"
                    disabled={loading}
                    className="bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg p-3 text-sm transition-all flex items-center justify-center gap-2 disabled:opacity-50 mt-2"
                >
                    {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Registrar Libro'}
                </button>
            </div>
        </form>
    );
};