"use client"

import type React from "react"
import { useState } from "react"
import { useUnit } from "effector-react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Music, Mail, Lock, LogIn } from "lucide-react"
import { authModel } from "@/features/auth/model"
import { useToast } from "@/hooks/use-toast"
import Link from "next/link"

export default function LoginPage() {
  const router = useRouter()
  const { toast } = useToast()

  const { isLoading, authError } = useUnit({
    isLoading: authModel.$isLoading,
    authError: authModel.$authError,
  })

  const [formData, setFormData] = useState({
    email: "",
    password: "",
  })

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.email || !formData.password) {
      toast({
        title: "Error",
        description: "Por favor completa todos los campos",
        variant: "destructive",
      })
      return
    }

    try {
      authModel.loginSubmitted(formData)
      // Wait for the effect to complete
      await new Promise((resolve) => {
        const unsubscribe = authModel.loginFx.doneData.watch(() => {
          unsubscribe()
          resolve(void 0)
        })
      })

      toast({
        title: "Bienvenido",
        description: "Has iniciado sesión correctamente",
      })
      router.push("/")
    } catch (error) {
      toast({
        title: "Error de Autenticación",
        description: "Credenciales inválidas. Intenta de nuevo.",
        variant: "destructive",
      })
    }
  }

  const demoAccounts = [
    { email: "musico@test.com", password: "123456", role: "Músico", color: "bg-blue-100 text-blue-800" },
    { email: "gerente@test.com", password: "123456", role: "Gerente", color: "bg-purple-100 text-purple-800" },
    { email: "hotel@test.com", password: "123456", role: "Hotel", color: "bg-green-100 text-green-800" },
  ]

  const loginWithDemo = (email: string, password: string) => {
    setFormData({ email, password })
    authModel.loginSubmitted({ email, password })
  }

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
                <Label htmlFor="password">Contraseña</Label>
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
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
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

        {/* Demo Accounts */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Cuentas Demo</CardTitle>
            <CardDescription className="text-xs">Prueba la plataforma con diferentes roles</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {demoAccounts.map((account, index) => (
              <div key={index}>
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
      </div>
    </div>
  )
}
