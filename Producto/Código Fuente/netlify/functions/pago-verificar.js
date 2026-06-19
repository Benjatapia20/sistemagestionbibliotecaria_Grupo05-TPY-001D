const crypto = require("crypto")

const FLOW_API_KEY = process.env.FLOW_API_KEY || "4BB5F012-0DAE-4EAD-BCFF-2ALB84C0E362"
const FLOW_SECRET = process.env.FLOW_SECRET || "b7375a038158f5b8e54814eb774d791c58ad144d"

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
    const { token } = JSON.parse(event.body || "{}")
    if (!token) {
      return { statusCode: 400, body: JSON.stringify({ error: "token requerido" }) }
    }

    const params = { apiKey: FLOW_API_KEY, token }
    params.s = flowSign(params, FLOW_SECRET)
    const queryStr = Object.keys(params)
      .map(k => `${k}=${encodeURIComponent(params[k])}`)
      .join("&")

    const statusRes = await fetch(
      `https://sandbox.flow.cl/api/payment/getStatus?${queryStr}`
    )
    const status = await statusRes.json()

    return {
      statusCode: 200,
      body: JSON.stringify({
        status: status?.status,
        paid: status?.status === 2,
      }),
    }
  } catch (err) {
    console.error("pago-verificar error:", err)
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) }
  }
}
