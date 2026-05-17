import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { Library, Lock, Mail, Sun, Moon, UserPlus, LogIn, User, Loader2, ShieldCheck } from 'lucide-react';
import { useDarkMode } from '../hooks/useDarkMode';
import bcrypt from 'bcryptjs';

export default function Login() {
    const { isDark, toggleTheme } = useDarkMode();
    const [mode, setMode] = useState<'login' | 'register'>('login');
    const [identifier, setIdentifier] = useState<string>('');
    const [password, setPassword] = useState<string>('');
    const [confirmPassword, setConfirmPassword] = useState<string>('');
    const [loading, setLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);

    const isEmail = identifier.includes('@');
    const isRegisteringLocal = mode === 'register' && !isEmail;

    const switchMode = () => {
        setError(null);
        setIdentifier('');
        setPassword('');
        setConfirmPassword('');
        setMode(mode === 'login' ? 'register' : 'login');
    };

    const handleAuth = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        if (mode === 'register') {
            if (password.length < 6) {
                setError('La contraseña debe tener al menos 6 caracteres.');
                return;
            }
            if (isRegisteringLocal && password !== confirmPassword) {
                setError('Las contraseñas no coinciden.');
                return;
            }
        }

        setLoading(true);

        try {
            if (mode === 'login') {
                if (isEmail) {
                    const { error } = await supabase.auth.signInWithPassword({
                        email: identifier,
                        password
                    });
                    if (error) throw error;
                } else {
                    const localApi = import.meta.env.VITE_LOCAL_API_URL || 'http://localhost:3000';
                    const res = await fetch(`${localApi}/usuarios?username=eq.${identifier}&tipo_auth=eq.local`);
                    if (!res.ok) throw new Error('No se pudo conectar con el servidor local');

                    const users = await res.json();
                    if (users.length === 0) throw new Error('Usuario no encontrado');

                    const userData = users[0];

                    if (!bcrypt.compareSync(password, userData.password)) {
                        throw new Error('Contraseña incorrecta');
                    }

                    localStorage.setItem("biblio_temp_session", JSON.stringify({
                        user: {
                            id: userData.id,
                            username: userData.username,
                            email: userData.email || `${userData.username}@local`,
                            isTemp: true
                        }
                    }));
                    localStorage.setItem("biblio_role", userData.rol);

                    window.location.reload();
                }
            } else {
                if (isEmail) {
                    const { error } = await supabase.auth.signUp({
                        email: identifier,
                        password
                    });
                    if (error) throw error;
                    alert('¡Registro exitoso! Revisa tu correo.');
                    switchMode();
                } else {
                    const hashedPassword = bcrypt.hashSync(password, 10);
                    const newUser = {
                        username: identifier,
                        password: hashedPassword,
                        rol: 'usuario',
                        tipo_auth: 'local'
                    };

                    const localApi = import.meta.env.VITE_LOCAL_API_URL || 'http://localhost:3000';
                    const response = await fetch(`${localApi}/usuarios`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Prefer': 'return=minimal'
                        },
                        body: JSON.stringify(newUser)
                    });

                    if (!response.ok) {
                        const errorData = await response.json().catch(() => ({}));
                        throw new Error(`Error ${response.status}: ${errorData.message || "No se pudo crear la cuenta."}`);
                    }

                    await fetch(`${localApi}/cuentas_temporales`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Prefer': 'return=minimal'
                        },
                        body: JSON.stringify({
                            username: identifier,
                            password: hashedPassword,
                            rol: 'usuario'
                        })
                    }).catch(() => {});

                    alert('Cuenta creada. Ya puedes iniciar sesión.');
                    switchMode();
                }
            }
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-50 p-4 transition-colors duration-300">
            <div className="max-w-md w-full bg-white dark:bg-slate-900 rounded-2xl shadow-xl dark:shadow-slate-900/50 p-8 border border-transparent dark:border-slate-800 transition-colors duration-300 overflow-hidden">
                <div className="flex flex-col items-center mb-8 transition-all duration-300">
                    <div className={`rounded-full mb-4 transition-all duration-500 shadow-lg ${mode === 'login'
                        ? 'bg-blue-600 dark:bg-blue-500 p-3 shadow-blue-500/20'
                        : 'bg-emerald-600 dark:bg-emerald-500 p-3 shadow-emerald-500/20'
                    }`}>
                        {mode === 'login'
                            ? <Library className="text-white w-8 h-8" />
                            : <UserPlus className="text-white w-8 h-8" />
                        }
                    </div>
                    <h1 className="text-2xl font-bold text-slate-800 dark:text-white transition-all duration-300">
                        {mode === 'login' ? 'Bienvenido' : 'Nueva Cuenta'}
                    </h1>
                    <p className="text-slate-500 dark:text-slate-400 text-center text-sm mt-1 transition-all duration-300">
                        {mode === 'login'
                            ? 'Usa tu correo o nombre de usuario local'
                            : 'Usa un nombre de usuario para trabajar sin internet'}
                    </p>
                </div>

                {/* Tabs de modo */}
                <div className="flex mb-6 bg-slate-100 dark:bg-slate-800 rounded-xl p-1 relative">
                    <div className={`absolute top-1 bottom-1 w-1/2 bg-white dark:bg-slate-700 rounded-lg shadow-sm transition-all duration-300 ease-out ${mode === 'register' ? 'translate-x-full' : 'translate-x-0'}`} />
                    <button
                        type="button"
                        onClick={() => { if (mode !== 'login') switchMode(); }}
                        className={`flex-1 py-2.5 text-sm font-semibold rounded-lg relative z-10 transition-colors duration-300 ${mode === 'login' ? 'text-slate-900 dark:text-white' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'}`}
                    >
                        <span className="flex items-center justify-center gap-1.5">
                            <LogIn className="w-4 h-4" />
                            Entrar
                        </span>
                    </button>
                    <button
                        type="button"
                        onClick={() => { if (mode !== 'register') switchMode(); }}
                        className={`flex-1 py-2.5 text-sm font-semibold rounded-lg relative z-10 transition-colors duration-300 ${mode === 'register' ? 'text-slate-900 dark:text-white' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'}`}
                    >
                        <span className="flex items-center justify-center gap-1.5">
                            <UserPlus className="w-4 h-4" />
                            Registro
                        </span>
                    </button>
                </div>

                <form onSubmit={handleAuth} className="space-y-4">
                    <div className="transition-all duration-300">
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                            {mode === 'login' ? 'Correo o Usuario' : 'Nombre de usuario'}
                        </label>
                        <div className="relative">
                            {identifier.includes('@') ? (
                                <Mail className="absolute left-3 top-2.5 text-slate-400 dark:text-slate-500 w-5 h-5" />
                            ) : (
                                <User className="absolute left-3 top-2.5 text-slate-400 dark:text-slate-500 w-5 h-5" />
                            )}
                            <input
                                type="text"
                                required
                                className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 rounded-lg focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent outline-none transition-colors"
                                placeholder={mode === 'login' ? "usuario o correo@ejemplo.com" : "tu_usuario"}
                                value={identifier}
                                onChange={(e) => setIdentifier(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="transition-all duration-300">
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                            Contraseña
                        </label>
                        <div className="relative">
                            <Lock className="absolute left-3 top-2.5 text-slate-400 dark:text-slate-500 w-5 h-5" />
                            <input
                                type="password"
                                required
                                minLength={6}
                                className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 rounded-lg focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent outline-none transition-colors"
                                placeholder={mode === 'login' ? "••••••••" : "Mínimo 6 caracteres"}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                            />
                        </div>
                        {mode === 'register' && isRegisteringLocal && password.length > 0 && password.length < 6 && (
                            <p className="text-amber-500 text-xs mt-1">La contraseña debe tener al menos 6 caracteres.</p>
                        )}
                    </div>

                    {mode === 'register' && isRegisteringLocal && (
                        <div className="transition-all duration-300 animate-in fade-in slide-in-from-top-2">
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                Confirmar contraseña
                            </label>
                            <div className="relative">
                                <ShieldCheck className="absolute left-3 top-2.5 text-slate-400 dark:text-slate-500 w-5 h-5" />
                                <input
                                    type="password"
                                    required
                                    minLength={6}
                                    className={`w-full pl-10 pr-4 py-2.5 bg-white dark:bg-slate-800 border rounded-lg outline-none transition-colors focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent ${
                                        confirmPassword && password !== confirmPassword
                                            ? 'border-red-300 dark:border-red-700'
                                            : confirmPassword && password === confirmPassword
                                                ? 'border-emerald-300 dark:border-emerald-700'
                                                : 'border-slate-200 dark:border-slate-700'
                                    } text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500`}
                                    placeholder="Repetí la contraseña"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                />
                            </div>
                            {confirmPassword && password !== confirmPassword && (
                                <p className="text-red-500 text-xs mt-1">Las contraseñas no coinciden.</p>
                            )}
                            {confirmPassword && password === confirmPassword && (
                                <p className="text-emerald-500 text-xs mt-1">Las contraseñas coinciden.</p>
                            )}
                        </div>
                    )}

                    {error && (
                        <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg text-red-600 dark:text-red-400 text-sm animate-in fade-in slide-in-from-top-2">
                            {error}
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={loading}
                        className={`w-full text-white font-semibold py-2.5 rounded-lg transition-all duration-300 disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg ${
                            mode === 'login'
                                ? 'bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 shadow-blue-500/20'
                                : 'bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-500 dark:hover:bg-emerald-600 shadow-emerald-500/20'
                        }`}
                    >
                        {loading ? (
                            <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                Procesando...
                            </>
                        ) : (
                            <>
                                {mode === 'login' ? <LogIn className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />}
                                {mode === 'login' ? 'Entrar' : 'Crear Cuenta'}
                            </>
                        )}
                    </button>

                    <div className="relative flex items-center py-2">
                        <div className="grow border-t border-slate-200 dark:border-slate-800"></div>
                        <span className="shrink mx-4 text-slate-400 text-xs font-medium">
                            {mode === 'login' ? 'NUEVO' : 'YA TENÉS'}
                        </span>
                        <div className="grow border-t border-slate-200 dark:border-slate-800"></div>
                    </div>

                    <button
                        type="button"
                        onClick={switchMode}
                        className="w-full text-sm font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
                    >
                        {mode === 'login' ? '¿No tienes cuenta? Regístrate aquí' : '¿Ya tienes cuenta? Inicia sesión'}
                    </button>

                    <button
                        type="button"
                        onClick={toggleTheme}
                        className="w-full flex items-center justify-center gap-2 py-2 text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition-colors mt-4"
                    >
                        {isDark ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
                        <span>Modo {isDark ? 'Claro' : 'Oscuro'}</span>
                    </button>
                </form>
            </div>
        </div>
    );
}
