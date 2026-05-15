import { useMemo } from 'react';
import {
    BookOpen,
    Clock,
    AlertTriangle,
    CheckCircle,
    DollarSign,
    TrendingUp,
    TrendingDown,
    Calendar
} from 'lucide-react';
import type { Prestamo } from '../hooks/usePrestamos';

interface Props {
    prestamos: Prestamo[];
    totalLibros: number;
}

export const PrestamosDashboard = ({ prestamos, totalLibros }: Props) => {
    const stats = useMemo(() => {
        const solicitados = prestamos.filter(p => p.estado === 'solicitado');
        const activos = prestamos.filter(p => p.estado === 'activo');
        const vencidos = prestamos.filter(p => p.estado === 'vencido');
        const devueltos = prestamos.filter(p => p.estado === 'devuelto');
        const rechazados = prestamos.filter(p => p.estado === 'rechazado');

        const multasTotales = prestamos.reduce((total, p) => total + (p.multa || 0), 0);
        const multasPendientes = prestamos.reduce((total, p) =>
            total + (p.multa && !p.multa_pagada ? p.multa : 0), 0
        );

        const librosPrestados = new Set(activos.map(p => p.libro_id)).size;
        const tasaOcupacion = totalLibros > 0 ? (librosPrestados / totalLibros) * 100 : 0;

        const hoy = new Date();
        const vencenHoy = activos.filter(p => {
            const fecha = new Date(p.fecha_devolucion_esperada);
            return fecha.toDateString() === hoy.toDateString();
        });

        return {
            solicitados: solicitados.length,
            activos: activos.length,
            vencidos: vencidos.length,
            devueltos: devueltos.length,
            rechazados: rechazados.length,
            multasTotales,
            multasPendientes,
            librosPrestados,
            tasaOcupacion,
            vencenHoy: vencenHoy.length,
            total: prestamos.length
        };
    }, [prestamos, totalLibros]);

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard
                    icon={<Clock className="w-5 h-5" />}
                    label="Solicitudes Pendientes"
                    value={stats.solicitados}
                    color="amber"
                    subtitle="Requieren atención"
                />
                <StatCard
                    icon={<BookOpen className="w-5 h-5" />}
                    label="Préstamos Activos"
                    value={stats.activos}
                    color="blue"
                    subtitle={`${stats.librosPrestados} libros prestados`}
                />
                <StatCard
                    icon={<AlertTriangle className="w-5 h-5" />}
                    label="Vencidos"
                    value={stats.vencidos}
                    color="rose"
                    subtitle={`${stats.vencenHoy} vencen hoy`}
                />
                <StatCard
                    icon={<CheckCircle className="w-5 h-5" />}
                    label="Devueltos"
                    value={stats.devueltos}
                    color="emerald"
                    subtitle={`${stats.total > 0 ? Math.round((stats.devueltos / stats.total) * 100) : 0}% tasa devolución`}
                />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-white dark:bg-slate-900 rounded-xl p-6 border border-slate-200 dark:border-slate-800">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="p-2 bg-rose-100 dark:bg-rose-900/30 rounded-lg">
                            <DollarSign className="w-5 h-5 text-rose-600 dark:text-rose-400" />
                        </div>
                        <div>
                            <h4 className="font-semibold text-slate-900 dark:text-white">Multas</h4>
                            <p className="text-sm text-slate-500 dark:text-slate-400">Resumen financiero</p>
                        </div>
                    </div>
                    <div className="space-y-3">
                        <div className="flex justify-between items-center">
                            <span className="text-sm text-slate-500 dark:text-slate-400">Multas pendientes</span>
                            <span className="font-bold text-rose-600 dark:text-rose-400">
                                ${stats.multasPendientes.toLocaleString('es-CL')}
                            </span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-sm text-slate-500 dark:text-slate-400">Multas totales</span>
                            <span className="font-bold text-slate-900 dark:text-white">
                                ${stats.multasTotales.toLocaleString('es-CL')}
                            </span>
                        </div>
                    </div>
                </div>

                <div className="bg-white dark:bg-slate-900 rounded-xl p-6 border border-slate-200 dark:border-slate-800">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                            <TrendingUp className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                        </div>
                        <div>
                            <h4 className="font-semibold text-slate-900 dark:text-white">Ocupación</h4>
                            <p className="text-sm text-slate-500 dark:text-slate-400">Uso del catálogo</p>
                        </div>
                    </div>
                    <div className="space-y-3">
                        <div className="flex justify-between items-center">
                            <span className="text-sm text-slate-500 dark:text-slate-400">Libros prestados</span>
                            <span className="font-bold text-slate-900 dark:text-white">{stats.librosPrestados}</span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-sm text-slate-500 dark:text-slate-400">Tasa de ocupación</span>
                            <span className="font-bold text-slate-900 dark:text-white">{stats.tasaOcupacion.toFixed(1)}%</span>
                        </div>
                        <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2">
                            <div
                                className="bg-blue-600 h-2 rounded-full transition-all duration-500"
                                style={{ width: `${Math.min(stats.tasaOcupacion, 100)}%` }}
                            />
                        </div>
                    </div>
                </div>
            </div>

            {stats.vencenHoy > 0 && (
                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4 flex items-center gap-3">
                    <Calendar className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0" />
                    <div>
                        <p className="font-semibold text-amber-800 dark:text-amber-300">
                            {stats.vencenHoy} préstamo(s) vencen hoy
                        </p>
                        <p className="text-sm text-amber-600 dark:text-amber-400">
                            Recuerda contactar a los usuarios para la devolución
                        </p>
                    </div>
                </div>
            )}

            {stats.solicitados > 0 && (
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4 flex items-center gap-3">
                    <TrendingDown className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0" />
                    <div>
                        <p className="font-semibold text-blue-800 dark:text-blue-300">
                            {stats.solicitados} solicitud(es) pendientes de aprobación
                        </p>
                        <p className="text-sm text-blue-600 dark:text-blue-400">
                            Revisa y aprueba o rechaza las solicitudes
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
};

const StatCard = ({
    icon,
    label,
    value,
    color,
    subtitle
}: {
    icon: React.ReactNode;
    label: string;
    value: number;
    color: string;
    subtitle: string;
}) => {
    const colorClasses: Record<string, { bg: string; text: string }> = {
        amber: { bg: 'bg-amber-100 dark:bg-amber-900/30', text: 'text-amber-600 dark:text-amber-400' },
        blue: { bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-600 dark:text-blue-400' },
        rose: { bg: 'bg-rose-100 dark:bg-rose-900/30', text: 'text-rose-600 dark:text-rose-400' },
        emerald: { bg: 'bg-emerald-100 dark:bg-emerald-900/30', text: 'text-emerald-600 dark:text-emerald-400' },
    };

    const colors = colorClasses[color] || colorClasses.blue;

    return (
        <div className="bg-white dark:bg-slate-900 rounded-xl p-5 border border-slate-200 dark:border-slate-800 hover:shadow-md transition-shadow">
            <div className="flex items-center gap-3 mb-3">
                <div className={`p-2 rounded-lg ${colors.bg}`}>
                    <span className={colors.text}>{icon}</span>
                </div>
                <span className="text-sm text-slate-500 dark:text-slate-400 font-medium">{label}</span>
            </div>
            <p className="text-3xl font-bold text-slate-900 dark:text-white">{value}</p>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">{subtitle}</p>
        </div>
    );
};
