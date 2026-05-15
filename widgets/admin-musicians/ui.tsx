"use client"

import { useEffect } from "react"
import { useUnit } from "effector-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Skeleton } from "@/components/ui/skeleton"
import { Plus, Music, Phone, Mail, DollarSign, Trash2, Edit, AlertTriangle } from "lucide-react"
import { loadMusicians, musicianDeleted, $musicians, $isLoading } from "@/features/musicians"
import { $user } from "@/entities/user/model"
import { sileo } from "sileo"

export function AdminMusiciansManager() {
  const { musicians, isLoading, user } = useUnit({
    musicians: $musicians,
    isLoading: $isLoading,
    user: $user,
  })

  useEffect(() => {
    loadMusicians()
  }, [])

  const handleDeleteMusician = (id: string, name: string) => {
    if (confirm(`¿Estás seguro de que quieres eliminar a ${name}?`)) {
      musicianDeleted(id)
      sileo.success({ title: "Músico eliminado", description: `${name} ha sido eliminado correctamente` })
    }
  }

  if (!user || user.role !== "manager") {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="p-6 text-center">
            <AlertTriangle className="h-12 w-12 text-yellow-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Acceso Restringido</h2>
            <p className="text-gray-600">Solo los gerentes pueden acceder a esta sección.</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Gestión de Músicos</h1>
          <p className="text-gray-600 mt-1">Administra los músicos registrados en la plataforma</p>
        </div>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Agregar Músico
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Músicos</CardTitle>
            <Music className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{musicians.length}</div>
            <p className="text-xs text-muted-foreground">Registrados en la plataforma</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Músicos Activos</CardTitle>
            <Badge variant="secondary" className="bg-green-100 text-green-800">Activos</Badge>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{musicians.filter((m) => m.isActive).length}</div>
            <p className="text-xs text-muted-foreground">Disponibles para eventos</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tarifa Promedio</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${musicians.length > 0
                ? Math.round(musicians.reduce((acc, m) => acc + m.hourlyRate, 0) / musicians.length)
                : 0}
            </div>
            <p className="text-xs text-muted-foreground">Por hora</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Lista de Músicos</CardTitle>
          <CardDescription>Todos los músicos registrados en la plataforma</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="flex items-center space-x-4 p-4 border rounded-lg">
                  <Skeleton className="h-12 w-12 rounded-full" />
                  <div className="space-y-2 flex-1">
                    <Skeleton className="h-4 w-[200px]" />
                    <Skeleton className="h-4 w-[150px]" />
                  </div>
                  <Skeleton className="h-8 w-[100px]" />
                </div>
              ))}
            </div>
          ) : musicians.length === 0 ? (
            <div className="text-center py-8">
              <Music className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">No hay músicos registrados</p>
              <Button className="mt-4">
                <Plus className="h-4 w-4 mr-2" />
                Agregar primer músico
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {musicians.map((musician) => (
                <div
                  key={musician.id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50"
                >
                  <div className="flex items-center space-x-4">
                    <Avatar>
                      <AvatarImage src={musician.avatar || "/placeholder.svg"} />
                      <AvatarFallback>
                        {musician.name.split(" ").map((n) => n[0]).join("")}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold">{musician.name}</h3>
                        <Badge variant={musician.isActive ? "default" : "secondary"}>
                          {musician.isActive ? "Activo" : "Inactivo"}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-gray-600 mt-1">
                        <div className="flex items-center gap-1">
                          <Mail className="h-3 w-3" />
                          {musician.email}
                        </div>
                        <div className="flex items-center gap-1">
                          <Phone className="h-3 w-3" />
                          {musician.phone}
                        </div>
                        <div className="flex items-center gap-1">
                          <DollarSign className="h-3 w-3" />${musician.hourlyRate}/hr
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-1 mt-2">
                        {musician.shows.map((show, index) => (
                          <Badge key={index} variant="outline" className="text-xs">{show}</Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm">
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDeleteMusician(musician.id, musician.name)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
