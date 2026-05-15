import { useEffect, useState } from "react";
import { supabase } from "./lib/supabase";
import type { Session } from "@supabase/supabase-js";
import Login from "./components/Login";
import { useDarkMode } from "./hooks/useDarkMode";
import { ListaLibros } from "./components/ListaLibros";
import { ListaLibrosSimple } from "./components/ListaLibrosSimple";
import { AgregarLibro } from "./components/AgregarLibro";
import { EditarLibro } from "./components/EditarLibro";
import { sincronizarConNube } from "./lib/sync";
import { VerificarCuenta } from "./components/VerificarCuenta";
import { LibroDetalleCompleto } from "./components/LibroDetalleCompleto";
import { useFavorites } from "./hooks/useFavorites";
import { usePrestamos } from "./hooks/usePrestamos";
import { PrestamosLista } from "./components/PrestamosLista";
import { MisPrestamos } from "./components/MisPrestamos";
import { PrestamosDashboard } from "./components/PrestamosDashboard";
import { ModalSolicitarPrestamo } from "./components/ModalSolicitarPrestamo";
import {
  Sun,
  Moon,
  LogOut,
  User as UserIcon,
  PlusCircle,
  RefreshCw,
  Database,
  Server
} from "lucide-react";
import { useConfig } from "./hooks/useConfig";

import { Sidebar } from "./components/layout/Sidebar";
import { BottomNav } from "./components/layout/BottomNav";

interface Libro {
  id: number;
  titulo: string;
  autor: string;
  isbn: string;
  stock: number;
  genero?: string;
  caratula?: string;
  caratula_url?: string;
}

function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [userRole, setUserRole] = useState<'admin' | 'usuario'>(() => {
    return (localStorage.getItem("biblio_role") as 'admin' | 'usuario') || 'usuario';
  });
  const { isDark, toggleTheme } = useDarkMode();
  const [refreshKey, setRefreshKey] = useState(0);
  const [totalLibros, setTotalLibros] = useState(0);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [libroEditando, setLibroEditando] = useState<Libro | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<string | null>(null);
  const { useLocal, toggleUseLocal } = useConfig();
  const [libroSeleccionadoFull, setLibroSeleccionadoFull] = useState<any | null>(null);
  const [libroSolicitando, setLibroSolicitando] = useState<Libro | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  
  const userId = session?.user?.id || (session?.user as any)?.email?.split('@')[0];
  const { favoritos, toggleFavorite } = useFavorites(session?.user?.id, useLocal);
  const {
    prestamos,
    config,
    loading: prestamosLoading,
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
    refreshPrestamos
  } = usePrestamos(userId, userRole, useLocal);

  const [activeTab, setActiveTab] = useState(() => {
    return localStorage.getItem("biblio_activeTab") || "dashboard";
  });

  useEffect(() => {
    localStorage.setItem("biblio_activeTab", activeTab);
  }, [activeTab]);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleLibroAgregado = async () => {
    setRefreshKey((prev) => prev + 1);
    setIsAddModalOpen(false);
  };

  const handleVerMas = (libro: any) => {
    setLibroSeleccionadoFull(libro);
  };

  const getImagenSrcGlobal = (path: string | undefined, url: string | undefined) => {
    const imagesBaseUrl = import.meta.env.VITE_IMAGES_URL || `http://${window.location.hostname}:3001`;
    const finalPath = useLocal ? (path || url || '') : (url || path || '');

    if (!finalPath) return "https://images.unsplash.com/photo-1543002588-bfa74002ed7e?w=400&h=600&fit=crop";
    if (finalPath.startsWith('http')) return finalPath;
    return `${imagesBaseUrl}${finalPath}`;
  };

  const handleSync = async () => {
    setSyncing(true);
    setSyncStatus("Sincronizando...");
    try {
      const result = await sincronizarConNube();
      setSyncStatus(result.message);
      if (result.success) {
        setRefreshKey((prev) => prev + 1);
        refreshPrestamos();
      }
      setTimeout(() => setSyncStatus(null), 3000);
    } catch (error) {
      setSyncStatus("Error al sincronizar");
      console.error("Error de sincronización:", error);
      setTimeout(() => setSyncStatus(null), 3000);
    } finally {
      setSyncing(false);
    }
  };

  const handleSolicitarPrestamo = async (libroId: number) => {
    const result = await solicitarPrestamo(libroId);
    showToast(result.message, result.success ? 'success' : 'error');
    if (result.success) {
      setLibroSolicitando(null);
    }
    return result;
  };

  const handleAprobarPrestamo = async (prestamoId: string) => {
    const result = await aprobarPrestamo(prestamoId);
    showToast(result.message, result.success ? 'success' : 'error');
    return result;
  };

  const handleRechazarPrestamo = async (prestamoId: string) => {
    const result = await rechazarPrestamo(prestamoId);
    showToast(result.message, result.success ? 'success' : 'error');
    return result;
  };

  const handleAprobarDevolucion = async (prestamoId: string) => {
    const result = await aprobarDevolucion(prestamoId);
    if (result.success) {
      let msg = 'Devolución aprobada';
      if (result.diasAtraso && result.diasAtraso > 0) msg += ` (${result.diasAtraso} días de atraso)`;
      if (result.multa && result.multa > 0) msg += ` - Multa: $${result.multa.toLocaleString('es-CL')}`;
      showToast(msg, 'success');
    } else {
      showToast(result.message, 'error');
    }
    return result;
  };

  const handleRechazarDevolucion = async (prestamoId: string) => {
    const result = await rechazarDevolucion(prestamoId);
    showToast(result.message, result.success ? 'success' : 'error');
    return result;
  };

  const handleAprobarRenovacion = async (prestamoId: string) => {
    const result = await aprobarRenovacion(prestamoId);
    showToast(result.message, result.success ? 'success' : 'error');
    return result;
  };

  const handleRechazarRenovacion = async (prestamoId: string) => {
    const result = await rechazarRenovacion(prestamoId);
    showToast(result.message, result.success ? 'success' : 'error');
    return result;
  };

  const handleSolicitarDevolucion = async (prestamoId: string, estadoLibro: string, observaciones: string) => {
    const result = await solicitarDevolucion(prestamoId, estadoLibro, observaciones);
    if (result.success) {
      let msg = result.message;
      if (result.multaEstimada && result.multaEstimada > 0) msg += ` (Multa estimada: $${result.multaEstimada.toLocaleString('es-CL')})`;
      showToast(msg, 'success');
    } else {
      showToast(result.message, 'error');
    }
    return result;
  };

  const handleSolicitarRenovacion = async (prestamoId: string) => {
    const result = await solicitarRenovacion(prestamoId);
    showToast(result.message, result.success ? 'success' : 'error');
    return result;
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    localStorage.removeItem("biblio_role");
    localStorage.removeItem("biblio_temp_session");
    setActiveTab("dashboard");
    localStorage.setItem("biblio_activeTab", "dashboard");
    window.location.reload();
  };

  const fetchUserRole = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('rol')
        .eq('id', userId)
        .single();

      if (data && !error) {
        setUserRole(data.rol);
        localStorage.setItem("biblio_role", data.rol);
      }
    } catch (err) {
      console.error("Error fetching role:", err);
    }
  };

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        setSession(session);
        fetchUserRole(session.user.id);
        setCheckingAuth(false);
      } else {
        const tempSession = localStorage.getItem("biblio_temp_session");
        if (tempSession) {
          const parsed = JSON.parse(tempSession);
          setSession(parsed as any);
          setUserRole(parsed.role);
        } else {
          setSession(null);
        }
        setCheckingAuth(false);
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setSession(session);
        fetchUserRole(session.user.id);
        setCheckingAuth(false);
      } else {
        const tempSession = localStorage.getItem("biblio_temp_session");
        if (tempSession) {
          const parsed = JSON.parse(tempSession);
          setSession(parsed as any);
          setUserRole(parsed.role);
        }
        setCheckingAuth(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const prestamosActivosCount = prestamos.filter(p =>
    p.usuario_id === userId && (p.estado === 'activo' || p.estado === 'solicitado')
  ).length;

  const tienePrestamoActivo = (libroId: number) => {
    return prestamos.some(p =>
      p.usuario_id === userId && p.libro_id === libroId && (p.estado === 'activo' || p.estado === 'solicitado')
    );
  };

  if (checkingAuth) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-slate-100 dark:bg-slate-950">
        <RefreshCw className="w-10 h-10 text-blue-600 animate-spin" />
      </div>
    );
  }

  if (!session) {
    return <Login />;
  }

  return (
    <div className="flex h-screen bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-slate-50 overflow-hidden transition-colors duration-300">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-200 px-4 py-3 rounded-xl shadow-lg text-sm font-medium animate-in fade-in slide-in-from-top-4 duration-300 ${
          toast.type === 'success'
            ? 'bg-emerald-600 text-white'
            : 'bg-red-600 text-white'
        }`}>
          {toast.message}
        </div>
      )}

      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} userRole={userRole} prestamosPendientes={prestamosPendientes} />
      <div className="flex-1 flex flex-col h-full overflow-hidden relative">
        <main className="flex-1 flex flex-col min-h-0 relative">
          {/* DASHBOARD */}
          <div className={activeTab === "dashboard" ? "block flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 pb-24 md:pb-8 custom-scrollbar" : "hidden"}>
            <div className="space-y-6 max-w-7xl mx-auto">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div className="flex items-center gap-3">
                  <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">
                    Panel de Control
                  </h1>
                  <div className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 ${useLocal
                      ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                      : "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                    }`}>
                    {useLocal ? <Server className="w-3 h-3" /> : <Database className="w-3 h-3" />}
                    {useLocal ? "Local" : "Supabase"}
                  </div>
                </div>
                {userRole === 'admin' && (
                  <div className="flex gap-2 w-full sm:w-auto">
                    <button
                      onClick={handleSync}
                      disabled={syncing}
                      className="bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 px-4 py-2.5 rounded-xl transition-colors flex items-center gap-2 text-sm font-semibold w-full sm:w-auto justify-center"
                    >
                      <RefreshCw className={`w-5 h-5 ${syncing ? "animate-spin" : ""}`} />
                      {syncing ? "Sincronizando..." : "Sincronizar"}
                    </button>
                    <button
                      onClick={() => setIsAddModalOpen(true)}
                      className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl transition-colors flex items-center gap-2 text-sm font-semibold shadow-sm w-full sm:w-auto justify-center"
                    >
                      <PlusCircle className="w-5 h-5" />
                      Nuevo Libro
                    </button>
                  </div>
                )}
              </div>
              {syncStatus && (
                <div className="bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 px-4 py-2 rounded-lg text-sm">
                  {syncStatus}
                </div>
              )}
              <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 p-4">
                <div className="flex justify-between items-center mb-3">
                  <h2 className="font-bold text-slate-900 dark:text-white">Lista de Libros</h2>
                  <button onClick={() => setRefreshKey((prev) => prev + 1)} className="text-sm text-blue-600 dark:text-blue-400 hover:underline">
                    Actualizar
                  </button>
                </div>
                <ListaLibrosSimple
                  key={refreshKey}
                  onEditar={(libro) => {
                    setLibroEditando(libro);
                    setIsEditModalOpen(true);
                  }}
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="p-4 border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900 flex flex-col shadow-sm">
                  <span className="text-sm text-slate-500 dark:text-slate-400 font-medium">Libros Disponibles</span>
                  <span className="font-bold text-blue-600 dark:text-blue-400 text-2xl">{totalLibros}</span>
                </div>
                <div className="p-4 border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900 flex flex-col shadow-sm">
                  <span className="text-sm text-slate-500 dark:text-slate-400 font-medium">Préstamos Activos</span>
                  <span className="font-bold text-blue-600 dark:text-blue-400 text-2xl">
                    {prestamos.filter(p => p.estado === 'activo' || p.estado === 'vencido').length}
                  </span>
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

          {/* PRESTAMOS */}
          <div className={activeTab === "prestamos" ? "flex-1 overflow-y-auto p-4 md:p-8 custom-scrollbar" : "hidden"}>
            <div className="space-y-6 max-w-7xl mx-auto">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">
                    {userRole === 'admin' ? 'Gestión de Préstamos' : 'Mis Préstamos'}
                  </h1>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                    {userRole === 'admin'
                      ? 'Administra todas las solicitudes y devoluciones'
                      : 'Revisa tus préstamos activos e historial'}
                  </p>
                </div>
              </div>

              {userRole === 'admin' && (
                <PrestamosDashboard prestamos={prestamos} totalLibros={totalLibros} />
              )}

              {userRole === 'admin' ? (
                <PrestamosLista
                  prestamos={prestamos}
                  loading={prestamosLoading}
                  userRole={userRole}
                  onAprobar={handleAprobarPrestamo}
                  onRechazar={handleRechazarPrestamo}
                  onAprobarDevolucion={handleAprobarDevolucion}
                  onRechazarDevolucion={handleRechazarDevolucion}
                  onAprobarRenovacion={handleAprobarRenovacion}
                  onRechazarRenovacion={handleRechazarRenovacion}
                  multaPorDia={config?.multa_por_dia || 100}
                />
              ) : (
                <MisPrestamos
                  prestamos={prestamos}
                  loading={prestamosLoading}
                  onSolicitarDevolucion={handleSolicitarDevolucion}
                  onSolicitarRenovacion={handleSolicitarRenovacion}
                  onRefresh={refreshPrestamos}
                  multaPorDia={config?.multa_por_dia || 100}
                />
              )}
            </div>
          </div>

          {/* FAVORITOS */}
          <div className={activeTab === "favoritos" ? "flex-1 flex flex-col min-h-0" : "hidden"}>
            {activeTab === "favoritos" && (
              <ListaLibros 
                key={`fav-${refreshKey}`} 
                showFavoritesOnly={true} 
                userId={session?.user?.id} 
                useLocal={useLocal} 
                onVerMas={handleVerMas}
              />
            )}
          </div>

          {/* CATALOGO */}
          <div className={activeTab === "catalogo" ? "flex-1 flex flex-col min-h-0" : "hidden"}>
            <ListaLibros 
              key={`cat-${refreshKey}`} 
              onDataLoaded={setTotalLibros} 
              userId={session?.user?.id} 
              useLocal={useLocal} 
              onVerMas={handleVerMas}
              onSolicitarPrestamo={(libro) => setLibroSolicitando(libro)}
              tienePrestamoActivo={tienePrestamoActivo}
            />
          </div>

          {/* CONFIG */}
          <div className={activeTab === "config" ? "flex-1 overflow-y-auto p-4 md:p-8 custom-scrollbar" : "hidden"}>
            <div className="space-y-6 max-w-2xl mx-auto">
              <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white mb-6">
                Ajustes del Sistema
              </h1>

              {(session?.user as any)?.isTemp && (
                <VerificarCuenta
                  username={session?.user?.email?.split('@')[0] || ''}
                  currentRole={userRole}
                  onVerified={() => window.location.reload()}
                />
              )}

              <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden divide-y divide-slate-200 dark:divide-slate-800">
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
                    <span className="hidden sm:inline">{isDark ? "Modo Claro" : "Modo Oscuro"}</span>
                  </button>
                </div>

                <div className="p-6 flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-slate-900 dark:text-white">Servidor de Datos</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400">Usar base de datos local (Docker) o la nube</p>
                  </div>
                  <button
                    onClick={toggleUseLocal}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${useLocal ? 'bg-blue-600' : 'bg-slate-300 dark:bg-slate-700'}`}
                  >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${useLocal ? 'translate-x-6' : 'translate-x-1'}`} />
                  </button>
                </div>

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

        {isAddModalOpen && (
          <div className="fixed inset-0 z-100 flex items-center justify-center bg-slate-900/50 dark:bg-slate-950/80 backdrop-blur-sm p-4">
            <div className="w-full max-w-md animate-in fade-in zoom-in duration-200">
              <AgregarLibro onLibroAgregado={handleLibroAgregado} onCancel={() => setIsAddModalOpen(false)} />
            </div>
          </div>
        )}
        {isEditModalOpen && libroEditando && (
          <div className="fixed inset-0 z-100 flex items-center justify-center bg-slate-900/50 dark:bg-slate-950/80 backdrop-blur-sm p-4">
            <div className="w-full max-w-md animate-in fade-in zoom-in duration-200">
              <EditarLibro
                libro={libroEditando}
                onGuardado={() => { setRefreshKey((prev) => prev + 1); setIsEditModalOpen(false); setLibroEditando(null); }}
                onCancel={() => { setIsEditModalOpen(false); setLibroEditando(null); }}
              />
            </div>
          </div>
        )}
        <BottomNav activeTab={activeTab} setActiveTab={setActiveTab} userRole={userRole} prestamosPendientes={prestamosPendientes} />
      </div>

      {libroSeleccionadoFull && (
        <LibroDetalleCompleto 
          libro={libroSeleccionadoFull}
          onBack={() => setLibroSeleccionadoFull(null)}
          getImagenSrc={getImagenSrcGlobal}
          isFavorite={favoritos.has(libroSeleccionadoFull.id)}
          onToggleFavorite={toggleFavorite}
          onSolicitarPrestamo={() => {
            setLibroSolicitando(libroSeleccionadoFull);
            setLibroSeleccionadoFull(null);
          }}
          tienePrestamoActivo={tienePrestamoActivo(libroSeleccionadoFull.id)}
        />
      )}

      {libroSolicitando && userId && (
        <ModalSolicitarPrestamo
          libro={libroSolicitando}
          userId={userId}
          useLocal={useLocal}
          onSolicitar={handleSolicitarPrestamo}
          onSuccess={() => {
            showToast('Préstamo solicitado correctamente', 'success');
            setLibroSolicitando(null);
          }}
          onCancel={() => setLibroSolicitando(null)}
          configDias={config?.dias_maximos_prestamo || 14}
          maxPrestamosActivos={config?.max_prestamos_activos || 3}
          prestamosActivosCount={prestamosActivosCount}
        />
      )}
    </div>
  );
}

export default App;
