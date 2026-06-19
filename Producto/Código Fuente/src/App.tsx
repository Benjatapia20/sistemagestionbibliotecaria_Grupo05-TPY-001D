import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom"
import { AuthProvider, useAuth } from "@/contexts/AuthContext"
import { CartProvider } from "@/contexts/CartContext"
import { ChatProvider } from "@/contexts/ChatContext"
import { NotificacionesProvider } from "@/contexts/NotificacionesContext"
import Login from "@/pages/Login"
import Inicio from "@/pages/Inicio"
import PerfilPublico from "@/pages/PerfilPublico"
import Catalogo from "@/pages/Catalogo"
import LibroDetalle from "@/pages/LibroDetalle"
import MisPedidos from "@/pages/MisPedidos"
import EjemplarQR from "@/pages/EjemplarQR"
import Admin from "@/pages/Admin"
import Operaciones from "@/pages/Operaciones"
import Mapa from "@/pages/Mapa"
import Notificaciones from "@/pages/Notificaciones"
import AppLayout from "@/components/AppLayout"

function PerfilRedirect() {
  const { usuario } = useAuth()
  return <Navigate to={usuario ? `/perfil/${usuario.nombre_usuario}` : "/inicio"} replace />
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <CartProvider>
        <ChatProvider>
        <NotificacionesProvider>
        <Routes>
          <Route path="/" element={<Login />} />
          <Route element={<AppLayout />}>
            <Route path="/inicio" element={<Inicio />} />
            <Route path="/catalogo" element={<Catalogo />} />
            <Route path="/libro/:id" element={<LibroDetalle />} />
            <Route path="/ejemplar/:codigo" element={<EjemplarQR />} />
            <Route path="/perfil" element={<PerfilRedirect />} />
            <Route path="/perfil/:username" element={<PerfilPublico />} />
            <Route path="/mis-pedidos" element={<MisPedidos />} />
            <Route path="/admin" element={<Admin />} />
            <Route path="/operaciones" element={<Operaciones />} />
            <Route path="/mapa" element={<Mapa />} />
            <Route path="/notificaciones" element={<Notificaciones />} />
            <Route path="*" element={<Navigate to="/inicio" replace />} />
          </Route>
        </Routes>
        </NotificacionesProvider>
        </ChatProvider>
        </CartProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
