import { createContext, useContext, useState, useCallback, type ReactNode } from "react"
import { toast } from "sonner"
import { useAuth } from "@/contexts/AuthContext"
import { useCart } from "@/contexts/CartContext"

import { getServerUrl } from "@/lib/api-config"

const isNetlify = typeof window !== "undefined" && window.location.hostname.includes("netlify.app")
const CHAT_URL = isNetlify ? "/.netlify/functions/chat" : `${getServerUrl()}/chat`

export interface ChatMessage {
  id: string
  role: "user" | "assistant" | "tool"
  content: string
  action?: {
    tool: string
    data: { libro_id: number; titulo: string }
    message: string
  }
}

interface ChatContextType {
  messages: ChatMessage[]
  sendMessage: (text: string) => Promise<void>
  confirmAction: (messageId: string, accepted: boolean) => Promise<void>
  isLoading: boolean
  clearHistory: () => void
  open: boolean
  setOpen: (v: boolean) => void
}

const ChatContext = createContext<ChatContextType>(null!)

export function ChatProvider({ children }: { children: ReactNode }) {
  const { usuario } = useAuth()
  const { addToCart } = useCart()
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [open, setOpen] = useState(false)

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || isLoading) return

    const lastBotMsg = messages[messages.length - 1]
    const lower = text.toLowerCase().trim()
    const confirms = ["si", "sí", "si quiero", "agrega", "agregar", "acepto", "dale", "ok", "ya", "confirmo"]
    const isConfirm = confirms.includes(lower) || lower.startsWith("si ") || lower.startsWith("sí ")

    if (lastBotMsg?.action) {
      if (isConfirm) {
        confirmAction(lastBotMsg.id, true)
        setMessages(prev => [...prev, { id: crypto.randomUUID(), role: "user", content: text }])
        return
      }
      if (["no", "no quiero", "cancelar", "cancela", "nop"].includes(lower) || lower.startsWith("no ")) {
        confirmAction(lastBotMsg.id, false)
        setMessages(prev => [...prev, { id: crypto.randomUUID(), role: "user", content: text }])
        return
      }
    }

    if (isConfirm && lastBotMsg?.role === "assistant" && !lastBotMsg.action) {
      const match = lastBotMsg.content.match(/["\u00AB]([^"\u00BB]+)["\u00BB]/)
      if (match) {
        const titulo = match[1].trim()
        try {
          const res = await fetch(CHAT_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              message: `pide el libro ${titulo}`,
              history: [],
              userId: usuario?.id,
              userName: usuario?.primer_nombre ? `${usuario.primer_nombre} ${usuario.apellido_paterno ?? ""}` : usuario?.nombre_usuario ?? "Anónimo",
            }),
          })
          const data = await res.json()
          if (data.action) {
            const libro_id = data.action.data.libro_id
            const ok = addToCart(libro_id, 1)
            const userMsg: ChatMessage = { id: crypto.randomUUID(), role: "user", content: text }
            const confirmMsg: ChatMessage = {
              id: crypto.randomUUID(),
              role: "assistant",
              content: ok
                ? `¡Listo! Agregué "${titulo}" a tu carrito. Puedes revisarlo y hacer el pedido cuando quieras.`
                : `No pude agregar "${titulo}" al carrito. Es posible que ya tengas 5 ejemplares (el máximo permitido).`,
            }
            setMessages(prev => [...prev, userMsg, confirmMsg])
            if (ok) toast.success(`"${titulo}" agregado al carrito`)
            else toast.error(`No se pudo agregar "${titulo}". Máximo 5 ejemplares.`)
            return
          }
        } catch {}
      }
    }

    const userMsg: ChatMessage = { id: crypto.randomUUID(), role: "user", content: text }
    setMessages(prev => [...prev, userMsg])
    setIsLoading(true)

    try {
      const history = messages.map(m => ({
        role: m.role,
        content: m.content,
        ...(m.action ? { action: m.action } : {}),
      }))

      const res = await fetch(CHAT_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          history,
          userId: usuario?.id,
          userName: usuario?.primer_nombre
            ? `${usuario.primer_nombre} ${usuario.apellido_paterno ?? ""}`
            : usuario?.nombre_usuario ?? "Anónimo",
        }),
      })

      const text_ = await res.text()
      let data: { content?: string; action?: ChatMessage["action"]; error?: string }
      try { data = JSON.parse(text_) } catch { data = { content: "Lo siento, no pude conectar con el asistente." } }
      const botMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: data.content || data.error || "Lo siento, ocurrió un error inesperado.",
        action: data.action ?? undefined,
      }
      setMessages(prev => [...prev, botMsg])
    } catch (err) {
      setMessages(prev => [...prev, {
        id: crypto.randomUUID(),
        role: "assistant",
        content: "Lo siento, no pude conectarme con el asistente. ¿Puedes intentarlo de nuevo?",
      }])
    } finally {
      setIsLoading(false)
    }
  }, [messages, usuario, isLoading])

  const confirmAction = useCallback(async (messageId: string, accepted: boolean) => {
    const msg = messages.find(m => m.id === messageId)
    if (!msg?.action) return

    if (accepted && msg.action.tool === "agregar_al_carrito") {
      const { libro_id, titulo } = msg.action.data
      const ok = addToCart(libro_id, 1)
      if (ok) {
        toast.success(`"${titulo}" agregado al carrito`)
      } else {
        toast.error(`No se pudo agregar "${titulo}". Máximo 5 ejemplares.`)
      }
      const confirmMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: ok
          ? `¡Listo! Agregué "${titulo}" a tu carrito. Puedes revisarlo y hacer el pedido cuando quieras.`
          : `No pude agregar "${titulo}" al carrito. Es posible que ya tengas 5 ejemplares (el máximo permitido).`,
      }
      setMessages(prev => prev.map(m => m.id === messageId ? { ...m, action: undefined } : m).concat(confirmMsg))
    } else if (!accepted) {
      const declineMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: "Entendido, no lo agregaré. ¿Hay algo más en lo que pueda ayudarte?",
      }
      setMessages(prev => prev.map(m => m.id === messageId ? { ...m, action: undefined } : m).concat(declineMsg))
    }
  }, [messages, addToCart])

  const clearHistory = useCallback(() => {
    setMessages([])
  }, [])

  return (
    <ChatContext.Provider value={{ messages, sendMessage, confirmAction, isLoading, clearHistory, open, setOpen }}>
      {children}
    </ChatContext.Provider>
  )
}

export function useChat() {
  return useContext(ChatContext)
}
