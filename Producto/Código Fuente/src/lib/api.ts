import { getApiUrl, getApiHeaders, getServerUrl, getApiMode } from "./api-config"

async function request(path: string, options?: RequestInit) {
  const url = getApiUrl()
  const apiHeaders = getApiHeaders()
  const headers: Record<string, string> = { ...apiHeaders }
  if (options?.body) {
    headers["Content-Type"] = "application/json"
  }

  const res = await fetch(`${url}${path}`, {
    ...options,
    headers: { ...headers, ...options?.headers as Record<string, string> },
  })

  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: res.statusText }))
    throw new Error(error.message || "Error de conexión")
  }

  if (res.status === 204) return null
  const text = await res.text()
  if (!text) return null
  return JSON.parse(text)
}

export interface Usuario {
  id: string
  nombre_usuario: string
  rol: "admin" | "usuario" | "bibliotecario"
  email: string | null
  rut: string | null
  primer_nombre: string | null
  segundo_nombre: string | null
  apellido_paterno: string | null
  apellido_materno: string | null
  bio: string | null
  telefono: string | null
  direccion: string | null
  foto_perfil: string | null
  created_at: string
}

export interface Autor {
  id: number
  nombre: string
  biografia: string | null
  foto: string | null
  nacionalidad: string | null
  fecha_nacimiento: string | null
  created_at: string
  updated_at: string
}

export interface Genero {
  id: number
  nombre: string
}

export interface Etiqueta {
  id: number
  nombre: string
}

export interface Editorial {
  id: number
  nombre: string
  pais: string | null
}

export interface Resena {
  id: number
  usuario_id: string
  libro_id: number
  puntuacion: number
  comentario: string | null
  fotos: string | null
  created_at: string
  updated_at: string
  usuario?: {
    primer_nombre: string | null
    apellido_paterno: string | null
    foto_perfil: string | null
    nombre_usuario: string | null
  }
}

export interface PrestamoGrupo {
  id: number
  usuario_id: string
  nota_admin: string | null
  fecha_devolucion_esperada: string
  created_at: string
  updated_at: string
}

export interface Prestamo {
  id: number
  usuario_id: string
  libro_id: number | null
  ejemplar_id: number | null
  grupo_id: number | null
  fecha_prestamo: string
  fecha_devolucion_esperada: string
  fecha_devolucion_real: string | null
  estado: string
  created_at: string
  updated_at: string
}

export interface Lista {
  id: number
  nombre: string
  descripcion: string | null
  imagen: string | null
  usuario_id: string
  por_defecto: boolean
  publica: boolean
  created_at: string
  updated_at: string
  libros?: LibroConAutor[]
}

export interface Ejemplar {
  id: number
  libro_id: number
  codigo: string
  estado: string
  condicion: string
  notas: string | null
  foto_estado: string | null
  created_at: string
  updated_at: string
}

export interface CategoriaSeccion {
  id: number
  nombre: string
  descripcion: string | null
  color: string
  created_at: string
  updated_at: string
}

export interface NotificacionDB {
  id: number
  usuario_id: string
  titulo: string
  mensaje: string | null
  leida: boolean
  link: string | null
  created_at: string
  updated_at: string
}

export interface Seccion {
  id: number
  nombre: string
  descripcion: string | null
  categoria: string
  x: number
  y: number
  icono: string
  created_at: string
  updated_at: string
}

export interface LibroConAutor {
  id: number
  titulo: string
  autor_id: number
  autor: Autor
  sinopsis: string | null
  isbn: string | null
  anio_publicacion: number | null
  numero_paginas: number | null
  idioma: string | null
  caratula: string | null
  disponible: boolean
  stock: number
  created_at: string
  updated_at: string
  generos: { genero: Genero }[]
  etiquetas: { etiqueta: Etiqueta }[]
  editorial: Editorial
}

export const api = {
  login: async (
    nombre_usuario: string,
    _password: string
  ): Promise<Usuario> => {
    const usuarios = await request(
      `/usuario?nombre_usuario=eq.${encodeURIComponent(nombre_usuario)}&select=*`
    )
    if (!usuarios.length) throw new Error("Credenciales inválidas")
    return usuarios[0]
  },

  register: async (data: {
    nombre_usuario: string
    password_hash: string
  }): Promise<Usuario> => {
    const existing = await request(
      `/usuario?nombre_usuario=eq.${encodeURIComponent(data.nombre_usuario)}`
    ).catch(() => [])

    if (existing?.length) {
      throw new Error("El nombre de usuario ya está en uso")
    }

    const result = await request("/usuario", {
      method: "POST",
      body: JSON.stringify(data),
      headers: {
        "Content-Type": "application/json",
        Prefer: "return=representation",
      },
    })
    const usuario = Array.isArray(result) ? result[0] : result

    await request("/listas", {
      method: "POST",
      body: JSON.stringify({
        nombre: "Favoritos",
        descripcion: "Mis libros favoritos",
        usuario_id: usuario.id,
        por_defecto: true,
        publica: false,
      }),
    })

    await request("/listas", {
      method: "POST",
      body: JSON.stringify({
        nombre: "Por leer",
        descripcion: "Libros que quiero leer",
        usuario_id: usuario.id,
        por_defecto: true,
        publica: false,
      }),
    })

    await request("/listas", {
      method: "POST",
      body: JSON.stringify({
        nombre: "Leídos",
        descripcion: "Libros que ya he leído",
        usuario_id: usuario.id,
        por_defecto: true,
        publica: true,
      }),
    })

    // Queue for local sync
    request("/acciones_pendientes", {
      method: "POST",
      body: JSON.stringify({ accion: "registro", datos: { id: usuario.id, nombre_usuario: data.nombre_usuario, password_hash: data.password_hash } }),
      headers: { "Content-Type": "application/json", Prefer: "return=minimal" },
    }).catch(() => {})

    return usuario
  },

  updateProfile: async (
    id: string,
    data: Partial<Omit<Usuario, "id" | "nombre_usuario" | "created_at">>,
    nombre_usuario?: string
  ): Promise<Usuario> => {
    const result = await request(`/usuario?id=eq.${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
      headers: {
        "Content-Type": "application/json",
        Prefer: "return=representation",
      },
    })
    if (getApiMode() === "supabase") {
      api.encolarAccion("perfil_actualizar", { id, datos: data, _nombre_usuario: nombre_usuario }).catch(() => {})
    }
    return Array.isArray(result) ? result[0] : result
  },

  getLibros: async (): Promise<LibroConAutor[]> => {
    const result = await request(
      "/libros?select=*,autor:autores(*),editorial:editoriales(*),generos:libros_generos(genero:generos(*)),etiquetas:libros_etiquetas(etiqueta:etiquetas(*))&order=titulo"
    )
    const ejemplares = await request("/ejemplares?select=libro_id,estado,condicion")
    const stockMap = new Map<number, number>()
    for (const ej of (ejemplares as { libro_id: number; estado: string; condicion: string }[])) {
      if (ej.estado === "disponible" && ej.condicion !== "perdido") {
        stockMap.set(ej.libro_id, (stockMap.get(ej.libro_id) ?? 0) + 1)
      }
    }
    return (result as LibroConAutor[]).map((l) => ({ ...l, stock: stockMap.get(l.id) ?? 0 }))
  },

  getAutores: async (): Promise<Autor[]> => {
    return request("/autores?select=*&order=nombre")
  },

  getGeneros: async (): Promise<Genero[]> => {
    return request("/generos?select=*&order=nombre")
  },

  getEtiquetas: async (): Promise<Etiqueta[]> => {
    return request("/etiquetas?select=*&order=nombre")
  },

  getEditoriales: async (): Promise<Editorial[]> => {
    return request("/editoriales?select=*&order=nombre")
  },

  getResenas: async (libroId: number): Promise<Resena[]> => {
    return request(
      `/resenas?libro_id=eq.${libroId}&select=*,usuario:usuario(primer_nombre,apellido_paterno,foto_perfil,nombre_usuario)&order=created_at.desc`
    )
  },

  puedeResenar: async (libroId: number, usuarioId: string): Promise<boolean> => {
    try {
      const [prestamos, resenas] = await Promise.all([
        request(`/prestamos?usuario_id=eq.${usuarioId}&libro_id=eq.${libroId}&estado=eq.devuelto&select=id`),
        request(`/resenas?usuario_id=eq.${usuarioId}&libro_id=eq.${libroId}&select=id`),
      ])
      const devueltos = Array.isArray(prestamos) ? prestamos.length : 0
      const reseñados = Array.isArray(resenas) ? resenas.length : 0
      return devueltos > reseñados
    } catch { return false }
  },

  getMiResena: async (libroId: number, usuarioId: string): Promise<Resena | null> => {
    const result = await request(
      `/resenas?libro_id=eq.${libroId}&usuario_id=eq.${usuarioId}&select=*&order=created_at.desc`
    )
    return result?.[0] ?? null
  },

  getStats: async () => {
    const libros = await request("/libros?select=id")
    const usuarios = await request("/usuario?select=id")
    const prestamos = await request("/prestamos?select=estado")
    const ejemplares = await request("/ejemplares?select=id,estado")
    return {
      totalLibros: libros.length,
      totalStock: ejemplares.length,
      totalUsuarios: usuarios.length,
      prestamosActivos: (prestamos as { estado: string }[]).filter(
        (p) => p.estado === "activo"
      ).length,
      prestamosAtrasados: (prestamos as { estado: string }[]).filter(
        (p) => p.estado === "atrasado"
      ).length,
    }
  },

  getLibro: async (id: number): Promise<LibroConAutor | null> => {
    const result = await request(
      `/libros?id=eq.${id}&select=*,autor:autores(*),editorial:editoriales(*),generos:libros_generos(genero:generos(*)),etiquetas:libros_etiquetas(etiqueta:etiquetas(*))`
    )
    if (!result?.[0]) return null
    const ejemplares = await request(`/ejemplares?libro_id=eq.${id}&select=estado,condicion`)
    let stock = 0
    for (const ej of (ejemplares as { estado: string; condicion: string }[])) {
      if (ej.estado === "disponible" && ej.condicion !== "perdido") stock++
    }
    return { ...result[0], stock }
  },

  createResena: async (data: { usuario_id: string; libro_id: number; puntuacion: number; comentario?: string; fotos?: string }, nombre_usuario?: string) => {
    if (getApiMode() === "supabase") {
      // Create directly in Supabase so it appears immediately online
      const result = await request("/resenas", {
        method: "POST",
        body: JSON.stringify(data),
        headers: { "Content-Type": "application/json", Prefer: "return=representation" },
      })
      // Queue for local sync (with nombre_usuario for UUID resolution)
      api.encolarAccion("resena_crear", { ...data, _nombre_usuario: nombre_usuario }).catch(() => {})
      return Array.isArray(result) ? result[0] : result
    }
    const result = await request("/resenas", {
      method: "POST",
      body: JSON.stringify(data),
      headers: { "Content-Type": "application/json", Prefer: "return=representation" },
    })
    return Array.isArray(result) ? result[0] : result
  },

  updateResena: async (id: number, data: { puntuacion: number; comentario?: string; fotos?: string }, extras?: { usuario_id?: string; libro_id?: number; nombre_usuario?: string }) => {
    const result = await request(`/resenas?id=eq.${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
      headers: { "Content-Type": "application/json", Prefer: "return=representation" },
    })
    if (getApiMode() === "supabase") {
      api.encolarAccion("resena_editar", { id, ...data, _usuario_id: extras?.usuario_id, _libro_id: extras?.libro_id, _nombre_usuario: extras?.nombre_usuario }).catch(() => {})
    }
    return Array.isArray(result) ? result[0] : result
  },

  deleteResena: async (id: number, extras?: { usuario_id?: string; libro_id?: number; nombre_usuario?: string }) => {
    await request(`/resenas?id=eq.${id}`, { method: "DELETE" })
    if (getApiMode() === "supabase") {
      api.encolarAccion("resena_eliminar", { id, _usuario_id: extras?.usuario_id, _libro_id: extras?.libro_id, _nombre_usuario: extras?.nombre_usuario }).catch(() => {})
    }
  },

  createPrestamo: async (usuario_id: string, libro_id: number) => {
    const disponibles = await request(
      `/ejemplares?libro_id=eq.${libro_id}&estado=eq.disponible&condicion=not.eq.perdido&select=id&order=id`
    )
    if (!disponibles?.length) throw new Error("No hay ejemplares disponibles")
    const ej = (disponibles as { id: number }[])[0]
    const result = await request("/prestamos", {
      method: "POST",
      body: JSON.stringify({ usuario_id, libro_id, ejemplar_id: ej.id }),
      headers: { "Content-Type": "application/json", Prefer: "return=representation" },
    })
    return Array.isArray(result) ? result[0] : result
  },

  createLibro: async (data: {
    titulo: string
    autor_id: number
    editorial_id: number
    sinopsis?: string
    isbn?: string
    anio_publicacion?: number
    numero_paginas?: number
    idioma?: string
    caratula?: string | null
    genero_ids: number[]
    etiqueta_ids: number[]
  }) => {
    const { genero_ids, etiqueta_ids, ...libroData } = data
    const result = await request("/libros", {
      method: "POST",
      body: JSON.stringify(libroData),
      headers: {
        "Content-Type": "application/json",
        Prefer: "return=representation",
      },
    })
    const libro = Array.isArray(result) ? result[0] : result
    await Promise.all([
      ...genero_ids.map((gid) =>
        request("/libros_generos", {
          method: "POST",
          body: JSON.stringify({ libro_id: libro.id, genero_id: gid }),
        })
      ),
      ...etiqueta_ids.map((eid) =>
        request("/libros_etiquetas", {
          method: "POST",
          body: JSON.stringify({ libro_id: libro.id, etiqueta_id: eid }),
        })
      ),
    ])
    return libro
  },

  updateLibro: async (
    id: number,
    data: {
      titulo?: string
      autor_id?: number
      editorial_id?: number
      sinopsis?: string | null
      isbn?: string | null
      anio_publicacion?: number | null
      numero_paginas?: number | null
      idioma?: string | null
      caratula?: string | null
      disponible?: boolean
      genero_ids?: number[]
      etiqueta_ids?: number[]
    }
  ) => {
    const { genero_ids, etiqueta_ids, ...libroData } = data
    let libro: { id: number }
    if (Object.keys(libroData).length > 0) {
      const result = await request(`/libros?id=eq.${id}`, {
        method: "PATCH",
        body: JSON.stringify(libroData),
        headers: {
          "Content-Type": "application/json",
          Prefer: "return=representation",
        },
      })
      libro = (Array.isArray(result) ? result[0] : result) as { id: number }
    } else {
      libro = { id }
    }

    if (genero_ids) {
      await request(`/libros_generos?libro_id=eq.${id}`, {
        method: "DELETE",
      })
      for (const gid of genero_ids) {
        await request("/libros_generos", {
          method: "POST",
          body: JSON.stringify({ libro_id: id, genero_id: gid }),
        })
      }
    }

    if (etiqueta_ids) {
      await request(`/libros_etiquetas?libro_id=eq.${id}`, {
        method: "DELETE",
      })
      for (const eid of etiqueta_ids) {
        await request("/libros_etiquetas", {
          method: "POST",
          body: JSON.stringify({ libro_id: id, etiqueta_id: eid }),
        })
      }
    }

    return libro
  },

  deleteLibro: async (id: number) => {
    return request(`/libros?id=eq.${id}`, { method: "DELETE" })
  },

  getEjemplares: async (libroId: number): Promise<Ejemplar[]> => {
    return request(`/ejemplares?libro_id=eq.${libroId}&select=*&order=id`)
  },

  getEjemplarByCodigo: async (codigo: string): Promise<(Ejemplar & { libro: LibroConAutor }) | null> => {
    const result = await request(
      `/ejemplares?codigo=eq.${encodeURIComponent(codigo)}&select=*,libro:libros(*,autor:autores(*),editorial:editoriales(*))`
    )
    if (!result?.[0]) return null
    return result[0]
  },

  createEjemplares: async (libroId: number, cantidad: number): Promise<void> => {
    for (let i = 0; i < cantidad; i++) {
      await request("/ejemplares", {
        method: "POST",
        body: JSON.stringify({ libro_id: libroId }),
      })
    }
  },

  updateEjemplar: async (id: number, data: { estado?: string; condicion?: string; notas?: string | null }) => {
    const result = await request(`/ejemplares?id=eq.${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
      headers: { "Content-Type": "application/json", Prefer: "return=representation" },
    })
    return Array.isArray(result) ? result[0] : result
  },

  deleteEjemplar: async (id: number) => {
    return request(`/ejemplares?id=eq.${id}`, { method: "DELETE" })
  },

  getPrestamoByEjemplar: async (ejemplarId: number): Promise<{ usuario_id: string } | null> => {
    const result = await request(`/prestamos?ejemplar_id=eq.${ejemplarId}&estado=eq.activo&select=usuario_id`)
    return result?.[0] ?? null
  },

  crearPrestamoBatch: async (data: { usuario_id: string; libro_ids: Record<number, number>; fecha_devolucion?: string }): Promise<{ grupo_id: number; creados: number }> => {
    // Queue for local sync
    api.encolarAccion("crear_pedido", data as unknown as Record<string, unknown>).catch(() => {})
    const grupo = await request("/prestamos_grupo", {
      method: "POST",
      body: JSON.stringify({
        usuario_id: data.usuario_id,
        ...(data.fecha_devolucion ? { fecha_devolucion_esperada: data.fecha_devolucion } : {}),
      }),
      headers: { "Content-Type": "application/json", Prefer: "return=representation" },
    })
    const grupoId = (Array.isArray(grupo) ? grupo[0] : grupo).id
    let creados = 0

    for (const [libroIdStr, cantidad] of Object.entries(data.libro_ids)) {
      const libroId = Number(libroIdStr)
      for (let i = 0; i < cantidad; i++) {
        try {
          const prestamoData: Record<string, unknown> = { usuario_id: data.usuario_id, libro_id: libroId, grupo_id: grupoId }
          if (data.fecha_devolucion) prestamoData.fecha_devolucion_esperada = data.fecha_devolucion
          await request("/prestamos", {
            method: "POST",
            body: JSON.stringify(prestamoData),
          })
          creados++
        } catch { /* skip */ }
      }
    }
    return { grupo_id: grupoId, creados }
  },

  asignarEjemplar: async (prestamoId: number, ejemplarId: number) => {
    const result = await request(`/prestamos?id=eq.${prestamoId}`, {
      method: "PATCH",
      body: JSON.stringify({ ejemplar_id: ejemplarId }),
      headers: { "Content-Type": "application/json", Prefer: "return=representation" },
    })
    return Array.isArray(result) ? result[0] : result
  },

  getEjemplaresDisponibles: async (libroId: number) => {
    return request(`/ejemplares?libro_id=eq.${libroId}&estado=in.(disponible,reservado)&condicion=not.eq.perdido&select=id,codigo&order=id`)
  },

  devolverPrestamo: async (prestamoId: number) => {
    const result = await request(`/prestamos?id=eq.${prestamoId}`, {
      method: "PATCH",
      body: JSON.stringify({ estado: "devuelto", fecha_devolucion_real: new Date().toISOString() }),
      headers: { "Content-Type": "application/json", Prefer: "return=representation" },
    })
    return Array.isArray(result) ? result[0] : result
  },

  buscarEjemplarPorCodigo: async (codigo: string) => {
    const result = await request(`/ejemplares?codigo=eq.${encodeURIComponent(codigo)}&select=*,libro:libros(titulo,autor:autores(nombre))`)
    return result?.[0] ?? null
  },

  buscarPrestamosActivosUsuario: async (username: string) => {
    return request(`/prestamos?usuario.nombre_usuario=eq.${encodeURIComponent(username)}&estado=in.(activo,atrasado)&select=*,usuario:usuario(id,nombre_usuario,primer_nombre,apellido_paterno),ejemplar:ejemplares(id,codigo,libro:libros(titulo))&order=created_at.desc`)
  },

  getPrestamoActivoByEjemplar: async (ejemplarId: number) => {
    return request(`/prestamos?ejemplar_id=eq.${ejemplarId}&estado=in.(activo,atrasado)&select=*,usuario:usuario(id,nombre_usuario),ejemplar:ejemplares(id,codigo,libro:libros(titulo))`)
  },

  getPrestamosPendientes: async (): Promise<(Prestamo & { ejemplar?: { id: number; codigo: string; libro_id: number }; usuario?: { id: string; nombre_usuario: string } })[]> => {
    return request("/prestamos?estado=eq.pendiente&select=*,ejemplar:ejemplares(id,codigo,libro_id),usuario:usuario(id,nombre_usuario)&order=created_at.asc")
  },

  getPrestamosPendientesGrouped: async (): Promise<{
    grupo_id: number | null
    usuario_id: string
    usuario_nombre: string
    fecha_devolucion: string
    created_at: string
    lugar_retiro: string | null
    codigo: string | null
    revisor_id: string | null
    revisor_nombre: string | null
    prestamos: (Prestamo & { libro?: { titulo: string; caratula: string | null }; ejemplar?: { id: number; codigo: string } })[]
  }[]> => {
    const pendientes = await request("/prestamos?estado=in.(pendiente,en_revision,no_disponible)&select=*,libro:libros(titulo,caratula),usuario:usuario(id,nombre_usuario)&order=grupo_id,id")
    const gruposMap = new Map<string, {
      grupo_id: number | null
      usuario_id: string
      usuario_nombre: string
      fecha_devolucion: string
      nota_admin: string | null
      lugar_retiro: string | null
      codigo: string | null
      revisor_id: string | null
      revisor_nombre: string | null
      created_at: string
      prestamos: (Prestamo & { libro?: { titulo: string; caratula: string | null }; ejemplar?: { id: number; codigo: string } })[]
    }>()

    for (const p of pendientes) {
      const key = String(p.grupo_id ?? `solo_${p.id}`)
      if (!gruposMap.has(key)) {
        const grupo = await request(`/prestamos_grupo?id=eq.${p.grupo_id}&select=*,revisor:usuario(nombre_usuario,primer_nombre,apellido_paterno)`).catch(() => [])
        const g = grupo?.[0]
        gruposMap.set(key, {
          grupo_id: p.grupo_id,
          usuario_id: p.usuario_id,
          usuario_nombre: p.usuario?.nombre_usuario ?? "—",
          nota_admin: g?.nota_admin ?? null,
          lugar_retiro: g?.lugar_retiro ?? null,
          codigo: g?.codigo ?? null,
          revisor_id: g?.revisor_id ?? null,
          revisor_nombre: g?.revisor ? `${g.revisor.primer_nombre ?? ""} ${g.revisor.apellido_paterno ?? ""}`.trim() || g.revisor.nombre_usuario : null,
          fecha_devolucion: g?.fecha_devolucion_esperada ?? p.fecha_devolucion_esperada,
          created_at: g?.created_at ?? p.created_at,
          prestamos: [],
        })
      }
      gruposMap.get(key)!.prestamos.push(p)
    }
    return Array.from(gruposMap.values())
  },

  getPrestamosPorEntregar: async (): Promise<{
    grupo_id: number | null
    usuario_id: string
    usuario_nombre: string
    lugar_retiro: string | null
    codigo: string | null
    prestamos: (Prestamo & { libro?: { titulo: string }; ejemplar?: { id: number; codigo: string } })[]
  }[]> => {
    const porEntregar = await request("/prestamos?estado=eq.por_entregar&select=*,libro:libros(titulo),usuario:usuario(id,nombre_usuario),ejemplar:ejemplares(id,codigo)&order=grupo_id,id")
    const gruposMap = new Map<string, {
      grupo_id: number | null
      usuario_id: string
      usuario_nombre: string
      lugar_retiro: string | null
      codigo: string | null
      prestamos: (Prestamo & { libro?: { titulo: string }; ejemplar?: { id: number; codigo: string } })[]
    }>()

    for (const p of porEntregar) {
      const key = String(p.grupo_id ?? `solo_${p.id}`)
      if (!gruposMap.has(key)) {
        const grupo = await request(`/prestamos_grupo?id=eq.${p.grupo_id}&select=lugar_retiro,codigo`).catch(() => [])
        const g = grupo?.[0]
        gruposMap.set(key, {
          grupo_id: p.grupo_id,
          usuario_id: p.usuario_id,
          usuario_nombre: p.usuario?.nombre_usuario ?? "—",
          lugar_retiro: g?.lugar_retiro ?? null,
          codigo: g?.codigo ?? null,
          prestamos: [],
        })
      }
      gruposMap.get(key)!.prestamos.push(p)
    }
    return Array.from(gruposMap.values())
  },

  getPrestamosUsuario: async (usuarioId: string): Promise<Prestamo[]> => {
    return request(`/prestamos?usuario_id=eq.${encodeURIComponent(usuarioId)}&select=*&order=created_at.desc`)
  },

  getSolicitudesUsuario: async (usuarioId: string): Promise<{
    grupo_id: number | null
    nota_admin: string | null
    lugar_retiro: string | null
    codigo: string | null
    fecha_devolucion: string | null
    created_at: string
    estado: string
    prestamos: (Prestamo & { libro?: { titulo: string; caratula: string | null }; ejemplar?: { id: number; codigo: string } })[]
  }[]> => {
    const prestamos = await request(`/prestamos?usuario_id=eq.${encodeURIComponent(usuarioId)}&select=*,libro:libros(titulo,caratula),ejemplar:ejemplares(id,codigo)&order=created_at.desc`)
    const grupos = new Set((prestamos as { grupo_id: number | null }[]).filter(p => p.grupo_id).map(p => String(p.grupo_id)))
    const notasMap = new Map<string, string>()
    const lugaresMap = new Map<string, string>()
    const fechasMap = new Map<string, string>()
    const codigosMap = new Map<string, string>()
    for (const gid of grupos) {
      const g = await request(`/prestamos_grupo?id=eq.${gid}&select=nota_admin,lugar_retiro,fecha_devolucion_esperada,codigo`).catch(() => [])
      if (g?.[0]?.nota_admin) notasMap.set(gid, g[0].nota_admin)
      if (g?.[0]?.lugar_retiro) lugaresMap.set(gid, g[0].lugar_retiro)
      if (g?.[0]?.fecha_devolucion_esperada) fechasMap.set(gid, g[0].fecha_devolucion_esperada)
      if (g?.[0]?.codigo) codigosMap.set(gid, g[0].codigo)
    }
    const gruposMap = new Map<string, {
      grupo_id: number | null
      nota_admin: string | null
      lugar_retiro: string | null
      codigo: string | null
      fecha_devolucion: string | null
      created_at: string
      estado: string
      prestamos: typeof prestamos
    }>()

    for (const p of prestamos) {
      const key = String(p.grupo_id ?? `solo_${p.id}`)
      if (!gruposMap.has(key)) {
        gruposMap.set(key, {
          grupo_id: p.grupo_id,
          nota_admin: notasMap.get(key) ?? null,
          lugar_retiro: lugaresMap.get(key) ?? null,
          codigo: codigosMap.get(key) ?? null,
          fecha_devolucion: fechasMap.get(key) ?? p.fecha_devolucion_esperada,
          created_at: p.created_at,
          estado: "pendiente",
          prestamos: [],
        })
      }
      const g = gruposMap.get(key)!
      g.prestamos.push(p)
      const estados: string[] = g.prestamos.map((x: { estado: string }) => x.estado)
      if (estados.some((e: string) => e === "solicita_aprobacion")) g.estado = "solicita_aprobacion"
      else if (estados.some((e: string) => e === "en_revision" || e === "pendiente")) g.estado = estados.find((e: string) => e === "en_revision") ?? "pendiente"
      else if (estados.every((e: string) => e === "activo")) g.estado = "activo"
      else if (estados.every((e: string) => e === "rechazado")) g.estado = "rechazado"
      else if (estados.every((e: string) => e === "devuelto")) g.estado = "devuelto"
      else g.estado = "parcial"
    }
    return Array.from(gruposMap.values())
  },

  aprobarPrestamo: async (id: number) => {
    const result = await request(`/prestamos?id=eq.${id}`, {
      method: "PATCH",
      body: JSON.stringify({ estado: "activo" }),
      headers: { "Content-Type": "application/json", Prefer: "return=representation" },
    })
    return Array.isArray(result) ? result[0] : result
  },

  rechazarPrestamo: async (id: number) => {
    const result = await request(`/prestamos?id=eq.${id}`, {
      method: "PATCH",
      body: JSON.stringify({ estado: "rechazado" }),
      headers: { "Content-Type": "application/json", Prefer: "return=representation" },
    })
    return Array.isArray(result) ? result[0] : result
  },

  aprobarGrupo: async (grupoId: number) => {
    await request(`/prestamos?grupo_id=eq.${grupoId}&estado=in.(pendiente,en_revision)`, {
      method: "PATCH",
      body: JSON.stringify({ estado: "activo" }),
    })
  },

  rechazarGrupo: async (grupoId: number) => {
    await request(`/prestamos?grupo_id=eq.${grupoId}&estado=in.(pendiente,en_revision)`, {
      method: "PATCH",
      body: JSON.stringify({ estado: "rechazado" }),
    })
  },

  revisarGrupo: async (grupoId: number, revisorId?: string) => {
    if (revisorId) {
      await request(`/prestamos_grupo?id=eq.${grupoId}`, {
        method: "PATCH",
        body: JSON.stringify({ revisor_id: revisorId }),
      }).catch(() => {})
    }
    await request(`/prestamos?grupo_id=eq.${grupoId}&estado=eq.pendiente`, {
      method: "PATCH",
      body: JSON.stringify({ estado: "en_revision" }),
    })
  },

  marcarNoDisponible: async (prestamoId: number) => {
    await request(`/prestamos?id=eq.${prestamoId}`, {
      method: "PATCH",
      body: JSON.stringify({ estado: "no_disponible" }),
    })
  },

  desmarcarNoDisponible: async (prestamoId: number) => {
    await request(`/prestamos?id=eq.${prestamoId}`, {
      method: "PATCH",
      body: JSON.stringify({ estado: "en_revision" }),
    })
  },

  solicitarAprobacion: async (grupoId: number, nota?: string, lugar_retiro?: string) => {
    const params: Record<string, string> = {}
    if (nota) params.nota_admin = nota
    if (lugar_retiro) params.lugar_retiro = lugar_retiro
    if (Object.keys(params).length > 0) {
      await request(`/prestamos_grupo?id=eq.${grupoId}`, {
        method: "PATCH",
        body: JSON.stringify(params),
      }).catch(() => {})
    }
    await request(`/prestamos?grupo_id=eq.${grupoId}&estado=in.(en_revision,pendiente)&ejemplar_id=is.null`, {
      method: "PATCH",
      body: JSON.stringify({ estado: "no_disponible" }),
    }).catch(() => {})
    const noDisponibles = await request(`/prestamos?grupo_id=eq.${grupoId}&estado=eq.no_disponible&select=id`)
    if (noDisponibles && (noDisponibles as any[]).length > 0) {
      await request(`/prestamos?grupo_id=eq.${grupoId}&estado=eq.no_disponible`, {
        method: "PATCH",
        body: JSON.stringify({ estado: "solicita_aprobacion" }),
      })
    } else {
      await request(`/prestamos?grupo_id=eq.${grupoId}&estado=in.(en_revision,pendiente)`, {
        method: "PATCH",
        body: JSON.stringify({ estado: "por_entregar" }),
      })
    }
  },

  aceptarParcial: async (grupoId: number) => {
    await request(`/prestamos?grupo_id=eq.${grupoId}&estado=in.(pendiente,en_revision)&ejemplar_id=is.null`, {
      method: "PATCH",
      body: JSON.stringify({ estado: "rechazado" }),
    })
    await request(`/prestamos?grupo_id=eq.${grupoId}&estado=in.(solicita_aprobacion)`, {
      method: "PATCH",
      body: JSON.stringify({ estado: "no_disponible" }),
    })
    await request(`/prestamos?grupo_id=eq.${grupoId}&estado=eq.en_revision&ejemplar_id=not.is.null`, {
      method: "PATCH",
      body: JSON.stringify({ estado: "por_entregar" }),
    })
  },

  entregarPedido: async (grupoId: number) => {
    await request(`/prestamos?grupo_id=eq.${grupoId}&estado=eq.por_entregar`, {
      method: "PATCH",
      body: JSON.stringify({ estado: "activo" }),
    })
  },

  generarPedidoPDF: async (grupoId: number, usuarioId?: string): Promise<string> => {
    const body: Record<string, unknown> = { grupoId }
    if (usuarioId) body.usuarioId = usuarioId
    const res = await fetch(`${getServerUrl()}/pedido-pdf`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
    if (!res.ok) throw new Error("Error al generar PDF")
    const data = await res.json()
    return data.url
  },

  rechazarParcial: async (grupoId: number) => {
    await request(`/prestamos?grupo_id=eq.${grupoId}&estado=in.(pendiente,en_revision,solicita_aprobacion,no_disponible)`, {
      method: "PATCH",
      body: JSON.stringify({ estado: "rechazado" }),
    })
  },

  createAutor: async (data: { nombre: string; nacionalidad?: string; fecha_nacimiento?: string }): Promise<Autor> => {
    const result = await request("/autores", {
      method: "POST",
      body: JSON.stringify(data),
      headers: {
        "Content-Type": "application/json",
        Prefer: "return=representation",
      },
    })
    return Array.isArray(result) ? result[0] : result
  },

  createEditorial: async (data: { nombre: string; pais?: string }): Promise<Editorial> => {
    const result = await request("/editoriales", {
      method: "POST",
      body: JSON.stringify(data),
      headers: {
        "Content-Type": "application/json",
        Prefer: "return=representation",
      },
    })
    return Array.isArray(result) ? result[0] : result
  },

  deleteAutor: async (id: number) => {
    return request(`/autores?id=eq.${id}`, { method: "DELETE" })
  },

  updateAutor: async (id: number, data: { nombre?: string; nacionalidad?: string | null; fecha_nacimiento?: string | null; biografia?: string | null }) => {
    const result = await request(`/autores?id=eq.${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
      headers: { "Content-Type": "application/json", Prefer: "return=representation" },
    })
    return Array.isArray(result) ? result[0] : result
  },

  createGenero: async (nombre: string) => {
    const result = await request("/generos", {
      method: "POST",
      body: JSON.stringify({ nombre }),
      headers: { "Content-Type": "application/json", Prefer: "return=representation" },
    })
    return Array.isArray(result) ? result[0] : result
  },

  updateGenero: async (id: number, nombre: string) => {
    const result = await request(`/generos?id=eq.${id}`, {
      method: "PATCH",
      body: JSON.stringify({ nombre }),
      headers: { "Content-Type": "application/json", Prefer: "return=representation" },
    })
    return Array.isArray(result) ? result[0] : result
  },

  deleteGenero: async (id: number) => {
    return request(`/generos?id=eq.${id}`, { method: "DELETE" })
  },

  createEtiqueta: async (nombre: string) => {
    const result = await request("/etiquetas", {
      method: "POST",
      body: JSON.stringify({ nombre }),
      headers: { "Content-Type": "application/json", Prefer: "return=representation" },
    })
    return Array.isArray(result) ? result[0] : result
  },

  updateEtiqueta: async (id: number, nombre: string) => {
    const result = await request(`/etiquetas?id=eq.${id}`, {
      method: "PATCH",
      body: JSON.stringify({ nombre }),
      headers: { "Content-Type": "application/json", Prefer: "return=representation" },
    })
    return Array.isArray(result) ? result[0] : result
  },

  deleteEtiqueta: async (id: number) => {
    return request(`/etiquetas?id=eq.${id}`, { method: "DELETE" })
  },

  updateEditorial: async (id: number, data: { nombre?: string; pais?: string | null }) => {
    const result = await request(`/editoriales?id=eq.${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
      headers: { "Content-Type": "application/json", Prefer: "return=representation" },
    })
    return Array.isArray(result) ? result[0] : result
  },

  deleteEditorial: async (id: number) => {
    return request(`/editoriales?id=eq.${id}`, { method: "DELETE" })
  },

  getListas: async (usuarioId: string): Promise<Lista[]> => {
    const result = await request(`/listas?usuario_id=eq.${encodeURIComponent(usuarioId)}&select=*&order=created_at.desc`)
    const libros = await request(`/listas_libros?select=lista_id,libro:libros(id,titulo,caratula)&lista_id=in.(${result.map((l: { id: number }) => l.id).join(",")})`)
    const librosMap = new Map()
    for (const row of libros) {
      const arr = librosMap.get(row.lista_id) || []
      arr.push(row.libro)
      librosMap.set(row.lista_id, arr)
    }
    return result.map((l: { id: number }) => ({ ...l, libros: librosMap.get(l.id) ?? [] }))
  },

  createLista: async (data: { nombre: string; descripcion?: string; imagen?: string | null; usuario_id: string; publica?: boolean }) => {
    const result = await request("/listas", {
      method: "POST",
      body: JSON.stringify(data),
      headers: { "Content-Type": "application/json", Prefer: "return=representation" },
    })
    if (getApiMode() === "supabase") {
      api.encolarAccion("lista_crear", data as unknown as Record<string, unknown>).catch(() => {})
    }
    return Array.isArray(result) ? result[0] : result
  },

  updateLista: async (id: number, data: { nombre?: string; descripcion?: string | null; imagen?: string | null; publica?: boolean }) => {
    const result = await request(`/listas?id=eq.${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
      headers: { "Content-Type": "application/json", Prefer: "return=representation" },
    })
    if (getApiMode() === "supabase") {
      api.encolarAccion("lista_editar", { id, ...data }).catch(() => {})
    }
    return Array.isArray(result) ? result[0] : result
  },

  deleteLista: async (id: number) => {
    return request(`/listas?id=eq.${id}`, { method: "DELETE" })
  },

  addLibroToLista: async (listaId: number, libroId: number) => {
    const result = await request("/listas_libros", {
      method: "POST",
      body: JSON.stringify({ lista_id: listaId, libro_id: libroId }),
    })
    if (getApiMode() === "supabase") {
      api.encolarAccion("lista_agregar", { lista_id: listaId, libro_id: libroId }).catch(() => {})
    }
    return result
  },

  removeLibroFromLista: async (listaId: number, libroId: number) => {
    const result = await request(`/listas_libros?lista_id=eq.${listaId}&libro_id=eq.${libroId}`, { method: "DELETE" })
    if (getApiMode() === "supabase") {
      api.encolarAccion("lista_quitar", { lista_id: listaId, libro_id: libroId }).catch(() => {})
    }
    return result
  },

  getUsuarios: async (): Promise<Usuario[]> => {
    return request("/usuario?select=*&order=nombre_usuario")
  },

  getUsuarioPorUsername: async (username: string): Promise<Usuario | null> => {
    const result = await request(
      `/usuario?nombre_usuario=eq.${encodeURIComponent(username)}&select=*`
    )
    return result?.[0] ?? null
  },

  getResenasPorUsuario: async (usuarioId: string): Promise<Resena[]> => {
    return request(
      `/resenas?usuario_id=eq.${usuarioId}&select=*,libro:libros(titulo,caratula)&order=created_at.desc`
    )
  },

  getConteoPrestamosDevueltos: async (usuarioId: string): Promise<number> => {
    const result = await request(
      `/prestamos?usuario_id=eq.${usuarioId}&estado=eq.devuelto&select=id`
    )
    return (result as any[])?.length ?? 0
  },

  getConteoLeidos: async (usuarioId: string): Promise<number> => {
    const listas = await request(`/listas?usuario_id=eq.${usuarioId}&nombre=eq.Leídos&select=id`).catch(() => [])
    const listaId = (listas as any[])?.[0]?.id
    if (!listaId) return 0
    const result = await request(`/listas_libros?lista_id=eq.${listaId}&select=libro_id`)
    return (result as any[])?.length ?? 0
  },

  getListaLeidos: async (usuarioId: string): Promise<Lista | null> => {
    const result = await request(`/listas?usuario_id=eq.${usuarioId}&nombre=eq.Leídos&select=*`)
    return result?.[0] ?? null
  },

  getListaPorLeer: async (usuarioId: string): Promise<Lista | null> => {
    const result = await request(`/listas?usuario_id=eq.${usuarioId}&nombre=eq.Por leer&select=*`)
    return result?.[0] ?? null
  },

  estaLeido: async (usuarioId: string, libroId: number): Promise<boolean> => {
    const lista = await request(`/listas?usuario_id=eq.${usuarioId}&nombre=eq.Leídos&select=id`).catch(() => [])
    const listaId = (lista as any[])?.[0]?.id
    if (!listaId) return false
    const result = await request(`/listas_libros?lista_id=eq.${listaId}&libro_id=eq.${libroId}&select=libro_id`).catch(() => [])
    return ((result as any[])?.length ?? 0) > 0
  },

  marcarComoLeido: async (usuarioId: string, libroId: number) => {
    if (getApiMode() === "supabase") {
      await request("/acciones_pendientes", {
        method: "POST",
        body: JSON.stringify({ accion: "marcar_leido", datos: { usuario_id: usuarioId, libro_id: libroId } }),
        headers: { "Content-Type": "application/json", Prefer: "return=minimal" },
      }).catch(() => {})
      return
    }
    let lista = await request(`/listas?usuario_id=eq.${usuarioId}&nombre=eq.Leídos&select=id`).catch(() => []) as any[]
    const listaId = lista?.[0]?.id
    if (!listaId) throw new Error("Lista Leídos no encontrada")
    await request("/listas_libros", {
      method: "POST",
      body: JSON.stringify({ lista_id: listaId, libro_id: libroId }),
    }).catch(() => {})
    const porLeer = await request(`/listas?usuario_id=eq.${usuarioId}&nombre=eq.Por leer&select=id`).catch(() => []) as any[]
    const porLeerId = porLeer?.[0]?.id
    if (porLeerId) {
      await request(`/listas_libros?lista_id=eq.${porLeerId}&libro_id=eq.${libroId}`, {
        method: "DELETE",
      }).catch(() => {})
    }
  },

  desmarcarComoLeido: async (usuarioId: string, libroId: number) => {
    const lista = await request(`/listas?usuario_id=eq.${usuarioId}&nombre=eq.Leídos&select=id`).catch(() => []) as any[]
    const listaId = lista?.[0]?.id
    if (!listaId) return
    await request(`/listas_libros?lista_id=eq.${listaId}&libro_id=eq.${libroId}`, {
      method: "DELETE",
    }).catch(() => {})
  },

  updateUserRole: async (id: string, rol: string) => {
    const result = await request(`/usuario?id=eq.${id}`, {
      method: "PATCH",
      body: JSON.stringify({ rol }),
      headers: { "Content-Type": "application/json", Prefer: "return=representation" },
    })
    return Array.isArray(result) ? result[0] : result
  },

  cambiarPassword: async (id: string, oldPassword: string, newPassword: string) => {
    const user = await request(`/usuario?id=eq.${id}&select=password_hash`)
    if (!user?.[0] || user[0].password_hash !== oldPassword) {
      throw new Error("La contraseña actual es incorrecta")
    }
    if (newPassword.length < 6) throw new Error("La nueva contraseña debe tener al menos 6 caracteres")
    await request(`/usuario?id=eq.${id}`, {
      method: "PATCH",
      body: JSON.stringify({ password_hash: newPassword }),
      headers: { "Content-Type": "application/json" },
    })
  },

  resetPassword: async (username: string, newPassword: string) => {
    if (newPassword.length < 6) throw new Error("La nueva contraseña debe tener al menos 6 caracteres")
    const result = await request(`/usuario?nombre_usuario=eq.${encodeURIComponent(username)}`, {
      method: "PATCH",
      body: JSON.stringify({ password_hash: newPassword }),
      headers: { "Content-Type": "application/json", Prefer: "return=representation" },
    })
    if (!result?.[0]) throw new Error("Usuario no encontrado")
    return result[0]
  },

  verifyRole: async (id: string): Promise<string | null> => {
    try {
      const result = await request(`/usuario?id=eq.${encodeURIComponent(id)}&select=rol`)
      return result?.[0]?.rol ?? null
    } catch {
      return null
    }
  },

  getSecciones: async (): Promise<Seccion[]> => {
    return request("/secciones?order=id")
  },

  createSeccion: async (data: { nombre: string; descripcion?: string; categoria: string; x: number; y: number; icono?: string }): Promise<Seccion> => {
    const result = await request("/secciones", {
      method: "POST",
      body: JSON.stringify(data),
      headers: { "Content-Type": "application/json", Prefer: "return=representation" },
    })
    return Array.isArray(result) ? result[0] : result
  },

  updateSeccion: async (id: number, data: Partial<{ nombre: string; descripcion: string; categoria: string; x: number; y: number; icono: string }>): Promise<Seccion> => {
    const result = await request(`/secciones?id=eq.${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
      headers: { "Content-Type": "application/json", Prefer: "return=representation" },
    })
    return Array.isArray(result) ? result[0] : result
  },

  deleteSeccion: async (id: number): Promise<void> => {
    await request(`/secciones?id=eq.${id}`, { method: "DELETE" })
  },

  getConfig: async (clave: string): Promise<string | null> => {
    const result = await request(`/configuracion?clave=eq.${encodeURIComponent(clave)}&select=valor`)
    return result?.[0]?.valor ?? null
  },

  setConfig: async (clave: string, valor: string): Promise<void> => {
    const existente = await request(`/configuracion?clave=eq.${encodeURIComponent(clave)}&select=id`)
    if (existente && (existente as any[]).length > 0) {
      await request(`/configuracion?id=eq.${(existente as any[])[0].id}`, {
        method: "PATCH",
        body: JSON.stringify({ valor }),
        headers: { "Content-Type": "application/json" },
      })
    } else {
      await request("/configuracion", {
        method: "POST",
        body: JSON.stringify({ clave, valor }),
        headers: { "Content-Type": "application/json" },
      })
    }
  },

  getCategoriasSecciones: async (): Promise<CategoriaSeccion[]> => {
    return request("/categorias_secciones?order=nombre")
  },

  createCategoriaSeccion: async (data: { nombre: string; descripcion?: string; color?: string }): Promise<CategoriaSeccion> => {
    const result = await request("/categorias_secciones", {
      method: "POST",
      body: JSON.stringify(data),
      headers: { "Content-Type": "application/json", Prefer: "return=representation" },
    })
    return Array.isArray(result) ? result[0] : result
  },

  updateCategoriaSeccion: async (id: number, data: { nombre?: string; descripcion?: string; color?: string }): Promise<CategoriaSeccion> => {
    const result = await request(`/categorias_secciones?id=eq.${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
      headers: { "Content-Type": "application/json", Prefer: "return=representation" },
    })
    return Array.isArray(result) ? result[0] : result
  },

  deleteCategoriaSeccion: async (id: number): Promise<void> => {
    await request(`/categorias_secciones?id=eq.${id}`, { method: "DELETE" })
  },

  getNotificaciones: async (usuarioId: string): Promise<NotificacionDB[]> => {
    return request(`/notificaciones?usuario_id=eq.${encodeURIComponent(usuarioId)}&order=created_at.desc`)
  },

  createNotificacion: async (data: { usuario_id: string; titulo: string; mensaje?: string; link?: string }): Promise<NotificacionDB> => {
    const result = await request("/notificaciones", {
      method: "POST",
      body: JSON.stringify(data),
      headers: { "Content-Type": "application/json", Prefer: "return=representation" },
    })
    return Array.isArray(result) ? result[0] : result
  },

  marcarNotificacionLeida: async (id: number): Promise<void> => {
    await request(`/notificaciones?id=eq.${id}`, {
      method: "PATCH",
      body: JSON.stringify({ leida: true }),
      headers: { "Content-Type": "application/json" },
    })
    if (getApiMode() === "supabase") {
      api.encolarAccion("notificacion_leida", { id }).catch(() => {})
    }
  },

  marcarTodasNotificacionesLeidas: async (usuarioId: string): Promise<void> => {
    await request(`/notificaciones?usuario_id=eq.${encodeURIComponent(usuarioId)}&leida=eq.false`, {
      method: "PATCH",
      body: JSON.stringify({ leida: true }),
      headers: { "Content-Type": "application/json" },
    })
    if (getApiMode() === "supabase") {
      api.encolarAccion("notificaciones_todas_leidas", { usuario_id: usuarioId }).catch(() => {})
    }
  },

  deleteNotificacion: async (id: number): Promise<void> => {
    await request(`/notificaciones?id=eq.${id}`, { method: "DELETE" })
    if (getApiMode() === "supabase") {
      api.encolarAccion("eliminar_notificacion", { id }).catch(() => {})
    }
  },

  getCarrito: async (usuarioId: string): Promise<{ libro_id: number; cantidad: number }[]> => {
    return request(`/carrito?usuario_id=eq.${encodeURIComponent(usuarioId)}&select=libro_id,cantidad`)
  },

  upsertCarrito: async (usuarioId: string, libroId: number, cantidad: number): Promise<void> => {
    if (cantidad <= 0) {
      await request(`/carrito?usuario_id=eq.${encodeURIComponent(usuarioId)}&libro_id=eq.${libroId}`, { method: "DELETE" })
    } else {
      await request("/carrito", {
        method: "POST",
        body: JSON.stringify({ usuario_id: usuarioId, libro_id: libroId, cantidad }),
        headers: { "Content-Type": "application/json", Prefer: "resolution=merge-duplicates" },
      })
    }
    if (getApiMode() === "supabase") {
      api.encolarAccion("agregar_carrito", { usuario_id: usuarioId, libro_id: libroId, cantidad }).catch(() => {})
    }
  },

  removeFromCarrito: async (usuarioId: string, libroId: number): Promise<void> => {
    await request(`/carrito?usuario_id=eq.${encodeURIComponent(usuarioId)}&libro_id=eq.${libroId}`, { method: "DELETE" })
    if (getApiMode() === "supabase") {
      api.encolarAccion("quitar_carrito", { usuario_id: usuarioId, libro_id: libroId }).catch(() => {})
    }
  },

  clearCarrito: async (usuarioId: string): Promise<void> => {
    await request(`/carrito?usuario_id=eq.${encodeURIComponent(usuarioId)}`, { method: "DELETE" })
    if (getApiMode() === "supabase") {
      api.encolarAccion("quitar_carrito", { usuario_id: usuarioId, libro_id: -1 }).catch(() => {})
    }
  },

  getMultas: async (usuarioId: string) => {
    return request(`/multas?usuario_id=eq.${encodeURIComponent(usuarioId)}&select=*&order=created_at.desc`)
  },

  getMultasPendientes: async (usuarioId: string) => {
    return request(`/multas?usuario_id=eq.${encodeURIComponent(usuarioId)}&pagada=eq.false&select=*,prestamo:prestamos(libro:libros(titulo))&order=created_at.desc`)
  },

  getTotalMultasPendientes: async (usuarioId: string): Promise<number> => {
    try {
      const multas = await request(`/multas?usuario_id=eq.${encodeURIComponent(usuarioId)}&pagada=eq.false&select=monto`)
      return (multas as any[]).reduce((s: number, m: any) => s + m.monto, 0)
    } catch { return 0 }
  },

  puedePedir: async (usuarioId: string): Promise<boolean> => {
    try {
      const multas = await request(`/multas?usuario_id=eq.${encodeURIComponent(usuarioId)}&pagada=eq.false&select=monto`)
      const total = (multas as any[]).reduce((s: number, m: any) => s + m.monto, 0)
      return total === 0
    } catch { return true }
  },

  crearOrdenPago: async (usuarioId: string, email?: string) => {
    // In Supabase/online mode, use Netlify Function (server-side HMAC signing)
    if (getApiMode() === "supabase") {
      const res = await fetch("/.netlify/functions/pago-crear", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ usuarioId }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Error" }))
        throw new Error((err as any).error || "Error al crear pago")
      }
      return res.json() as Promise<{ url: string }>
    }
    // Local mode: upload-server
    const res = await fetch(`${getServerUrl()}/pago/crear`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ usuarioId, email }),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: "Error" }))
      throw new Error((err as any).error || "Error al crear pago")
    }
    return res.json() as Promise<{ url: string }>
  },

  verificarPago: async (token: string) => {
    const isLocal = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"
    if (!isLocal) {
      const res = await fetch("/.netlify/functions/pago-verificar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      })
      return res.json() as Promise<{ status: number; paid: boolean }>
    }
    const res = await fetch(`${getServerUrl()}/pago/verificar`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    })
    return res.json() as Promise<{ status: number; paid: boolean }>
  },

  marcarMultaPagada: async (multaId: number) => {
    // Queue for local sync regardless of mode
    api.encolarAccion("multa_pagada", { multaId }).catch(() => {})
    if (getApiMode() === "supabase") {
      await request(`/multas?id=eq.${multaId}`, {
        method: "PATCH",
        body: JSON.stringify({ pagada: true }),
        headers: { "Content-Type": "application/json" },
      })
      return
    }
    const res = await fetch(`${getServerUrl()}/pago/marcar-pagada`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ multaId }),
    })
    if (!res.ok) throw new Error("Error al marcar multa")
  },

  verificarAtrasos: async () => {
    const isLocal = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"
    if (!isLocal) return { procesados: 0 } // Only relevant for local mode
    const res = await fetch(`${getServerUrl()}/prestamos/verificar-atrasos`, { method: "POST" })
    return res.json()
  },

  encolarAccion: async (accion: string, datos: Record<string, unknown>) => {
    await request("/acciones_pendientes", {
      method: "POST",
      body: JSON.stringify({ accion, datos }),
      headers: { "Content-Type": "application/json", Prefer: "return=minimal" },
    })
  },
}
