"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { useUnit } from "effector-react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Music, Mail, Lock, User, Phone, UserPlus } from "lucide-react"
import { authModel } from "@/features/auth/model"
import { $user } from "@/entities/user/model"
import { sileo } from "sileo"
import Link from "next/link"

export default function RegisterPage() {
  const router = useRouter()

  const { isLoading, authError, user, isAuthResolved } = useUnit({
    isLoading: authModel.$isLoading,
    authError: authModel.$authError,
    user: $user,
    isAuthResolved: authModel.$isAuthResolved,
  })

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
    role: "" as "musician" | "hotel" | "",
    phone: "",
    instruments: [] as string[],
    hotel: "",
    hourlyRate: 0,
    location: "",
    contactPerson: "",
  })

  // Redirect already-authenticated users away from register
  useEffect(() => {
    if (isAuthResolved && user) {
      router.replace("/")
    }
  }, [isAuthResolved, router, user])

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.name || !formData.email || !formData.password || !formData.role) {
      sileo.error({ title: "Error", description: "Por favor completa todos los campos obligatorios" })
      return
    }

    if (formData.password !== formData.confirmPassword) {
      sileo.error({ title: "Error", description: "Las contraseñas no coinciden" })
      return
    }

    try {
      await authModel.registerFx({
        name: formData.name,
        email: formData.email,
        password: formData.password,
        role: formData.role,
        phone: formData.phone,
        instruments: formData.instruments,
        hotel: formData.hotel,
        ...(formData.hourlyRate > 0 ? { hourlyRate: formData.hourlyRate } : {}),
        location: formData.location,
        contactPerson: formData.contactPerson,
      })

      sileo.success({ title: "Registro exitoso", description: "Tu cuenta ha sido creada correctamente" })
      router.push("/")
    } catch {
      sileo.error({ title: "Error de Registro", description: "No se pudo crear la cuenta. Intenta de nuevo." })
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        {/* Header */}
        <div className="text-center">
          <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Music className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900">Gigflow</h1>
          <p className="text-gray-600 mt-2">Crear nueva cuenta</p>
        </div>

        {/* Register Form */}
        <Card>
          <CardHeader>
            <CardTitle>Registro</CardTitle>
            <CardDescription>Completa la información para crear tu cuenta</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleRegister} className="space-y-4">
              <div>
                <Label htmlFor="name">Nombre completo *</Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    id="name"
                    type="text"
                    placeholder="Tu nombre completo"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="pl-10"
                    disabled={isLoading}
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="email">Email *</Label>
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
                <Label htmlFor="role">Tipo de cuenta *</Label>
                <Select
                  value={formData.role}
                  onValueChange={(value: "musician" | "hotel") => setFormData({ ...formData, role: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona tu rol" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="musician">Músico</SelectItem>
                    <SelectItem value="hotel">Hotel</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="phone">Teléfono</Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    id="phone"
                    type="tel"
                    placeholder="+52 998 123 4567"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="pl-10"
                    disabled={isLoading}
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="password">Contraseña *</Label>
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

              <div>
                <Label htmlFor="confirmPassword">Confirmar contraseña *</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    id="confirmPassword"
                    type="password"
                    placeholder="••••••••"
                    value={formData.confirmPassword}
                    onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
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
                    Creando cuenta...
                  </>
                ) : (
                  <>
                    <UserPlus className="h-4 w-4 mr-2" />
                    Crear Cuenta
                  </>
                )}
              </Button>
            </form>

            <div className="mt-4 text-center">
              <Link href="/auth/login" className="text-sm text-blue-600 hover:underline">
                ¿Ya tienes cuenta? Inicia sesión aquí
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
