import { createContext, use, useState, useCallback, useEffect } from "react"
import type { Usuario } from "@/lib/api"
import { api } from "@/lib/api"

const STORAGE_KEY = "biblioteca_usuario"

function loadUser(): Usuario | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const user = JSON.parse(raw) as Usuario
    if (!user.id || typeof user.id !== "string" || !user.id.includes("-")) {
      localStorage.removeItem(STORAGE_KEY)
      return null
    }
    return user
  } catch {
    return null
  }
}

function saveUser(user: Usuario | null) {
  if (user) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(user))
  } else {
    localStorage.removeItem(STORAGE_KEY)
  }
}

interface AuthContextType {
  usuario: Usuario | null
  loading: boolean
  login: (nombre_usuario: string, password: string) => Promise<void>
  register: (data: { nombre_usuario: string; password_hash: string }) => Promise<void>
  logout: () => void
  updateProfile: (data: Partial<Omit<Usuario, "id" | "nombre_usuario" | "created_at">>) => Promise<void>
  refreshUser: () => Promise<Usuario | null>
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [usuario, setUsuario] = useState<Usuario | null>(loadUser)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    saveUser(usuario)
  }, [usuario])

  const login = useCallback(async (nombre_usuario: string, password: string) => {
    setLoading(true)
    try {
      const user = await api.login(nombre_usuario, password)
      setUsuario(user)
    } finally {
      setLoading(false)
    }
  }, [])

  const register = useCallback(
    async (data: { nombre_usuario: string; password_hash: string }) => {
      setLoading(true)
      try {
        const user = await api.register(data)
        setUsuario(user)
      } finally {
        setLoading(false)
      }
    },
    []
  )

  const logout = useCallback(() => {
    setUsuario(null)
  }, [])

  const updateProfile = useCallback(
    async (data: Partial<Omit<Usuario, "id" | "nombre_usuario" | "created_at">>) => {
      if (!usuario) throw new Error("No hay sesión activa")
      setLoading(true)
      try {
        const updated = await api.updateProfile(usuario.id, data, usuario.nombre_usuario)
        setUsuario({ ...updated, _refreshedAt: Date.now() } as Usuario & { _refreshedAt?: number })
      } finally {
        setLoading(false)
      }
    },
    [usuario?.id]
  )

  const refreshUser = useCallback(async (): Promise<Usuario | null> => {
    if (!usuario) return null
    try {
      const fresh = await api.getUsuarioPorUsername(usuario.nombre_usuario)
      if (fresh) {
        setUsuario({ ...fresh, _refreshedAt: Date.now() } as Usuario & { _refreshedAt?: number })
      }
      return fresh
    } catch { return null }
  }, [usuario?.nombre_usuario])

  return (
    <AuthContext.Provider value={{ usuario, loading, login, register, logout, updateProfile, refreshUser }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = use(AuthContext)
  if (!ctx) throw new Error("useAuth debe usarse dentro de AuthProvider")
  return ctx
}
