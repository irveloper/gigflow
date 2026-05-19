"use client"

import { useState } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { Music, Clock, Building2, Mail, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { authModel } from "@/features/auth/model"
import { trpc } from "@/shared/lib/trpc"
import Link from "next/link"

export default function PendingPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const isVerifyFlow = searchParams.get("verify") === "1"
  const isExpired = searchParams.get("error") === "expired"

  const [resendLoading, setResendLoading] = useState(false)
  const [resendSent, setResendSent] = useState(false)
  const [resendError, setResendError] = useState<string | null>(null)

  const handleLogout = async () => {
    await authModel.logoutFx()
    router.replace("/auth/login")
  }

  const handleResend = async () => {
    setResendLoading(true)
    setResendError(null)
    try {
      await trpc.auth.resendVerification.mutate()
      setResendSent(true)
    } catch (err) {
      setResendError(err instanceof Error ? err.message : "Failed to resend. Try again.")
    } finally {
      setResendLoading(false)
    }
  }

  if (isVerifyFlow) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <div className="w-full max-w-md space-y-6">
          <div className="text-center">
            <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Music className="h-8 w-8 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-gray-900">PlugIn Cancún</h1>
          </div>

          <Card>
            <CardHeader className="text-center">
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-2">
                <Mail className="h-6 w-6 text-blue-600" />
              </div>
              <CardTitle>
                {isExpired ? "Verification link expired" : "Check your inbox"}
              </CardTitle>
              <CardDescription>
                {isExpired
                  ? "Your verification link has expired. Request a new one below."
                  : "We sent a verification link to your email address. Click it to activate your account."}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {resendSent ? (
                <p className="text-sm text-center text-green-600 font-medium">
                  Verification email sent! Check your inbox.
                </p>
              ) : (
                <Button
                  className="w-full"
                  onClick={handleResend}
                  disabled={resendLoading}
                >
                  {resendLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Resend verification email
                </Button>
              )}
              {resendError && (
                <p className="text-sm text-destructive text-center">{resendError}</p>
              )}
              <Button variant="outline" onClick={handleLogout} className="w-full">
                Sign out
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    )
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

        <Card>
          <CardHeader className="text-center">
            <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-2">
              <Clock className="h-6 w-6 text-amber-600" />
            </div>
            <CardTitle>Cuenta pendiente de activación</CardTitle>
            <CardDescription>
              Tu cuenta fue creada pero aún no tiene un rol asignado.
              Un administrador debe asignarte acceso antes de que puedas usar la plataforma.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button asChild className="w-full">
              <Link href="/org/new">
                <Building2 className="mr-2 h-4 w-4" />
                Crear mi organización
              </Link>
            </Button>
            <Button variant="outline" onClick={handleLogout} className="w-full">
              Cerrar sesión
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
