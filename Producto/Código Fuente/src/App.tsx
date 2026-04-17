import { useEffect, useState } from 'react';
import { supabase } from './lib/supabase';
import type { Session } from '@supabase/supabase-js';
import Login from './components/Login';
import { Sun, Moon, LogOut, BookOpen, User as UserIcon } from 'lucide-react';
import { useDarkMode } from './hooks/useDarkMode';

function App() {

  const [session, setSession] = useState<Session | null>(null);
  const { isDark, toggleTheme } = useDarkMode();

  useEffect(() => {

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (!session) {
    return <Login />;
  }

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-slate-50 transition-colors duration-300 flex flex-col">

      <nav className="bg-white dark:bg-slate-900 shadow-sm px-4 sm:px-6 py-4 flex justify-between items-center w-full transition-colors duration-300">
        <div className="flex items-center gap-2">
          <BookOpen className="text-blue-600 dark:text-blue-400 w-6 h-6" />
          <span className="font-bold text-lg sm:text-xl text-slate-800 dark:text-white truncate">
            Biblioteca
          </span>
        </div>

        <div className="flex items-center gap-2 sm:gap-4">

          <button
            onClick={toggleTheme}
            className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
            title={isDark ? 'Cambiar a Modo Claro' : 'Cambiar a Modo Oscuro'}
          >
            {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>

          <div className="hidden xs:flex items-center gap-2 text-slate-600 dark:text-slate-300">
            <UserIcon className="w-4 h-4" />
            <span className="text-xs sm:text-sm font-medium">{session.user.email}</span>
          </div>
          <button
            onClick={() => supabase.auth.signOut()}
            className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-red-50 dark:hover:bg-red-900/30 hover:text-red-600 dark:hover:text-red-400 text-slate-700 dark:text-slate-300 rounded-lg transition-colors text-xs sm:text-sm font-semibold"
          >
            <LogOut className="w-4 h-4" />
            <span className="hidden sm:inline">Salir</span>
          </button>
        </div>
      </nav>

      {/* Contenido Principal */}
      <main className="flex-1 w-full max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm p-5 sm:p-8 border border-slate-200 dark:border-slate-800 transition-colors duration-300">
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white mb-4">
            Panel de Control
          </h1>

          {/* Grid de estadísticas responsivo */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="p-4 border border-slate-100 dark:border-slate-800 rounded-xl bg-slate-50 dark:bg-slate-800/50 flex flex-col transition-colors duration-300">
              <span className="text-sm text-slate-500 dark:text-slate-400 font-medium">Libros Disponibles</span>
              <span className="font-bold text-blue-600 dark:text-blue-400 text-2xl">0</span>
            </div>
            <div className="p-4 border border-slate-100 dark:border-slate-800 rounded-xl bg-slate-50 dark:bg-slate-800/50 flex flex-col transition-colors duration-300">
              <span className="text-sm text-slate-500 dark:text-slate-400 font-medium">Préstamos Activos</span>
              <span className="font-bold text-blue-600 dark:text-blue-400 text-2xl">0</span>
            </div>
            <div className="p-4 border border-slate-100 dark:border-slate-800 rounded-xl bg-slate-50 dark:bg-slate-800/50 flex flex-col sm:col-span-2 lg:col-span-1 transition-colors duration-300">
              <span className="text-sm text-slate-500 dark:text-slate-400 font-medium">Estado de Conexión</span>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                <span className="font-bold text-green-600 dark:text-green-400 text-lg uppercase tracking-wider">Online</span>
              </div>
            </div>
          </div>

          <div className="mt-8 p-6 border-2 border-dashed border-slate-100 dark:border-slate-800 rounded-2xl text-center transition-colors duration-300">
            <p className="text-slate-400 dark:text-slate-500 italic">Aquí aparecerá el catálogo de libros próximamente...</p>
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;