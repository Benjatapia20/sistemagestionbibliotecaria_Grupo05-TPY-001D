import PDFDocument from "pdfkit"
import QRCode from "qrcode"
import { createWriteStream, existsSync, mkdirSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { pgRequest } from "./pg.js"

const UPLOADS = process.env.UPLOADS_DIR || "uploads"

async function buildDoc(grupoId) {
  const grupo = await pgRequest(`/prestamos_grupo?id=eq.${grupoId}&select=*`).then(r => r[0])
  if (!grupo) return null

  const prestamos = await pgRequest(
    `/prestamos?grupo_id=eq.${grupoId}&select=id,estado,libro:libros(titulo,autor:autores(nombre)),ejemplar:ejemplares(codigo)`
  )

  const usuario = await pgRequest(
    `/usuario?id=eq.${encodeURIComponent(grupo.usuario_id)}&select=primer_nombre,apellido_paterno,nombre_usuario,email`
  ).then(r => r[0])

  return { grupo, prestamos, usuario }
}

async function fillDoc(doc, data) {
  const { grupo, prestamos, usuario } = data
  const nombreUsuario = usuario
    ? `${usuario.primer_nombre ?? ""} ${usuario.apellido_paterno ?? ""}`.trim() || `@${usuario.nombre_usuario}`
    : "—"

  const codigo = data.grupo.codigo || `PED-${data.grupo.id}`

  const fecha = new Date(grupo.created_at).toLocaleDateString("es-CL", { timeZone: "America/Santiago" })
  const devolucion = grupo.fecha_devolucion_esperada
    ? new Date(grupo.fecha_devolucion_esperada).toLocaleDateString("es-CL", { timeZone: "America/Santiago" })
    : "—"

  const qrDataUrl = await QRCode.toDataURL(codigo, { width: 160, margin: 1, color: { dark: "#000000", light: "#ffffff" } })

  doc.fontSize(22).font("Helvetica-Bold").text("Comprobante de Pedido", { align: "center" })
  doc.moveDown(0.5)
  doc.fontSize(14).font("Helvetica").text(codigo, { align: "center" })
  doc.moveDown()

  doc.fontSize(11)
  doc.text(`Usuario: ${nombreUsuario}`)
  if (usuario?.email) doc.text(`Email: ${usuario.email}`)
  doc.text(`Fecha del pedido: ${fecha}`)
  doc.text(`Devolución estimada: ${devolucion}`)
  if (grupo.lugar_retiro) doc.text(`Lugar de retiro: ${grupo.lugar_retiro}`)
  doc.moveDown()

  doc.fontSize(12).font("Helvetica-Bold").text("Libros incluidos:")
  doc.moveDown(0.5)

  doc.fontSize(10).font("Helvetica")
  let y = doc.y
  for (let i = 0; i < (prestamos || []).length; i++) {
    const p = prestamos[i]
    const noDisp = p.estado === "no_disponible" || p.estado === "solicita_aprobacion"
    doc.text(`${i + 1}. ${p.libro?.titulo ?? "—"} — ${p.libro?.autor?.nombre ?? "—"}${noDisp ? " (No disponible)" : ""}`)
    y += 14
    if (p.ejemplar?.codigo) {
      doc.fontSize(9).text(`    Código: ${p.ejemplar.codigo}`)
      y += 12
    }
    doc.fontSize(10)
    if (y > 700) {
      doc.addPage()
      y = 50
    }
  }

  doc.moveDown()
  doc.fontSize(8).font("Helvetica").text("Código del pedido:", { align: "center", color: "gray" })
  doc.moveDown(0.3)
  const qrSize = 70
  const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right
  const qrX = (pageWidth - qrSize) / 2 + doc.page.margins.left
  doc.image(qrDataUrl, qrX, doc.y, { width: qrSize })
  doc.moveDown(qrSize / 10 + 0.5)
  doc.fontSize(9).font("Helvetica").text("Muestra este comprobante al momento de retirar tus libros.", { align: "center", color: "gray" })
}

export async function generarPDFStream(grupoId, res) {
  const data = await buildDoc(grupoId)
  if (!data) return res.status(404).json({ error: "Pedido no encontrado" })

  const doc = new PDFDocument({ size: "A4", margin: 50 })
  doc.pipe(res)
  await fillDoc(doc, data)
  doc.end()
}

export async function guardarPDF(grupoId, userId) {
  const data = await buildDoc(grupoId)
  if (!data) throw new Error("Pedido no encontrado")

  const uid = userId || "anon"
  const dir = join(UPLOADS, "pedidos", uid)
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })

  const filename = `${grupoId}.pdf`
  const filePath = join(dir, filename)

  const doc = new PDFDocument({ size: "A4", margin: 50 })
  const stream = createWriteStream(filePath)
  doc.pipe(stream)
  await fillDoc(doc, data)
  doc.end()

  await new Promise((resolve, reject) => {
    stream.on("finish", resolve)
    stream.on("error", reject)
  })

  return `/uploads/pedidos/${uid}/${filename}`
}

export function getStoredPDF(grupoId, userId) {
  const uid = userId || "anon"
  const filePath = join(UPLOADS, "pedidos", uid, `${grupoId}.pdf`)
  if (existsSync(filePath)) return readFileSync(filePath)
  return null
}
