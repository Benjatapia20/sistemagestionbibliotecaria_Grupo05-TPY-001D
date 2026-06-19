import { useState, useEffect, useRef, useMemo } from "react"
import { Navigate, useNavigate } from "react-router-dom"
import { getUploadUrl } from "@/lib/api-config"
import { toast } from "sonner"
import { Plus, Pencil, Trash2, Loader2, BookOpen, Users, ArrowLeftRight, Hash, Settings } from "lucide-react"
import { useAuth } from "@/contexts/AuthContext"
import { api, type LibroConAutor, type Autor, type Genero, type Etiqueta, type Editorial, type Usuario, type Ejemplar, type Seccion, type CategoriaSeccion } from "@/lib/api"
import { getApiMode, setApiMode, getCustomHost, setCustomHost, getApiUrl } from "@/lib/api-config"
import { uploadFile, deleteCaratulaDir, fetchCaratula, fetchCaratulaGoogle } from "@/lib/upload"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog"
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { FieldGroup, Field, FieldLabel } from "@/components/ui/field"
import {
  Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import { Checkbox } from "@/components/ui/checkbox"
import {
  useReactTable,
  getCoreRowModel,
  type ColumnDef,
} from "@tanstack/react-table"
import { flexRender } from "@tanstack/react-table"

const IDIOMAS = ["Español", "Inglés", "Francés", "Alemán", "Italiano", "Portugués", "Japonés", "Chino", "Árabe", "Ruso", "Catalán", "Euskera"]
const UPLOAD_SERVER = getUploadUrl()

function getErrorMessage(err: unknown): string {
  if (err instanceof Error) {
    const msg = err.message
    if (msg.includes("foreign key") || msg.includes("llave foránea")) {
      return "No se puede eliminar porque está siendo usado por otros registros (libros, préstamos, etc.)"
    }
    return msg
  }
  if (typeof err === "object" && err && "message" in err) return String((err as { message: unknown }).message)
  return "Error inesperado"
}

type CrudEntity<T> = {
  list: T[]
  setList: (list: T[]) => void
  label: string
  load: () => Promise<T[]>
  onCreate: (name: string) => Promise<{ id: number; nombre: string }>
  onUpdate: (id: number, name: string) => Promise<{ id: number; nombre: string }>
  onDelete: (id: number) => Promise<unknown>
  getItemName: (item: T) => string
  getItemId: (item: T) => number
}

function CrudSection<T>({ entity }: { entity: CrudEntity<T> }) {
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editId, setEditId] = useState<number | null>(null)
  const [nombre, setNombre] = useState("")
  const [deleteId, setDeleteId] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)

  const openCreate = () => { setEditId(null); setNombre(""); setDialogOpen(true) }
  const openEdit = (item: T) => { setEditId(entity.getItemId(item)); setNombre(entity.getItemName(item)); setDialogOpen(true) }

  const handleSave = async () => {
    if (!nombre.trim()) return
    setLoading(true)
    try {
      if (editId) {
        await entity.onUpdate(editId, nombre.trim())
        toast.success("Actualizado")
      } else {
        await entity.onCreate(nombre.trim())
        toast.success("Creado")
      }
      setDialogOpen(false)
      entity.load().then(entity.setList)
    } catch (err: unknown) { toast.error(getErrorMessage(err)) }
    finally { setLoading(false) }
  }

  const handleDelete = async () => {
    if (!deleteId) return
    setLoading(true)
    try {
      await entity.onDelete(deleteId)
      toast.success("Eliminado")
      setDeleteId(null)
      entity.load().then(entity.setList)
    } catch (err: unknown) { toast.error(getErrorMessage(err)) }
    finally { setLoading(false) }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">{entity.label}</h2>
        <Button size="sm" onClick={openCreate}><Plus data-icon="inline-start" />Nuevo</Button>
      </div>
      <Card className="overflow-hidden !p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-16">#</TableHead>
              <TableHead>Nombre</TableHead>
              <TableHead className="w-24">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {entity.list.map(item => (
              <TableRow key={entity.getItemId(item)}>
                <TableCell className="text-muted-foreground">{entity.getItemId(item)}</TableCell>
                <TableCell className="font-medium">{entity.getItemName(item)}</TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button size="icon-xs" variant="ghost" onClick={() => openEdit(item)}><Pencil /></Button>
                    <Button size="icon-xs" variant="ghost" onClick={() => setDeleteId(entity.getItemId(item))}><Trash2 /></Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{editId ? `Editar ${entity.label.toLowerCase()}` : `Nuevo ${entity.label.toLowerCase()}`}</DialogTitle>
            <DialogDescription>Ingresa el nombre.</DialogDescription>
          </DialogHeader>
          <Field orientation="vertical">
            <FieldLabel>Nombre</FieldLabel>
            <Input autoFocus value={nombre} onChange={e => setNombre(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") handleSave() }} />
          </Field>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={loading || !nombre.trim()}>
              {loading && <Loader2 className="animate-spin" data-icon="inline-start" />}
              {editId ? "Guardar" : "Crear"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={o => { if (!o) setDeleteId(null) }}>
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar {entity.label.toLowerCase()}</AlertDialogTitle>
            <AlertDialogDescription>¿Estás seguro? Los libros que referencien este registro podrían quedar afectados.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel variant="outline">Cancelar</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={handleDelete} disabled={loading}>
              {loading && <Loader2 className="animate-spin" data-icon="inline-start" />}
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function PuntosTable({ secciones, categorias, selection, onSelectionChange, onEdit, onDelete }: {
  secciones: Seccion[]
  categorias: CategoriaSeccion[]
  selection: Record<string, boolean>
  onSelectionChange: (s: Record<string, boolean>) => void
  onEdit: (s: Seccion) => void
  onDelete: (ids: number[]) => void
}) {
  const columns = useMemo<ColumnDef<Seccion>[]>(() => [
    {
      id: "select",
      header: ({ table }) => (
        <Checkbox
          checked={table.getIsAllRowsSelected() || (table.getIsSomeRowsSelected() && "indeterminate")}
          onCheckedChange={(v) => table.toggleAllRowsSelected(!!v)}
          aria-label="Seleccionar todo"
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(v) => row.toggleSelected(!!v)}
          aria-label="Seleccionar fila"
        />
      ),
      size: 28,
    },
    {
      accessorKey: "icono",
      header: "",
      cell: ({ row }) => <span className="text-sm">{row.original.icono || "📍"}</span>,
      size: 28,
    },
    {
      accessorKey: "nombre",
      header: "Nombre",
      cell: ({ row }) => {
        const cat = categorias.find(c => c.nombre === row.original.categoria)
        return (
          <div className="flex flex-col min-w-0">
            <span className="text-xs font-medium truncate">{row.original.nombre}</span>
            <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
              <span className={`size-1.5 rounded-full ${cat?.color ?? "bg-gray-400"}`} />
              {row.original.categoria}
            </span>
          </div>
        )
      },
    },
    {
      id: "actions",
      header: "",
      cell: ({ row }) => (
        <Button size="icon-xs" variant="ghost" className="size-6" onClick={(e) => { e.stopPropagation(); onEdit(row.original) }}>
          <Pencil className="size-3" />
        </Button>
      ),
      size: 28,
    },
  ], [categorias, onEdit])

  const table = useReactTable({
    data: secciones,
    columns,
    getCoreRowModel: getCoreRowModel(),
    onRowSelectionChange: (updater) => {
      const next = typeof updater === "function" ? updater(selection) : updater
      onSelectionChange(next)
    },
    state: { rowSelection: selection },
    getRowId: (row) => String(row.id),
  })

  const seleccionados = table.getSelectedRowModel().rows

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-3 py-2 border-b">
        <p className="text-xs font-medium">{secciones.length} puntos</p>
        {seleccionados.length > 0 && (
          <Button size="sm" variant="destructive" className="h-7 text-xs" onClick={() => {
            const ids = seleccionados.map(r => r.original.id)
            onDelete(ids)
          }}>
            Eliminar ({seleccionados.length})
          </Button>
        )}
      </div>
      <div className="overflow-auto flex-1">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map(hg => (
              <TableRow key={hg.id}>
                {hg.headers.map(h => (
                  <TableHead key={h.id} style={{ width: h.getSize() !== 150 ? h.getSize() : undefined }}>
                    {flexRender(h.column.columnDef.header, h.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length ? (
              table.getRowModel().rows.map(row => (
                <TableRow key={row.id} data-state={row.getIsSelected() ? "selected" : undefined}>
                  {row.getVisibleCells().map(cell => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-xs text-muted-foreground py-8">
                  Sin puntos
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}

export default function Admin() {
  const { usuario } = useAuth()
  if (usuario?.rol !== "admin") return <Navigate to="/inicio" replace />
  return <AdminContent />
}

function AdminContent() {
  const { usuario, logout } = useAuth()
  const navigate = useNavigate()
  const [libros, setLibros] = useState<LibroConAutor[]>([])
  const [autores, setAutores] = useState<Autor[]>([])
  const [generos, setGeneros] = useState<Genero[]>([])
  const [etiquetas, setEtiquetas] = useState<Etiqueta[]>([])
  const [editoriales, setEditoriales] = useState<Editorial[]>([])
  const [usuarios, setUsuarios] = useState<Usuario[]>([])
  const [secciones, setSecciones] = useState<Seccion[]>([])
  const [categoriasSecciones, setCategoriasSecciones] = useState<CategoriaSeccion[]>([])
  const [seccionesSelection, setSeccionesSelection] = useState<Record<string, boolean>>({})
  const [mapaImagen, setMapaImagen] = useState("")
  const [nuevaSeccionPos, setNuevaSeccionPos] = useState<{ x: number; y: number } | null>(null)
  const [editandoSeccion, setEditandoSeccion] = useState<Seccion | null>(null)
  const [formSeccion, setFormSeccion] = useState({ nombre: "", descripcion: "", categoria: "", icono: "📍" })
  const mapaFileRef = useRef<HTMLInputElement>(null)
  const mapaEditorRef = useRef<HTMLDivElement>(null)
  const [buscarCaratulasFuente, setBuscarCaratulasFuente] = useState("todos")
  const [quitarCaratulasOpen, setQuitarCaratulasOpen] = useState(false)
  const [arrastrandoSeccion, setArrastrandoSeccion] = useState<Seccion | null>(null)
  const arrastrandoCoords = useRef("")
  const didDrag = useRef(false)
  const [categoriaDialog, setCategoriaDialog] = useState(false)
  const [editandoCategoria, setEditandoCategoria] = useState<CategoriaSeccion | null>(null)
  const [formCategoria, setFormCategoria] = useState({ nombre: "", descripcion: "", color: "bg-gray-500" })
  const COLORES = ["bg-blue-500", "bg-emerald-500", "bg-amber-500", "bg-purple-500", "bg-cyan-500", "bg-sky-500", "bg-gray-500", "bg-rose-500", "bg-indigo-500", "bg-orange-500", "bg-red-500", "bg-green-500"]
  const [stats, setStats] = useState({ totalLibros: 0, totalStock: 0, totalUsuarios: 0, prestamosActivos: 0, prestamosAtrasados: 0 })
  const [apiMode, setApiModeState] = useState(getApiMode())
  const [tab, setTab] = useState("libros")
  const [customHost, setCustomHostState] = useState(getCustomHost())
  const [loading, setLoading] = useState(false)
  const [searchProgress, setSearchProgress] = useState({ current: 0, total: 0 })
  const [formOpen, setFormOpen] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<number | null>(null)
  const [autorDialogOpen, setAutorDialogOpen] = useState(false)
  const [newAutorNombre, setNewAutorNombre] = useState("")
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [newEditorialNombre, setNewEditorialNombre] = useState("")
  const [ejemplaresDialog, setEjemplaresDialog] = useState<LibroConAutor | null>(null)
  const [ejemplaresList, setEjemplaresList] = useState<Ejemplar[]>([])
  const [ejemplaresCantidad, setEjemplaresCantidad] = useState(1)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [form, setForm] = useState({
    titulo: "", autor_id: 0, editorial_id: 0, sinopsis: "", isbn: "",
    anio_publicacion: 2024, numero_paginas: 0, idioma: "", cantidad: 1, disponible: true,
    genero_ids: [] as number[], etiqueta_ids: [] as number[],
    caratula: "",
  })

  const loadData = () => {
    api.getLibros().then(setLibros)
    api.getAutores().then(setAutores)
    api.getGeneros().then(setGeneros)
    api.getEtiquetas().then(setEtiquetas)
    api.getEditoriales().then(setEditoriales)
    api.getUsuarios().then(setUsuarios)
    api.getSecciones().then(setSecciones)
    api.getCategoriasSecciones().then(setCategoriasSecciones)
    api.getStats().then(setStats)
    api.getConfig("mapa_imagen").then(v => setMapaImagen(v ?? ""))
  }

  const handleQuitarCaratulas = () => {
    if (libros.filter(l => l.caratula).length === 0) {
      toast.info("No hay libros con carátula")
      return
    }
    setQuitarCaratulasOpen(true)
  }

  const confirmarQuitarCaratulas = async () => {
    setQuitarCaratulasOpen(false)
    setLoading(true)
    let count = 0
    try {
      for (const libro of libros.filter(l => l.caratula)) {
        try { await api.updateLibro(libro.id, { caratula: null }); count++ } catch {}
      }
      if (count > 0) { toast.success(`${count} carátula(s) eliminada(s)`); loadData() }
    } catch (err) { toast.error(getErrorMessage(err)) }
    finally { setLoading(false) }
  }

  useEffect(() => { loadData() }, [])

  useEffect(() => {
    if (!usuario) return
    api.verifyRole(usuario.id).then((dbRol) => {
      if (dbRol && dbRol !== "admin") {
        logout()
        navigate("/")
      }
    })
  }, [])

  const guardAdmin = async (): Promise<boolean> => {
    if (!usuario) { logout(); navigate("/"); return false }
    const dbRol = await api.verifyRole(usuario.id)
    if (dbRol !== "admin") {
      toast.error("Has perdido el rol de administrador. Cerrando sesión...")
      logout()
      navigate("/")
      return false
    }
    return true
  }

  const openCreate = () => {
    setEditingId(null)
    setForm({ titulo: "", autor_id: 0, editorial_id: 0, sinopsis: "", isbn: "", anio_publicacion: 2024, numero_paginas: 0, idioma: "", cantidad: 1, disponible: true, genero_ids: [], etiqueta_ids: [], caratula: "" })
    setFormOpen(true)
  }

  const openEdit = (libro: LibroConAutor) => {
    setEditingId(libro.id)
    setForm({
      titulo: libro.titulo, autor_id: libro.autor_id, editorial_id: libro.editorial.id, sinopsis: libro.sinopsis ?? "",
      isbn: libro.isbn ?? "",
      anio_publicacion: libro.anio_publicacion ?? 2024,
      numero_paginas: libro.numero_paginas ?? 0, idioma: libro.idioma ?? "",
      cantidad: 0, genero_ids: libro.generos.map(g => g.genero.id),
      etiqueta_ids: libro.etiquetas.map(e => e.etiqueta.id), caratula: libro.caratula ?? "",
      disponible: libro.disponible,
    })
    setFormOpen(true)
  }

  const handleSave = async () => {
    if (!(await guardAdmin())) return
    if (!form.titulo.trim() || !form.autor_id || !form.editorial_id) {
      toast.error("Título, autor y editorial son obligatorios")
      return
    }
    setLoading(true)
    try {
      const base = {
        titulo: form.titulo.trim(),
        autor_id: form.autor_id,
        editorial_id: form.editorial_id,
        sinopsis: form.sinopsis.trim() || undefined,
        isbn: form.isbn.trim() || undefined,
        anio_publicacion: form.anio_publicacion || undefined,
        numero_paginas: form.numero_paginas || undefined,
        idioma: form.idioma.trim() || undefined,
        caratula: form.caratula || null,
        genero_ids: form.genero_ids,
        etiqueta_ids: form.etiqueta_ids,
      }
      if (editingId) {
        await api.updateLibro(editingId, base)
        toast.success("Libro actualizado")
      } else {
        const libroCreado = await api.createLibro({
          titulo: base.titulo, autor_id: base.autor_id, editorial_id: base.editorial_id,
          sinopsis: base.sinopsis, isbn: base.isbn,
          anio_publicacion: base.anio_publicacion, numero_paginas: base.numero_paginas,
          idioma: base.idioma, caratula: base.caratula,
          genero_ids: base.genero_ids, etiqueta_ids: base.etiqueta_ids,
        })
        await api.createEjemplares(libroCreado.id, form.cantidad)
        toast.success(`Libro creado con ${form.cantidad} ejemplares`)
      }
      setFormOpen(false)
      loadData()
    } catch (err: unknown) { toast.error(getErrorMessage(err)) }
    finally { setLoading(false) }
  }

  const handleDelete = async () => {
    if (!(await guardAdmin())) return
    if (!deleteTarget) return
    setLoading(true)
    try { await api.deleteLibro(deleteTarget); deleteCaratulaDir(deleteTarget).catch(() => {}); toast.success("Libro eliminado"); setDeleteTarget(null); loadData() }
    catch (err: unknown) { toast.error(getErrorMessage(err)) }
    finally { setLoading(false) }
  }

  const handleCreateAutor = async () => {
    const nombre = newAutorNombre.trim()
    if (!nombre) return
    try {
      const autor = await api.createAutor({ nombre })
      setAutores(prev => [...prev, autor])
      setForm(f => ({ ...f, autor_id: autor.id }))
      setNewAutorNombre(""); setAutorDialogOpen(false)
      toast.success(`Autor "${nombre}" creado`)
    } catch (err: unknown) { toast.error(getErrorMessage(err)) }
  }

  const handleCreateEditorial = async () => {
    const nombre = newEditorialNombre.trim()
    if (!nombre) return
    try {
      const ed = await api.createEditorial({ nombre })
      setEditoriales(prev => [...prev, ed])
      setForm(f => ({ ...f, editorial_id: ed.id }))
      setNewEditorialNombre(""); setEditDialogOpen(false)
      toast.success(`Editorial "${nombre}" creada`)
    } catch (err: unknown) { toast.error(getErrorMessage(err)) }
  }

  const openEjemplares = (libro: LibroConAutor) => {
    setEjemplaresDialog(libro)
    setEjemplaresCantidad(1)
    api.getEjemplares(libro.id).then(setEjemplaresList)
  }

  const handleAddEjemplar = async () => {
    if (!ejemplaresDialog) return
    try {
      await api.createEjemplares(ejemplaresDialog.id, ejemplaresCantidad)
      toast.success(`${ejemplaresCantidad} ejemplar(es) agregado(s)`)
      setEjemplaresCantidad(1)
      api.getEjemplares(ejemplaresDialog.id).then(setEjemplaresList)
    } catch (err: unknown) { toast.error(getErrorMessage(err)) }
  }

  const handleDeleteEjemplar = async (id: number) => {
    try {
      await api.deleteEjemplar(id)
      toast.success("Ejemplar eliminado")
      if (ejemplaresDialog) api.getEjemplares(ejemplaresDialog.id).then(setEjemplaresList)
    } catch (err: unknown) { toast.error(getErrorMessage(err)) }
  }

  const handleCaratulaUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const libroId = String(editingId ?? 0)
      const url = await uploadFile(file, "caratula", libroId)
      setForm(f => ({ ...f, caratula: url }))
    } catch (err: unknown) { toast.error(getErrorMessage(err)) }
  }

  const handleFetchCaratula = async () => {
    const isbn = form.isbn.trim()
    if (!isbn) { toast.error("Primero ingresa el ISBN"); return }
    try {
      const url = await fetchCaratula(isbn, editingId ?? 0)
      setForm(f => ({ ...f, caratula: url }))
      toast.success("Carátula descargada")
    } catch (err: unknown) { toast.error(getErrorMessage(err)) }
  }

  return (
    <div>
      <h1 className="mb-4 sm:mb-6 text-xl sm:text-2xl font-semibold">Administrar</h1>

      <div className="mb-6 rounded-xl border p-4 flex items-center justify-between">
        <div>
          <p className="text-sm font-medium">Modo de conexión</p>
          <p className="text-xs text-muted-foreground">
            {apiMode === "local" ? "Conectado a la base de datos local (localhost:3000)" : "Conectado a Supabase (online)"}
          </p>
        </div>
        <Switch
          checked={apiMode === "supabase"}
          onCheckedChange={(v) => {
            const newMode = v ? "supabase" : "local"
            setApiMode(newMode)
            setApiModeState(newMode)
            window.location.reload()
          }}
        />
      </div>

      {apiMode === "local" && (
        <div className="mb-6 rounded-xl border p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium">IP del servidor (LAN)</p>
            <p className="text-xs text-muted-foreground">
              {customHost ? `Usando IP: ${customHost}` : "Usando localhost"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Input
              className="w-40 h-9 text-sm"
              placeholder="192.168.1.x"
              value={customHost}
              onChange={e => setCustomHostState(e.target.value)}
              onBlur={async () => {
                const host = customHost.trim()
                setCustomHost(host)
                setCustomHostState(host)
                // Also save to configuracion table for other clients
                try {
                    await api.setConfig("custom_host", host)
                } catch {}
                if (host) {
                  toast.success(host ? `IP cambiada a ${host}. Recargando...` : "IP restaurada a localhost")
                  setTimeout(() => window.location.reload(), 800)
                }
              }}
              onKeyDown={e => { if (e.key === "Enter") (e.target as HTMLInputElement).blur() }}
            />
            {customHost && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setCustomHost("")
                  setCustomHostState("")
                  api.setConfig("custom_host", "").catch(() => {})
                  toast.success("IP restaurada a localhost. Recargando...")
                  setTimeout(() => window.location.reload(), 800)
                }}
              >
                Limpiar
              </Button>
            )}
          </div>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-8">
        {[
          { label: "Total libros", value: stats.totalLibros, sub: `${stats.totalStock} ejemplares`, icon: BookOpen },
          { label: "Usuarios", value: stats.totalUsuarios, sub: "registrados", icon: Users },
          { label: "Préstamos activos", value: stats.prestamosActivos, sub: `${stats.prestamosAtrasados} atrasados`, icon: ArrowLeftRight },
          { label: "Autores", value: autores.length, sub: `${generos.length} géneros / ${editoriales.length} editoriales`, icon: Hash },
        ].map(s => (
          <Card key={s.label} size="sm"><CardContent>
            <div className="flex items-center justify-between">
              <div><p className="text-sm text-muted-foreground">{s.label}</p><p className="text-2xl font-bold">{s.value}</p><p className="text-xs text-muted-foreground">{s.sub}</p></div>
              <s.icon className="size-8 text-muted-foreground/40" />
            </div>
          </CardContent></Card>
        ))}
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        {/* Desktop tabs */}
        <TabsList className="hidden sm:flex mb-6">
          <TabsTrigger value="libros">Libros</TabsTrigger>
          <TabsTrigger value="autores">Autores</TabsTrigger>
          <TabsTrigger value="generos">Géneros</TabsTrigger>
          <TabsTrigger value="etiquetas">Etiquetas</TabsTrigger>
          <TabsTrigger value="editoriales">Editoriales</TabsTrigger>
          <TabsTrigger value="usuarios">Usuarios</TabsTrigger>
          <TabsTrigger value="secciones">Mapa</TabsTrigger>
        </TabsList>
        {/* Mobile select */}
        <div className="sm:hidden mb-4">
          <Select value={tab} onValueChange={setTab}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="libros">Libros</SelectItem>
              <SelectItem value="autores">Autores</SelectItem>
              <SelectItem value="generos">Géneros</SelectItem>
              <SelectItem value="etiquetas">Etiquetas</SelectItem>
              <SelectItem value="editoriales">Editoriales</SelectItem>
              <SelectItem value="usuarios">Usuarios</SelectItem>
              <SelectItem value="secciones">Mapa</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <TabsContent value="libros">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-0 mb-4">
            <h2 className="text-lg font-semibold">Libros</h2>
            <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
              <Button size="sm" onClick={openCreate}><Plus data-icon="inline-start" />Nuevo libro</Button>
              <Select value={buscarCaratulasFuente} onValueChange={setBuscarCaratulasFuente}>
                <SelectTrigger className="w-36 h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="todos">Todos</SelectItem>
                    <SelectItem value="openlibrary">OpenLibrary</SelectItem>
                    <SelectItem value="google">Google Books</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
              <Button size="sm" variant="outline" onClick={async () => {
                setLoading(true)
                let count = 0
                try {
                  const sinCaratula = libros.filter(l => !l.caratula)
                  if (sinCaratula.length === 0) { toast.info("Todos los libros ya tienen carátula"); return }
                  const usarOL = buscarCaratulasFuente === "todos" || buscarCaratulasFuente === "openlibrary"
                  const usarGB = buscarCaratulasFuente === "todos" || buscarCaratulasFuente === "google"
                  setSearchProgress({ current: 0, total: sinCaratula.length })
                  toast.info(`Buscando carátulas para ${sinCaratula.length} libros...`)
                  let i = 0
                  for (const libro of sinCaratula) {
                  try {
                    let url: string | null = null
                    if (usarOL && libro.isbn) {
                      url = await fetchCaratula(libro.isbn, libro.id).catch(() => null)
                    }
                    if (usarOL && !url) {
                      const query = encodeURIComponent(`${libro.titulo} ${libro.autor.nombre}`)
                      const res = await fetch(`https://openlibrary.org/search.json?q=${query}&limit=1`).catch(() => null)
                      if (res) {
                        const data = await res.json()
                        const found = data?.docs?.[0]
                        if (found?.isbn?.[0]) {
                          url = await fetchCaratula(found.isbn[0], libro.id).catch(() => null)
                        }
                      }
                    }
                    if (usarGB && !url) {
                      url = await fetchCaratulaGoogle(libro.titulo, libro.autor.nombre, libro.id).catch(() => null)
                    }
                      if (url) {
                        await api.updateLibro(libro.id, { caratula: url })
                        count++
                      }
                    } catch {}
                    i++
                    setSearchProgress({ current: i, total: sinCaratula.length })
                  }
                  if (count > 0) {
                    toast.success(`${count} carátula(s) descargada(s)`)
                    loadData()
                  } else {
                    toast.warning("No se encontraron carátulas")
                  }
                } catch (err) { toast.error(getErrorMessage(err)) }
                finally { setLoading(false); setSearchProgress({ current: 0, total: 0 }) }
              }} disabled={loading}>
                <Loader2 className={loading ? "animate-spin" : ""} data-icon="inline-start" />
                Buscar carátulas
              </Button>
              <Button size="sm" variant="ghost" onClick={handleQuitarCaratulas} disabled={loading}>
                Quitar carátulas
              </Button>
            </div>
          </div>
          {searchProgress.total > 0 && (
            <div className="mb-4">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-muted-foreground">Buscando carátulas...</span>
                <span className="text-xs text-muted-foreground">{searchProgress.current}/{searchProgress.total}</span>
              </div>
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full transition-all duration-300 ease-linear"
                  style={{ width: `${(searchProgress.current / searchProgress.total) * 100}%` }}
                />
              </div>
            </div>
          )}
          <Card className="overflow-x-auto !p-0">
            <Table>
              <TableHeader><TableRow>
                <TableHead className="w-8 sm:w-10">#</TableHead><TableHead className="w-10">Carátula</TableHead><TableHead>Título</TableHead><TableHead className="hidden sm:table-cell w-16">Stock</TableHead><TableHead className="hidden sm:table-cell w-16">Disp.</TableHead><TableHead className="w-12">Acciones</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {libros.map(libro => {
                  const caratulaUrl = libro.caratula
                    ? libro.caratula.startsWith("http")
                      ? libro.caratula
                      : `${UPLOAD_SERVER}${libro.caratula}`
                    : null
                  return (
                  <TableRow key={libro.id}>
                    <TableCell className="text-muted-foreground">{libro.id}</TableCell>
                    <TableCell>
                      <div className="w-8 h-10 rounded-sm overflow-hidden bg-muted">
                        {caratulaUrl ? (
                          <img src={caratulaUrl} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <div className="h-full w-full flex items-center justify-center"><BookOpen className="size-3 text-muted-foreground/30" /></div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="font-medium">{libro.titulo}</TableCell>
                    <TableCell className="hidden sm:table-cell">{libro.stock}</TableCell>
                    <TableCell className="hidden sm:table-cell">
                      <Switch
                        checked={libro.disponible}
                        onCheckedChange={async () => {
                          try {
                            await api.updateLibro(libro.id, { disponible: !libro.disponible })
                            if (!libro.disponible) {
                              try {
                                const r = await fetch(`${getApiUrl()}/listas_libros?libro_id=eq.${libro.id}&select=lista_id,lista:listas(usuario_id,nombre)`)
                                const registros = await r.json()
                                const notificados = new Set()
                                for (const reg of registros || []) {
                                  const uid = reg.lista?.usuario_id
                                  if (uid && !notificados.has(uid)) {
                                    notificados.add(uid)
                                    api.createNotificacion({
                                      usuario_id: uid,
                                      titulo: "¡Libro disponible!",
                                      mensaje: `"${libro.titulo}" está disponible nuevamente. Lo tienes en una de tus listas. Ya puedes pedirlo.`,
                                      link: `/libro/${libro.id}`,
                                    }).catch(() => {})
                                  }
                                }
                              } catch {}
                            }
                            loadData()
                          } catch (err) { toast.error(getErrorMessage(err)) }
                        }}
                      />
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button size="icon-xs" variant="ghost">
                            <Settings className="size-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openEjemplares(libro)}>
                            <BookOpen /> Ejemplares
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => openEdit(libro)}>
                            <Pencil /> Editar
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setDeleteTarget(libro.id)}>
                            <Trash2 /> Eliminar
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                )})}
              </TableBody>
            </Table>
          </Card>

          <Dialog open={formOpen} onOpenChange={setFormOpen}>
            <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader><DialogTitle>{editingId ? "Editar libro" : "Nuevo libro"}</DialogTitle><DialogDescription>{editingId ? "Modifica los datos del libro" : "Ingresa los datos del nuevo libro"}</DialogDescription></DialogHeader>
              <FieldGroup>
                <div className="grid grid-cols-3 gap-4">
                  <Field orientation="vertical" className="col-span-2">
                    <FieldLabel htmlFor="fl-titulo">Título</FieldLabel><Input id="fl-titulo" value={form.titulo} onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))} />
                  </Field>
                  <Field orientation="vertical">
                    <FieldLabel>Autor</FieldLabel>
                    <div className="flex gap-2">
                      <div className="min-w-0 flex-1">
                        <Select value={String(form.autor_id || "")} onValueChange={v => setForm(f => ({ ...f, autor_id: Number(v) }))}>
                          <SelectTrigger className="w-full"><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                          <SelectContent>{autores.map(a => <SelectItem key={a.id} value={String(a.id)}>{a.nombre}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                      <Button size="sm" variant="outline" onClick={() => setAutorDialogOpen(true)}><Plus /></Button>
                    </div>
                  </Field>
                </div>
                <Field orientation="vertical">
                  <FieldLabel htmlFor="fl-sinopsis">Sinopsis</FieldLabel><Textarea id="fl-sinopsis" rows={3} value={form.sinopsis} onChange={e => setForm(f => ({ ...f, sinopsis: e.target.value }))} />
                </Field>
                <div className="grid grid-cols-3 gap-4">
                  <Field orientation="vertical">
                    <FieldLabel htmlFor="fl-isbn">ISBN</FieldLabel>
                    <Input id="fl-isbn" value={form.isbn} onChange={e => setForm(f => ({ ...f, isbn: e.target.value }))} />
                    <Button type="button" variant="ghost" size="sm" className="mt-1" onClick={handleFetchCaratula} disabled={!form.isbn.trim()}>
                      Buscar carátula
                    </Button>
                  </Field>
                  <Field orientation="vertical">
                    <FieldLabel>Editorial</FieldLabel>
                    <div className="flex gap-2">
                      <div className="min-w-0 flex-1">
                        <Select value={String(form.editorial_id || "")} onValueChange={v => setForm(f => ({ ...f, editorial_id: Number(v) }))}>
                          <SelectTrigger className="w-full"><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                          <SelectContent>{editoriales.map(e => <SelectItem key={e.id} value={String(e.id)}>{e.nombre}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                      <Button size="sm" variant="outline" onClick={() => setEditDialogOpen(true)}><Plus /></Button>
                    </div>
                  </Field>
                  <Field orientation="vertical">
                    <FieldLabel htmlFor="fl-anio">Año</FieldLabel><Input id="fl-anio" type="number" value={form.anio_publicacion} onChange={e => setForm(f => ({ ...f, anio_publicacion: Number(e.target.value) }))} />
                  </Field>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <Field orientation="vertical">
                    <FieldLabel htmlFor="fl-pags">Páginas</FieldLabel><Input id="fl-pags" type="number" value={form.numero_paginas} onChange={e => setForm(f => ({ ...f, numero_paginas: Number(e.target.value) }))} />
                  </Field>
                  <Field orientation="vertical">
                    <FieldLabel>Idioma</FieldLabel>
                    <Select value={form.idioma} onValueChange={v => setForm(f => ({ ...f, idioma: v }))}>
                      <SelectTrigger className="w-full"><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                      <SelectContent>
                        {IDIOMAS.map(i => <SelectItem key={i} value={i}>{i}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field orientation="vertical">
                    <FieldLabel>{editingId ? "Stock actual" : "Cantidad de ejemplares"}</FieldLabel>
                    {editingId ? (
                      <Input value={String(libros.find(l => l.id === editingId)?.stock ?? 0)} disabled />
                    ) : (
                      <Input id="fl-cantidad" type="number" min={1} value={form.cantidad} onChange={e => setForm(f => ({ ...f, cantidad: Number(e.target.value) }))} />
                    )}
                  </Field>
                </div>
                <Field orientation="vertical">
                  <FieldLabel>Géneros</FieldLabel>
                  <div className="flex flex-wrap gap-2">
                    {generos.map(g => (
                      <label key={g.id} className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-sm cursor-pointer transition-colors ${form.genero_ids.includes(g.id) ? "border-primary bg-primary/10 text-primary" : "border-input hover:bg-muted"}`}>
                        <input type="checkbox" className="sr-only" checked={form.genero_ids.includes(g.id)} onChange={() => setForm(f => ({ ...f, genero_ids: f.genero_ids.includes(g.id) ? f.genero_ids.filter(id => id !== g.id) : [...f.genero_ids, g.id] }))} />{g.nombre}
                      </label>
                    ))}
                  </div>
                </Field>
                <Field orientation="vertical">
                  <FieldLabel>Etiquetas</FieldLabel>
                  <div className="flex flex-wrap gap-2">
                    {etiquetas.map(e => (
                      <label key={e.id} className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-sm cursor-pointer transition-colors ${form.etiqueta_ids.includes(e.id) ? "border-primary bg-primary/10 text-primary" : "border-input hover:bg-muted"}`}>
                        <input type="checkbox" className="sr-only" checked={form.etiqueta_ids.includes(e.id)} onChange={() => setForm(f => ({ ...f, etiqueta_ids: f.etiqueta_ids.includes(e.id) ? f.etiqueta_ids.filter(id => id !== e.id) : [...f.etiqueta_ids, e.id] }))} />{e.nombre}
                      </label>
                    ))}
                  </div>
                </Field>
                <Field orientation="vertical">
                  <FieldLabel>Carátula</FieldLabel>
                  <div className="flex items-start gap-4">
                    <div className="w-20 h-28 shrink-0 rounded-md overflow-hidden bg-muted flex items-center justify-center">
                      {form.caratula ? (
                        <img src={form.caratula.startsWith("http") ? form.caratula : `${UPLOAD_SERVER}${form.caratula}`} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <BookOpen className="size-6 text-muted-foreground/30" />
                      )}
                    </div>
                    <div className="flex flex-col gap-2">
                      <input ref={fileInputRef} type="file" accept="image/*" onChange={handleCaratulaUpload} className="hidden" />
                      <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                        {form.caratula ? "Cambiar carátula" : "Subir carátula"}
                      </Button>
                      {form.caratula && (
                        <Button type="button" variant="ghost" size="sm" onClick={() => setForm(f => ({ ...f, caratula: "" }))}>
                          <Trash2 data-icon="inline-start" />Eliminar
                        </Button>
                      )}
                    </div>
                  </div>
                </Field>
              </FieldGroup>
              <DialogFooter>
                <Button variant="outline" onClick={() => setFormOpen(false)}>Cancelar</Button>
                <Button onClick={handleSave} disabled={loading}>{loading && <Loader2 className="animate-spin" data-icon="inline-start" />}{editingId ? "Guardar cambios" : "Crear libro"}</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog open={autorDialogOpen} onOpenChange={setAutorDialogOpen}>
            <DialogContent className="sm:max-w-sm"><DialogHeader><DialogTitle>Nuevo autor</DialogTitle><DialogDescription>Ingresa el nombre del autor.</DialogDescription></DialogHeader>
              <Field orientation="vertical"><FieldLabel>Nombre</FieldLabel><Input autoFocus value={newAutorNombre} onChange={e => setNewAutorNombre(e.target.value)} onKeyDown={e => { if (e.key === "Enter") handleCreateAutor() }} placeholder="Gabriel García Márquez" /></Field>
              <DialogFooter><Button variant="outline" onClick={() => setAutorDialogOpen(false)}>Cancelar</Button><Button onClick={handleCreateAutor} disabled={!newAutorNombre.trim()}>Crear autor</Button></DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
            <DialogContent className="sm:max-w-sm"><DialogHeader><DialogTitle>Nueva editorial</DialogTitle><DialogDescription>Ingresa el nombre de la editorial.</DialogDescription></DialogHeader>
              <Field orientation="vertical"><FieldLabel>Nombre</FieldLabel><Input autoFocus value={newEditorialNombre} onChange={e => setNewEditorialNombre(e.target.value)} onKeyDown={e => { if (e.key === "Enter") handleCreateEditorial() }} placeholder="Sudamericana" /></Field>
              <DialogFooter><Button variant="outline" onClick={() => setEditDialogOpen(false)}>Cancelar</Button><Button onClick={handleCreateEditorial} disabled={!newEditorialNombre.trim()}>Crear editorial</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        </TabsContent>

        <TabsContent value="autores">
          <CrudSection<Autor> entity={{
            list: autores, setList: setAutores, label: "Autores",
            load: api.getAutores, onCreate: (n: string) => api.createAutor({ nombre: n }),
            onUpdate: (id: number, n: string) => api.updateAutor(id, { nombre: n }),
            onDelete: (id: number) => api.deleteAutor(id),
            getItemName: (a: Autor) => a.nombre, getItemId: (a: Autor) => a.id,
          }} />
        </TabsContent>

        <TabsContent value="generos">
          <CrudSection<Genero> entity={{
            list: generos, setList: setGeneros, label: "Géneros",
            load: api.getGeneros, onCreate: api.createGenero, onUpdate: api.updateGenero, onDelete: api.deleteGenero,
            getItemName: (g: Genero) => g.nombre, getItemId: (g: Genero) => g.id,
          }} />
        </TabsContent>

        <TabsContent value="etiquetas">
          <CrudSection<Etiqueta> entity={{
            list: etiquetas, setList: setEtiquetas, label: "Etiquetas",
            load: api.getEtiquetas, onCreate: api.createEtiqueta, onUpdate: api.updateEtiqueta, onDelete: api.deleteEtiqueta,
            getItemName: (e: Etiqueta) => e.nombre, getItemId: (e: Etiqueta) => e.id,
          }} />
        </TabsContent>

        <TabsContent value="editoriales">
          <CrudSection<Editorial> entity={{
            list: editoriales, setList: setEditoriales, label: "Editoriales",
            load: api.getEditoriales, onCreate: (n: string) => api.createEditorial({ nombre: n }),
            onUpdate: (id: number, n: string) => api.updateEditorial(id, { nombre: n }),
            onDelete: (id: number) => api.deleteEditorial(id),
            getItemName: (e: Editorial) => e.nombre, getItemId: (e: Editorial) => e.id,
          }} />
        </TabsContent>
        <TabsContent value="usuarios">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Usuarios</h2>
          </div>
          <Card className="overflow-hidden !p-0 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                   <TableHead>Usuario</TableHead>
                   <TableHead>Nombre</TableHead>
                   <TableHead className="hidden sm:table-cell">Email</TableHead>
                   <TableHead className="w-40">Rol</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {usuarios.map(u => (
                  <TableRow key={u.id}>
                    <TableCell className="font-medium">@{u.nombre_usuario}</TableCell>
                    <TableCell className="text-muted-foreground">{u.primer_nombre ? `${u.primer_nombre} ${u.apellido_paterno ?? ""}` : "—"}</TableCell>
                    <TableCell className="hidden sm:table-cell text-muted-foreground">{u.email ?? "—"}</TableCell>
                    <TableCell>
                      <Select
                        value={u.rol}
                        onValueChange={async (rol) => {
                          try {
                            await api.updateUserRole(u.id, rol)
                            setUsuarios(prev => prev.map(x => x.id === u.id ? { ...x, rol: rol as Usuario["rol"] } : x))
                            if (u.id === usuario?.id && rol !== "admin") {
                              toast.warning("Te has degradado a ti mismo. Cerrando sesión...")
                              setTimeout(() => { logout(); navigate("/") }, 1000)
                            } else if (u.id !== usuario?.id) {
                              toast.success(`Rol de @${u.nombre_usuario} actualizado. El usuario debe volver a iniciar sesión.`)
                            }
                          } catch (err) { toast.error(getErrorMessage(err)) }
                        }}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="admin">Admin</SelectItem>
                          <SelectItem value="bibliotecario">Bibliotecario</SelectItem>
                          <SelectItem value="usuario">Usuario</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>
        <TabsContent value="secciones">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Mapa de la Biblioteca</h2>
          </div>

          <div className="flex flex-col gap-6">
            <Card size="sm">
              <div className="p-4 flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">Categorías</p>
                  <Button size="sm" variant="outline" onClick={() => { setFormCategoria({ nombre: "", descripcion: "", color: "bg-gray-500" }); setEditandoCategoria(null); setCategoriaDialog(true) }}>
                    <Plus data-icon="inline-start" />Nueva
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {categoriasSecciones.map(c => (
                    <button
                      key={c.id}
                      onClick={() => { setFormCategoria({ nombre: c.nombre, descripcion: c.descripcion ?? "", color: c.color }); setEditandoCategoria(c); setCategoriaDialog(true) }}
                      className="flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs hover:bg-muted transition-colors"
                    >
                      <span className={`size-2 rounded-full ${c.color}`} />
                      {c.nombre}
                    </button>
                  ))}
                  {categoriasSecciones.length === 0 && (
                    <p className="text-xs text-muted-foreground">No hay categorías. Crea una para empezar.</p>
                  )}
                </div>
              </div>
            </Card>

            <Card size="sm">
              <div className="p-4 flex flex-col gap-3">
                <p className="text-sm font-medium">Imagen del mapa</p>
                <div className="flex gap-2">
                  <Input
                    value={mapaImagen}
                    onChange={e => setMapaImagen(e.target.value)}
                    placeholder="URL de la imagen del mapa..."
                    className="flex-1"
                  />
                  <Button size="sm" variant="outline" onClick={async () => {
                    try { await api.setConfig("mapa_imagen", mapaImagen); toast.success("Imagen actualizada") } catch (err) { toast.error(getErrorMessage(err)) }
                  }}>Guardar</Button>
                  <Input type="file" accept="image/*" className="hidden" ref={mapaFileRef} onChange={async (e) => {
                    const file = e.target.files?.[0]
                    if (!file) return
                    try {
                      const url = await uploadFile(file as any, "mapa", "biblioteca")
                      setMapaImagen(url)
                      await api.setConfig("mapa_imagen", url)
                      toast.success("Imagen subida y guardada")
                    } catch (err) { toast.error(getErrorMessage(err)) }
                  }} />
                  <Button size="sm" variant="outline" onClick={() => mapaFileRef.current?.click()}>Subir</Button>
                </div>
              </div>
            </Card>

            <div className="flex gap-6 items-start">
              <div className="flex-1 min-w-0">
                <Card size="sm" className="!p-0">
              <div
                ref={mapaEditorRef}
                className="relative cursor-crosshair select-none rounded-lg overflow-hidden bg-muted/30"
                style={{ aspectRatio: mapaImagen ? undefined : "4/3" }}
                onClick={(e) => {
                  if (nuevaSeccionPos) return
                  if (arrastrandoSeccion) return
                  const rect = e.currentTarget.getBoundingClientRect()
                  const x = parseFloat(((e.clientX - rect.left) / rect.width * 100).toFixed(1))
                  const y = parseFloat(((e.clientY - rect.top) / rect.height * 100).toFixed(1))
                  setNuevaSeccionPos({ x, y })
                  setFormSeccion({ nombre: "", descripcion: "", categoria: "", icono: "📍" })
                }}
                onMouseMove={(e) => {
                  if (!arrastrandoSeccion) return
                  didDrag.current = true
                  const rect = e.currentTarget.getBoundingClientRect()
                  const x = parseFloat(((e.clientX - rect.left) / rect.width * 100).toFixed(1))
                  const y = parseFloat(((e.clientY - rect.top) / rect.height * 100).toFixed(1))
                  arrastrandoCoords.current = `${x},${y}`
                  setSecciones(prev => prev.map(p => p.id === arrastrandoSeccion.id ? { ...p, x, y } : p))
                }}
                onMouseUp={async () => {
                  if (!arrastrandoSeccion || !didDrag.current) { setArrastrandoSeccion(null); didDrag.current = false; return }
                  const [x, y] = arrastrandoCoords.current.split(",").map(Number)
                  try {
                    await api.updateSeccion(arrastrandoSeccion.id, { x, y })
                  } catch (err) { toast.error(getErrorMessage(err)) }
                  setArrastrandoSeccion(null)
                  didDrag.current = false
                }}
                onMouseLeave={() => {
                  if (arrastrandoSeccion && didDrag.current) {
                    setArrastrandoSeccion(null)
                    didDrag.current = false
                  }
                }}
              >
                {mapaImagen ? (
                  <img src={mapaImagen} alt="Mapa" className="w-full h-full object-contain pointer-events-none" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-sm text-muted-foreground">
                    Haz clic en la imagen o carga una para comenzar
                  </div>
                )}
                {secciones.map(s => (
                  <button
                    key={s.id}
                    onMouseDown={(e) => {
                      e.stopPropagation()
                      e.preventDefault()
                      didDrag.current = false
                      setArrastrandoSeccion(s)
                      arrastrandoCoords.current = `${s.x},${s.y}`
                    }}
                    onClick={(e) => {
                      e.stopPropagation()
                      if (didDrag.current) return
                      setEditandoSeccion(s)
                      setFormSeccion({ nombre: s.nombre, descripcion: s.descripcion ?? "", categoria: s.categoria, icono: s.icono })
                    }}
                    className={`absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-0.5 group hover:z-10 ${arrastrandoSeccion?.id === s.id ? "z-20 scale-110" : ""}`}
                    style={{ left: `${s.x}%`, top: `${s.y}%`, cursor: "grab" }}
                  >
                    <span className="text-lg leading-none transition-transform group-hover:scale-125 pointer-events-none">{s.icono || "📍"}</span>
                    <span className="text-[9px] font-medium leading-tight text-center bg-background/90 rounded px-1 py-px max-w-[80px] truncate border pointer-events-none">{s.nombre}</span>
                  </button>
                ))}
                {nuevaSeccionPos && (
                  <div
                    className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-0.5 z-10 pointer-events-none"
                    style={{ left: `${nuevaSeccionPos.x}%`, top: `${nuevaSeccionPos.y}%` }}
                  >
                    <span className="text-lg leading-none animate-pulse">📍</span>
                  </div>
                )}
              </div>
            </Card>
              </div>

            <Card size="sm" className="overflow-hidden !p-0 w-60 shrink-0">
              <PuntosTable
                secciones={secciones}
                categorias={categoriasSecciones}
                selection={seccionesSelection}
                onSelectionChange={setSeccionesSelection}
                onEdit={(s) => {
                  setEditandoSeccion(s)
                  setFormSeccion({ nombre: s.nombre, descripcion: s.descripcion ?? "", categoria: s.categoria, icono: s.icono })
                }}
                onDelete={async (ids) => {
                  try {
                    await Promise.all(ids.map(id => api.deleteSeccion(id)))
                    toast.success(ids.length === 1 ? "Sección eliminada" : `${ids.length} secciones eliminadas`)
                    loadData()
                  } catch (err) { toast.error(getErrorMessage(err)) }
                }}
              />
            </Card>
            </div>
          </div>

          <Dialog open={nuevaSeccionPos !== null} onOpenChange={(o) => { if (!o) setNuevaSeccionPos(null) }}>
            <DialogContent className="sm:max-w-sm">
              <DialogHeader>
                <DialogTitle>Nueva sección</DialogTitle>
                <DialogDescription>Posición: {nuevaSeccionPos?.x}%, {nuevaSeccionPos?.y}%</DialogDescription>
              </DialogHeader>
              <div className="flex flex-col gap-3">
                <Input value={formSeccion.nombre} onChange={e => setFormSeccion(f => ({ ...f, nombre: e.target.value }))} placeholder="Nombre" />
                <Select value={formSeccion.categoria} onValueChange={(v) => setFormSeccion(f => ({ ...f, categoria: v }))}>
                  <SelectTrigger><SelectValue placeholder="Categoría" /></SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {categoriasSecciones.map(c => (
                        <SelectItem key={c.id} value={c.nombre}>
                          <span className="flex items-center gap-2">
                            <span className={`size-2 rounded-full ${c.color}`} />
                            {c.nombre}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
                <Input value={formSeccion.descripcion} onChange={e => setFormSeccion(f => ({ ...f, descripcion: e.target.value }))} placeholder="Descripción (opcional)" />
                <Input value={formSeccion.icono} onChange={e => setFormSeccion(f => ({ ...f, icono: e.target.value }))} placeholder="Icono (emoji)" maxLength={4} />
              </div>
              <DialogFooter>
                <div className="flex gap-2 justify-end">
                  <Button variant="outline" onClick={() => setNuevaSeccionPos(null)}>Cancelar</Button>
                  <Button onClick={async () => {
                    if (!nuevaSeccionPos || !formSeccion.nombre || !formSeccion.categoria) return
                    try {
                      await api.createSeccion({ nombre: formSeccion.nombre, descripcion: formSeccion.descripcion || undefined, categoria: formSeccion.categoria, x: nuevaSeccionPos.x, y: nuevaSeccionPos.y, icono: formSeccion.icono || "📍" })
                      toast.success("Sección creada")
                      setNuevaSeccionPos(null)
                      loadData()
                    } catch (err) { toast.error(getErrorMessage(err)) }
                  }}>Crear</Button>
                </div>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog open={!!editandoSeccion} onOpenChange={(o) => { if (!o) setEditandoSeccion(null) }}>
            <DialogContent className="sm:max-w-sm">
              <DialogHeader>
                <DialogTitle>Editar sección</DialogTitle>
              </DialogHeader>
              <div className="flex flex-col gap-3">
                <Input value={formSeccion.nombre} onChange={e => setFormSeccion(f => ({ ...f, nombre: e.target.value }))} placeholder="Nombre" />
                <Select value={formSeccion.categoria} onValueChange={(v) => setFormSeccion(f => ({ ...f, categoria: v }))}>
                  <SelectTrigger><SelectValue placeholder="Categoría" /></SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {categoriasSecciones.map(c => (
                        <SelectItem key={c.id} value={c.nombre}>
                          <span className="flex items-center gap-2">
                            <span className={`size-2 rounded-full ${c.color}`} />
                            {c.nombre}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
                <Input value={formSeccion.descripcion} onChange={e => setFormSeccion(f => ({ ...f, descripcion: e.target.value }))} placeholder="Descripción" />
                <Input value={formSeccion.icono} onChange={e => setFormSeccion(f => ({ ...f, icono: e.target.value }))} placeholder="Icono" maxLength={4} />
              </div>
              <DialogFooter>
                <div className="flex gap-2 justify-between w-full">
                  <Button variant="destructive" size="sm" onClick={async () => {
                    if (!editandoSeccion) return
                    try { await api.deleteSeccion(editandoSeccion.id); toast.success("Sección eliminada"); setEditandoSeccion(null); loadData() } catch (err) { toast.error(getErrorMessage(err)) }
                  }}>Eliminar</Button>
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={() => setEditandoSeccion(null)}>Cancelar</Button>
                    <Button onClick={async () => {
                      if (!editandoSeccion) return
                      try {
                        await api.updateSeccion(editandoSeccion.id, { nombre: formSeccion.nombre, descripcion: formSeccion.descripcion || undefined, categoria: formSeccion.categoria, icono: formSeccion.icono })
                        toast.success("Sección actualizada")
                        setEditandoSeccion(null)
                        loadData()
                      } catch (err) { toast.error(getErrorMessage(err)) }
                    }}>Guardar</Button>
                  </div>
                </div>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog open={categoriaDialog} onOpenChange={(o) => { if (!o) setCategoriaDialog(false) }}>
            <DialogContent className="sm:max-w-sm">
              <DialogHeader>
                <DialogTitle>{editandoCategoria ? "Editar categoría" : "Nueva categoría"}</DialogTitle>
              </DialogHeader>
              <div className="flex flex-col gap-3">
                <Input value={formCategoria.nombre} onChange={e => setFormCategoria(f => ({ ...f, nombre: e.target.value }))} placeholder="Nombre" />
                <Input value={formCategoria.descripcion} onChange={e => setFormCategoria(f => ({ ...f, descripcion: e.target.value }))} placeholder="Descripción (opcional)" />
                <Select value={formCategoria.color} onValueChange={(v) => setFormCategoria(f => ({ ...f, color: v }))}>
                  <SelectTrigger><SelectValue placeholder="Color" /></SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {COLORES.map(color => (
                        <SelectItem key={color} value={color}>
                          <span className="flex items-center gap-2">
                            <span className={`size-2.5 rounded-full ${color}`} />
                            {color}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>
              <DialogFooter>
                <div className="flex gap-2 justify-between w-full">
    <div className="min-w-0">
                    {editandoCategoria && (
                      <Button variant="destructive" size="sm" onClick={async () => {
                        try { await api.deleteCategoriaSeccion(editandoCategoria.id); toast.success("Categoría eliminada"); setCategoriaDialog(false); loadData() } catch (err) { toast.error(getErrorMessage(err)) }
                      }}>Eliminar</Button>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={() => setCategoriaDialog(false)}>Cancelar</Button>
                    <Button onClick={async () => {
                      if (!formCategoria.nombre) return
                      try {
                        if (editandoCategoria) {
                          await api.updateCategoriaSeccion(editandoCategoria.id, { nombre: formCategoria.nombre, descripcion: formCategoria.descripcion || undefined, color: formCategoria.color })
                          toast.success("Categoría actualizada")
                        } else {
                          await api.createCategoriaSeccion({ nombre: formCategoria.nombre, descripcion: formCategoria.descripcion || undefined, color: formCategoria.color })
                          toast.success("Categoría creada")
                        }
                        setCategoriaDialog(false)
                        loadData()
                      } catch (err) { toast.error(getErrorMessage(err)) }
                    }}>Guardar</Button>
                  </div>
                </div>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </TabsContent>
      </Tabs>

      <AlertDialog open={!!deleteTarget} onOpenChange={o => { if (!o) setDeleteTarget(null) }}>
        <AlertDialogContent size="sm">
          <AlertDialogHeader><AlertDialogTitle>Eliminar libro</AlertDialogTitle><AlertDialogDescription>¿Estás seguro? Si el libro tiene préstamos activos no se podrá eliminar.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel variant="outline">Cancelar</AlertDialogCancel><AlertDialogAction variant="destructive" onClick={handleDelete}>Eliminar</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={quitarCaratulasOpen} onOpenChange={setQuitarCaratulasOpen}>
        <AlertDialogContent size="sm">
          <AlertDialogHeader><AlertDialogTitle>Quitar todas las carátulas</AlertDialogTitle><AlertDialogDescription>¿Estás seguro? Se eliminará la asignación de carátula de todos los libros. Las imágenes en disco no se borran. Esta acción no se puede deshacer.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel variant="outline">Cancelar</AlertDialogCancel><AlertDialogAction variant="destructive" onClick={confirmarQuitarCaratulas}>Quitar todas</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={!!ejemplaresDialog} onOpenChange={(o) => { if (!o) setEjemplaresDialog(null) }}>
        <DialogContent className="sm:max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Ejemplares: {ejemplaresDialog?.titulo}</DialogTitle>
            <DialogDescription>Gestiona los ejemplares de este libro.</DialogDescription>
          </DialogHeader>
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-muted-foreground">{ejemplaresList.length} ejemplares</span>
            <div className="flex items-center gap-2">
              <Input type="number" min={1} max={100} value={ejemplaresCantidad}
                onChange={e => setEjemplaresCantidad(Number(e.target.value) || 1)}
                className="w-16 h-8 text-center text-sm" />
              <Button size="sm" variant="outline" onClick={handleAddEjemplar}><Plus data-icon="inline-start" />Agregar</Button>
            </div>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-28">Código</TableHead>
                <TableHead>Condición</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="w-20">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ejemplaresList.map(ej => (
                <TableRow key={ej.id}>
                  <TableCell className="font-mono text-xs">{ej.codigo}</TableCell>
                  <TableCell>
                    <Select
                      value={ej.condicion}
                      onValueChange={async (v) => {
                        try {
                          await api.updateEjemplar(ej.id, { condicion: v })
                          setEjemplaresList(prev => prev.map(e => e.id === ej.id ? {
                            ...e,
                            condicion: v,
                            estado: v === "perdido" ? "no_disponible" : ej.condicion === "perdido" ? "disponible" : e.estado
                          } : e))
                          toast.success("Condición actualizada")
                        } catch (err) { toast.error(getErrorMessage(err)) }
                      }}
                    >
                      <SelectTrigger className="w-28 h-7 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="bueno">Bueno</SelectItem>
                        <SelectItem value="regular">Regular</SelectItem>
                        <SelectItem value="dañado">Dañado</SelectItem>
                        <SelectItem value="perdido">Perdido</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    {ej.estado === "reservado" || ej.estado === "prestado" ? (
                      <Badge variant="outline" className="text-xs">
                        {ej.estado === "reservado" ? "Reservado" : "Prestado"}
                      </Badge>
                    ) : (
                      <Select
                        value={ej.estado}
                        onValueChange={async (v) => {
                          try {
                            await api.updateEjemplar(ej.id, { estado: v })
                            setEjemplaresList(prev => prev.map(e => e.id === ej.id ? { ...e, estado: v } : e))
                            toast.success("Estado actualizado")
                          } catch (err) { toast.error(getErrorMessage(err)) }
                        }}
                      >
                        <SelectTrigger className="w-32 h-7 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="disponible">Disponible</SelectItem>
                          <SelectItem value="no_disponible">No disponible</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  </TableCell>
                  <TableCell>
                    <Button size="icon-xs" variant="ghost" onClick={() => handleDeleteEjemplar(ej.id)}>
                      <Trash2 />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEjemplaresDialog(null)}>Cerrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
