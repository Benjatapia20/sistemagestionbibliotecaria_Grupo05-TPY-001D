import { useState, useEffect, type MouseEvent } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import { getUploadUrl } from "@/lib/api-config"
import { BookOpen, EllipsisVertical, Heart, BookMarked, List, Check, ShoppingCart, X, BookCheck } from "lucide-react"
import { toast } from "sonner"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
  DropdownMenuPortal,
} from "@/components/ui/dropdown-menu"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from "@/components/ui/empty"
import { Skeleton } from "@/components/ui/skeleton"
import { api, type LibroConAutor, type Lista } from "@/lib/api"
import { useAuth } from "@/contexts/AuthContext"
import { useCart } from "@/contexts/CartContext"

const UPLOAD_SERVER = getUploadUrl()

export default function Catalogo() {
  const { usuario } = useAuth()
  const { addToCart, getQuantity } = useCart()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [libros, setLibros] = useState<LibroConAutor[]>([])
  const [busqueda, setBusqueda] = useState(searchParams.get("busqueda") ?? "")
  const [listas, setListas] = useState<Lista[]>([])
  const [libroEnLista, setLibroEnLista] = useState<Map<number, Set<number>>>(new Map())
  const [loading, setLoading] = useState(true)
  const [orden, setOrden] = useState("")
  const [generoFiltro, setGeneroFiltro] = useState(searchParams.get("genero") ?? "")
  const [autorFiltro, setAutorFiltro] = useState(searchParams.get("autor") ?? "")

  useEffect(() => {
    api.getLibros().then((data) => { setLibros(data); setLoading(false) })
  }, [])

  useEffect(() => {
    console.log("Catalogo: usuario?.id =", usuario?.id)
    if (usuario?.id) {
      api.getListas(usuario.id).then((lsts) => {
        console.log("getListas ok:", lsts.length, lsts.map(l => l.nombre))
        setListas(lsts)
        const map = new Map<number, Set<number>>()
        for (const lista of lsts) {
          for (const libro of lista.libros ?? []) {
            const set = map.get(lista.id) ?? new Set()
            set.add(libro.id)
            map.set(lista.id, set)
          }
        }
        setLibroEnLista(map)
      }).catch(err => {
        console.error("getListas error:", err)
        toast.error("Error al cargar listas: " + (err.message || "Error de red"))
      })
    }
  }, [usuario?.id])

  const handleToggleLista = async (e: MouseEvent, listaId: number, libroId: number) => {
    e.stopPropagation()
    if (!usuario) return toast.error("Inicia sesión para usar listas")
    const set = libroEnLista.get(listaId)
    const enLista = set?.has(libroId)
    const lista = listas.find(l => l.id === listaId)
    try {
      if (enLista) {
        await api.removeLibroFromLista(listaId, libroId)
        setLibroEnLista(prev => {
          const next = new Map(prev)
          const s = new Set(next.get(listaId))
          s.delete(libroId)
          next.set(listaId, s)
          return next
        })
        toast.success(`Quitado de ${lista?.nombre ?? "lista"}`)
      } else {
        await api.addLibroToLista(listaId, libroId)
        setLibroEnLista(prev => {
          const next = new Map(prev)
          const s = new Set(next.get(listaId))
          s.add(libroId)
          next.set(listaId, s)
          return next
        })
        toast.success(`Agregado a ${lista?.nombre ?? "lista"}`)
      }
    } catch (err) { toast.error(err instanceof Error ? err.message : "Error") }
  }

  const librosFiltrados = libros.filter(
    (libro) =>
      libro.titulo.toLowerCase().includes(busqueda.toLowerCase()) ||
      libro.autor.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
      libro.generos.some((g) => g.genero.nombre.toLowerCase().includes(busqueda.toLowerCase())) ||
      libro.etiquetas.some((e) => e.etiqueta.nombre.toLowerCase().includes(busqueda.toLowerCase()))
  )
  .filter(libro => !generoFiltro || libro.generos.some(g => g.genero.nombre === generoFiltro))
  .filter(libro => !autorFiltro || libro.autor.nombre === autorFiltro)
  .sort((a, b) => {
    if (orden === "titulo-asc") return a.titulo.localeCompare(b.titulo)
    if (orden === "titulo-desc") return b.titulo.localeCompare(a.titulo)
    if (orden === "anio-asc") return (a.anio_publicacion ?? 0) - (b.anio_publicacion ?? 0)
    if (orden === "anio-desc") return (b.anio_publicacion ?? 0) - (a.anio_publicacion ?? 0)
    if (orden === "stock-desc") return b.stock - a.stock
    return 0
  })

  const librosGrid = librosFiltrados.filter(l => l.disponible || busqueda.trim())

  const generos = [...new Set(libros.flatMap(l => l.generos.map(g => g.genero.nombre)))].sort()
  const autores = [...new Set(libros.map(l => l.autor.nombre))].sort()

  const filtrosActivos = orden || generoFiltro || autorFiltro || false

  const favId = listas.find(l => l.nombre === "Favoritos")?.id

  return (
    <div className="max-w-screen-2xl mx-auto">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-6 sm:mb-8">
        <h1 className="text-xl sm:text-2xl font-semibold">Catálogo</h1>
        <Input
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar por título, autor o género..."
          className="w-full sm:max-w-xs"
        />
      </div>

      <div className="flex items-center gap-2 sm:gap-3 mb-4 sm:mb-6 flex-wrap">
        <Select value={orden} onValueChange={setOrden}>
          <SelectTrigger className="flex-1 sm:flex-none sm:w-[180px] h-9 text-xs sm:text-sm">
            <SelectValue placeholder="Ordenar por" />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectItem value="titulo-asc">Título A-Z</SelectItem>
              <SelectItem value="titulo-desc">Título Z-A</SelectItem>
              <SelectItem value="anio-desc">Más reciente</SelectItem>
              <SelectItem value="anio-asc">Más antiguo</SelectItem>
              <SelectItem value="stock-desc">Mayor stock</SelectItem>
            </SelectGroup>
          </SelectContent>
        </Select>
        <Select value={generoFiltro} onValueChange={setGeneroFiltro}>
          <SelectTrigger className="flex-1 sm:flex-none sm:w-[160px] h-9 text-xs sm:text-sm">
            <SelectValue placeholder="Género" />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {generos.map(g => (
                <SelectItem key={g} value={g}>{g}</SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
        <Select value={autorFiltro} onValueChange={setAutorFiltro}>
          <SelectTrigger className="flex-1 sm:flex-none sm:w-[200px] h-9 text-xs sm:text-sm">
            <SelectValue placeholder="Autor" />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {autores.map(a => (
                <SelectItem key={a} value={a}>{a}</SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
        {filtrosActivos && (
          <Button variant="ghost" size="sm" onClick={() => { setOrden(""); setGeneroFiltro(""); setAutorFiltro("") }}>
            <X />
            <span className="hidden sm:inline">Limpiar filtros</span>
          </Button>
        )}
      </div>

      {loading ? (
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-5">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="flex flex-col gap-2">
              <Skeleton className="aspect-[2/3] rounded-lg" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          ))}
        </div>
      ) : (
      <>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-5">
        {librosGrid.map((libro) => {
          const caratulaUrl = libro.caratula
            ? libro.caratula.startsWith("http")
              ? libro.caratula
              : `${UPLOAD_SERVER}${libro.caratula}`
            : null

          return (
            <div key={libro.id} className="group flex flex-col cursor-pointer" onClick={() => navigate(`/libro/${libro.id}`)}>
              <div className="relative aspect-[2/3] rounded-lg overflow-hidden bg-muted shadow-sm group-hover:shadow-md transition-shadow">
                {caratulaUrl ? (
                  <img src={caratulaUrl} alt={libro.titulo} className="h-full w-full object-cover" />
                ) : (
                  <div className="h-full w-full flex flex-col items-center justify-center gap-2 p-4 bg-muted">
                    <BookOpen className="size-8 text-muted-foreground/30" />
                    <p className="text-xs text-center text-muted-foreground/50 font-medium leading-tight line-clamp-4">{libro.titulo}</p>
                  </div>
                )}
                {usuario && favId && libroEnLista.get(favId)?.has(libro.id) && (
                  <Heart className="absolute top-1.5 left-1.5 size-4 sm:size-5 fill-red-500 text-red-500 drop-shadow-sm" />
                )}
              </div>
              <div className="mt-1.5 sm:mt-2 flex items-start gap-1">
                <div className="flex-1 min-w-0">
                  <h3 className="text-xs sm:text-sm font-medium leading-snug line-clamp-2 group-hover:text-primary transition-colors">
                    {libro.titulo}
                  </h3>
                  <p className="text-[11px] sm:text-xs text-muted-foreground/80 leading-snug line-clamp-1 mt-0.5">
                    {libro.autor.nombre}
                    {!libro.disponible && " · No disponible"}
                  </p>
                </div>
                {usuario && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        className="shrink-0 size-7 -mr-2.5 rounded-md flex items-center justify-center hover:bg-muted transition-colors"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <EllipsisVertical className="size-4 text-muted-foreground" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent side="bottom" className="w-52">
                      {(() => {
                        const fav = listas.find(l => l.nombre === "Favoritos")
                        const porLeer = listas.find(l => l.nombre === "Por leer")
                        const otras = listas.filter(l => l.nombre !== "Favoritos" && l.nombre !== "Por leer")
                        const enFav = fav ? libroEnLista.get(fav.id)?.has(libro.id) : false
                        const enPorLeer = porLeer ? libroEnLista.get(porLeer.id)?.has(libro.id) : false

                        return (
                          <>
                            <DropdownMenuItem
                              disabled={!libro.disponible}
                              onClick={(e) => { e.stopPropagation(); if (!addToCart(libro.id)) toast.warning("Máximo 5 ejemplares en el carrito") }}
                            >
                              <ShoppingCart className={getQuantity(libro.id) > 0 ? "text-primary" : ""} />
                              <span className="flex-1">{!libro.disponible ? "No disponible" : getQuantity(libro.id) > 0 ? `En carrito (${getQuantity(libro.id)})` : "Agregar al carrito"}</span>
                              {getQuantity(libro.id) > 0 && <Check className="text-primary" />}
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            {fav && (
                              <DropdownMenuItem onClick={(e) => handleToggleLista(e, fav.id, libro.id)}>
                                <Heart className={enFav ? "fill-red-500 text-red-500" : ""} />
                                <span className="flex-1">{enFav ? "Quitar de Favoritos" : "Agregar a Favoritos"}</span>
                                {enFav && <Check className="text-primary" />}
                              </DropdownMenuItem>
                            )}
                            {porLeer && (
                              <DropdownMenuItem onClick={(e) => handleToggleLista(e, porLeer.id, libro.id)}>
                                <BookMarked className={enPorLeer ? "text-primary" : ""} />
                                <span className="flex-1">{enPorLeer ? "Quitar de Por leer" : "Agregar a Por leer"}</span>
                                {enPorLeer && <Check className="text-primary" />}
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={async (e) => {
                              e.stopPropagation()
                              if (!usuario) return
                              try {
                                await api.marcarComoLeido(usuario.id, libro.id)
                                toast.success("Marcado como leído")
                              } catch (err) { toast.error(err instanceof Error ? err.message : "Error") }
                            }}>
                              <BookCheck />
                              <span className="flex-1">Marcar como leído</span>
                            </DropdownMenuItem>
                            {otras.length > 0 && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuSub>
                                  <DropdownMenuSubTrigger>
                                    <List />
                                    <span>Agregar a lista...</span>
                                  </DropdownMenuSubTrigger>
                                  <DropdownMenuPortal>
                                    <DropdownMenuSubContent className="w-44 max-h-56 overflow-y-auto">
                                      {otras.map(lista => {
                                        const enLista = libroEnLista.get(lista.id)?.has(libro.id)
                                        return (
                                          <DropdownMenuItem key={lista.id} onClick={(e) => handleToggleLista(e, lista.id, libro.id)}>
                                            {enLista ? <Check /> : <span className="w-4" />}
                                            <span className="flex-1">{lista.nombre}</span>
                                          </DropdownMenuItem>
                                        )
                                      })}
                                    </DropdownMenuSubContent>
                                  </DropdownMenuPortal>
                                </DropdownMenuSub>
                              </>
                            )}
                            {listas.length === 0 && (
                              <p className="text-xs text-muted-foreground text-center px-2 py-3">No tienes listas. Créalas en tu perfil.</p>
                            )}
                          </>
                        )
                      })()}
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {librosGrid.length === 0 && (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon"><BookOpen /></EmptyMedia>
            <EmptyTitle>{busqueda ? "Sin resultados" : "No hay libros"}</EmptyTitle>
            <EmptyDescription>
              {busqueda ? "Intenta con otros términos de búsqueda." : "El catálogo está vacío."}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      )}
      </>
      )}
    </div>
  )
}
