const crypto = require("crypto")

const SUPABASE_URL = process.env.SUPABASE_URL || "https://xelzdjgoxwddgjqouywm.supabase.co/rest/v1"
const SUPABASE_KEY = process.env.SUPABASE_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhlbHpkamdveHdkZGdqcW91eXdtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYzODM3MzQsImV4cCI6MjA5MTk1OTczNH0.C3BIBRqIM1PSliMQPKFtJVMujFFDewNTr1TU8EU9Ask"
const FLOW_API_KEY = process.env.FLOW_API_KEY || "4BB5F012-0DAE-4EAD-BCFF-2ALB84C0E362"
const FLOW_SECRET = process.env.FLOW_SECRET || "b7375a038158f5b8e54814eb774d791c58ad144d"

function flowSign(params, secret) {
  const keys = Object.keys(params).sort()
  const toSign = keys.map(k => `${k}${params[k]}`).join("")
  return crypto.createHmac("sha256", secret).update(toSign).digest("hex")
}

exports.handler = async (event) => {
  try {
    // Flow sends webhook as form-urlencoded body
    const body = new URLSearchParams(event.body || "")
    const token = body.get("token")
    if (!token) return { statusCode: 200, body: "OK" }

    const params = { apiKey: FLOW_API_KEY, token }
    params.s = flowSign(params, FLOW_SECRET)

    const queryStr = Object.keys(params)
      .map(k => `${k}=${encodeURIComponent(params[k])}`)
      .join("&")

    const statusRes = await fetch(
      `https://sandbox.flow.cl/api/payment/getStatus?${queryStr}`
    )
    const status = await statusRes.json()

    if (status?.status === 2) {
      // Find multas by stored token, or fall back to all unpaid
      let multas = await fetch(
        `${SUPABASE_URL}/multas?id_preferencia_mp=eq.${encodeURIComponent(token)}&select=id`,
        { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } }
      ).then(r => r.json())

      if (!multas?.length) {
        multas = await fetch(
          `${SUPABASE_URL}/multas?pagada=eq.false&select=id`,
          { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } }
        ).then(r => r.json())
      }

      for (const m of (multas || [])) {
        await fetch(`${SUPABASE_URL}/multas?id=eq.${m.id}`, {
          method: "PATCH",
          body: JSON.stringify({ pagada: true }),
          headers: {
            apikey: SUPABASE_KEY,
            Authorization: `Bearer ${SUPABASE_KEY}`,
            "Content-Type": "application/json",
          },
        })
        // Queue for local sync
        await fetch(`${SUPABASE_URL}/acciones_pendientes`, {
          method: "POST",
          body: JSON.stringify({ accion: "multa_pagada", datos: { multaId: m.id } }),
          headers: {
            apikey: SUPABASE_KEY,
            Authorization: `Bearer ${SUPABASE_KEY}`,
            "Content-Type": "application/json",
            Prefer: "return=minimal",
          },
        }).catch(() => {})
      }
    }

    return { statusCode: 200, body: "OK" }
  } catch (err) {
    console.error("Webhook error:", err)
    return { statusCode: 200, body: "OK" }
  }
}
