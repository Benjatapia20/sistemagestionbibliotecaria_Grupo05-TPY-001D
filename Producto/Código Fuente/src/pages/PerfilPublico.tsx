import { useState, useEffect, useRef } from "react"
import { useParams, Link, useLocation } from "react-router-dom"
import { getUploadUrl } from "@/lib/api-config"
import { toast } from "sonner"
import { BookOpen, User, Star, List, Library, Globe, Lock, Camera, Trash2, X, Pencil, Ellipsis, Plus, Loader2, Settings } from "lucide-react"
import { api, type Usuario, type Resena, type Lista } from "@/lib/api"
import { useAuth } from "@/contexts/AuthContext"
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogMedia, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { FieldGroup, Field, FieldLabel } from "@/components/ui/field"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Separator } from "@/components/ui/separator"
import { uploadFile, uploadResenaFoto, deleteUploadedFile } from "@/lib/upload"

const UPLOAD_SERVER = getUploadUrl()

function Initials({ usuario }: { usuario: { primer_nombre?: string | null; apellido_paterno?: string | null } }) {
  const p = usuario.primer_nombre?.charAt(0) ?? ""
  const a = usuario.apellido_paterno?.charAt(0) ?? ""
  return <span>{(p + a).toUpperCase() || "?"}</span>
}

export default function PerfilPublico() {
  const { username } = useParams<{ username: string }>()
  const { usuario: currentUser, updateProfile } = useAuth()
  const location = useLocation()
  const [perfil, setPerfil] = useState<Usuario | null>(null)
  const [resenas, setResenas] = useState<Resena[]>([])
  const [listas, setListas] = useState<Lista[]>([])
  const [librosLeidos, setLibrosLeidos] = useState(0)
  const [loading, setLoading] = useState(true)
  const isOwn = currentUser?.nombre_usuario === username

  // Edit profile dialog state
  const [editOpen, setEditOpen] = useState(false)
  const [editForm, setEditForm] = useState({ primer_nombre: "", segundo_nombre: "", apellido_paterno: "", apellido_materno: "", email: "", rut: "", telefono: "", direccion: "", bio: "", foto_perfil: "" })
  const [uploading, setUploading] = useState(false)
  const originalFotoRef = useRef("")
  const newFotosRef = useRef<string[]>([])
  const originalListaImagenRef = useRef("")
  const newListaImagenRef = useRef<string[]>([])
  const [passActual, setPassActual] = useState("")
  const [passNueva, setPassNueva] = useState("")
  const [passConfirm, setPassConfirm] = useState("")
  const [passLoading, setPassLoading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // List management state
  const [listaDialog, setListaDialog] = useState(false)
  const [editingLista, setEditingLista] = useState<Lista | null>(null)
  const [listaForm, setListaForm] = useState({ nombre: "", descripcion: "", publica: true, imagen: "" })
  const [deleteListaId, setDeleteListaId] = useState<number | null>(null)
  const listaFileRef = useRef<HTMLInputElement>(null)
  const [detalleLista, setDetalleLista] = useState<Lista | null>(null)

  // Review edit state
  const [resenaEditOpen, setResenaEditOpen] = useState(false)
  const [resenaEditId, setResenaEditId] = useState<number | null>(null)
  const [resenaEditUid, setResenaEditUid] = useState("")
  const [resenaEditLid, setResenaEditLid] = useState(0)
  const [resenaEditPunt, setResenaEditPunt] = useState(0)
  const [resenaEditCom, setResenaEditCom] = useState("")
  const [resenaEditFotos, setResenaEditFotos] = useState<string[]>([])
  const [uploadingFoto, setUploadingFoto] = useState(false)

  useEffect(() => {
    if (!username) return
    setLoading(true)
    api.getUsuarioPorUsername(username).then(u => {
      if (!u) { setPerfil(null); setLoading(false); return }
      setPerfil(u)
      api.getResenasPorUsuario(u.id).then(setResenas)
      api.getListas(u.id).then(l => {
        setListas(isOwn ? l : l.filter(x => x.publica))
      })
      api.getConteoLeidos(u.id).then(setLibrosLeidos).catch(() => {})
      setLoading(false)
    })
  }, [username, isOwn, location.key])

  // Clean up unsaved uploaded photos when edit dialog closes
  useEffect(() => {
    if (!editOpen && newFotosRef.current.length > 0) {
      for (const url of newFotosRef.current) {
        if (currentUser?.id) deleteUploadedFile(url, currentUser.id).catch(() => {})
      }
      newFotosRef.current = []
    }
  }, [editOpen])

  // Clean up unsaved list images when dialog closes
  useEffect(() => {
    if (!listaDialog && newListaImagenRef.current.length > 0) {
      for (const url of newListaImagenRef.current) {
        if (currentUser?.id) deleteUploadedFile(url, currentUser.id).catch(() => {})
      }
      newListaImagenRef.current = []
    }
  }, [listaDialog])

  // Avatar handlers
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const url = await uploadFile(file, "avatar", String(currentUser?.id))
      newFotosRef.current.push(url)
      setEditForm(f => ({ ...f, foto_perfil: url }))
    } catch (err) { toast.error(err instanceof Error ? err.message : "Error al subir imagen") }
    finally { setUploading(false) }
  }

  const handleRemovePhoto = () => {
    setEditForm(f => ({ ...f, foto_perfil: "" }))
  }

  // Edit profile handlers
  const formatRut = (value: string) => {
    const raw = value.replace(/[^0-9kK]/g, "").slice(0, 9)
    if (!raw) return ""
    const dv = raw.slice(-1).toUpperCase()
    const nums = raw.slice(0, -1)
    let formatted = ""
    for (let i = nums.length - 1; i >= 0; i--) {
      formatted = nums[i] + formatted
      if ((nums.length - i) % 3 === 0 && i > 0) formatted = "." + formatted
    }
    return `${formatted}-${dv}`
  }

  const validarRut = (rut: string) => {
    if (!rut) return true
    const raw = rut.replace(/[^0-9kK]/g, "")
    if (raw.length < 2) return false
    const dv = raw.slice(-1).toUpperCase()
    const nums = raw.slice(0, -1)
    let sum = 0
    let mul = 2
    for (let i = nums.length - 1; i >= 0; i--) {
      sum += parseInt(nums[i]) * mul
      mul = mul === 7 ? 2 : mul + 1
    }
    const expected = 11 - (sum % 11)
    const expectedDv = expected === 11 ? "0" : expected === 10 ? "K" : String(expected)
    return dv === expectedDv
  }

  const rutValido = validarRut(editForm.rut)

  const openEdit = () => {
    setEditForm({
      primer_nombre: currentUser?.primer_nombre ?? "",
      segundo_nombre: currentUser?.segundo_nombre ?? "",
      apellido_paterno: currentUser?.apellido_paterno ?? "",
      apellido_materno: currentUser?.apellido_materno ?? "",
      email: currentUser?.email ?? "",
      rut: currentUser?.rut ? formatRut(currentUser.rut) : "",
      telefono: currentUser?.telefono ?? "",
      direccion: currentUser?.direccion ?? "",
      bio: currentUser?.bio ?? "",
      foto_perfil: currentUser?.foto_perfil ?? "",
    })
    originalFotoRef.current = currentUser?.foto_perfil ?? ""
    setEditOpen(true)
  }

  const handleChangePassword = async () => {
    if (!currentUser) return
    if (!passActual) { toast.error("Ingresa tu contraseña actual"); return }
    if (!passNueva || passNueva.length < 6) { toast.error("La nueva contraseña debe tener al menos 6 caracteres"); return }
    if (passNueva !== passConfirm) { toast.error("Las contraseñas no coinciden"); return }
    setPassLoading(true)
    try {
      await api.cambiarPassword(currentUser.id, passActual, passNueva)
      toast.success("Contraseña actualizada")
      setPassActual("")
      setPassNueva("")
      setPassConfirm("")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al cambiar contraseña")
    }
    setPassLoading(false)
  }

  const handleSave = async () => {
    if (editForm.rut.trim() && !validarRut(editForm.rut)) {
      toast.error("El RUT ingresado no es válido")
      return
    }
    const data: Record<string, string | null> = {}
    for (const [key, value] of Object.entries(editForm)) {
      if (key === "rut" && value) {
        data[key] = value.replace(/[^0-9kK]/g, "") || null
      } else {
        data[key] = value.trim() || null
      }
    }
    try {
      await updateProfile(data)
      // Delete old photo from storage if it was replaced or removed
      const newFoto = data.foto_perfil || ""
      if (originalFotoRef.current && originalFotoRef.current !== newFoto && currentUser?.id) {
        deleteUploadedFile(originalFotoRef.current, currentUser.id).catch(() => {})
      }
      // Delete any uploaded files that aren't the final chosen one
      for (const url of newFotosRef.current) {
        if (url !== newFoto && currentUser?.id) {
          deleteUploadedFile(url, currentUser.id).catch(() => {})
        }
      }
      newFotosRef.current = []
      toast.success("Perfil actualizado")
      setEditOpen(false)
      if (perfil) {
        setPerfil({ ...perfil, ...data } as Usuario)
      }
    } catch (err) { toast.error(err instanceof Error ? err.message : "Error al actualizar") }
  }

  // List handlers
  const openCreateLista = () => {
    setEditingLista(null)
    setListaForm({ nombre: "", descripcion: "", publica: true, imagen: "" })
    originalListaImagenRef.current = ""
    newListaImagenRef.current = []
    setListaDialog(true)
  }

  const openEditLista = (lista: Lista) => {
    setEditingLista(lista)
    setListaForm({ nombre: lista.nombre, descripcion: lista.descripcion ?? "", publica: lista.publica, imagen: lista.imagen ?? "" })
    originalListaImagenRef.current = lista.imagen ?? ""
    newListaImagenRef.current = []
    setListaDialog(true)
  }

  const handleSaveLista = async () => {
    if (!listaForm.nombre.trim() || !currentUser) return
    try {
      if (editingLista) {
        await api.updateLista(editingLista.id, {
          ...(editingLista.por_defecto ? {} : { nombre: listaForm.nombre.trim() }),
          descripcion: listaForm.descripcion.trim() || null,
          imagen: listaForm.imagen || null,
          publica: listaForm.publica,
        })
        toast.success("Lista actualizada")
      } else {
        await api.createLista({ nombre: listaForm.nombre.trim(), descripcion: listaForm.descripcion.trim() || undefined, imagen: listaForm.imagen || undefined, usuario_id: currentUser.id, publica: listaForm.publica })
        toast.success("Lista creada")
      }
      // Delete old image if replaced or removed
      const newImagen = listaForm.imagen || ""
      if (originalListaImagenRef.current && originalListaImagenRef.current !== newImagen && currentUser?.id) {
        deleteUploadedFile(originalListaImagenRef.current, currentUser.id).catch(() => {})
      }
      // Delete any uploaded images that aren't the final chosen one
      for (const url of newListaImagenRef.current) {
        if (url !== newImagen && currentUser?.id) {
          deleteUploadedFile(url, currentUser.id).catch(() => {})
        }
      }
      newListaImagenRef.current = []
      setListaDialog(false)
      api.getListas(currentUser.id).then(l => setListas(isOwn ? l : l.filter(x => x.publica)))
    } catch (err) { toast.error(err instanceof Error ? err.message : "Error") }
  }

  const handleDeleteLista = async () => {
    if (!deleteListaId || !currentUser) return
    try {
      await api.deleteLista(deleteListaId)
      toast.success("Lista eliminada")
      setDeleteListaId(null)
      api.getListas(currentUser.id).then(l => setListas(isOwn ? l : l.filter(x => x.publica)))
    } catch (err) { toast.error(err instanceof Error ? err.message : "Error") }
  }

  const handleListaImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const url = await uploadFile(file, "lista", String(currentUser?.id))
      newListaImagenRef.current.push(url)
      setListaForm(f => ({ ...f, imagen: url }))
    } catch (err) { toast.error(err instanceof Error ? err.message : "Error al subir imagen") }
  }

  const handleRemoveFromList = async (libroId: number) => {
    if (!detalleLista || !currentUser) return
    try {
      await api.removeLibroFromLista(detalleLista.id, libroId)
      setDetalleLista(prev => prev ? { ...prev, libros: (prev.libros ?? []).filter(l => l.id !== libroId) } : null)
      api.getListas(currentUser.id).then(l => setListas(isOwn ? l : l.filter(x => x.publica)))
      if (detalleLista.nombre === "Leídos") api.getConteoLeidos(currentUser.id).then(setLibrosLeidos)
      toast.success("Libro quitado")
    } catch (err) { toast.error(err instanceof Error ? err.message : "Error") }
  }

  // Review edit/delete handlers
  const handleEditResena = (r: Resena) => {
    setResenaEditId(r.id)
    setResenaEditUid(r.usuario_id)
    setResenaEditLid(r.libro_id)
    setResenaEditPunt(r.puntuacion)
    setResenaEditCom(r.comentario ?? "")
    setResenaEditFotos(r.fotos ? (() => { try { return JSON.parse(r.fotos) } catch { return [] } })() : [])
    setResenaEditOpen(true)
  }

  const handleDeleteResena = async (r: { id: number; usuario_id: string; libro_id: number }) => {
    try {
      await api.deleteResena(r.id, { usuario_id: r.usuario_id, libro_id: r.libro_id, nombre_usuario: currentUser?.nombre_usuario })
      toast.success("Reseña eliminada")
      api.getResenasPorUsuario(currentUser!.id).then(setResenas)
      api.getConteoLeidos(currentUser!.id).then(setLibrosLeidos)
    } catch (err) { toast.error(err instanceof Error ? err.message : "Error") }
  }

  const handleSaveResenaEdit = async () => {
    if (!resenaEditId || resenaEditPunt === 0) return
    try {
      await api.updateResena(resenaEditId, {
        puntuacion: resenaEditPunt,
        comentario: resenaEditCom.trim() || undefined,
        fotos: resenaEditFotos.length > 0 ? JSON.stringify(resenaEditFotos) : "",
      }, { usuario_id: resenaEditUid, libro_id: resenaEditLid, nombre_usuario: currentUser?.nombre_usuario })
      toast.success("Reseña actualizada")
      setResenaEditOpen(false)
      if (currentUser?.id) api.getResenasPorUsuario(currentUser.id).then(setResenas)
    } catch (err) { toast.error(err instanceof Error ? err.message : "Error") }
  }

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="flex flex-col items-center gap-4 mb-8">
          <Skeleton className="size-24 rounded-full" />
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-32" />
        </div>
        <Skeleton className="h-40 w-full rounded-xl mb-6" />
        <div className="grid gap-4 md:grid-cols-2">
          <Skeleton className="h-48 rounded-xl" />
          <Skeleton className="h-48 rounded-xl" />
        </div>
      </div>
    )
  }

  if (!perfil) {
    return (
      <div className="max-w-2xl mx-auto text-center py-16">
        <User className="size-16 text-muted-foreground/30 mx-auto mb-4" />
        <h2 className="text-lg font-semibold mb-1">Usuario no encontrado</h2>
        <p className="text-sm text-muted-foreground">El usuario @{username} no existe.</p>
      </div>
    )
  }

  const nombreCompleto = [perfil.primer_nombre, perfil.apellido_paterno].filter(Boolean).join(" ") || null
  const avatarUrl = perfil.foto_perfil
    ? perfil.foto_perfil.startsWith("http") ? perfil.foto_perfil : `${UPLOAD_SERVER}${perfil.foto_perfil}`
    : null

  return (
    <div className="max-w-2xl mx-auto">
      {/* === HEADER === */}
      <div className="flex flex-col items-center gap-3 mb-8">
        <Avatar className="size-24" key={perfil.foto_perfil ?? "no-foto"}>
          <AvatarImage src={avatarUrl ?? undefined} />
          <AvatarFallback className="text-2xl">
            <User className="size-10" />
          </AvatarFallback>
        </Avatar>
        <div className="text-center">
          <div className="flex items-center gap-2 justify-center">
            <h1 className="text-xl font-bold">{nombreCompleto || `@${perfil.nombre_usuario}`}</h1>
            <Badge variant={perfil.rol === "admin" || perfil.rol === "bibliotecario" ? "default" : "secondary"}>
              {perfil.rol}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">@{perfil.nombre_usuario}</p>
          <div className="flex items-center justify-center gap-4 mt-3 text-sm text-muted-foreground">
            <span className="flex items-center gap-1"><BookOpen className="size-4" />{librosLeidos} leídos</span>
            <span className="flex items-center gap-1"><List className="size-4" />{listas.length} listas</span>
            <span className="flex items-center gap-1"><Star className="size-4" />{resenas.length} reseñas</span>
          </div>
        </div>
        {perfil.bio ? (
          <p className="text-sm text-muted-foreground text-center max-w-md leading-relaxed">{perfil.bio}</p>
        ) : isOwn ? (
          <p className="text-sm text-muted-foreground/60 italic">Sin biografía</p>
        ) : null}
        {isOwn && (
          <Button variant="outline" size="sm" onClick={openEdit}>
            <Pencil data-icon="inline-start" />
            Editar perfil
          </Button>
        )}
      </div>

      {/* === TABS: RESEÑAS + LISTAS === */}
      <Tabs defaultValue="listas" className="mt-8">
        <TabsList variant="line" className="mx-auto">
          <TabsTrigger value="listas">Listas ({listas.length})</TabsTrigger>
          <TabsTrigger value="resenas">Reseñas ({resenas.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="listas">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold">Listas{isOwn ? "" : " públicas"} ({listas.length})</h2>
            {isOwn && <Button size="sm" variant="outline" onClick={openCreateLista}><Plus data-icon="inline-start" />Crear lista</Button>}
          </div>
          {listas.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No hay listas aún.</p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {listas.map(l => (
                <div key={l.id} onClick={() => setDetalleLista(l)} className="rounded-xl border overflow-hidden hover:border-primary/30 transition-colors cursor-pointer">
                  {l.imagen && (
                    <div className="aspect-[3/1] overflow-hidden bg-muted">
                      <img src={l.imagen.startsWith("http") ? l.imagen : `${UPLOAD_SERVER}${l.imagen}`} alt="" className="w-full h-full object-cover" />
                    </div>
                  )}
                  <div className="p-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-medium text-sm flex items-center gap-1.5">
                          <Library className="size-5 text-muted-foreground" />{l.nombre}
                        </h3>
                        {l.descripcion && <p className="text-xs text-muted-foreground mt-1">{l.descripcion}</p>}
                      </div>
                      <div className="flex items-center gap-1">
                        {l.publica ? <Globe className="size-4 text-muted-foreground" /> : <Lock className="size-4 text-muted-foreground" />}
                        {isOwn && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button size="icon-xs" variant="ghost" onClick={(e) => { e.stopPropagation() }}>
                                <Ellipsis className="size-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent side="bottom">
                              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); openEditLista(l) }}>
                                <Pencil />Editar
                              </DropdownMenuItem>
                              {!l.por_defecto && (
                                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setDeleteListaId(l.id) }}>
                                  <Trash2 />Eliminar
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </div>
                    </div>
                    <div className="mt-3 flex -space-x-2">
                      {(l.libros ?? []).slice(0, 4).map((libro, i) => (
                        <div key={i} className="w-8 h-12 rounded-sm overflow-hidden border-2 border-background bg-muted">
                          {libro.caratula ? (
                            <img src={libro.caratula.startsWith("http") ? libro.caratula : `${UPLOAD_SERVER}${libro.caratula}`} alt="" className="h-full w-full object-cover" />
                          ) : (
                            <div className="h-full w-full flex items-center justify-center"><BookOpen className="size-3 text-muted-foreground/30" /></div>
                          )}
                        </div>
                      ))}
                      {(l.libros ?? []).length > 4 && (
                        <div className="w-8 h-12 rounded-sm border-2 border-background bg-muted flex items-center justify-center text-xs text-muted-foreground">+{(l.libros ?? []).length - 4}</div>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">{(l.libros ?? []).length} libros</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="resenas">
          {resenas.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No hay reseñas aún.</p>
          ) : (
            <div className="grid gap-3">
              {resenas.map(r => (
                <Card key={r.id} size="sm" className="hover:bg-muted/30 transition-colors">
                  <CardContent className="!p-3">
                    <div className="flex gap-3">
                      <Link to={`/libro/${r.libro_id}`} className="w-12 h-16 shrink-0 rounded-sm overflow-hidden bg-muted">
                        {(r as any).libro?.caratula ? (
                          <img src={((r as any).libro.caratula.startsWith("http") ? (r as any).libro.caratula : `${UPLOAD_SERVER}${(r as any).libro.caratula}`)} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <div className="h-full w-full flex items-center justify-center"><BookOpen className="size-4 text-muted-foreground/30" /></div>
                        )}
                      </Link>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between">
                          <Link to={`/libro/${r.libro_id}`} className="text-sm font-medium hover:underline truncate">
                            {(r as any).libro?.titulo ?? `Libro #${r.libro_id}`}
                          </Link>
                          {isOwn && (
                            <div className="flex gap-0.5 shrink-0 ml-2">
                              <Button size="icon-xs" variant="ghost" onClick={(e) => { e.preventDefault(); handleEditResena(r) }}>
                                <Pencil className="size-3" />
                              </Button>
                              <Button size="icon-xs" variant="ghost" onClick={(e) => { e.preventDefault(); handleDeleteResena(r) }}>
                                <Trash2 className="size-3 text-destructive" />
                              </Button>
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <div className="flex gap-0.5">
                            {Array.from({ length: 5 }, (_, i) => (
                              <Star key={i} className={`size-3 ${i < r.puntuacion ? "fill-amber-500 text-amber-500" : "text-muted-foreground/30"}`} />
                            ))}
                          </div>
                          <span className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleDateString("es-CL")}</span>
                        </div>
                        {r.comentario && <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2">{r.comentario}</p>}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* === EDIT PROFILE DIALOG === */}
       <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar perfil</DialogTitle>
            <DialogDescription>Actualiza la información de tu cuenta</DialogDescription>
          </DialogHeader>
          <FieldGroup>
            <Field orientation="vertical">
              <FieldLabel>Foto de perfil</FieldLabel>
              <div className="flex items-center gap-4">
                <Avatar className="size-16 shrink-0" key={editForm.foto_perfil || "no-foto"}>
                  <AvatarImage src={editForm.foto_perfil || undefined} />
                  <AvatarFallback className="bg-primary/10 text-primary font-medium">
                    {currentUser ? <Initials usuario={currentUser} /> : ""}
                  </AvatarFallback>
                </Avatar>
                <div className="flex flex-col gap-2">
                  <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
                  <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
                    {uploading ? <Loader2 className="animate-spin" data-icon="inline-start" /> : <Camera data-icon="inline-start" />}
                    {editForm.foto_perfil ? "Cambiar foto" : "Subir foto"}
                  </Button>
                  {editForm.foto_perfil && (
                    <Button type="button" variant="ghost" size="sm" onClick={handleRemovePhoto}>
                      <Trash2 data-icon="inline-start" />Eliminar
                    </Button>
                  )}
                </div>
              </div>
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field orientation="vertical"><FieldLabel htmlFor="ep-n">Primer nombre</FieldLabel><Input id="ep-n" value={editForm.primer_nombre} onChange={e => setEditForm(f => ({ ...f, primer_nombre: e.target.value }))} /></Field>
              <Field orientation="vertical"><FieldLabel htmlFor="ep-sn">Segundo nombre</FieldLabel><Input id="ep-sn" value={editForm.segundo_nombre} onChange={e => setEditForm(f => ({ ...f, segundo_nombre: e.target.value }))} /></Field>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field orientation="vertical"><FieldLabel htmlFor="ep-ap">Apellido paterno</FieldLabel><Input id="ep-ap" value={editForm.apellido_paterno} onChange={e => setEditForm(f => ({ ...f, apellido_paterno: e.target.value }))} /></Field>
              <Field orientation="vertical"><FieldLabel htmlFor="ep-am">Apellido materno</FieldLabel><Input id="ep-am" value={editForm.apellido_materno} onChange={e => setEditForm(f => ({ ...f, apellido_materno: e.target.value }))} /></Field>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field orientation="vertical"><FieldLabel htmlFor="ep-em">Email</FieldLabel><Input id="ep-em" type="email" value={editForm.email} onChange={e => setEditForm(f => ({ ...f, email: e.target.value }))} /></Field>
               <Field orientation="vertical" data-invalid={editForm.rut.trim() !== "" && !rutValido ? true : undefined}>
                  <FieldLabel htmlFor="ep-ru">RUT</FieldLabel>
                   <Input id="ep-ru" value={editForm.rut} maxLength={12} aria-invalid={editForm.rut.trim() !== "" && !rutValido ? true : undefined} onChange={e => setEditForm(f => ({ ...f, rut: formatRut(e.target.value) }))} />
                  {editForm.rut.trim() !== "" && !rutValido && (
                    <p className="text-xs text-destructive mt-1">RUT inválido</p>
                  )}
                </Field>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field orientation="vertical"><FieldLabel htmlFor="ep-te">Teléfono</FieldLabel><Input id="ep-te" value={editForm.telefono} onChange={e => setEditForm(f => ({ ...f, telefono: e.target.value }))} /></Field>
              <Field orientation="vertical"><FieldLabel htmlFor="ep-di">Dirección</FieldLabel><Input id="ep-di" value={editForm.direccion} onChange={e => setEditForm(f => ({ ...f, direccion: e.target.value }))} /></Field>
            </div>
            <Field orientation="vertical"><FieldLabel htmlFor="ep-bi">Bio</FieldLabel><Textarea id="ep-bi" value={editForm.bio} onChange={e => setEditForm(f => ({ ...f, bio: e.target.value }))} placeholder="Cuéntanos sobre ti..." rows={3} /></Field>
          </FieldGroup>
          <Separator className="my-2" />
          <FieldGroup>
            <p className="text-sm font-medium">Cambiar contraseña</p>
            <Field orientation="vertical"><FieldLabel htmlFor="ep-pa">Contraseña actual</FieldLabel><Input id="ep-pa" type="password" value={passActual} onChange={e => setPassActual(e.target.value)} placeholder="••••••••" autoComplete="current-password" /></Field>
            <div className="grid grid-cols-2 gap-4">
              <Field orientation="vertical"><FieldLabel htmlFor="ep-pn">Nueva contraseña</FieldLabel><Input id="ep-pn" type="password" value={passNueva} onChange={e => setPassNueva(e.target.value)} placeholder="Mínimo 6 caracteres" autoComplete="new-password" /></Field>
              <Field orientation="vertical"><FieldLabel htmlFor="ep-pc">Confirmar</FieldLabel><Input id="ep-pc" type="password" value={passConfirm} onChange={e => setPassConfirm(e.target.value)} placeholder="••••••••" /></Field>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={handleChangePassword} disabled={passLoading}>
              {passLoading && <Loader2 className="animate-spin" data-icon="inline-start" />}
              Actualizar contraseña
            </Button>
          </FieldGroup>
          <DialogFooter>
            <Button variant="outline" onClick={async () => {
              await Promise.all(newFotosRef.current.map(url => currentUser?.id ? deleteUploadedFile(url, currentUser.id).catch(() => {}) : Promise.resolve()))
              newFotosRef.current = []
              setEditOpen(false)
            }}>Cancelar</Button>
            <Button onClick={handleSave}>Guardar cambios</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* === DELETE AVATAR ALERT === */}
      {/* === CREATE/EDIT LISTA DIALOG === */}
      <Dialog open={listaDialog} onOpenChange={setListaDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingLista ? "Editar lista" : "Nueva lista"}</DialogTitle>
          </DialogHeader>
          <FieldGroup>
            {editingLista?.por_defecto ? (
              <Field orientation="vertical"><FieldLabel>Nombre</FieldLabel><Input value={editingLista.nombre} disabled /></Field>
            ) : (
              <Field orientation="vertical"><FieldLabel htmlFor="el-n">Nombre</FieldLabel><Input id="el-n" value={listaForm.nombre} onChange={e => setListaForm(f => ({ ...f, nombre: e.target.value }))} /></Field>
            )}
            <Field orientation="vertical"><FieldLabel htmlFor="el-d">Descripción</FieldLabel><Textarea id="el-d" value={listaForm.descripcion} onChange={e => setListaForm(f => ({ ...f, descripcion: e.target.value }))} rows={2} /></Field>
            <Field orientation="vertical"><FieldLabel>Visibilidad</FieldLabel>
              <Select value={listaForm.publica ? "publica" : "privada"} onValueChange={v => setListaForm(f => ({ ...f, publica: v === "publica" }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="publica"><Globe className="size-3.5 inline mr-1.5" />Pública</SelectItem>
                  <SelectItem value="privada"><Lock className="size-3.5 inline mr-1.5" />Privada</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field orientation="vertical">
              <FieldLabel>Imagen de portada</FieldLabel>
              {listaForm.imagen && (
                <div className="relative w-full mb-2">
                  <img src={listaForm.imagen.startsWith("http") ? listaForm.imagen : `${UPLOAD_SERVER}${listaForm.imagen}`} alt="" className="w-full h-24 object-cover rounded-lg" />
                  <button onClick={() => setListaForm(f => ({ ...f, imagen: "" }))} className="absolute top-1 right-1 bg-black/60 rounded-full p-1 text-white"><X className="size-3.5" /></button>
                </div>
              )}
              <input ref={listaFileRef} type="file" accept="image/*" onChange={handleListaImageUpload} className="hidden" />
              <Button type="button" variant="outline" size="sm" onClick={() => listaFileRef.current?.click()}><Camera data-icon="inline-start" />Subir imagen</Button>
            </Field>
          </FieldGroup>
          <DialogFooter>
            <Button variant="outline" onClick={async () => {
              await Promise.all(newListaImagenRef.current.map(url => currentUser?.id ? deleteUploadedFile(url, currentUser.id).catch(() => {}) : Promise.resolve()))
              newListaImagenRef.current = []
              setListaDialog(false)
            }}>Cancelar</Button>
            <Button onClick={handleSaveLista}>{editingLista ? "Guardar" : "Crear lista"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* === DELETE LISTA ALERT === */}
      <AlertDialog open={!!deleteListaId} onOpenChange={(o) => { if (!o) setDeleteListaId(null) }}>
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogMedia className="bg-destructive/10 text-destructive"><Trash2 /></AlertDialogMedia>
            <AlertDialogTitle>Eliminar lista</AlertDialogTitle>
            <AlertDialogDescription>¿Estás seguro? Esta acción no se puede deshacer.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel variant="outline">Cancelar</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={handleDeleteLista}>Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* === LISTA DETAIL DIALOG === */}
      <Dialog open={!!detalleLista} onOpenChange={(o) => { if (!o) setDetalleLista(null) }}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto" showCloseButton={false}>
          {isOwn && (
            <div className="absolute top-4 right-4 flex items-center gap-1">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon-sm"><Settings className="size-4" /></Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent side="bottom">
                  <DropdownMenuItem onClick={() => { if (detalleLista) { openEditLista(detalleLista); setDetalleLista(null) } }}>
                    <Pencil />Editar lista
                  </DropdownMenuItem>
                  {detalleLista && !detalleLista.por_defecto && (
                    <DropdownMenuItem onClick={() => { setDeleteListaId(detalleLista.id); setDetalleLista(null) }}>
                      <Trash2 />Eliminar lista
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
              <Button variant="ghost" size="icon-sm" onClick={() => setDetalleLista(null)}><X className="size-4" /></Button>
            </div>
          )}
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Library className="size-5 text-muted-foreground" />{detalleLista?.nombre}
              {detalleLista && (detalleLista.publica ? <Globe className="size-4 text-muted-foreground" /> : <Lock className="size-4 text-muted-foreground" />)}
            </DialogTitle>
            <DialogDescription>
              {detalleLista?.descripcion && <span>{detalleLista.descripcion} · </span>}
              Creada por <strong>@{perfil?.nombre_usuario}</strong>
            </DialogDescription>
          </DialogHeader>
          {(detalleLista?.libros ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Esta lista no tiene libros aún.</p>
          ) : (
            <div className="grid gap-3">
              {(detalleLista?.libros ?? []).map(libro => (
                <div key={libro.id} className="flex items-center gap-3 rounded-lg border p-3">
                  <Link to={`/libro/${libro.id}`} className="w-12 h-16 shrink-0 rounded-sm overflow-hidden bg-muted">
                    {libro.caratula ? (
                      <img src={libro.caratula.startsWith("http") ? libro.caratula : `${UPLOAD_SERVER}${libro.caratula}`} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <div className="h-full w-full flex items-center justify-center"><BookOpen className="size-4 text-muted-foreground/30" /></div>
                    )}
                  </Link>
                  <Link to={`/libro/${libro.id}`} className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate hover:underline">{libro.titulo}</p>
                    {libro.autor && <p className="text-xs text-muted-foreground truncate">{libro.autor.nombre}</p>}
                  </Link>
                  {isOwn && (
                    <Button size="icon-xs" variant="ghost" onClick={() => handleRemoveFromList(libro.id)}>
                      <Trash2 className="size-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDetalleLista(null)}>Cerrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={resenaEditOpen} onOpenChange={setResenaEditOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Editar reseña</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <div className="flex gap-0.5 justify-center">
              {[1, 2, 3, 4, 5].map((n) => (
                <button key={n} type="button" onClick={() => setResenaEditPunt(n)}
                  className="cursor-pointer hover:scale-110 transition-transform">
                  <Star className={`size-7 ${n <= resenaEditPunt ? "fill-amber-500 text-amber-500" : "text-muted-foreground/30"}`} />
                </button>
              ))}
            </div>
            <Textarea value={resenaEditCom} onChange={e => setResenaEditCom(e.target.value)} placeholder="¿Qué te pareció este libro?" rows={4} />
            {resenaEditFotos.length > 0 && (
              <div className="flex gap-2 flex-wrap">
                {resenaEditFotos.map((url, i) => (
                  <div key={i} className="relative group">
                    <img src={url.startsWith("http") ? url : `${UPLOAD_SERVER}${url}`} alt="" className="size-16 object-cover rounded-md border" />
                    <button className="absolute -top-1.5 -right-1.5 size-4 rounded-full bg-destructive text-white flex items-center justify-center opacity-0 group-hover:opacity-100"
                      onClick={() => setResenaEditFotos(prev => prev.filter((_, j) => j !== i))}>
                      <X className="size-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <label className="cursor-pointer inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground border rounded-md px-3 py-2 w-fit">
              <input type="file" accept="image/*" className="hidden" disabled={uploadingFoto} onChange={async (e) => {
                const file = e.target.files?.[0]
                if (!file || !currentUser) return
                setUploadingFoto(true)
                try {
                  const url = await uploadResenaFoto(file, currentUser.id)
                  setResenaEditFotos(prev => [...prev, url])
                } catch { toast.error("Error al subir foto") }
                finally { setUploadingFoto(false) }
                e.target.value = ""
              }} />
              <Camera data-icon="inline-start" className="size-3.5" />
              {uploadingFoto ? "Subiendo..." : "Agregar foto"}
            </label>
            <Button onClick={handleSaveResenaEdit} disabled={resenaEditPunt === 0 || uploadingFoto}>
              Guardar cambios
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
