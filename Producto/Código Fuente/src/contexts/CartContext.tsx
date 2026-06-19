import { createContext, use, useState, useCallback, useEffect } from "react"
import { api } from "@/lib/api"
import { useAuth } from "@/contexts/AuthContext"

const MAX_ITEMS = 5

interface CartContextType {
  items: Record<number, number>
  addToCart: (libroId: number, cantidad?: number) => boolean
  removeFromCart: (libroId: number) => void
  setQuantity: (libroId: number, cantidad: number) => boolean
  clearCart: () => void
  getQuantity: (libroId: number) => number
  count: number
  maxItems: number
}

const CartContext = createContext<CartContextType | null>(null)

export function CartProvider({ children }: { children: React.ReactNode }) {
  const { usuario } = useAuth()
  const [items, setItems] = useState<Record<number, number>>({})

  useEffect(() => {
    if (usuario?.id) {
      api.getCarrito(usuario.id).then((data) => {
        const map: Record<number, number> = {}
        for (const row of data) {
          map[row.libro_id] = row.cantidad
        }
        setItems(map)
      })
    } else {
      setItems({})
    }
  }, [usuario?.id])

  const addToCart = useCallback((libroId: number, cantidad = 1): boolean => {
    if (!usuario?.id) return false
    const currentTotal = Object.values(items).reduce((s, q) => s + q, 0)
    const currentQty = items[libroId] ?? 0
    const newQty = currentQty + cantidad
    const newTotal = currentTotal - currentQty + newQty
    if (newTotal > MAX_ITEMS) return false
    setItems(prev => ({ ...prev, [libroId]: newQty }))
    api.upsertCarrito(usuario.id, libroId, newQty).catch(() => {})
    return true
  }, [items, usuario?.id])

  const removeFromCart = useCallback((libroId: number) => {
    if (!usuario?.id) return
    setItems(prev => { const next = { ...prev }; delete next[libroId]; return next })
    api.removeFromCarrito(usuario.id, libroId).catch(() => {})
  }, [usuario?.id])

  const setQuantity = useCallback((libroId: number, cantidad: number): boolean => {
    if (!usuario?.id) return false
    const currentTotal = Object.values(items).reduce((s, q) => s + q, 0)
    const currentQty = items[libroId] ?? 0
    const newTotal = currentTotal - currentQty + cantidad
    if (cantidad > 0 && newTotal > MAX_ITEMS) return false
    if (cantidad <= 0) {
      setItems(prev => { const next = { ...prev }; delete next[libroId]; return next })
      api.removeFromCarrito(usuario.id, libroId).catch(() => {})
    } else {
      setItems(prev => ({ ...prev, [libroId]: cantidad }))
      api.upsertCarrito(usuario.id, libroId, cantidad).catch(() => {})
    }
    return true
  }, [items, usuario?.id])

  const clearCart = useCallback(() => {
    if (!usuario?.id) return
    setItems({})
    api.clearCarrito(usuario.id).catch(() => {})
  }, [usuario?.id])

  const getQuantity = useCallback((libroId: number) => items[libroId] ?? 0, [items])

  const count = Object.values(items).reduce((s, q) => s + q, 0)

  return (
    <CartContext.Provider value={{ items, addToCart, removeFromCart, setQuantity, clearCart, getQuantity, count, maxItems: MAX_ITEMS }}>
      {children}
    </CartContext.Provider>
  )
}

export function useCart() {
  const ctx = use(CartContext)
  if (!ctx) throw new Error("useCart debe usarse dentro de CartProvider")
  return ctx
}
