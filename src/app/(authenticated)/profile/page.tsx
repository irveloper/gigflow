"use client"

import { useState, useEffect } from "react"
import { useUnit } from "effector-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { User, Phone, Mail, Music, Save, Edit } from "lucide-react"
import { $user } from "@/entities/user/model"
import { sileo } from "sileo"
import { trpc } from "@/shared/lib/trpc"

type MusicianStats = {
  performances: number
  hoursWorked: number
  hotels: number
  punctuality: number
}

export default function ProfilePage() {
  const user = useUnit($user)
  const [stats, setStats] = useState<MusicianStats | null>(null)

  useEffect(() => {
    if (user?.role === "musician") {
      trpc.musicians.myStats.query().then(setStats).catch(console.error)
    }
  }, [user?.role])

  const [isEditing, setIsEditing] = useState(false)
  const [formData, setFormData] = useState({
    name: user?.name || "",
    email: user?.email || "",
    phone: user?.phone || "",
    instruments: user?.instruments?.join(", ") || "",
    bio: "Músico profesional con más de 10 años de experiencia en presentaciones en vivo. Especializado en géneros acústicos, jazz y música contemporánea.",
  })

  const handleSave = () => {
    // Aquí iría la lógica para actualizar el perfil
    sileo.success({ title: "Perfil actualizado", description: "Tus cambios han sido guardados correctamente" })
    setIsEditing(false)
  }

  if (!user) {
    return <div>Cargando...</div>
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="container mx-auto max-w-4xl">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Mi Perfil</h1>
          <p className="text-gray-600">Gestiona tu información personal y profesional</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Profile Summary */}
          <Card className="lg:col-span-1">
            <CardContent className="p-6 text-center">
              <div className="w-24 h-24 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <User className="h-12 w-12 text-blue-600" />
              </div>

              <h2 className="text-xl font-semibold mb-1">{user.name}</h2>
              <p className="text-gray-600 mb-3">{user.email}</p>

              <Badge variant="secondary" className="mb-4">
                {user.role === "musician" && "Músico"}
                {user.role === "manager" && "Gerente"}
                {user.role === "hotel" && "Hotel"}
              </Badge>

              <div className="space-y-2 text-sm text-gray-600">
                {user.phone && (
                  <div className="flex items-center justify-center gap-2">
                    <Phone className="h-4 w-4" />
                    {user.phone}
                  </div>
                )}

                <div className="flex items-center justify-center gap-2">
                  <Mail className="h-4 w-4" />
                  {user.email}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Profile Details */}
          <Card className="lg:col-span-2">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Información Personal</CardTitle>
                <CardDescription>Actualiza tu información de contacto y detalles profesionales</CardDescription>
              </div>

              <Button variant={isEditing ? "outline" : "default"} onClick={() => setIsEditing(!isEditing)}>
                <Edit className="h-4 w-4 mr-2" />
                {isEditing ? "Cancelar" : "Editar"}
              </Button>
            </CardHeader>

            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="name">Nombre Completo</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    disabled={!isEditing}
                  />
                </div>

                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    disabled={!isEditing}
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="phone">Teléfono</Label>
                <Input
                  id="phone"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  disabled={!isEditing}
                  placeholder="+52 998 123 4567"
                />
              </div>

              {user.role === "musician" && (
                <>
                  <div>
                    <Label htmlFor="instruments">Instrumentos/Conceptos Musicales</Label>
                    <Input
                      id="instruments"
                      value={formData.instruments}
                      onChange={(e) => setFormData({ ...formData, instruments: e.target.value })}
                      disabled={!isEditing}
                      placeholder="Acoustic Set, Jazz Trio, Solo Piano"
                    />
                    <p className="text-sm text-gray-500 mt-1">Separa los conceptos con comas</p>
                  </div>

                  <div>
                    <Label htmlFor="bio">Biografía</Label>
                    <Textarea
                      id="bio"
                      value={formData.bio}
                      onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                      disabled={!isEditing}
                      rows={4}
                      placeholder="Describe tu experiencia y especialidades musicales..."
                    />
                  </div>
                </>
              )}

              {isEditing && (
                <div className="flex gap-2 pt-4">
                  <Button onClick={handleSave} className="flex-1">
                    <Save className="h-4 w-4 mr-2" />
                    Guardar Cambios
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Statistics */}
        {user.role === "musician" && (
          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Music className="h-5 w-5" />
                Estadísticas del Mes
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="text-center p-4 bg-blue-50 rounded-lg">
                  <p className="text-2xl font-bold text-blue-600">
                    {stats ? stats.performances : "—"}
                  </p>
                  <p className="text-sm text-gray-600">Presentaciones</p>
                </div>

                <div className="text-center p-4 bg-green-50 rounded-lg">
                  <p className="text-2xl font-bold text-green-600">
                    {stats ? stats.hoursWorked : "—"}
                  </p>
                  <p className="text-sm text-gray-600">Horas Trabajadas</p>
                </div>

                <div className="text-center p-4 bg-purple-50 rounded-lg">
                  <p className="text-2xl font-bold text-purple-600">
                    {stats ? stats.hotels : "—"}
                  </p>
                  <p className="text-sm text-gray-600">Hoteles</p>
                </div>

                <div className="text-center p-4 bg-orange-50 rounded-lg">
                  <p className="text-2xl font-bold text-orange-600">
                    {stats ? `${stats.punctuality}%` : "—"}
                  </p>
                  <p className="text-sm text-gray-600">Puntualidad</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
