import { useState, useEffect } from "react"
import { ShoppingCart, Minus, Plus, Trash2, Loader2, CalendarIcon, BookOpen } from "lucide-react"
import { toast } from "sonner"
import { useCart } from "@/contexts/CartContext"
import { useAuth } from "@/contexts/AuthContext"
import { useNotificaciones } from "@/contexts/NotificacionesContext"
import { api, type LibroConAutor } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover"
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet"
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"
import { getUploadUrl } from "@/lib/api-config"

const UPLOAD_SERVER = getUploadUrl()

export default function CartDrawer() {
  const { usuario } = useAuth()
  const { items, removeFromCart, clearCart, setQuantity, count } = useCart()
  const { addNotificacion } = useNotificaciones()
  const [open, setOpen] = useState(false)
  const [fechaDevolucion, setFechaDevolucion] = useState<Date>(() => {
    const d = new Date()
    d.setDate(d.getDate() + 14)
    return d
  })
  const [loading, setLoading] = useState(false)
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null)
  const [libros, setLibros] = useState<Map<number, LibroConAutor>>(new Map())

  useEffect(() => {
    if (open && Object.keys(items).length > 0) {
      const ids = Object.keys(items).map(Number)
      api.getLibros().then((all) => {
        const map = new Map<number, LibroConAutor>()
        for (const l of all) {
          if (ids.includes(l.id)) map.set(l.id, l)
        }
        setLibros(map)
      })
    }
  }, [open, items])

  const handleCheckout = async () => {
    if (!usuario || Object.keys(items).length === 0) return
    setLoading(true)
    try {
      const puede = await api.puedePedir(usuario.id)
      if (!puede) {
        toast.error("Tienes multas pendientes. Paga tus multas antes de pedir libros.")
        setLoading(false)
        return
      }
      const result = await api.crearPrestamoBatch({
        usuario_id: usuario.id,
        libro_ids: items,
        fecha_devolucion: fechaDevolucion.toISOString(),
      })
      if (result.creados > 0) {
        toast.success(`${result.creados} préstamo(s) solicitado(s). Pendiente de aprobación.`)
        try { addNotificacion("Pedido creado", `Has solicitado ${result.creados} libro(s). Tu pedido está pendiente de revisión.`) } catch {}
        clearCart()
        setOpen(false)
      }
    } catch (err) { toast.error(err instanceof Error ? err.message : "Error al crear pedido") }
    finally { setLoading(false) }
  }

  return (
    <>
      <Button variant="ghost" size="icon-sm" onClick={() => setOpen(true)} className="relative">
        <ShoppingCart />
        {count > 0 && (
          <span className="absolute -top-1 -right-1 size-4 rounded-full bg-primary text-[10px] text-primary-foreground flex items-center justify-center font-medium">
            {count > 9 ? "9+" : count}
          </span>
        )}
      </Button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="flex flex-col w-full sm:max-w-md gap-0">
          <SheetHeader className="px-6 pt-6">
            <SheetTitle className="flex items-center gap-2">
              <ShoppingCart className="size-5" />
              Carrito
              {count > 0 && (
                <span className="text-sm font-normal text-muted-foreground">({count} ejemplares)</span>
              )}
            </SheetTitle>
            <SheetDescription>
              {count === 0
                ? "Agrega libros desde el catálogo para solicitar un préstamo."
                : "Revisa tu pedido antes de enviarlo a aprobación."}
            </SheetDescription>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto px-6 pb-4 space-y-3">
            {Object.keys(items).length > 0 && (
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Fecha de devolución</label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !fechaDevolucion && "text-muted-foreground")}>
                      <CalendarIcon />
                      {fechaDevolucion.toLocaleDateString("es-CL", { weekday: "short", day: "numeric", month: "short", year: "numeric" })}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={fechaDevolucion} onSelect={(date) => date && setFechaDevolucion(date)} />
                  </PopoverContent>
                </Popover>
              </div>
            )}

            {Object.keys(items).length > 0 && <Separator />}

            {Object.keys(items).length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center gap-3 text-muted-foreground py-12">
                <ShoppingCart className="size-12 opacity-20" />
                <p className="text-sm">Tu carrito está vacío</p>
                <p className="text-xs">Explora el catálogo y agrega libros</p>
              </div>
            ) : (
              Object.entries(items).map(([libroIdStr, cant]) => {
                const libroId = Number(libroIdStr)
                const libro = libros.get(libroId)
                const caratulaUrl = libro?.caratula
                  ? libro.caratula.startsWith("http") ? libro.caratula : `${UPLOAD_SERVER}${libro.caratula}`
                  : null

                return (
                  <div key={libroId} className="flex gap-3 rounded-lg border p-3 items-center hover:border-primary/20 transition-colors">
                    <div className="w-10 h-14 shrink-0 rounded-sm overflow-hidden bg-muted">
                      {caratulaUrl ? (
                        <img src={caratulaUrl} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <div className="h-full w-full flex items-center justify-center">
                          <BookOpen className="size-4 text-muted-foreground/30" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{libro?.titulo ?? `Libro #${libroId}`}</p>
                      {libro && <p className="text-xs text-muted-foreground truncate">{libro.autor.nombre}</p>}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button size="icon-xs" variant="ghost" className="size-6" onClick={() => { if (cant > 1) setQuantity(libroId, cant - 1) }}><Minus className="size-3" /></Button>
                      <span className="text-sm font-medium w-5 text-center tabular-nums">{cant}</span>
                      <Button size="icon-xs" variant="ghost" className="size-6" onClick={() => { if (!setQuantity(libroId, cant + 1)) toast.warning("Máximo 5 ejemplares") }}><Plus className="size-3" /></Button>
                      <Button size="icon-xs" variant="ghost" className="size-6 ml-1" onClick={() => setDeleteConfirmId(libroId)}><Trash2 className="size-3 text-muted-foreground" /></Button>
                    </div>
                  </div>
                )
              })
            )}
          </div>

          {Object.keys(items).length > 0 && (
            <div className="px-6 pb-6">
              <Separator className="mb-4" />
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
                <Button onClick={handleCheckout} disabled={loading}>
                  {loading && <Loader2 className="animate-spin" data-icon="inline-start" />}
                  Confirmar pedido
                </Button>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      <AlertDialog open={!!deleteConfirmId} onOpenChange={(o) => { if (!o) setDeleteConfirmId(null) }}>
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle>Quitar libro</AlertDialogTitle>
            <AlertDialogDescription>¿Estás seguro de quitar este libro del carrito?</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel variant="outline">Cancelar</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={() => { if (deleteConfirmId) { removeFromCart(deleteConfirmId); setDeleteConfirmId(null) } }}>
              Quitar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
