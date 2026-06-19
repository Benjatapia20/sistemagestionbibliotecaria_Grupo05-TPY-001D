import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { getUploadUrl } from "@/lib/api-config"
import { BookOpen } from "lucide-react"
import { api, type LibroConAutor } from "@/lib/api"
import { Skeleton } from "@/components/ui/skeleton"
import { useAuth } from "@/contexts/AuthContext"

const UPLOAD_SERVER = getUploadUrl()

function Seccion({ titulo, libros, verMas, navigate }: { titulo: string; libros: LibroConAutor[]; verMas?: string; navigate: (url: string) => void }) {
  if (libros.length === 0) return null

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">{titulo}</h2>
        {verMas && (
          <button
            onClick={() => navigate(verMas)}
            className="text-sm text-muted-foreground hover:text-primary transition-colors"
          >
            Ver más →
          </button>
        )}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-5">
        {libros.slice(0, 6).map(libro => {
          const caratulaUrl = libro.caratula
            ? libro.caratula.startsWith("http")
              ? libro.caratula
              : `${UPLOAD_SERVER}${libro.caratula}`
            : null

          return (
            <div
              key={libro.id}
              onClick={() => navigate(`/libro/${libro.id}`)}
              className="group flex flex-col cursor-pointer"
            >
              <div className="relative aspect-[2/3] rounded-lg overflow-hidden bg-muted shadow-sm group-hover:shadow-md transition-shadow">
                {caratulaUrl ? (
                  <img src={caratulaUrl} alt={libro.titulo} className="h-full w-full object-cover" />
                ) : (
                  <div className="h-full w-full flex flex-col items-center justify-center gap-2 p-4">
                    <BookOpen className="size-8 text-muted-foreground/30" />
                    <p className="text-xs text-center text-muted-foreground/50 font-medium line-clamp-4">{libro.titulo}</p>
                  </div>
                )}
              </div>
              <div className="mt-2">
                <h3 className="text-sm font-medium leading-snug line-clamp-2 group-hover:text-primary transition-colors">
                  {libro.titulo}
                </h3>
                <p className="text-xs text-muted-foreground/80 line-clamp-1 mt-0.5">{libro.autor.nombre}</p>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function Inicio() {
  const { usuario } = useAuth()
  const navigate = useNavigate()
  const [libros, setLibros] = useState<LibroConAutor[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.getLibros().then(data => { setLibros(data); setLoading(false) })
  }, [])

  const disponibles = libros.filter(l => l.disponible)
  const populares = [...disponibles].sort((a, b) => b.stock - a.stock)
  const recientes = [...disponibles].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
  const ficcion = disponibles.filter(l => l.generos.some(g => g.genero.nombre === "Ficción"))
  const novela = disponibles.filter(l => l.generos.some(g => g.genero.nombre === "Novela"))
  const cienciaFiccion = disponibles.filter(l => l.generos.some(g => g.genero.nombre === "Ciencia Ficción"))
  const distopia = disponibles.filter(l => l.generos.some(g => g.genero.nombre === "Distopía"))
  const historia = disponibles.filter(l => l.generos.some(g => g.genero.nombre === "Historia"))

  return (
    <div>
      <div className="mb-10">
        <h1 className="text-2xl font-semibold">
          {usuario?.primer_nombre
            ? `¡Hola, ${usuario.primer_nombre}!`
            : "Bienvenido a la Biblioteca"}
        </h1>
        <p className="text-muted-foreground mt-2">
          Explora nuestro catálogo de {disponibles.length} libros disponibles.
        </p>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-5">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="flex flex-col gap-2">
              <Skeleton className="aspect-[2/3] rounded-lg" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-col gap-10">
          <Seccion titulo="Más populares" libros={populares} navigate={navigate} />
          <Seccion titulo="Nuevas llegadas" libros={recientes} navigate={navigate} />
          <Seccion titulo="Ficción" libros={ficcion} verMas="/catalogo?genero=Ficci%C3%B3n" navigate={navigate} />
          <Seccion titulo="Novela" libros={novela} verMas="/catalogo?genero=Novela" navigate={navigate} />
          <Seccion titulo="Ciencia Ficción" libros={cienciaFiccion} verMas="/catalogo?genero=Ciencia+Ficci%C3%B3n" navigate={navigate} />
          <Seccion titulo="Distopía" libros={distopia} verMas="/catalogo?genero=Distop%C3%ADa" navigate={navigate} />
          <Seccion titulo="Historia" libros={historia} verMas="/catalogo?genero=Historia" navigate={navigate} />
        </div>
      )}
    </div>
  )
}
