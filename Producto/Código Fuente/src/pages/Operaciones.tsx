import { useState, useEffect, useRef } from "react"
import { Navigate } from "react-router-dom"
import { getUploadUrl } from "@/lib/api-config"
import { toast } from "sonner"
import { ChevronRight, Camera, BookOpen } from "lucide-react"
import { useAuth } from "@/contexts/AuthContext"
import { api, type Seccion } from "@/lib/api"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog"
import {
  Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible"
import { Separator } from "@/components/ui/separator"
import { Field, FieldLabel } from "@/components/ui/field"
import EscannerQR from "@/components/EscannerQR"

function getErrorMessage(err: unknown): string {
  if (err instanceof Error) {
    const msg = err.message
    if (msg.includes("foreign key") || msg.includes("llave foránea") || msg.includes("violates")) {
      return "No se puede eliminar porque está siendo usado por otros registros"
    }
    return msg
  }
  if (typeof err === "object" && err && "message" in err) return String((err as { message: unknown }).message)
  return "Error inesperado"
}

export default function Operaciones() {
  const { usuario } = useAuth()
  if (!usuario || !["admin", "bibliotecario"].includes(usuario.rol)) return <Navigate to="/inicio" replace />
  return <OpsContent />
}

function OpsContent() {
  const { usuario } = useAuth()
  const [pendientes, setPendientes] = useState<Awaited<ReturnType<typeof api.getPrestamosPendientesGrouped>>>([])
  const [detalleGrupo, setDetalleGrupo] = useState<typeof pendientes[number] | null>(null)
  const [notaRevision, setNotaRevision] = useState("")
  const [ejemplaresSelect, setEjemplaresSelect] = useState<Map<number, { disponibles: { id: number; codigo: string }[]; selected: number | null }>>(new Map())
  const [devolucionSearch, setDevolucionSearch] = useState("")
  const [devolucionResults, setDevolucionResults] = useState<any[]>([])
  const [devolucionEjemplar, setDevolucionEjemplar] = useState<any>(null)
  const [lugaresRetiro, setLugaresRetiro] = useState<Seccion[]>([])
  const [lugarRetiro, setLugarRetiro] = useState("")
  const lugarRetiroInicial = useRef("")
  const [scannerOpen, setScannerOpen] = useState(false)
  const [scanTargetPrestamo, setScanTargetPrestamo] = useState<number | null>(null)
  const [porEntregar, setPorEntregar] = useState<Awaited<ReturnType<typeof api.getPrestamosPorEntregar>>>([])

  const loadData = () => {
    api.getPrestamosPendientesGrouped().then(setPendientes)
    api.getPrestamosPorEntregar().then(setPorEntregar)
  }

  useEffect(() => { loadData() }, [])
  useEffect(() => {
    const interval = setInterval(loadData, 15000)
    return () => clearInterval(interval)
  }, [])
  useEffect(() => {
    api.getSecciones().then((data) => setLugaresRetiro(data.filter(s => s.categoria === "Atención")))
  }, [])

  useEffect(() => {
    const loadEjemplares = async () => {
      const map = new Map<number, { disponibles: { id: number; codigo: string }[]; selected: number | null }>()
      for (const grupo of pendientes) {
        for (const p of grupo.prestamos) {
          if (!p.libro_id) continue
          const disps = await api.getEjemplaresDisponibles(p.libro_id).catch(() => []) as { id: number; codigo: string }[]
          map.set(p.id, { disponibles: disps, selected: p.ejemplar_id ?? null })
        }
      }
      setEjemplaresSelect(map)
    }
    if (pendientes.length > 0) loadEjemplares()
  }, [pendientes])

  const openEjemplaresReview = (grupo: typeof pendientes[number]) => {
    setDetalleGrupo(grupo)
    setNotaRevision("")
    const lr = (grupo as any).lugar_retiro ?? ""
    setLugarRetiro(lr)
    lugarRetiroInicial.current = lr
    const loadEjemplares = async () => {
      const map = new Map<number, { disponibles: { id: number; codigo: string }[]; selected: number | null }>()
      for (const p of grupo.prestamos) {
        if (!p.libro_id) continue
        const disps = await api.getEjemplaresDisponibles(p.libro_id).catch(() => []) as { id: number; codigo: string }[]
        map.set(p.id, { disponibles: disps, selected: p.ejemplar_id ?? null })
      }
      setEjemplaresSelect(map)
    }
    loadEjemplares()
  }

  const handleDevolucionSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    const q = devolucionSearch.trim()
    if (!q) return
    setDevolucionEjemplar(null)
    setDevolucionResults([])
    if (q.toUpperCase().startsWith("LIB-")) {
      const ej = await api.buscarEjemplarPorCodigo(q).catch(() => null)
      if (ej) {
        setDevolucionEjemplar(ej)
        if (ej.estado === "prestado") {
          const prestamos = await api.getPrestamoActivoByEjemplar(ej.id).catch(() => [])
          setDevolucionResults(prestamos as any)
        }
      } else { toast.warning("Ejemplar no encontrado") }
    } else {
      const result = await api.buscarPrestamosActivosUsuario(q.startsWith("@") ? q.slice(1) : q).catch(() => [])
      setDevolucionResults(result)
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold mb-6">Operaciones</h1>

      <Tabs defaultValue="pendientes">
        <TabsList className="mb-6">
          <TabsTrigger value="pendientes">Pendientes</TabsTrigger>
          <TabsTrigger value="por_entregar">Por entregar</TabsTrigger>
          <TabsTrigger value="devolucion">Devolución</TabsTrigger>
        </TabsList>

        <TabsContent value="pendientes">
          <h2 className="text-lg font-semibold mb-4">Préstamos pendientes de aprobación</h2>
          {pendientes.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No hay préstamos pendientes.</p>
          ) : (
            <div className="space-y-6">
              {pendientes.map((grupo, gi) => (
                <Card key={gi} size="sm" className="!p-0">
                  <Collapsible>
                    <div className="flex items-center justify-between px-4 py-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <CollapsibleTrigger asChild>
                            <Button variant="ghost" size="sm" className="group gap-1 h-auto px-1.5 py-0.5">
                              <ChevronRight className="size-3.5 transition-transform group-data-[state=open]:rotate-90" />
                              <span className="text-xs text-muted-foreground">{grupo.prestamos.length} libro(s)</span>
                            </Button>
                          </CollapsibleTrigger>
                          <p className="text-sm font-medium">
                            Pedido {grupo.codigo ?? (grupo.grupo_id ? `#${grupo.grupo_id}` : "")} — @{grupo.usuario_nombre}
                          </p>
                          <Badge variant={grupo.prestamos[0]?.estado === "en_revision" ? "default" : "secondary"}>
                            {grupo.prestamos[0]?.estado === "en_revision" ? "En revisión" : "Pendiente"}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Devolución: {new Date(grupo.fecha_devolucion).toLocaleDateString("es-CL")}
                        </p>
                        {grupo.revisor_nombre && (
                          <p className="text-xs text-muted-foreground">
                            Revisado por: {grupo.revisor_nombre}
                          </p>
                        )}
                      </div>
                      <div className="flex gap-2">
                      {grupo.prestamos[0]?.estado === "pendiente" ? (
                        <Button size="sm" onClick={async () => {
                          if (!grupo.grupo_id) return
                          try {
                            await api.revisarGrupo(grupo.grupo_id, usuario?.id)
                            await loadData()
                            const actualizado = await api.getPrestamosPendientesGrouped()
                            const g = actualizado.find(x => x.grupo_id === grupo.grupo_id)
                            if (g && g.prestamos[0]?.estado === "en_revision") {
                              openEjemplaresReview(g)
                            } else {
                              toast.warning("Este pedido ya fue cancelado por el usuario")
                              loadData()
                            }
                          } catch (err) { toast.error(getErrorMessage(err)) }
                        }}>Revisar</Button>
                      ) : (
                        <Button size="sm" variant="outline" onClick={() => { loadData(); openEjemplaresReview(grupo) }}>
                          Continuar revisión
                        </Button>
                      )}
                      </div>
                    </div>
                    <CollapsibleContent>
                      <Separator />
                      <Table>
                        <TableBody>
                          {grupo.prestamos.map(p => (
                            <TableRow key={p.id}>
                              <TableCell className="font-medium">{p.libro?.titulo ?? `Libro #${p.libro_id}`}</TableCell>
                              <TableCell className="text-sm text-muted-foreground">{p.ejemplar_id ? "Asignado" : "Sin asignar"}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </CollapsibleContent>
                  </Collapsible>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
        <TabsContent value="por_entregar">
          <h2 className="text-lg font-semibold mb-4">Pedidos por entregar</h2>
          {porEntregar.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No hay pedidos por entregar.</p>
          ) : (
            <div className="space-y-6">
              {porEntregar.map((grupo, gi) => (
                <Card key={gi} size="sm" className="!p-0">
                  <div className="flex items-center justify-between px-4 py-3">
                    <div>
                      <p className="text-sm font-medium">
                        Pedido {grupo.grupo_id ? `#${grupo.grupo_id}` : ""} — @{grupo.usuario_nombre}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {grupo.prestamos.length} libro(s)
                        {grupo.lugar_retiro && ` · Retirar en: ${grupo.lugar_retiro}`}
                      </p>
                    </div>
                    <Button size="sm" onClick={async () => {
                      if (!grupo.grupo_id) return
                      try {
                        await api.entregarPedido(grupo.grupo_id)
                        toast.success("Pedido entregado")
                        loadData()
                      } catch (err) { toast.error(getErrorMessage(err)) }
                    }}>
                      Marcar como entregado
                    </Button>
                  </div>
                  <Separator />
                  <Table>
                    <TableBody>
                      {grupo.prestamos.map(p => (
                        <TableRow key={p.id}>
                          <TableCell className="font-medium">{p.libro?.titulo ?? `Libro #${p.libro_id}`}</TableCell>
                          <TableCell className="text-sm text-muted-foreground font-mono">{p.ejemplar?.codigo ?? "—"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="devolucion">
          <h2 className="text-lg font-semibold mb-4">Devolución de libros</h2>
          <form onSubmit={handleDevolucionSearch} className="flex gap-2 mb-6">
            <Input value={devolucionSearch} onChange={e => setDevolucionSearch(e.target.value)} placeholder="Buscar por código (LIB-1-001) o @usuario..." className="max-w-md" />
            <Button type="submit" size="sm">Buscar</Button>
          </form>
          {devolucionEjemplar && (
            <Card size="sm" className="mb-4 !p-4">
              <div className="flex items-center gap-4">
                <div>
                  <p className="text-sm font-medium">{devolucionEjemplar.libro?.titulo}</p>
                  <p className="text-xs text-muted-foreground">{devolucionEjemplar.libro?.autor?.nombre} · {devolucionEjemplar.codigo}</p>
                  <Badge variant={devolucionEjemplar.estado === "prestado" ? "destructive" : "secondary"} className="mt-1">{devolucionEjemplar.estado}</Badge>
                </div>
              </div>
            </Card>
          )}
          {devolucionResults.length > 0 && (
            <Card className="overflow-hidden !p-0">
              <Table>
                <TableHeader><TableRow><TableHead>Libro</TableHead><TableHead>Ejemplar</TableHead><TableHead>Usuario</TableHead><TableHead className="w-24">Acción</TableHead></TableRow></TableHeader>
                <TableBody>
                  {devolucionResults.map((p: any) => (
                    <TableRow key={p.id}>
                      <TableCell className="text-sm font-medium">{p.ejemplar?.libro?.titulo ?? "—"}</TableCell>
                      <TableCell className="font-mono text-sm">{p.ejemplar?.codigo}</TableCell>
                      <TableCell>@{p.usuario?.nombre_usuario}</TableCell>
                      <TableCell>
                        <Button size="sm" variant="outline" onClick={async () => {
                          try {
                            await api.devolverPrestamo(p.id)
                            toast.success("Libro devuelto")
                            if ((p as any).usuario?.id) {
                              const titulo = (p as any).ejemplar?.libro?.titulo ?? (p as any).libro?.titulo ?? "un libro"
                              const libroId = (p as any).ejemplar?.libro_id ?? (p as any).libro_id
                              if (libroId) {
                                api.createNotificacion({
                                  usuario_id: (p as any).usuario.id,
                                  titulo: "Libro devuelto",
                                  mensaje: `Has devuelto "${titulo}". ¡Déjanos una reseña!`,
                                }).catch(() => {})
                              }
                            }
                            setDevolucionResults((prev: any[]) => prev.filter((x: any) => x.id !== p.id))
                          } catch (err) { toast.error(getErrorMessage(err)) }
                        }}>Devolver</Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          )}
          {devolucionSearch && devolucionResults.length === 0 && !devolucionEjemplar && (
            <p className="text-sm text-muted-foreground text-center py-8">No se encontraron resultados.</p>
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={!!detalleGrupo} onOpenChange={(o) => { if (!o) { setDetalleGrupo(null); loadData() } }}>
        <DialogContent className="sm:max-w-xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Pedido {detalleGrupo?.codigo ?? (detalleGrupo?.grupo_id ? `#${detalleGrupo.grupo_id}` : "")}</DialogTitle>
            <DialogDescription>@{detalleGrupo?.usuario_nombre} · {detalleGrupo?.prestamos.length} libro(s) · Devolución: {detalleGrupo ? new Date(detalleGrupo.fecha_devolucion).toLocaleDateString("es-CL") : ""}{detalleGrupo?.revisor_nombre ? ` · Revisando: ${detalleGrupo.revisor_nombre}` : ""}</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            {detalleGrupo?.prestamos.map(p => {
              const ejData = ejemplaresSelect.get(p.id)
              const allDisps = ejData?.disponibles ?? []

              const selectedByOthers = new Set(
                detalleGrupo?.prestamos
                  .filter(x => x.id !== p.id && x.libro_id === p.libro_id)
                  .map(x => ejemplaresSelect.get(x.id)?.selected)
                  .filter((v): v is number => v != null && v > 0)
              )

              const disps = allDisps.filter(d => !selectedByOthers.has(d.id))
              return (
                <div key={p.id} className="rounded-lg border p-3 flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-10 shrink-0 rounded-sm overflow-hidden bg-muted">
                      {p.libro?.caratula ? (
                        <img src={p.libro.caratula.startsWith("http") ? p.libro.caratula : `${getUploadUrl()}${p.libro.caratula}`} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <div className="h-full w-full flex items-center justify-center">
                          <BookOpen className="size-3 text-muted-foreground/30" />
                        </div>
                      )}
                    </div>
                    <p className="text-sm font-medium truncate">{p.libro?.titulo ?? `Libro #${p.libro_id}`}</p>
                  </div>
                  {p.estado === "no_disponible" ? (
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">No disponible</Badge>
                      <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={async () => {
                        try {
                          await api.desmarcarNoDisponible(p.id)
                          toast.success("Desmarcado")
                          loadData()
                          setDetalleGrupo(prev => prev ? { ...prev, prestamos: prev.prestamos.map(x => x.id === p.id ? { ...x, estado: "en_revision" } : x) } : null)
                          if (p.libro_id) {
                            const disps = await api.getEjemplaresDisponibles(p.libro_id).catch(() => []) as { id: number; codigo: string }[]
                            setEjemplaresSelect(prev => { const next = new Map(prev); next.set(p.id, { disponibles: disps, selected: null }); return next })
                          }
                        } catch (err) { toast.error(getErrorMessage(err)) }
                      }}>Desmarcar</Button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground whitespace-nowrap">{disps.filter(d => d.id !== ejData?.selected).length} disponible(s)</span>
                      <Select value={String(ejData?.selected ?? (ejData?.selected === null ? "__none__" : ""))} onValueChange={async (v) => {
                      if (v === "__none__") {
                        setEjemplaresSelect(prev => { const next = new Map(prev); next.set(p.id, { disponibles: allDisps, selected: null }); return next })
                        try {
                          await fetch(`http://localhost:3000/prestamos?id=eq.${p.id}`, {
                            method: "PATCH",
                            body: JSON.stringify({ ejemplar_id: null }),
                            headers: { "Content-Type": "application/json" },
                          })
                          setDetalleGrupo(prev => prev ? { ...prev, prestamos: prev.prestamos.map(x => x.id === p.id ? { ...x, ejemplar_id: null } : x) } : null)
                          loadData()
                        } catch {}
                        return
                      }
                      const ejId = Number(v)
                      const prevSelected = ejData?.selected
                      setEjemplaresSelect(prev => {
                        const next = new Map(prev)
                        next.set(p.id, { disponibles: allDisps, selected: ejId })
                        return next
                      })
                      try {
                        await api.asignarEjemplar(p.id, ejId)
                        setDetalleGrupo(prev => prev ? { ...prev, prestamos: prev.prestamos.map(x => x.id === p.id ? { ...x, ejemplar_id: ejId } : x) } : null)
                        loadData()
                        toast.success("Ejemplar asignado")
                      } catch (err) {
                        toast.error(getErrorMessage(err))
                        setEjemplaresSelect(prev => { const next = new Map(prev); next.set(p.id, { disponibles: allDisps, selected: prevSelected ?? null }); return next })
                      }
                    }}>
                      <SelectTrigger className="h-8 text-xs flex-1 min-w-0"><SelectValue placeholder="Seleccionar ejemplar..." /></SelectTrigger>
                      <SelectContent><SelectGroup>
                        <SelectItem value="__none__">— Ninguno —</SelectItem>
                        {disps.map(ej => <SelectItem key={ej.id} value={String(ej.id)}>{ej.codigo}</SelectItem>)}
                      </SelectGroup></SelectContent>
                    </Select>
                    <Button size="sm" variant="ghost" className="h-7 text-xs shrink-0 px-1.5" onClick={() => { setScanTargetPrestamo(p.id); setScannerOpen(true) }} title="Escanear código QR">
                      <Camera className="size-3.5" />
                    </Button>
                    <Button size="sm" variant="ghost" className="h-7 text-xs shrink-0" onClick={async () => {
                       try { await api.marcarNoDisponible(p.id); toast.info("Marcado como no disponible"); setEjemplaresSelect(prev => { const next = new Map(prev); next.set(p.id, { disponibles: allDisps, selected: null }); return next }); setDetalleGrupo(prev => prev ? { ...prev, prestamos: prev.prestamos.map(x => x.id === p.id ? { ...x, estado: "no_disponible", ejemplar_id: null } : x) } : null); loadData() } catch (err) { toast.error(getErrorMessage(err)) }
                    }}>No disponible</Button>
                  </div>
                  )}
                </div>
              )
            })}
          </div>
          <Field className="mb-4">
            <FieldLabel>Nota para el usuario (opcional)</FieldLabel>
              <Textarea value={notaRevision} onChange={e => setNotaRevision(e.target.value)} placeholder="Escribe una nota o mensaje para el usuario..." rows={2} className="text-sm w-full" />
          </Field>
          <Field className="mb-4">
            <FieldLabel>Lugar de retiro (obligatorio)</FieldLabel>
            <Select value={lugarRetiro} onValueChange={setLugarRetiro}>
              <SelectTrigger><SelectValue placeholder="Seleccionar lugar de retiro..." /></SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {lugaresRetiro.map(l => (
                    <SelectItem key={l.id} value={l.nombre}>{l.nombre}</SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </Field>
          <DialogFooter>
            <div className="flex gap-2 justify-end w-full">
              <Button variant="outline" onClick={() => setDetalleGrupo(null)}>Cerrar</Button>
              {(() => {
                const necesitaAprobacion = detalleGrupo?.prestamos.some(p => !p.ejemplar_id || p.estado === "no_disponible")
                return (
                  <Button
                    disabled={!lugarRetiro}
                    onClick={async () => {
                    if (!detalleGrupo?.grupo_id) return
                    try {
                      await api.solicitarAprobacion(detalleGrupo.grupo_id, notaRevision.trim() || undefined, lugarRetiro || undefined)
                      toast.success(necesitaAprobacion ? "Pendiente de aprobación del usuario" : "Pedido aprobado")
                      if (detalleGrupo?.usuario_id) {
                        const titulos = detalleGrupo.prestamos.map(p => p.libro?.titulo ?? `Libro #${p.libro_id}`).slice(0, 3).join(", ")
                        const extra = detalleGrupo.prestamos.length > 3 ? ` y ${detalleGrupo.prestamos.length - 3} más` : ""
                        if (necesitaAprobacion) {
                          api.createNotificacion({ usuario_id: detalleGrupo.usuario_id, titulo: "Pedido en revisión", mensaje: `Tu pedido de ${titulos}${extra} requiere tu revisión. Algunos libros no están disponibles.` }).catch(err => console.error("Notif error:", err))
                        } else {
                          api.createNotificacion({ usuario_id: detalleGrupo.usuario_id, titulo: "Pedido listo para retirar", mensaje: `Tu pedido de ${titulos}${extra} está listo. Retíralo en: ${lugarRetiro}.` }).catch(err => console.error("Notif error:", err))
                          api.generarPedidoPDF(detalleGrupo.grupo_id, detalleGrupo.usuario_id).catch(() => {})
                        }
                      }
                      setDetalleGrupo(null)
                      loadData()
                    } catch (err) { toast.error(getErrorMessage(err)) }
                  }}>
                    {necesitaAprobacion ? "Finalizar revisión" : "Aprobar pedido"}
                  </Button>
                )
              })()}
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <EscannerQR
        open={scannerOpen}
        onClose={() => { setScannerOpen(false); setScanTargetPrestamo(null) }}
        onScan={async (code) => {
          setScannerOpen(false)
          if (!scanTargetPrestamo) return
          try {
            const ej = await api.buscarEjemplarPorCodigo(code)
            if (!ej) { toast.error("Código no encontrado"); return }
            const p = detalleGrupo?.prestamos.find(x => x.id === scanTargetPrestamo)
            if (!p) { toast.error("Préstamo no encontrado"); return }
            if (ej.libro_id !== p.libro_id) {
              toast.error(`El ejemplar ${code} pertenece a "${ej.libro?.titulo ?? 'otro libro'}", no a este libro`)
              return
            }
            await api.asignarEjemplar(scanTargetPrestamo, ej.id)
            toast.success(`Ejemplar ${code} asignado`)
            loadData()
            setDetalleGrupo(prev => prev ? { ...prev, prestamos: prev.prestamos.map(x => x.id === scanTargetPrestamo ? { ...x, ejemplar_id: ej.id } : x) } : null)
            setEjemplaresSelect(prev => {
              const next = new Map(prev)
              const current = next.get(scanTargetPrestamo)
              if (current) next.set(scanTargetPrestamo, { ...current, selected: ej.id })
              return next
            })
          } catch (err) { toast.error(getErrorMessage(err)) }
          setScanTargetPrestamo(null)
        }}
      />
    </div>
  )
}
