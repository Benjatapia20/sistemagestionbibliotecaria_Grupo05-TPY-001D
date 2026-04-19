import { useEffect, useState } from 'react';
import { supabase } from './lib/supabase';
import type { Session } from '@supabase/supabase-js';
import Login from './components/Login';
import { Sun, Moon, LogOut, BookOpen, User as UserIcon } from 'lucide-react';
import { useDarkMode } from './hooks/useDarkMode';
import { ListaLibros } from './components/ListaLibros';
import { AgregarLibro } from './components/AgregarLibro';
// Se eliminó useRef de aquí
import { sincronizarConNube } from './lib/sync';

function App() {
  const [session, setSession] = useState<Session | null>(null);
  const { isDark, toggleTheme } = useDarkMode();
  const [refreshKey, setRefreshKey] = useState(0);
  const [totalLibros, setTotalLibros] = useState(0);

  const handleLibroAgregado = async () => {
    setRefreshKey(prev => prev + 1);
    await sincronizarConNube();
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      // Solo sincronizamos cuando el estado cambia a "conectado" por primera vez
      if (_event === 'SIGNED_IN') {
        sincronizarConNube();
      }
    });

    // Carga inicial de sesión
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) sincronizarConNube();
    });

    return () => subscription.unsubscribe();
  }, []); // IMPORTANTE: Arreglo de dependencias vacío para que solo corra al montar el componente
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
          >
            {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>

          <div className="hidden xs:flex items-center gap-2 text-slate-600 dark:text-slate-300 border-l border-slate-200 dark:border-slate-700 pl-4">
            <UserIcon className="w-4 h-4" />
            <span className="text-xs sm:text-sm font-medium truncate max-w-[150px]">{session.user.email}</span>
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

      <main className="flex-1 w-full max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
        <div className="space-y-6">
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">
            Panel de Control
          </h1>

          {/* Estadísticas */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="p-4 border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900 flex flex-col shadow-sm">
              <span className="text-sm text-slate-500 dark:text-slate-400 font-medium">Libros Disponibles</span>
              <span className="font-bold text-blue-600 dark:text-blue-400 text-2xl">{totalLibros}</span>
            </div>
            <div className="p-4 border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900 flex flex-col shadow-sm">
              <span className="text-sm text-slate-500 dark:text-slate-400 font-medium">Préstamos Activos</span>
              <span className="font-bold text-blue-600 dark:text-blue-400 text-2xl">0</span>
            </div>
            <div className="p-4 border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900 flex flex-col shadow-sm">
              <span className="text-sm text-slate-500 dark:text-slate-400 font-medium">Estado de Conexión</span>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                <span className="font-bold text-green-600 dark:text-green-400 text-sm uppercase tracking-wider">Online</span>
              </div>
            </div>
          </div>

          {/* Formulario de ingreso */}
          <AgregarLibro onLibroAgregado={handleLibroAgregado} />

          {/* Lista de libros (Se eliminó la duplicada) */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 transition-colors duration-300 overflow-hidden">
            <ListaLibros key={refreshKey} onDataLoaded={setTotalLibros} />
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;