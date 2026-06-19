import { getApiMode, getStorageUploadUrl, getUploadUrl, getStorageApiBase, getStorageHeaders, getServerUrl } from "./api-config"

export function slugify(text: string): string {
  if (!text) return ""
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .substring(0, 40)
}

export interface UploadedFile {
  name: string
  url: string
  size: number
  modified: string
}

function generateFileName(file: File): string {
  const ext = file.name.split(".").pop() || "png"
  return `${crypto.randomUUID()}.${ext}`
}

// ====== SUPABASE STORAGE ======

async function uploadToStorage(folder: string, file: File, idParam?: string, fixedName?: string): Promise<string> {
  const baseUrl = getStorageUploadUrl()
  const fileName = fixedName || generateFileName(file)
  const idPath = idParam ? `${idParam}/` : ""
  const path = `${folder}/${idPath}${fileName}`
  
  const res = await fetch(`${baseUrl}/${path}`, {
    method: "POST",
    headers: {
      ...getStorageHeaders(),
      "Content-Type": file.type || "application/octet-stream",
      "x-upsert": "true",
    },
    body: file,
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Error al subir: ${err}`)
  }
  return path
}

async function listStorageFiles(folder: string, idParam?: string): Promise<UploadedFile[]> {
  const apiBase = getStorageApiBase()
  const prefix = idParam ? `${folder}/${idParam}/` : `${folder}/`
  
  try {
    const res = await fetch(`${apiBase}/list/uploads`, {
      method: "POST",
      headers: { ...getStorageHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({
        prefix,
        limit: 100,
        offset: 0,
      }),
    })
    if (!res.ok) {
      console.error(`listStorageFiles failed: ${res.status} ${await res.text()}`)
      return []
    }
    const data = await res.json()
    return (data || [])
      .filter((f: any) => f.id !== null)
      .map((f: any) => ({
        name: f.name,
        url: `/${folder}/${idParam ?? ""}/${f.name}`.replace("//", "/"),
        size: f.metadata?.size ?? 0,
        modified: f.metadata?.lastModified ?? f.updated_at ?? "",
      }))
  } catch (err) {
    console.error("listStorageFiles error:", err)
    return []
  }
}

async function deleteStorageFile(folder: string, fileName: string, idParam?: string): Promise<void> {
  const uploadBase = getStorageUploadUrl()
  const idPath = idParam ? `${idParam}/` : ""
  const res = await fetch(`${uploadBase}/${folder}/${idPath}${fileName}`, {
    method: "DELETE",
    headers: getStorageHeaders(),
  })
  if (!res.ok) throw new Error("Error al eliminar archivo")
}

// ====== PUBLIC API ======

export async function uploadFile(
  file: File,
  tipo: "avatar" | "caratula" | "lista" | "mapa",
  idParam?: string
): Promise<string> {
  if (getApiMode() === "supabase") {
    const folder = tipo === "avatar" ? "avatares" : tipo === "caratula" ? "caratulas" : tipo === "lista" ? "listas" : "mapa"
    const fixedName = tipo === "caratula" ? "cover" + (file.name.includes(".") ? file.name.slice(file.name.lastIndexOf(".")) : ".png") : undefined
    const path = await uploadToStorage(folder, file, idParam, fixedName)
    return `${getUploadUrl()}/${path}`
  }

  // LOCAL mode
  const server = getUploadUrl().replace("/uploads", "")
  const formData = new FormData()
  formData.append(tipo, file)

  const key = tipo === "avatar" || tipo === "lista" ? "userId" : tipo === "caratula" ? "libroId" : undefined
  const params = key && idParam ? `?${key}=${encodeURIComponent(idParam)}` : ""
  const res = await fetch(`${server}/upload/${tipo}${params}`, {
    method: "POST",
    body: formData,
  })

  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: "Error al subir archivo" }))
    throw new Error(error.error || "Error al subir archivo")
  }

  const data = await res.json()
  return `${getServerUrl()}${data.url}`
}

export async function listAvatars(userId: string): Promise<UploadedFile[]> {
  if (getApiMode() === "supabase") {
    return listStorageFiles("avatares", userId)
  }

  const res = await fetch(`${getServerUrl()}/upload/avatares?userId=${encodeURIComponent(userId)}`)
  if (!res.ok) return []
  return res.json()
}

export async function deleteAvatar(name: string, userId: string): Promise<void> {
  if (getApiMode() === "supabase") {
    return deleteStorageFile("avatares", name, userId)
  }

  const res = await fetch(
    `${getServerUrl()}/upload/avatares/${encodeURIComponent(name)}?userId=${encodeURIComponent(userId)}`,
    { method: "DELETE" }
  )
  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: "Error al eliminar" }))
    throw new Error(error.error || "Error al eliminar")
  }
}

export async function listCaratulas(libroId: number): Promise<UploadedFile[]> {
  if (getApiMode() === "supabase") {
    return listStorageFiles("caratulas", String(libroId))
  }

  const res = await fetch(`${getServerUrl()}/upload/caratulas?libroId=${encodeURIComponent(libroId)}`)
  if (!res.ok) return []
  return res.json()
}

export async function deleteCaratulaDir(libroId: number): Promise<void> {
  // Only used locally
  const res = await fetch(
    `${getServerUrl()}/upload/caratulas-dir/${encodeURIComponent(libroId)}`,
    { method: "DELETE" }
  )
  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: "Error al eliminar" }))
    throw new Error(error.error || "Error al eliminar")
  }
}

export async function fetchCaratula(isbn: string, libroId: number): Promise<string> {
  const res = await fetch(`${getServerUrl()}/fetch/caratula`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ isbn, libroId }),
  })
  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: "Error al buscar carátula" }))
    throw new Error(error.error || "Error al buscar carátula")
  }
  const data = await res.json()
  return `${getServerUrl()}${data.url}`
}

export async function fetchCaratulaGoogle(titulo: string, autor: string, libroId: number): Promise<string> {
  const res = await fetch(`${getServerUrl()}/fetch/caratula-google`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ titulo, autor, libroId }),
  })
  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: "Error al buscar carátula" }))
    throw new Error(error.error || "Error al buscar carátula")
  }
  const data = await res.json()
  return `${getServerUrl()}${data.url}`
}

export async function deleteCaratula(name: string, libroId: number): Promise<void> {
  if (getApiMode() === "supabase") {
    return deleteStorageFile("caratulas", name, String(libroId))
  }

  const res = await fetch(
    `${getServerUrl()}/upload/caratulas/${encodeURIComponent(name)}?libroId=${encodeURIComponent(libroId)}`,
    { method: "DELETE" }
  )
  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: "Error al eliminar" }))
    throw new Error(error.error || "Error al eliminar")
  }
}

export async function uploadResenaFoto(file: File, userId: string): Promise<string> {
  if (getApiMode() === "supabase") {
    const path = await uploadToStorage("resenas", file, userId)
    return `${getUploadUrl()}/${path}`
  }
  const formData = new FormData()
  formData.append("foto", file)
  const res = await fetch(`${getServerUrl()}/upload/resena-foto?userId=${encodeURIComponent(userId)}`, {
    method: "POST",
    body: formData,
  })
  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: "Error al subir foto" }))
    throw new Error(error.error || "Error al subir foto")
  }
  const data = await res.json() as { url: string }
  return `${getServerUrl()}${data.url}`
}

export async function deleteUploadedFile(url: string, userId: string): Promise<void> {
  if (!url) return
  // Extract relative path: "avatares/userId/file.png" or "listas/userId/file.png"
  let relPath = ""
  const m = url.match(/\/(?:uploads\/)?(avatares|listas|resenas)\/(.+)$/)
  if (m) {
    relPath = `${m[1]}/${m[2]}`
  } else {
    const m2 = url.match(/\/storage\/v1\/object\/public\/uploads\/(avatares|listas|resenas)\/(.+)$/)
    if (m2) relPath = `${m2[1]}/${m2[2]}`
  }
  if (!relPath) return

  const parts = relPath.split("/")
  const folder = parts[0]
  const filename = parts[parts.length - 1]

  if (getApiMode() === "supabase") {
    await deleteStorageFile(folder, filename, userId)
  } else {
    await fetch(
      `${getServerUrl()}/upload/${folder}/${encodeURIComponent(filename)}?userId=${encodeURIComponent(userId)}`,
      { method: "DELETE" }
    )
  }
}
