import { Router } from "express"
import { TOOLS, getToolMap, request } from "./tools.js"

const OLLAMA_HOST = process.env.OLLAMA_HOST || "http://host.docker.internal:11434"

async function ollamaChat(model, messages, tools) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 120000)
  try {
    const res = await fetch(`${OLLAMA_HOST}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model, messages, tools, stream: false }),
      signal: controller.signal,
    })
    if (!res.ok) throw new Error(`Ollama responded with ${res.status}`)
    return res.json()
  } finally {
    clearTimeout(timeout)
  }
}

const router = Router()

async function requestLibrosMatching(query) {
  const POSTGREST = process.env.POSTGREST_URL || "http://postgrest:3000"
  const q = query.toLowerCase()
  const res = await fetch(`${POSTGREST}/libros?select=id,titulo,autor:autores(nombre)&order=titulo`)
  const libros = await res.json()
  return (libros || []).filter(l => l.titulo.toLowerCase().includes(q)).slice(0, 5)
    .map(l => ({ id: l.id, titulo: l.titulo, autor: l.autor?.nombre ?? "Desconocido" }))
}

async function getStock(libroId) {
  const POSTGREST = process.env.POSTGREST_URL || "http://postgrest:3000"
  const res = await fetch(`${POSTGREST}/ejemplares?libro_id=eq.${libroId}&estado=eq.disponible&condicion=not.eq.perdido&select=id`)
  const ejemplares = await res.json()
  return (ejemplares || []).length
}

const SYSTEM_PROMPT = `[IDIOMA]
Siempre debes responder en español. NUNCA uses otro idioma. El español es tu ÚNICO idioma.
Responde ÚNICAMENTE en español. Si no sabes español, no respondas.
[/IDIOMA]

Eres BiblioBot, el asistente virtual de la Biblioteca.
Tu trabajo es ayudar a los usuarios con información del sistema bibliotecario.

REGLAS OBLIGATORIAS:
- SOLO llama agregar_al_carrito cuando el usuario EXPLÍCITAMENTE pida agregar un libro al carrito. NUNCA lo llames para consultas de información.
- Cuando el usuario pregunte por sus préstamos: DEBES llamar mis_prestamos. NUNCA llames agregar_al_carrito en una consulta de préstamos.
- Cuando el usuario pregunte dónde retirar o recoger sus libros: DEBES llamar mis_prestamos para ver el lugar_retiro de cada libro activo.
- Cuando el usuario pregunte por libros, autores o recomendaciones: DEBES llamar buscar_libros o recomendar_libros.
- Cuando el usuario pregunte por ubicaciones: DEBES llamar secciones_biblioteca.
- SIEMPRE usa las herramientas para obtener datos. NUNCA inventes títulos, autores o disponibilidad.
- SOLO puedes mencionar libros que aparezcan EXPLÍCITAMENTE en los resultados de las herramientas. Si un libro no está en el resultado de una herramienta, NO LO MENCIONES bajo ninguna circunstancia.
- Si la herramienta no encuentra libros que coincidan, dile al usuario que no hay resultados en el catálogo. NO sugieras libros por tu cuenta.
- Si la herramienta devuelve requiere_confirmacion, muestra el mensaje y espera.
- Sé conciso. Responde en español con tono amable.`

router.post("/", async (req, res) => {
  const { message, history = [], userId, userName } = req.body

  if (!message?.trim()) {
    return res.status(400).json({ error: "Mensaje vacío" })
  }

  const toolMap = getToolMap()
  const ctx = { userId, userName }

  const respond = (data) => new Promise(r => setTimeout(r, 600 + Math.random() * 800)).then(() => res.json(data))

  try {
    let actionRequired = null

    const pedirMatch = message.match(/\b(?:pide|pedir|presta|prestar|agrega|agregar|quiero|préstame|interesa|recomiéndame|recomiendame|dame|busco|muéstrame|búscame)\s+(?:el\s+)?(?:libro\s+)?(?:de\s+)?["\u00AB]?(.+?)["\u00BB]?\s*$/i)
    const isShortQuery = !pedirMatch && message.length <= 40 && !/\b(?:hola|quién|donde|cuándo|cómo|por qué|gracias|ad[ió]s|buenas|buenos|cómo estás|ayuda|bibliobot)\b/i.test(message)

    const infoQuery = /\b(?:de\s+qu[eé]\s+trata|sinopsis|info(?:rmaci[oó]n)?|detalles|descripci[oó]n|cu[eé]ntame\s+(?:de|sobre)|h[aá]blame\s+(?:de|sobre))\b/i.test(message)
    if (infoQuery) {
      let titulo = ""
      const msgMatch = message.match(/(?:de\s+qu[eé]\s+trata|sinopsis\s+de|info\s+de|cu[eé]ntame\s+(?:de|sobre)|h[aá]blame\s+(?:de|sobre))\s+["\u00AB]?(.+?)["\u00BB]?\s*[?¡!]*\s*$/i)
      if (msgMatch) {
        const t = msgMatch[1].trim()
        if (t.length > 2 && !/^(el|la|los|las|un|una|este|ese|aquel|libro|el libro|el autor|ese libro)\s*$/i.test(t)) {
          titulo = t
        }
      }
      if (!titulo && history.length > 0) {
        const lastBot = history.filter(h => h.role === "assistant").pop()
        if (lastBot) {
          const match = lastBot.content.match(/["\u00AB]([^"\u00BB]+)["\u00BB]/) || lastBot.content.match(/\*\*([^*]+)\*\*/)
          if (match) titulo = match[1].trim()
        }
      }
      if (titulo) {
        try {
          const POSTGREST = process.env.POSTGREST_URL || "http://postgrest:3000"
          const r = await fetch(`${POSTGREST}/libros?select=titulo,autor:autores(nombre),sinopsis,anio_publicacion,numero_paginas,idioma&titulo=ilike.*${encodeURIComponent(titulo)}*&limit=1`)
          const found = await r.json()
          if (found?.[0]?.sinopsis) {
            const l = found[0]
            return respond({
              content: `**${l.titulo}** de ${l.autor?.nombre ?? "?"}\n\n${l.sinopsis}\n\nAño: ${l.anio_publicacion || "?"} · Páginas: ${l.numero_paginas || "?"} · Idioma: ${l.idioma || "?"}`,
            })
          }
        } catch {}
      }
    }

    const lugarQuery = /\b(?:d[óo]nde\s+(?:est[aá]n?|quedan?|hay)|ubicaci[oó]n|ubicado|localizar|ubicar|buscar|encontrar|mapa)\s+(?:las?\s+)?(?:cajas?|mes[oó]n|ba[ñn]os?|cafeter[ií]a|atenci[oó]n|computadores|impresoras|salas?|estanter[ií]as?|lockers|wifi)\b/i.test(message)
    if (lugarQuery) {
      try {
        const POSTGREST = process.env.POSTGREST_URL || "http://postgrest:3000"
        const r = await fetch(`${POSTGREST}/secciones?select=nombre,categoria,descripcion&order=id`)
        const secciones = await r.json()
        const q = message.toLowerCase()
        const relevantes = (secciones || []).filter(s => {
          if (q.includes("caja") && s.nombre.toLowerCase().includes("caja")) return true
          if (q.includes("baño") && s.categoria === "Baños") return true
          if (q.includes("cafeter") && s.categoria === "Cafetería") return true
          if (q.includes("computador") && s.categoria === "Computadores") return true
          if (q.includes("wifi") && s.categoria === "WiFi") return true
          if (q.includes("impresor") && s.nombre.toLowerCase().includes("impresor")) return true
          return false
        })
        if (relevantes.length > 0) {
          const items = relevantes.map(s => `• **${s.nombre}** — ${s.descripcion || s.categoria}`).join("\n")
          return respond({ content: `Ubicaciones encontradas:\n\n${items}` })
        }
      } catch {}
    }

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
        return respond({
          content: prestamos.length > 0
            ? `Tienes ${prestamos.length} libro(s) activo(s):\n\n${items}`
            : "No tienes libros prestados actualmente.",
        })
      } catch {}
    }

    const directQuery = pedirMatch ? pedirMatch[1].trim() : isShortQuery ? message.trim() : null
    if (directQuery) {
      const libros = await requestLibrosMatching(directQuery)
      if (libros.length > 0) {
        const mejor = libros.find(l => {
          const t = l.titulo.toLowerCase()
          const q = directQuery.toLowerCase()
          return t.includes(q) || q.includes(t.substring(0, Math.min(t.length, q.length + 5)))
        }) || libros[0]
        const stock = await getStock(mejor.id)
        if (stock > 0) {
          actionRequired = {
            tool: "agregar_al_carrito",
            data: { libro_id: mejor.id, titulo: mejor.titulo },
            message: `\"${mejor.titulo}\" de ${mejor.autor}. Hay ${stock} ejemplar(es) disponible(s). ¿Quieres agregarlo a tu carrito?`,
          }
          return respond({ content: actionRequired.message, action: actionRequired })
        }
      }
    }

    const generoQuery = message.match(/\b(?:terror|miedo|romance|amor|poesía|poesia|historia|filosofía|filosofia|ciencia\s+ficción|distopía|distopia|fantasía|fantasia|drama|policial|aventura|ensayo|biografía|biografia)\b/i)
    if (generoQuery && message.length < 80) {
      const generoAlias = {
        miedo: "terror",
        amor: "romance",
      }
      const genero = generoAlias[generoQuery[0].toLowerCase()] || generoQuery[0].toLowerCase()
      const toolResult = await toolMap.get("recomendar_libros")?.handler({ genero }, ctx)
      if (toolResult?.recomendaciones?.length > 0) {
        const items = toolResult.recomendaciones.map((r, i) =>
          `**${i + 1}.** ${r.titulo} de ${r.autor} — ${r.stock} disponible(s)`
        ).join("\n")
        return respond({ content: `Libros de ${genero} en nuestro catálogo:\n\n${items}` })
      } else {
        return respond({ content: `No tenemos libros del género "${genero}" en este momento. ¿Te interesa otro género?` })
      }
    }

    const autorQuery = message.match(/(?:qué|que|cuales|cuáles|tienes?|hay)?\s*(?:libros?\s*(?:de|del?)\s*|tienes?\s*(?:de|del?)\s*|tiene\s*(?:de|del?)\s*|escribió\s*|obras?\s*(?:de|del?)\s*)([A-ZÁÉÍÓÚÜÑa-záéíóúüñ]+(?:\s+[A-ZÁÉÍÓÚÜÑa-záéíóúüñ]+){0,3})/i)
    if (autorQuery) {
      const autor = autorQuery[1].trim()
      try {
        const POSTGREST = process.env.POSTGREST_URL || "http://postgrest:3000"
        const r = await fetch(`${POSTGREST}/libros?select=id,titulo,autor:autores(nombre)&order=titulo`)
        const todos = await r.json()
        const autorLower = autor.toLowerCase()
        const nombre = todos?.[0]?.autor?.nombre || autor
        const matching = (todos || []).filter(l => {
          const nombreAutor = (l.autor?.nombre || "").toLowerCase()
          return autorLower.split(/\s+/).every(part => nombreAutor.includes(part))
        })
        if (matching.length > 0) {
          const nombreAutor = matching[0]?.autor?.nombre || autor
          const items = matching.map(l => `• **${l.titulo}**`).join("\n")
          return respond({ content: `Libros de ${nombreAutor} en nuestro catálogo (${matching.length}):\n\n${items}` })
        } else {
          return respond({ content: `No encontré libros de "${autor}" en nuestro catálogo. ¿Quieres buscar por otro autor?` })
        }
      } catch {}
    }

    const messages = [
      { role: "system", content: SYSTEM_PROMPT },
      ...history.map(h => ({
        role: h.role,
        content: h.content,
        ...(h.tool_calls ? { tool_calls: h.tool_calls } : {}),
        ...(h.tool_call_id ? { tool_call_id: h.tool_call_id, role: "tool" } : {}),
      })),
      { role: "user", content: message },
    ]

    let apiMessages = [...messages]

    let response = await ollamaChat(
      "qwen2.5:14b",
      apiMessages.filter(m => m.role !== "function"),
      TOOLS.map(t => ({ type: t.type, function: t.function })),
    )

    let maxIterations = 5
    while (response.message.tool_calls?.length > 0 && maxIterations-- > 0) {
      const assistantMsg = response.message
      apiMessages.push({
        role: "assistant",
        content: assistantMsg.content || "",
        tool_calls: assistantMsg.tool_calls,
      })

      for (const tc of assistantMsg.tool_calls) {
        if (tc.function.name === "agregar_al_carrito" && !/\b(pide|pedir|presta|prestar|agrega|agregar|quiero|préstame|interesa|carrito)\b/i.test(message)) {
          continue
        }
        const tool = toolMap.get(tc.function.name)
        if (!tool) {
          apiMessages.push({
            role: "tool",
            tool_call_id: tc.id || tc.function.name,
            content: JSON.stringify({ error: "Herramienta no encontrada" }),
          })
          continue
        }

        try {
          const args = tc.function.arguments
          const result = await tool.handler(typeof args === "string" ? JSON.parse(args) : args, ctx)
          apiMessages.push({
            role: "tool",
            tool_call_id: tc.id || tc.function.name,
            content: JSON.stringify(result),
          })
        } catch (err) {
          apiMessages.push({
            role: "tool",
            tool_call_id: tc.id || tc.function.name,
            content: JSON.stringify({ error: err.message }),
          })
        }
      }

      response = await ollamaChat(
        "qwen2.5:14b",
        apiMessages.filter(m => m.role !== "function"),
        TOOLS.map(t => ({ type: t.type, function: t.function })),
      )
    }

    let finalMessage = response.message.content || ""
    finalMessage = finalMessage
      .replace(/sourceMapping[\s\S]*?(?=sourceMapping|$)/gi, "")
      .replace(/["\u00AB\u00BB]name["\u00AB\u00BB]\s*:\s*["\u00AB\u00BB]?\w+["\u00AB\u00BB]?[\s\S]*?\}/g, "")
      .replace(/_icall_[\s\S]*?_ical_/gi, "")
      .replace(/<\/?tool_call>[\s\S]*?<\/?tool_call>/gi, "")
      .replace(/(_icall_|_ical_|_icoCALLTYPE|CALLTYPE|function_call)/gi, "")
      .replace(/^\s*\{\s*["\u00AB\u00BB]name["\u00AB\u00BB][\s\S]*?\}\s*$/gm, "")
      .trim()

    // Validate: if LLM mentioned books not in tool results, rebuild from tool data
    const toolResults = apiMessages.filter(m => m.role === "tool")
    if (toolResults.length > 0 && finalMessage) {
      try {
        // Collect all valid book titles from tool results
        const validTitles = new Set()
        const validAuthors = new Set()
        for (const t of toolResults) {
          try {
            const d = JSON.parse(t.content)
            const books = d.recomendaciones || d.libros || []
            for (const b of books) {
              if (b.titulo) validTitles.add(b.titulo.toLowerCase())
              if (b.autor) validAuthors.add(b.autor.toLowerCase())
            }
            // Also from prestamos
            if (d.prestamos) {
              for (const p of d.prestamos) {
                if (p.titulo) validTitles.add(p.titulo.toLowerCase())
                if (p.autor) validAuthors.add(p.autor.toLowerCase())
              }
            }
          } catch { /* skip malformed */ }
        }
        // If tool returned books, check if LLM is talking about books not in results
        // Use the fallback reconstruction if LLM seems to be hallucinating
        if (validTitles.size > 0) {
          const lastData = (() => {
            for (let i = toolResults.length - 1; i >= 0; i--) {
              try { const d = JSON.parse(toolResults[i].content); if (d.recomendaciones || d.libros || d.prestamos) return d } catch {}
            }
            return null
          })()
          if (lastData) {
            if (lastData.prestamos) {
              if (lastData.prestamos.length === 0) {
                finalMessage = "No tienes libros prestados actualmente."
              } else {
                const items = lastData.prestamos.map(p => {
                  let s = `• **${p.titulo}** de ${p.autor}`
                  if (p.lugar_retiro) s += ` — Retirar en: ${p.lugar_retiro}`
                  return s
                }).join("\n")
                finalMessage = `Tienes ${lastData.total || lastData.prestamos.length} libro(s) activo(s):\n\n${items}`
              }
            } else if (lastData.recomendaciones) {
              const items = lastData.recomendaciones.map((r, i) => `**${i + 1}.** ${r.titulo} de ${r.autor}`).join("\n")
              const genero = lastData.genero ? ` de ${lastData.genero}` : ""
              finalMessage = `Libros${genero} en nuestro catálogo:\n\n${items}`
            } else if (lastData.libros) {
              const items = lastData.libros.map(l => `• **${l.titulo}** de ${l.autor}`).join("\n")
              finalMessage = `Encontré estos libros en el catálogo:\n\n${items}`
            }
          }
        }
      } catch { /* skip validation errors */ }
    }

    if (!finalMessage || finalMessage.length < 20) {
      const lastResults = apiMessages.filter(m => m.role === "tool").slice(-1)
      if (lastResults.length > 0) {
        try {
          const data = JSON.parse(lastResults[0].content)
          if (data.prestamos) {
            if (data.prestamos.length === 0) {
              finalMessage = "No tienes libros prestados actualmente."
            } else {
              const items = data.prestamos.map(p => {
                let s = `• **${p.titulo}** de ${p.autor}`
                if (p.lugar_retiro) s += ` — Retirar en: ${p.lugar_retiro}`
                return s
              }).join("\n")
              finalMessage = `Tienes ${data.total} libro(s) activo(s):\n\n${items}`
            }
          } else if (data.recomendaciones) {
            const items = data.recomendaciones.map((r, i) => `**${i + 1}.** ${r.titulo} de ${r.autor}`).join("\n")
            finalMessage = `Te recomiendo:\n\n${items}`
          } else if (data.libros) {
            const items = data.libros.map(l => `• **${l.titulo}** de ${l.autor}`).join("\n")
            finalMessage = `Encontré estos libros:\n\n${items}`
          }
        } catch {}
      }
    }
    if (!finalMessage) finalMessage = "Lo siento, no pude procesar tu solicitud."

    const lastToolCalls = response.message.tool_calls
    actionRequired = null
    if (lastToolCalls?.length > 0) {
      const tc = lastToolCalls[0]
      if (tc.function.name === "agregar_al_carrito") {
        // Use the TOOL RESULT (validated against DB), not the LLM's args (may be hallucinated)
        const lastToolMsg = [...apiMessages].reverse().find(m => m.role === "tool")
        if (lastToolMsg) {
          try {
            const toolResult = JSON.parse(lastToolMsg.content)
            if (toolResult.accion === "agregar_al_carrito" && toolResult.requiere_confirmacion && toolResult.libro_id) {
              actionRequired = {
                tool: "agregar_al_carrito",
                data: { libro_id: toolResult.libro_id, titulo: toolResult.titulo },
                message: toolResult.mensaje || `¿Quieres agregar "${toolResult.titulo}" al carrito?`,
              }
            }
          } catch {}
        }
      }
    }

    if (!actionRequired) {
      const userWants = /\b(pide|pedir|presta|prestar|agrega|agregar|quiero|préstame)\b/i
      if (userWants.test(message)) {
        for (const msg of apiMessages) {
          if (msg.role === "tool") {
            try {
              const data = JSON.parse(msg.content)
              if (data.libros?.length > 0) {
                const libro = data.libros[0]
                const stock = await (async () => {
                  try {
                    const r = await fetch(`${process.env.POSTGREST_URL || "http://postgrest:3000"}/ejemplares?libro_id=eq.${libro.id}&estado=eq.disponible&condicion=not.eq.perdido&select=id`)
                    return (await r.json())?.length ?? 0
                  } catch { return 0 }
                })()
                if (stock > 0) {
                  actionRequired = {
                    tool: "agregar_al_carrito",
                    data: { libro_id: libro.id, titulo: libro.titulo },
                    message: `¿Quieres agregar "${libro.titulo}" al carrito? Hay ${stock} disponible(s).`,
                  }
                  break
                }
              }
              if (data.id && data.titulo && data.stock > 0) {
                actionRequired = {
                  tool: "agregar_al_carrito",
                  data: { libro_id: data.id, titulo: data.titulo },
                  message: `¿Quieres agregar "${data.titulo}" al carrito? Hay ${data.stock} disponible(s).`,
                }
                break
              }
            } catch {}
          }
        }
      }
    }

    res.json({
      content: actionRequired?.message || finalMessage,
      action: actionRequired,
    })
  } catch (err) {
    console.error("Chat error:", err)
    res.status(500).json({
      content: "Lo siento, ocurrió un error al procesar tu mensaje. ¿Puedes intentarlo de nuevo?",
      error: err.message,
    })
  }
})

export default router
