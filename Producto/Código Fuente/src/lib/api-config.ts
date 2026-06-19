const SUPABASE_PROJECT = "https://xelzdjgoxwddgjqouywm.supabase.co"
const SUPABASE_URL = `${SUPABASE_PROJECT}/rest/v1`
const SUPABASE_STORAGE = `${SUPABASE_PROJECT}/storage/v1`
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhlbHpkamdveHdkZGdqcW91eXdtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYzODM3MzQsImV4cCI6MjA5MTk1OTczNH0.C3BIBRqIM1PSliMQPKFtJVMujFFDewNTr1TU8EU9Ask"

export type ApiMode = "local" | "supabase"

export function getApiMode(): ApiMode {
  const stored = localStorage.getItem("api_mode")
  if (stored === "local" || stored === "supabase") return stored
  // Default: supabase on Netlify, local everywhere else (localhost / LAN)
  if (typeof window !== "undefined" && window.location.hostname.includes("netlify.app")) {
    return "supabase"
  }
  return "local"
}

export function setApiMode(mode: ApiMode) {
  localStorage.setItem("api_mode", mode)
}

// Custom host for LAN access. Read from localStorage first, then configuracion table.
let _customHostCache = localStorage.getItem("custom_host") || ""

export function getCustomHost(): string {
  return _customHostCache
}

export function setCustomHost(host: string) {
  _customHostCache = host.trim()
  localStorage.setItem("custom_host", _customHostCache)
}

function getLocalBase(): string {
  // If custom host is set (via Admin UI), use it
  if (_customHostCache) return `http://${_customHostCache}`
  // If page loaded from LAN IP, auto-detect it
  if (window.location.hostname !== "localhost" && window.location.hostname !== "127.0.0.1") {
    _customHostCache = window.location.hostname
    return `http://${window.location.hostname}`
  }
  return "http://localhost"
}

// Attempt to load custom_host from configuracion table (if not in localStorage yet)
export async function initCustomHost() {
  if (_customHostCache) return
  try {
    const mode = getApiMode()
    const baseUrl = mode === "supabase" ? SUPABASE_URL : "http://localhost:3000"
    const headers: Record<string, string> = {}
    if (mode === "supabase") {
      headers["apikey"] = SUPABASE_KEY
      headers["Authorization"] = `Bearer ${SUPABASE_KEY}`
    }
    const res = await fetch(`${baseUrl}/configuracion?clave=eq.custom_host&select=valor`, { headers })
    const data = await res.json() as { valor: string }[]
    if (data?.[0]?.valor) {
      _customHostCache = data[0].valor
      localStorage.setItem("custom_host", _customHostCache)
    }
  } catch { /* use empty/default */ }
}

export function getApiUrl(): string {
  if (getApiMode() === "supabase") return SUPABASE_URL
  return `${getLocalBase()}:3000`
}

export function getServerUrl(): string {
  return import.meta.env.VITE_SERVER_URL || `${getLocalBase()}:4000`
}

export function getUploadUrl(): string {
  if (getApiMode() === "supabase") {
    return `${SUPABASE_STORAGE}/object/public/uploads`
  }
  return getServerUrl()
}

export function getStorageUploadUrl(): string {
  if (getApiMode() === "supabase") {
    return `${SUPABASE_STORAGE}/object/uploads`
  }
  return `${getServerUrl()}/uploads`
}

export function getStorageApiBase(): string {
  if (getApiMode() === "supabase") {
    return `${SUPABASE_STORAGE}/object`
  }
  return getServerUrl()
}

export function getStorageHeaders(): Record<string, string> {
  if (getApiMode() === "supabase") {
    return {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
    }
  }
  return {}
}

export function getApiHeaders(): Record<string, string> {
  return getStorageHeaders()
}
