import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { Library, Lock, Mail, Sun, Moon } from 'lucide-react';
import { useDarkMode } from '../hooks/useDarkMode';

export default function Login() {
    const { isDark, toggleTheme } = useDarkMode();
    const [email, setEmail] = useState<string>('');
    const [password, setPassword] = useState<string>('');
    const [loading, setLoading] = useState<boolean>(false);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        const { error } = await supabase.auth.signInWithPassword({ email, password });

        if (error) {
            alert(error.message);
        }
        setLoading(false);
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-50 p-4 transition-colors duration-300">
            <div className="max-w-md w-full bg-white dark:bg-slate-900 rounded-2xl shadow-xl dark:shadow-slate-900/50 p-8 border border-transparent dark:border-slate-800 transition-colors duration-300">
                <div className="flex flex-col items-center mb-8">
                    <div className="bg-blue-600 dark:bg-blue-500 p-3 rounded-full mb-4 transition-colors">
                        <Library className="text-white w-8 h-8" />
                    </div>
                    <h1 className="text-2xl font-bold text-slate-800 dark:text-white transition-colors">Sistema Bibliotecario</h1>
                    <p className="text-slate-500 dark:text-slate-400 transition-colors">Gestión bibliotecaria Offline-First</p>
                </div>

                <form onSubmit={handleLogin} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1 transition-colors">Correo electrónico</label>
                        <div className="relative">
                            <Mail className="absolute left-3 top-2.5 text-slate-400 dark:text-slate-500 w-5 h-5 transition-colors" />
                            <input
                                type="email"
                                required
                                className="w-full pl-10 pr-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 rounded-lg focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent outline-none transition-colors"
                                placeholder="ejemplo@correo.cl"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1 transition-colors">Contraseña</label>
                        <div className="relative">
                            <Lock className="absolute left-3 top-2.5 text-slate-400 dark:text-slate-500 w-5 h-5 transition-colors" />
                            <input
                                type="password"
                                required
                                className="w-full pl-10 pr-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 rounded-lg focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent outline-none transition-colors"
                                placeholder="••••••••"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                            />
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white font-semibold py-2 rounded-lg transition duration-200 disabled:opacity-50"
                    >
                        {loading ? 'Iniciando sesión...' : 'Entrar al sistema'}
                    </button>

                    <button
                        type="button"
                        onClick={toggleTheme}
                        className="w-full flex items-center justify-center gap-2 py-2 text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/50 rounded-lg transition-colors mt-2"
                    >
                        {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                        <span>Cambiar a Modo {isDark ? 'Claro' : 'Oscuro'}</span>
                    </button>
                </form>
            </div>
        </div>
    );
}