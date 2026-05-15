"use client"

import { useEffect } from "react"
import { useUnit } from "effector-react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Calendar, Users, Music, Hotel, TrendingUp, Clock } from "lucide-react"
import { NotificationsDropdown } from "@/widgets/notification-bell"
import { TodayEventsCard, UpcomingEventsCard } from "@/widgets/event-list"
import { $user } from "@/entities/user/model"
import { eventsModel } from "@/features/events/model"
import { notificationsModel } from "@/features/notifications/model"
import Link from "next/link"

export default function HomePage() {
  const router = useRouter()

  const { user, events, notifications } = useUnit({
    user: $user,
    events: eventsModel.$events,
    notifications: notificationsModel.$notifications,
  })

  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  const todayEvents = events.filter(event => event.date === today);
  const upcomingEvents = events.filter(event => event.date > today);

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
          <TodayEventsCard />
          <UpcomingEventsCard />
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
