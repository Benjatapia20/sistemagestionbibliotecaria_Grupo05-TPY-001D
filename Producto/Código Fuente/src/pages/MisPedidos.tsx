import { useState, useEffect, useRef } from "react"
import { BookOpen, Download, Star, X } from "lucide-react"
import { toast } from "sonner"
import { api } from "@/lib/api"
import { useAuth } from "@/contexts/AuthContext"
import { useLocation, useNavigate } from "react-router-dom"
import { getUploadUrl, getServerUrl } from "@/lib/api-config"
import { uploadResenaFoto } from "@/lib/upload"
import { useNotificaciones } from "@/contexts/NotificacionesContext"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from "@/components/ui/empty"
import { Skeleton } from "@/components/ui/skeleton"

const UPLOAD_SERVER = getUploadUrl()

type GrupoSolicitud = {
  grupo_id: number | null
  nota_admin: string | null
  lugar_retiro: string | null
  codigo: string | null
  fecha_devolucion: string | null
  created_at: string
  estado: string
  prestamos: {
    id: number
    estado: string
    created_at: string
    libro?: { titulo: string; caratula: string | null }
    ejemplar?: { id: number; codigo: string }
  }[]
}

type PrestamoInfo = {
  id: number
  estado: string
  created_at: string
  libro_id?: number
  libro?: { titulo: string; caratula: string | null }
  ejemplar?: { id: number; codigo: string }
  grupo_id: number | null
  fecha_devolucion: string | null
  lugar_retiro: string | null
  codigo: string | null
}

function PrestamoCard({ p, onViewPdf, onResenar }: { p: PrestamoInfo; onViewPdf?: (grupoId: number) => void; onResenar?: (libroId: number, libroTitulo: string) => Promise<void> }) {
  const estadoBadge = (e: string) => {
    if (e === "activo") return <Badge variant="default" className="text-[10px] px-1.5 py-0">Activo</Badge>
    if (e === "por_entregar") return <Badge variant="default" className="text-[10px] px-1.5 py-0">Por entregar</Badge>
    if (e === "devuelto") return <Badge variant="outline" className="text-[10px] px-1.5 py-0">Devuelto</Badge>
    if (e === "rechazado") return <Badge variant="destructive" className="text-[10px] px-1.5 py-0">Rechazado</Badge>
    if (e === "no_disponible" || e === "solicita_aprobacion") return <Badge variant="outline" className="text-[10px] px-1.5 py-0">No disponible</Badge>
    if (e === "pendiente" || e === "en_revision") return <Badge variant="secondary" className="text-[10px] px-1.5 py-0">Pendiente</Badge>
    if (e === "atrasado") return <Badge variant="destructive" className="text-[10px] px-1.5 py-0">Atrasado</Badge>
    return <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{e}</Badge>
  }

  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 rounded-xl border px-3 sm:px-4 py-3">
      <div className="flex items-center gap-3">
      <div className="w-8 h-10 shrink-0 rounded-sm overflow-hidden bg-muted">
        {p.libro?.caratula ? (
          <img src={p.libro.caratula.startsWith("http") ? p.libro.caratula : `${UPLOAD_SERVER}${p.libro.caratula}`} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="h-full w-full flex items-center justify-center"><BookOpen className="size-3 text-muted-foreground/30" /></div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs sm:text-sm font-medium truncate">{p.libro?.titulo ?? "—"}</p>
        <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
          {p.ejemplar?.codigo && <span className="text-[11px] sm:text-xs text-muted-foreground font-mono">{p.ejemplar.codigo}</span>}
          {p.grupo_id && (
            <span className="text-[11px] sm:text-xs text-muted-foreground">{p.codigo ?? `Pedido #${p.grupo_id}`}</span>
          )}
          {p.lugar_retiro && (
            <span className="text-[11px] sm:text-xs text-muted-foreground">Retiro: {p.lugar_retiro}</span>
          )}
          {estadoBadge(p.estado)}
        </div>
      </div>
      </div>
      <div className="flex items-center justify-between sm:justify-end gap-2 sm:gap-3">
      <div className="text-[11px] sm:text-xs text-muted-foreground">
        {p.fecha_devolucion && (
          <p className="text-xs font-medium">Devolver: {new Date(p.fecha_devolucion).toLocaleDateString("es-CL")}</p>
        )}
        <p>{new Date(p.created_at).toLocaleDateString("es-CL")}</p>
      </div>
      <div className="flex items-center gap-1 sm:gap-2">
      {p.grupo_id && (
        <Button
          size="sm"
          variant="ghost"
          className="shrink-0 text-xs h-6 px-1.5"
          onClick={() => onViewPdf?.(p.grupo_id!)}
        >
          PDF
        </Button>
      )}
      {p.estado === "devuelto" && onResenar && p.libro_id && (
        <Button
          size="sm"
          variant="outline"
          className="shrink-0 text-xs h-6 px-1.5"
          onClick={async () => { await onResenar(p.libro_id!, p.libro?.titulo ?? "") }}
        >
          Reseñar
        </Button>
      )}
      </div>
      </div>
    </div>
  )
}

function GrupoCard({ grupo, onRefresh, onViewPdf }: { grupo: GrupoSolicitud; onRefresh?: () => void; onViewPdf?: (grupoId: number) => void }) {
  const { usuario } = useAuth()
  const handleAccept = async () => {
    if (!grupo.grupo_id) return
    try {
      await api.aceptarParcial(grupo.grupo_id)
      api.generarPedidoPDF(grupo.grupo_id, usuario?.id).catch(() => {})
      toast.success("Pedido aceptado parcialmente")
      onRefresh?.()
    } catch (err) { toast.error(err instanceof Error ? err.message : "Error") }
  }

  const handleReject = async () => {
    if (!grupo.grupo_id) return
    try { await api.rechazarParcial(grupo.grupo_id); toast.success("Pedido rechazado"); onRefresh?.() } catch (err) { toast.error(err instanceof Error ? err.message : "Error") }
  }

  const handleCancel = async () => {
    if (!grupo.grupo_id) return
    try { await api.rechazarGrupo(grupo.grupo_id); toast.success("Pedido cancelado"); onRefresh?.() } catch (err) { toast.error(err instanceof Error ? err.message : "Error") }
  }

  const puedeCancelar = grupo.estado === "pendiente" || grupo.estado === "en_revision"
  return (
    <div className="rounded-xl border overflow-hidden">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1.5 sm:gap-0 px-3 sm:px-4 py-3 bg-muted/30">
        <div className="flex items-center justify-between">
        <div>
          <p className="text-xs sm:text-sm font-medium">
            Pedido {grupo.codigo ?? (grupo.grupo_id ? `#${grupo.grupo_id}` : "")} · {grupo.prestamos.length} libro(s)
          </p>
          {grupo.fecha_devolucion && (
            <p className="text-[11px] sm:text-xs text-muted-foreground">
              Devolución: {new Date(grupo.fecha_devolucion).toLocaleDateString("es-CL")}
            </p>
          )}
          {grupo.lugar_retiro && (
            <p className="text-[11px] sm:text-xs text-muted-foreground">
              Retirar en: {grupo.lugar_retiro}
            </p>
          )}
          {grupo.nota_admin && (
            <p className="text-[11px] sm:text-xs text-muted-foreground mt-1 italic">"{grupo.nota_admin}"</p>
          )}
        </div>
        <div className="flex items-center gap-1 sm:hidden">
        {grupo.grupo_id && (
          <Button size="sm" variant="ghost" className="text-xs h-6 px-1.5" onClick={() => onViewPdf?.(grupo.grupo_id!)}>PDF</Button>
        )}
        {puedeCancelar && (
          <Button size="sm" variant="ghost" className="text-xs h-7 text-destructive hover:text-destructive" onClick={handleCancel}>Cancelar</Button>
        )}
        </div>
        </div>
        </div>
        <div className="flex items-center justify-between sm:justify-end gap-2">
        <Badge variant={
          grupo.estado === "activo" ? "default" :
          grupo.estado === "parcial" ? "default" :
          grupo.estado === "solicita_aprobacion" ? "destructive" :
          grupo.estado === "pendiente" || grupo.estado === "en_revision" ? "secondary" :
          grupo.estado === "rechazado" ? "destructive" : "outline"
        }>
          {grupo.estado === "pendiente" ? "Pendiente" :
           grupo.estado === "en_revision" ? "En revisión" :
           grupo.estado === "solicita_aprobacion" ? "Requiere acción" :
           grupo.estado === "activo" ? "Activo" :
           grupo.estado === "parcial" ? "Parcial" :
           grupo.estado === "devuelto" ? "Devuelto" :
           grupo.estado === "rechazado" ? "Rechazado" : grupo.estado}
        </Badge>
        {grupo.grupo_id && (
          <Button
            size="sm"
            variant="ghost"
            className="hidden sm:inline-flex text-xs h-6 px-1.5"
            onClick={() => onViewPdf?.(grupo.grupo_id!)}
          >
            PDF
          </Button>
        )}
        {puedeCancelar && (
          <Button size="sm" variant="ghost" className="hidden sm:inline-flex text-xs h-7 text-destructive hover:text-destructive" onClick={handleCancel}>
            Cancelar
          </Button>
        )}
      </div>
      <Separator />
      {grupo.prestamos.map((p, i) => (
        <div key={p.id}>
          {i > 0 && <Separator />}
          <div className="flex items-center gap-3 px-4 py-3">
            <div className="w-8 h-10 shrink-0 rounded-sm overflow-hidden bg-muted">
              {p.libro?.caratula ? (
                <img src={p.libro.caratula.startsWith("http") ? p.libro.caratula : `${UPLOAD_SERVER}${p.libro.caratula}`} alt="" className="h-full w-full object-cover" />
              ) : (
                <div className="h-full w-full flex items-center justify-center"><BookOpen className="size-3 text-muted-foreground/30" /></div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{p.libro?.titulo ?? "—"}</p>
              <div className="flex items-center gap-2">
                {p.ejemplar?.codigo && <span className="text-xs text-muted-foreground font-mono">{p.ejemplar.codigo}</span>}
                <Badge variant={
                  p.estado === "activo" ? "default" :
                  p.estado === "solicita_aprobacion" || p.estado === "no_disponible" ? "outline" :
                  p.estado === "rechazado" ? "destructive" : "secondary"
                } className="text-[10px] px-1.5 py-0">
                  {p.estado === "activo" ? "Activo" :
                   p.estado === "solicita_aprobacion" || p.estado === "no_disponible" ? "No disponible" :
                   p.estado === "rechazado" ? "Rechazado" :
                   p.estado === "pendiente" ? "Pendiente" :
                   p.estado === "en_revision" ? "En revisión" :
                   p.estado === "devuelto" ? "Devuelto" : p.estado}
                </Badge>
              </div>
            </div>
            <div className="text-xs text-muted-foreground text-right shrink-0">
              <p>{new Date(p.created_at).toLocaleDateString("es-CL")}</p>
            </div>
          </div>
        </div>
      ))}
      {grupo.estado === "solicita_aprobacion" && grupo.grupo_id && (
        <>
          <Separator />
          <div className="flex gap-2 px-4 py-2.5 bg-muted/20">
            <Button size="sm" variant="outline" onClick={handleAccept}>Aceptar disponibles</Button>
            <Button size="sm" variant="ghost" onClick={handleReject}>Rechazar pedido</Button>
          </div>
        </>
      )}
    </div>
  )
}

export default function MisPedidos() {
  const { usuario } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const { addNotificacion } = useNotificaciones()
  const [grupos, setGrupos] = useState<GrupoSolicitud[]>([])
  const [loading, setLoading] = useState(true)
  const [pdfUrl, setPdfUrl] = useState("")
  const [pdfDownload, setPdfDownload] = useState("")
  const [resenaLibroId, setResenaLibroId] = useState<number | null>(null)
  const [resenaLibroTitulo, setResenaLibroTitulo] = useState("")
  const [resenaLibroCaratula, setResenaLibroCaratula] = useState("")
  const [resenaLibroSinopsis, setResenaLibroSinopsis] = useState("")
  const [resenaPuntuacion, setResenaPuntuacion] = useState(0)
  const [resenaComentario, setResenaComentario] = useState("")
  const [resenaFotos, setResenaFotos] = useState<string[]>([])
  const [uploadingFoto, setUploadingFoto] = useState(false)
  const [resenaLoading, setResenaLoading] = useState(false)
  const [resenaEditId, setResenaEditId] = useState<number | null>(null)
  const [multas, setMultas] = useState<any[]>([])
  const [pagoLoading, setPagoLoading] = useState(false)
  const [tab, setTab] = useState(new URLSearchParams(window.location.search).get("tab") || "activos")
  const prevEstados = useRef<Record<number, string>>({})

  useEffect(() => {
    if (usuario?.id) api.getSolicitudesUsuario(usuario.id).then((data) => { setGrupos(data); setLoading(false) })
    api.verificarAtrasos().catch(() => {})
  }, [usuario?.id])

  useEffect(() => {
    const t = new URLSearchParams(location.search).get("tab")
    if (t) setTab(t)
  }, [location.search])

  useEffect(() => {
    if (usuario?.id) {
      api.getMultas(usuario.id).then(async (data) => {
        setMultas(data)
        let algunaPagada = false
        let algunaVerificada = false
        for (const m of (data as any[])) {
          // If multa was paid by webhook (has token + paid), toast
          if (m.id_preferencia_mp && m.pagada) {
            algunaPagada = true
          }
          // If multa is unpaid with token, verify it
          if (m.id_preferencia_mp && !m.pagada) {
            algunaVerificada = true
            try {
              const result = await api.verificarPago(m.id_preferencia_mp)
              if (result.paid) {
                await api.marcarMultaPagada(m.id)
                algunaPagada = true
              }
            } catch {}
          }
        }
        if (algunaPagada && algunaVerificada) {
          toast.success("Pago exitoso — tus multas han sido pagadas")
        }
        api.getMultas(usuario.id).then(setMultas)
      })
    }
  }, [usuario?.id])

  useEffect(() => {
    const rawHash = (window.location.hash || location.hash || "").replace("#", "")
    const hash = new URLSearchParams(rawHash)
    const query = new URLSearchParams(window.location.search)
    const pagoResult = hash.get("pago") || query.get("pago")
    
    if (pagoResult === "exito") {
      toast.success("Pago exitoso — tus multas han sido pagadas")
      if (usuario?.id) {
        api.getMultas(usuario.id).then(setMultas).catch(() => {})
      }
      window.history.replaceState({}, "", "/mis-pedidos?tab=multas")
    } else if (pagoResult === "error") {
      toast.error("El pago fue rechazado. Intenta de nuevo.")
      window.history.replaceState({}, "", "/mis-pedidos")
    } else if (pagoResult === "verificado") {
      // Flow returned — wait a moment for webhook to process, then check
      if (usuario?.id) {
        setTimeout(async () => {
          try {
            const fresh = await api.getMultas(usuario.id)
            setMultas(fresh)
            const pendientes = (fresh as any[]).filter(m => !m.pagada).length
            if (pendientes === 0) {
              toast.success("Pago exitoso — tus multas han sido pagadas")
            } else {
              toast.error("El pago fue rechazado. Intenta de nuevo.")
            }
          } catch {}
        }, 1500)
      }
      window.history.replaceState({}, "", "/mis-pedidos?tab=multas")
    }
  }, [usuario?.id, location.hash, location.search])

  useEffect(() => {
    if (loading || grupos.length === 0) return
    const current: Record<number, string> = {}
    for (const g of grupos) {
      for (const p of g.prestamos) {
        current[p.id] = p.estado
      }
    }
    if (Object.keys(prevEstados.current).length > 0) {
      for (const [idStr, estado] of Object.entries(current)) {
        const id = Number(idStr)
        const prev = prevEstados.current[id]
        if (prev && prev !== estado) {
          const prestamo = grupos.flatMap(g => g.prestamos).find(p => p.id === id)
          const titulo = prestamo?.libro?.titulo ?? `Libro #${id}`
          if (estado === "activo") addNotificacion("Pedido entregado", `"${titulo}" ya está en tus manos. ¡Disfrútalo!`)
          else if (estado === "por_entregar") addNotificacion("Pedido aprobado", `"${titulo}" ha sido aprobado. Puedes ir a retirarlo.`)
          else if (estado === "rechazado") addNotificacion("Pedido rechazado", `"${titulo}" ha sido rechazado.`)
          else if (estado === "devuelto") addNotificacion("Libro devuelto", `"${titulo}" ha sido marcado como devuelto.`)
          else if (estado === "solicita_aprobacion") addNotificacion("Requiere tu acción", `"${titulo}" tiene cambios. Revisa el pedido.`)
          else if (estado === "no_disponible") addNotificacion("No disponible", `"${titulo}" no está disponible en este momento.`)
          else if (estado === "atrasado") addNotificacion("Préstamo atrasado", `"${titulo}" está atrasado. Tienes una multa pendiente.`)
        }
      }
    }
    prevEstados.current = current
  }, [grupos, loading])

  const loadData = () => {
    if (usuario?.id) api.getSolicitudesUsuario(usuario.id).then(setGrupos)
  }

  const todos = grupos.flatMap(grupo =>
    grupo.prestamos.map(p => ({
      ...p,
      grupo_id: grupo.grupo_id,
      fecha_devolucion: grupo.fecha_devolucion,
      nota_admin: grupo.nota_admin,
      lugar_retiro: grupo.lugar_retiro,
      codigo: grupo.codigo,
    }))
  )

  const activos = todos.filter(p => p.estado === "activo" || p.estado === "por_entregar" || p.estado === "atrasado")
  const pendientes = grupos.filter(g => ["pendiente", "en_revision", "solicita_aprobacion"].includes(g.estado))
  const historial = todos.filter(p => p.estado === "devuelto" || p.estado === "rechazado")

  const handleOpenResena = async (libroId: number, titulo: string) => {
    setResenaLibroId(libroId)
    setResenaLibroTitulo(titulo)
    setResenaLibroCaratula("")
    setResenaLibroSinopsis("")
    setResenaPuntuacion(0)
    setResenaComentario("")
    setResenaFotos([])
    setResenaEditId(null)
    try {
      const libro = await api.getLibro(libroId)
      if (libro) {
        setResenaLibroCaratula(libro.caratula ?? "")
        setResenaLibroSinopsis(libro.sinopsis ?? "")
      }
      if (usuario?.id) {
        const existente = await api.getMiResena(libroId, usuario.id)
        if (existente) {
          setResenaEditId(existente.id)
          setResenaPuntuacion(existente.puntuacion)
          setResenaComentario(existente.comentario ?? "")
          if (existente.fotos) {
            try { setResenaFotos(JSON.parse(existente.fotos)) } catch {}
          }
        }
      }
    } catch {}
  }

  const handleSubmitResena = async () => {
    if (!usuario || !resenaLibroId || resenaPuntuacion === 0) return
    setResenaLoading(true)
    try {
      if (resenaEditId) {
        await api.updateResena(resenaEditId, {
          puntuacion: resenaPuntuacion,
          comentario: resenaComentario.trim() || undefined,
          fotos: resenaFotos.length > 0 ? JSON.stringify(resenaFotos) : "",
        }, { usuario_id: usuario.id, libro_id: resenaLibroId, nombre_usuario: usuario.nombre_usuario })
        toast.success("Reseña actualizada")
      } else {
        await api.createResena({
          usuario_id: usuario.id,
          libro_id: resenaLibroId,
          puntuacion: resenaPuntuacion,
          comentario: resenaComentario.trim() || undefined,
          fotos: resenaFotos.length > 0 ? JSON.stringify(resenaFotos) : undefined,
        }, usuario.nombre_usuario)
        toast.success("Reseña publicada")
      }
      setResenaLibroId(null)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al publicar reseña")
    }
    setResenaLoading(false)
  }

  const handleResenaFoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingFoto(true)
    try {
      const uid = usuario?.id || "anon"
      const url = await uploadResenaFoto(file, uid)
      setResenaFotos(prev => [...prev, url])
    } catch {
      toast.error("Error al subir la foto")
    } finally {
      setUploadingFoto(false)
    }
    e.target.value = ""
  }

  const pdfBlob = useRef<Blob | null>(null)

  const handleViewPdf = (grupoId: number) => {
    const uid = usuario?.id || "anon"
    const isOnline = !(window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1")
    if (isOnline) {
      const uidShort = uid.substring(0, 8)
      const onlineUrl = `${UPLOAD_SERVER}/pedido-pdf/${uidShort}/${grupoId}.pdf`
      setPdfUrl(onlineUrl)
      setPdfDownload(onlineUrl)
      pdfBlob.current = null
      fetch(onlineUrl).then(r => r.blob()).then(b => { pdfBlob.current = b }).catch(() => {})
    } else {
      setPdfUrl(`${UPLOAD_SERVER}/pedido-pdf/${grupoId}?usuarioId=${encodeURIComponent(uid)}#toolbar=0&navpanes=0`)
      setPdfDownload(`${UPLOAD_SERVER}/pedido-pdf/${grupoId}?usuarioId=${encodeURIComponent(uid)}`)
      pdfBlob.current = null
      fetch(`${UPLOAD_SERVER}/pedido-pdf/${grupoId}?usuarioId=${encodeURIComponent(uid)}`).then(r => r.blob()).then(b => { pdfBlob.current = b }).catch(() => {})
    }
  }

  return (
    <div>
      <h1 className="text-xl sm:text-2xl font-semibold mb-4 sm:mb-6">Mis Pedidos</h1>

      {loading ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 rounded-xl border px-4 py-3">
              <Skeleton className="w-8 h-10 rounded-sm shrink-0" />
              <div className="flex-1 flex flex-col gap-1.5">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/3" />
              </div>
              <Skeleton className="h-3 w-16 shrink-0" />
            </div>
          ))}
        </div>
      ) : (
      <Tabs value={tab} onValueChange={(v) => { setTab(v); navigate(`/mis-pedidos?tab=${v}`, { replace: true }) }}>
        {/* Desktop tabs */}
        <TabsList className="hidden sm:flex mb-6">
          <TabsTrigger value="activos">Activos ({activos.length})</TabsTrigger>
          <TabsTrigger value="pendientes">Pendientes ({pendientes.length})</TabsTrigger>
          <TabsTrigger value="historial">Historial ({historial.length})</TabsTrigger>
          <TabsTrigger value="multas">Multas ({multas.filter(m => !m.pagada).length})</TabsTrigger>
        </TabsList>
        {/* Mobile select */}
        <div className="sm:hidden mb-4">
          <Select value={tab} onValueChange={(v) => { setTab(v); navigate(`/mis-pedidos?tab=${v}`, { replace: true }) }}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="activos">Activos ({activos.length})</SelectItem>
              <SelectItem value="pendientes">Pendientes ({pendientes.length})</SelectItem>
              <SelectItem value="historial">Historial ({historial.length})</SelectItem>
              <SelectItem value="multas">Multas ({multas.filter(m => !m.pagada).length})</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <TabsContent value="activos">
          {activos.length === 0 ? (
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon"><BookOpen /></EmptyMedia>
                <EmptyTitle>No tienes libros activos</EmptyTitle>
                <EmptyDescription>Cuando te aprueben un pedido aparecerá aquí.</EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <div className="flex flex-col gap-2">
              {activos.map(p => (
                <PrestamoCard key={p.id} p={p} onViewPdf={handleViewPdf} />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="pendientes">
          {pendientes.length === 0 ? (
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon"><BookOpen /></EmptyMedia>
                <EmptyTitle>No hay pedidos pendientes</EmptyTitle>
                <EmptyDescription>Realiza un pedido desde el catálogo.</EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <div className="flex flex-col gap-6">
              {pendientes.map((grupo, gi) => (
                <GrupoCard key={gi} grupo={grupo} onRefresh={loadData} onViewPdf={handleViewPdf} />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="historial">
          {historial.length === 0 ? (
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon"><BookOpen /></EmptyMedia>
                <EmptyTitle>No hay libros en el historial</EmptyTitle>
                <EmptyDescription>Los libros devueltos o rechazados aparecerán aquí.</EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <div className="flex flex-col gap-2">
              {historial.map(p => (
                <PrestamoCard key={p.id} p={p} onViewPdf={handleViewPdf} onResenar={handleOpenResena} />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="multas">
          {multas.length === 0 ? (
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon"><BookOpen /></EmptyMedia>
                <EmptyTitle>No tienes multas</EmptyTitle>
                <EmptyDescription>Las multas aparecerán si devuelves libros fuera de plazo.</EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <div className="flex flex-col gap-4">
              {multas.filter(m => !m.pagada).length > 0 && (
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 sm:p-4 rounded-xl border bg-destructive/5">
                  <div>
                    <p className="font-semibold text-sm">Multas pendientes</p>
                    <p className="text-xs text-muted-foreground">
                      Total: ${multas.filter(m => !m.pagada).reduce((s: number, m: any) => s + m.monto, 0)} CLP
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={pagoLoading}
                      onClick={async () => {
                        if (!usuario) return
                        setPagoLoading(true)
                        try {
                          const pendientes = multas.filter(m => !m.pagada)
                          for (const m of pendientes) {
                            await api.marcarMultaPagada(m.id)
                          }
                          toast.success("Multas marcadas como pagadas (simulado)")
                          api.getMultas(usuario.id).then(setMultas)
                        } catch (err) {
                          toast.error(err instanceof Error ? err.message : "Error")
                        }
                        setPagoLoading(false)
                      }}
                    >
                      Simular pago
                    </Button>
                    <Button
                      size="sm"
                      disabled={pagoLoading}
                      onClick={async () => {
                        if (!usuario) return
                        setPagoLoading(true)
                        try {
                          const data = await api.crearOrdenPago(usuario.id)
                          window.location.href = data.url
                        } catch (err) {
                          toast.error(err instanceof Error ? err.message : "Error al crear pago")
                          setPagoLoading(false)
                        }
                      }}
                    >
                      {pagoLoading && <span className="animate-spin size-3 border-2 border-white/30 border-t-white rounded-full mr-1.5" />}
                      Pagar con Flow
                    </Button>
                  </div>
                </div>
              )}
              <div className="flex flex-col gap-2">
                {multas.map(m => (
                  <div key={m.id} className="flex items-center justify-between rounded-xl border px-4 py-3">
                    <div>
                      <p className="text-sm font-medium">
                        {m.dias_atraso} día(s) de atraso — {(m as any).prestamo?.libro?.titulo ?? `Préstamo #${m.prestamo_id}`}
                      </p>
                      <p className="text-xs text-muted-foreground">${m.monto} CLP — {new Date(m.created_at).toLocaleDateString("es-CL")}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={m.pagada ? "default" : "destructive"}>
                        {m.pagada ? "Pagada" : "Pendiente"}
                      </Badge>
                      {m.pagada && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-xs h-6 px-1.5"
                          onClick={async () => {
                            try {
                              const isOnline = !(window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1")
                              const uidShort = (usuario?.id || "0").substring(0, 8)
                              const url = isOnline
                                ? `${UPLOAD_SERVER}/multas-pdf/${uidShort}/${m.id}.pdf`
                                : `${getServerUrl()}/multas-pdf/${m.id}`
                              const res = await fetch(url)
                              const blob = await res.blob()
                              const objUrl = URL.createObjectURL(blob)
                              const a = document.createElement("a")
                              a.href = objUrl
                              a.download = `multa-${m.id}.pdf`
                              document.body.appendChild(a)
                              a.click()
                              document.body.removeChild(a)
                              setTimeout(() => URL.revokeObjectURL(objUrl), 1000)
                            } catch { toast.error("Error al descargar PDF") }
                          }}
                        >
                          <Download className="size-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>
      )}

      <Dialog open={!!pdfUrl} onOpenChange={(o) => { if (!o) setPdfUrl("") }}>
        <DialogContent className="max-w-full sm:max-w-2xl h-[85vh] p-0 flex flex-col overflow-hidden mx-2 sm:mx-0" showCloseButton={false}>
          <DialogHeader className="px-4 py-2 shrink-0 gap-0 border-b">
            <div className="flex items-center justify-between">
              <DialogTitle className="text-sm">Comprobante de Pedido</DialogTitle>
              <div className="flex items-center gap-2">
                {pdfDownload && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      if (pdfBlob.current) {
                        const url = URL.createObjectURL(pdfBlob.current)
                        const a = document.createElement("a")
                        a.href = url
                        a.download = pdfDownload.split("/").pop() || "pedido.pdf"
                        document.body.appendChild(a)
                        a.click()
                        document.body.removeChild(a)
                        setTimeout(() => URL.revokeObjectURL(url), 1000)
                      } else {
                        toast.error("El PDF aún no está listo, intentá de nuevo")
                      }
                    }}
                  >
                    <Download data-icon="inline-start" />
                    Descargar
                  </Button>
                )}
                <Button size="icon" variant="ghost" onClick={() => setPdfUrl("")}>
                  <X />
                </Button>
              </div>
            </div>
          </DialogHeader>
          {pdfUrl && (
            <div className="flex-1 overflow-hidden relative">
              <embed src={pdfUrl} type="application/pdf" className="absolute top-[-44px] left-0 w-full h-[calc(100%+44px)]" />
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!resenaLibroId} onOpenChange={(o) => { if (!o) setResenaLibroId(null) }}>
        <DialogContent className="sm:max-w-md mx-2 sm:mx-0">
          <DialogHeader>
            <DialogTitle>{resenaEditId ? "Editar reseña" : "Reseñar"}: {resenaLibroTitulo}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            {resenaLibroCaratula ? (
              <div className="flex gap-3 items-start">
                <img src={resenaLibroCaratula.startsWith("http") ? resenaLibroCaratula : `${UPLOAD_SERVER}${resenaLibroCaratula}`} alt="" className="w-14 h-20 rounded-sm object-cover shrink-0 border" />
                {resenaLibroSinopsis && <p className="text-xs text-muted-foreground line-clamp-4">{resenaLibroSinopsis}</p>}
              </div>
            ) : resenaLibroSinopsis ? (
              <p className="text-xs text-muted-foreground">{resenaLibroSinopsis}</p>
            ) : null}
            <div className="flex gap-0.5 justify-center">
              {[1, 2, 3, 4, 5].map((n) => (
                <button key={n} type="button"
                  onClick={() => setResenaPuntuacion(n)}
                  className="cursor-pointer hover:scale-110 transition-transform">
                  <Star className={`size-7 ${n <= resenaPuntuacion ? "fill-amber-500 text-amber-500" : "text-muted-foreground/30"}`} />
                </button>
              ))}
            </div>
            <Textarea
              value={resenaComentario}
              onChange={e => setResenaComentario(e.target.value)}
              placeholder="¿Qué te pareció este libro?"
              rows={4}
            />
            {resenaFotos.length > 0 && (
              <div className="flex gap-2 flex-wrap">
                {resenaFotos.map((url, i) => (
                  <div key={i} className="relative group">
                    <img src={url.startsWith("http") ? url : `${UPLOAD_SERVER}${url}`} alt="" className="w-16 h-16 object-cover rounded-md border" />
                    <button
                      className="absolute -top-1.5 -right-1.5 size-4 rounded-full bg-destructive text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => setResenaFotos(prev => prev.filter((_, j) => j !== i))}
                    >
                      <X className="size-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="flex gap-2">
              <label className={`cursor-pointer inline-flex items-center gap-1.5 text-xs border rounded-md px-3 py-2 ${uploadingFoto ? "text-muted-foreground/50 cursor-not-allowed" : "text-muted-foreground hover:text-foreground transition-colors"}`}>
                <input type="file" accept="image/*" className="hidden" onChange={handleResenaFoto} disabled={uploadingFoto} />
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>
                {uploadingFoto ? "Subiendo..." : "Agregar foto"}
              </label>
              <Button onClick={handleSubmitResena} disabled={resenaLoading || resenaPuntuacion === 0 || uploadingFoto} className="flex-1">
                {resenaLoading && <span className="animate-spin size-4 border-2 border-white/30 border-t-white rounded-full mr-2" />}
                {resenaEditId ? "Guardar cambios" : "Publicar reseña"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
