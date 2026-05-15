"use client"

import { Music, Clock } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { authModel } from "@/features/auth/model"
import { useRouter } from "next/navigation"

export default function PendingPage() {
  const router = useRouter()

  const handleLogout = async () => {
    await authModel.logoutFx()
    router.replace("/auth/login")
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
          <CardContent className="flex justify-center">
            <Button variant="outline" onClick={handleLogout}>
              Cerrar sesión
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
