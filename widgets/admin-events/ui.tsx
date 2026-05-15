"use client"

import { useEffect, useState } from "react"
import { useUnit } from "effector-react"
import type { CreateEventInput, Event } from "@/shared/types"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Calendar, Plus, Edit, Trash2, Users, MapPin, Clock, AlertTriangle, XCircle, CheckCircle } from "lucide-react"
import { getEventTimeLabel, getSchedulingConflicts, getEventStatusLabel, getCalendarEventTone } from "@/entities/event"
import { eventsModel } from "@/features/events"
import { hotelsModel } from "@/features/hotels"
import { musiciansModel } from "@/features/musicians"
import { $user } from "@/entities/user/model"
import { sileo } from "sileo"

const CONCEPTS = [
  "Acoustic Set", "Jazz Trio", "Solo Piano", "Vocal Jazz",
  "Bossa Nova", "Guitar Solo", "Latin Jazz", "Saxophone Solo",
]

const TONE_TO_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  "checked-in": "default",
  "cancelled": "destructive",
  "in-progress": "secondary",
  "scheduled": "outline",
}

const EMPTY_FORM = {
  title: "", description: "", date: "", time: "",
  durationMinutes: "120",
  hotelId: "", musicianId: "", concept: "",
}

type FormState = typeof EMPTY_FORM

function eventToForm(event: Event): FormState {
  return {
    title: event.title,
    description: event.description ?? "",
    date: event.date,
    time: event.time,
    durationMinutes: String(event.durationMinutes),
    hotelId: event.hotelId ?? "",
    musicianId: event.musicianId ?? "",
    concept: "",
  }
}

export function AdminEventsManager() {
  const user = useUnit($user)
  const { events } = useUnit({ events: eventsModel.$events })
  const { hotels } = useUnit({ hotels: hotelsModel.$hotels })
  const { musicians } = useUnit({ musicians: musiciansModel.$musicians })
  const { pendingCheckIns } = useUnit({ pendingCheckIns: eventsModel.$pendingCheckIns })
  const { isLoading } = useUnit({ isLoading: eventsModel.$isLoading })
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [formData, setFormData] = useState<FormState>(EMPTY_FORM)
  const [formConflict, setFormConflict] = useState<string | null>(null)

  const [eventToDelete, setEventToDelete] = useState<Event | null>(null)
  const [eventToCancel, setEventToCancel] = useState<Event | null>(null)
  const [eventToComplete, setEventToComplete] = useState<Event | null>(null)
  const [eventToEdit, setEventToEdit] = useState<Event | null>(null)
  const [editConflict, setEditConflict] = useState<string | null>(null)

  useEffect(() => {
    eventsModel.loadEvents()
    hotelsModel.loadHotels()
    musiciansModel.loadMusicians()
  }, [])

  const handleCreate = () => {
    const { title, date, time, hotelId, musicianId, durationMinutes } = formData
    if (!title || !date || !time || !hotelId || !musicianId || !durationMinutes) {
      sileo.error({ title: "Error", description: "Completa todos los campos obligatorios" })
      return
    }

    const hotel = hotels.find((h) => h.id === hotelId)
    const musician = musicians.find((m) => m.id === musicianId)

    const candidateEvent: CreateEventInput = {
      title,
      description: formData.description || undefined,
      date,
      time,
      durationMinutes: Number(durationMinutes),
      hotel: hotel?.name ?? "",
      hotelId,
      musician: musician?.name,
      musicianId,
      status: "scheduled",
    }

    const conflicts = getSchedulingConflicts({
      candidate: { id: "pending-event", ...candidateEvent, checkedIn: false },
      events,
    })

    if (conflicts.length > 0) {
      setFormConflict(`${musician?.name} ya tiene un evento que se cruza con este horario`)
      return
    }

    eventsModel.eventCreated(candidateEvent)
    sileo.success({ title: "Evento Creado", description: `Asignado a ${musician?.name}` })
    setFormData(EMPTY_FORM)
    setFormConflict(null)
    setIsCreateOpen(false)
  }

  const handleSaveEdit = () => {
    if (!eventToEdit) return
    const { title, date, time, hotelId, musicianId, durationMinutes } = formData
    if (!title || !date || !time || !hotelId || !musicianId || !durationMinutes) {
      sileo.error({ title: "Error", description: "Completa todos los campos obligatorios" })
      return
    }

    const hotel = hotels.find((h) => h.id === hotelId)
    const musician = musicians.find((m) => m.id === musicianId)

    const updated: Event = {
      ...eventToEdit,
      title,
      description: formData.description || undefined,
      date,
      time,
      durationMinutes: Number(durationMinutes),
      hotel: hotel?.name ?? eventToEdit.hotel,
      hotelId,
      musician: musician?.name ?? eventToEdit.musician,
      musicianId,
    }

    const conflicts = getSchedulingConflicts({
      candidate: updated,
      events,
      ignoreEventId: eventToEdit.id,
    })

    if (conflicts.length > 0) {
      setEditConflict(`${musician?.name} ya tiene un evento que se cruza con este horario`)
      return
    }

    eventsModel.updateEvent(updated)
    sileo.success({ title: "Evento Actualizado" })
    setEventToEdit(null)
    setEditConflict(null)
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

  const todayCount = events.filter((e) => e.date === new Date().toISOString().split("T")[0]).length
  const activeMusicians = new Set(events.map((e) => e.musicianId)).size
  const activeHotels = new Set(events.map((e) => e.hotel)).size
  const isLocked = (event: Event) => event.status === "in-progress" || event.status === "completed"

  const EventForm = ({ disabled }: { disabled?: boolean }) => (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div>
        <Label htmlFor="title">Título *</Label>
        <Input id="title" value={formData.title} onChange={(e) => setFormData({ ...formData, title: e.target.value })} placeholder="Ej: Acoustic Set - Lobby" />
      </div>
      <div>
        <Label htmlFor="concept">Concepto Musical</Label>
        <Select value={formData.concept} onValueChange={(v) => setFormData({ ...formData, concept: v })}>
          <SelectTrigger><SelectValue placeholder="Seleccionar concepto" /></SelectTrigger>
          <SelectContent>{CONCEPTS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <div>
        <Label htmlFor="date">Fecha *</Label>
        <Input id="date" type="date" value={formData.date} onChange={(e) => setFormData({ ...formData, date: e.target.value })} disabled={disabled} />
      </div>
      <div>
        <Label htmlFor="time">Hora *</Label>
        <Input id="time" type="time" value={formData.time} onChange={(e) => setFormData({ ...formData, time: e.target.value })} disabled={disabled} />
      </div>
      <div>
        <Label htmlFor="duration">Duración *</Label>
        <Select value={formData.durationMinutes} onValueChange={(v) => setFormData({ ...formData, durationMinutes: v })}>
          <SelectTrigger id="duration"><SelectValue placeholder="Seleccionar duración" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="60">60 min</SelectItem>
            <SelectItem value="90">90 min</SelectItem>
            <SelectItem value="120">120 min</SelectItem>
            <SelectItem value="180">180 min</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label htmlFor="hotel">Hotel *</Label>
        <Select value={formData.hotelId} onValueChange={(v) => setFormData({ ...formData, hotelId: v })}>
          <SelectTrigger><SelectValue placeholder="Seleccionar hotel" /></SelectTrigger>
          <SelectContent>{hotels.map((h) => <SelectItem key={h.id} value={h.id}>{h.name}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <div>
        <Label htmlFor="musician">Músico *</Label>
        <Select value={formData.musicianId} onValueChange={(v) => setFormData({ ...formData, musicianId: v })} disabled={disabled}>
          <SelectTrigger><SelectValue placeholder="Asignar músico" /></SelectTrigger>
          <SelectContent>{musicians.map((m) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <div className="md:col-span-2">
        <Label htmlFor="description">Descripción</Label>
        <Textarea id="description" value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} placeholder="Detalles adicionales..." rows={3} />
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="container mx-auto max-w-7xl">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Gestión de Eventos</h1>
            <p className="text-gray-600">Crear, asignar y administrar presentaciones musicales</p>
          </div>

          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4 mr-2" />Crear Evento</Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Crear Nuevo Evento</DialogTitle>
                <DialogDescription>Completa la información del evento y asígnalo a un músico</DialogDescription>
              </DialogHeader>
              <EventForm />
              {formConflict && <p className="text-sm text-red-600">{formConflict}</p>}
              <div className="flex gap-2 pt-4">
                <Button onClick={handleCreate} className="flex-1">Crear Evento</Button>
                <Button variant="outline" onClick={() => { setIsCreateOpen(false); setFormConflict(null) }}>Cancelar</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          {[
            { icon: Calendar, color: "text-blue-500", label: "Total Eventos", value: events.length },
            { icon: Clock, color: "text-green-500", label: "Hoy", value: todayCount },
            { icon: Users, color: "text-purple-500", label: "Músicos Activos", value: activeMusicians },
            { icon: MapPin, color: "text-orange-500", label: "Hoteles", value: activeHotels },
          ].map(({ icon: Icon, color, label, value }) => (
            <Card key={label}>
              <CardContent className="p-6">
                <div className="flex items-center space-x-2">
                  <Icon className={`h-5 w-5 ${color}`} />
                  <div>
                    <p className="text-sm font-medium text-gray-600">{label}</p>
                    <p className="text-2xl font-bold">{value}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Tabs defaultValue="events">
          <TabsList>
            <TabsTrigger value="events">Eventos</TabsTrigger>
            <TabsTrigger value="pending" className="relative">
              Pendientes de confirmación
              {pendingCheckIns.length > 0 && (
                <Badge className="ml-2 h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs">
                  {pendingCheckIns.length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="events">
            <Card>
              <CardHeader>
                <CardTitle>Eventos Programados</CardTitle>
                <CardDescription>Lista completa de presentaciones musicales</CardDescription>
              </CardHeader>
              <CardContent>
                {isLoading && events.length === 0 ? (
                  <div className="space-y-3">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="h-16 bg-gray-100 rounded-lg animate-pulse" />
                    ))}
                  </div>
                ) : (
                  <div className="space-y-4">
                    {events.map((event) => {
                      const tone = getCalendarEventTone(event)
                      const badgeVariant = TONE_TO_VARIANT[tone] ?? "outline"
                      return (
                        <div key={event.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50">
                          <div className="flex items-center space-x-4">
                            <div className="w-2 h-2 bg-blue-500 rounded-full" />
                            <div>
                              <h3 className="font-medium">{event.title}</h3>
                              <div className="flex items-center gap-4 text-sm text-gray-600 mt-1">
                                <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{new Date(event.date).toLocaleDateString("es-MX")}</span>
                                <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{getEventTimeLabel(event)}</span>
                                <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{event.hotel}</span>
                                <span className="flex items-center gap-1"><Users className="h-3 w-3" />{event.musician}</span>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <Badge variant={badgeVariant}>{getEventStatusLabel(event)}</Badge>
                            {event.checkedIn && event.checkInTime && (
                              <Badge variant="secondary">
                                Check-in: {new Date(event.checkInTime).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })}
                              </Badge>
                            )}
                            <div className="flex gap-1">
                              {event.status !== "completed" && event.status !== "cancelled" && (
                                <Button variant="ghost" size="sm" className="text-yellow-600 hover:text-yellow-700" onClick={() => setEventToCancel(event)}>
                                  <XCircle className="h-4 w-4" />
                                </Button>
                              )}
                              {(event.status === "scheduled" || event.status === "in-progress") && (
                                <Button variant="ghost" size="sm" className="text-green-600 hover:text-green-700" onClick={() => setEventToComplete(event)}>
                                  <CheckCircle className="h-4 w-4" />
                                </Button>
                              )}
                              <Button variant="ghost" size="sm" onClick={() => { setEventToEdit(event); setFormData(eventToForm(event)); setEditConflict(null) }}>
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="sm" className="text-red-600 hover:text-red-700" onClick={() => setEventToDelete(event)}>
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                    {events.length === 0 && (
                      <div className="text-center py-12 text-gray-500">
                        <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
                        <p>No hay eventos programados</p>
                        <p className="text-sm">Crea tu primer evento usando el botón "Crear Evento"</p>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="pending">
            <Card>
              <CardHeader>
                <CardTitle>Pendientes de Confirmación</CardTitle>
                <CardDescription>Check-ins registrados por músicos esperando aprobación</CardDescription>
              </CardHeader>
              <CardContent>
                {pendingCheckIns.length === 0 ? (
                  <div className="text-center py-12 text-gray-500">
                    <CheckCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No hay check-ins pendientes de confirmación</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {pendingCheckIns.map((event) => (
                      <div key={event.id} className="flex items-center justify-between p-4 border rounded-lg">
                        <div>
                          <h3 className="font-medium">{event.title}</h3>
                          <div className="flex items-center gap-4 text-sm text-gray-600 mt-1">
                            <span className="flex items-center gap-1"><Users className="h-3 w-3" />{event.musician}</span>
                            <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{event.hotel}</span>
                            {event.checkInTime && (
                              <span className="flex items-center gap-1"><Clock className="h-3 w-3" />
                                Check-in: {new Date(event.checkInTime).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })}
                              </span>
                            )}
                            {event.checkInLocation && (
                              <span className="text-xs text-gray-500">{event.checkInLocation.lat.toFixed(4)}, {event.checkInLocation.lng.toFixed(4)}</span>
                            )}
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button size="sm" onClick={() => { eventsModel.confirmCheckIn(event.id); sileo.success({ title: "Check-in confirmado", description: event.title }) }}>
                            Confirmar
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => { eventsModel.rejectCheckIn(event.id); sileo.error({ title: "Check-in rechazado", description: event.title }) }}>
                            Rechazar
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Delete confirmation */}
        <AlertDialog open={!!eventToDelete} onOpenChange={(open) => { if (!open) setEventToDelete(null) }}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Eliminar Evento</AlertDialogTitle>
              <AlertDialogDescription>
                ¿Eliminar &quot;{eventToDelete?.title}&quot;? Esta acción no se puede deshacer.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={() => {
                if (!eventToDelete) return
                eventsModel.deleteEvent(eventToDelete.id)
                sileo.success({ title: "Evento eliminado", description: eventToDelete.title })
                setEventToDelete(null)
              }}>
                Eliminar
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Cancel confirmation */}
        <AlertDialog open={!!eventToCancel} onOpenChange={(open) => { if (!open) setEventToCancel(null) }}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Cancelar Evento</AlertDialogTitle>
              <AlertDialogDescription>
                ¿Cancelar &quot;{eventToCancel?.title}&quot;?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Volver</AlertDialogCancel>
              <AlertDialogAction onClick={() => {
                if (!eventToCancel) return
                eventsModel.cancelEvent(eventToCancel.id)
                sileo.warning({ title: "Evento cancelado", description: eventToCancel.title })
                setEventToCancel(null)
              }}>
                Cancelar Evento
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Complete confirmation */}
        <AlertDialog open={!!eventToComplete} onOpenChange={(open) => { if (!open) setEventToComplete(null) }}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Marcar como Completado</AlertDialogTitle>
              <AlertDialogDescription>
                ¿Marcar &quot;{eventToComplete?.title}&quot; como completado?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Volver</AlertDialogCancel>
              <AlertDialogAction onClick={() => {
                if (!eventToComplete) return
                eventsModel.completeEvent(eventToComplete.id)
                sileo.success({ title: "Evento completado", description: eventToComplete.title })
                setEventToComplete(null)
              }}>
                Marcar Completado
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Edit dialog */}
        <Dialog open={!!eventToEdit} onOpenChange={(open) => { if (!open) { setEventToEdit(null); setEditConflict(null) } }}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Editar Evento</DialogTitle>
              <DialogDescription>Modifica los datos del evento</DialogDescription>
            </DialogHeader>
            {eventToEdit && <EventForm disabled={isLocked(eventToEdit)} />}
            {editConflict && <p className="text-sm text-red-600">{editConflict}</p>}
            <div className="flex gap-2 pt-4">
              <Button onClick={handleSaveEdit} className="flex-1">Guardar Cambios</Button>
              <Button variant="outline" onClick={() => { setEventToEdit(null); setEditConflict(null) }}>Cancelar</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}
