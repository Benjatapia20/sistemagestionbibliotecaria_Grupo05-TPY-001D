import { createHmac } from "node:crypto"
import { generarMultaPDF } from "./multas-pdf.js"
import { existsSync, readFileSync, mkdirSync } from "node:fs"
import { join } from "node:path"
import { pgRequest } from "./pg.js"

const FLOW_API_KEY = process.env.FLOW_API_KEY || ""
const FLOW_SECRET = process.env.FLOW_SECRET || ""
const APP_URL = process.env.APP_URL || "http://localhost:5173"
const FLOW_API = process.env.FLOW_API_URL || "https://sandbox.flow.cl/api"
const UPLOADS = process.env.UPLOADS_DIR || "uploads"

function flowSign(params) {
  const keys = Object.keys(params).sort()
  const toSign = keys.map(k => `${k}${params[k]}`).join("")
  return createHmac("sha256", FLOW_SECRET).update(toSign).digest("hex")
}

export function setupFlow(app) {
  app.post("/pago/crear", async (req, res) => {
    try {
      const { usuarioId, email, multasIds } = req.body
      if (!usuarioId) return res.status(400).json({ error: "usuarioId requerido" })

      let ids = multasIds
      if (!ids) {
        const multas = await pgRequest(
          `/multas?usuario_id=eq.${encodeURIComponent(usuarioId)}&pagada=eq.false&select=*&order=created_at.asc`
        )
        ids = multas?.map(m => m.id) ?? []
      }
      if (!ids.length) return res.status(400).json({ error: "No hay multas pendientes" })

      const multasData = await pgRequest(`/multas?id=in.(${ids.join(",")})&select=monto`)
      const total = multasData.reduce((s, m) => s + m.monto, 0)

      const commerceOrder = `multas-${Date.now()}-${ids.join("-").slice(0, 30)}`
      const subject = "Pago de multas - Biblioteca"
      const currency = "CLP"
      const userEmail = email || "joakinvillalon@gmail.com"

      const params = { apiKey: FLOW_API_KEY, commerceOrder, subject, currency, amount: total, email: userEmail, urlConfirmation: `${process.env.SERVER_URL || "http://localhost:4000"}/pago/webhook`, urlReturn: `${APP_URL}/mis-pedidos#pago=exito` }
      params.s = flowSign(params)

      const formBody = Object.keys(params).map(k => `${encodeURIComponent(k)}=${encodeURIComponent(params[k])}`).join("&")

      const flowRes = await fetch(`${FLOW_API}/payment/create`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: formBody,
      })

      const result = await flowRes.json()

      if (result.url && result.token) {
        await pgRequest(`/multas?id=in.(${ids.join(",")})`, {
          method: "PATCH",
          body: JSON.stringify({ id_preferencia_mp: result.token }),
          headers: { "Content-Type": "application/json" },
        })
        res.json({ url: `${result.url}?token=${result.token}` })
      } else {
        res.status(500).json({ error: "Error al crear orden en Flow" })
      }
    } catch (err) {
      console.error("Error Flow:", err.message || err)
      res.status(500).json({ error: "Error al crear orden de pago" })
    }
  })

  app.post("/pago/webhook", async (req, res) => {
    try {
      const { token } = req.body
      if (!token) return res.sendStatus(200)

      const params = { apiKey: FLOW_API_KEY, token }
      params.s = flowSign(params)

      const queryStr = Object.keys(params).map(k => `${k}=${encodeURIComponent(params[k])}`).join("&")
      const statusRes = await fetch(`${FLOW_API}/payment/getStatus?${queryStr}`)
      const status = await statusRes.json()

      if (status?.status === 2) {
        const multas = await pgRequest(`/multas?id_preferencia_mp=eq.${token}&select=id,usuario_id`)
        for (const m of (multas || [])) {
          await pgRequest(`/multas?id=eq.${m.id}`, {
            method: "PATCH",
            body: JSON.stringify({ pagada: true }),
            headers: { "Content-Type": "application/json" },
          })
          generarMultaPDF(m.id).catch(err => console.error("Error generando PDF multa:", err))
        }
      }
      res.sendStatus(200)
    } catch (err) {
      console.error("Error webhook Flow:", err)
      res.sendStatus(200)
    }
  })

  app.post("/pago/marcar-pagada", async (req, res) => {
    try {
      const { multaId } = req.body
      if (!multaId) return res.status(400).json({ error: "multaId requerido" })
      await pgRequest(`/multas?id=eq.${multaId}`, {
        method: "PATCH",
        body: JSON.stringify({ pagada: true }),
        headers: { "Content-Type": "application/json" },
      })
      generarMultaPDF(multaId).catch(err => console.error("Error generando PDF multa:", err))
      res.json({ success: true })
    } catch (err) {
      console.error("Error marcando multa:", err)
      res.status(500).json({ error: "Error al marcar multa" })
    }
  })

  app.get("/multas-pdf/:multaId", async (req, res) => {
    try {
      const multaId = parseInt(req.params.multaId)
      if (isNaN(multaId)) return res.status(400).json({ error: "ID inválido" })

      const multas = await pgRequest(`/multas?id=eq.${multaId}&select=id,usuario_id`)
      if (!multas?.length) return res.status(404).json({ error: "Multa no encontrada" })

      const uid = multas[0].usuario_id?.substring(0, 8) || "anon"
      const filePath = join(UPLOADS, "multas-pdf", uid, `${multaId}.pdf`)

      if (existsSync(filePath)) {
        res.setHeader("Content-Type", "application/pdf")
        res.setHeader("Content-Disposition", `inline; filename="multa-${multaId}.pdf"`)
        res.send(readFileSync(filePath))
      } else {
        res.setHeader("Content-Type", "application/pdf")
        res.setHeader("Content-Disposition", `inline; filename="multa-${multaId}.pdf"`)
        await generarMultaPDF(multaId)
        if (existsSync(filePath)) {
          res.send(readFileSync(filePath))
        } else {
          res.status(404).json({ error: "PDF no disponible" })
        }
      }
    } catch (err) {
      console.error("Error multas-pdf:", err)
      res.status(500).json({ error: "Error al generar PDF" })
    }
  })

  app.post("/pago/verificar", async (req, res) => {
    try {
      const { token } = req.body
      if (!token) return res.status(400).json({ error: "token requerido" })

      const params = { apiKey: FLOW_API_KEY, token }
      params.s = flowSign(params)
      const queryStr = Object.keys(params).map(k => `${k}=${encodeURIComponent(params[k])}`).join("&")
      const statusRes = await fetch(`${FLOW_API}/payment/getStatus?${queryStr}`)
      const status = await statusRes.json()

      res.json({ status: status?.status, paid: status?.status === 2 })
    } catch (err) {
      console.error("Error verificando pago:", err)
      res.status(500).json({ error: "Error al verificar pago" })
    }
  })
}
