"use client"

import { useState } from "react"
import { useUnit } from "effector-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Calendar, Plus, Edit, Trash2, Users, MapPin, Clock, AlertTriangle } from "lucide-react"
import { eventsModel } from "@/entities/event/model"
import { $user } from "@/entities/user/model"
import { useToast } from "@/hooks/use-toast"

export default function AdminEventsPage() {
  const user = useUnit($user)
  const { events, isLoading } = useUnit({
    events: eventsModel.$events,
    isLoading: eventsModel.$isLoading,
  })

  const { toast } = useToast()
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [selectedEvent, setSelectedEvent] = useState<any>(null)
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    date: "",
    time: "",
    hotel: "",
    musicianId: "",
    concept: "",
  })

  // Mock data for dropdowns
  const hotels = [
    { id: "1", name: "Hotel Paradisus Cancún" },
    { id: "2", name: "Hotel Moon Palace" },
    { id: "3", name: "Hotel Xcaret" },
    { id: "4", name: "Hotel Iberostar" },
  ]

  const musicians = [
    { id: "1", name: "Carlos Mendoza", concepts: ["Acoustic Set", "Jazz Trio", "Solo Piano"] },
    { id: "2", name: "Ana Rodríguez", concepts: ["Vocal Jazz", "Bossa Nova"] },
    { id: "3", name: "Miguel Santos", concepts: ["Guitar Solo", "Latin Jazz"] },
  ]

  const concepts = [
    "Acoustic Set",
    "Jazz Trio",
    "Solo Piano",
    "Vocal Jazz",
    "Bossa Nova",
    "Guitar Solo",
    "Latin Jazz",
    "Saxophone Solo",
  ]

  const handleCreateEvent = () => {
    if (!formData.title || !formData.date || !formData.time || !formData.hotel || !formData.musicianId) {
      toast({
        title: "Error",
        description: "Por favor completa todos los campos obligatorios",
        variant: "destructive",
      })
      return
    }

    // Check for conflicts
    const selectedMusician = musicians.find((m) => m.id === formData.musicianId)
    const conflictingEvent = events.find(
      (event) =>
        event.date === formData.date &&
        event.musicianId === formData.musicianId &&
        Math.abs(
          new Date(`${event.date} ${event.time}`).getTime() - new Date(`${formData.date} ${formData.time}`).getTime(),
        ) <
          2 * 60 * 60 * 1000,
    )

    if (conflictingEvent) {
      toast({
        title: "Conflicto de Horario",
        description: `${selectedMusician?.name} ya tiene un evento programado cerca de esta hora`,
        variant: "destructive",
      })
      return
    }

    const newEvent = {
      id: Math.random().toString(36).substr(2, 9),
      ...formData,
      musician: selectedMusician?.name,
      status: "scheduled" as const,
      checkedIn: false,
    }

    eventsModel.eventCreated(newEvent)

    toast({
      title: "Evento Creado",
      description: `Evento asignado a ${selectedMusician?.name}`,
    })

    setFormData({
      title: "",
      description: "",
      date: "",
      time: "",
      hotel: "",
      musicianId: "",
      concept: "",
    })
    setIsCreateDialogOpen(false)
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "scheduled":
        return "bg-blue-100 text-blue-800"
      case "in-progress":
        return "bg-yellow-100 text-yellow-800"
      case "completed":
        return "bg-green-100 text-green-800"
      case "cancelled":
        return "bg-red-100 text-red-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case "scheduled":
        return "Programado"
      case "in-progress":
        return "En Curso"
      case "completed":
        return "Completado"
      case "cancelled":
        return "Cancelado"
      default:
        return status
    }
  }

  if (user?.role !== "manager") {
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
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="container mx-auto max-w-7xl">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Gestión de Eventos</h1>
            <p className="text-gray-600">Crear, asignar y administrar presentaciones musicales</p>
          </div>

          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Crear Evento
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Crear Nuevo Evento</DialogTitle>
                <DialogDescription>Completa la información del evento y asígnalo a un músico</DialogDescription>
              </DialogHeader>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="title">Título del Evento *</Label>
                  <Input
                    id="title"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    placeholder="Ej: Acoustic Set - Lobby"
                  />
                </div>

                <div>
                  <Label htmlFor="concept">Concepto Musical</Label>
                  <Select
                    value={formData.concept}
                    onValueChange={(value) => setFormData({ ...formData, concept: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar concepto" />
                    </SelectTrigger>
                    <SelectContent>
                      {concepts.map((concept) => (
                        <SelectItem key={concept} value={concept}>
                          {concept}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="date">Fecha *</Label>
                  <Input
                    id="date"
                    type="date"
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  />
                </div>

                <div>
                  <Label htmlFor="time">Hora *</Label>
                  <Input
                    id="time"
                    type="time"
                    value={formData.time}
                    onChange={(e) => setFormData({ ...formData, time: e.target.value })}
                  />
                </div>

                <div>
                  <Label htmlFor="hotel">Hotel *</Label>
                  <Select value={formData.hotel} onValueChange={(value) => setFormData({ ...formData, hotel: value })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar hotel" />
                    </SelectTrigger>
                    <SelectContent>
                      {hotels.map((hotel) => (
                        <SelectItem key={hotel.id} value={hotel.name}>
                          {hotel.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="musician">Músico *</Label>
                  <Select
                    value={formData.musicianId}
                    onValueChange={(value) => setFormData({ ...formData, musicianId: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Asignar músico" />
                    </SelectTrigger>
                    <SelectContent>
                      {musicians.map((musician) => (
                        <SelectItem key={musician.id} value={musician.id}>
                          {musician.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="md:col-span-2">
                  <Label htmlFor="description">Descripción</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Detalles adicionales del evento..."
                    rows={3}
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-4">
                <Button onClick={handleCreateEvent} className="flex-1">
                  Crear Evento
                </Button>
                <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                  Cancelar
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center space-x-2">
                <Calendar className="h-5 w-5 text-blue-500" />
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Eventos</p>
                  <p className="text-2xl font-bold">{events.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center space-x-2">
                <Clock className="h-5 w-5 text-green-500" />
                <div>
                  <p className="text-sm font-medium text-gray-600">Hoy</p>
                  <p className="text-2xl font-bold">
                    {events.filter((e) => e.date === new Date().toISOString().split("T")[0]).length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center space-x-2">
                <Users className="h-5 w-5 text-purple-500" />
                <div>
                  <p className="text-sm font-medium text-gray-600">Músicos Activos</p>
                  <p className="text-2xl font-bold">{new Set(events.map((e) => e.musicianId)).size}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center space-x-2">
                <MapPin className="h-5 w-5 text-orange-500" />
                <div>
                  <p className="text-sm font-medium text-gray-600">Hoteles</p>
                  <p className="text-2xl font-bold">{new Set(events.map((e) => e.hotel)).size}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Events List */}
        <Card>
          <CardHeader>
            <CardTitle>Eventos Programados</CardTitle>
            <CardDescription>Lista completa de presentaciones musicales</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {events.map((event) => (
                <div
                  key={event.id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50"
                >
                  <div className="flex items-center space-x-4">
                    <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                    <div>
                      <h3 className="font-medium">{event.title}</h3>
                      <div className="flex items-center gap-4 text-sm text-gray-600 mt-1">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {new Date(event.date).toLocaleDateString("es-MX")}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {event.time}
                        </span>
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {event.hotel}
                        </span>
                        <span className="flex items-center gap-1">
                          <Users className="h-3 w-3" />
                          {event.musician}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <Badge className={getStatusColor(event.status)}>{getStatusText(event.status)}</Badge>

                    {event.checkedIn && (
                      <Badge variant="secondary">
                        Check-in:{" "}
                        {event.checkInTime
                          ? new Date(event.checkInTime).toLocaleTimeString("es-MX", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })
                          : "Sí"}
                      </Badge>
                    )}

                    <div className="flex gap-1">
                      <Button variant="ghost" size="sm">
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm" className="text-red-600 hover:text-red-700">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}

              {events.length === 0 && (
                <div className="text-center py-12 text-gray-500">
                  <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No hay eventos programados</p>
                  <p className="text-sm">Crea tu primer evento usando el botón "Crear Evento"</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
