const SUPABASE_URL = process.env.SUPABASE_URL || "https://xelzdjgoxwddgjqouywm.supabase.co/rest/v1"
const SUPABASE_KEY = process.env.SUPABASE_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhlbHpkamdveHdkZGdqcW91eXdtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYzODM3MzQsImV4cCI6MjA5MTk1OTczNH0.C3BIBRqIM1PSliMQPKFtJVMujFFDewNTr1TU8EU9Ask"
const GITHUB_TOKEN = process.env.GITHUB_TOKEN || ""
const MODEL = "openai/gpt-4o-mini"
const GH_API = "https://models.github.ai/inference/chat/completions"

async function request(path) {
  const res = await fetch(`${SUPABASE_URL}${path}`, {
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
  })
  if (!res.ok) { const t = await res.text(); throw new Error(t) }
  const text = await res.text()
  return text ? JSON.parse(text) : null
}

async function getLibros() {
  return request("/libros?select=*,autor:autores(nombre),generos:libros_generos(genero:generos(nombre)),etiquetas:libros_etiquetas(etiqueta:etiquetas(nombre))&order=titulo")
}

async function getEjemplaresCount(libroId) {
  const ej = await request(`/ejemplares?libro_id=eq.${libroId}&estado=eq.disponible&condicion=not.eq.perdido&select=id`)
  return ej?.length ?? 0
}

async function requestLibrosMatching(query) {
  const q = query.toLowerCase()
  const res = await fetch(`${SUPABASE_URL}/libros?select=id,titulo,autor:autores(nombre)&order=titulo`, {
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
  })
  const libros = await res.json()
  return (libros || []).filter(l => l.titulo.toLowerCase().includes(q)).slice(0, 5)
}

async function getStock(libroId) {
  return getEjemplaresCount(libroId)
}

// --- Tool definitions ---

const TOOLS = [
  {
    type: "function",
    function: {
      name: "buscar_libros",
      description: "Busca libros en el catálogo por título, autor o género.",
      parameters: {
        type: "object",
        properties: { query: { type: "string", description: "Término de búsqueda" } },
        required: ["query"],
      },
    },
    handler: async ({ query }) => {
      const libros = await getLibros()
      const q = query.toLowerCase()
      const r = libros.filter(l =>
        l.titulo.toLowerCase().includes(q) || l.autor?.nombre.toLowerCase().includes(q) ||
        l.generos?.some(g => g.genero?.nombre.toLowerCase().includes(q)) ||
        l.etiquetas?.some(e => e.etiqueta?.nombre.toLowerCase().includes(q))
      ).slice(0, 10)
      if (!r.length) return { encontrados: 0, mensaje: `No encontré libros que coincidan con "${query}".` }
      return { encontrados: r.length, libros: r.map(l => ({ id: l.id, titulo: l.titulo, autor: l.autor?.nombre ?? "Desconocido", anio: l.anio_publicacion, generos: l.generos?.map(g => g.genero?.nombre).filter(Boolean) ?? [] })) }
    },
  },
  {
    type: "function",
    function: {
      name: "info_libro",
      description: "Información detallada de un libro específico.",
      parameters: {
        type: "object",
        properties: { libro_id: { type: "number", description: "ID del libro" } },
        required: ["libro_id"],
      },
    },
    handler: async ({ libro_id }) => {
      const l = await request(`/libros?id=eq.${libro_id}&select=*,autor:autores(nombre),editorial:editoriales(nombre)`).catch(() => null)
      if (!l?.length) return { error: "Libro no encontrado" }
      const b = l[0]; const stock = await getEjemplaresCount(libro_id)
      return { id: b.id, titulo: b.titulo, autor: b.autor?.nombre ?? "Desconocido", editorial: b.editorial?.nombre, sinopsis: b.sinopsis, anio: b.anio_publicacion, paginas: b.numero_paginas, idioma: b.idioma, stock }
    },
  },
  {
    type: "function",
    function: {
      name: "recomendar_libros",
      description: "Recomienda libros del catálogo, opcionalmente por género.",
      parameters: {
        type: "object",
        properties: { genero: { type: "string", description: "Género literario opcional" } },
      },
    },
    handler: async ({ genero }) => {
      let libros = await getLibros()
      if (genero) { const g = genero.toLowerCase(); libros = libros.filter(l => l.generos?.some(ge => ge.genero?.nombre.toLowerCase().includes(g))) }
      const shuffled = libros.sort(() => 0.5 - Math.random()).slice(0, 8)
      const conStock = await Promise.all(shuffled.map(async l => ({ ...l, stock: await getEjemplaresCount(l.id) })))
      return { recomendaciones: conStock.filter(l => l.stock > 0).slice(0, 5).map(l => ({ id: l.id, titulo: l.titulo, autor: l.autor?.nombre ?? "Desconocido", generos: l.generos?.map(g => g.genero?.nombre).filter(Boolean) ?? [], stock: l.stock })) }
    },
  },
  {
    type: "function",
    function: {
      name: "mis_prestamos",
      description: "Préstamos activos del usuario, lugar de retiro y fecha de devolución.",
    },
    handler: async (_p, ctx) => {
      if (!ctx.userId) return { error: "No estás autenticado" }
      const p = await request(`/prestamos?usuario_id=eq.${encodeURIComponent(ctx.userId)}&estado=eq.activo&select=*,libro:libros(titulo,autor:autores(nombre)),ejemplar:ejemplares(codigo),grupo:prestamos_grupo(lugar_retiro)`).catch(() => [])
      return { total: p.length, prestamos: p.map(x => ({ id: x.id, titulo: x.libro?.titulo ?? "?", autor: x.libro?.autor?.nombre ?? "?", ejemplar: x.ejemplar?.codigo, lugar_retiro: x.grupo?.lugar_retiro ?? null, fecha_prestamo: x.created_at, devolucion: x.fecha_devolucion_esperada })) }
    },
  },
  {
    type: "function",
    function: {
      name: "mis_listas",
      description: "Listas de lectura del usuario (Favoritos, Por leer, etc).",
    },
    handler: async (_p, ctx) => {
      if (!ctx.userId) return { error: "No estás autenticado" }
      const listas = await request(`/listas?usuario_id=eq.${encodeURIComponent(ctx.userId)}&select=id,nombre,descripcion,libros:listas_libros(libro:libros(titulo,autor:autores(nombre)))`).catch(() => [])
      return { total: listas.length, listas: listas.map(l => ({ id: l.id, nombre: l.nombre, descripcion: l.descripcion, libros: (l.libros ?? []).map(ll => ({ titulo: ll.libro?.titulo ?? "?", autor: ll.libro?.autor?.nombre ?? "?" })) })) }
    },
  },
  {
    type: "function",
    function: {
      name: "secciones_biblioteca",
      description: "Secciones y ubicaciones del mapa de la biblioteca.",
    },
    handler: async () => {
      const s = await request("/secciones?select=nombre,categoria,x,y&order=id").catch(() => [])
      const c = await request("/categorias_secciones?select=nombre,descripcion").catch(() => [])
      return { secciones: s, categorias: c }
    },
  },
  {
    type: "function",
    function: {
      name: "agregar_al_carrito",
      description: "Agrega un libro al carrito. DEBES pedir confirmación antes de usar.",
      parameters: {
        type: "object",
        properties: {
          libro_id: { type: "number", description: "ID del libro" },
          titulo: { type: "string", description: "Título del libro" },
        },
        required: ["libro_id", "titulo"],
      },
    },
    handler: async ({ libro_id, titulo }) => {
      const stock = await getEjemplaresCount(libro_id)
      if (stock === 0) return { error: `"${titulo}" no tiene ejemplares disponibles`, requiere_confirmacion: false }
      return { requiere_confirmacion: true, accion: "agregar_al_carrito", libro_id, titulo, stock, mensaje: `¿Quieres agregar "${titulo}" al carrito? Hay ${stock} ejemplar(es) disponible(s).` }
    },
  },
  {
    type: "function",
    function: {
      name: "estadisticas",
      description: "Estadísticas generales de la biblioteca.",
    },
    handler: async () => {
      const [libros, usuarios, activos] = await Promise.all([
        request("/libros?select=id").catch(() => []),
        request("/usuario?select=id").catch(() => []),
        request("/prestamos?estado=eq.activo&select=id").catch(() => []),
      ])
      return { total_libros: libros.length, total_usuarios: usuarios.length, prestamos_activos: activos.length }
    },
  },
]

function getToolMap() {
  const map = new Map()
  for (const t of TOOLS) map.set(t.function.name, t)
  return map
}

// --- LLM client for GitHub Models ---

async function callModel(messages, tools) {
  if (!GITHUB_TOKEN) throw new Error("GITHUB_TOKEN no configurada")
  const res = await fetch(GH_API, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${GITHUB_TOKEN}`,
    },
    body: JSON.stringify({
      model: MODEL,
      messages,
      tools: tools?.map(t => ({ type: "function", function: t.function })),
      temperature: 0.3,
    }),
  })
  if (!res.ok) {
    const err = await res.text().catch(() => res.statusText)
    throw new Error(`GitHub Models error (${res.status}): ${err}`)
  }
  return res.json()
}

// --- System prompt ---

const SYSTEM_PROMPT = `[IDIOMA]
Siempre debes responder en español. NUNCA uses otro idioma.
[/IDIOMA]

Eres BiblioBot, el asistente virtual de la Biblioteca.

REGLAS OBLIGATORIAS:
- SOLO llama agregar_al_carrito cuando el usuario EXPLÍCITAMENTE pida agregar un libro al carrito.
- Cuando el usuario pregunte por sus préstamos: DEBES llamar mis_prestamos.
- Cuando el usuario pregunte dónde retirar: DEBES llamar mis_prestamos.
- Cuando el usuario pregunte por libros o recomendaciones: DEBES llamar buscar_libros o recomendar_libros.
- Cuando el usuario pregunte por ubicaciones: DEBES llamar secciones_biblioteca.
- SIEMPRE usa las herramientas. NUNCA inventes títulos, autores o disponibilidad.
- SOLO menciona libros que aparezcan en los resultados de las herramientas.
- Si la herramienta no encuentra libros, dile que no hay resultados en el catálogo.
- Sé conciso. Responde en español con tono amable.`

// --- Netlify handler ---

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" }
  }

  try {
    const { message, history = [], userId, userName } = JSON.parse(event.body)
    if (!message?.trim()) return { statusCode: 400, body: JSON.stringify({ error: "Mensaje vacío" }) }

    const toolMap = getToolMap()
    const ctx = { userId, userName }

    // --- Fast paths (direct DB queries, no LLM) ---

    // Info / synopsis query
    const infoQuery = /\b(?:de\s+qu[eé]\s+trata|sinopsis|info(?:rmaci[oó]n)?|detalles|descripci[oó]n|cu[eé]ntame\s+(?:de|sobre)|h[aá]blame\s+(?:de|sobre))\b/i.test(message)
    if (infoQuery) {
      let titulo = ""
      const mm = message.match(/(?:de\s+qu[eé]\s+trata|sinopsis\s+de|info\s+de|cu[eé]ntame\s+(?:de|sobre)|h[aá]blame\s+(?:de|sobre))\s+["\u00AB]?(.+?)["\u00BB]?\s*[?¡!]*\s*$/i)
      if (mm) { const t = mm[1].trim(); if (t.length > 2 && !/^(el|la|los|las|un|una)\s*$/i.test(t)) titulo = t }
      if (!titulo && history.length > 0) {
        const lastBot = history.filter(h => h.role === "assistant").pop()
        if (lastBot) { const m = lastBot.content.match(/["\u00AB]([^"\u00BB]+)["\u00BB]/) || lastBot.content.match(/\*\*([^*]+)\*\*/); if (m) titulo = m[1].trim() }
      }
      if (titulo) {
        try {
          const r = await fetch(`${SUPABASE_URL}/libros?select=titulo,autor:autores(nombre),sinopsis,anio_publicacion,numero_paginas,idioma&titulo=ilike.*${encodeURIComponent(titulo)}*&limit=1`, { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } })
          const found = await r.json()
          if (found?.[0]?.sinopsis) {
            const l = found[0]
            return { statusCode: 200, body: JSON.stringify({ content: `**${l.titulo}** de ${l.autor?.nombre ?? "?"}\n\n${l.sinopsis}\n\nAño: ${l.anio_publicacion || "?"} · Páginas: ${l.numero_paginas || "?"} · Idioma: ${l.idioma || "?"}` }) }
          }
        } catch {}
      }
    }

    // Place / location query
    const lugarQuery = /\b(?:d[óo]nde\s+(?:est[aá]n?|quedan?|hay)|ubicaci[oó]n|ubicado|localizar|ubicar|buscar|encontrar|mapa)\s+(?:las?\s+)?(?:cajas?|mes[oó]n|ba[ñn]os?|cafeter[ií]a|atenci[oó]n|computadores|impresoras|salas?|estanter[ií]as?|lockers|wifi)\b/i.test(message)
    if (lugarQuery) {
      try {
        const r = await fetch(`${SUPABASE_URL}/secciones?select=nombre,categoria,descripcion&order=id`, { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } })
        const secciones = await r.json()
        const q = message.toLowerCase()
        const rel = (secciones || []).filter(s => {
          if (q.includes("caja") && s.nombre.toLowerCase().includes("caja")) return true
          if (q.includes("baño") && s.categoria === "Baños") return true
          if (q.includes("cafeter") && s.categoria === "Cafetería") return true
          if (q.includes("computador") && s.categoria === "Computadores") return true
          if (q.includes("wifi") && s.categoria === "WiFi") return true
          if (q.includes("impresor") && s.nombre.toLowerCase().includes("impresor")) return true
          return false
        })
        if (rel.length > 0) {
          return { statusCode: 200, body: JSON.stringify({ content: `Ubicaciones encontradas:\n\n${rel.map(s => `• **${s.nombre}** — ${s.descripcion || s.categoria}`).join("\n")}` }) }
        }
      } catch {}
    }

    // Loans query
    const prestamoQuery = /\b(?:préstamos|prestados|pedidos|activos|debo|llevo|retirar|retiro|buscar\s+mis\s+libros|d[óo]nde\s+(?:tengo\s+que\s+)?(?:ir|buscar|retirar))\b/i.test(message)
    if (prestamoQuery && userId) {
      try {
        const prestamos = await request(`/prestamos?usuario_id=eq.${encodeURIComponent(userId)}&estado=eq.activo&select=id,libro:libros(titulo,autor:autores(nombre)),ejemplar:ejemplares(codigo),grupo:prestamos_grupo(lugar_retiro),fecha_devolucion_esperada`).catch(() => [])
        const items = prestamos.map(p => {
          let s = `• **${p.libro?.titulo ?? "?"}** de ${p.libro?.autor?.nombre ?? "?"}`
          if (p.grupo?.lugar_retiro) s += ` — Retirar en: **${p.grupo.lugar_retiro}**`
          if (p.fecha_devolucion_esperada) s += ` — Devolver: ${new Date(p.fecha_devolucion_esperada).toLocaleDateString("es-CL")}`
          return s
        }).join("\n")
        return { statusCode: 200, body: JSON.stringify({ content: prestamos.length > 0 ? `Tienes ${prestamos.length} libro(s) activo(s):\n\n${items}` : "No tienes libros prestados actualmente." }) }
      } catch {}
    }

    // Direct book request
    const pedirMatch = message.match(/\b(?:pide|pedir|presta|prestar|agrega|agregar|quiero|préstame|interesa|recomiéndame|recomiendame|dame|busco|muéstrame|búscame)\s+(?:el\s+)?(?:libro\s+)?(?:de\s+)?["\u00AB]?(.+?)["\u00BB]?\s*$/i)
    const isShortQuery = !pedirMatch && message.length <= 40 && !/\b(?:hola|quién|donde|cuándo|cómo|por qué|gracias|ad[ió]s|buenas|buenos|cómo estás|ayuda|bibliobot)\b/i.test(message)
    const directQuery = pedirMatch ? pedirMatch[1].trim() : isShortQuery ? message.trim() : null
    if (directQuery) {
      const libros = await requestLibrosMatching(directQuery)
      if (libros.length > 0) {
        const mejor = libros.find(l => { const t = l.titulo.toLowerCase(); const q = directQuery.toLowerCase(); return t.includes(q) || q.includes(t.substring(0, Math.min(t.length, q.length + 5))) }) || libros[0]
        const stock = await getStock(mejor.id)
        if (stock > 0) {
          return { statusCode: 200, body: JSON.stringify({ content: `"${mejor.titulo}" de ${mejor.autor?.nombre}. Hay ${stock} ejemplar(es) disponible(s). ¿Quieres agregarlo a tu carrito?`, action: { tool: "agregar_al_carrito", data: { libro_id: mejor.id, titulo: mejor.titulo }, message: `¿Quieres agregar "${mejor.titulo}" al carrito?` } }) }
        }
      }
    }

    // Genre query
    const generoQuery = message.match(/\b(?:terror|miedo|romance|amor|poesía|poesia|historia|filosofía|filosofia|ciencia\s+ficción|distopía|distopia|fantasía|fantasia|drama|policial|aventura|ensayo|biografía|biografia)\b/i)
    if (generoQuery && message.length < 80) {
      const alias = { miedo: "terror", amor: "romance" }
      const genero = alias[generoQuery[0].toLowerCase()] || generoQuery[0].toLowerCase()
      const tr = await toolMap.get("recomendar_libros")?.handler({ genero }, ctx)
      if (tr?.recomendaciones?.length > 0) {
        return { statusCode: 200, body: JSON.stringify({ content: `Libros de ${genero} en nuestro catálogo:\n\n${tr.recomendaciones.map((r, i) => `**${i + 1}.** ${r.titulo} de ${r.autor} — ${r.stock} disponible(s)`).join("\n")}` }) }
      }
      return { statusCode: 200, body: JSON.stringify({ content: `No tenemos libros del género "${genero}" en este momento. ¿Te interesa otro género?` }) }
    }

    // Author query
    const autorMatch = message.match(/(?:qué|que|cuales|cuáles|tienes?|hay)?\s*(?:libros?\s*(?:de|del?)\s*|tienes?\s*(?:de|del?)\s*|tiene\s*(?:de|del?)\s*|escribió\s*|obras?\s*(?:de|del?)\s*)([A-ZÁÉÍÓÚÜÑa-záéíóúüñ]+(?:\s+[A-ZÁÉÍÓÚÜÑa-záéíóúüñ]+){0,3})/i)
    if (autorMatch) {
      const autor = autorMatch[1].trim()
      try {
        const r = await fetch(`${SUPABASE_URL}/libros?select=id,titulo,autor:autores(nombre)&order=titulo`, { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } })
        const todos = await r.json()
        const al = autor.toLowerCase()
        const matching = (todos || []).filter(l => { const na = (l.autor?.nombre || "").toLowerCase(); return al.split(/\s+/).every(part => na.includes(part)) })
        if (matching.length > 0) {
          return { statusCode: 200, body: JSON.stringify({ content: `Libros de ${matching[0]?.autor?.nombre || autor} en nuestro catálogo (${matching.length}):\n\n${matching.map(l => `• **${l.titulo}**`).join("\n")}` }) }
        }
        return { statusCode: 200, body: JSON.stringify({ content: `No encontré libros de "${autor}" en nuestro catálogo. ¿Quieres buscar por otro autor?` }) }
      } catch {}
    }

    // --- LLM path ---

    if (!GITHUB_TOKEN) {
      return { statusCode: 200, body: JSON.stringify({ content: "El chat con IA no está configurado en este momento. Puedes preguntarme por libros, géneros, autores, ubicaciones o tus préstamos." }) }
    }

    const messages = [
      { role: "system", content: SYSTEM_PROMPT },
      ...history.map(h => ({ role: h.role, content: h.content, ...(h.tool_calls ? { tool_calls: h.tool_calls } : {}), ...(h.tool_call_id ? { tool_call_id: h.tool_call_id, role: "tool" } : {}) })),
      { role: "user", content: message },
    ]

    let apiMessages = [...messages]
    const toolDefs = TOOLS.map(t => ({ type: t.type, function: t.function }))

    let response = await callModel(apiMessages, toolDefs)
    let maxIter = 5

    while (response.choices?.[0]?.message?.tool_calls?.length > 0 && maxIter-- > 0) {
      const msg = response.choices[0].message
      apiMessages.push({ role: "assistant", content: msg.content || "", tool_calls: msg.tool_calls })

      for (const tc of msg.tool_calls) {
        if (tc.function.name === "agregar_al_carrito" && !/\b(pide|pedir|presta|prestar|agrega|agregar|quiero|préstame|interesa|carrito)\b/i.test(message)) continue
        const tool = toolMap.get(tc.function.name)
        if (!tool) { apiMessages.push({ role: "tool", tool_call_id: tc.id, content: JSON.stringify({ error: "Herramienta no encontrada" }) }); continue }
        try {
          const args = typeof tc.function.arguments === "string" ? JSON.parse(tc.function.arguments) : tc.function.arguments
          const result = await tool.handler(args, ctx)
          apiMessages.push({ role: "tool", tool_call_id: tc.id, content: JSON.stringify(result) })
        } catch (err) {
          apiMessages.push({ role: "tool", tool_call_id: tc.id, content: JSON.stringify({ error: err.message }) })
        }
      }

      response = await callModel(apiMessages, toolDefs)
    }

    let finalMessage = response.choices?.[0]?.message?.content || ""
    finalMessage = finalMessage.replace(/sourceMapping[\s\S]*?(?=sourceMapping|$)/gi, "").replace(/["\u00AB\u00BB]name["\u00AB\u00BB]\s*:\s*["\u00AB\u00BB]?\w+["\u00AB\u00BB]?[\s\S]*?\}/g, "").replace(/_icall_[\s\S]*?_ical_/gi, "").replace(/<\/?tool_call>[\s\S]*?<\/?tool_call>/gi, "").replace(/(_icall_|_ical_|_icoCALLTYPE|CALLTYPE|function_call)/gi, "").replace(/^\s*\{\s*["\u00AB\u00BB]name["\u00AB\u00BB][\s\S]*?\}\s*$/gm, "").trim()

    // Fallback from tool data if LLM response is short or tool results exist
    const toolMsgs = apiMessages.filter(m => m.role === "tool")
    if (toolMsgs.length > 0 && (!finalMessage || finalMessage.length < 30)) {
      const lastData = (() => { for (let i = toolMsgs.length - 1; i >= 0; i--) { try { const d = JSON.parse(toolMsgs[i].content); if (d.prestamos || d.recomendaciones || d.libros) return d } catch {} } return null })()
      if (lastData) {
        if (lastData.prestamos) {
          finalMessage = lastData.prestamos.length === 0 ? "No tienes libros prestados actualmente." : `Tienes ${lastData.total || lastData.prestamos.length} libro(s) activo(s):\n\n${lastData.prestamos.map(p => { let s = `• **${p.titulo}** de ${p.autor}`; if (p.lugar_retiro) s += ` — Retirar en: ${p.lugar_retiro}`; return s }).join("\n")}`
        } else if (lastData.recomendaciones) {
          finalMessage = `Libros${lastData.genero ? ` de ${lastData.genero}` : ""} en nuestro catálogo:\n\n${lastData.recomendaciones.map((r, i) => `**${i + 1}.** ${r.titulo} de ${r.autor}`).join("\n")}`
        } else if (lastData.libros) {
          finalMessage = `Encontré estos libros:\n\n${lastData.libros.map(l => `• **${l.titulo}** de ${l.autor}`).join("\n")}`
        }
      }
    }
    if (!finalMessage) finalMessage = "Lo siento, no pude procesar tu solicitud."

    // Anti-hallucination: if tools returned books, rebuild from tool data
    if (toolMsgs.length > 0 && finalMessage) {
      try {
        const validTitles = new Set()
        for (const t of toolMsgs) {
          try { const d = JSON.parse(t.content); for (const b of [...(d.recomendaciones || []), ...(d.libros || [])]) { if (b.titulo) validTitles.add(b.titulo.toLowerCase()) } } catch {}
        }
        if (validTitles.size > 0) {
          const lastData = (() => { for (let i = toolMsgs.length - 1; i >= 0; i--) { try { const d = JSON.parse(toolMsgs[i].content); if (d.recomendaciones || d.libros || d.prestamos) return d } catch {} } return null })()
          if (lastData) {
            if (lastData.prestamos) {
              finalMessage = lastData.prestamos.length === 0 ? "No tienes libros prestados actualmente." : `Tienes ${lastData.total || lastData.prestamos.length} libro(s) activo(s):\n\n${lastData.prestamos.map(p => { let s = `• **${p.titulo}** de ${p.autor}`; if (p.lugar_retiro) s += ` — Retirar en: ${p.lugar_retiro}`; return s }).join("\n")}`
            } else if (lastData.recomendaciones) {
              finalMessage = `Libros${lastData.genero ? ` de ${lastData.genero}` : ""} en nuestro catálogo:\n\n${lastData.recomendaciones.map((r, i) => `**${i + 1}.** ${r.titulo} de ${r.autor}`).join("\n")}`
            } else if (lastData.libros) {
              finalMessage = `Encontré estos libros:\n\n${lastData.libros.map(l => `• **${l.titulo}** de ${l.autor}`).join("\n")}`
            }
          }
        }
      } catch {}
    }

    // Action extraction from validated tool result
    let actionRequired = null
    const lastMsg = response.choices?.[0]?.message
    if (lastMsg?.tool_calls?.length > 0) {
      const tc = lastMsg.tool_calls[0]
      if (tc.function.name === "agregar_al_carrito") {
        const lastTool = [...apiMessages].reverse().find(m => m.role === "tool")
        if (lastTool) {
          try {
            const tr = JSON.parse(lastTool.content)
            if (tr.accion === "agregar_al_carrito" && tr.requiere_confirmacion && tr.libro_id) {
              actionRequired = { tool: "agregar_al_carrito", data: { libro_id: tr.libro_id, titulo: tr.titulo }, message: tr.mensaje }
            }
          } catch {}
        }
      }
    }

    if (!actionRequired) {
      const userWants = /\b(pide|pedir|presta|prestar|agrega|agregar|quiero|préstame)\b/i
      if (userWants.test(message)) {
        for (const msg of toolMsgs) {
          try {
            const data = JSON.parse(msg.content)
            if (data.libros?.length > 0) {
              const libro = data.libros[0]
              const stock = await (async () => {
                try {
                  const r = await fetch(`${SUPABASE_URL}/ejemplares?libro_id=eq.${libro.id}&estado=eq.disponible&condicion=not.eq.perdido&select=id`, { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } })
                  return (await r.json())?.length ?? 0
                } catch { return 0 }
              })()
              if (stock > 0) {
                actionRequired = { tool: "agregar_al_carrito", data: { libro_id: libro.id, titulo: libro.titulo }, message: `"${libro.titulo}" de ${libro.autor}. Hay ${stock} disponible(s). ¿Agregar al carrito?` }
              }
              break
            }
          } catch {}
        }
      }
    }

    return { statusCode: 200, body: JSON.stringify({ content: finalMessage, ...(actionRequired ? { action: actionRequired } : {}) }) }

  } catch (err) {
    console.error("Chat function error:", err)
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) }
  }
}
