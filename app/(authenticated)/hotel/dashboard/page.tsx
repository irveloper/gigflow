"use client"

import { useState } from "react"
import { useUnit } from "effector-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Calendar, Clock, Users, Download, Filter, Search, CheckCircle, XCircle } from "lucide-react"
import { eventsModel } from "@/features/events/model"
import { $user } from "@/entities/user/model"

export default function HotelDashboardPage() {
  const user = useUnit($user)
  const events = useUnit(eventsModel.$events)

  const today = new Date().toISOString().split("T")[0]

  const [filters, setFilters] = useState({
    dateFrom: today,
    dateTo: today,
    musician: "",
    status: "",
    search: "",
  })

  // Filter events for this hotel
  const hotelEvents = events.filter((event) => (user?.hotel ? event.hotel === user.hotel : true))

  // Apply filters
  const filteredEvents = hotelEvents.filter((event) => {
    if (filters.dateFrom && event.date < filters.dateFrom) return false
    if (filters.dateTo && event.date > filters.dateTo) return false
    if (filters.musician && !event.musician?.toLowerCase().includes(filters.musician.toLowerCase())) return false
    if (filters.status && event.status !== filters.status) return false
    if (filters.search && !event.title.toLowerCase().includes(filters.search.toLowerCase())) return false
    return true
  })

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

  const exportToCSV = () => {
    const csvContent = [
      ["Fecha", "Hora", "Evento", "Músico", "Estado", "Check-in"],
      ...filteredEvents.map((event) => [
        new Date(event.date).toLocaleDateString("es-MX"),
        event.time,
        event.title,
        event.musician || "",
        getStatusText(event.status),
        event.checkedIn ? "Sí" : "No",
      ]),
    ]
      .map((row) => row.join(","))
      .join("\n")

    const blob = new Blob([csvContent], { type: "text/csv" })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `eventos_${user?.hotel?.replace(/\s+/g, "_")}_${new Date().toISOString().split("T")[0]}.csv`
    a.click()
    window.URL.revokeObjectURL(url)
  }

  const clearFilters = () => {
    setFilters({
      dateFrom: today,
      dateTo: today,
      musician: "",
      status: "",
      search: "",
    })
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="container mx-auto max-w-7xl">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Dashboard del Hotel</h1>
            <p className="text-gray-600">{user?.hotel || "Panel de control del hotel"}</p>
          </div>

          <Button onClick={exportToCSV} disabled={filteredEvents.length === 0}>
            <Download className="h-4 w-4 mr-2" />
            Exportar CSV
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center space-x-2">
                <Calendar className="h-5 w-5 text-blue-500" />
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Eventos</p>
                  <p className="text-2xl font-bold">{hotelEvents.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center space-x-2">
                <CheckCircle className="h-5 w-5 text-green-500" />
                <div>
                  <p className="text-sm font-medium text-gray-600">Completados</p>
                  <p className="text-2xl font-bold">{hotelEvents.filter((e) => e.status === "completed").length}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center space-x-2">
                <Users className="h-5 w-5 text-purple-500" />
                <div>
                  <p className="text-sm font-medium text-gray-600">Músicos Únicos</p>
                  <p className="text-2xl font-bold">{new Set(hotelEvents.map((e) => e.musicianId)).size}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center space-x-2">
                <Clock className="h-5 w-5 text-orange-500" />
                <div>
                  <p className="text-sm font-medium text-gray-600">Check-ins</p>
                  <p className="text-2xl font-bold">{hotelEvents.filter((e) => e.checkedIn).length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Filter className="h-5 w-5" />
              Filtros
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
              <div>
                <Label htmlFor="search">Buscar</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    id="search"
                    placeholder="Buscar evento..."
                    value={filters.search}
                    onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                    className="pl-10"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="dateFrom">Fecha Desde</Label>
                <Input
                  id="dateFrom"
                  type="date"
                  value={filters.dateFrom}
                  onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })}
                />
              </div>

              <div>
                <Label htmlFor="dateTo">Fecha Hasta</Label>
                <Input
                  id="dateTo"
                  type="date"
                  value={filters.dateTo}
                  onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })}
                />
              </div>

              <div>
                <Label htmlFor="musician">Músico</Label>
                <Input
                  id="musician"
                  placeholder="Nombre del músico"
                  value={filters.musician}
                  onChange={(e) => setFilters({ ...filters, musician: e.target.value })}
                />
              </div>

              <div>
                <Label htmlFor="status">Estado</Label>
                <Select value={filters.status} onValueChange={(value) => setFilters({ ...filters, status: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Todos los estados" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="scheduled">Programado</SelectItem>
                    <SelectItem value="in-progress">En Curso</SelectItem>
                    <SelectItem value="completed">Completado</SelectItem>
                    <SelectItem value="cancelled">Cancelado</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-end">
                <Button variant="outline" onClick={clearFilters} className="w-full bg-transparent">
                  Limpiar
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Events History */}
        <Card>
          <CardHeader>
            <CardTitle>Historial de Eventos</CardTitle>
            <CardDescription>
              {filteredEvents.length} de {hotelEvents.length} eventos
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {filteredEvents.map((event) => (
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
                          <Users className="h-3 w-3" />
                          {event.musician}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <Badge className={getStatusColor(event.status)}>{getStatusText(event.status)}</Badge>

                    {event.checkedIn && (
                      <Badge variant="secondary" className="flex items-center gap-1">
                        <CheckCircle className="h-3 w-3" />
                        Check-in:{" "}
                        {event.checkInTime
                          ? new Date(event.checkInTime).toLocaleTimeString("es-MX", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })
                          : "Sí"}
                      </Badge>
                    )}

                    {!event.checkedIn && event.status === "scheduled" && (
                      <Badge variant="outline" className="flex items-center gap-1">
                        <XCircle className="h-3 w-3" />
                        Sin Check-in
                      </Badge>
                    )}
                  </div>
                </div>
              ))}

              {filteredEvents.length === 0 && (
                <div className="text-center py-12 text-gray-500">
                  <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No se encontraron eventos</p>
                  <p className="text-sm">Ajusta los filtros para ver más resultados</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Performance Summary */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Resumen de Desempeño</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="text-center p-4 bg-blue-50 rounded-lg">
                <p className="text-2xl font-bold text-blue-600">
                  {hotelEvents.length > 0
                    ? Math.round((hotelEvents.filter((e) => e.checkedIn).length / hotelEvents.length) * 100)
                    : 0}
                  %
                </p>
                <p className="text-sm text-gray-600">Tasa de Check-in</p>
              </div>

              <div className="text-center p-4 bg-green-50 rounded-lg">
                <p className="text-2xl font-bold text-green-600">
                  {hotelEvents.length > 0
                    ? Math.round(
                        (hotelEvents.filter((e) => e.status === "completed").length / hotelEvents.length) * 100,
                      )
                    : 0}
                  %
                </p>
                <p className="text-sm text-gray-600">Eventos Completados</p>
              </div>

              <div className="text-center p-4 bg-purple-50 rounded-lg">
                <p className="text-2xl font-bold text-purple-600">{hotelEvents.length * 2}h</p>
                <p className="text-sm text-gray-600">Horas de Entretenimiento</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
