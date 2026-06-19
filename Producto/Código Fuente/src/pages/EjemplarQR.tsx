import { useState, useEffect } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { getUploadUrl } from "@/lib/api-config"
import { toast } from "sonner"
import { BookOpen, Loader2, ArrowLeft } from "lucide-react"
import { api } from "@/lib/api"
import { useAuth } from "@/contexts/AuthContext"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

const UPLOAD_SERVER = getUploadUrl()

export default function EjemplarQR() {
  const { codigo } = useParams<{ codigo: string }>()
  const { usuario } = useAuth()
  const navigate = useNavigate()
  const [ejemplar, setEjemplar] = useState<Awaited<ReturnType<typeof api.getEjemplarByCodigo>>>(null)
  const [estadoPrestamo, setEstadoPrestamo] = useState<"disponible" | "prestado_propio" | "prestado_otro" | "cargando">("cargando")
  const [prestando, setPrestando] = useState(false)

  useEffect(() => {
    if (!codigo) return
    api.getEjemplarByCodigo(codigo).then(ej => {
      if (!ej) { toast.error("Ejemplar no encontrado"); navigate("/inicio"); return }
      setEjemplar(ej)
      api.getPrestamoByEjemplar(ej.id).then((prestamo) => {
        if (!prestamo) setEstadoPrestamo("disponible")
        else if (prestamo.usuario_id === usuario?.id) setEstadoPrestamo("prestado_propio")
        else setEstadoPrestamo("prestado_otro")
      }).catch(() => setEstadoPrestamo("disponible"))
    })
  }, [codigo, usuario?.id, navigate])

  const handlePrestamo = async () => {
    if (!usuario || !ejemplar) return
    setPrestando(true)
    try {
      await api.createPrestamo(usuario.id, ejemplar.libro_id)
      toast.success("Préstamo registrado")
      setEstadoPrestamo("prestado_propio")
    } catch (err) { toast.error(err instanceof Error ? err.message : "Error") }
    finally { setPrestando(false) }
  }

  if (!ejemplar) return <div className="flex items-center justify-center py-20"><Loader2 className="size-8 animate-spin text-muted-foreground" /></div>

  const libro = ejemplar.libro
  const caratulaUrl = libro.caratula
    ? libro.caratula.startsWith("http") ? libro.caratula : `${UPLOAD_SERVER}${libro.caratula}`
    : null

  return (
    <div className="mx-auto max-w-lg py-8">
      <button onClick={() => navigate(-1)} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-6">
        <ArrowLeft className="size-4" />Volver
      </button>

      <div className="flex gap-6 mb-8">
        <div className="w-28 shrink-0">
          <div className="aspect-[2/3] rounded-lg overflow-hidden bg-muted shadow-sm">
            {caratulaUrl ? (
              <img src={caratulaUrl} alt={libro.titulo} className="h-full w-full object-cover" />
            ) : (
              <div className="h-full w-full flex items-center justify-center"><BookOpen className="size-6 text-muted-foreground/30" /></div>
            )}
          </div>
        </div>
        <div>
          <h1 className="text-xl font-bold">{libro.titulo}</h1>
          <p className="text-sm text-muted-foreground mt-1">{libro.autor.nombre}</p>
          <div className="mt-3 space-y-1 text-sm text-muted-foreground">
            <p><strong className="text-foreground">Código:</strong> {ejemplar.codigo}</p>
            <p><strong className="text-foreground">Estado:</strong> <Badge variant="secondary">{ejemplar.estado}</Badge></p>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        {estadoPrestamo === "disponible" && (
          <Button onClick={handlePrestamo} disabled={prestando} className="w-full" size="lg">
            {prestando && <Loader2 className="animate-spin" data-icon="inline-start" />}
            Solicitar préstamo
          </Button>
        )}
        {estadoPrestamo === "prestado_propio" && (
          <p className="text-center text-sm text-muted-foreground py-4">Este ejemplar está prestado a ti.</p>
        )}
        {estadoPrestamo === "prestado_otro" && (
          <p className="text-center text-sm text-muted-foreground py-4">Este ejemplar está prestado a otro usuario.</p>
        )}
      </div>
    </div>
  )
}
