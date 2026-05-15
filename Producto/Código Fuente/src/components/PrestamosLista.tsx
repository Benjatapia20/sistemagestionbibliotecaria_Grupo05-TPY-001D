import { useState, useMemo } from 'react';
import {
    Search,
    CheckCircle,
    XCircle,
    BookOpen,
    RotateCcw,
    AlertTriangle,
    Clock,
    Filter,
    Calendar,
    ArrowLeft,
    Loader2
} from 'lucide-react';
import type { Prestamo } from '../hooks/usePrestamos';

interface Props {
    prestamos: Prestamo[];
    loading: boolean;
    userRole: 'admin' | 'usuario';
    onAprobar: (prestamoId: string) => Promise<{ success: boolean; message: string }>;
    onRechazar: (prestamoId: string) => Promise<{ success: boolean; message: string }>;
    onAprobarDevolucion: (prestamoId: string) => Promise<{ success: boolean; message: string; multa?: number; diasAtraso?: number }>;
    onRechazarDevolucion: (prestamoId: string) => Promise<{ success: boolean; message: string }>;
    onAprobarRenovacion: (prestamoId: string) => Promise<{ success: boolean; message: string }>;
    onRechazarRenovacion: (prestamoId: string) => Promise<{ success: boolean; message: string }>;
    multaPorDia?: number;
}

export const PrestamosLista = ({
    prestamos,
    loading,
    userRole: _userRole,
    onAprobar,
    onRechazar,
    onAprobarDevolucion,
    onRechazarDevolucion,
    onAprobarRenovacion,
    onRechazarRenovacion,
    multaPorDia: _multaPorDia
}: Props) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [filterEstado, setFilterEstado] = useState('todos');
    const [accionLoading, setAccionLoading] = useState<string | null>(null);

    const filteredPrestamos = useMemo(() => {
        return prestamos.filter(p => {
            const matchesSearch = p.libro?.titulo?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                p.usuario_id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                p.id?.includes(searchTerm);
            const matchesFilter = filterEstado === 'todos' || p.estado === filterEstado;
            return matchesSearch && matchesFilter;
        });
    }, [prestamos, searchTerm, filterEstado]);

    const estados = [
        { value: 'todos', label: 'Todos', count: prestamos.length },
        { value: 'solicitado', label: 'Solicitados', count: prestamos.filter(p => p.estado === 'solicitado').length },
        { value: 'activo', label: 'Activos', count: prestamos.filter(p => p.estado === 'activo').length },
        { value: 'vencido', label: 'Vencidos', count: prestamos.filter(p => p.estado === 'vencido').length },
        { value: 'devolucion_solicitada', label: 'Dev. pendientes', count: prestamos.filter(p => p.estado === 'devolucion_solicitada').length },
        { value: 'renovacion_solicitada', label: 'Renov. pendientes', count: prestamos.filter(p => p.estado === 'renovacion_solicitada').length },
        { value: 'devuelto', label: 'Devueltos', count: prestamos.filter(p => p.estado === 'devuelto').length },
        { value: 'rechazado', label: 'Rechazados', count: prestamos.filter(p => p.estado === 'rechazado').length },
    ];

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

    const getEstadoLabel = (estado: string) => {
        const labels: Record<string, string> = {
            solicitado: 'Solicitado',
            activo: 'Activo',
            devuelto: 'Devuelto',
            rechazado: 'Rechazado',
            vencido: 'Vencido',
            devolucion_solicitada: 'Dev. solicitada',
            renovacion_solicitada: 'Renov. solicitada',
        };
        return labels[estado] || estado;
    };

    const handleAccion = async (accion: string, prestamoId: string) => {
        setAccionLoading(prestamoId);
        switch (accion) {
            case 'aprobar': await onAprobar(prestamoId); break;
            case 'rechazar': await onRechazar(prestamoId); break;
            case 'aprobar-dev': await onAprobarDevolucion(prestamoId); break;
            case 'rechazar-dev': await onRechazarDevolucion(prestamoId); break;
            case 'aprobar-ren': await onAprobarRenovacion(prestamoId); break;
            case 'rechazar-ren': await onRechazarRenovacion(prestamoId); break;
            default: break;
        }
        setAccionLoading(null);
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="flex flex-col items-center gap-3">
                    <RotateCcw className="w-8 h-8 text-blue-600 animate-spin" />
                    <p className="text-slate-500 dark:text-slate-400">Cargando préstamos...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                    <input
                        type="text"
                        placeholder="Buscar por libro, usuario o ID..."
                        className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <div className="relative">
                    <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                    <select
                        className="pl-10 pr-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 text-sm cursor-pointer"
                        value={filterEstado}
                        onChange={(e) => setFilterEstado(e.target.value)}
                    >
                        {estados.map(e => (
                            <option key={e.value} value={e.value}>
                                {e.label} ({e.count})
                            </option>
                        ))}
                    </select>
                </div>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
                {filteredPrestamos.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                        <BookOpen className="w-12 h-12 mb-3 opacity-20" />
                        <p className="font-medium">No se encontraron préstamos</p>
                    </div>
                ) : (
                    <div className="divide-y divide-slate-100 dark:divide-slate-800">
                        {filteredPrestamos.map((prestamo) => {
                            const fechaEsperada = new Date(prestamo.fecha_devolucion_esperada);
                            const esVencido = prestamo.estado === 'activo' && new Date() > fechaEsperada;

                            return (
                                <div key={prestamo.id} className="p-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                    <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="font-semibold text-slate-900 dark:text-white truncate">
                                                    {prestamo.libro?.titulo || `Libro #${prestamo.libro_id}`}
                                                </span>
                                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${getEstadoBadge(prestamo.estado)}`}>
                                                    {getEstadoIcon(prestamo.estado)}
                                                    {getEstadoLabel(prestamo.estado)}
                                                </span>
                                            </div>
                                            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-500 dark:text-slate-400">
                                                <span>Usuario: {prestamo.usuario_id}</span>
                                                <span className="flex items-center gap-1">
                                                    <Calendar className="w-3 h-3" />
                                                    Dev: {fechaEsperada.toLocaleDateString('es-CL')}
                                                </span>
                                                {prestamo.multa && prestamo.multa > 0 && (
                                                    <span className="text-amber-600 dark:text-amber-400 font-semibold">
                                                        Multa: ${prestamo.multa.toLocaleString('es-CL')}
                                                    </span>
                                                )}
                                                {prestamo.estado_libro_devolucion && (
                                                    <span className="text-slate-600 dark:text-slate-300">
                                                        Estado libro: {prestamo.estado_libro_devolucion}
                                                    </span>
                                                )}
                                            </div>
                                            {esVencido && (
                                                <div className="flex items-center gap-1 mt-1 text-rose-600 dark:text-rose-400 text-xs font-semibold">
                                                    <AlertTriangle className="w-3 h-3" />
                                                    Vencido
                                                </div>
                                            )}
                                        </div>

                                        <div className="flex items-center gap-2 shrink-0">
                                            {prestamo.estado === 'solicitado' && (
                                                <>
                                                    <button
                                                        onClick={() => handleAccion('aprobar', prestamo.id)}
                                                        disabled={accionLoading === prestamo.id}
                                                        className="px-3 py-2 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 rounded-lg text-sm font-semibold hover:bg-emerald-200 dark:hover:bg-emerald-900/50 transition-colors disabled:opacity-50 flex items-center gap-1"
                                                    >
                                                        {accionLoading === prestamo.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                                                        Aprobar
                                                    </button>
                                                    <button
                                                        onClick={() => handleAccion('rechazar', prestamo.id)}
                                                        disabled={accionLoading === prestamo.id}
                                                        className="px-3 py-2 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-lg text-sm font-semibold hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors disabled:opacity-50 flex items-center gap-1"
                                                    >
                                                        <XCircle className="w-4 h-4" />
                                                        Rechazar
                                                    </button>
                                                </>
                                            )}
                                            {prestamo.estado === 'devolucion_solicitada' && (
                                                <>
                                                    <button
                                                        onClick={() => handleAccion('aprobar-dev', prestamo.id)}
                                                        disabled={accionLoading === prestamo.id}
                                                        className="px-3 py-2 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 rounded-lg text-sm font-semibold hover:bg-emerald-200 dark:hover:bg-emerald-900/50 transition-colors disabled:opacity-50 flex items-center gap-1"
                                                    >
                                                        {accionLoading === prestamo.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                                                        Aprobar dev.
                                                    </button>
                                                    <button
                                                        onClick={() => handleAccion('rechazar-dev', prestamo.id)}
                                                        disabled={accionLoading === prestamo.id}
                                                        className="px-3 py-2 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-lg text-sm font-semibold hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors disabled:opacity-50 flex items-center gap-1"
                                                    >
                                                        <XCircle className="w-4 h-4" />
                                                        Rechazar dev.
                                                    </button>
                                                </>
                                            )}
                                            {prestamo.estado === 'renovacion_solicitada' && (
                                                <>
                                                    <button
                                                        onClick={() => handleAccion('aprobar-ren', prestamo.id)}
                                                        disabled={accionLoading === prestamo.id}
                                                        className="px-3 py-2 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 rounded-lg text-sm font-semibold hover:bg-purple-200 dark:hover:bg-purple-900/50 transition-colors disabled:opacity-50 flex items-center gap-1"
                                                    >
                                                        {accionLoading === prestamo.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                                                        Aprobar renov.
                                                    </button>
                                                    <button
                                                        onClick={() => handleAccion('rechazar-ren', prestamo.id)}
                                                        disabled={accionLoading === prestamo.id}
                                                        className="px-3 py-2 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-lg text-sm font-semibold hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors disabled:opacity-50 flex items-center gap-1"
                                                    >
                                                        <XCircle className="w-4 h-4" />
                                                        Rechazar renov.
                                                    </button>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
};
