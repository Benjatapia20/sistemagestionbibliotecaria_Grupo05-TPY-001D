const LOCAL_PG = process.env.POSTGREST_URL || "http://postgrest:3000"
const SUPABASE_URL = process.env.SUPABASE_URL || "https://xelzdjgoxwddgjqouywm.supabase.co/rest/v1"
const SUPABASE_KEY = process.env.SUPABASE_KEY || ""
const USE_SUPABASE = process.env.USE_SUPABASE === "true"

export function getPgUrl() {
  return USE_SUPABASE ? SUPABASE_URL : LOCAL_PG
}

export function getPgHeaders() {
  if (USE_SUPABASE && SUPABASE_KEY) {
    return { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }
  }
  return {}
}

export async function pgRequest(path, options = {}) {
  const url = `${getPgUrl()}${path}`
  const headers = { ...getPgHeaders(), ...options.headers }
  const res = await fetch(url, { ...options, headers })
  if (options.method === "DELETE") return null
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`API error: ${err}`)
  }
  const text = await res.text()
  return text ? JSON.parse(text) : null
}
