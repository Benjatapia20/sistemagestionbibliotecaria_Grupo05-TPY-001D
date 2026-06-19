import { Bell, CheckCheck, Trash2 } from "lucide-react"
import { useNavigate } from "react-router-dom"
import { useNotificaciones, type Notificacion } from "@/contexts/NotificacionesContext"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from "@/components/ui/empty"
import { cn } from "@/lib/utils"

function NotificacionItem({ n, onRead, onDelete }: { n: Notificacion; onRead: (id: number) => void; onDelete: (id: number) => void }) {
  const navigate = useNavigate()
  const hace = getTimeAgo(n.created_at)

  const handleClick = () => {
    onRead(n.id)
    if (n.link) navigate(n.link)
  }

  return (
    <div
      className={cn(
        "flex items-start gap-3 px-4 py-3 transition-colors cursor-pointer hover:bg-muted/50",
        !n.leida && "bg-primary/5"
      )}
      onClick={handleClick}
    >
      <div className={cn(
        "shrink-0 size-8 rounded-full flex items-center justify-center mt-0.5",
        n.leida ? "bg-muted" : "bg-primary/10"
      )}>
        <Bell className={cn("size-3.5", n.leida ? "text-muted-foreground" : "text-primary")} />
      </div>
      <div className="flex-1 min-w-0">
        <p className={cn("text-sm", !n.leida && "font-medium")}>{n.titulo}</p>
        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.mensaje || n.titulo}</p>
        <p className="text-[10px] text-muted-foreground mt-1">{hace}</p>
      </div>
      <Button
        size="icon-xs"
        variant="ghost"
        className="shrink-0 opacity-0 group-hover:opacity-100"
        onClick={(e) => { e.stopPropagation(); onDelete(n.id) }}
      >
        <Trash2 className="size-3.5" />
      </Button>
    </div>
  )
}

function getTimeAgo(iso: string): string {
  const ahora = Date.now()
  const fecha = new Date(iso).getTime()
  const diff = ahora - fecha
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return "Ahora"
  if (mins < 60) return `Hace ${mins} min`
  const horas = Math.floor(mins / 60)
  if (horas < 24) return `Hace ${horas}h`
  const dias = Math.floor(horas / 24)
  return `Hace ${dias}d`
}

export default function Notificaciones() {
  const { notificaciones, noLeidas, marcarLeida, marcarTodasLeidas, eliminarNotificacion } = useNotificaciones()

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold">Notificaciones</h1>
        {noLeidas > 0 && (
          <Button variant="ghost" size="sm" onClick={marcarTodasLeidas}>
            <CheckCheck />
            Marcar todas leídas
          </Button>
        )}
      </div>

      {notificaciones.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon"><Bell /></EmptyMedia>
            <EmptyTitle>Sin notificaciones</EmptyTitle>
            <EmptyDescription>Aquí aparecerán las notificaciones de tus pedidos y préstamos.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="rounded-xl border overflow-hidden">
          {notificaciones.map((n, i) => (
            <div key={n.id}>
              {i > 0 && <Separator />}
              <NotificacionItem n={n} onRead={marcarLeida} onDelete={eliminarNotificacion} />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
