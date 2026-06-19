import express from "express"
import cors from "cors"
import helmet from "helmet"
import compression from "compression"
import rateLimit from "express-rate-limit"
import multer from "multer"
import { randomUUID } from "node:crypto"
import { extname, join } from "node:path"
import { mkdirSync, existsSync, readdirSync, statSync, unlinkSync, rmSync, writeFileSync } from "node:fs"

function slugify(text) {
  if (!text) return ""
  return text
    .toString()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .substring(0, 40)
}

function caratulaDir(libroId) {
  return join(UPLOADS, "caratulas", String(libroId))
}

const UPLOADS = process.env.UPLOADS_DIR || "uploads"

const avatarStorage = multer.diskStorage({
  destination: (req, _file, cb) => {
    const userId = req.query.userId || "anon"
    const dir = join(UPLOADS, "avatares", userId)
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
    cb(null, dir)
  },
  filename: (_req, file, cb) => {
    const ext = extname(file.originalname) || ".png"
    cb(null, `${randomUUID()}${ext}`)
  },
})

const caratulaStorage = multer.diskStorage({
  destination: (req, _file, cb) => {
    const libroId = req.query.libroId || "0"
    const dir = caratulaDir(libroId)
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
    cb(null, dir)
  },
  filename: (_req, file, cb) => {
    const ext = extname(file.originalname) || ".png"
    cb(null, `cover${ext}`)
  },
})

const fileFilter = (_req, file, cb) => {
  const allowed = ["image/png", "image/jpeg", "image/gif", "image/webp"]
  cb(null, allowed.includes(file.mimetype))
}

const uploadAvatar = multer({ storage: avatarStorage, limits: { fileSize: 5 * 1024 * 1024 }, fileFilter })
const uploadCaratula = multer({ storage: caratulaStorage, limits: { fileSize: 5 * 1024 * 1024 }, fileFilter })

const listaStorage = multer.diskStorage({
  destination: (req, _file, cb) => {
    const userId = req.query.userId || "anon"
    const dir = join(UPLOADS, "listas", userId)
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
    cb(null, dir)
  },
  filename: (_req, file, cb) => {
    const ext = extname(file.originalname) || ".png"
    cb(null, `${randomUUID()}${ext}`)
  },
})
const uploadLista = multer({ storage: listaStorage, limits: { fileSize: 5 * 1024 * 1024 }, fileFilter })

const mapaStorage = multer.diskStorage({
  destination: `${UPLOADS}/mapa`,
  filename: (_req, file, cb) => {
    const ext = extname(file.originalname)
    cb(null, `mapa${ext}`)
  },
})
const uploadMapa = multer({ storage: mapaStorage, limits: { fileSize: 5 * 1024 * 1024 }, fileFilter })

const app = express()

app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
    contentSecurityPolicy: false,
    frameguard: false,
  })
)
app.use(compression())
app.use(cors({
  origin: function (origin, callback) {
    // Allow localhost, LAN IPs (192.168.x.x, 10.x.x.x, 172.16-31.x.x), and Netlify
    if (!origin) return callback(null, true)
    const allowed = /^https?:\/\/(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+|proyectogestionbiblioteca\.netlify\.app)(:\d+)?$/
    if (allowed.test(origin)) return callback(null, true)
    callback(new Error("Not allowed by CORS"))
  },
}))
app.use(express.json())

const uploadLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  message: { error: "Demasiadas solicitudes. Intenta de nuevo más tarde." },
})

app.use("/upload", uploadLimiter)

app.get("/", (_req, res) => {
  console.log("Health check hit")
  res.send("OK")
})

app.post("/upload/avatar", uploadAvatar.single("avatar"), (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No se envió archivo" })
  const userId = req.query.userId || "anon"
  res.json({ url: `/uploads/avatares/${userId}/${req.file.filename}` })
})

app.post("/upload/caratula", uploadCaratula.single("caratula"), (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No se envió archivo" })
  const libroId = req.query.libroId || "0"
  res.json({ url: `/uploads/caratulas/${libroId}/${req.file.filename}` })
})

app.post("/upload/lista", uploadLista.single("lista"), (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No se envió archivo" })
  const userId = req.query.userId || "anon"
  res.json({ url: `/uploads/listas/${userId}/${req.file.filename}` })
})

app.post("/upload/mapa", uploadMapa.single("mapa"), (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No se envió archivo" })
  res.json({ url: `/uploads/mapa/${req.file.filename}` })
})

const resenaFotoStorage = multer.diskStorage({
  destination: (req, _file, cb) => {
    const userId = req.query.userId || "anon"
    const dir = join(UPLOADS, "resenas", userId)
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
    cb(null, dir)
  },
  filename: (_req, file, cb) => {
    const ext = extname(file.originalname) || ".jpg"
    cb(null, `${randomUUID()}${ext}`)
  },
})
if (!existsSync(join(UPLOADS, "resenas"))) mkdirSync(join(UPLOADS, "resenas"), { recursive: true })
const uploadResenaFoto = multer({ storage: resenaFotoStorage, limits: { fileSize: 5 * 1024 * 1024 }, fileFilter })

app.post("/upload/resena-foto", uploadResenaFoto.single("foto"), (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No se envió archivo" })
  const userId = req.query.userId || "anon"
  res.json({ url: `/uploads/resenas/${userId}/${req.file.filename}` })
})

app.get("/upload/avatares", (req, res) => {
  const userId = req.query.userId || "anon"
  const dir = join(UPLOADS, "avatares", userId)
  if (!existsSync(dir)) return res.json([])
  const files = readdirSync(dir)
    .map((name) => {
      const stat = statSync(join(dir, name))
      return {
        name,
        url: `/uploads/avatares/${userId}/${name}`,
        size: stat.size,
        modified: stat.mtime.toISOString(),
      }
    })
    .sort((a, b) => new Date(b.modified).getTime() - new Date(a.modified).getTime())
  res.json(files)
})

app.delete("/upload/avatares/:name", (req, res) => {
  const userId = req.query.userId || "anon"
  const filePath = join(UPLOADS, "avatares", userId, req.params.name)
  if (!existsSync(filePath)) return res.status(404).json({ error: "Archivo no encontrado" })
  try {
    unlinkSync(filePath)
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: "No se pudo eliminar el archivo" })
  }
})

app.get("/upload/caratulas", (req, res) => {
  const libroId = req.query.libroId || "0"
  const dir = join(UPLOADS, "caratulas", libroId)
  if (!existsSync(dir)) return res.json([])
  const files = readdirSync(dir)
    .map((name) => {
      const stat = statSync(join(dir, name))
      return { name, url: `/uploads/caratulas/${libroId}/${name}`, size: stat.size, modified: stat.mtime.toISOString() }
    })
    .sort((a, b) => new Date(b.modified).getTime() - new Date(a.modified).getTime())
  res.json(files)
})

app.delete("/upload/caratulas/:name", (req, res) => {
  const libroId = req.query.libroId || "0"
  const filePath = join(UPLOADS, "caratulas", libroId, req.params.name)
  if (!existsSync(filePath)) return res.status(404).json({ error: "Archivo no encontrado" })
  try {
    unlinkSync(filePath)
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: "No se pudo eliminar el archivo" })
  }
})

app.delete("/upload/caratulas-dir/:libroId", (req, res) => {
  const dir = join(UPLOADS, "caratulas", req.params.libroId)
  if (!existsSync(dir)) return res.json({ ok: true })
  try {
    rmSync(dir, { recursive: true, force: true })
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: "No se pudo eliminar la carpeta" })
  }
})

app.get("/upload/listas", (req, res) => {
  const userId = req.query.userId || "anon"
  const dir = join(UPLOADS, "listas", userId)
  if (!existsSync(dir)) return res.json([])
  const files = readdirSync(dir)
    .map((name) => {
      const stat = statSync(join(dir, name))
      return { name, url: `/uploads/listas/${userId}/${name}`, size: stat.size, modified: stat.mtime.toISOString() }
    })
    .sort((a, b) => new Date(b.modified).getTime() - new Date(a.modified).getTime())
  res.json(files)
})

app.delete("/upload/listas/:name", (req, res) => {
  const userId = req.query.userId || "anon"
  const filePath = join(UPLOADS, "listas", userId, req.params.name)
  if (!existsSync(filePath)) return res.status(404).json({ error: "Archivo no encontrado" })
  try {
    unlinkSync(filePath)
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: "No se pudo eliminar el archivo" })
  }
})

app.post("/fetch/caratula", async (req, res) => {
  const { isbn, libroId } = req.body
  if (!isbn || !libroId) return res.status(400).json({ error: "ISBN y libroId requeridos" })

  const cleanIsbn = isbn.replace(/[^0-9Xx]/g, "")
  const url = `https://covers.openlibrary.org/b/isbn/${cleanIsbn}-L.jpg`

  try {
    const response = await fetch(url)
    if (!response.ok) return res.status(404).json({ error: "No se encontró carátula para este ISBN" })

    const buffer = Buffer.from(await response.arrayBuffer())

    if (buffer.length < 2000) return res.status(404).json({ error: "No se encontró carátula para este ISBN" })

    const dir = caratulaDir(libroId)
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true })

    const filePath = join(dir, "cover.jpg")
    writeFileSync(filePath, buffer)

    res.json({ url: `/uploads/caratulas/${libroId}/cover.jpg` })
  } catch {
    res.status(500).json({ error: "Error al descargar la carátula" })
  }
})

app.post("/fetch/caratula-google", async (req, res) => {
  const { titulo, autor, libroId } = req.body
  if (!titulo || !libroId) return res.status(400).json({ error: "Título y libroId requeridos" })

  const GOOGLE_API_KEY = process.env.GOOGLE_BOOKS_API_KEY || ""
  if (!GOOGLE_API_KEY) return res.status(400).json({ error: "API key de Google Books no configurada" })

  try {
    const query = encodeURIComponent(`${titulo} ${autor || ""}`.trim())
    const searchUrl = `https://www.googleapis.com/books/v1/volumes?q=${query}&maxResults=1&key=${GOOGLE_API_KEY}`
    const searchRes = await fetch(searchUrl)
    const data = await searchRes.json()

    const coverUrl = data?.items?.[0]?.volumeInfo?.imageLinks?.thumbnail
      || data?.items?.[0]?.volumeInfo?.imageLinks?.smallThumbnail
    if (!coverUrl) return res.status(404).json({ error: "No se encontró portada en Google Books" })

    const imgUrl = coverUrl.replace("http://", "https://").replace("&edge=curl", "")
    const imgRes = await fetch(imgUrl)
    if (!imgRes.ok) return res.status(404).json({ error: "Error al descargar la imagen" })

    const buffer = Buffer.from(await imgRes.arrayBuffer())
    if (buffer.length < 2000) return res.status(404).json({ error: "Imagen demasiado pequeña" })

    const dir = caratulaDir(libroId)
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true })

    const filePath = join(dir, "cover.jpg")
    writeFileSync(filePath, buffer)

    res.json({ url: `/uploads/caratulas/${libroId}/cover.jpg` })
  } catch {
    res.status(500).json({ error: "Error al buscar en Google Books" })
  }
})

import { generarPDFStream, guardarPDF, getStoredPDF } from "./pedido-pdf.js"

app.post("/pedido-pdf", async (req, res) => {
  const { grupoId, usuarioId } = req.body
  if (!grupoId) return res.status(400).json({ error: "grupoId requerido" })
  try {
    const url = await guardarPDF(grupoId, usuarioId)
    await pgRequest(`/prestamos_grupo?id=eq.${grupoId}`, {
      method: "PATCH",
      body: JSON.stringify({ pdf_url: url }),
      headers: { "Content-Type": "application/json" },
    })
    res.json({ url })
  } catch (err) {
    console.error("PDF save error:", err)
    res.status(500).json({ error: err.message })
  }
})

app.get("/pedido-pdf/:grupoId", async (req, res) => {
  const grupoId = parseInt(req.params.grupoId)
  const usuarioId = req.query.usuarioId
  if (isNaN(grupoId)) return res.status(400).json({ error: "ID inválido" })
  res.setHeader("Content-Type", "application/pdf")
  res.setHeader("Content-Disposition", `inline; filename="pedido-${grupoId}.pdf"`)
  res.setHeader("Cross-Origin-Opener-Policy", "unsafe-none")
  res.setHeader("Cross-Origin-Embedder-Policy", "unsafe-none")
  try {
    const stored = getStoredPDF(grupoId, usuarioId)
    if (stored) {
      res.send(stored)
    } else {
      await generarPDFStream(grupoId, res)
    }
  } catch (err) {
    console.error("PDF error:", err)
    res.status(500).json({ error: "Error al generar PDF" })
  }
})

import chatRouter from "./chat.js"
app.use("/chat", chatRouter)

import { setupFlow } from "./flow.js"
setupFlow(app)

import { pgRequest, getPgUrl } from "./pg.js"

app.post("/prestamos/verificar-atrasos", async (_req, res) => {
  try {
    const activos = await pgRequest("/prestamos?estado=eq.activo&select=*,usuario:usuario(id)")
    const now = new Date()
    const atrasados = (activos || []).filter(p => new Date(p.fecha_devolucion_esperada) < now)
    
    for (const p of atrasados) {
      const dias = Math.floor((now.getTime() - new Date(p.fecha_devolucion_esperada).getTime()) / (1000 * 60 * 60 * 24))
      const multa = await pgRequest("/configuracion?clave=eq.multa_por_dia&select=valor")
      const multaMax = await pgRequest("/configuracion?clave=eq.multa_maxima&select=valor")
      const porDia = parseInt(multa?.[0]?.valor || "500")
      const max = parseInt(multaMax?.[0]?.valor || "10000")
      const monto = Math.min(dias * porDia, max)

      await pgRequest(`/prestamos?id=eq.${p.id}`, {
        method: "PATCH",
        body: JSON.stringify({ estado: "atrasado" }),
        headers: { "Content-Type": "application/json" },
      })

      const existente = await pgRequest(`/multas?prestamo_id=eq.${p.id}&select=id`)
      if (!existente?.length) {
        await pgRequest("/multas", {
          method: "POST",
          body: JSON.stringify({ usuario_id: p.usuario_id, prestamo_id: p.id, monto, dias_atraso: dias }),
          headers: { "Content-Type": "application/json" },
        })
      } else {
        await pgRequest(`/multas?id=eq.${existente[0].id}`, {
          method: "PATCH",
          body: JSON.stringify({ monto, dias_atraso: dias }),
          headers: { "Content-Type": "application/json" },
        })
      }
    }
    res.json({ procesados: atrasados.length })
  } catch (err) {
    console.error("Error verificando atrasos:", err)
    res.status(500).json({ error: err.message })
  }
})

import { syncToSupabase } from "./sync.js"
import { syncFromSupabase } from "./sync.js"

app.post("/sync/full", async (_req, res) => {
  try {
    const pullResults = await syncFromSupabase()
    const pushResults = await syncToSupabase()
    res.json({ success: true, pull: pullResults, push: pushResults })
  } catch (err) {
    console.error("Sync error:", err)
    res.status(500).json({ error: err.message })
  }
})

app.post("/sync/pull", async (_req, res) => {
  try {
    const results = await syncFromSupabase()
    res.json({ success: true, results })
  } catch (err) {
    console.error("Sync pull error:", err)
    res.status(500).json({ error: err.message })
  }
})

app.use("/uploads", express.static(UPLOADS))

const PORT = process.env.PORT || 4000
const server = app.listen(PORT, "0.0.0.0", () => {
  console.log(`Upload server running on port ${PORT}`)
})

server.on("error", (err) => {
  console.error("Server error:", err)
})

process.on("uncaughtException", (err) => {
  console.error("Uncaught exception:", err)
})

process.on("unhandledRejection", (reason) => {
  console.error("Unhandled rejection:", reason)
})
