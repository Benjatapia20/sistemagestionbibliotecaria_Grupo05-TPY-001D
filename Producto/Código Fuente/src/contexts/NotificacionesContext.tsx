import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react"
import { api } from "@/lib/api"
import { useAuth } from "@/contexts/AuthContext"

export interface Notificacion {
  id: number
  titulo: string
  mensaje: string | null
  leida: boolean
  link: string | null
  created_at: string
}

interface NotificacionesContextType {
  notificaciones: Notificacion[]
  noLeidas: number
  addNotificacion: (titulo: string, mensaje?: string, link?: string) => void
  marcarLeida: (id: number) => void
  marcarTodasLeidas: () => void
  eliminarNotificacion: (id: number) => void
}

const NotificacionesContext = createContext<NotificacionesContextType>(null!)

export function NotificacionesProvider({ children }: { children: ReactNode }) {
  const { usuario } = useAuth()
  const [notificaciones, setNotificaciones] = useState<Notificacion[]>([])

  useEffect(() => {
    if (usuario?.id) {
      api.getNotificaciones(usuario.id).then(setNotificaciones)
      const interval = setInterval(() => {
        api.getNotificaciones(usuario.id).then(setNotificaciones)
      }, 15000)
      return () => clearInterval(interval)
    } else {
      setNotificaciones([])
    }
  }, [usuario?.id])

  const addNotificacion = useCallback(async (titulo: string, mensaje?: string, link?: string) => {
    if (!usuario?.id) return
    try {
      const nueva = await api.createNotificacion({ usuario_id: usuario.id, titulo, mensaje, link })
      setNotificaciones(prev => [{ id: nueva.id, titulo: nueva.titulo, mensaje: nueva.mensaje, leida: nueva.leida, link: nueva.link, created_at: nueva.created_at }, ...prev])
    } catch { /* skip silently */ }
  }, [usuario?.id])

  const marcarLeida = useCallback(async (id: number) => {
    setNotificaciones(prev => prev.map(n => n.id === id ? { ...n, leida: true } : n))
    api.marcarNotificacionLeida(id).catch(() => {})
  }, [])

  const marcarTodasLeidas = useCallback(async () => {
    if (!usuario?.id) return
    setNotificaciones(prev => prev.map(n => ({ ...n, leida: true })))
    api.marcarTodasNotificacionesLeidas(usuario.id).catch(() => {})
  }, [usuario?.id])

  const eliminarNotificacion = useCallback(async (id: number) => {
    setNotificaciones(prev => prev.filter(n => n.id !== id))
    api.deleteNotificacion(id).catch(() => {})
  }, [])

  const noLeidas = notificaciones.filter(n => !n.leida).length

  return (
    <NotificacionesContext.Provider value={{ notificaciones, noLeidas, addNotificacion, marcarLeida, marcarTodasLeidas, eliminarNotificacion }}>
      {children}
    </NotificacionesContext.Provider>
  )
}

export function useNotificaciones() {
  return useContext(NotificacionesContext)
}
