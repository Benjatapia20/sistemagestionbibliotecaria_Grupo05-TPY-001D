import { useEffect, useRef, useState } from "react"
import { Html5Qrcode } from "html5-qrcode"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Camera } from "lucide-react"

interface EscannerQRProps {
  open: boolean
  onClose: () => void
  onScan: (code: string) => void
}

export default function EscannerQR({ open, onClose, onScan }: EscannerQRProps) {
  const scannerRef = useRef<Html5Qrcode | null>(null)
  const [error, setError] = useState("")
  const [mountKey, setMountKey] = useState(0)

  useEffect(() => {
    if (open) setMountKey(k => k + 1)
  }, [open])

  useEffect(() => {
    if (!open) {
      if (scannerRef.current) {
        scannerRef.current.stop().catch(() => {})
        scannerRef.current = null
      }
      setError("")
      return
    }

    const startScanner = async () => {
      try {
        const scanner = new Html5Qrcode("qr-reader")
        scannerRef.current = scanner
        await scanner.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 250, height: 250 } },
          (decodedText) => {
            scanner.stop().catch(() => {})
            scannerRef.current = null
            onScan(decodedText)
          },
          () => {}
        )
      } catch (err: any) {
        setError(err?.message || "No se pudo acceder a la cámara")
      }
    }

    const timer = setTimeout(startScanner, 300)
    return () => {
      clearTimeout(timer)
      if (scannerRef.current) {
        scannerRef.current.stop().catch(() => {})
        scannerRef.current = null
      }
    }
  }, [open, mountKey])

  const handleClose = () => {
    if (scannerRef.current) {
      scannerRef.current.stop().catch(() => {})
      scannerRef.current = null
    }
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose() }}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Escanear código QR</DialogTitle>
          <DialogDescription>
            Apunta la cámara al código del ejemplar (LIB-X-XXX)
          </DialogDescription>
        </DialogHeader>
        {error ? (
          <div className="flex flex-col items-center gap-3 py-8">
            <Camera className="size-10 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground text-center">{error}</p>
            <Button variant="outline" size="sm" onClick={handleClose}>Cerrar</Button>
          </div>
        ) : (
          <div key={mountKey} id="qr-reader" className="w-full rounded-lg overflow-hidden" />
        )}
      </DialogContent>
    </Dialog>
  )
}
