import { useState, useRef, useEffect } from "react"
import { getUploadUrl } from "@/lib/api-config"
import { toast } from "sonner"
import { Loader2, Camera, Trash2, X, Library, Plus, Lock, Globe, BookOpen, Pencil, Ellipsis, Settings } from "lucide-react"
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog"
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { FieldGroup, Field, FieldLabel } from "@/components/ui/field"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { useAuth } from "@/contexts/AuthContext"
import { api, type Lista } from "@/lib/api"
import { uploadFile, deleteUploadedFile } from "@/lib/upload"

const UPLOAD_SERVER = getUploadUrl()

function getInitials(usuario: { primer_nombre?: string | null; apellido_paterno?: string | null }) {
  const p = usuario.primer_nombre?.charAt(0) ?? ""
  const a = usuario.apellido_paterno?.charAt(0) ?? ""
  return (p + a).toUpperCase() || "?"
}

export default function Perfil() {
  const { usuario, loading, updateProfile, refreshUser } = useAuth()
  const [open, setOpen] = useState(false)

  const [form, setForm] = useState({
    primer_nombre: "",
    segundo_nombre: "",
    apellido_paterno: "",
    apellido_materno: "",
    email: "",
    rut: "",
    telefono: "",
    direccion: "",
    bio: "",
    foto_perfil: "",
  })

  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const originalFotoRef = useRef("")
  const newFotosRef = useRef<string[]>([])
  const originalListaImagenRef = useRef("")
  const newListaImagenRef = useRef<string[]>([])

  const [listas, setListas] = useState<Lista[]>([])
  const [listaDialog, setListaDialog] = useState(false)
  const [editingLista, setEditingLista] = useState<Lista | null>(null)
  const [listaForm, setListaForm] = useState({ nombre: "", descripcion: "", publica: true, imagen: "" })
  const [deleteListaId, setDeleteListaId] = useState<number | null>(null)
  const listaFileRef = useRef<HTMLInputElement>(null)
  const [detalleLista, setDetalleLista] = useState<Lista | null>(null)

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    try {
      const url = await uploadFile(file, "avatar", String(usuario?.id))
      newFotosRef.current.push(url)
      setForm({ ...form, foto_perfil: url })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al subir imagen")
    } finally {
      setUploading(false)
    }
  }

  const handleRemovePhoto = () => {
    setForm({ ...form, foto_perfil: "" })
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  useEffect(() => {
    if (usuario?.id) api.getListas(usuario.id).then(setListas)
  }, [usuario?.id])

  // Clean up unsaved uploaded photos when dialog closes
  useEffect(() => {
    if (!open && newFotosRef.current.length > 0) {
      for (const url of newFotosRef.current) {
        if (usuario?.id) deleteUploadedFile(url, usuario.id).catch(() => {})
      }
      newFotosRef.current = []
    }
  }, [open])

  // Clean up unsaved list images when dialog closes
  useEffect(() => {
    if (!listaDialog && newListaImagenRef.current.length > 0) {
      for (const url of newListaImagenRef.current) {
        if (usuario?.id) deleteUploadedFile(url, usuario.id).catch(() => {})
      }
      newListaImagenRef.current = []
    }
  }, [listaDialog])

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
    if (!listaForm.nombre.trim() || !usuario) return
    try {
      if (editingLista) {
        const esDefecto = editingLista.por_defecto
        await api.updateLista(editingLista.id, {
          ...(esDefecto ? {} : { nombre: listaForm.nombre.trim() }),
          descripcion: listaForm.descripcion.trim() || null,
          imagen: listaForm.imagen || null,
          publica: listaForm.publica,
        })
        toast.success("Lista actualizada")
      } else {
        await api.createLista({ nombre: listaForm.nombre.trim(), descripcion: listaForm.descripcion.trim() || undefined, imagen: listaForm.imagen || undefined, usuario_id: usuario.id, publica: listaForm.publica })
        toast.success("Lista creada")
      }
      // Delete old image if replaced or removed
      const newImagen = listaForm.imagen || ""
      if (originalListaImagenRef.current && originalListaImagenRef.current !== newImagen && usuario?.id) {
        deleteUploadedFile(originalListaImagenRef.current, usuario.id).catch(() => {})
      }
      // Delete any uploaded images that aren't the final chosen one
      for (const url of newListaImagenRef.current) {
        if (url !== newImagen && usuario?.id) {
          deleteUploadedFile(url, usuario.id).catch(() => {})
        }
      }
      newListaImagenRef.current = []
      setListaDialog(false)
      api.getListas(usuario.id).then(setListas)
    } catch (err) { toast.error(err instanceof Error ? err.message : "Error") }
  }

  const handleDeleteLista = async () => {
    if (!deleteListaId || !usuario) return
    try {
      await api.deleteLista(deleteListaId)
      toast.success("Lista eliminada")
      setDeleteListaId(null)
      api.getListas(usuario.id).then(setListas)
    } catch (err) { toast.error(err instanceof Error ? err.message : "Error") }
  }

  const handleRemoveFromList = async (libroId: number) => {
    if (!detalleLista || !usuario) return
    try {
      await api.removeLibroFromLista(detalleLista.id, libroId)
      setDetalleLista(prev => prev ? { ...prev, libros: (prev.libros ?? []).filter(l => l.id !== libroId) } : null)
      api.getListas(usuario.id).then(setListas)
      toast.success("Libro quitado de la lista")
    } catch (err) { toast.error(err instanceof Error ? err.message : "Error") }
  }

  const handleListaImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const url = await uploadFile(file, "lista", String(usuario?.id))
      newListaImagenRef.current.push(url)
      setListaForm(f => ({ ...f, imagen: url }))
    } catch (err) { toast.error(err instanceof Error ? err.message : "Error al subir imagen") }
  }

  const openEdit = async () => {
    const fresh = await refreshUser()
    const u = fresh || usuario
    setForm({
      primer_nombre: u?.primer_nombre ?? "",
      segundo_nombre: u?.segundo_nombre ?? "",
      apellido_paterno: u?.apellido_paterno ?? "",
      apellido_materno: u?.apellido_materno ?? "",
      email: u?.email ?? "",
      rut: u?.rut ?? "",
      telefono: u?.telefono ?? "",
      direccion: u?.direccion ?? "",
      bio: u?.bio ?? "",
      foto_perfil: u?.foto_perfil ?? "",
    })
    originalFotoRef.current = usuario?.foto_perfil ?? ""
    setOpen(true)
  }

  const handleSave = async () => {
    const data: Record<string, string | null> = {}
    for (const [key, value] of Object.entries(form)) {
      data[key] = value.trim() || null
    }
    try {
      await updateProfile(data)
      // Delete old photo from storage if it was replaced or removed
      const newFoto = data.foto_perfil || ""
      if (originalFotoRef.current && originalFotoRef.current !== newFoto && usuario?.id) {
        deleteUploadedFile(originalFotoRef.current, usuario.id).catch(() => {})
      }
      // Delete any uploaded files that aren't the final chosen one
      for (const url of newFotosRef.current) {
        if (url !== newFoto && usuario?.id) {
          deleteUploadedFile(url, usuario.id).catch(() => {})
        }
      }
      newFotosRef.current = []
      toast.success("Perfil actualizado")
      setOpen(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al actualizar")
    }
  }

  const nombreCompleto = [
    usuario?.primer_nombre,
    usuario?.apellido_paterno,
  ]
    .filter(Boolean)
    .join(" ") || null

  return (
    <div className="mx-auto max-w-2xl px-1">
      <div className="flex flex-col items-center gap-4 pt-4 sm:pt-8">
        <Avatar className="size-20 sm:size-24" key={usuario?.foto_perfil ?? "no-foto"}>
          <AvatarImage src={usuario?.foto_perfil ? (usuario.foto_perfil.startsWith("http") ? usuario.foto_perfil : `${UPLOAD_SERVER}${usuario.foto_perfil}`) : undefined} alt={usuario?.nombre_usuario ?? ""} />
          <AvatarFallback className="text-2xl bg-primary/10 text-primary font-medium">
            {usuario ? getInitials(usuario) : ""}
          </AvatarFallback>
        </Avatar>

        <div className="text-center">
          <h1 className="text-xl font-semibold">@{usuario?.nombre_usuario}</h1>
          {nombreCompleto && (
            <p className="text-sm text-muted-foreground">{nombreCompleto}</p>
          )}
        </div>

        {usuario?.bio ? (
          <p className="text-sm text-center max-w-sm text-muted-foreground">
            {usuario.bio}
          </p>
        ) : (
          <p className="text-sm text-center text-muted-foreground/60 italic">
            Sin biografía
          </p>
        )}

        <Button variant="outline" onClick={openEdit}>
          Editar perfil
        </Button>
      </div>

       <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto mx-2 sm:mx-0">
          <DialogHeader>
            <DialogTitle>Editar perfil</DialogTitle>
            <DialogDescription>
              Actualiza la información de tu cuenta
            </DialogDescription>
          </DialogHeader>

          <FieldGroup>
              <Field orientation="vertical">
              <FieldLabel>Foto de perfil</FieldLabel>
              <div className="flex items-center gap-4">
                {(() => {
                    const url = form.foto_perfil || usuario?.foto_perfil || ""
                    const raw = url.startsWith("http") ? url : `${UPLOAD_SERVER}${url}`
                    return (
                      <div className="size-16 shrink-0 rounded-full overflow-hidden bg-muted">
                        {raw ? (
                          <img src={raw} alt="" className="size-full object-cover" />
                        ) : (
                          <div className="size-full flex items-center justify-center bg-primary/10 text-primary font-medium text-lg">
                            {usuario ? getInitials(usuario) : ""}
                          </div>
                        )}
                      </div>
                    )
                  })()}
                <div className="flex flex-col gap-2">
                  <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
                  <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
                    {uploading ? <Loader2 className="animate-spin" data-icon="inline-start" /> : <Camera data-icon="inline-start" />}
                    {form.foto_perfil ? "Cambiar foto" : "Subir foto"}
                  </Button>
                  {form.foto_perfil && (
                    <Button type="button" variant="ghost" size="sm" onClick={handleRemovePhoto}>
                      <Trash2 data-icon="inline-start" />
                      Eliminar
                    </Button>
                  )}
                </div>
              </div>
            </Field>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field orientation="vertical">
                <FieldLabel htmlFor="edit-pnombre">Primer nombre</FieldLabel>
                <Input
                  id="edit-pnombre"
                  value={form.primer_nombre}
                  onChange={(e) => setForm({ ...form, primer_nombre: e.target.value })}
                />
              </Field>
              <Field orientation="vertical">
                <FieldLabel htmlFor="edit-snombre">Segundo nombre</FieldLabel>
                <Input
                  id="edit-snombre"
                  value={form.segundo_nombre}
                  onChange={(e) => setForm({ ...form, segundo_nombre: e.target.value })}
                />
              </Field>
              <Field orientation="vertical">
                <FieldLabel htmlFor="edit-apaterno">Apellido paterno</FieldLabel>
                <Input
                  id="edit-apaterno"
                  value={form.apellido_paterno}
                  onChange={(e) => setForm({ ...form, apellido_paterno: e.target.value })}
                />
              </Field>
              <Field orientation="vertical">
                <FieldLabel htmlFor="edit-amaterno">Apellido materno</FieldLabel>
                <Input
                  id="edit-amaterno"
                  value={form.apellido_materno}
                  onChange={(e) => setForm({ ...form, apellido_materno: e.target.value })}
                />
              </Field>
              <Field orientation="vertical">
                <FieldLabel htmlFor="edit-email">Email</FieldLabel>
                <Input
                  id="edit-email"
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </Field>
              <Field orientation="vertical">
                <FieldLabel htmlFor="edit-rut">RUT</FieldLabel>
                <Input
                  id="edit-rut"
                  value={form.rut}
                  onChange={(e) => setForm({ ...form, rut: e.target.value })}
                />
              </Field>
              <Field orientation="vertical">
                <FieldLabel htmlFor="edit-tel">Teléfono</FieldLabel>
                <Input
                  id="edit-tel"
                  value={form.telefono}
                  onChange={(e) => setForm({ ...form, telefono: e.target.value })}
                />
              </Field>
              <Field orientation="vertical">
                <FieldLabel htmlFor="edit-dir">Dirección</FieldLabel>
                <Input
                  id="edit-dir"
                  value={form.direccion}
                  onChange={(e) => setForm({ ...form, direccion: e.target.value })}
                />
              </Field>
            </div>
            <Field orientation="vertical">
              <FieldLabel htmlFor="edit-bio">Bio</FieldLabel>
              <Textarea
                id="edit-bio"
                value={form.bio}
                onChange={(e) => setForm({ ...form, bio: e.target.value })}
                placeholder="Cuéntanos sobre ti..."
                rows={3}
              />
            </Field>
          </FieldGroup>

          <DialogFooter>
            <Button variant="outline" onClick={async () => {
              await Promise.all(newFotosRef.current.map(url => usuario?.id ? deleteUploadedFile(url, usuario.id).catch(() => {}) : Promise.resolve()))
              newFotosRef.current = []
              setOpen(false)
            }}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={loading}>
              {loading && <Loader2 className="animate-spin" data-icon="inline-start" />}
              Guardar cambios
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="mt-8 sm:mt-12 border-t pt-6 sm:pt-8">
        <div className="flex items-center justify-between mb-4 sm:mb-6">
          <h2 className="text-base sm:text-lg font-semibold">Mis Listas</h2>
          <Button size="sm" variant="outline" onClick={openCreateLista}><Plus data-icon="inline-start" />Crear lista</Button>
        </div>

        {listas.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">No tienes listas aún.</p>
        ) : (
          <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2">
            {listas.map(lista => (
              <div
                key={lista.id}
                onClick={() => setDetalleLista(lista)}
                className="rounded-xl border overflow-hidden hover:border-primary/30 transition-colors cursor-pointer">
                {lista.imagen && (
                   <div className="aspect-[2/1] sm:aspect-[3/1] overflow-hidden bg-muted">
                    <img src={lista.imagen} alt="" className="w-full h-full object-cover" />
                  </div>
                )}
                <div className="p-3 sm:p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-medium text-sm flex items-center gap-1.5">
                      <Library className="size-5 text-muted-foreground" />{lista.nombre}
                    </h3>
                    {lista.descripcion && <p className="text-xs text-muted-foreground mt-1">{lista.descripcion}</p>}
                  </div>
                  <div className="flex items-center gap-1">
                    {lista.publica ? <Globe className="size-4 text-muted-foreground" /> : <Lock className="size-4 text-muted-foreground" />}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button size="icon-xs" variant="ghost" onClick={(e) => { e.stopPropagation() }}>
                          <Ellipsis className="size-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent side="bottom">
                        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); openEditLista(lista) }}>
                          <Pencil />
                          Editar
                        </DropdownMenuItem>
                        {!lista.por_defecto && (
                          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setDeleteListaId(lista.id) }}>
                            <Trash2 />
                            Eliminar
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
                <div className="mt-3 flex -space-x-2">
                  {(lista.libros ?? []).slice(0, 4).map((libro, i) => (
                    <div key={i} className="w-8 h-12 rounded-sm overflow-hidden border-2 border-background bg-muted">
                      {libro.caratula ? (
                        <img src={libro.caratula.startsWith("http") ? libro.caratula : `${UPLOAD_SERVER}${libro.caratula}`} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <div className="h-full w-full flex items-center justify-center"><BookOpen className="size-3 text-muted-foreground/30" /></div>
                      )}
                    </div>
                  ))}
                  {lista.libros && lista.libros.length > 4 && (
                    <div className="w-8 h-12 rounded-sm border-2 border-background bg-muted flex items-center justify-center text-xs text-muted-foreground">+{lista.libros.length - 4}</div>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-2">{(lista.libros ?? []).length} libros</p>
              </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Dialog open={listaDialog} onOpenChange={setListaDialog}>
        <DialogContent className="sm:max-w-sm mx-2 sm:mx-0">
          <DialogHeader><DialogTitle>{editingLista ? "Editar lista" : "Nueva lista"}</DialogTitle><DialogDescription>{editingLista ? "Modifica los datos de la lista." : "Crea una nueva lista de libros."}</DialogDescription></DialogHeader>
          <FieldGroup>
            <Field orientation="vertical">
              <FieldLabel htmlFor="lista-nombre">Nombre</FieldLabel>
              <Input id="lista-nombre" autoFocus value={listaForm.nombre}
                onChange={e => setListaForm(f => ({ ...f, nombre: e.target.value }))}
                disabled={editingLista ? editingLista.por_defecto : false}
                placeholder="Favoritos" />
            </Field>
            <Field orientation="vertical">
              <FieldLabel htmlFor="lista-desc">Descripción</FieldLabel>
              <Input id="lista-desc" value={listaForm.descripcion} onChange={e => setListaForm(f => ({ ...f, descripcion: e.target.value }))} placeholder="Mis libros favoritos..." />
            </Field>
            <Field orientation="vertical">
              <FieldLabel>Privacidad</FieldLabel>
              <Select value={listaForm.publica ? "publica" : "privada"} onValueChange={v => setListaForm(f => ({ ...f, publica: v === "publica" }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="publica"><Globe className="size-4 mr-1 inline" />Pública</SelectItem>
                  <SelectItem value="privada"><Lock className="size-4 mr-1 inline" />Privada</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field orientation="vertical">
              <FieldLabel>Imagen de portada</FieldLabel>
              <div className="flex items-center gap-4">
                <div className="w-16 h-24 shrink-0 rounded-md overflow-hidden bg-muted flex items-center justify-center">
                  {listaForm.imagen ? (
                    <img src={listaForm.imagen} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <Library className="size-5 text-muted-foreground/30" />
                  )}
                </div>
                <div className="flex flex-col gap-2">
                  <input ref={listaFileRef} type="file" accept="image/*" onChange={handleListaImageUpload} className="hidden" />
                  <Button type="button" variant="outline" size="sm" onClick={() => listaFileRef.current?.click()}>
                    {listaForm.imagen ? "Cambiar imagen" : "Subir imagen"}
                  </Button>
                  {listaForm.imagen && (
                    <Button type="button" variant="ghost" size="sm" onClick={() => setListaForm(f => ({ ...f, imagen: "" }))}>
                      <Trash2 data-icon="inline-start" />
                      Eliminar
                    </Button>
                  )}
                </div>
              </div>
            </Field>
          </FieldGroup>
          <DialogFooter>
            <Button variant="outline" onClick={async () => {
              await Promise.all(newListaImagenRef.current.map(url => usuario?.id ? deleteUploadedFile(url, usuario.id).catch(() => {}) : Promise.resolve()))
              newListaImagenRef.current = []
              setListaDialog(false)
            }}>Cancelar</Button>
            <Button onClick={handleSaveLista}>Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteListaId} onOpenChange={o => { if (!o) setDeleteListaId(null) }}>
        <AlertDialogContent size="sm">
          <AlertDialogHeader><AlertDialogTitle>Eliminar lista</AlertDialogTitle><AlertDialogDescription>¿Estás seguro? Esta acción no se puede deshacer.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel variant="outline">Cancelar</AlertDialogCancel><AlertDialogAction variant="destructive" onClick={handleDeleteLista}>Eliminar</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={!!detalleLista} onOpenChange={(o) => { if (!o) setDetalleLista(null) }}>
        <DialogContent className="max-w-full sm:max-w-2xl max-h-[85vh] overflow-y-auto mx-2 sm:mx-0" showCloseButton={false}>
          <div className="absolute top-4 right-4 flex items-center gap-1">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon-sm"><Settings className="size-4" /></Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent side="bottom">
                <DropdownMenuItem onClick={() => { if (detalleLista) { openEditLista(detalleLista); setDetalleLista(null) } }}>
                  <Pencil />
                  Editar lista
                </DropdownMenuItem>
                {detalleLista && !detalleLista.por_defecto && (
                  <DropdownMenuItem onClick={() => { setDeleteListaId(detalleLista.id); setDetalleLista(null) }}>
                    <Trash2 />
                    Eliminar lista
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
            <Button variant="ghost" size="icon-sm" onClick={() => setDetalleLista(null)}><X className="size-4" /></Button>
          </div>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 pr-16">
              <Library className="size-5 text-muted-foreground shrink-0" />{detalleLista?.nombre}
              {detalleLista && (detalleLista.publica ? <Globe className="size-4 text-muted-foreground" /> : <Lock className="size-4 text-muted-foreground" />)}
            </DialogTitle>
            <DialogDescription>
              {detalleLista?.descripcion && <span>{detalleLista.descripcion} · </span>}
              Creada por <strong>@{usuario?.nombre_usuario}</strong>
            </DialogDescription>
          </DialogHeader>
          {detalleLista && detalleLista.libros && detalleLista.libros.length > 0 ? (
            <div className="grid gap-3">
              {detalleLista.libros.map(libro => (
                <div key={libro.id} className="flex items-center gap-3 rounded-lg border p-3">
                  <div className="w-12 h-16 shrink-0 rounded-sm overflow-hidden bg-muted">
                    {libro.caratula ? (
                      <img src={libro.caratula.startsWith("http") ? libro.caratula : `${UPLOAD_SERVER}${libro.caratula}`} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <div className="h-full w-full flex items-center justify-center"><BookOpen className="size-4 text-muted-foreground/30" /></div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{libro.titulo}</p>
                  </div>
                  <Button size="icon-xs" variant="ghost" onClick={() => handleRemoveFromList(libro.id)}>
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-8">Esta lista no tiene libros aún.</p>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDetalleLista(null)}>Cerrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
