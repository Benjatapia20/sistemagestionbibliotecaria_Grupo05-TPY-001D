import { useEffect, useState } from 'react';
import { supabase } from './lib/supabase';
import type { Session } from '@supabase/supabase-js';
import Login from './components/Login';
import { useDarkMode } from './hooks/useDarkMode';
import { ListaLibros } from './components/ListaLibros';
import { AgregarLibro } from './components/AgregarLibro';
import { sincronizarConNube } from './lib/sync';
import { Sun, Moon, LogOut, User as UserIcon, PlusCircle } from 'lucide-react';

// Componentes de Layout
import { Sidebar } from './components/layout/Sidebar';
import { BottomNav } from './components/layout/BottomNav';

function App() {
  const [session, setSession] = useState<Session | null>(null);
  const { isDark, toggleTheme } = useDarkMode();
  const [refreshKey, setRefreshKey] = useState(0);
  const [totalLibros, setTotalLibros] = useState(0);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  // Estado para la navegación
  const [activeTab, setActiveTab] = useState(() => {
    return localStorage.getItem('biblio_activeTab') || 'dashboard';
  });

  useEffect(() => {
    localStorage.setItem('biblio_activeTab', activeTab);
  }, [activeTab]);

  const handleLibroAgregado = async () => {
    setRefreshKey(prev => prev + 1);
    setIsAddModalOpen(false);
    await sincronizarConNube();
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    // Cambiamos el estado DESPUÉS de cerrar sesión. Como ya estamos en la pantalla de Login, no hay salto visual.
    setActiveTab('dashboard');
    localStorage.setItem('biblio_activeTab', 'dashboard');
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (_event === 'SIGNED_IN') {
        sincronizarConNube();
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) sincronizarConNube();
    });

    return () => subscription.unsubscribe();
  }, []);

  if (!session) {
    return <Login />;
  }

  return (
    <div className="flex h-screen bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-slate-50 overflow-hidden transition-colors duration-300">

      {/* Sidebar para Escritorio */}
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />

      <div className="flex-1 flex flex-col h-full overflow-hidden relative">

        {/* Contenido Principal */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 pb-24 md:pb-8">

          <div className={activeTab === 'dashboard' ? 'block' : 'hidden'}>
            <div className="space-y-6 max-w-7xl mx-auto">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">
                  Panel de Control
                </h1>
                <button
                  onClick={() => setIsAddModalOpen(true)}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl transition-colors flex items-center gap-2 text-sm font-semibold shadow-sm w-full sm:w-auto justify-center"
                >
                  <PlusCircle className="w-5 h-5" />
                  Nuevo Libro
                </button>
              </div>

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
            </div>
          </div>

          <div className={activeTab === 'catalogo' ? 'block' : 'hidden'}>
            <div className="space-y-6 max-w-7xl mx-auto">
              <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">
                Catálogo de Libros
              </h1>

              {/* Lista de libros */}
              <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 transition-colors duration-300 overflow-hidden">
                <ListaLibros key={refreshKey} onDataLoaded={setTotalLibros} />
              </div>
            </div>
          </div>

          <div className={activeTab === 'config' ? 'block' : 'hidden'}>
            <div className="space-y-6 max-w-2xl mx-auto">
              <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white mb-6">
                Ajustes del Sistema
              </h1>

              <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden divide-y divide-slate-200 dark:divide-slate-800">
                {/* Perfil */}
                <div className="p-6 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-full">
                      <UserIcon className="w-6 h-6" />
                    </div>
                    <div>
                      <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">Cuenta Activa</p>
                      <p className="font-semibold text-slate-900 dark:text-white">{session.user.email}</p>
                    </div>
                  </div>
                </div>

                {/* Tema */}
                <div className="p-6 flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-slate-900 dark:text-white">Apariencia</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400">Cambiar entre modo claro y oscuro</p>
                  </div>
                  <button
                    onClick={toggleTheme}
                    className="flex items-center gap-2 p-3 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors font-medium"
                  >
                    {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
                    <span className="hidden sm:inline">{isDark ? 'Modo Claro' : 'Modo Oscuro'}</span>
                  </button>
                </div>

                {/* Cerrar Sesión */}
                <div className="p-6">
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/40 rounded-xl transition-colors font-bold"
                  >
                    <LogOut className="w-5 h-5" />
                    Cerrar Sesión
                  </button>
                </div>
              </div>
            </div>
          </div>

        </main>

        {/* Modal de Agregar Libro */}
        {isAddModalOpen && (
          <div className="fixed inset-0 z-100 flex items-center justify-center bg-slate-900/50 dark:bg-slate-950/80 backdrop-blur-sm p-4">
            <div className="w-full max-w-md animate-in fade-in zoom-in duration-200">
              <AgregarLibro
                onLibroAgregado={handleLibroAgregado}
                onCancel={() => setIsAddModalOpen(false)}
              />
            </div>
          </div>
        )}

        {/* BottomNav para Móviles */}
        <BottomNav activeTab={activeTab} setActiveTab={setActiveTab} />
      </div>
    </div>
  );
}

export default App;