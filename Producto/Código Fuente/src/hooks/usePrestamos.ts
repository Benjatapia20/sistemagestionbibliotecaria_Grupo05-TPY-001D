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
    libro?: { id: number; titulo: string; autor: string; caratula?: string; caratula_url?: string; stock: number; };
    usuario?: { id: string; username: string; email?: string; };
}

export interface ConfigPrestamos {
    id: number; dias_maximos_prestamo: number; multa_por_dia: number;
    max_prestamos_activos: number; renovaciones_permitidas: number;
}

const LAPI = import.meta.env.VITE_LOCAL_API_URL || 'http://localhost:3000';

export const usePrestamos = (userId: string | undefined, userRole: 'admin' | 'usuario', useLocal: boolean) => {
    const [prestamos, setPrestamos] = useState<Prestamo[]>([]);
    const [config, setConfig] = useState<ConfigPrestamos | null>(null);
    const [loading, setLoading] = useState(false);
    const [prestamosPendientes, setPrestamosPendientes] = useState(0);
    const { addToQueue } = useOfflineQueue();

    // Helper: guardar acción en Supabase para que el sync la lea luego
    const saveOnlineAction = async (type: string, payload: any) => {
        if (!useLocal && userId) {
            try {
                await supabase.from('acciones_pendientes').insert({
                    type, usuario_id: userId, payload, aplicado: false
                });
            } catch {}
        }
    };

    const fetchPrestamos = useCallback(async () => {
        if (!userId) return;
        setLoading(true);
        try {
            if (useLocal) {
                const s = '*,libro:libros(id,titulo,autor,caratula,caratula_url,stock),usuario:usuarios(id,username,email)';
                const url = userRole === 'admin'
                    ? `${LAPI}/prestamos?select=${s}&order=created_at.desc`
                    : `${LAPI}/prestamos?select=${s}&usuario_id=eq.${userId}&order=created_at.desc`;
                const res = await fetch(url);
                if (res.ok) {
                    let data: Prestamo[] = await res.json();
                    data = data.map(p => verificarVencimiento(p));
                    setPrestamos(data);
                    setPrestamosPendientes(data.filter(p => p.estado === 'solicitado' || p.estado === 'devolucion_solicitada' || p.estado === 'renovacion_solicitada').length);
                }
            } else {
                let q = supabase.from('prestamos').select(`*,libro:libros(id,titulo,autor,caratula,caratula_url,stock),usuario:usuarios(id,username,email)`).order('created_at', { ascending: false });
                if (userRole !== 'admin') q = q.eq('usuario_id', userId);
                const { data, error } = await q;
                if (!error && data) {
                    const pd = data.map(p => verificarVencimiento(p));
                    setPrestamos(pd);
                    setPrestamosPendientes(pd.filter(p => p.estado === 'solicitado' || p.estado === 'devolucion_solicitada' || p.estado === 'renovacion_solicitada').length);
                }
            }
        } catch (e) { console.error('fetchPrestamos:', e); }
        finally { setLoading(false); }
    }, [userId, userRole, useLocal]);

    const fetchConfig = useCallback(async () => {
        try {
            if (useLocal) {
                const res = await fetch(`${LAPI}/config_prestamos?id=eq.1`);
                if (res.ok) { const d = await res.json(); if (d.length > 0) setConfig(d[0]); }
            } else {
                const { data, error } = await supabase.from('config_prestamos').select('*').eq('id', 1).single();
                if (!error && data) setConfig(data);
            }
        } catch (e) { console.error('fetchConfig:', e); }
    }, [useLocal]);

    const c = config || { dias_maximos_prestamo: 14, multa_por_dia: 100, max_prestamos_activos: 3, renovaciones_permitidas: 1 };

    // --- MUTACIONES ---

    const solicitarPrestamo = async (libroId: number) => {
        if (!userId) return { success: false, message: 'Usuario no identificado' };
        const activos = prestamos.filter(p => p.usuario_id === userId && (p.estado === 'activo' || p.estado === 'solicitado')).length;
        if (activos >= c.max_prestamos_activos) return { success: false, message: `Máximo ${c.max_prestamos_activos} activos` };
        const ya = prestamos.some(p => p.usuario_id === userId && p.libro_id === libroId && (p.estado === 'activo' || p.estado === 'solicitado'));
        if (ya) return { success: false, message: 'Ya tienes un préstamo para este libro' };

        const fd = new Date(); fd.setDate(fd.getDate() + c.dias_maximos_prestamo);
        const nuevo = { usuario_id: userId, libro_id: libroId, estado: 'solicitado', fecha_devolucion_esperada: fd.toISOString() };
        const tempId = `temp-${Date.now()}`;
        setPrestamos(prev => [{ ...nuevo, id: tempId, fecha_solicitud: new Date().toISOString(), created_at: new Date().toISOString(), estado: 'solicitado' as const }, ...prev]);

        try {
            if (!useLocal) {
                const { data: inserted, error } = await supabase.from('prestamos').insert(nuevo).select('*').single();
                if (error) throw error;
                // Reemplazar temp con el real de Supabase
                setPrestamos(prev => prev.map(p => p.id === tempId ? verificarVencimiento({ ...p, ...inserted, id: inserted.id }) : p));
                // Guardar acción con el ID real de Supabase para que el sync use el mismo
                await saveOnlineAction('solicitar_prestamo', { prestamo: { ...nuevo, id: inserted.id } });
            } else {
                const res = await fetch(`${LAPI}/prestamos`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Prefer': 'return=representation' }, body: JSON.stringify(nuevo) });
                if (!res.ok) throw new Error('Error local');
                const data = await res.json();
                if (data && data[0]) setPrestamos(prev => prev.map(p => p.id === tempId ? verificarVencimiento({ ...p, ...data[0], id: data[0].id }) : p));
                try { await fetch(`${LAPI}/acciones_pendientes`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'solicitar_prestamo', usuario_id: userId, payload: { prestamo: nuevo }, aplicado: true }) }); } catch {}
            }
            fetchPrestamos();
            return { success: true, message: 'Préstamo solicitado' };
        } catch {
            addToQueue({ type: 'solicitar_prestamo', payload: { prestamo: nuevo }, userId });
            return { success: true, message: 'Encolado. Se aplicará al sincronizar.' };
        }
    };

    const aprobarPrestamo = async (prestamoId: string) => {
        const p = prestamos.find(x => x.id === prestamoId);
        if (!p) return { success: false, message: 'No encontrado' };
        setPrestamos(prev => prev.map(x => x.id === prestamoId ? { ...x, estado: 'activo' as const, fecha_aprobacion: new Date().toISOString() } : x));
        try {
            if (!useLocal) {
                const { data: libro } = await supabase.from('libros').select('stock').eq('id', p.libro_id).single();
                if (!libro || libro.stock <= 0) throw new Error('Sin stock');
                await supabase.from('libros').update({ stock: libro.stock - 1 }).eq('id', p.libro_id).eq('stock', libro.stock);
                await supabase.from('prestamos').update({ estado: 'activo', fecha_aprobacion: new Date().toISOString() }).eq('id', prestamoId);
                await saveOnlineAction('aprobar_prestamo', { prestamo_id: prestamoId });
            } else {
                const res = await fetch(`${LAPI}/rpc/aprobar_prestamo_op`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prestamo_id: prestamoId }) });
                const result = await res.json();
                if (!result.success) throw new Error(result.message);
            }
            fetchPrestamos();
            return { success: true, message: 'Aprobado' };
        } catch (e: any) {
            setPrestamos(prev => prev.map(x => x.id === prestamoId ? p : x));
            return { success: false, message: e.message || 'Error al aprobar' };
        }
    };

    const rechazarPrestamo = async (prestamoId: string) => {
        if (!prestamos.find(x => x.id === prestamoId)) return { success: false, message: 'No encontrado' };
        setPrestamos(prev => prev.map(x => x.id === prestamoId ? { ...x, estado: 'rechazado' as const } : x));
        try {
            if (!useLocal) {
                await supabase.from('prestamos').update({ estado: 'rechazado' }).eq('id', prestamoId);
                await saveOnlineAction('rechazar_prestamo', { prestamo_id: prestamoId });
            } else {
                await fetch(`${LAPI}/rpc/rechazar_prestamo_op`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prestamo_id: prestamoId }) });
            }
            fetchPrestamos();
            return { success: true, message: 'Rechazado' };
        } catch (e: any) { return { success: false, message: e.message || 'Error' }; }
    };

    const solicitarDevolucion = async (prestamoId: string, estadoLibro: string, observaciones: string) => {
        const p = prestamos.find(x => x.id === prestamoId);
        if (!p) return { success: false, message: 'No encontrado' };
        const ahora = new Date();
        const dias = Math.max(0, Math.floor((ahora.getTime() - new Date(p.fecha_devolucion_esperada).getTime()) / 86400000));
        const me = dias * c.multa_por_dia;
        setPrestamos(prev => prev.map(x => x.id === prestamoId ? { ...x, estado: 'devolucion_solicitada' as const, fecha_solicitud_devolucion: ahora.toISOString(), estado_libro_devolucion: estadoLibro, observaciones_devolucion: observaciones || x.observaciones } : x));
        try {
            if (!useLocal) {
                await supabase.from('prestamos').update({ estado: 'devolucion_solicitada', fecha_solicitud_devolucion: ahora.toISOString(), estado_libro_devolucion: estadoLibro, observaciones_devolucion: observaciones || p.observaciones }).eq('id', prestamoId);
                await saveOnlineAction('solicitar_devolucion', { prestamo_id: prestamoId, estado_libro: estadoLibro });
            } else {
                await fetch(`${LAPI}/rpc/solicitar_devolucion_op`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prestamo_id: prestamoId, p_estado_libro: estadoLibro, p_observaciones: observaciones || p.observaciones }) });
            }
            fetchPrestamos();
            return { success: true, message: 'Devolución solicitada', multaEstimada: me, diasAtraso: dias };
        } catch (e: any) { setPrestamos(prev => prev.map(x => x.id === prestamoId ? p : x)); return { success: false, message: e.message || 'Error' }; }
    };

    const aprobarDevolucion = async (prestamoId: string) => {
        const p = prestamos.find(x => x.id === prestamoId);
        if (!p) return { success: false, message: 'No encontrado' };
        const ahora = new Date();
        const dias = Math.max(0, Math.floor((ahora.getTime() - new Date(p.fecha_devolucion_esperada).getTime()) / 86400000));
        let multa = dias * c.multa_por_dia;
        if (p.estado_libro_devolucion === 'danado') multa += c.multa_por_dia * 7;
        if (p.estado_libro_devolucion === 'perdido') multa += c.multa_por_dia * 30;
        setPrestamos(prev => prev.map(x => x.id === prestamoId ? { ...x, estado: 'devuelto' as const, fecha_devolucion_real: ahora.toISOString(), multa } : x));
        try {
            if (!useLocal) {
                const { data: libro } = await supabase.from('libros').select('stock').eq('id', p.libro_id).single();
                if (libro) await supabase.from('libros').update({ stock: libro.stock + 1 }).eq('id', p.libro_id);
                await supabase.from('prestamos').update({ estado: 'devuelto', fecha_devolucion_real: ahora.toISOString(), multa }).eq('id', prestamoId);
                await saveOnlineAction('aprobar_devolucion', { prestamo_id: prestamoId, multa });
            } else {
                await fetch(`${LAPI}/rpc/aprobar_devolucion_op`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prestamo_id: prestamoId, p_multa: multa }) });
            }
            fetchPrestamos();
            return { success: true, message: 'Devuelto', multa, diasAtraso: dias };
        } catch (e: any) { setPrestamos(prev => prev.map(x => x.id === prestamoId ? p : x)); return { success: false, message: e.message || 'Error' }; }
    };

    const rechazarDevolucion = async (prestamoId: string) => {
        const p = prestamos.find(x => x.id === prestamoId);
        if (!p) return { success: false, message: 'No encontrado' };
        const ea = p.estado === 'vencido' ? 'vencido' : 'activo';
        setPrestamos(prev => prev.map(x => x.id === prestamoId ? { ...x, estado: ea as any } : x));
        try {
            if (!useLocal) {
                await supabase.from('prestamos').update({ estado: ea }).eq('id', prestamoId);
                await saveOnlineAction('rechazar_devolucion', { prestamo_id: prestamoId });
            } else {
                await fetch(`${LAPI}/rpc/rechazar_devolucion_op`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prestamo_id: prestamoId }) });
            }
            fetchPrestamos();
            return { success: true, message: 'Rechazado' };
        } catch (e: any) { setPrestamos(prev => prev.map(x => x.id === prestamoId ? p : x)); return { success: false, message: e.message || 'Error' }; }
    };

    const solicitarRenovacion = async (prestamoId: string) => {
        const p = prestamos.find(x => x.id === prestamoId);
        if (!p) return { success: false, message: 'No encontrado' };
        if (p.estado !== 'activo' && p.estado !== 'vencido') return { success: false, message: 'Solo activos o vencidos' };
        setPrestamos(prev => prev.map(x => x.id === prestamoId ? { ...x, estado: 'renovacion_solicitada' as const, fecha_solicitud_renovacion: new Date().toISOString() } : x));
        try {
            if (!useLocal) {
                await supabase.from('prestamos').update({ estado: 'renovacion_solicitada', fecha_solicitud_renovacion: new Date().toISOString() }).eq('id', prestamoId);
                await saveOnlineAction('solicitar_renovacion', { prestamo_id: prestamoId });
            } else {
                await fetch(`${LAPI}/rpc/solicitar_renovacion_op`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prestamo_id: prestamoId }) });
            }
            fetchPrestamos();
            return { success: true, message: 'Renovación solicitada' };
        } catch (e: any) { setPrestamos(prev => prev.map(x => x.id === prestamoId ? p : x)); return { success: false, message: e.message || 'Error' }; }
    };

    const aprobarRenovacion = async (prestamoId: string) => {
        const p = prestamos.find(x => x.id === prestamoId);
        if (!p) return { success: false, message: 'No encontrado' };
        const de = c.dias_maximos_prestamo;
        const fb = new Date(Math.max(new Date(p.fecha_devolucion_esperada).getTime(), Date.now())); fb.setDate(fb.getDate() + de);
        setPrestamos(prev => prev.map(x => x.id === prestamoId ? { ...x, estado: 'activo' as const, fecha_devolucion_esperada: fb.toISOString() } : x));
        try {
            if (!useLocal) {
                await supabase.from('prestamos').update({ estado: 'activo', fecha_devolucion_esperada: fb.toISOString() }).eq('id', prestamoId);
                await saveOnlineAction('aprobar_renovacion', { prestamo_id: prestamoId });
            } else {
                await fetch(`${LAPI}/rpc/aprobar_renovacion_op`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prestamo_id: prestamoId, p_dias_extension: de }) });
            }
            fetchPrestamos();
            return { success: true, message: `Renovado hasta ${fb.toLocaleDateString('es-CL')}` };
        } catch (e: any) { setPrestamos(prev => prev.map(x => x.id === prestamoId ? p : x)); return { success: false, message: e.message || 'Error' }; }
    };

    const rechazarRenovacion = async (prestamoId: string) => {
        const p = prestamos.find(x => x.id === prestamoId);
        if (!p) return { success: false, message: 'No encontrado' };
        const ea = verificarVencimiento(p).estado;
        setPrestamos(prev => prev.map(x => x.id === prestamoId ? { ...x, estado: ea } : x));
        try {
            if (!useLocal) {
                await supabase.from('prestamos').update({ estado: ea }).eq('id', prestamoId);
                await saveOnlineAction('rechazar_renovacion', { prestamo_id: prestamoId });
            } else {
                await fetch(`${LAPI}/rpc/rechazar_renovacion_op`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prestamo_id: prestamoId }) });
            }
            fetchPrestamos();
            return { success: true, message: 'Rechazado' };
        } catch (e: any) { setPrestamos(prev => prev.map(x => x.id === prestamoId ? p : x)); return { success: false, message: e.message || 'Error' }; }
    };

    useEffect(() => { fetchPrestamos(); fetchConfig(); }, [fetchPrestamos, fetchConfig]);

    return { prestamos, config, loading, prestamosPendientes, solicitarPrestamo, aprobarPrestamo, rechazarPrestamo, solicitarDevolucion, aprobarDevolucion, rechazarDevolucion, solicitarRenovacion, aprobarRenovacion, rechazarRenovacion, refreshPrestamos: fetchPrestamos };
};

function verificarVencimiento(prestamo: Prestamo): Prestamo {
    if (prestamo.estado === 'activo' && new Date() > new Date(prestamo.fecha_devolucion_esperada)) return { ...prestamo, estado: 'vencido' as const };
    return prestamo;
}
