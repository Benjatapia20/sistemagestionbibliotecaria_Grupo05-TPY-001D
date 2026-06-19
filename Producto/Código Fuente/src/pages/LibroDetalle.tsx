import { useState, useEffect } from "react"
import { useParams, useNavigate, useLocation, Link } from "react-router-dom"
import { getUploadUrl } from "@/lib/api-config"
import { uploadResenaFoto } from "@/lib/upload"
import { toast } from "sonner"
import { BookOpen, Star, ArrowLeft, Loader2, ShoppingCart, Minus, Plus, Heart, BookMarked, List, Check, BookmarkPlus, X, User, BookCheck, Pencil, Trash2, Camera } from "lucide-react"
import { api, type LibroConAutor, type Resena, type Lista } from "@/lib/api"
import { useAuth } from "@/contexts/AuthContext"
import { useCart } from "@/contexts/CartContext"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
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

const UPLOAD_SERVER = getUploadUrl()

function Estrellas({ puntuacion, onChange }: { puntuacion: number; onChange?: (v: number) => void }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          disabled={!onChange}
          onClick={() => onChange?.(n)}
          className={onChange ? "cursor-pointer hover:scale-110 transition-transform" : ""}
        >
          <Star className={`size-5 ${n <= puntuacion ? "fill-amber-500 text-amber-500" : "text-muted-foreground/30"}`} />
        </button>
      ))}
    </div>
  )
}

export default function LibroDetalle() {
  const { id } = useParams<{ id: string }>()
  const { usuario } = useAuth()
  const { addToCart, getQuantity } = useCart()
  const navigate = useNavigate()
  const location = useLocation()
  const [libro, setLibro] = useState<LibroConAutor | null>(null)
  const [resenas, setResenas] = useState<Resena[]>([])
  const [comentario, setComentario] = useState("")
  const [puntuacion, setPuntuacion] = useState(0)
  const [loading, setLoading] = useState(false)
  const [cantidadPedir, setCantidadPedir] = useState(1)
  const [listas, setListas] = useState<Lista[]>([])
  const [libroEnLista, setLibroEnLista] = useState<Map<number, Set<number>>>(new Map())
  const [puedeResenar, setPuedeResenar] = useState(false)
  const [miResena, setMiResena] = useState<Resena | null>(null)
  const [lightboxSrc, setLightboxSrc] = useState("")
  const [leido, setLeido] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [editPunt, setEditPunt] = useState(0)
  const [editComent, setEditComent] = useState("")
  const [editFotos, setEditFotos] = useState<string[]>([])
  const [uploadingFoto, setUploadingFoto] = useState(false)

  const loadData = () => {
    if (!id) return
    const libroId = Number(id)
    api.getLibro(libroId).then(setLibro)
    api.getResenas(libroId).then(setResenas)
    if (usuario?.id) {
      api.puedeResenar(libroId, usuario.id).then(setPuedeResenar)
      api.getMiResena(libroId, usuario.id).then(setMiResena)
      api.estaLeido(usuario.id, libroId).then(setLeido)
    }
  }

  useEffect(() => { loadData() }, [id, location.key])
  useEffect(() => {
    if (usuario?.id) {
      api.getListas(usuario.id).then(lsts => {
        setListas(lsts)
        const map = new Map<number, Set<number>>()
        for (const lista of lsts) {
          for (const l of lista.libros ?? []) {
            const s = map.get(lista.id) ?? new Set()
            s.add(l.id)
            map.set(lista.id, s)
          }
        }
        setLibroEnLista(map)
      })
    }
  }, [usuario?.id])

  const handleToggleLista = async (listaId: number, libroId: number) => {
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

  const handleResena = async () => {
    if (!usuario || !libro || puntuacion === 0) return
    setLoading(true)
    try {
      await api.createResena({
        usuario_id: usuario.id,
        libro_id: libro.id,
        puntuacion,
        comentario: comentario.trim() || undefined,
      }, usuario.nombre_usuario)
      toast.success("Reseña publicada")
      setComentario("")
      setPuntuacion(0)
      loadData()
    } catch (err) { toast.error(err instanceof Error ? err.message : "Error al publicar reseña") }
    finally { setLoading(false) }
  }

  if (!libro) return (
    <div className="flex items-center justify-center py-20">
      <Loader2 className="size-8 animate-spin text-muted-foreground" />
    </div>
  )

  const caratulaUrl = libro.caratula
    ? libro.caratula.startsWith("http") ? libro.caratula : `${UPLOAD_SERVER}${libro.caratula}`
    : null

  const promedio = resenas.length > 0
    ? (resenas.reduce((s, r) => s + r.puntuacion, 0) / resenas.length).toFixed(1)
    : null

  return (
    <div className="mx-auto max-w-4xl">
      <button onClick={() => navigate(-1)} className="inline-flex items-center justify-center size-9 rounded-md hover:bg-muted transition-colors mb-6">
        <ArrowLeft className="size-5" />
      </button>

      <div className="flex flex-col md:flex-row gap-6 sm:gap-8 mb-8 sm:mb-12">
        <div className="w-40 sm:w-48 md:w-56 shrink-0 mx-auto md:mx-0">
          <div className="aspect-[2/3] rounded-xl overflow-hidden bg-muted shadow-md">
            {caratulaUrl ? (
              <img src={caratulaUrl} alt={libro.titulo} className="h-full w-full object-cover" />
            ) : (
              <div className="h-full w-full flex flex-col items-center justify-center gap-2 p-4 sm:p-6 bg-muted">
                <BookOpen className="size-8 sm:size-12 text-muted-foreground/20" />
                <p className="text-xs sm:text-sm text-center text-muted-foreground/40 line-clamp-4">{libro.titulo}</p>
              </div>
            )}
          </div>
        </div>

        <div className="flex-1">
          <h1 className="text-xl sm:text-2xl font-bold mb-1">{libro.titulo}</h1>
          <p className="text-base sm:text-lg text-muted-foreground mb-4">por {libro.autor.nombre}</p>

          {promedio && (
            <div className="flex items-center gap-2 mb-4">
              <Star className="size-5 fill-amber-500 text-amber-500" />
              <span className="font-medium">{promedio}</span>
              <span className="text-muted-foreground">({resenas.length} reseñas)</span>
            </div>
          )}

          {libro.sinopsis && (
            <p className="text-sm text-muted-foreground mb-6 leading-relaxed">{libro.sinopsis}</p>
          )}

          <div className="flex flex-col gap-3 mb-4">
            <div className="flex flex-wrap gap-1.5">
              {libro.generos.map(g => <Badge key={g.genero.id} className="text-xs px-2 py-0.5">{g.genero.nombre}</Badge>)}
            </div>
            <div className="flex flex-wrap gap-1">
              {libro.etiquetas.map(e => <Badge key={e.etiqueta.id} variant="secondary" className="text-[10px] px-1.5 py-0">{e.etiqueta.nombre}</Badge>)}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-1.5 text-xs sm:text-sm text-muted-foreground mb-4 sm:mb-6">
            {libro.isbn && <p><strong className="text-foreground">ISBN:</strong> {libro.isbn}</p>}
            {libro.editorial && <p><strong className="text-foreground">Editorial:</strong> {libro.editorial.nombre}</p>}
            <p><strong className="text-foreground">Año:</strong> {libro.anio_publicacion ?? "—"}</p>
            {libro.numero_paginas && <p><strong className="text-foreground">Páginas:</strong> {libro.numero_paginas}</p>}
            {libro.idioma && <p><strong className="text-foreground">Idioma:</strong> {libro.idioma}</p>}
          </div>

          <div className="flex flex-wrap items-center gap-2 sm:gap-4">
            <div className="flex items-center gap-2">
              <BookOpen className="size-4 sm:size-5 text-muted-foreground" />
              {libro.disponible ? (
                <span className="text-xs sm:text-sm">
                  <span className="font-semibold text-emerald-600">{libro.stock}</span>
                  <span className="text-muted-foreground"> disponibles</span>
                </span>
              ) : (
                <Badge variant="destructive" className="text-xs">No disponible</Badge>
              )}
            </div>
            {usuario && libro.disponible && (
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="flex items-center gap-1">
                  <Button size="icon-xs" variant="ghost" onClick={() => setCantidadPedir(c => Math.max(1, c - 1))}>
                    <Minus className="size-3" />
                  </Button>
                  <span className="text-sm font-medium w-6 text-center">{cantidadPedir}</span>
                  <Button size="icon-xs" variant="ghost" onClick={() => setCantidadPedir(c => Math.min(5, libro.stock, c + 1))}>
                    <Plus className="size-3" />
                  </Button>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (getQuantity(libro.id) > 0) {
                      addToCart(libro.id, cantidadPedir)
                    } else {
                      if (!addToCart(libro.id, cantidadPedir)) toast.warning("Máximo 5 ejemplares en el carrito")
                    }
                  }}
                >
                  <ShoppingCart data-icon="inline-start" />
                  {getQuantity(libro.id) > 0 ? `En carrito (${getQuantity(libro.id)})` : "Agregar al carrito"}
                </Button>
              </div>
            )}
            {usuario && !libro.disponible && (
              <Button variant="outline" size="sm" disabled>
                <ShoppingCart data-icon="inline-start" />
                No disponible
              </Button>
            )}
            {usuario && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
                    <BookmarkPlus />
                    Listas
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent side="bottom" className="w-48">
                  {(() => {
                    const fav = listas.find(l => l.nombre === "Favoritos")
                    const porLeer = listas.find(l => l.nombre === "Por leer")
                    const otras = listas.filter(l => l.nombre !== "Favoritos" && l.nombre !== "Por leer")
                    const enFav = fav ? libroEnLista.get(fav.id)?.has(libro.id) : false
                    const enPorLeer = porLeer ? libroEnLista.get(porLeer.id)?.has(libro.id) : false
                    return (
                      <>
                        {fav && (
                          <DropdownMenuItem onClick={() => handleToggleLista(fav.id, libro.id)}>
                            <Heart className={enFav ? "fill-red-500 text-red-500" : ""} />
                            <span className="flex-1">{enFav ? "Quitar de Favoritos" : "Agregar a Favoritos"}</span>
                            {enFav && <Check />}
                          </DropdownMenuItem>
                        )}
                        {porLeer && (
                          <DropdownMenuItem onClick={() => handleToggleLista(porLeer.id, libro.id)}>
                            <BookMarked className={enPorLeer ? "text-primary" : ""} />
                            <span className="flex-1">{enPorLeer ? "Quitar de Por leer" : "Agregar a Por leer"}</span>
                            {enPorLeer && <Check />}
                          </DropdownMenuItem>
                        )}
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
                                      <DropdownMenuItem key={lista.id} onClick={() => handleToggleLista(lista.id, libro.id)}>
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
            {usuario && (
              <Button
                variant={leido ? "default" : "outline"}
                size="sm"
                onClick={async () => {
                  if (!libro) return
                  try {
                    if (leido) {
                      await api.desmarcarComoLeido(usuario.id, libro.id)
                      setLeido(false)
                      toast.success("Desmarcado como leído")
                    } else {
                      await api.marcarComoLeido(usuario.id, libro.id)
                      setLeido(true)
                      toast.success("Marcado como leído")
                    }
                  } catch (err) { toast.error(err instanceof Error ? err.message : "Error") }
                }}
              >
                <BookCheck data-icon="inline-start" />
                {leido ? "Leído" : "Leído"}
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="border-t pt-6 sm:pt-8">
        <h2 className="text-lg sm:text-xl font-semibold mb-4 sm:mb-6">Reseñas ({resenas.length})</h2>

        {usuario && !miResena && puedeResenar && (
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="text-base">Escribe una reseña</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="mb-3">
                <Estrellas puntuacion={puntuacion} onChange={setPuntuacion} />
              </div>
              <Textarea
                value={comentario}
                onChange={e => setComentario(e.target.value)}
                placeholder="¿Qué te pareció este libro?"
                rows={3}
                className="mb-3"
              />
              <Button onClick={handleResena} disabled={loading || puntuacion === 0}>
                {loading && <Loader2 className="animate-spin" data-icon="inline-start" />}
                Publicar
              </Button>
            </CardContent>
          </Card>
        )}

        {usuario && !miResena && !puedeResenar && (
          <Card className="mb-8">
            <CardContent className="!py-6">
              <p className="text-sm text-muted-foreground text-center">
                Solo puedes reseñar libros que hayas pedido y devuelto.
              </p>
            </CardContent>
          </Card>
        )}

        {resenas.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">No hay reseñas aún. ¡Sé el primero en opinar!</p>
        ) : (
          <div className="grid gap-4">
            {resenas.map(r => {
              const nombreCompleto = r.usuario?.primer_nombre && r.usuario?.apellido_paterno
                ? `${r.usuario.primer_nombre} ${r.usuario.apellido_paterno}`
                : null
              const avatarUrl = r.usuario?.foto_perfil
                ? r.usuario.foto_perfil.startsWith("http")
                  ? r.usuario.foto_perfil
                  : `${UPLOAD_SERVER}${r.usuario.foto_perfil}`
                : null
              return (
              <Card key={r.id} size="sm">
                <CardContent className="!p-3 sm:!p-4">
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 sm:gap-3">
                    <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                      <Avatar className="size-8 sm:size-9 shrink-0">
                        {avatarUrl && <AvatarImage src={avatarUrl} />}
                        <AvatarFallback>
                          <User className="size-4" />
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        {nombreCompleto ? (
                          r.usuario?.nombre_usuario ? (
                            <Link to={`/perfil/${r.usuario.nombre_usuario}`} className="text-sm font-medium hover:underline truncate block">
                              {nombreCompleto}
                            </Link>
                          ) : (
                            <p className="text-sm font-medium truncate">{nombreCompleto}</p>
                          )
                        ) : null}
                        <span className="text-xs text-muted-foreground">
                          {new Date(r.created_at).toLocaleDateString("es-CL")}
                        </span>
                      </div>
                    </div>
                    <div className="shrink-0 pt-0.5 flex items-center gap-1">
                      <Estrellas puntuacion={r.puntuacion} />
                      {usuario && r.usuario_id === usuario.id && (
                        <>
                          <Button size="icon-xs" variant="ghost" className="ml-1" onClick={(e) => {
                            e.preventDefault()
                            setEditPunt(r.puntuacion)
                            setEditComent(r.comentario ?? "")
                            setEditFotos(r.fotos ? (() => { try { return JSON.parse(r.fotos) } catch { return [] } })() : [])
                            setEditOpen(true)
                          }}>
                            <Pencil className="size-3" />
                          </Button>
                          <Button size="icon-xs" variant="ghost" onClick={async (e) => {
                            e.preventDefault()
                            try {
                              await api.deleteResena(r.id, { usuario_id: r.usuario_id, libro_id: r.libro_id, nombre_usuario: usuario?.nombre_usuario })
                              toast.success("Reseña eliminada")
                              loadData()
                            } catch (err) { toast.error(err instanceof Error ? err.message : "Error") }
                          }}>
                            <Trash2 className="size-3 text-destructive" />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                  {r.comentario && (
                    <p className="text-sm text-muted-foreground mt-3 leading-relaxed">{r.comentario}</p>
                  )}
                  {r.fotos && (() => {
                    try {
                      const fotosParsed = JSON.parse(r.fotos) as string[]
                      if (fotosParsed.length > 0) return (
                        <div className="flex gap-1.5 mt-3 flex-wrap">
                          {fotosParsed.map((url, i) => {
                            const fullUrl = url.startsWith("http") ? url : `${UPLOAD_SERVER}${url}`
                            return (
                            <img
                              key={i}
                              src={fullUrl}
                              alt=""
                              className="size-16 sm:size-14 object-cover rounded-md border cursor-pointer hover:opacity-80 transition-opacity"
                              onClick={() => setLightboxSrc(fullUrl)}
                            />
                          )})}
                        </div>
                      )
                    } catch {}
                    return null
                  })()}
                </CardContent>
              </Card>
            )})}
          </div>
        )}
      </div>

      <Dialog open={!!lightboxSrc} onOpenChange={() => setLightboxSrc("")}>
        <DialogContent className="max-w-[90vw] max-h-[90vh] p-1 bg-black/95 border-0" showCloseButton={false}>
          <button
            onClick={() => setLightboxSrc("")}
            className="absolute top-2 right-2 z-10 rounded-full bg-black/60 p-1.5 text-white hover:bg-black/80 transition-colors"
          >
            <X className="size-5" />
          </button>
          <img src={lightboxSrc} alt="" className="max-w-full max-h-[85vh] object-contain mx-auto rounded" />
        </DialogContent>
      </Dialog>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Editar reseña</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <div className="flex gap-0.5 justify-center">
              {[1, 2, 3, 4, 5].map((n) => (
                <button key={n} type="button" onClick={() => setEditPunt(n)}
                  className="cursor-pointer hover:scale-110 transition-transform">
                  <Star className={`size-7 ${n <= editPunt ? "fill-amber-500 text-amber-500" : "text-muted-foreground/30"}`} />
                </button>
              ))}
            </div>
            <Textarea value={editComent} onChange={e => setEditComent(e.target.value)} placeholder="¿Qué te pareció este libro?" rows={4} />
            {editFotos.length > 0 && (
              <div className="flex gap-2 flex-wrap">
                {editFotos.map((url, i) => (
                  <div key={i} className="relative group">
                    <img src={url.startsWith("http") ? url : `${UPLOAD_SERVER}${url}`} alt="" className="size-16 object-cover rounded-md border" />
                    <button className="absolute -top-1.5 -right-1.5 size-4 rounded-full bg-destructive text-white flex items-center justify-center opacity-0 group-hover:opacity-100"
                      onClick={() => setEditFotos(prev => prev.filter((_, j) => j !== i))}>
                      <X className="size-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <label className="cursor-pointer inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground border rounded-md px-3 py-2 w-fit">
              <input type="file" accept="image/*" className="hidden" disabled={uploadingFoto} onChange={async (e) => {
                const file = e.target.files?.[0]
                if (!file || !usuario) return
                setUploadingFoto(true)
                try {
                  const url = await uploadResenaFoto(file, usuario.id)
                  setEditFotos(prev => [...prev, url])
                } catch { toast.error("Error al subir foto") }
                finally { setUploadingFoto(false) }
                e.target.value = ""
              }} />
              <Camera data-icon="inline-start" className="size-3.5" />
              {uploadingFoto ? "Subiendo..." : "Agregar foto"}
            </label>
            <Button onClick={async () => {
              if (!usuario || !miResena || editPunt === 0 || uploadingFoto) return
              try {
                await api.updateResena(miResena.id, {
                  puntuacion: editPunt,
                  comentario: editComent.trim() || undefined,
                  fotos: editFotos.length > 0 ? JSON.stringify(editFotos) : "",
                }, { usuario_id: miResena.usuario_id, libro_id: miResena.libro_id, nombre_usuario: usuario.nombre_usuario })
                toast.success("Reseña actualizada")
                setEditOpen(false)
                loadData()
              } catch (err) { toast.error(err instanceof Error ? err.message : "Error") }
            }} disabled={editPunt === 0}>
              Guardar cambios
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
