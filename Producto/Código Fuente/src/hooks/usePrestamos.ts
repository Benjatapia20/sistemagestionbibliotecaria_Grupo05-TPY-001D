import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useOfflineQueue } from './useOfflineQueue';

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
        id: string;
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

const L = import.meta.env.VITE_LOCAL_API_URL || 'http://localhost:3000';

export const usePrestamos = (userId: string | undefined, userRole: 'admin' | 'usuario', useLocal: boolean) => {
    const [prestamos, setPrestamos] = useState<Prestamo[]>([]);
    const [config, setConfig] = useState<ConfigPrestamos | null>(null);
    const [loading, setLoading] = useState(false);
    const [prestamosPendientes, setPrestamosPendientes] = useState(0);
    const { addToQueue } = useOfflineQueue();

    const localApi = L;

    const fetchPrestamos = useCallback(async () => {
        if (!userId) return;
        setLoading(true);
        try {
            if (useLocal) {
                const select = '*,libro:libros(id,titulo,autor,caratula,caratula_url,stock),usuario:usuarios(id,username,email)';
                const url = userRole === 'admin'
                    ? `${localApi}/prestamos?select=${select}&order=created_at.desc`
                    : `${localApi}/prestamos?select=${select}&usuario_id=eq.${userId}&order=created_at.desc`;
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
                let query = supabase.from('prestamos').select(`*,libro:libros(id,titulo,autor,caratula,caratula_url,stock),usuario:usuarios(id,username,email)`).order('created_at', { ascending: false });
                if (userRole !== 'admin') query = query.eq('usuario_id', userId);
                const { data, error } = await query;
                if (!error && data) {
                    const processedData = data.map(p => verificarVencimiento(p));
                    setPrestamos(processedData);
                    setPrestamosPendientes(processedData.filter(p =>
                        p.estado === 'solicitado' || p.estado === 'devolucion_solicitada' || p.estado === 'renovacion_solicitada'
                    ).length);
                }
            }
        } catch (error) { console.error('Error fetching prestamos:', error); }
        finally { setLoading(false); }
    }, [userId, userRole, useLocal]);

    const fetchConfig = useCallback(async () => {
        try {
            if (useLocal) {
                const res = await fetch(`${localApi}/config_prestamos?id=eq.1`);
                if (res.ok) { const data = await res.json(); if (data.length > 0) setConfig(data[0]); }
            } else {
                const { data, error } = await supabase.from('config_prestamos').select('*').eq('id', 1).single();
                if (!error && data) setConfig(data);
            }
        } catch (error) { console.error('Error fetching config:', error); }
    }, [useLocal]);

    // Helpers
    const rpc = async (fn: string, body: Record<string, any>): Promise<any> => {
        const res = await fetch(`${localApi}/rpc/${fn}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        if (!res.ok) throw new Error(`RPC ${fn} failed`);
        return res.json();
    };

    const saveAccion = async (type: string, payload: any, aplicado: boolean) => {
        try {
            await fetch(`${localApi}/acciones_pendientes`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ type, usuario_id: userId || '00000000-0000-0000-0000-000000000000', payload, aplicado })
            });
        } catch {}
    };

    // ----- MUTACIONES -----

    const solicitarPrestamo = async (libroId: number) => {
        if (!userId) return { success: false, message: 'Usuario no identificado' };
        const c = config || { dias_maximos_prestamo: 14, multa_por_dia: 100, max_prestamos_activos: 3, renovaciones_permitidas: 1 };
        const activos = prestamos.filter(p => p.usuario_id === userId && (p.estado === 'activo' || p.estado === 'solicitado')).length;
        if (activos >= c.max_prestamos_activos) return { success: false, message: `Máximo ${c.max_prestamos_activos} préstamos activos` };
        const ya = prestamos.some(p => p.usuario_id === userId && p.libro_id === libroId && (p.estado === 'activo' || p.estado === 'solicitado'));
        if (ya) return { success: false, message: 'Ya tienes un préstamo para este libro' };

        const fechaDev = new Date(); fechaDev.setDate(fechaDev.getDate() + c.dias_maximos_prestamo);
        const nuevo = { usuario_id: userId, libro_id: libroId, estado: 'solicitado', fecha_devolucion_esperada: fechaDev.toISOString() };
        const tempId = `temp-${Date.now()}`;
        setPrestamos(prev => [{ ...nuevo, id: tempId, fecha_solicitud: new Date().toISOString(), created_at: new Date().toISOString(), estado: 'solicitado' as const }, ...prev]);

        try {
            const res = await fetch(`${localApi}/prestamos`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Prefer': 'return=representation' }, body: JSON.stringify(nuevo) });
            if (!res.ok) throw new Error('Error');
            await saveAccion('solicitar_prestamo', { prestamo: nuevo }, true);
            fetchPrestamos();
            return { success: true, message: 'Préstamo solicitado' };
        } catch {
            addToQueue({ type: 'solicitar_prestamo', payload: { prestamo: nuevo }, userId });
            await saveAccion('solicitar_prestamo', { prestamo: nuevo }, false);
            return { success: true, message: 'Encolado. Se aplicará al sincronizar.' };
        }
    };

    const aprobarPrestamo = async (prestamoId: string) => {
        const p = prestamos.find(x => x.id === prestamoId);
        if (!p) return { success: false, message: 'No encontrado' };
        setPrestamos(prev => prev.map(x => x.id === prestamoId ? { ...x, estado: 'activo' as const, fecha_aprobacion: new Date().toISOString() } : x));
        try {
            const result = await rpc('aprobar_prestamo_op', { prestamo_id: prestamoId });
            if (!result.success) throw new Error(result.message);
            await saveAccion('aprobar_prestamo', { prestamoId }, true);
            fetchPrestamos();
            return { success: true, message: result.message };
        } catch (e: any) {
            setPrestamos(prev => prev.map(x => x.id === prestamoId ? p : x));
            return { success: false, message: e.message || 'Error al aprobar' };
        }
    };

    const rechazarPrestamo = async (prestamoId: string) => {
        if (!prestamos.find(x => x.id === prestamoId)) return { success: false, message: 'No encontrado' };
        setPrestamos(prev => prev.map(x => x.id === prestamoId ? { ...x, estado: 'rechazado' as const } : x));
        try {
            const result = await rpc('rechazar_prestamo_op', { prestamo_id: prestamoId });
            if (!result.success) throw new Error(result.message);
            await saveAccion('rechazar_prestamo', { prestamoId }, true);
            fetchPrestamos();
            return { success: true, message: result.message };
        } catch (e: any) {
            return { success: false, message: e.message || 'Error al rechazar' };
        }
    };

    const solicitarDevolucion = async (prestamoId: string, estadoLibro: string, observaciones: string) => {
        const p = prestamos.find(x => x.id === prestamoId);
        if (!p) return { success: false, message: 'No encontrado' };
        const ahora = new Date(), fechaEsp = new Date(p.fecha_devolucion_esperada);
        const dias = Math.max(0, Math.floor((ahora.getTime() - fechaEsp.getTime()) / 86400000));
        const multaEst = dias * (config?.multa_por_dia || 100);
        setPrestamos(prev => prev.map(x => x.id === prestamoId ? { ...x, estado: 'devolucion_solicitada' as const, fecha_solicitud_devolucion: ahora.toISOString(), estado_libro_devolucion: estadoLibro, observaciones_devolucion: observaciones || x.observaciones } : x));
        try {
            const result = await rpc('solicitar_devolucion_op', { prestamo_id: prestamoId, p_estado_libro: estadoLibro, p_observaciones: observaciones || p.observaciones });
            if (!result.success) throw new Error(result.message);
            await saveAccion('solicitar_devolucion', { prestamoId, estadoLibro }, true);
            fetchPrestamos();
            return { success: true, message: result.message, multaEstimada: multaEst, diasAtraso: dias };
        } catch (e: any) {
            setPrestamos(prev => prev.map(x => x.id === prestamoId ? p : x));
            return { success: false, message: e.message || 'Error' };
        }
    };

    const aprobarDevolucion = async (prestamoId: string) => {
        const p = prestamos.find(x => x.id === prestamoId);
        if (!p) return { success: false, message: 'No encontrado' };
        const ahora = new Date(), fechaEsp = new Date(p.fecha_devolucion_esperada);
        const dias = Math.max(0, Math.floor((ahora.getTime() - fechaEsp.getTime()) / 86400000));
        let multa = dias * (config?.multa_por_dia || 100);
        if (p.estado_libro_devolucion === 'danado') multa += (config?.multa_por_dia || 100) * 7;
        if (p.estado_libro_devolucion === 'perdido') multa += (config?.multa_por_dia || 100) * 30;
        setPrestamos(prev => prev.map(x => x.id === prestamoId ? { ...x, estado: 'devuelto' as const, fecha_devolucion_real: ahora.toISOString(), multa } : x));
        try {
            const result = await rpc('aprobar_devolucion_op', { prestamo_id: prestamoId, p_estado_libro: p.estado_libro_devolucion, p_multa: multa });
            if (!result.success) throw new Error(result.message);
            await saveAccion('aprobar_devolucion', { prestamoId, multa }, true);
            fetchPrestamos();
            return { success: true, message: result.message, multa, diasAtraso: dias };
        } catch (e: any) {
            setPrestamos(prev => prev.map(x => x.id === prestamoId ? p : x));
            return { success: false, message: e.message || 'Error' };
        }
    };

    const rechazarDevolucion = async (prestamoId: string) => {
        const p = prestamos.find(x => x.id === prestamoId);
        if (!p) return { success: false, message: 'No encontrado' };
        const ea = p.estado === 'vencido' ? 'vencido' : 'activo';
        setPrestamos(prev => prev.map(x => x.id === prestamoId ? { ...x, estado: ea as any } : x));
        try {
            const result = await rpc('rechazar_devolucion_op', { prestamo_id: prestamoId });
            if (!result.success) throw new Error(result.message);
            await saveAccion('rechazar_devolucion', { prestamoId }, true);
            fetchPrestamos();
            return { success: true, message: result.message };
        } catch (e: any) {
            setPrestamos(prev => prev.map(x => x.id === prestamoId ? p : x));
            return { success: false, message: e.message || 'Error' };
        }
    };

    const solicitarRenovacion = async (prestamoId: string) => {
        const p = prestamos.find(x => x.id === prestamoId);
        if (!p) return { success: false, message: 'No encontrado' };
        if (p.estado !== 'activo' && p.estado !== 'vencido') return { success: false, message: 'Solo activos o vencidos' };
        const ahora = new Date();
        setPrestamos(prev => prev.map(x => x.id === prestamoId ? { ...x, estado: 'renovacion_solicitada' as const, fecha_solicitud_renovacion: ahora.toISOString() } : x));
        try {
            const result = await rpc('solicitar_renovacion_op', { prestamo_id: prestamoId });
            if (!result.success) throw new Error(result.message);
            await saveAccion('solicitar_renovacion', { prestamoId }, true);
            fetchPrestamos();
            return { success: true, message: result.message };
        } catch (e: any) {
            setPrestamos(prev => prev.map(x => x.id === prestamoId ? p : x));
            return { success: false, message: e.message || 'Error' };
        }
    };

    const aprobarRenovacion = async (prestamoId: string) => {
        const p = prestamos.find(x => x.id === prestamoId);
        if (!p) return { success: false, message: 'No encontrado' };
        const diasExt = config?.dias_maximos_prestamo || 14;
        const base = new Date(p.fecha_devolucion_esperada), ahora = new Date();
        const fb = base > ahora ? base : ahora; fb.setDate(fb.getDate() + diasExt);
        setPrestamos(prev => prev.map(x => x.id === prestamoId ? { ...x, estado: 'activo' as const, fecha_devolucion_esperada: fb.toISOString() } : x));
        try {
            const result = await rpc('aprobar_renovacion_op', { prestamo_id: prestamoId, p_dias_extension: diasExt });
            if (!result.success) throw new Error(result.message);
            await saveAccion('aprobar_renovacion', { prestamoId }, true);
            fetchPrestamos();
            return { success: true, message: `Renovado. Nueva fecha: ${fb.toLocaleDateString('es-CL')}` };
        } catch (e: any) {
            setPrestamos(prev => prev.map(x => x.id === prestamoId ? p : x));
            return { success: false, message: e.message || 'Error' };
        }
    };

    const rechazarRenovacion = async (prestamoId: string) => {
        const p = prestamos.find(x => x.id === prestamoId);
        if (!p) return { success: false, message: 'No encontrado' };
        const ea = verificarVencimiento(p).estado;
        setPrestamos(prev => prev.map(x => x.id === prestamoId ? { ...x, estado: ea } : x));
        try {
            const result = await rpc('rechazar_renovacion_op', { prestamo_id: prestamoId });
            if (!result.success) throw new Error(result.message);
            await saveAccion('rechazar_renovacion', { prestamoId }, true);
            fetchPrestamos();
            return { success: true, message: result.message };
        } catch (e: any) {
            setPrestamos(prev => prev.map(x => x.id === prestamoId ? p : x));
            return { success: false, message: e.message || 'Error' };
        }
    };

    useEffect(() => { fetchPrestamos(); fetchConfig(); }, [fetchPrestamos, fetchConfig]);

    return { prestamos, config, loading, prestamosPendientes, solicitarPrestamo, aprobarPrestamo, rechazarPrestamo, solicitarDevolucion, aprobarDevolucion, rechazarDevolucion, solicitarRenovacion, aprobarRenovacion, rechazarRenovacion, refreshPrestamos: fetchPrestamos };
};

function verificarVencimiento(prestamo: Prestamo): Prestamo {
    if (prestamo.estado === 'activo' && new Date() > new Date(prestamo.fecha_devolucion_esperada)) return { ...prestamo, estado: 'vencido' as const };
    return prestamo;
}
