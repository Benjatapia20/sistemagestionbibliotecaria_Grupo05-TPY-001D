import { useState } from 'react';
import { BookOpen, Calendar, AlertCircle, Loader2, X, DollarSign } from 'lucide-react';

interface Prestamo {
    id: string;
    libro_id: number;
    fecha_devolucion_esperada: string;
    multa?: number;
    observaciones?: string;
    libro?: {
        titulo: string;
        autor: string;
    };
}

interface Props {
    prestamo: Prestamo;
    onDevolver: (prestamoId: string, estadoLibro: string, observaciones: string) => Promise<{ success: boolean; message: string; multa?: number; diasAtraso?: number }>;
    onSuccess: () => void;
    onCancel: () => void;
    multaPorDia?: number;
}

export const ModalDevolver = ({
    prestamo,
    onDevolver,
    onSuccess,
    onCancel,
    multaPorDia = 100
}: Props) => {
    const [estadoLibro, setEstadoLibro] = useState('buen_estado');
    const [observaciones, setObservaciones] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fechaEsperada = new Date(prestamo.fecha_devolucion_esperada);
    const ahora = new Date();
    const diasAtraso = Math.max(0, Math.floor((ahora.getTime() - fechaEsperada.getTime()) / (1000 * 60 * 60 * 24)));
    const multaAtraso = diasAtraso * multaPorDia;
    let multaAdicional = 0;
    if (estadoLibro === 'danado') multaAdicional = multaPorDia * 7;
    if (estadoLibro === 'perdido') multaAdicional = multaPorDia * 30;
    const multaTotal = multaAtraso + multaAdicional;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            const result = await onDevolver(prestamo.id, estadoLibro, observaciones);
            if (result.success) {
                onSuccess();
            } else {
                setError(result.message);
            }
        } catch (err: any) {
            setError(err.message || 'Error al registrar devolución');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-100 flex items-center justify-center bg-slate-900/50 dark:bg-slate-950/80 backdrop-blur-sm p-4">
            <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-xl overflow-hidden animate-in fade-in zoom-in duration-200">
                <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg">
                            <BookOpen className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                        </div>
                        <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                            Registrar Devolución
                        </h3>
                    </div>
                    <button
                        onClick={onCancel}
                        className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-4 space-y-2">
                        <p className="font-semibold text-slate-900 dark:text-white">
                            {prestamo.libro?.titulo || `Libro #${prestamo.libro_id}`}
                        </p>
                        {prestamo.libro?.autor && (
                            <p className="text-sm text-slate-500 dark:text-slate-400">{prestamo.libro.autor}</p>
                        )}
                        <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                            <Calendar className="w-4 h-4" />
                            <span>Dev. esperada: {fechaEsperada.toLocaleDateString('es-CL')}</span>
                        </div>
                    </div>

                    {diasAtraso > 0 && (
                        <div className="flex items-center gap-2 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-xl text-amber-700 dark:text-amber-400">
                            <AlertCircle className="w-5 h-5 shrink-0" />
                            <div>
                                <p className="font-semibold">{diasAtraso} día(s) de atraso</p>
                                <p className="text-sm">Multa por atraso: ${multaAtraso.toLocaleString('es-CL')}</p>
                            </div>
                        </div>
                    )}

                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                            Estado del libro
                        </label>
                        <select
                            value={estadoLibro}
                            onChange={(e) => setEstadoLibro(e.target.value)}
                            className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                        >
                            <option value="buen_estado">Buen estado</option>
                            <option value="danado">Dañado</option>
                            <option value="perdido">Perdido</option>
                        </select>
                    </div>

                    {estadoLibro !== 'buen_estado' && (
                        <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/20 rounded-xl text-red-700 dark:text-red-400">
                            <DollarSign className="w-5 h-5 shrink-0" />
                            <p className="text-sm">
                                Multa adicional: ${multaAdicional.toLocaleString('es-CL')}
                                {estadoLibro === 'danado' ? ' (dañado)' : ' (perdido)'}
                            </p>
                        </div>
                    )}

                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                            Observaciones (opcional)
                        </label>
                        <textarea
                            value={observaciones}
                            onChange={(e) => setObservaciones(e.target.value)}
                            rows={3}
                            className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 text-sm resize-none"
                            placeholder="Notas sobre el estado del libro..."
                        />
                    </div>

                    {multaTotal > 0 && (
                        <div className="p-4 bg-slate-100 dark:bg-slate-800 rounded-xl space-y-1">
                            <p className="text-sm text-slate-500 dark:text-slate-400">Multa total</p>
                            <p className="text-2xl font-bold text-slate-900 dark:text-white">
                                ${multaTotal.toLocaleString('es-CL')}
                            </p>
                        </div>
                    )}

                    {error && (
                        <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/20 rounded-xl text-red-700 dark:text-red-400">
                            <AlertCircle className="w-5 h-5 shrink-0" />
                            <p className="text-sm">{error}</p>
                        </div>
                    )}

                    <div className="flex gap-3 pt-2">
                        <button
                            type="button"
                            onClick={onCancel}
                            className="flex-1 px-4 py-3 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="flex-1 px-4 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                            {loading ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    Procesando...
                                </>
                            ) : (
                                'Confirmar Devolución'
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};
