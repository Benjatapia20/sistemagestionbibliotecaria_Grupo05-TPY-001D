import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { Mail, Lock, ShieldCheck, RefreshCw } from 'lucide-react';

interface VerificarCuentaProps {
    userId: string;
    username: string;
    currentRole: string;
    onVerified: () => void;
}

export const VerificarCuenta = ({ userId, username, currentRole, onVerified }: VerificarCuentaProps) => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);

    const handleVerify = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        const localApi = import.meta.env.VITE_LOCAL_API_URL || 'http://localhost:3000';

        try {
            // 1. Crear cuenta en Supabase Auth
            //    El trigger crea un registro en usuarios con id = authUserId
            const { data: authData, error: authError } = await supabase.auth.signUp({
                email,
                password,
                options: {
                    data: {
                        username: username,
                        old_role: currentRole
                    }
                }
            });

            if (authError) throw authError;
            if (!authData.user) throw new Error('No se pudo crear la cuenta');

            const authUserId = authData.user.id;

            // 2. Obtener favoritos locales para migrar
            let localFavoritos: any[] = [];
            try {
                const res = await fetch(`${localApi}/favoritos?usuario_id=eq.${userId}`);
                localFavoritos = res.ok ? await res.json() : [];
            } catch (e) {}

            // 3. Obtener préstamos locales para migrar
            let localPrestamos: any[] = [];
            try {
                const res = await fetch(`${localApi}/prestamos?usuario_id=eq.${userId}`);
                localPrestamos = res.ok ? await res.json() : [];
            } catch (e) {}

            // 4. Sobreescribir el registro del trigger con el UUID local
            //    onConflict: 'username' actualiza el registro existente
            //    cambiando el id al UUID local para que coincida con favoritos/prestamos
            const { error: userError } = await supabase
                .from('usuarios')
                .upsert({
                    id: userId,
                    username: username,
                    email: email,
                    rol: currentRole,
                    tipo_auth: 'supabase',
                    auth_ref_id: authUserId,
                    activo: true
                }, { onConflict: 'username' });

            if (userError) {
                console.error('Error upsert usuario:', userError);
                // Si falla el upsert por username, intentar con el id de auth
                await supabase.from('usuarios').upsert({
                    id: authUserId,
                    username: username,
                    email: email,
                    rol: currentRole,
                    tipo_auth: 'supabase',
                    auth_ref_id: authUserId,
                    activo: true
                }, { onConflict: 'id' });
            }

            // 5. Migrar favoritos a Supabase
            let favsMigrados = 0;
            for (const fav of localFavoritos) {
                try {
                    const { error } = await supabase.from('favoritos').upsert({
                        usuario_id: userId,
                        libro_id: fav.libro_id
                    }, { onConflict: 'usuario_id,libro_id' });
                    if (!error) favsMigrados++;
                } catch (e) {}
            }

            // 6. Migrar préstamos a Supabase
            let prestamosMigrados = 0;
            for (const p of localPrestamos) {
                try {
                    const { error } = await supabase.from('prestamos').insert({
                        id: p.id,
                        usuario_id: userId,
                        libro_id: p.libro_id,
                        estado: p.estado,
                        fecha_solicitud: p.fecha_solicitud,
                        fecha_aprobacion: p.fecha_aprobacion,
                        fecha_devolucion_esperada: p.fecha_devolucion_esperada,
                        fecha_devolucion_real: p.fecha_devolucion_real,
                        multa: p.multa || 0,
                        multa_pagada: p.multa_pagada || false,
                        observaciones: p.observaciones,
                        observaciones_devolucion: p.observaciones_devolucion,
                        estado_libro_devolucion: p.estado_libro_devolucion,
                        fecha_solicitud_devolucion: p.fecha_solicitud_devolucion,
                        fecha_solicitud_renovacion: p.fecha_solicitud_renovacion,
                        created_at: p.created_at
                    });
                    if (!error) prestamosMigrados++;
                } catch (e) {}
            }

            // 7. Actualizar usuario local con datos de vinculación
            await fetch(`${localApi}/usuarios?id=eq.${userId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: email,
                    tipo_auth: 'supabase',
                    auth_ref_id: authUserId
                })
            });

            // 8. Actualizar cuentas_temporales local
            try {
                await fetch(`${localApi}/cuentas_temporales?username=eq.${username}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ auth_id: authUserId, email: email })
                });
            } catch (e) {}

            // 9. Actualizar sesión local con el email
            const tempSession = localStorage.getItem("biblio_temp_session");
            if (tempSession) {
                const parsed = JSON.parse(tempSession);
                parsed.user.email = email;
                localStorage.setItem("biblio_temp_session", JSON.stringify(parsed));
            }

            const migradosMsg = [];
            if (favsMigrados > 0) migradosMsg.push(`${favsMigrados} favoritos`);
            if (prestamosMigrados > 0) migradosMsg.push(`${prestamosMigrados} préstamos`);
            const extra = migradosMsg.length > 0
                ? ` Se migraron ${migradosMsg.join(' y ')}.`
                : '';

            alert(`¡Cuenta vinculada!${extra}\n\nYa puedes alternar entre Local y Supabase con el switch de Ajustes.`);
            onVerified();
        } catch (error: any) {
            alert(error.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-2xl p-6 text-white shadow-xl">
            <div className="flex items-center gap-3 mb-4">
                <ShieldCheck className="w-8 h-8 text-blue-200" />
                <div>
                    <h3 className="text-xl font-bold">Vincular con la nube</h3>
                    <p className="text-blue-100 text-sm">Asocia tu cuenta "{username}" a Supabase.</p>
                </div>
            </div>

            <form onSubmit={handleVerify} className="space-y-4">
                <div className="space-y-2">
                    <label className="text-xs font-semibold uppercase tracking-wider text-blue-200">Tu correo</label>
                    <div className="relative text-slate-900">
                        <Mail className="absolute left-3 top-3 text-slate-400 w-5 h-5" />
                        <input
                            type="email"
                            required
                            className="w-full pl-10 pr-4 py-3 rounded-xl bg-white focus:ring-2 focus:ring-blue-400 outline-none"
                            placeholder="tu@correo.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                        />
                    </div>
                </div>

                <div className="space-y-2">
                    <label className="text-xs font-semibold uppercase tracking-wider text-blue-200">Contraseña para login online</label>
                    <div className="relative text-slate-900">
                        <Lock className="absolute left-3 top-3 text-slate-400 w-5 h-5" />
                        <input
                            type="password"
                            required
                            minLength={6}
                            className="w-full pl-10 pr-4 py-3 rounded-xl bg-white focus:ring-2 focus:ring-blue-400 outline-none"
                            placeholder="Mínimo 6 caracteres"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                        />
                    </div>
                </div>

                <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-white text-blue-600 font-bold py-3 rounded-xl hover:bg-blue-50 transition-colors flex items-center justify-center gap-2 shadow-lg"
                >
                    {loading ? (
                        <RefreshCw className="w-5 h-5 animate-spin" />
                    ) : (
                        "Vincular cuenta"
                    )}
                </button>
            </form>
        </div>
    );
};
