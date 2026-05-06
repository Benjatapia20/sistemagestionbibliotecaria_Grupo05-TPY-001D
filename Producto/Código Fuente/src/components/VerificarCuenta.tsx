import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { Mail, Lock, ShieldCheck, RefreshCw } from 'lucide-react';

interface VerificarCuentaProps {
    username: string;
    currentRole: string;
    onVerified: () => void;
}

export const VerificarCuenta = ({ username, currentRole, onVerified }: VerificarCuentaProps) => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);

    const handleVerify = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            // 1. Registrar en Supabase Auth Oficial
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

            if (authData.user) {
                // 2. Vincular la cuenta temporal con el nuevo Auth ID en la nube
                const { error: updateError } = await supabase
                    .from('cuentas_temporales')
                    .update({
                        auth_id: authData.user.id,
                        email: email // Guardamos el email para referencia
                    })
                    .eq('username', username);

                if (updateError) console.error("Error vinculando cuenta:", updateError);

                // 3. También actualizamos el rol en la tabla de perfiles (que se crea por trigger)
                const { error: profileError } = await supabase
                    .from('profiles')
                    .update({ rol: currentRole })
                    .eq('id', authData.user.id);

                if (profileError) console.error("Error actualizando perfil:", profileError);

                alert('¡Casi listo! Se ha enviado un correo de confirmación a ' + email + '. Una vez que confirmes, podrás entrar con tu correo.');

                // Limpiamos la sesión temporal
                localStorage.removeItem("biblio_temp_session");
                localStorage.removeItem("biblio_role");
                onVerified();
            }
        } catch (error: any) {
            alert(error.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="bg-linear-to-br from-blue-600 to-indigo-700 rounded-2xl p-6 text-white shadow-xl">
            <div className="flex items-center gap-3 mb-4">
                <ShieldCheck className="w-8 h-8 text-blue-200" />
                <div>
                    <h3 className="text-xl font-bold">Verifica tu cuenta</h3>
                    <p className="text-blue-100 text-sm">Convierte tu cuenta temporal "{username}" en una oficial.</p>
                </div>
            </div>

            <form onSubmit={handleVerify} className="space-y-4">
                <div className="space-y-2">
                    <label className="text-xs font-semibold uppercase tracking-wider text-blue-200">Nuevo Correo</label>
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
                    <label className="text-xs font-semibold uppercase tracking-wider text-blue-200">Contraseña Definitiva</label>
                    <div className="relative text-slate-900">
                        <Lock className="absolute left-3 top-3 text-slate-400 w-5 h-5" />
                        <input
                            type="password"
                            required
                            className="w-full pl-10 pr-4 py-3 rounded-xl bg-white focus:ring-2 focus:ring-blue-400 outline-none"
                            placeholder="••••••••"
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
                        "Confirmar y Enviar Correo"
                    )}
                </button>
            </form>
        </div>
    );
};
