import PDFDocument from "pdfkit"
import { createWriteStream, existsSync, mkdirSync } from "node:fs"
import { join } from "node:path"
import { pgRequest } from "./pg.js"

const UPLOADS = process.env.UPLOADS_DIR || "uploads"

async function fetchMultaData(multaId) {
  return (await pgRequest(`/multas?id=eq.${multaId}&select=*,prestamo:prestamos(id,fecha_devolucion_esperada,libro:libros(titulo)),usuario:usuario(nombre_usuario,primer_nombre,apellido_paterno)`))?.[0]
}

async function fetchConfig() {
  const data = await pgRequest("/configuracion?clave=in.(multa_por_dia,multa_maxima)&select=clave,valor")
  const config = {}
  for (const c of (data || [])) config[c.clave] = c.valor
  return config
}

export async function generarMultaPDF(multaId) {
  const multa = await fetchMultaData(multaId)
  if (!multa) throw new Error("Multa no encontrada")

  const config = await fetchConfig()
  const usuarioId = multa.usuario_id
  const uid = usuarioId?.substring(0, 8) || "anon"
  const dir = join(UPLOADS, "multas-pdf", uid)
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })

  const filePath = join(dir, `${multaId}.pdf`)
  const doc = new PDFDocument({ size: "A4", margin: 50 })
  const stream = createWriteStream(filePath)
  doc.pipe(stream)

  const nombre = [multa.usuario?.primer_nombre, multa.usuario?.apellido_paterno].filter(Boolean).join(" ") || multa.usuario?.nombre_usuario || "—"
  const libro = multa.prestamo?.libro?.titulo || "—"
  const fechaEsperada = multa.prestamo?.fecha_devolucion_esperada
    ? new Date(multa.prestamo.fecha_devolucion_esperada).toLocaleDateString("es-CL", { timeZone: "America/Santiago" })
    : "—"
  const fechaPago = new Date().toLocaleDateString("es-CL", { timeZone: "America/Santiago" })

  doc.fontSize(18).text("Comprobante de Pago de Multa", { align: "center" })
  doc.moveDown(0.5)
  doc.fontSize(10).text("Biblioteca — Sistema Bibliotecario", { align: "center" })
  doc.moveDown(1)

  doc.fontSize(11)
  doc.text(`N° Multa: ${multa.id}`)
  doc.text(`Usuario: ${nombre} (@${multa.usuario?.nombre_usuario || "—"})`)
  doc.text(`Libro: ${libro}`)
  doc.text(`Días de atraso: ${multa.dias_atraso}`)
  doc.text(`Fecha devolución esperada: ${fechaEsperada}`)
  doc.text(`Monto: $${multa.monto.toLocaleString("es-CL")} CLP`)
  doc.text(`Multa por día: $${(config.multa_por_dia || "500").toLocaleString("es-CL")} CLP`)
  doc.text(`Máximo: $${(config.multa_maxima || "10000").toLocaleString("es-CL")} CLP`)
  doc.moveDown(0.5)
  doc.text(`Fecha de pago: ${fechaPago}`)
  doc.moveDown(1)
  doc.text("Gracias por regularizar tu situación.", { align: "center" })

  doc.end()

  await new Promise((resolve, reject) => {
    stream.on("finish", resolve)
    stream.on("error", reject)
  })

  return `/uploads/multas-pdf/${uid}/${multaId}.pdf`
}
