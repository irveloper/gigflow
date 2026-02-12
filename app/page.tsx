"use client"

import { useEffect } from "react"
import { useUnit } from "effector-react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Navigation } from "@/components/navigation"
import { NotificationsDropdown } from "@/components/notifications-dropdown"
import { Calendar, Users, Music, Hotel, TrendingUp, Clock, MapPin } from "lucide-react"
import { $user } from "@/entities/user/model"
import { eventsModel } from "@/entities/event/model"
import { notificationsModel } from "@/entities/notification/model"
import Link from "next/link"

export default function HomePage() {
  const router = useRouter()

  const { user, events, notifications } = useUnit({
    user: $user,
    events: eventsModel.$events,
    notifications: notificationsModel.$notifications,
  })

  useEffect(() => {
    if (!user) {
      router.push("/auth/login")
      return
    }

    // Load data
    eventsModel.loadEvents()
    notificationsModel.loadNotifications()
  }, [user, router])

  if (!user) {
    return null
  }

  const todayEvents = events.filter((event) => event.date === new Date().toISOString().split("T")[0])

  const upcomingEvents = events.filter((event) => new Date(event.date) > new Date()).slice(0, 3)

  const stats = [
    {
      title: "Eventos Hoy",
      value: todayEvents.length,
      icon: Calendar,
      color: "text-blue-600",
      bgColor: "bg-blue-100",
    },
    {
      title: "Próximos Eventos",
      value: upcomingEvents.length,
      icon: Clock,
      color: "text-green-600",
      bgColor: "bg-green-100",
    },
    {
      title: "Notificaciones",
      value: notifications.filter((n) => !n.read).length,
      icon: TrendingUp,
      color: "text-purple-600",
      bgColor: "bg-purple-100",
    },
  ]

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />

      <main className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Bienvenido, {user.name}</h1>
            <p className="text-gray-600 mt-1">
              {user.role === "musician" && "Gestiona tus eventos y presentaciones"}
              {user.role === "manager" && "Administra músicos y eventos"}
              {user.role === "hotel" && "Gestiona los eventos de tu hotel"}
            </p>
          </div>
          <NotificationsDropdown />
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {stats.map((stat, index) => (
            <Card key={index}>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">{stat.title}</p>
                    <p className="text-3xl font-bold text-gray-900">{stat.value}</p>
                  </div>
                  <div className={`p-3 rounded-full ${stat.bgColor}`}>
                    <stat.icon className={`h-6 w-6 ${stat.color}`} />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Today's Events */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Eventos de Hoy
              </CardTitle>
              <CardDescription>
                {todayEvents.length === 0
                  ? "No tienes eventos programados para hoy"
                  : `${todayEvents.length} evento(s) programado(s)`}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {todayEvents.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No hay eventos para hoy</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {todayEvents.map((event) => (
                    <div key={event.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                      <div className="flex-1">
                        <h3 className="font-semibold text-gray-900">{event.title}</h3>
                        <div className="flex items-center gap-4 mt-1 text-sm text-gray-600">
                          <span className="flex items-center gap-1">
                            <Clock className="h-4 w-4" />
                            {event.time}
                          </span>
                          <span className="flex items-center gap-1">
                            <MapPin className="h-4 w-4" />
                            {event.hotel}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={event.status === "scheduled" ? "default" : "secondary"}>
                          {event.status === "scheduled" ? "Programado" : "En Progreso"}
                        </Badge>
                        {user.role === "musician" && event.status === "scheduled" && (
                          <Button asChild size="sm">
                            <Link href={`/check-in/${event.id}`}>Check-in</Link>
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Upcoming Events */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Próximos Eventos
              </CardTitle>
              <CardDescription>Eventos programados para los próximos días</CardDescription>
            </CardHeader>
            <CardContent>
              {upcomingEvents.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No hay eventos próximos</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {upcomingEvents.map((event) => (
                    <div key={event.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                      <div className="flex-1">
                        <h3 className="font-semibold text-gray-900">{event.title}</h3>
                        <div className="flex items-center gap-4 mt-1 text-sm text-gray-600">
                          <span>{new Date(event.date).toLocaleDateString("es-ES")}</span>
                          <span className="flex items-center gap-1">
                            <Clock className="h-4 w-4" />
                            {event.time}
                          </span>
                          <span className="flex items-center gap-1">
                            <MapPin className="h-4 w-4" />
                            {event.hotel}
                          </span>
                        </div>
                      </div>
                      <Badge variant="outline">{event.status === "scheduled" ? "Programado" : event.status}</Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <Card className="mt-8">
          <CardHeader>
            <CardTitle>Acciones Rápidas</CardTitle>
            <CardDescription>Accede rápidamente a las funciones principales</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Button asChild variant="outline" className="h-20 flex-col bg-transparent">
                <Link href="/calendar">
                  <Calendar className="h-6 w-6 mb-2" />
                  Calendario
                </Link>
              </Button>

              {user.role === "manager" && (
                <>
                  <Button asChild variant="outline" className="h-20 flex-col bg-transparent">
                    <Link href="/admin/musicians">
                      <Music className="h-6 w-6 mb-2" />
                      Músicos
                    </Link>
                  </Button>
                  <Button asChild variant="outline" className="h-20 flex-col bg-transparent">
                    <Link href="/admin/hotels">
                      <Hotel className="h-6 w-6 mb-2" />
                      Hoteles
                    </Link>
                  </Button>
                  <Button asChild variant="outline" className="h-20 flex-col bg-transparent">
                    <Link href="/admin/events">
                      <Users className="h-6 w-6 mb-2" />
                      Eventos
                    </Link>
                  </Button>
                </>
              )}

              {user.role === "hotel" && (
                <Button asChild variant="outline" className="h-20 flex-col bg-transparent">
                  <Link href="/hotel/dashboard">
                    <Hotel className="h-6 w-6 mb-2" />
                    Mi Hotel
                  </Link>
                </Button>
              )}

              <Button asChild variant="outline" className="h-20 flex-col bg-transparent">
                <Link href="/profile">
                  <Users className="h-6 w-6 mb-2" />
                  Perfil
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
