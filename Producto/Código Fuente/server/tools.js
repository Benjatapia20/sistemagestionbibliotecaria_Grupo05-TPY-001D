const POSTGREST = process.env.POSTGREST_URL || "http://postgrest:3000"

async function request(path, options = {}) {
  const res = await fetch(`${POSTGREST}${path}`, options)
  if (!res.ok) {
    const text = await res.text()
    throw new Error(text || res.statusText)
  }
  const text = await res.text()
  return text ? JSON.parse(text) : null
}

async function getLibros() {
  const libros = await request("/libros?select=*,autor:autores(nombre),generos:libros_generos(genero:generos(nombre)),etiquetas:libros_etiquetas(etiqueta:etiquetas(nombre))&order=titulo")
  return libros
}

async function getEjemplaresCount(libroId) {
  const ejemplares = await request(`/ejemplares?libro_id=eq.${libroId}&estado=eq.disponible&condicion=not.eq.perdido&select=id`)
  return ejemplares?.length ?? 0
}

/**
 * Tool definitions for Ollama function calling.
 * Each tool has a JSON Schema and a handler function.
 */
const TOOLS = [
  {
    type: "function",
    function: {
      name: "buscar_libros",
      description: "Busca libros en el catálogo por título, autor o género. Usa esta herramienta cuando el usuario pregunte por libros, autores o temas específicos.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Término de búsqueda (título, autor o género)" },
        },
        required: ["query"],
      },
    },
    handler: async ({ query }, ctx) => {
      const libros = await getLibros()
      const q = query.toLowerCase()
      const resultados = libros.filter(l =>
        l.titulo.toLowerCase().includes(q) ||
        l.autor?.nombre.toLowerCase().includes(q) ||
        l.generos?.some(g => g.genero?.nombre.toLowerCase().includes(q)) ||
        l.etiquetas?.some(e => e.etiqueta?.nombre.toLowerCase().includes(q))
      ).slice(0, 10)
      if (resultados.length === 0) return { encontrados: 0, mensaje: `No encontré libros que coincidan con "${query}".` }
      return {
        encontrados: resultados.length,
        libros: resultados.map(l => ({
          id: l.id,
          titulo: l.titulo,
          autor: l.autor?.nombre ?? "Desconocido",
          anio: l.anio_publicacion,
          generos: l.generos?.map(g => g.genero?.nombre).filter(Boolean) ?? [],
        })),
      }
    },
  },

  {
    type: "function",
    function: {
      name: "info_libro",
      description: "Obtiene información detallada de un libro específico, incluyendo stock disponible.",
      parameters: {
        type: "object",
        properties: {
          libro_id: { type: "number", description: "ID del libro" },
        },
        required: ["libro_id"],
      },
    },
    handler: async ({ libro_id }, ctx) => {
      const libro = await request(`/libros?id=eq.${libro_id}&select=*,autor:autores(nombre),editorial:editoriales(nombre)`).catch(() => null)
      if (!libro?.length) return { error: "Libro no encontrado" }
      const l = libro[0]
      const stock = await getEjemplaresCount(libro_id)
      return {
        id: l.id,
        titulo: l.titulo,
        autor: l.autor?.nombre ?? "Desconocido",
        editorial: l.editorial?.nombre,
        sinopsis: l.sinopsis,
        anio: l.anio_publicacion,
        paginas: l.numero_paginas,
        idioma: l.idioma,
        stock,
      }
    },
  },

  {
    type: "function",
    function: {
      name: "recomendar_libros",
      description: "Recomienda libros del catálogo, opcionalmente filtrados por género. Ideal para cuando el usuario pide sugerencias de lectura.",
      parameters: {
        type: "object",
        properties: {
          genero: { type: "string", description: "Género literario opcional para filtrar" },
        },
      },
    },
    handler: async ({ genero }, ctx) => {
      const libros = await getLibros()
      let recomendados = libros
      if (genero) {
        const g = genero.toLowerCase()
        recomendados = libros.filter(l => l.generos?.some(ge => ge.genero?.nombre.toLowerCase().includes(g)))
      }
      recomendados = recomendados.sort(() => 0.5 - Math.random()).slice(0, 5)
      const conStock = await Promise.all(recomendados.map(async l => ({ ...l, stock: await getEjemplaresCount(l.id) })))
      return {
        recomendaciones: conStock.filter(l => l.stock > 0).map(l => ({
          id: l.id,
          titulo: l.titulo,
          autor: l.autor?.nombre ?? "Desconocido",
          generos: l.generos?.map(g => g.genero?.nombre).filter(Boolean) ?? [],
          stock: l.stock,
        })),
      }
    },
  },

  {
    type: "function",
    function: {
      name: "mis_prestamos",
      description: "Obtiene los préstamos activos del usuario actual, incluyendo el lugar de retiro y fecha de devolución. Usa esta herramienta cuando el usuario pregunte 'qué libros tengo prestados', 'dónde retiro', 'cuándo debo devolver', etc.",
    },
    handler: async (_params, ctx) => {
      if (!ctx.userId) return { error: "No estás autenticado" }
      const prestamos = await request(`/prestamos?usuario_id=eq.${encodeURIComponent(ctx.userId)}&estado=eq.activo&select=*,libro:libros(titulo,autor:autores(nombre)),ejemplar:ejemplares(codigo),grupo:prestamos_grupo(lugar_retiro)`).catch(() => [])
      return {
        total: prestamos.length,
        prestamos: prestamos.map(p => ({
          id: p.id,
          titulo: p.libro?.titulo ?? "Desconocido",
          autor: p.libro?.autor?.nombre ?? "Desconocido",
          ejemplar: p.ejemplar?.codigo,
          lugar_retiro: p.grupo?.lugar_retiro ?? null,
          fecha_prestamo: p.created_at,
          devolucion: p.fecha_devolucion_esperada,
        })),
      }
    },
  },

  {
    type: "function",
    function: {
      name: "mis_listas",
      description: "Obtiene las listas de lectura del usuario (Favoritos, Por leer, etc).",
    },
    handler: async (_params, ctx) => {
      if (!ctx.userId) return { error: "No estás autenticado" }
      const listas = await request(`/listas?usuario_id=eq.${encodeURIComponent(ctx.userId)}&select=id,nombre,descripcion,libros:listas_libros(libro:libros(titulo,autor:autores(nombre)))`).catch(() => [])
      return {
        total: listas.length,
        listas: listas.map(l => ({
          id: l.id,
          nombre: l.nombre,
          descripcion: l.descripcion,
          libros: (l.libros ?? []).map(ll => ({
            titulo: ll.libro?.titulo ?? "Desconocido",
            autor: ll.libro?.autor?.nombre ?? "Desconocido",
          })),
        })),
      }
    },
  },

  {
    type: "function",
    function: {
      name: "secciones_biblioteca",
      description: "Obtiene las secciones y ubicaciones del mapa de la biblioteca. Usa esta herramienta cuando el usuario pregunte dónde está algo.",
    },
    handler: async (_params, ctx) => {
      const secciones = await request("/secciones?select=nombre,categoria,x,y&order=id").catch(() => [])
      const categorias = await request("/categorias_secciones?select=nombre,descripcion").catch(() => [])
      return { secciones, categorias }
    },
  },

  {
    type: "function",
    function: {
      name: "agregar_al_carrito",
      description: "Agrega un libro al carrito de préstamos. SIEMPRE debes pedir confirmación al usuario antes de usar esta herramienta. El usuario debe decir explícitamente 'sí' o 'agrega'.",
      parameters: {
        type: "object",
        properties: {
          libro_id: { type: "number", description: "ID del libro a agregar" },
          titulo: { type: "string", description: "Título del libro (para mostrar al usuario)" },
        },
        required: ["libro_id", "titulo"],
      },
    },
    handler: async ({ libro_id, titulo }, ctx) => {
      const stock = await getEjemplaresCount(libro_id)
      if (stock === 0) return { error: `"${titulo}" no tiene ejemplares disponibles`, requiere_confirmacion: false }
      return {
        requiere_confirmacion: true,
        accion: "agregar_al_carrito",
        libro_id,
        titulo,
        stock,
        mensaje: `¿Quieres agregar "${titulo}" al carrito? Hay ${stock} ejemplar(es) disponible(s).`,
      }
    },
  },

  {
    type: "function",
    function: {
      name: "estadisticas",
      description: "Obtiene estadísticas generales de la biblioteca.",
    },
    handler: async (_params, ctx) => {
      const libros = await request("/libros?select=id").catch(() => [])
      const usuarios = await request("/usuario?select=id").catch(() => [])
      const activos = await request("/prestamos?estado=eq.activo&select=id").catch(() => [])
      return {
        total_libros: libros.length,
        total_usuarios: usuarios.length,
        prestamos_activos: activos.length,
      }
    },
  },
]

function getToolMap() {
  const map = new Map()
  for (const t of TOOLS) {
    map.set(t.function.name, t)
  }
  return map
}

export { TOOLS, getToolMap, request, getLibros }
