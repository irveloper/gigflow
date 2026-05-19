"use client"

import { useState, useEffect } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { Music, Lock, Loader2, CheckCircle2, XCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { trpc } from "@/shared/lib/trpc"
import Link from "next/link"

type InviteState =
  | { status: "loading" }
  | { status: "valid"; name: string; email: string }
  | { status: "expired" }
  | { status: "used" }
  | { status: "invalid" }

export default function AcceptInvitePage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const token = searchParams.get("token") ?? ""

  const [invite, setInvite] = useState<InviteState>({ status: "loading" })
  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!token) {
      setInvite({ status: "invalid" })
      return
    }

    trpc.auth.getInviteInfo
      .query({ token })
      .then((info) => setInvite({ status: "valid", name: info.name, email: info.email }))
      .catch((err) => {
        const msg = err?.message ?? ""
        if (msg === "TOKEN_EXPIRED") setInvite({ status: "expired" })
        else if (msg === "ALREADY_USED") setInvite({ status: "used" })
        else setInvite({ status: "invalid" })
      })
  }, [token])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (password.length < 8) {
      setError("La contraseña debe tener al menos 8 caracteres.")
      return
    }
    if (password !== confirm) {
      setError("Las contraseñas no coinciden.")
      return
    }

    setSubmitting(true)
    try {
      await trpc.auth.acceptInvite.mutate({ token, password })
      router.replace("/auth/login?invited=1")
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error al activar la cuenta."
      if (msg === "TOKEN_EXPIRED") setInvite({ status: "expired" })
      else if (msg === "ALREADY_USED") setInvite({ status: "used" })
      else setError(msg)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Music className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900">PlugIn Cancún</h1>
        </div>

        {invite.status === "loading" && (
          <Card>
            <CardContent className="p-8 flex items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </CardContent>
          </Card>
        )}

        {invite.status === "valid" && (
          <Card>
            <CardHeader className="text-center">
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-2">
                <Lock className="h-6 w-6 text-blue-600" />
              </div>
              <CardTitle>Activa tu cuenta</CardTitle>
              <CardDescription>
                Hola <strong>{invite.name}</strong>, elige una contraseña para acceder al portal con{" "}
                <span className="font-medium text-foreground">{invite.email}</span>.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="password">Nueva contraseña</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="Mínimo 8 caracteres"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={submitting}
                    autoFocus
                  />
                </div>
                <div>
                  <Label htmlFor="confirm">Confirmar contraseña</Label>
                  <Input
                    id="confirm"
                    type="password"
                    placeholder="Repite tu contraseña"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    disabled={submitting}
                  />
                </div>

                {error && (
                  <p className="text-sm text-red-600 bg-red-50 rounded p-2">{error}</p>
                )}

                <Button type="submit" className="w-full" disabled={submitting}>
                  {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Activar cuenta
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

        {(invite.status === "expired" || invite.status === "used" || invite.status === "invalid") && (
          <Card>
            <CardHeader className="text-center">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-2">
                <XCircle className="h-6 w-6 text-red-600" />
              </div>
              <CardTitle>
                {invite.status === "expired" && "Invitación expirada"}
                {invite.status === "used" && "Invitación ya usada"}
                {invite.status === "invalid" && "Enlace inválido"}
              </CardTitle>
              <CardDescription>
                {invite.status === "expired" &&
                  "Este enlace expiró. Pide a tu gerente que te envíe una nueva invitación."}
                {invite.status === "used" &&
                  "Esta invitación ya fue usada. Si ya activaste tu cuenta, inicia sesión normalmente."}
                {invite.status === "invalid" &&
                  "El enlace no es válido. Verifica que lo copiaste completo desde el correo."}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild className="w-full">
                <Link href="/auth/login">Ir al inicio de sesión</Link>
              </Button>
            </CardContent>
          </Card>
        )}

        {invite.status === "valid" && (
          <p className="text-center text-sm text-gray-500">
            ¿Ya tienes cuenta?{" "}
            <Link href="/auth/login" className="text-blue-600 hover:underline">
              Inicia sesión aquí
            </Link>
          </p>
        )}
      </div>
    </div>
  )
}
