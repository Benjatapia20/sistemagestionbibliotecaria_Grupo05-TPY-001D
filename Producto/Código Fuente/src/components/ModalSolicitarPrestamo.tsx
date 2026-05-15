import { useState } from 'react';
import { BookOpen, Calendar, AlertCircle, Loader2, X } from 'lucide-react';

interface Libro {
    id: number;
    titulo: string;
    autor: string;
    stock: number;
    caratula?: string;
    caratula_url?: string;
}

interface Props {
    libro: Libro;
    userId: string;
    useLocal: boolean;
    onSolicitar: (libroId: number) => Promise<{ success: boolean; message: string }>;
    onSuccess: () => void;
    onCancel: () => void;
    configDias?: number;
    maxPrestamosActivos?: number;
    prestamosActivosCount?: number;
}

export const ModalSolicitarPrestamo = ({
    libro,
    userId: _userId,
    useLocal: _useLocal,
    onSolicitar,
    onSuccess,
    onCancel,
    configDias = 14,
    maxPrestamosActivos = 3,
    prestamosActivosCount = 0
}: Props) => {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fechaDevolucion = new Date();
    fechaDevolucion.setDate(fechaDevolucion.getDate() + configDias);

    const puedeSolicitar = prestamosActivosCount < maxPrestamosActivos && libro.stock > 0;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            const result = await onSolicitar(libro.id);
            if (result.success) {
                onSuccess();
            } else {
                setError(result.message);
            }
        } catch (err: any) {
            setError(err.message || 'Error al solicitar préstamo');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-100 flex items-center justify-center bg-slate-900/50 dark:bg-slate-950/80 backdrop-blur-sm p-4">
            <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-xl overflow-hidden animate-in fade-in zoom-in duration-200">
                <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                            <BookOpen className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                        </div>
                        <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                            Solicitar Préstamo
                        </h3>
                    </div>
                    <button
                        onClick={onCancel}
                        className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-6 space-y-4">
                    <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-4 space-y-3">
                        <div>
                            <p className="text-sm text-slate-500 dark:text-slate-400">Libro</p>
                            <p className="font-semibold text-slate-900 dark:text-white">{libro.titulo}</p>
                            <p className="text-sm text-slate-500 dark:text-slate-400">{libro.autor}</p>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className={`text-xs font-bold px-2 py-1 rounded-full ${libro.stock > 0
                                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                                    : 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400'
                                }`}>
                                {libro.stock > 0 ? `${libro.stock} disponibles` : 'No disponible'}
                            </span>
                        </div>
                    </div>

                    <div className="flex items-center gap-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl">
                        <Calendar className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0" />
                        <div>
                            <p className="text-sm text-slate-500 dark:text-slate-400">Fecha de devolución</p>
                            <p className="font-semibold text-slate-900 dark:text-white">
                                {fechaDevolucion.toLocaleDateString('es-CL', {
                                    day: 'numeric',
                                    month: 'long',
                                    year: 'numeric'
                                })}
                            </p>
                        </div>
                    </div>

                    <div className="text-xs text-slate-500 dark:text-slate-400 space-y-1">
                        <p>Plazo: {configDias} días</p>
                        <p>Préstamos activos: {prestamosActivosCount}/{maxPrestamosActivos}</p>
                    </div>

                    {!puedeSolicitar && (
                        <div className="flex items-center gap-2 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-xl text-amber-700 dark:text-amber-400">
                            <AlertCircle className="w-5 h-5 shrink-0" />
                            <p className="text-sm">
                                {libro.stock === 0
                                    ? 'Este libro no está disponible actualmente'
                                    : 'Has alcanzado el máximo de préstamos activos'}
                            </p>
                        </div>
                    )}

                    {error && (
                        <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/20 rounded-xl text-red-700 dark:text-red-400">
                            <AlertCircle className="w-5 h-5 shrink-0" />
                            <p className="text-sm">{error}</p>
                        </div>
                    )}
                </div>

                <div className="p-6 border-t border-slate-200 dark:border-slate-800 flex gap-3">
                    <button
                        onClick={onCancel}
                        className="flex-1 px-4 py-3 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={loading || !puedeSolicitar}
                        className="flex-1 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                        {loading ? (
                            <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                Solicitando...
                            </>
                        ) : (
                            'Solicitar Préstamo'
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};
