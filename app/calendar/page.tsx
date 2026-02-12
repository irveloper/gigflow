"use client"

import { useState, useEffect } from "react"
import { useUnit } from "effector-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Calendar, Clock, MapPin, ChevronLeft, ChevronRight, Camera } from "lucide-react"
import { eventsModel } from "@/entities/event/model"
import { $user } from "@/entities/user/model"
import Link from "next/link"

export default function CalendarPage() {
  const { events, user, isLoading } = useUnit({
    events: eventsModel.$events,
    user: $user,
    isLoading: eventsModel.$isLoading,
  })

  const [currentDate, setCurrentDate] = useState(new Date())

  useEffect(() => {
    eventsModel.loadEvents()
  }, [])

  // Get current month and year
  const currentMonth = currentDate.getMonth()
  const currentYear = currentDate.getFullYear()

  // Filter events for current user if musician, otherwise show all
  const userEvents = user?.role === "musician" ? events.filter((event) => event.musicianId === user.id) : events

  // Get events for current month
  const monthEvents = userEvents.filter((event) => {
    const eventDate = new Date(event.date)
    return eventDate.getMonth() === currentMonth && eventDate.getFullYear() === currentYear
  })

  // Calendar generation logic
  const firstDayOfMonth = new Date(currentYear, currentMonth, 1)
  const lastDayOfMonth = new Date(currentYear, currentMonth + 1, 0)
  const firstDayWeekday = firstDayOfMonth.getDay() // 0 = Sunday
  const daysInMonth = lastDayOfMonth.getDate()

  // Generate calendar grid
  const calendarDays = []

  // Add empty cells for days before the first day of the month
  for (let i = 0; i < firstDayWeekday; i++) {
    calendarDays.push(null)
  }

  // Add days of the month
  for (let day = 1; day <= daysInMonth; day++) {
    calendarDays.push(day)
  }

  // Helper function to get events for a specific day
  const getEventsForDay = (day: number) => {
    if (!day) return []
    const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`
    return monthEvents.filter((event) => event.date === dateStr)
  }

  // Helper function to check if a day is today
  const isToday = (day: number) => {
    if (!day) return false
    const today = new Date()
    return today.getDate() === day && today.getMonth() === currentMonth && today.getFullYear() === currentYear
  }

  // Helper function to check if a day is in the past
  const isPastDay = (day: number) => {
    if (!day) return false
    const today = new Date()
    const dayDate = new Date(currentYear, currentMonth, day)
    return dayDate < new Date(today.getFullYear(), today.getMonth(), today.getDate())
  }

  const monthNames = [
    "Enero",
    "Febrero",
    "Marzo",
    "Abril",
    "Mayo",
    "Junio",
    "Julio",
    "Agosto",
    "Septiembre",
    "Octubre",
    "Noviembre",
    "Diciembre",
  ]

  const weekDays = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"]

  const navigateMonth = (direction: "prev" | "next") => {
    setCurrentDate((prev) => {
      const newDate = new Date(prev)
      if (direction === "prev") {
        newDate.setMonth(prev.getMonth() - 1)
      } else {
        newDate.setMonth(prev.getMonth() + 1)
      }
      return newDate
    })
  }

  const goToToday = () => {
    setCurrentDate(new Date())
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 p-4 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Cargando calendario...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="container mx-auto max-w-7xl">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            {user?.role === "musician" ? "Mi Calendario" : "Calendario de Eventos"}
          </h1>
          <p className="text-gray-600">
            {user?.role === "musician" ? "Visualiza tus presentaciones programadas" : "Todos los eventos programados"}
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Calendar */}
          <Card className="lg:col-span-3">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  {monthNames[currentMonth]} {currentYear}
                </CardTitle>

                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => navigateMonth("prev")}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="sm" onClick={goToToday}>
                    Hoy
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => navigateMonth("next")}>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>

            <CardContent>
              {/* Week day headers */}
              <div className="grid grid-cols-7 gap-1 mb-4">
                {weekDays.map((day) => (
                  <div key={day} className="p-3 text-center text-sm font-medium text-gray-500 border-b">
                    {day}
                  </div>
                ))}
              </div>

              {/* Calendar grid */}
              <div className="grid grid-cols-7 gap-1">
                {calendarDays.map((day, index) => {
                  if (day === null) {
                    return <div key={`empty-${index}`} className="p-2 h-24 bg-gray-50 rounded"></div>
                  }

                  const dayEvents = getEventsForDay(day)
                  const todayClass = isToday(day)
                  const pastClass = isPastDay(day)

                  return (
                    <div
                      key={day}
                      className={`p-2 h-24 border rounded-lg transition-colors hover:bg-gray-50 ${
                        todayClass
                          ? "bg-blue-50 border-blue-200 ring-2 ring-blue-100"
                          : pastClass
                            ? "bg-gray-50 border-gray-200"
                            : "bg-white border-gray-200"
                      }`}
                    >
                      <div
                        className={`text-sm font-medium mb-1 ${
                          todayClass ? "text-blue-600" : pastClass ? "text-gray-400" : "text-gray-900"
                        }`}
                      >
                        {day}
                      </div>

                      <div className="space-y-1 overflow-hidden">
                        {dayEvents.slice(0, 2).map((event) => (
                          <div
                            key={event.id}
                            className={`text-xs p-1 rounded truncate cursor-pointer transition-colors ${
                              event.checkedIn
                                ? "bg-green-100 text-green-800 hover:bg-green-200"
                                : event.status === "cancelled"
                                  ? "bg-red-100 text-red-800 hover:bg-red-200"
                                  : "bg-blue-100 text-blue-800 hover:bg-blue-200"
                            }`}
                            title={`${event.time} - ${event.title} (${event.musician})`}
                          >
                            <div className="flex items-center gap-1">
                              <Clock className="h-2 w-2" />
                              {event.time}
                            </div>
                            <div className="truncate font-medium">{event.title}</div>
                          </div>
                        ))}

                        {dayEvents.length > 2 && (
                          <div className="text-xs text-gray-500 text-center py-1">+{dayEvents.length - 2} más</div>
                        )}

                        {dayEvents.length === 0 && !pastClass && (
                          <div className="text-xs text-gray-300 text-center py-2">Sin eventos</div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Today's Events */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Eventos de Hoy</CardTitle>
                <CardDescription>
                  {new Date().toLocaleDateString("es-MX", {
                    weekday: "long",
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </CardDescription>
              </CardHeader>

              <CardContent className="space-y-3">
                {monthEvents
                  .filter((event) => {
                    const today = new Date().toISOString().split("T")[0]
                    return event.date === today
                  })
                  .map((event) => (
                    <div key={event.id} className="p-3 border rounded-lg space-y-2">
                      <div className="flex items-start justify-between">
                        <h3 className="font-medium text-sm">{event.title}</h3>
                        <Badge variant={event.checkedIn ? "default" : "outline"} className="text-xs">
                          {event.checkedIn ? "✓ Check-in" : "Pendiente"}
                        </Badge>
                      </div>

                      <div className="space-y-1 text-xs text-gray-600">
                        <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {event.time}
                        </div>
                        <div className="flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {event.hotel}
                        </div>
                        {event.musician && (
                          <div className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {event.musician}
                          </div>
                        )}
                      </div>

                      {!event.checkedIn && user?.role === "musician" && (
                        <Link href={`/check-in/${event.id}`}>
                          <Button size="sm" className="w-full mt-2">
                            <Camera className="h-3 w-3 mr-1" />
                            Hacer Check-in
                          </Button>
                        </Link>
                      )}
                    </div>
                  ))}

                {monthEvents.filter((event) => {
                  const today = new Date().toISOString().split("T")[0]
                  return event.date === today
                }).length === 0 && (
                  <div className="text-center py-6 text-gray-500">
                    <Calendar className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No hay eventos hoy</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Upcoming Events */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Próximos Eventos</CardTitle>
                <CardDescription>Los siguientes 5 eventos</CardDescription>
              </CardHeader>

              <CardContent className="space-y-3">
                {monthEvents
                  .filter((event) => {
                    const today = new Date().toISOString().split("T")[0]
                    return event.date > today
                  })
                  .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
                  .slice(0, 5)
                  .map((event) => (
                    <div key={event.id} className="p-3 border rounded-lg space-y-2">
                      <div className="flex items-start justify-between">
                        <h3 className="font-medium text-sm">{event.title}</h3>
                        <Badge variant="outline" className="text-xs">
                          {event.status === "scheduled" ? "Programado" : event.status}
                        </Badge>
                      </div>

                      <div className="space-y-1 text-xs text-gray-600">
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {new Date(event.date).toLocaleDateString("es-MX")}
                        </div>
                        <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {event.time}
                        </div>
                        <div className="flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {event.hotel}
                        </div>
                      </div>
                    </div>
                  ))}

                {monthEvents.filter((event) => {
                  const today = new Date().toISOString().split("T")[0]
                  return event.date > today
                }).length === 0 && (
                  <div className="text-center py-6 text-gray-500">
                    <Calendar className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No hay eventos próximos</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Monthly Summary */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Resumen del Mes</CardTitle>
              </CardHeader>

              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center p-3 bg-blue-50 rounded-lg">
                    <p className="text-xl font-bold text-blue-600">{monthEvents.length}</p>
                    <p className="text-xs text-gray-600">Eventos</p>
                  </div>

                  <div className="text-center p-3 bg-green-50 rounded-lg">
                    <p className="text-xl font-bold text-green-600">{monthEvents.filter((e) => e.checkedIn).length}</p>
                    <p className="text-xs text-gray-600">Completados</p>
                  </div>

                  <div className="text-center p-3 bg-purple-50 rounded-lg">
                    <p className="text-xl font-bold text-purple-600">{new Set(monthEvents.map((e) => e.hotel)).size}</p>
                    <p className="text-xs text-gray-600">Hoteles</p>
                  </div>

                  <div className="text-center p-3 bg-orange-50 rounded-lg">
                    <p className="text-xl font-bold text-orange-600">{monthEvents.length * 2}h</p>
                    <p className="text-xs text-gray-600">Horas Est.</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
