import { useState, useEffect, useRef } from "react"
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch"
import { ZoomIn, ZoomOut, RotateCcw } from "lucide-react"
import { api, type Seccion, type CategoriaSeccion } from "@/lib/api"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"

export default function Mapa() {
  const [secciones, setSecciones] = useState<Seccion[]>([])
  const [loading, setLoading] = useState(true)
  const [seleccionada, setSeleccionada] = useState<Seccion | null>(null)
  const [mapaImagen, setMapaImagen] = useState("")
  const [categorias, setCategorias] = useState<CategoriaSeccion[]>([])
  const dragStart = useRef<{ x: number; y: number } | null>(null)

  useEffect(() => {
    api.getSecciones().then((data) => { setSecciones(data); setLoading(false) })
    api.getConfig("mapa_imagen").then(v => setMapaImagen(v ?? ""))
    api.getCategoriasSecciones().then(setCategorias)
  }, [])

  return (
    <div className="max-w-screen-2xl mx-auto">
      <h1 className="text-2xl font-semibold mb-4">Mapa de la Biblioteca</h1>

      {!loading && (
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          {categorias.map((c) => (
            <Badge key={c.id} variant="outline" className="gap-1.5 text-xs">
              <span className={`size-2 rounded-full ${c.color}`} />
              {c.nombre}
            </Badge>
          ))}
        </div>
      )}

      {loading ? (
        <Skeleton className="w-full aspect-[4/3] rounded-xl" />
      ) : (
        <TransformWrapper
          initialScale={1}
          minScale={0.5}
          maxScale={3}
          wheel={{ disabled: true }}
          doubleClick={{ disabled: true }}
          centerOnInit
        >
          {({ zoomIn, zoomOut, resetTransform }) => (
            <>
              <div className="flex gap-1 mb-2">
                <Button size="icon" variant="outline" className="size-8" onClick={() => zoomIn()}>
                  <ZoomIn className="size-4" />
                </Button>
                <Button size="icon" variant="outline" className="size-8" onClick={() => zoomOut()}>
                  <ZoomOut className="size-4" />
                </Button>
                <Button size="icon" variant="outline" className="size-8" onClick={() => resetTransform()}>
                  <RotateCcw className="size-3.5" />
                </Button>
              </div>

              <div className="rounded-xl overflow-hidden border bg-muted/20">
                <TransformComponent
                  wrapperClass="!w-full !h-auto cursor-grab"
                  contentClass="!w-full"
                >
                  <div className="relative w-full select-none">
                    {mapaImagen ? (
                      <img src={mapaImagen} alt="Mapa de la biblioteca" className="w-full" style={{ pointerEvents: "none" }} />
                    ) : (
                      <div
                        className="w-full bg-muted/10 rounded"
                        style={{
                          background: `
                            linear-gradient(90deg, oklch(0.97 0 0) 1px, transparent 1px),
                            linear-gradient(     oklch(0.97 0 0) 1px, transparent 1px)
                          `,
                          backgroundSize: "4% 4%",
                          aspectRatio: "4/3",
                        }}
                      />
                    )}
                    {secciones.map((s) => (
                      <button
                        key={s.id}
                        onMouseDown={(e) => { dragStart.current = { x: e.clientX, y: e.clientY } }}
                        onClick={(e) => {
                          if (dragStart.current) {
                            const dx = Math.abs(e.clientX - dragStart.current.x)
                            const dy = Math.abs(e.clientY - dragStart.current.y)
                            dragStart.current = null
                            if (dx > 4 || dy > 4) return
                          }
                          setSeleccionada(s)
                        }}
                        className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-0.5 group"
                        style={{
                          left: `${s.x}%`,
                          top: `${s.y}%`,
                        }}
                      >
                        <span className="text-lg leading-none transition-transform group-hover:scale-125 group-hover:drop-shadow-md">
                          {s.icono || "📍"}
                        </span>
                        <span className="text-[9px] font-medium leading-tight text-center text-muted-foreground bg-background/80 rounded px-1 py-px max-w-[80px] truncate">
                          {s.nombre}
                        </span>
                      </button>
                    ))}
                  </div>
                </TransformComponent>
              </div>
            </>
          )}
        </TransformWrapper>
      )}

      <Dialog open={!!seleccionada} onOpenChange={(o) => { if (!o) setSeleccionada(null) }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <span className="text-xl">{seleccionada?.icono}</span>
              <DialogTitle>{seleccionada?.nombre}</DialogTitle>
            </div>
            <DialogDescription>{seleccionada?.descripcion}</DialogDescription>
          </DialogHeader>
          {seleccionada && (() => {
            const cat = categorias.find(c => c.nombre === seleccionada.categoria)
            if (!cat) return null
            return (
              <div className="flex items-center gap-2">
                <span className={`size-2.5 rounded-full ${cat.color}`} />
                <span className="text-xs text-muted-foreground">{cat.descripcion || cat.nombre}</span>
              </div>
            )
          })()}
        </DialogContent>
      </Dialog>
    </div>
  )
}
