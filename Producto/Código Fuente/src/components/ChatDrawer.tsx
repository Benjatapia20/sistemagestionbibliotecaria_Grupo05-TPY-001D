import { useState, useRef, useEffect } from "react"
import { Send, Bot, Trash2, X } from "lucide-react"
import { useChat, type ChatMessage } from "@/contexts/ChatContext"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"

function formatContent(text: string) {
  if (!text) return null
  const lines = text.split("\n")
  return lines.map((line, i) => {
    let formatted = line
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/\\?"([^"]+)\\?"/g, "&laquo;$1&raquo;")
      .replace(/^- /, "&bull; ")
      .replace(/^(\d+)\.\s/, "$1. ")
    return <span key={i} dangerouslySetInnerHTML={{ __html: formatted }} />
  }).reduce((acc, el, i) => {
    if (i === 0) return [el]
    return [...acc, <br key={`br-${i}`} />, el]
  }, [] as React.ReactNode[])
}

function MessageBubble({ msg, onAction }: { msg: ChatMessage; onAction?: (msgId: string, accepted: boolean) => void }) {
  if (msg.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[80%] rounded-2xl rounded-br-md bg-primary text-primary-foreground px-4 py-2.5 text-sm">
          {msg.content}
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2 animate-message-in">
      <div className="flex gap-2 items-start">
        <div className="shrink-0 size-7 rounded-full bg-primary/10 flex items-center justify-center mt-0.5">
          <Bot className="size-3.5 text-primary" />
        </div>
        <div className="max-w-[80%] rounded-2xl rounded-bl-md bg-muted px-4 py-2.5 text-sm leading-relaxed">
          {msg.action ? formatContent(msg.action.message) : formatContent(msg.content)}
        </div>
      </div>
      {msg.action && (
        <div className="flex gap-2 ml-9">
          <Button size="sm" onClick={() => onAction?.(msg.id, true)}>
            Sí, agregar
          </Button>
          <Button size="sm" variant="ghost" onClick={() => onAction?.(msg.id, false)}>
            No
          </Button>
        </div>
      )}
    </div>
  )
}

const SUGERENCIAS = [
  "¿Qué libros tienes de Gabriel García Márquez?",
  "Recomiéndame algo para leer",
  "¿Qué libros tengo prestados?",
  "¿Dónde están los baños?",
]

export default function ChatDrawer() {
  const { messages, sendMessage, confirmAction, isLoading, clearHistory, open, setOpen } = useChat()
  const [input, setInput] = useState("")
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const shouldScrollRef = useRef(true)
  const [keyboardOffset, setKeyboardOffset] = useState(0)

  const scrollToBottom = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }

  useEffect(() => {
    if (shouldScrollRef.current) scrollToBottom()
  }, [messages])

  useEffect(() => {
    if (!isLoading) {
      inputRef.current?.focus()
      shouldScrollRef.current = true
    }
  }, [isLoading])

  useEffect(() => {
    if (open) {
      requestAnimationFrame(() => {
        scrollToBottom()
        inputRef.current?.focus()
      })
    }
  }, [open])

  // Detect keyboard appearance on mobile
  useEffect(() => {
    const onResize = () => {
      const offset = window.innerHeight - (window.visualViewport?.height ?? window.innerHeight)
      setKeyboardOffset(Math.max(0, offset))
    }
    window.visualViewport?.addEventListener("resize", onResize)
    window.visualViewport?.addEventListener("scroll", onResize)
    return () => {
      window.visualViewport?.removeEventListener("resize", onResize)
      window.visualViewport?.removeEventListener("scroll", onResize)
    }
  }, [])

  // Scroll input into view when keyboard opens
  useEffect(() => {
    if (keyboardOffset > 0) {
      requestAnimationFrame(() => scrollToBottom())
    }
  }, [keyboardOffset])

  const handleScroll = () => {
    if (!scrollRef.current) return
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current
    shouldScrollRef.current = scrollHeight - scrollTop - clientHeight < 80
  }

  const handleSend = () => {
    if (!input.trim() || isLoading) return
    sendMessage(input.trim())
    setInput("")
    inputRef.current?.focus()
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetContent side="right" className="w-full sm:w-[400px] sm:max-w-[400px] p-0 flex flex-col" showCloseButton={false}>
        <SheetHeader className="px-4 py-3 border-b shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="size-8 rounded-full bg-primary/10 flex items-center justify-center">
                <Bot className="size-4 text-primary" />
              </div>
              <div>
                <SheetTitle className="text-base">BiblioBot</SheetTitle>
                <p className="text-[11px] text-muted-foreground">Asistente virtual</p>
              </div>
            </div>
            <div className="flex items-center gap-0">
              <Button size="icon-xs" variant="ghost" onClick={clearHistory} title="Nueva conversación">
                <Trash2 className="size-4" />
              </Button>
              <Button size="icon-xs" variant="ghost" onClick={() => setOpen(false)}>
                <X className="size-4" />
              </Button>
            </div>
          </div>
        </SheetHeader>

        <div ref={scrollRef} onScroll={handleScroll} className="flex-1 overflow-y-auto px-4 py-4">
          {messages.length === 0 ? (
            <div className="flex flex-col gap-4">
              <div className="flex gap-2 items-start">
                <div className="shrink-0 size-7 rounded-full bg-primary/10 flex items-center justify-center mt-0.5">
                  <Bot className="size-3.5 text-primary" />
                </div>
                <div className="max-w-[80%] rounded-2xl rounded-bl-md bg-muted px-4 py-2.5 text-sm">
                  ¡Hola! Soy BiblioBot, tu asistente virtual. Puedo ayudarte a buscar libros, consultar tus préstamos, recomendarte lecturas y más. ¿En qué puedo ayudarte?
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-2">Sugerencias:</p>
              <div className="flex flex-col gap-1.5">
                {SUGERENCIAS.map((s, i) => (
                  <button
                    key={i}
                    onClick={() => { sendMessage(s) }}
                    disabled={isLoading}
                    className="text-left text-sm text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg px-3 py-1.5 transition-colors disabled:opacity-50"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {messages.map(msg => (
                <MessageBubble key={msg.id} msg={msg} onAction={confirmAction} />
              ))}
              {isLoading && (
                <div className="flex gap-2 items-start">
                  <div className="shrink-0 size-7 rounded-full bg-primary/10 flex items-center justify-center mt-0.5">
                    <Bot className="size-3.5 text-primary" />
                  </div>
                  <div className="max-w-[75%] rounded-2xl rounded-bl-md bg-muted px-4 py-2.5">
                    <span className="inline-flex gap-1">
                      <span className="size-1.5 rounded-full bg-muted-foreground/60 animate-bounce" style={{ animationDelay: "0ms" }} />
                      <span className="size-1.5 rounded-full bg-muted-foreground/60 animate-bounce" style={{ animationDelay: "150ms" }} />
                      <span className="size-1.5 rounded-full bg-muted-foreground/60 animate-bounce" style={{ animationDelay: "300ms" }} />
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <Separator />

        <div className="px-4 py-3 shrink-0" style={{ paddingBottom: keyboardOffset > 0 ? keyboardOffset + 4 : undefined }}>
          <div className="flex gap-2">
            <Input
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") handleSend() }}
              placeholder="Escribe un mensaje..."
              className="flex-1"
              disabled={isLoading}
            />
            <Button size="icon" onClick={handleSend} disabled={!input.trim() || isLoading}>
              <Send className="size-4" />
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
