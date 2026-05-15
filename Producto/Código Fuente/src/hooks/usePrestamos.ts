import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

export interface Prestamo {
    id: string;
    usuario_id: string;
    libro_id: number;
    estado: 'solicitado' | 'activo' | 'devuelto' | 'rechazado' | 'vencido' | 'devolucion_solicitada' | 'renovacion_solicitada';
    fecha_solicitud: string;
    fecha_aprobacion?: string;
    fecha_devolucion_esperada: string;
    fecha_devolucion_real?: string;
    multa?: number;
    multa_pagada?: boolean;
    observaciones?: string;
    observaciones_devolucion?: string;
    estado_libro_devolucion?: string;
    fecha_solicitud_devolucion?: string;
    fecha_solicitud_renovacion?: string;
    created_at: string;
    libro?: {
        id: number;
        titulo: string;
        autor: string;
        caratula?: string;
        caratula_url?: string;
        stock: number;
    };
    usuario?: {
        username: string;
        email?: string;
    };
}

export interface ConfigPrestamos {
    id: number;
    dias_maximos_prestamo: number;
    multa_por_dia: number;
    max_prestamos_activos: number;
    renovaciones_permitidas: number;
}

export const usePrestamos = (userId: string | undefined, userRole: 'admin' | 'usuario', useLocal: boolean) => {
    const [prestamos, setPrestamos] = useState<Prestamo[]>([]);
    const [config, setConfig] = useState<ConfigPrestamos | null>(null);
    const [loading, setLoading] = useState(false);
    const [prestamosPendientes, setPrestamosPendientes] = useState(0);

    const fetchPrestamos = useCallback(async () => {
        if (!userId) return;
        setLoading(true);

        try {
            if (useLocal) {
                const localApi = import.meta.env.VITE_LOCAL_API_URL || 'http://localhost:3000';
                const url = userRole === 'admin'
                    ? `${localApi}/prestamos?order=created_at.desc`
                    : `${localApi}/prestamos?usuario_id=eq.${userId}&order=created_at.desc`;

                const res = await fetch(url);
                if (res.ok) {
                    let data: Prestamo[] = await res.json();
                    data = data.map(p => verificarVencimiento(p));
                    setPrestamos(data);
                    setPrestamosPendientes(data.filter(p =>
                        p.estado === 'solicitado' || p.estado === 'devolucion_solicitada' || p.estado === 'renovacion_solicitada'
                    ).length);
                }
            } else {
                let query = supabase
                    .from('prestamos')
                    .select(`
                        *,
                        libro:libros(id, titulo, autor, caratula, caratula_url, stock)
                    `)
                    .order('created_at', { ascending: false });

                if (userRole !== 'admin') {
                    query = query.eq('usuario_id', userId);
                }

                const { data, error } = await query;
                if (!error && data) {
                    const processedData = data.map(p => verificarVencimiento(p));
                    setPrestamos(processedData);
                    setPrestamosPendientes(processedData.filter(p =>
                        p.estado === 'solicitado' || p.estado === 'devolucion_solicitada' || p.estado === 'renovacion_solicitada'
                    ).length);
                }
            }
        } catch (error) {
            console.error('Error fetching prestamos:', error);
        } finally {
            setLoading(false);
        }
    }, [userId, userRole, useLocal]);

    const fetchConfig = useCallback(async () => {
        try {
            if (useLocal) {
                const localApi = import.meta.env.VITE_LOCAL_API_URL || 'http://localhost:3000';
                const res = await fetch(`${localApi}/config_prestamos?id=eq.1`);
                if (res.ok) {
                    const data = await res.json();
                    if (data.length > 0) setConfig(data[0]);
                }
            } else {
                const { data, error } = await supabase
                    .from('config_prestamos')
                    .select('*')
                    .eq('id', 1)
                    .single();
                if (!error && data) setConfig(data);
            }
        } catch (error) {
            console.error('Error fetching config:', error);
        }
    }, [useLocal]);

    const solicitarPrestamo = async (libroId: number) => {
        if (!userId) return { success: false, message: 'Usuario no identificado' };

        const configActual = config || {
            dias_maximos_prestamo: 14,
            multa_por_dia: 100,
            max_prestamos_activos: 3,
            renovaciones_permitidas: 1
        };

        const prestamosActivos = prestamos.filter(p =>
            p.usuario_id === userId && (p.estado === 'activo' || p.estado === 'solicitado')
        ).length;

        if (prestamosActivos >= configActual.max_prestamos_activos) {
            return { success: false, message: `Has alcanzado el máximo de ${configActual.max_prestamos_activos} préstamos activos` };
        }

        const yaPrestado = prestamos.some(p =>
            p.usuario_id === userId && p.libro_id === libroId && (p.estado === 'activo' || p.estado === 'solicitado')
        );

        if (yaPrestado) {
            return { success: false, message: 'Ya tienes un préstamo activo o solicitado para este libro' };
        }

        const fechaDevolucion = new Date();
        fechaDevolucion.setDate(fechaDevolucion.getDate() + configActual.dias_maximos_prestamo);

        const nuevoPrestamo = {
            usuario_id: userId,
            libro_id: libroId,
            estado: 'solicitado',
            fecha_devolucion_esperada: fechaDevolucion.toISOString()
        };

        const tempId = `temp-${Date.now()}`;
        const prestamoOptimista: Prestamo = {
            ...nuevoPrestamo,
            id: tempId,
            fecha_solicitud: new Date().toISOString(),
            created_at: new Date().toISOString(),
            estado: 'solicitado'
        };

        setPrestamos(prev => [prestamoOptimista, ...prev]);

        try {
            if (useLocal) {
                const localApi = import.meta.env.VITE_LOCAL_API_URL || 'http://localhost:3000';
                const res = await fetch(`${localApi}/prestamos`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Prefer': 'return=representation' },
                    body: JSON.stringify(nuevoPrestamo)
                });
                if (!res.ok) throw new Error('Error al solicitar préstamo');
            } else {
                const { error } = await supabase
                    .from('prestamos')
                    .insert([nuevoPrestamo]);
                if (error) throw error;
            }

            fetchPrestamos();
            return { success: true, message: 'Préstamo solicitado correctamente' };
        } catch (error: any) {
            setPrestamos(prev => prev.filter(p => p.id !== tempId));
            return { success: false, message: error.message || 'Error al solicitar préstamo' };
        }
    };

    const aprobarPrestamo = async (prestamoId: string) => {
        const prestamo = prestamos.find(p => p.id === prestamoId);
        if (!prestamo) return { success: false, message: 'Préstamo no encontrado' };

        const prestamoActualizado = { ...prestamo, estado: 'activo' as const, fecha_aprobacion: new Date().toISOString() };
        setPrestamos(prev => prev.map(p => p.id === prestamoId ? prestamoActualizado : p));

        try {
            if (useLocal) {
                const localApi = import.meta.env.VITE_LOCAL_API_URL || 'http://localhost:3000';
                const resLibro = await fetch(`${localApi}/libros?id=eq.${prestamo.libro_id}`);
                if (resLibro.ok) {
                    const libros = await resLibro.json();
                    if (libros.length > 0 && libros[0].stock > 0) {
                        await fetch(`${localApi}/libros?id=eq.${prestamo.libro_id}`, {
                            method: 'PATCH',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ stock: libros[0].stock - 1 })
                        });
                    }
                }

                await fetch(`${localApi}/prestamos?id=eq.${prestamoId}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        estado: 'activo',
                        fecha_aprobacion: new Date().toISOString()
                    })
                });
            } else {
                const { data: libros } = await supabase
                    .from('libros')
                    .select('stock')
                    .eq('id', prestamo.libro_id)
                    .single();

                if (libros && libros.stock > 0) {
                    await supabase
                        .from('libros')
                        .update({ stock: libros.stock - 1 })
                        .eq('id', prestamo.libro_id);
                }

                const { error } = await supabase
                    .from('prestamos')
                    .update({
                        estado: 'activo',
                        fecha_aprobacion: new Date().toISOString()
                    })
                    .eq('id', prestamoId);

                if (error) throw error;
            }

            fetchPrestamos();
            return { success: true, message: 'Préstamo aprobado correctamente' };
        } catch (error: any) {
            setPrestamos(prev => prev.map(p => p.id === prestamoId ? prestamo : p));
            return { success: false, message: error.message || 'Error al aprobar préstamo' };
        }
    };

    const rechazarPrestamo = async (prestamoId: string) => {
        const prestamo = prestamos.find(p => p.id === prestamoId);
        if (!prestamo) return { success: false, message: 'Préstamo no encontrado' };

        setPrestamos(prev => prev.map(p => p.id === prestamoId ? { ...p, estado: 'rechazado' as const } : p));

        try {
            if (useLocal) {
                const localApi = import.meta.env.VITE_LOCAL_API_URL || 'http://localhost:3000';
                await fetch(`${localApi}/prestamos?id=eq.${prestamoId}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ estado: 'rechazado' })
                });
            } else {
                const { error } = await supabase
                    .from('prestamos')
                    .update({ estado: 'rechazado' })
                    .eq('id', prestamoId);
                if (error) throw error;
            }

            fetchPrestamos();
            return { success: true, message: 'Préstamo rechazado' };
        } catch (error: any) {
            setPrestamos(prev => prev.map(p => p.id === prestamoId ? prestamo : p));
            return { success: false, message: error.message || 'Error al rechazar préstamo' };
        }
    };

    const solicitarDevolucion = async (prestamoId: string, estadoLibro: string, observaciones: string) => {
        const prestamo = prestamos.find(p => p.id === prestamoId);
        if (!prestamo) return { success: false, message: 'Préstamo no encontrado' };

        const ahora = new Date();
        const fechaEsperada = new Date(prestamo.fecha_devolucion_esperada);
        const diasAtraso = Math.max(0, Math.floor((ahora.getTime() - fechaEsperada.getTime()) / (1000 * 60 * 60 * 24)));
        const multaEstimada = diasAtraso * (config?.multa_por_dia || 100);

        const prestamoActualizado = {
            ...prestamo,
            estado: 'devolucion_solicitada' as const,
            fecha_solicitud_devolucion: ahora.toISOString(),
            estado_libro_devolucion: estadoLibro,
            observaciones_devolucion: observaciones || prestamo.observaciones
        };

        setPrestamos(prev => prev.map(p => p.id === prestamoId ? prestamoActualizado : p));

        try {
            if (useLocal) {
                const localApi = import.meta.env.VITE_LOCAL_API_URL || 'http://localhost:3000';
                await fetch(`${localApi}/prestamos?id=eq.${prestamoId}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        estado: 'devolucion_solicitada',
                        fecha_solicitud_devolucion: ahora.toISOString(),
                        estado_libro_devolucion: estadoLibro,
                        observaciones_devolucion: observaciones || prestamo.observaciones
                    })
                });
            } else {
                const { error } = await supabase
                    .from('prestamos')
                    .update({
                        estado: 'devolucion_solicitada',
                        fecha_solicitud_devolucion: ahora.toISOString(),
                        estado_libro_devolucion: estadoLibro,
                        observaciones_devolucion: observaciones || prestamo.observaciones
                    })
                    .eq('id', prestamoId);
                if (error) throw error;
            }

            fetchPrestamos();
            return {
                success: true,
                message: 'Solicitud de devolución enviada. Espera la aprobación del administrador.',
                multaEstimada,
                diasAtraso
            };
        } catch (error: any) {
            setPrestamos(prev => prev.map(p => p.id === prestamoId ? prestamo : p));
            return { success: false, message: error.message || 'Error al solicitar devolución' };
        }
    };

    const aprobarDevolucion = async (prestamoId: string) => {
        const prestamo = prestamos.find(p => p.id === prestamoId);
        if (!prestamo) return { success: false, message: 'Préstamo no encontrado' };

        const ahora = new Date();
        const fechaEsperada = new Date(prestamo.fecha_devolucion_esperada);
        const diasAtraso = Math.max(0, Math.floor((ahora.getTime() - fechaEsperada.getTime()) / (1000 * 60 * 60 * 24)));
        const multa = diasAtraso * (config?.multa_por_dia || 100);
        let multaTotal = multa;

        if (prestamo.estado_libro_devolucion === 'danado') multaTotal += (config?.multa_por_dia || 100) * 7;
        if (prestamo.estado_libro_devolucion === 'perdido') multaTotal += (config?.multa_por_dia || 100) * 30;

        const prestamoActualizado = {
            ...prestamo,
            estado: 'devuelto' as const,
            fecha_devolucion_real: ahora.toISOString(),
            multa: multaTotal
        };

        setPrestamos(prev => prev.map(p => p.id === prestamoId ? prestamoActualizado : p));

        try {
            if (useLocal) {
                const localApi = import.meta.env.VITE_LOCAL_API_URL || 'http://localhost:3000';
                const resLibro = await fetch(`${localApi}/libros?id=eq.${prestamo.libro_id}`);
                if (resLibro.ok) {
                    const libros = await resLibro.json();
                    if (libros.length > 0) {
                        await fetch(`${localApi}/libros?id=eq.${prestamo.libro_id}`, {
                            method: 'PATCH',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ stock: libros[0].stock + 1 })
                        });
                    }
                }

                await fetch(`${localApi}/prestamos?id=eq.${prestamoId}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        estado: 'devuelto',
                        fecha_devolucion_real: ahora.toISOString(),
                        multa: multaTotal
                    })
                });
            } else {
                const { data: libros } = await supabase
                    .from('libros')
                    .select('stock')
                    .eq('id', prestamo.libro_id)
                    .single();

                if (libros) {
                    await supabase
                        .from('libros')
                        .update({ stock: libros.stock + 1 })
                        .eq('id', prestamo.libro_id);
                }

                const { error } = await supabase
                    .from('prestamos')
                    .update({
                        estado: 'devuelto',
                        fecha_devolucion_real: ahora.toISOString(),
                        multa: multaTotal
                    })
                    .eq('id', prestamoId);

                if (error) throw error;
            }

            fetchPrestamos();
            return {
                success: true,
                message: 'Devolución aprobada',
                multa: multaTotal,
                diasAtraso
            };
        } catch (error: any) {
            setPrestamos(prev => prev.map(p => p.id === prestamoId ? prestamo : p));
            return { success: false, message: error.message || 'Error al aprobar devolución' };
        }
    };

    const rechazarDevolucion = async (prestamoId: string) => {
        const prestamo = prestamos.find(p => p.id === prestamoId);
        if (!prestamo) return { success: false, message: 'Préstamo no encontrado' };

        const estadoAnterior = prestamo.estado === 'vencido' ? 'vencido' : 'activo';
        setPrestamos(prev => prev.map(p => p.id === prestamoId ? { ...p, estado: estadoAnterior as any } : p));

        try {
            if (useLocal) {
                const localApi = import.meta.env.VITE_LOCAL_API_URL || 'http://localhost:3000';
                await fetch(`${localApi}/prestamos?id=eq.${prestamoId}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ estado: estadoAnterior })
                });
            } else {
                const { error } = await supabase
                    .from('prestamos')
                    .update({ estado: estadoAnterior })
                    .eq('id', prestamoId);
                if (error) throw error;
            }

            fetchPrestamos();
            return { success: true, message: 'Devolución rechazada. El préstamo sigue activo.' };
        } catch (error: any) {
            setPrestamos(prev => prev.map(p => p.id === prestamoId ? prestamo : p));
            return { success: false, message: error.message || 'Error al rechazar devolución' };
        }
    };

    const solicitarRenovacion = async (prestamoId: string) => {
        const prestamo = prestamos.find(p => p.id === prestamoId);
        if (!prestamo) return { success: false, message: 'Préstamo no encontrado' };

        if (prestamo.estado !== 'activo' && prestamo.estado !== 'vencido') {
            return { success: false, message: 'Solo se pueden renovar préstamos activos o vencidos' };
        }

        const ahora = new Date();
        const prestamoActualizado = {
            ...prestamo,
            estado: 'renovacion_solicitada' as const,
            fecha_solicitud_renovacion: ahora.toISOString()
        };

        setPrestamos(prev => prev.map(p => p.id === prestamoId ? prestamoActualizado : p));

        try {
            if (useLocal) {
                const localApi = import.meta.env.VITE_LOCAL_API_URL || 'http://localhost:3000';
                await fetch(`${localApi}/prestamos?id=eq.${prestamoId}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        estado: 'renovacion_solicitada',
                        fecha_solicitud_renovacion: ahora.toISOString()
                    })
                });
            } else {
                const { error } = await supabase
                    .from('prestamos')
                    .update({
                        estado: 'renovacion_solicitada',
                        fecha_solicitud_renovacion: ahora.toISOString()
                    })
                    .eq('id', prestamoId);
                if (error) throw error;
            }

            fetchPrestamos();
            return { success: true, message: 'Solicitud de renovación enviada. Espera la aprobación del administrador.' };
        } catch (error: any) {
            setPrestamos(prev => prev.map(p => p.id === prestamoId ? prestamo : p));
            return { success: false, message: error.message || 'Error al solicitar renovación' };
        }
    };

    const aprobarRenovacion = async (prestamoId: string) => {
        const prestamo = prestamos.find(p => p.id === prestamoId);
        if (!prestamo) return { success: false, message: 'Préstamo no encontrado' };

        const diasExtension = config?.dias_maximos_prestamo || 14;
        const baseFecha = new Date(prestamo.fecha_devolucion_esperada);
        const ahora = new Date();
        const fechaBase = baseFecha > ahora ? baseFecha : ahora;
        const nuevaFecha = new Date(fechaBase);
        nuevaFecha.setDate(nuevaFecha.getDate() + diasExtension);

        const prestamoActualizado = {
            ...prestamo,
            estado: 'activo' as const,
            fecha_devolucion_esperada: nuevaFecha.toISOString()
        };

        setPrestamos(prev => prev.map(p => p.id === prestamoId ? prestamoActualizado : p));

        try {
            if (useLocal) {
                const localApi = import.meta.env.VITE_LOCAL_API_URL || 'http://localhost:3000';
                await fetch(`${localApi}/prestamos?id=eq.${prestamoId}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        estado: 'activo',
                        fecha_devolucion_esperada: nuevaFecha.toISOString()
                    })
                });
            } else {
                const { error } = await supabase
                    .from('prestamos')
                    .update({
                        estado: 'activo',
                        fecha_devolucion_esperada: nuevaFecha.toISOString()
                    })
                    .eq('id', prestamoId);
                if (error) throw error;
            }

            fetchPrestamos();
            return { success: true, message: `Renovación aprobada. Nueva fecha: ${nuevaFecha.toLocaleDateString('es-CL')}` };
        } catch (error: any) {
            setPrestamos(prev => prev.map(p => p.id === prestamoId ? prestamo : p));
            return { success: false, message: error.message || 'Error al aprobar renovación' };
        }
    };

    const rechazarRenovacion = async (prestamoId: string) => {
        const prestamo = prestamos.find(p => p.id === prestamoId);
        if (!prestamo) return { success: false, message: 'Préstamo no encontrado' };

        const estadoAnterior = verificarVencimiento(prestamo).estado;
        setPrestamos(prev => prev.map(p => p.id === prestamoId ? { ...p, estado: estadoAnterior } : p));

        try {
            if (useLocal) {
                const localApi = import.meta.env.VITE_LOCAL_API_URL || 'http://localhost:3000';
                await fetch(`${localApi}/prestamos?id=eq.${prestamoId}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ estado: estadoAnterior })
                });
            } else {
                const { error } = await supabase
                    .from('prestamos')
                    .update({ estado: estadoAnterior })
                    .eq('id', prestamoId);
                if (error) throw error;
            }

            fetchPrestamos();
            return { success: true, message: 'Renovación rechazada.' };
        } catch (error: any) {
            setPrestamos(prev => prev.map(p => p.id === prestamoId ? prestamo : p));
            return { success: false, message: error.message || 'Error al rechazar renovación' };
        }
    };

    useEffect(() => {
        fetchPrestamos();
        fetchConfig();
    }, [fetchPrestamos, fetchConfig]);

    return {
        prestamos,
        config,
        loading,
        prestamosPendientes,
        solicitarPrestamo,
        aprobarPrestamo,
        rechazarPrestamo,
        solicitarDevolucion,
        aprobarDevolucion,
        rechazarDevolucion,
        solicitarRenovacion,
        aprobarRenovacion,
        rechazarRenovacion,
        refreshPrestamos: fetchPrestamos
    };
};

function verificarVencimiento(prestamo: Prestamo): Prestamo {
    if (prestamo.estado === 'activo') {
        const ahora = new Date();
        const fechaEsperada = new Date(prestamo.fecha_devolucion_esperada);
        if (ahora > fechaEsperada) {
            return { ...prestamo, estado: 'vencido' as const };
        }
    }
    return prestamo;
}
