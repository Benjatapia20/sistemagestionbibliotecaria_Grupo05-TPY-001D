import { Outlet, useLocation, useNavigate } from "react-router-dom"
import { useEffect, useState, useRef } from "react"
import { toast } from "sonner"
import { BookOpen, LayoutDashboard, User, LogOut, Library, Shield, ChevronUp, X, Package, Wrench, Map, MessageCircle, Bell, AlertCircle, RefreshCw, Ellipsis } from "lucide-react"
import { getUploadUrl, getServerUrl } from "@/lib/api-config"
import type { LibroConAutor } from "@/lib/api"
import { api } from "@/lib/api"
import {
  SidebarProvider,
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarTrigger,
  SidebarRail,
  SidebarInset,
} from "@/components/ui/sidebar"
import { TooltipProvider } from "@/components/ui/tooltip"
import { Separator } from "@/components/ui/separator"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar"
import CartDrawer from "@/components/CartDrawer"
import ChatDrawer from "@/components/ChatDrawer"
import { useChat } from "@/contexts/ChatContext"
import { useNotificaciones } from "@/contexts/NotificacionesContext"
import { InputGroup, InputGroupInput, InputGroupAddon } from "@/components/ui/input-group"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useAuth } from "@/contexts/AuthContext"

function Shell() {
  const { usuario, logout, refreshUser } = useAuth()
  const { setOpen: setChatOpen } = useChat()
  const { noLeidas } = useNotificaciones()
  const location = useLocation()
  const navigate = useNavigate()
  const [searchTerm, setSearchTerm] = useState("")
  const [libros, setLibros] = useState<LibroConAutor[]>([])
  const [showResults, setShowResults] = useState(false)
  const searchRef = useRef<HTMLDivElement>(null)
  const [multaTotal, setMultaTotal] = useState(0)
  const [syncing, setSyncing] = useState(false)
  const [autoSync, setAutoSync] = useState(() => localStorage.getItem("autoSync") === "true")
  const [syncInterval, setSyncInterval] = useState(() => parseInt(localStorage.getItem("syncInterval") || "30"))
  const [syncCountdown, setSyncCountdown] = useState(syncInterval)
  const autoSyncRef = useRef(false)
  const countdownRef = useRef(syncInterval)
  autoSyncRef.current = autoSync
  countdownRef.current = syncInterval

  useEffect(() => {
    localStorage.setItem("autoSync", String(autoSync))
  }, [autoSync])

  useEffect(() => {
    localStorage.setItem("syncInterval", String(syncInterval))
  }, [syncInterval])

  const esLocal = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"
  const UPLOAD_SERVER = getUploadUrl()

  useEffect(() => { api.getLibros().then(setLibros) }, [])
  useEffect(() => {
    if (usuario?.id) {
      api.getTotalMultasPendientes(usuario.id).then(setMultaTotal).catch(() => {})
      const interval = setInterval(() => {
        api.getTotalMultasPendientes(usuario.id).then(setMultaTotal).catch(() => {})
      }, 30000)
      return () => clearInterval(interval)
    }
  }, [usuario?.id])

  // Refresh user data on route changes (picks up synced changes from other instances)
  useEffect(() => {
    if (usuario?.id) {
      refreshUser().catch(() => {})
    }
  }, [location.pathname, usuario?.id])

  // Auto-sync effect
  useEffect(() => {
    if (!autoSync || !esLocal) return
    const ms = Math.max(5, syncInterval) * 1000
    const id = setInterval(async () => {
      try {
        const res = await fetch(`${getServerUrl()}/sync/full`, { method: "POST" })
        const data = await res.json()
        if (data.success && autoSyncRef.current) {
          const pullTotal = (data.pull || []).length
          if (pullTotal > 0) {
            const pushTotal = data.push.reduce((s: number, r: any) => s + (r.inserted || 0), 0)
            toast.success(`Auto-sync: ${pullTotal} acciones, ${pushTotal} registros`)
          }
          refreshUser().catch(() => {})
        }
      } catch { /* silently ignore errors during auto-sync */ }
    }, ms)
    return () => clearInterval(id)
  }, [autoSync, syncInterval, esLocal])

  // Countdown timer for sync progress bar
  useEffect(() => {
    if (!autoSync || !esLocal) return
    const id = setInterval(() => {
      setSyncCountdown(prev => {
        if (prev <= 1) return countdownRef.current
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(id)
  }, [autoSync, esLocal])

  // Reset countdown when interval changes
  useEffect(() => {
    setSyncCountdown(syncInterval)
  }, [syncInterval])

  const handleSearchFocus = () => {
    api.getLibros().then(setLibros)
  }

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowResults(false)
      }
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [])

  const resultados = searchTerm.trim().length > 0
    ? libros.filter(l =>
        l.titulo.toLowerCase().includes(searchTerm.toLowerCase()) ||
        l.autor.nombre.toLowerCase().includes(searchTerm.toLowerCase())
      ).slice(0, 6)
    : []

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (searchTerm.trim()) {
      navigate(`/catalogo?busqueda=${encodeURIComponent(searchTerm.trim())}`)
      setShowResults(false)
    }
  }

  const handleLogout = () => {
    logout()
  }

  useEffect(() => {
    if (!usuario) navigate("/")
  }, [usuario, navigate])

  useEffect(() => {
    if (!usuario) return
    api.verifyRole(usuario.id).then((dbRol) => {
      if (dbRol && dbRol !== usuario.rol) {
        toast.warning("Tu rol ha cambiado. Inicia sesión nuevamente.")
        logout()
        navigate("/")
      }
    })
  }, [usuario, navigate, location.pathname])

  const menuItems = [
    { title: "Inicio", url: "/inicio", icon: LayoutDashboard },
    { title: "Catálogo", url: "/catalogo", icon: Library },
    { title: "Mis Pedidos", url: "/mis-pedidos", icon: Package },
    { title: "Mapa", url: "/mapa", icon: Map },
    ...(esLocal && (usuario?.rol === "admin" || usuario?.rol === "bibliotecario")
      ? [{ title: "Operaciones", url: "/operaciones", icon: Wrench }]
      : []),
    { title: "Perfil", url: "/perfil", icon: User },
    { title: "Notificaciones", url: "/notificaciones", icon: Bell, badge: noLeidas as number },
    ...(esLocal && usuario?.rol === "admin"
      ? [{ title: "Administrar", url: "/admin", icon: Shield }]
      : []),
  ]

  return (
    <>
      <Sidebar className="hidden md:flex">
        <SidebarHeader>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton size="lg" asChild>
                <a href="/inicio" onClick={(e) => { e.preventDefault(); navigate("/inicio") }}>
                  <BookOpen className="text-sidebar-accent-foreground" />
                  <span className="font-semibold">Biblioteca</span>
                </a>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                {menuItems.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      size="lg"
                      isActive={location.pathname === item.url}
                      tooltip={item.title}
                    >
                      <a href={item.url} onClick={(e) => { e.preventDefault(); navigate(item.url) }}>
                        <item.icon />
                        <span className="flex-1">{item.title}</span>
                        {(item as any).badge > 0 && (
                          <span className="ml-auto flex size-5 items-center justify-center rounded-full bg-primary text-[10px] font-medium text-primary-foreground">
                            {(item as any).badge}
                          </span>
                        )}
                      </a>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
        <SidebarFooter>
          <SidebarMenu>
            <SidebarMenuItem>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <SidebarMenuButton size="lg">
                    <Avatar className="size-6" key={`${usuario?.foto_perfil ?? "no-foto"}-${usuario?.primer_nombre ?? ""}-${(usuario as any)?._refreshedAt ?? ""}`}>
                      <AvatarImage src={usuario?.foto_perfil ? (usuario.foto_perfil.startsWith("http") ? usuario.foto_perfil : `${UPLOAD_SERVER}${usuario.foto_perfil}`) : undefined} alt={usuario?.nombre_usuario ?? ""} />
                      <AvatarFallback className="text-xs">{(usuario?.primer_nombre?.[0] ?? "") + (usuario?.apellido_paterno?.[0] ?? "") || usuario?.nombre_usuario?.[0]?.toUpperCase() || "?"}</AvatarFallback>
                    </Avatar>
                    <span className="truncate">{usuario?.primer_nombre ? `${usuario.primer_nombre} ${usuario.apellido_paterno ?? ""}` : `@${usuario?.nombre_usuario}`}</span>
                    <ChevronUp className="ml-auto size-4" />
                  </SidebarMenuButton>
                </DropdownMenuTrigger>
                <DropdownMenuContent side="top" className="w-(--radix-dropdown-menu-trigger-width)">
                  <DropdownMenuItem onClick={() => navigate("/perfil")}>
                    <User />
                    Perfil
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleLogout}>
                    <LogOut />
                    Cerrar sesión
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
        <SidebarRail className="hidden md:block" />
      </Sidebar>
      <SidebarInset>
        <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center gap-3 border-b bg-background px-3 sm:px-6">
          <SidebarTrigger className="hidden md:flex" />
          <Separator orientation="vertical" className="hidden md:block h-5" />
          <div ref={searchRef} className="flex-1 flex justify-center relative">
            <form onSubmit={handleSearchSubmit} className="w-full max-w-md">
              <InputGroup>
                <InputGroupInput
                  value={searchTerm}
                  onChange={(e) => { setSearchTerm(e.target.value); setShowResults(true) }}
                  onFocus={() => { handleSearchFocus(); if (searchTerm.trim()) setShowResults(true) }}
                  placeholder="Buscar libros..."
                  className="h-9 bg-muted/50"
                />
                {searchTerm && (
                  <InputGroupAddon>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-xs"
                      onClick={() => { setSearchTerm(""); setShowResults(false) }}
                    >
                      <X className="size-3.5" />
                    </Button>
                  </InputGroupAddon>
                )}
              </InputGroup>
            </form>
            {showResults && resultados.length > 0 && (
              <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1 w-full max-w-md z-50 rounded-lg border bg-popover shadow-lg overflow-hidden">
                {resultados.map((libro) => (
                  <button
                    key={libro.id}
                    className="flex items-center gap-3 w-full px-3 py-2 text-sm hover:bg-muted transition-colors text-left"
                    onClick={() => {
                      const url = `/libro/${libro.id}`
                      setShowResults(false)
                      setSearchTerm("")
                      navigate(url)
                    }}
                  >
                    <div className="w-8 h-10 shrink-0 rounded-sm overflow-hidden bg-muted">
                      {libro.caratula ? (
                        <img
                          src={libro.caratula.startsWith("http") ? libro.caratula : `${UPLOAD_SERVER}${libro.caratula}`}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="h-full w-full flex items-center justify-center">
                          <BookOpen className="size-3 text-muted-foreground/30" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="font-medium truncate">{libro.titulo}</p>
                        {!libro.disponible && <Badge variant="outline" className="text-[10px] px-1 py-0 shrink-0">No disponible</Badge>}
                      </div>
                      <p className="text-xs text-muted-foreground truncate">{libro.autor.nombre}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
          <Button variant="ghost" size="icon-sm" onClick={() => setChatOpen(true)}>
            <MessageCircle />
          </Button>
          {esLocal && usuario?.rol === "admin" && (
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon-sm"
                disabled={syncing}
                onClick={async () => {
                  setSyncing(true)
                  try {
                    const res = await fetch(`${getServerUrl()}/sync/full`, { method: "POST" })
                    const data = await res.json()
                    if (data.success) {
                      const pullTotal = (data.pull || []).length
                      const pushTotal = data.push.reduce((s: number, r: any) => s + (r.inserted || 0), 0)
                      toast.success(`Sincronización: ${pullTotal} acciones pull, ${pushTotal} registros push`)
                      refreshUser().catch(() => {})
                    }
                  } catch (err) {
                    toast.error("Error al sincronizar")
                  }
                  setSyncing(false)
                  setSyncCountdown(syncInterval)
                }}
                title="Sincronizar con Supabase"
              >
                <RefreshCw className={syncing ? "animate-spin" : ""} />
              </Button>
              <div className="flex flex-col gap-0.5">
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    className={`shrink-0 size-7 rounded-md flex items-center justify-center text-[10px] font-medium transition-colors ${autoSync ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}
                    onClick={() => { setAutoSync(v => !v); if (!autoSync) setSyncCountdown(syncInterval) }}
                    title={autoSync ? "Auto-sync activado" : "Auto-sync desactivado"}
                  >
                    Auto
                  </button>
                  {autoSync && (
                    <>
                      <input
                        type="number"
                        className="w-10 h-6 rounded border bg-background px-1 text-[10px] text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        value={syncInterval}
                        min={5}
                        onChange={e => { const v = Math.max(5, parseInt(e.target.value) || 30); setSyncInterval(v); setSyncCountdown(v) }}
                        title="Intervalo en segundos"
                      />
                      <span className="text-[10px] text-muted-foreground w-10 text-center">{syncCountdown}s</span>
                    </>
                  )}
                </div>
                {autoSync && (
                  <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full transition-all duration-1000 ease-linear"
                      style={{ width: `${((syncInterval - syncCountdown) / Math.max(1, syncInterval)) * 100}%` }}
                    />
                  </div>
                )}
              </div>
            </div>
          )}
          {multaTotal > 0 && (
            <Button variant="ghost" size="sm" className="text-xs text-destructive hover:text-destructive gap-1.5 px-2" onClick={() => navigate("/mis-pedidos?tab=multas")}>
              <AlertCircle className="size-4" />
              Pagar ${multaTotal.toLocaleString("es-CL")}
            </Button>
          )}
          <CartDrawer />
        </header>
        <div id="main-content" className="flex-1 p-6">
          <Outlet />
        </div>

        <ChatDrawer />

        {/* Mobile bottom navigation */}
        <nav className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background md:hidden pb-[env(safe-area-inset-bottom)]">
          <div className="flex items-center justify-around h-14">
            {[
              { title: "Inicio", url: "/inicio", icon: LayoutDashboard },
              { title: "Catálogo", url: "/catalogo", icon: Library },
              { title: "Pedidos", url: "/mis-pedidos", icon: Package },
              { title: "Perfil", url: "/perfil", icon: User },
            ].map((item) => {
              const active = location.pathname === item.url || location.pathname.startsWith(item.url + "/")
              return (
                <button
                  key={item.title}
                  className={`flex flex-col items-center justify-center gap-0.5 h-full px-2 min-w-0 flex-1 transition-colors ${active ? "text-primary" : "text-muted-foreground"}`}
                  onClick={() => navigate(item.url)}
                >
                  <item.icon className="size-5" />
                  <span className="text-[10px] leading-tight truncate max-w-full">{item.title}</span>
                </button>
              )
            })}

            {/* Más */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex flex-col items-center justify-center gap-0.5 h-full px-2 min-w-0 flex-1 text-muted-foreground">
                  <Ellipsis className="size-5" />
                  <span className="text-[10px] leading-tight">Más</span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent side="top" align="end" className="w-44 mb-2">
                <DropdownMenuItem onClick={() => navigate("/notificaciones")}>
                  <Bell className="size-4" />
                  <span className="flex-1">Notificaciones</span>
                  {noLeidas > 0 && <Badge variant="secondary" className="ml-1 text-[10px] px-1 py-0 h-4">{noLeidas}</Badge>}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setChatOpen(true)}>
                  <MessageCircle className="size-4" />
                  <span className="flex-1">Chat</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout}>
                  <LogOut className="size-4" />
                  <span className="flex-1">Cerrar sesión</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </nav>

        {/* Padding for mobile nav */}
        <div className="h-[calc(3.5rem+env(safe-area-inset-bottom,0px))] md:hidden" />
      </SidebarInset>
    </>
  )
}

export default function AppLayout() {
  return (
    <TooltipProvider>
      <SidebarProvider>
        <Shell />
      </SidebarProvider>
    </TooltipProvider>
  )
}
