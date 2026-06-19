const LOCAL_PG = process.env.POSTGREST_URL || "http://postgrest:3000"
const SUPABASE_URL = process.env.SUPABASE_URL || "https://xelzdjgoxwddgjqouywm.supabase.co/rest/v1"
const SUPABASE_KEY = process.env.SUPABASE_KEY || ""
const SUPABASE_BASE = SUPABASE_URL.replace(/\/rest\/v1$/, "")
const SUPABASE_STORAGE = `${SUPABASE_BASE}/storage/v1/object/uploads`
const SUPABASE_STORAGE_PUBLIC = `${SUPABASE_BASE}/storage/v1/object/public/uploads`
const UPLOADS_DIR = process.env.UPLOADS_DIR || "uploads"

import { readFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs"
import { join, extname, dirname } from "node:path"
import { generarMultaPDF } from "./multas-pdf.js"

const MIME = {
  ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
  ".gif": "image/gif", ".webp": "image/webp", ".svg": "image/svg+xml",
}

// --- HTTP helpers ---

async function supabaseRequest(path, options = {}) {
  const headers = {
    apikey: SUPABASE_KEY,
    Authorization: `Bearer ${SUPABASE_KEY}`,
    ...options.headers,
  }
  const res = await fetch(`${SUPABASE_URL}${path}`, { ...options, headers })
  return res
}

async function fetchLocal(table, select = "*") {
  const res = await fetch(`${LOCAL_PG}/${table}?select=${select}`)
  if (!res.ok) return []
  return res.json()
}

async function fetchSupabase(table, select = "*", filter = "") {
  let url = `${SUPABASE_URL}/${table}?select=${encodeURIComponent(select)}`
  if (filter) url += `&${filter}`
  const res = await fetch(url, {
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
  })
  if (!res.ok) return []
  return res.json()
}

// --- Batch operations ---

// Batch delete: DELETE /table?col=in.(v1,v2,v3)
async function deleteBatch(table, column, ids) {
  if (!ids?.length) return 0
  let deleted = 0
  for (let i = 0; i < ids.length; i += 500) {
    const batch = ids.slice(i, i + 500)
    const filter = batch.map(v => encodeURIComponent(String(v))).join(",")
    const res = await supabaseRequest(
      `/${table}?${column}=in.(${filter})`,
      { method: "DELETE" }
    )
    if (res.ok) {
      deleted += batch.length
    } else {
      console.error(`deleteBatch ${table} failed:`, await res.text().catch(() => ""))
      return deleted
    }
  }
  return deleted
}

// Batch upsert: POST /table with resolution=merge-duplicates
async function upsertBatch(table, rows) {
  if (!rows?.length) return 0
  let done = 0
  for (let i = 0; i < rows.length; i += 200) {
    const batch = rows.slice(i, i + 200)
    const res = await supabaseRequest(`/${table}`, {
      method: "POST",
      body: JSON.stringify(batch),
      headers: {
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates",
      },
    })
    if (res.ok) {
      done += batch.length
    } else {
      console.error(`upsertBatch ${table} failed:`, await res.text().catch(() => ""))
      return done
    }
  }
  return done
}

// --- Sync strategies ---

// Normalize image URLs for checksum comparison: strip domain
// "http://localhost:4000/uploads/avatares/x/y.png" → "avatares/x/y.png"
// "https://...supabase.co/storage/v1/object/public/uploads/avatares/x/y.png" → "avatares/x/y.png"
// JSON arrays (like fotos field) are parsed, each URL normalized, and re-stringified
function normalizeUrl(val) {
  if (typeof val !== "string") return val
  // Handle JSON array of URLs (e.g., fotos field)
  if (val.startsWith("[")) {
    try {
      const arr = JSON.parse(val)
      if (Array.isArray(arr)) {
        return JSON.stringify(arr.map(u => normalizeUrlSingle(u)))
      }
    } catch { /* not valid JSON, treat as single URL */ }
  }
  return normalizeUrlSingle(val)
}

function normalizeUrlSingle(val) {
  if (typeof val !== "string") return val
  // Supabase Storage: strip everything before /uploads/
  let m = val.match(/\/storage\/v1\/object\/public\/uploads\/(.+)$/)
  if (m) return m[1]
  // Local server: strip host + /uploads/
  m = val.match(/\/uploads\/(.+)$/)
  if (m) return m[1]
  // Relative path: strip leading /uploads/
  if (val.startsWith("/uploads/")) return val.slice(9)
  return val
}

// Compute a stable checksum of a row's data (excluding volatile columns)
function rowChecksum(row) {
  // Clone and strip volatile columns that differ between instances
  const { updated_at, created_at, codigo, id_preferencia_mp, ...data } = row
  // Normalize image URL fields
  for (const k of ["foto_perfil", "imagen", "caratula", "foto_estado", "fotos", "foto"]) {
    if (data[k]) data[k] = normalizeUrl(data[k])
  }
  // Sort keys for stable JSON output
  const sorted = {}
  for (const k of Object.keys(data).sort()) {
    sorted[k] = data[k]
  }
  return JSON.stringify(sorted)
}

// Differential sync for tables with an 'id' primary key:
//   1. Fetch Supabase data (same columns as local)
//   2. Delete rows in Supabase but NOT in local (batch DELETE)
//   3. Only upsert rows whose checksum differs (skips unchanged data)
async function diffSyncTable(table, localRows, select) {
  const localIdSet = new Set(localRows.map(r => String(r.id)))

  // Fetch Supabase with same columns for checksum comparison
  const supRows = await fetchSupabase(table, select, "limit=10000")
  
  // Build checksum map of Supabase rows
  const supChecksums = new Map()
  for (const r of supRows) {
    supChecksums.set(String(r.id), rowChecksum(r))
  }

  // Delete rows in Supabase not in local
  const toDelete = supRows.filter(r => !localIdSet.has(String(r.id))).map(r => r.id)
  const deleted = await deleteBatch(table, "id", toDelete)

  // Only upsert rows that don't exist in Supabase or have different content
  const changedRows = localRows.filter(r => {
    const supCs = supChecksums.get(String(r.id))
    if (!supCs) return true // new row
    return rowChecksum(r) !== supCs
  })

  const inserted = await upsertBatch(table, changedRows)
  return { deleted, inserted, skipped: localRows.length - changedRows.length }
}

// Bulk sync for composite-PK tables (no 'id' column):
//   1. Delete all from Supabase (batch DELETE with not.is.null)
//   2. Insert all local rows (batch POST)
async function bulkSyncTable(table, rows, matchColumn) {
  await supabaseRequest(`/${table}?${matchColumn}=not.is.null`, { method: "DELETE" }).catch(() => {})
  const inserted = await upsertBatch(table, rows)
  return { deleted: "all", inserted }
}

// --- Table definitions ---

const TABLES = [
  { table: "autores" },
  { table: "editoriales" },
  { table: "generos" },
  { table: "etiquetas" },
  { table: "usuario", select: "id,nombre_usuario,password_hash,rol,email,rut,primer_nombre,segundo_nombre,apellido_paterno,apellido_materno,bio,telefono,direccion,foto_perfil" },
  { table: "libros", select: "id,titulo,autor_id,sinopsis,isbn,editorial_id,anio_publicacion,numero_paginas,idioma,caratula,disponible" },
  { table: "libros_generos", composite: true, matchCol: "libro_id" },
  { table: "libros_etiquetas", composite: true, matchCol: "libro_id" },
  { table: "ejemplares", select: "id,libro_id,estado,condicion,notas,foto_estado" },
  { table: "prestamos_grupo", select: "id,usuario_id,nota_admin,lugar_retiro,pdf_url,codigo,revisor_id,fecha_devolucion_esperada" },
  { table: "prestamos", select: "id,usuario_id,libro_id,ejemplar_id,grupo_id,fecha_prestamo,fecha_devolucion_esperada,fecha_devolucion_real,estado" },
  { table: "resenas", select: "id,usuario_id,libro_id,puntuacion,comentario,fotos" },
  { table: "listas", select: "id,nombre,descripcion,imagen,usuario_id,por_defecto,publica" },
  { table: "listas_libros", composite: true, matchCol: "lista_id" },
  { table: "carrito", composite: true, matchCol: "usuario_id" },
  { table: "multas", select: "id,usuario_id,prestamo_id,monto,dias_atraso,pagada,id_preferencia_mp" },
  { table: "secciones", select: "id,nombre,descripcion,categoria,x,y,icono" },
  { table: "categorias_secciones", select: "id,nombre,descripcion,color" },
  { table: "configuracion", select: "id,clave,valor" },
  { table: "notificaciones", select: "id,usuario_id,titulo,mensaje,leida,link" },
]

// --- Main export: push local → Supabase ---

export async function syncToSupabase() {
  const results = []
  // Capture old Supabase image URLs before overwriting them
  const oldSupabaseUrls = await captureSupabaseImageUrls()
  
  for (const { table, select, composite, matchCol } of TABLES) {
    try {
      const rows = await fetchLocal(table, select || "*")
      if (composite) {
        const r = await bulkSyncTable(table, rows || [], matchCol)
        results.push({ table, ...r })
      } else {
        if (!rows?.length) {
          const supIds = await fetchSupabase(table, "id", "limit=10000")
          const deleted = await deleteBatch(table, "id", supIds.map(r => r.id))
          results.push({ table, deleted, inserted: 0 })
        } else {
          const r = await diffSyncTable(table, rows, select || "*")
          results.push({ table, ...r })
        }
      }
    } catch (err) {
      results.push({ table, error: err.message })
    }
  }
  // Sync image files to Supabase Storage
  const fileResults = await syncFilesToStorage()
  if (fileResults?.length) results.push({ table: "files", synced: fileResults.length })
  // Clean orphan files: delete Supabase files that are no longer referenced locally
  const cleanResults = await cleanOrphanSupabaseFiles(oldSupabaseUrls)
  if (cleanResults?.length) results.push({ table: "files_cleaned", cleaned: cleanResults.length })
  return results
}

// Capture Supabase image URLs before sync overwrites them
async function captureSupabaseImageUrls() {
  const map = new Map()
  const tables = ["usuario", "listas"]
  for (const table of tables) {
    try {
      const col = table === "usuario" ? "foto_perfil" : "imagen"
      const rows = await fetchSupabase(table, `id,${col}`).catch(() => [])
      for (const r of (rows || [])) {
        if (r[col] && r[col].includes("supabase.co/storage")) {
          const key = `${table}:${r.id}`
          map.set(key, r[col])
        }
      }
    } catch { /* skip */ }
  }
  return map
}

// --- Clean orphan files from Supabase Storage ---

async function cleanOrphanSupabaseFiles(oldUrls) {
  const results = []
  if (!oldUrls?.size) return results
  const tables = [
    { table: "usuario", column: "foto_perfil", folder: "avatares" },
    { table: "listas", column: "imagen", folder: "listas" },
  ]
  for (const { table, column, folder } of tables) {
    try {
      const localRows = await fetchLocal(table, `id,${column}`).catch(() => [])
      for (const lr of (localRows || [])) {
        const key = `${table}:${lr.id}`
        const oldSupabaseUrl = oldUrls.get(key)
        if (!oldSupabaseUrl) continue
        const newLocalUrl = lr[column] || ""
        // If local no longer has this URL (deleted or changed), the Supabase file is orphan
        if (normalizeUrl(newLocalUrl) !== normalizeUrl(oldSupabaseUrl)) {
          const m = oldSupabaseUrl.match(/\/storage\/v1\/object\/public\/uploads\/(.+)$/)
          if (m) {
            const relPath = m[1]
            const pathParts = relPath.split("/")
            const supabaseFolder = pathParts[0]
            const userId = pathParts[1]
            const fileName = pathParts[pathParts.length - 1]
            try {
              await fetch(`${SUPABASE_STORAGE}/${encodeURIComponent(supabaseFolder)}/${encodeURIComponent(userId)}/${encodeURIComponent(fileName)}`, {
                method: "DELETE",
                headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
              })
              results.push({ table, id: lr.id, file: relPath })
            } catch { /* skip */ }
          }
        }
      }
    } catch { /* skip */ }
  }
  return results
}

// --- Download files from Supabase Storage to local ---

async function downloadSupabaseFiles(fotosJson) {
  if (!fotosJson) return fotosJson
  try {
    const urls = JSON.parse(fotosJson)
    if (!Array.isArray(urls)) return fotosJson
    let changed = false
    const newUrls = []
    for (const url of urls) {
      const localPath = await downloadSupabaseFile(url)
      if (localPath) {
        newUrls.push(localPath)
        changed = true
      } else {
        newUrls.push(url)
      }
    }
    return changed ? JSON.stringify(newUrls) : fotosJson
  } catch { return fotosJson }
}

async function downloadSupabaseFile(url) {
  if (typeof url !== "string" || !url.includes("supabase.co/storage")) return null
  // Extract relative path: .../object/public/uploads/resenas/xxx/yyy.jpg → resenas/xxx/yyy.jpg
  const m = url.match(/\/storage\/v1\/object\/public\/uploads\/(.+)$/)
  if (!m) return null
  const relPath = m[1]
  const localFile = join(UPLOADS_DIR, relPath)
  if (existsSync(localFile)) return `/uploads/${relPath}` // already downloaded
  
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    const buffer = Buffer.from(await res.arrayBuffer())
    mkdirSync(dirname(localFile), { recursive: true })
    writeFileSync(localFile, buffer)
    return `/uploads/${relPath}`
  } catch { return null }
}

// --- Sync local image files to Supabase Storage ---

async function syncFilesToStorage() {
  const results = []
  // Fetch records that might have image URLs
  const usuarios = await fetchLocal("usuario", "id,foto_perfil").catch(() => [])
  for (const u of (usuarios || [])) {
    if (!u.foto_perfil) continue
    const r = await syncFile(u.foto_perfil, "usuario", u.id, "foto_perfil")
    if (r) results.push(r)
  }
  const listas = await fetchLocal("listas", "id,imagen").catch(() => [])
  for (const l of (listas || [])) {
    if (!l.imagen) continue
    const r = await syncFile(l.imagen, "listas", l.id, "imagen")
    if (r) results.push(r)
  }
  // Sync book covers (caratula)
  const libros = await fetchLocal("libros", "id,caratula").catch(() => [])
  for (const l of (libros || [])) {
    if (!l.caratula) continue
    const r = await syncFile(l.caratula, "libros", l.id, "caratula")
    if (r) results.push(r)
  }
  // Sync review photos (fotos is a JSON array of URLs)
  const resenas = await fetchLocal("resenas", "id,fotos").catch(() => [])
  for (const r of (resenas || [])) {
    if (!r.fotos) continue
    try {
      const urls = JSON.parse(r.fotos)
      if (!Array.isArray(urls) || !urls.length) continue
      let changed = false
      const newUrls = []
      for (const url of urls) {
        const result = await syncFile(url, null, null, null) // upload only, no DB update
        if (result) {
          newUrls.push(result.url)
          changed = true
        } else {
          newUrls.push(url) // keep original
        }
      }
      if (changed) {
        await supabaseRequest(`/resenas?id=eq.${encodeURIComponent(r.id)}`, {
          method: "PATCH",
          body: JSON.stringify({ fotos: JSON.stringify(newUrls) }),
          headers: { "Content-Type": "application/json", Prefer: "return=minimal" },
        })
        results.push({ table: "resenas", id: r.id, files: newUrls.length })
      }
    } catch { /* skip malformed JSON */ }
  }
  // Sync PDF files (multas, pedidos) to Supabase Storage
  try {
    const pdfDirs = ["multas-pdf", "pedido-pdf"]
    for (const dir of pdfDirs) {
      const fullDir = join(UPLOADS_DIR, dir)
      if (!existsSync(fullDir)) continue
      const entries = readdirSync(fullDir, { recursive: true, withFileTypes: true })
      for (const entry of entries) {
        if (!entry.isFile() || !entry.name.endsWith(".pdf")) continue
        const relPath = join(dir, entry.name)
        const localFile = join(fullDir, entry.name)
        // Upload if not already in Supabase
        const supabasePath = encodeURIComponent(relPath)
        try {
          await fetch(`${SUPABASE_STORAGE}/${supabasePath}`, {
            method: "POST",
            headers: {
              apikey: SUPABASE_KEY,
              Authorization: `Bearer ${SUPABASE_KEY}`,
              "Content-Type": "application/pdf",
            },
            body: readFileSync(localFile),
          })
          results.push({ table: dir, file: relPath })
        } catch { /* skip if upload fails (e.g. 409 duplicate) */ }
      }
    }
  } catch { /* skip PDF sync errors */ }
  return results
}

async function syncFile(storedPath, table, recordId, column) {
  if (storedPath.includes("supabase.co/storage")) return null // already in Supabase
  
  // Extract relative path from stored URL
  let relPath = ""
  const localhostMatch = storedPath.match(/\/uploads\/(.+)$/)
  if (localhostMatch) {
    relPath = localhostMatch[1] // e.g. "avatares/{userId}/{uuid}.png"
  } else if (storedPath.startsWith("/uploads/")) {
    relPath = storedPath.replace(/^\/uploads\//, "")
  } else {
    return null // not a path we recognize
  }
  
  const localFile = join(UPLOADS_DIR, relPath)
  if (!existsSync(localFile)) return null
  
  try {
    const fileBuffer = readFileSync(localFile)
    const ext = extname(localFile).toLowerCase()
    const contentType = MIME[ext] || "application/octet-stream"
    const encodedPath = relPath.split("/").map(encodeURIComponent).join("/")
    
    const uploadRes = await fetch(`${SUPABASE_STORAGE}/${encodedPath}`, {
      method: "POST",
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        "Content-Type": contentType,
      },
      body: fileBuffer,
    })
    
    if (!uploadRes.ok) {
      // Supabase Storage returns 409 as { statusCode: "409" } in body with HTTP 400
      const errText = await uploadRes.text().catch(() => "")
      try {
        const errJson = JSON.parse(errText)
        if (errJson.statusCode === "409" || errJson.error === "Duplicate") {
          // File already in Supabase Storage, just return the public URL
        } else {
          console.error(`Error uploading ${relPath}:`, errText)
          return null
        }
      } catch {
        console.error(`Error uploading ${relPath}:`, errText)
        return null
      }
    }
    
    // Update Supabase record with the new public URL (if table/column provided)
    const publicUrl = `${SUPABASE_STORAGE_PUBLIC}/${relPath}`
    if (table && recordId && column) {
      await supabaseRequest(`/${table}?id=eq.${encodeURIComponent(recordId)}`, {
        method: "PATCH",
        body: JSON.stringify({ [column]: publicUrl }),
        headers: { "Content-Type": "application/json", Prefer: "return=minimal" },
      })
    }
    
    return { table, id: recordId, file: relPath, url: publicUrl }
  } catch (err) {
    console.error(`syncFile error ${relPath}:`, err.message)
    return null
  }
}

// --- Pull: procesa acciones pendientes de Supabase → local ---

async function markProcessed(id) {
  await fetch(`${SUPABASE_URL}/acciones_pendientes?id=eq.${id}`, {
    method: "PATCH",
    body: JSON.stringify({ procesada: true }),
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, "Content-Type": "application/json", Prefer: "return=minimal" },
  }).catch(() => {})
}

export async function syncFromSupabase() {
  const results = []
  const acciones = await fetchSupabase("acciones_pendientes", "id,accion,datos", "procesada=eq.false")

  for (const a of (acciones || [])) {
    try {
      const d = a.datos
      switch (a.accion) {
        case "registro": {
          const userId = d.id
          await fetch(`${LOCAL_PG}/usuario`, {
            method: "POST",
            body: JSON.stringify({ id: userId, nombre_usuario: d.nombre_usuario, password_hash: d.password_hash }),
            headers: { "Content-Type": "application/json", Prefer: "return=minimal" },
          })
          const listas = [
            { nombre: "Favoritos", descripcion: "Mis libros favoritos", usuario_id: userId, por_defecto: true, publica: false },
            { nombre: "Por leer", descripcion: "Libros que quiero leer", usuario_id: userId, por_defecto: true, publica: false },
            { nombre: "Leídos", descripcion: "Libros que ya he leído", usuario_id: userId, por_defecto: true, publica: true },
          ]
          for (const l of listas) {
            await fetch(`${LOCAL_PG}/listas`, {
              method: "POST",
              body: JSON.stringify(l),
              headers: { "Content-Type": "application/json", Prefer: "return=minimal" },
            }).catch(() => {})
          }
          break
        }
        case "resena_crear": {
          let uid = d.usuario_id
          if (d._nombre_usuario) {
            const localUser = await fetch(`${LOCAL_PG}/usuario?nombre_usuario=eq.${encodeURIComponent(d._nombre_usuario)}&select=id`)
              .then(r => r.ok ? r.json() : []).catch(() => [])
            if (localUser?.[0]?.id) uid = localUser[0].id
          }
          // Download any Supabase-hosted photos to local
          const localFotos = await downloadSupabaseFiles(d.fotos)
          await fetch(`${LOCAL_PG}/resenas`, {
            method: "POST",
            body: JSON.stringify({ ...d, usuario_id: uid, fotos: localFotos, _nombre_usuario: undefined }),
            headers: { "Content-Type": "application/json", Prefer: "return=minimal" },
          }).catch(() => {})
          break
        }
        case "resena_editar": {
          let localId = d.id
          if (d._usuario_id && d._libro_id) {
            let uid = d._usuario_id
            if (d._nombre_usuario) {
              const localUser = await fetch(`${LOCAL_PG}/usuario?nombre_usuario=eq.${encodeURIComponent(d._nombre_usuario)}&select=id`)
                .then(r => r.ok ? r.json() : []).catch(() => [])
              if (localUser?.[0]?.id) uid = localUser[0].id
            }
            const localR = await fetch(
              `${LOCAL_PG}/resenas?usuario_id=eq.${encodeURIComponent(uid)}&libro_id=eq.${d._libro_id}&select=id`
            ).then(r => r.ok ? r.json() : []).catch(() => [])
            if (localR?.[0]?.id) localId = localR[0].id
          }
          const localFotos = await downloadSupabaseFiles(d.fotos)
          const { id: _id, _usuario_id: _uid, _libro_id: _lid, _nombre_usuario: _nu, ...resenaData } = d
          await fetch(`${LOCAL_PG}/resenas?id=eq.${localId}`, {
            method: "PATCH",
            body: JSON.stringify({ ...resenaData, fotos: localFotos }),
            headers: { "Content-Type": "application/json", Prefer: "return=minimal" },
          }).catch(() => {})
          break
        }
        case "resena_eliminar": {
          let localId = d.id
          if (d._usuario_id && d._libro_id) {
            let uid = d._usuario_id
            if (d._nombre_usuario) {
              const localUser = await fetch(`${LOCAL_PG}/usuario?nombre_usuario=eq.${encodeURIComponent(d._nombre_usuario)}&select=id`)
                .then(r => r.ok ? r.json() : []).catch(() => [])
              if (localUser?.[0]?.id) uid = localUser[0].id
            }
            const localR = await fetch(
              `${LOCAL_PG}/resenas?usuario_id=eq.${encodeURIComponent(uid)}&libro_id=eq.${d._libro_id}&select=id`
            ).then(r => r.ok ? r.json() : []).catch(() => [])
            if (localR?.[0]?.id) localId = localR[0].id
          }
          await fetch(`${LOCAL_PG}/resenas?id=eq.${localId}`, {
            method: "DELETE",
            headers: { "Content-Type": "application/json", Prefer: "return=minimal" },
          }).catch(() => {})
          break
        }
        case "marcar_leido": {
          const leidosRes = await fetch(`${LOCAL_PG}/listas?usuario_id=eq.${d.usuario_id}&nombre=eq.Leídos&select=id`).catch(() => null)
          const leidosList = leidosRes?.ok ? await leidosRes.json() : []
          const listaId = leidosList?.[0]?.id
          if (listaId) {
            await fetch(`${LOCAL_PG}/listas_libros`, {
              method: "POST",
              body: JSON.stringify({ lista_id: listaId, libro_id: d.libro_id }),
              headers: { "Content-Type": "application/json", Prefer: "return=minimal" },
            }).catch(() => {})
          }
          const porLeerRes = await fetch(`${LOCAL_PG}/listas?usuario_id=eq.${d.usuario_id}&nombre=eq.Por leer&select=id`).catch(() => null)
          const porLeerList = porLeerRes?.ok ? await porLeerRes.json() : []
          const porLeerId = porLeerList?.[0]?.id
          if (porLeerId) {
            await fetch(`${LOCAL_PG}/listas_libros?lista_id=eq.${porLeerId}&libro_id=eq.${d.libro_id}`, {
              method: "DELETE",
              headers: { "Content-Type": "application/json", Prefer: "return=minimal" },
            }).catch(() => {})
          }
          break
        }
        case "multa_pagada": {
          await fetch(`${LOCAL_PG}/multas?id=eq.${d.multaId}`, {
            method: "PATCH",
            body: JSON.stringify({ pagada: true }),
            headers: { "Content-Type": "application/json", Prefer: "return=minimal" },
          })
          // Generate PDF locally
          generarMultaPDF(d.multaId).catch(err => console.error("Error generando PDF multa:", err))
          break
        }
        case "crear_pedido": {
          const grupoBody = { usuario_id: d.usuario_id }
          if (d.fecha_devolucion) grupoBody.fecha_devolucion_esperada = d.fecha_devolucion
          const grupoRes = await fetch(`${LOCAL_PG}/prestamos_grupo`, {
            method: "POST",
            body: JSON.stringify(grupoBody),
            headers: { "Content-Type": "application/json", Prefer: "return=representation" },
          })
          const grupo = grupoRes.ok ? await grupoRes.json() : null
          const grupoId = Array.isArray(grupo) ? grupo[0]?.id : grupo?.id
          if (grupoId && d.libro_ids) {
            for (const [libroIdStr, cantidad] of Object.entries(d.libro_ids)) {
              const libroId = Number(libroIdStr)
              for (let i = 0; i < cantidad; i++) {
                await fetch(`${LOCAL_PG}/prestamos`, {
                  method: "POST",
                  body: JSON.stringify({ usuario_id: d.usuario_id, libro_id: libroId, grupo_id: grupoId }),
                  headers: { "Content-Type": "application/json", Prefer: "return=minimal" },
                }).catch(() => {})
              }
            }
          }
          break
        }
        case "lista_agregar": {
          await fetch(`${LOCAL_PG}/listas_libros`, {
            method: "POST",
            body: JSON.stringify({ lista_id: d.lista_id, libro_id: d.libro_id }),
            headers: { "Content-Type": "application/json", Prefer: "return=minimal" },
          }).catch(() => {})
          break
        }
        case "lista_quitar": {
          await fetch(`${LOCAL_PG}/listas_libros?lista_id=eq.${d.lista_id}&libro_id=eq.${d.libro_id}`, {
            method: "DELETE",
            headers: { "Content-Type": "application/json", Prefer: "return=minimal" },
          }).catch(() => {})
          break
        }
        case "lista_crear": {
          // Download any Supabase-hosted list image to local
          const localImagen = await downloadSupabaseFile(d.imagen)
          await fetch(`${LOCAL_PG}/listas`, {
            method: "POST",
            body: JSON.stringify({ ...d, imagen: localImagen || d.imagen }),
            headers: { "Content-Type": "application/json", Prefer: "return=minimal" },
          }).catch(() => {})
          break
        }
        case "lista_editar": {
          const localImagen = await downloadSupabaseFile(d.imagen)
          await fetch(`${LOCAL_PG}/listas?id=eq.${d.id}`, {
            method: "PATCH",
            body: JSON.stringify({ ...d, imagen: localImagen || d.imagen }),
            headers: { "Content-Type": "application/json", Prefer: "return=minimal" },
          }).catch(() => {})
          break
        }
        case "agregar_carrito": {
          await fetch(`${LOCAL_PG}/carrito`, {
            method: "POST",
            body: JSON.stringify({
              usuario_id: d.usuario_id,
              libro_id: d.libro_id,
              cantidad: d.cantidad || 1,
            }),
            headers: { "Content-Type": "application/json", Prefer: "return=minimal" },
          }).catch(() => {})
          break
        }
        case "quitar_carrito": {
          if (d.libro_id === -1) {
            await fetch(`${LOCAL_PG}/carrito?usuario_id=eq.${d.usuario_id}`, {
              method: "DELETE",
              headers: { "Content-Type": "application/json", Prefer: "return=minimal" },
            }).catch(() => {})
          } else {
            await fetch(`${LOCAL_PG}/carrito?usuario_id=eq.${d.usuario_id}&libro_id=eq.${d.libro_id}`, {
              method: "DELETE",
              headers: { "Content-Type": "application/json", Prefer: "return=minimal" },
            }).catch(() => {})
          }
          break
        }
        case "notificacion_leida": {
          await fetch(`${LOCAL_PG}/notificaciones?id=eq.${d.id}`, {
            method: "PATCH",
            body: JSON.stringify({ leida: true }),
            headers: { "Content-Type": "application/json", Prefer: "return=minimal" },
          }).catch(() => {})
          break
        }
        case "notificaciones_todas_leidas": {
          await fetch(`${LOCAL_PG}/notificaciones?usuario_id=eq.${encodeURIComponent(d.usuario_id)}&leida=eq.false`, {
            method: "PATCH",
            body: JSON.stringify({ leida: true }),
            headers: { "Content-Type": "application/json", Prefer: "return=minimal" },
          }).catch(() => {})
          break
        }
        case "eliminar_notificacion": {
          await fetch(`${LOCAL_PG}/notificaciones?id=eq.${d.id}`, {
            method: "DELETE",
            headers: { "Content-Type": "application/json", Prefer: "return=minimal" },
          }).catch(() => {})
          break
        }
        case "perfil_actualizar": {
          let uid = d.id
          if (d._nombre_usuario) {
            const localUser = await fetch(`${LOCAL_PG}/usuario?nombre_usuario=eq.${encodeURIComponent(d._nombre_usuario)}&select=id`)
              .then(r => r.ok ? r.json() : []).catch(() => [])
            if (localUser?.[0]?.id) uid = localUser[0].id
          }
          const localFoto = await downloadSupabaseFile(d.datos?.foto_perfil)
          const datos = { ...d.datos }
          if (localFoto) datos.foto_perfil = localFoto
          await fetch(`${LOCAL_PG}/usuario?id=eq.${uid}`, {
            method: "PATCH",
            body: JSON.stringify(datos),
            headers: { "Content-Type": "application/json", Prefer: "return=minimal" },
          }).catch(() => {})
          break
        }
      }
      await markProcessed(a.id)
      results.push({ id: a.id, accion: a.accion, ok: true })
    } catch (err) {
      results.push({ id: a.id, accion: a.accion, error: err.message })
    }
  }
  return results
}
