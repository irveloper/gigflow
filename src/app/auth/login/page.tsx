"use client"

import type React from "react"
import { useEffect, useState } from "react"
import { useUnit } from "effector-react"
import { useRouter, useSearchParams } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Music, Mail, Lock, LogIn } from "lucide-react"
import { authModel } from "@/features/auth/model"
import { $user } from "@/entities/user/model"
import { sileo } from "sileo"
import Link from "next/link"

function getSafeRedirect(path: string | null): string {
  if (!path || !path.startsWith("/") || path.startsWith("//")) {
    return "/"
  }

  return path
}

function getRedirectTarget(): string {
  if (typeof window === "undefined") {
    return "/"
  }

  return getSafeRedirect(new URLSearchParams(window.location.search).get("from"))
}

export default function LoginPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const isVerified = searchParams.get("verified") === "1"
  const isInviteAccepted = searchParams.get("invited") === "1"
  const linkError = searchParams.get("error")

  const { isLoading, authError, user, isAuthResolved } = useUnit({
    isLoading: authModel.$isLoading,
    authError: authModel.$authError,
    user: $user,
    isAuthResolved: authModel.$isAuthResolved,
  })

  const [formData, setFormData] = useState({
    email: "",
    password: "",
  })

  // Redirect already-authenticated users away from login
  useEffect(() => {
    if (isAuthResolved && user) {
      router.replace(getRedirectTarget())
    }
  }, [isAuthResolved, router, user])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.email || !formData.password) {
      sileo.error({ title: "Error", description: "Por favor completa todos los campos" })
      return
    }

    try {
      // Use the effect directly so we can await it
      await authModel.loginFx(formData)

      sileo.success({ title: "Bienvenido", description: "Has iniciado sesión correctamente" })
      router.replace(getRedirectTarget())
    } catch {
      sileo.error({ title: "Error de Autenticación", description: "Credenciales inválidas. Intenta de nuevo." })
    }
  }

  const loginWithDemo = async (email: string, password: string) => {
    setFormData({ email, password })
    try {
      // Await the effect directly — do NOT just fire the event
      await authModel.loginFx({ email, password })
      sileo.success({ title: "Bienvenido", description: "Has iniciado sesión correctamente" })
      router.replace(getRedirectTarget())
    } catch {
      sileo.error({ title: "Error", description: "No se pudo iniciar sesión. Intenta de nuevo." })
    }
  }

  const demoAccounts = [
    { email: "musico@test.com", password: "123456", role: "Músico", color: "bg-blue-100 text-blue-800" },
    { email: "gerente@test.com", password: "123456", role: "Gerente", color: "bg-purple-100 text-purple-800" },
    { email: "hotel@test.com", password: "123456", role: "Hotel", color: "bg-green-100 text-green-800" },
  ]

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        {/* Header */}
        <div className="text-center">
          <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Music className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900">PlugIn Cancún</h1>
          <p className="text-gray-600 mt-2">Gestión de músicos y eventos</p>
        </div>

        {/* Feedback banners */}
        {isInviteAccepted && (
          <div className="bg-green-50 border border-green-200 text-green-800 rounded-lg p-3 text-sm text-center">
            ✅ ¡Cuenta activada! Inicia sesión con tu email y contraseña.
          </div>
        )}
        {isVerified && (
          <div className="bg-green-50 border border-green-200 text-green-800 rounded-lg p-3 text-sm text-center">
            ✅ ¡Email verificado! Ya puedes iniciar sesión.
          </div>
        )}
        {linkError === "invalid_token" && (
          <div className="bg-red-50 border border-red-200 text-red-800 rounded-lg p-3 text-sm text-center">
            El enlace de verificación no es válido o ya fue usado.
          </div>
        )}
        {linkError === "invalid_link" && (
          <div className="bg-red-50 border border-red-200 text-red-800 rounded-lg p-3 text-sm text-center">
            Enlace de verificación inválido. Solicita uno nuevo.
          </div>
        )}

        {/* Login Form */}
        <Card>
          <CardHeader>
            <CardTitle>Iniciar Sesión</CardTitle>
            <CardDescription>Ingresa tus credenciales para acceder a la plataforma</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <Label htmlFor="email">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="tu@email.com"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="pl-10"
                    disabled={isLoading}
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <Label htmlFor="password">Contraseña</Label>
                  <Link href="/auth/forgot-password" className="text-xs text-blue-600 hover:underline">
                    ¿Olvidaste tu contraseña?
                  </Link>
                </div>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="pl-10"
                    disabled={isLoading}
                  />
                </div>
              </div>

              {authError && <div className="text-sm text-red-600 bg-red-50 p-2 rounded">{authError}</div>}

              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                    Iniciando sesión...
                  </>
                ) : (
                  <>
                    <LogIn className="h-4 w-4 mr-2" />
                    Iniciar Sesión
                  </>
                )}
              </Button>
            </form>

            <div className="mt-4 text-center">
              <Link href="/auth/register" className="text-sm text-blue-600 hover:underline">
                ¿No tienes cuenta? Regístrate aquí
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* Demo Accounts — hidden in production */}
        {process.env.NODE_ENV !== "production" && (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Cuentas Demo</CardTitle>
              <CardDescription className="text-xs">Prueba la plataforma con diferentes roles</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {demoAccounts.map((account, index) => (
                <div key={account.email}>
                  <Button
                    variant="outline"
                    className="w-full justify-between text-left h-auto p-3 bg-transparent"
                    onClick={() => loginWithDemo(account.email, account.password)}
                    disabled={isLoading}
                  >
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <Badge className={account.color} variant="secondary">
                          {account.role}
                        </Badge>
                      </div>
                      <p className="text-xs text-gray-600">{account.email}</p>
                    </div>
                    <LogIn className="h-4 w-4" />
                  </Button>
                  {index < demoAccounts.length - 1 && <Separator className="my-2" />}
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
