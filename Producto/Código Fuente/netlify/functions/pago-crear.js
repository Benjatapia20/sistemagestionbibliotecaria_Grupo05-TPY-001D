const crypto = require("crypto")

const SUPABASE_URL = process.env.SUPABASE_URL || "https://xelzdjgoxwddgjqouywm.supabase.co/rest/v1"
const SUPABASE_KEY = process.env.SUPABASE_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhlbHpkamdveHdkZGdqcW91eXdtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYzODM3MzQsImV4cCI6MjA5MTk1OTczNH0.C3BIBRqIM1PSliMQPKFtJVMujFFDewNTr1TU8EU9Ask"
const FLOW_API_KEY = process.env.FLOW_API_KEY || "4BB5F012-0DAE-4EAD-BCFF-2ALB84C0E362"
const FLOW_SECRET = process.env.FLOW_SECRET || "b7375a038158f5b8e54814eb774d791c58ad144d"
const APP_URL = process.env.APP_URL || "https://proyectogestionbiblioteca.netlify.app"

async function supabaseRequest(path, options = {}) {
  const headers = {
    apikey: SUPABASE_KEY,
    Authorization: `Bearer ${SUPABASE_KEY}`,
    ...options.headers,
  }
  const res = await fetch(`${SUPABASE_URL}${path}`, { ...options, headers })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Supabase error: ${err}`)
  }
  const text = await res.text()
  return text ? JSON.parse(text) : null
}

function flowSign(params, secret) {
  const keys = Object.keys(params).sort()
  const toSign = keys.map(k => `${k}${params[k]}`).join("")
  return crypto.createHmac("sha256", secret).update(toSign).digest("hex")
}

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" }
  }

  try {
    const { usuarioId } = JSON.parse(event.body)
    if (!usuarioId) {
      return { statusCode: 400, body: JSON.stringify({ error: "usuarioId requerido" }) }
    }

    if (!FLOW_API_KEY || !FLOW_SECRET || !SUPABASE_URL || !SUPABASE_KEY) {
      return { statusCode: 500, body: JSON.stringify({ error: "Variables de entorno no configuradas" }) }
    }

    const multas = await supabaseRequest(
      `/multas?usuario_id=eq.${encodeURIComponent(usuarioId)}&pagada=eq.false&select=monto`
    )

    if (!multas?.length) {
      return { statusCode: 400, body: JSON.stringify({ error: "No hay multas pendientes" }) }
    }

    const total = multas.reduce((s, m) => s + m.monto, 0)

    const params = {
      apiKey: FLOW_API_KEY,
      commerceOrder: `multas-${Date.now()}`,
      subject: "Pago de multas - Biblioteca",
      currency: "CLP",
      amount: total,
      email: "joakinvillalon@gmail.com",
      urlConfirmation: `${APP_URL}/.netlify/functions/pago-webhook`,
      urlReturn: `${APP_URL}/.netlify/functions/pago-retorno`,
    }
    params.s = flowSign(params, FLOW_SECRET)

    const formBody = Object.keys(params)
      .map(k => `${encodeURIComponent(k)}=${encodeURIComponent(params[k])}`)
      .join("&")

    const flowRes = await fetch("https://sandbox.flow.cl/api/payment/create", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: formBody,
    })

    const result = await flowRes.json()

    if (result.url && result.token) {
      // Save Flow token on unpaid multas for this user
      await supabaseRequest(`/multas?usuario_id=eq.${encodeURIComponent(usuarioId)}&pagada=eq.false`, {
        method: "PATCH",
        body: JSON.stringify({ id_preferencia_mp: result.token }),
        headers: { "Content-Type": "application/json", Prefer: "return=minimal" },
      }).catch(() => {})
      
      return {
        statusCode: 200,
        body: JSON.stringify({ url: `${result.url}?token=${result.token}` }),
      }
    }

    return { statusCode: 500, body: JSON.stringify({ error: "Error al crear orden en Flow" }) }
  } catch (err) {
    console.error("Flow function error:", err)
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) }
  }
}
