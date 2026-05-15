import { useState, useMemo } from 'react';
import {
    BookOpen,
    Clock,
    CheckCircle,
    XCircle,
    AlertTriangle,
    Calendar,
    RotateCcw,
    RefreshCw,
    DollarSign,
    ArrowLeft,
    Loader2
} from 'lucide-react';
import type { Prestamo } from '../hooks/usePrestamos';

interface Props {
    prestamos: Prestamo[];
    loading: boolean;
    onSolicitarDevolucion: (prestamoId: string, estadoLibro: string, observaciones: string) => Promise<{ success: boolean; message: string; multaEstimada?: number; diasAtraso?: number }>;
    onSolicitarRenovacion: (prestamoId: string) => Promise<{ success: boolean; message: string }>;
    onRefresh: () => void;
    multaPorDia?: number;
}

export const MisPrestamos = ({
    prestamos,
    loading,
    onSolicitarDevolucion,
    onSolicitarRenovacion,
    onRefresh,
    multaPorDia = 100
}: Props) => {
    const [filterEstado, setFilterEstado] = useState('todos');
    const [accionLoading, setAccionLoading] = useState<string | null>(null);
    const [prestamoDevolviendo, setPrestamoDevolviendo] = useState<Prestamo | null>(null);
    const [estadoLibro, setEstadoLibro] = useState('buen_estado');
    const [observaciones, setObservaciones] = useState('');

    const filteredPrestamos = useMemo(() => {
        const filtrados = filterEstado === 'todos'
            ? prestamos
            : prestamos.filter(p => p.estado === filterEstado);
        return filtrados.sort((a, b) => {
            const order = { solicitado: 0, activo: 1, vencido: 2, devolucion_solicitada: 3, renovacion_solicitada: 4, devuelto: 5, rechazado: 6 };
            return (order[a.estado as keyof typeof order] || 7) - (order[b.estado as keyof typeof order] || 7);
        });
    }, [prestamos, filterEstado]);

    const prestamosActivos = prestamos.filter(p => p.estado === 'activo' || p.estado === 'vencido');
    const prestamosSolicitados = prestamos.filter(p => p.estado === 'solicitado');
    const multasPendientes = prestamos.reduce((total, p) => total + (p.multa && !p.multa_pagada ? p.multa : 0), 0);

    const handleDevolver = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!prestamoDevolviendo) return;
        setAccionLoading(prestamoDevolviendo.id);
        const result = await onSolicitarDevolucion(prestamoDevolviendo.id, estadoLibro, observaciones);
        setAccionLoading(null);
        if (result.success) {
            setPrestamoDevolviendo(null);
            setEstadoLibro('buen_estado');
            setObservaciones('');
        }
    };

    const handleRenovar = async (prestamoId: string) => {
        setAccionLoading(prestamoId);
        await onSolicitarRenovacion(prestamoId);
        setAccionLoading(null);
    };

    const getEstadoBadge = (estado: string) => {
        const styles: Record<string, string> = {
            solicitado: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
            activo: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
            devuelto: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
            rechazado: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
            vencido: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400',
            devolucion_solicitada: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
            renovacion_solicitada: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
        };
        return styles[estado] || 'bg-slate-100 text-slate-700';
    };

    const getEstadoIcon = (estado: string) => {
        switch (estado) {
            case 'solicitado': return <Clock className="w-4 h-4" />;
            case 'activo': return <BookOpen className="w-4 h-4" />;
            case 'devuelto': return <CheckCircle className="w-4 h-4" />;
            case 'rechazado': return <XCircle className="w-4 h-4" />;
            case 'vencido': return <AlertTriangle className="w-4 h-4" />;
            case 'devolucion_solicitada': return <ArrowLeft className="w-4 h-4" />;
            case 'renovacion_solicitada': return <RotateCcw className="w-4 h-4" />;
            default: return null;
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="flex flex-col items-center gap-3">
                    <RefreshCw className="w-8 h-8 text-blue-600 animate-spin" />
                    <p className="text-slate-500 dark:text-slate-400">Cargando mis préstamos...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-white dark:bg-slate-900 rounded-xl p-4 border border-slate-200 dark:border-slate-800">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                            <BookOpen className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                        </div>
                        <div>
                            <p className="text-sm text-slate-500 dark:text-slate-400">Activos</p>
                            <p className="text-xl font-bold text-slate-900 dark:text-white">{prestamosActivos.length}</p>
                        </div>
                    </div>
                </div>
                <div className="bg-white dark:bg-slate-900 rounded-xl p-4 border border-slate-200 dark:border-slate-800">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-amber-100 dark:bg-amber-900/30 rounded-lg">
                            <Clock className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                        </div>
                        <div>
                            <p className="text-sm text-slate-500 dark:text-slate-400">Solicitados</p>
                            <p className="text-xl font-bold text-slate-900 dark:text-white">{prestamosSolicitados.length}</p>
                        </div>
                    </div>
                </div>
                <div className="bg-white dark:bg-slate-900 rounded-xl p-4 border border-slate-200 dark:border-slate-800">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-rose-100 dark:bg-rose-900/30 rounded-lg">
                            <DollarSign className="w-5 h-5 text-rose-600 dark:text-rose-400" />
                        </div>
                        <div>
                            <p className="text-sm text-slate-500 dark:text-slate-400">Multas</p>
                            <p className="text-xl font-bold text-slate-900 dark:text-white">
                                ${multasPendientes.toLocaleString('es-CL')}
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">Historial de Préstamos</h3>
                <button
                    onClick={onRefresh}
                    className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                >
                    <RefreshCw className="w-4 h-4" />
                </button>
            </div>

            <div className="flex gap-2 overflow-x-auto pb-2">
                {[
                    { value: 'todos', label: 'Todos' },
                    { value: 'activo', label: 'Activos' },
                    { value: 'vencido', label: 'Vencidos' },
                    { value: 'solicitado', label: 'Solicitados' },
                    { value: 'devuelto', label: 'Devueltos' },
                ].map(f => (
                    <button
                        key={f.value}
                        onClick={() => setFilterEstado(f.value)}
                        className={`px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${filterEstado === f.value
                                ? 'bg-blue-600 text-white'
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                            }`}
                    >
                        {f.label}
                    </button>
                ))}
            </div>

            <div className="space-y-3">
                {filteredPrestamos.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-slate-400 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
                        <BookOpen className="w-12 h-12 mb-3 opacity-20" />
                        <p className="font-medium">No tienes préstamos</p>
                        <p className="text-sm mt-1">Explora el catálogo para solicitar un préstamo</p>
                    </div>
                ) : (
                    filteredPrestamos.map((prestamo) => {
                        const fechaEsperada = new Date(prestamo.fecha_devolucion_esperada);
                        const esVencido = prestamo.estado === 'activo' && new Date() > fechaEsperada;
                        const diasRestantes = Math.ceil((fechaEsperada.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
                        const puedeDevolver = prestamo.estado === 'activo' || prestamo.estado === 'vencido';
                        const puedeRenovar = prestamo.estado === 'activo' || prestamo.estado === 'vencido';
                        const esperaDevolucion = prestamo.estado === 'devolucion_solicitada';
                        const esperaRenovacion = prestamo.estado === 'renovacion_solicitada';

                        return (
                            <div key={prestamo.id} className="bg-white dark:bg-slate-900 rounded-xl p-4 border border-slate-200 dark:border-slate-800 hover:shadow-md transition-shadow">
                                <div className="flex items-start justify-between gap-4">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-2">
                                            <span className="font-semibold text-slate-900 dark:text-white truncate">
                                                {prestamo.libro?.titulo || `Libro #${prestamo.libro_id}`}
                                            </span>
                                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold shrink-0 ${getEstadoBadge(prestamo.estado)}`}>
                                                {getEstadoIcon(prestamo.estado)}
                                                {prestamo.estado === 'devolucion_solicitada' ? 'Dev. solicitada' :
                                                    prestamo.estado === 'renovacion_solicitada' ? 'Renov. solicitada' :
                                                        prestamo.estado.charAt(0).toUpperCase() + prestamo.estado.slice(1)}
                                            </span>
                                        </div>
                                        {prestamo.libro?.autor && (
                                            <p className="text-sm text-slate-500 dark:text-slate-400 mb-2">{prestamo.libro.autor}</p>
                                        )}
                                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-500 dark:text-slate-400">
                                            <span className="flex items-center gap-1">
                                                <Calendar className="w-3 h-3" />
                                                Dev: {fechaEsperada.toLocaleDateString('es-CL')}
                                            </span>
                                            {(prestamo.estado === 'activo' || esVencido) && (
                                                <span className={esVencido ? 'text-rose-600 dark:text-rose-400 font-semibold' : ''}>
                                                    {esVencido
                                                        ? `${Math.abs(diasRestantes)} día(s) de atraso`
                                                        : `${diasRestantes} días restantes`
                                                    }
                                                </span>
                                            )}
                                            {prestamo.multa && prestamo.multa > 0 && (
                                                <span className="text-amber-600 dark:text-amber-400 font-semibold">
                                                    Multa: ${prestamo.multa.toLocaleString('es-CL')}
                                                </span>
                                            )}
                                        </div>
                                        {esperaDevolucion && (
                                            <div className="flex items-center gap-1 mt-2 text-orange-600 dark:text-orange-400 text-xs font-semibold">
                                                <Clock className="w-3 h-3" />
                                                Esperando aprobación de devolución
                                            </div>
                                        )}
                                        {esperaRenovacion && (
                                            <div className="flex items-center gap-1 mt-2 text-purple-600 dark:text-purple-400 text-xs font-semibold">
                                                <RotateCcw className="w-3 h-3" />
                                                Esperando aprobación de renovación
                                            </div>
                                        )}
                                    </div>

                                    <div className="flex flex-col items-center gap-2 shrink-0">
                                        {puedeDevolver && !esperaDevolucion && !esperaRenovacion && (
                                            <button
                                                onClick={() => setPrestamoDevolviendo(prestamo)}
                                                className="px-3 py-2 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 rounded-lg text-sm font-semibold hover:bg-emerald-200 dark:hover:bg-emerald-900/50 transition-colors flex items-center gap-1"
                                            >
                                                <ArrowLeft className="w-4 h-4" />
                                                Devolver
                                            </button>
                                        )}
                                        {puedeRenovar && !esperaRenovacion && !esperaDevolucion && (
                                            <button
                                                onClick={() => handleRenovar(prestamo.id)}
                                                disabled={accionLoading === prestamo.id}
                                                className="px-3 py-2 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 rounded-lg text-sm font-semibold hover:bg-purple-200 dark:hover:bg-purple-900/50 transition-colors disabled:opacity-50 flex items-center gap-1"
                                            >
                                                {accionLoading === prestamo.id ? (
                                                    <Loader2 className="w-4 h-4 animate-spin" />
                                                ) : (
                                                    <RotateCcw className="w-4 h-4" />
                                                )}
                                                Renovar
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>

            {prestamoDevolviendo && (
                <div className="fixed inset-0 z-100 flex items-center justify-center bg-slate-900/50 dark:bg-slate-950/80 backdrop-blur-sm p-4">
                    <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-xl overflow-hidden animate-in fade-in zoom-in duration-200">
                        <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg">
                                    <ArrowLeft className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                                </div>
                                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                                    Solicitar Devolución
                                </h3>
                            </div>
                            <button
                                onClick={() => { setPrestamoDevolviendo(null); setEstadoLibro('buen_estado'); setObservaciones(''); }}
                                className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                            >
                                <XCircle className="w-5 h-5" />
                            </button>
                        </div>

                        <form onSubmit={handleDevolver} className="p-6 space-y-4">
                            <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-4 space-y-2">
                                <p className="font-semibold text-slate-900 dark:text-white">
                                    {prestamoDevolviendo.libro?.titulo || `Libro #${prestamoDevolviendo.libro_id}`}
                                </p>
                                <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                                    <Calendar className="w-4 h-4" />
                                    <span>Dev. esperada: {new Date(prestamoDevolviendo.fecha_devolucion_esperada).toLocaleDateString('es-CL')}</span>
                                </div>
                            </div>

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
                                        Multa adicional estimada: ${estadoLibro === 'danado' ? (multaPorDia * 7).toLocaleString('es-CL') : (multaPorDia * 30).toLocaleString('es-CL')}
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

                            <div className="flex gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={() => { setPrestamoDevolviendo(null); setEstadoLibro('buen_estado'); setObservaciones(''); }}
                                    className="flex-1 px-4 py-3 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={accionLoading === prestamoDevolviendo.id}
                                    className="flex-1 px-4 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                                >
                                    {accionLoading === prestamoDevolviendo.id ? (
                                        <>
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                            Enviando...
                                        </>
                                    ) : (
                                        'Solicitar Devolución'
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};
