import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { BookOpen, Loader2, ArrowLeft } from "lucide-react"
import { toast } from "sonner"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { FieldGroup, Field, FieldLabel, FieldError } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/contexts/AuthContext"
import { api } from "@/lib/api"

export default function Login() {
  const { login, register, loading } = useAuth()
  const navigate = useNavigate()

  const [loginUsuario, setLoginUsuario] = useState("")
  const [loginPassword, setLoginPassword] = useState("")

  const [regUsuario, setRegUsuario] = useState("")
  const [regPassword, setRegPassword] = useState("")
  const [regConfirm, setRegConfirm] = useState("")

  const [loginErrors, setLoginErrors] = useState<string | null>(null)
  const [regErrors, setRegErrors] = useState<Record<string, string>>({})

  const [activeTab, setActiveTab] = useState("login")

  const [recoveryStep, setRecoveryStep] = useState<"idle" | "form">("idle")
  const [recUsername, setRecUsername] = useState("")
  const [recPassword, setRecPassword] = useState("")
  const [recConfirm, setRecConfirm] = useState("")
  const [recErrors, setRecErrors] = useState<string | null>(null)
  const [recLoading, setRecLoading] = useState(false)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoginErrors(null)

    if (!loginUsuario.trim() || !loginPassword.trim()) {
      setLoginErrors("Completa todos los campos")
      return
    }

    try {
      await login(loginUsuario, loginPassword)
      toast.success("Inicio de sesión exitoso")
      navigate("/inicio")
    } catch (err) {
      setLoginErrors(err instanceof Error ? err.message : "Error al iniciar sesión")
    }
  }

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    const errors: Record<string, string> = {}

    if (!regUsuario.trim()) errors.usuario = "El nombre de usuario es obligatorio"
    if (!regPassword.trim()) errors.password = "La contraseña es obligatoria"
    if (regPassword !== regConfirm) errors.confirm = "Las contraseñas no coinciden"

    if (Object.keys(errors).length > 0) {
      setRegErrors(errors)
      return
    }

    setRegErrors({})
    try {
      await register({ nombre_usuario: regUsuario, password_hash: regPassword })
      toast.success("Usuario registrado correctamente. Ahora inicia sesión.")
      setRegUsuario("")
      setRegPassword("")
      setRegConfirm("")
      setActiveTab("login")
    } catch (err) {
      setRegErrors({ general: err instanceof Error ? err.message : "Error al registrarse" })
    }
  }

  const handleRecover = async (e: React.FormEvent) => {
    e.preventDefault()
    setRecErrors(null)

    if (!recUsername.trim()) { setRecErrors("Ingresa tu nombre de usuario"); return }
    if (!recPassword.trim() || recPassword.length < 6) { setRecErrors("La contraseña debe tener al menos 6 caracteres"); return }
    if (recPassword !== recConfirm) { setRecErrors("Las contraseñas no coinciden"); return }

    setRecLoading(true)
    try {
      await api.resetPassword(recUsername, recPassword)
      toast.success("Contraseña cambiada. Ahora inicia sesión.")
      setRecoveryStep("idle")
      setRecUsername("")
      setRecPassword("")
      setRecConfirm("")
      setActiveTab("login")
    } catch (err) {
      setRecErrors(err instanceof Error ? err.message : "Error al cambiar contraseña")
    }
    setRecLoading(false)
  }

  if (recoveryStep === "form") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/40 px-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <div className="flex items-center gap-2 mb-2">
              <button onClick={() => setRecoveryStep("idle")} className="text-muted-foreground hover:text-foreground">
                <ArrowLeft className="size-5" />
              </button>
              <CardTitle>Recuperar contraseña</CardTitle>
            </div>
            <CardDescription>Ingresa tu nombre de usuario y una nueva contraseña</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleRecover} noValidate>
              <FieldGroup>
                {recErrors && (
                  <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{recErrors}</p>
                )}
                <Field orientation="vertical">
                  <FieldLabel htmlFor="rec-usuario">Nombre de usuario</FieldLabel>
                  <Input id="rec-usuario" type="text" value={recUsername} onChange={e => setRecUsername(e.target.value)} placeholder="jperez" autoComplete="username" />
                </Field>
                <Field orientation="vertical">
                  <FieldLabel htmlFor="rec-password">Nueva contraseña</FieldLabel>
                  <Input id="rec-password" type="password" value={recPassword} onChange={e => setRecPassword(e.target.value)} placeholder="Mínimo 6 caracteres" autoComplete="new-password" />
                </Field>
                <Field orientation="vertical">
                  <FieldLabel htmlFor="rec-confirm">Confirmar contraseña</FieldLabel>
                  <Input id="rec-confirm" type="password" value={recConfirm} onChange={e => setRecConfirm(e.target.value)} placeholder="********" />
                </Field>
                <Button type="submit" className="w-full" disabled={recLoading}>
                  {recLoading && <Loader2 className="animate-spin" data-icon="inline-start" />}
                  Cambiar contraseña
                </Button>
              </FieldGroup>
            </form>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="flex items-center gap-2">
            <BookOpen className="text-primary" />
            <CardTitle>Sistema Bibliotecario</CardTitle>
          </div>
          <CardDescription>
            Ingresa con tu cuenta o regístrate para acceder
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList variant="default" className="w-full mb-6">
              <TabsTrigger value="login" className="flex-1">Iniciar Sesión</TabsTrigger>
              <TabsTrigger value="register" className="flex-1">Registrarse</TabsTrigger>
            </TabsList>

            <TabsContent value="login">
              <form onSubmit={handleLogin} noValidate>
                <FieldGroup>
                  {loginErrors && (
                    <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{loginErrors}</p>
                  )}
                  <Field orientation="vertical">
                    <FieldLabel htmlFor="login-usuario">Nombre de usuario</FieldLabel>
                    <Input
                      id="login-usuario"
                      type="text"
                      value={loginUsuario}
                      onChange={(e) => setLoginUsuario(e.target.value)}
                      placeholder="jperez"
                      autoComplete="username"
                    />
                  </Field>
                  <Field orientation="vertical">
                    <FieldLabel htmlFor="login-password">Contraseña</FieldLabel>
                    <Input
                      id="login-password"
                      type="password"
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      placeholder="********"
                      autoComplete="current-password"
                    />
                  </Field>
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading && <Loader2 className="animate-spin" data-icon="inline-start" />}
                    Ingresar
                  </Button>
                  <button type="button" onClick={() => setRecoveryStep("form")} className="text-sm text-muted-foreground hover:text-primary transition-colors text-center w-full mt-1">
                    ¿Olvidaste tu contraseña?
                  </button>
                </FieldGroup>
              </form>
            </TabsContent>

            <TabsContent value="register">
              <form onSubmit={handleRegister} noValidate>
                <FieldGroup>
                  {regErrors.general && (
                    <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{regErrors.general}</p>
                  )}
                  <Field orientation="vertical" data-invalid={!!regErrors.usuario}>
                    <FieldLabel htmlFor="reg-usuario">Nombre de usuario</FieldLabel>
                    <Input
                      id="reg-usuario"
                      type="text"
                      value={regUsuario}
                      onChange={(e) => setRegUsuario(e.target.value)}
                      placeholder="jperez"
                      aria-invalid={!!regErrors.usuario}
                    />
                    <FieldError errors={[{ message: regErrors.usuario }]} />
                  </Field>
                  <Field orientation="vertical" data-invalid={!!regErrors.password}>
                    <FieldLabel htmlFor="reg-password">Contraseña</FieldLabel>
                    <Input
                      id="reg-password"
                      type="password"
                      value={regPassword}
                      onChange={(e) => setRegPassword(e.target.value)}
                      placeholder="********"
                      aria-invalid={!!regErrors.password}
                    />
                    <FieldError errors={[{ message: regErrors.password }]} />
                  </Field>
                  <Field orientation="vertical" data-invalid={!!regErrors.confirm}>
                    <FieldLabel htmlFor="reg-confirm">Confirmar contraseña</FieldLabel>
                    <Input
                      id="reg-confirm"
                      type="password"
                      value={regConfirm}
                      onChange={(e) => setRegConfirm(e.target.value)}
                      placeholder="********"
                      aria-invalid={!!regErrors.confirm}
                    />
                    <FieldError errors={[{ message: regErrors.confirm }]} />
                  </Field>
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading && <Loader2 className="animate-spin" data-icon="inline-start" />}
                    Crear cuenta
                  </Button>
                </FieldGroup>
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  )
}
