"use client"

import { useUnit } from "effector-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Calendar, Clock, MapPin } from "lucide-react"
import { eventsModel } from "@/features/events/model"
import { $user } from "@/entities/user/model"
import Link from "next/link"

export function TodayEventsCard() {
  const { events, user } = useUnit({
    events: eventsModel.$todayEvents,
    user: $user,
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          Eventos de Hoy
        </CardTitle>
        <CardDescription>
          {events.length === 0
            ? "No tienes eventos programados para hoy"
            : `${events.length} evento(s) programado(s)`}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {events.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No hay eventos para hoy</p>
          </div>
        ) : (
          <div className="space-y-3">
            {events.map((event) => (
              <div key={event.id} className="flex flex-col gap-2 p-4 bg-gray-50 rounded-lg sm:flex-row sm:items-center sm:justify-between">
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-gray-900 truncate">{event.title}</h3>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-sm text-gray-600">
                    <span className="flex items-center gap-1 shrink-0">
                      <Clock className="h-3.5 w-3.5" />
                      {event.time}
                    </span>
                    <span className="flex items-center gap-1 min-w-0">
                      <MapPin className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">{event.hotel}</span>
                    </span>
                    {(event.musician ?? event.band) && (
                      <span className="truncate">{event.musician ?? event.band}</span>
                    )}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2 sm:shrink-0">
                  {user?.role === "musician" && event.organizationName && (
                    <Badge variant="outline" className="text-xs">{event.organizationName}</Badge>
                  )}
                  {event.paymentStatus === "paid" ? (
                    <Badge variant="outline" className="text-green-700 border-green-300 bg-green-50 text-xs">
                      Pagado
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-amber-700 border-amber-300 bg-amber-50 text-xs">
                      Pendiente
                    </Badge>
                  )}
                  <Badge variant={event.status === "scheduled" ? "default" : "secondary"}>
                    {event.status === "scheduled" ? "Programado" : "En Progreso"}
                  </Badge>
                  {user?.role === "musician" && event.status === "scheduled" && (
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
  )
}

export function UpcomingEventsCard() {
  const { events, user } = useUnit({ events: eventsModel.$upcomingEvents, user: $user })
  const upcoming = events.slice(0, 3)

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5" />
          Próximos Eventos
        </CardTitle>
        <CardDescription>Eventos programados para los próximos días</CardDescription>
      </CardHeader>
      <CardContent>
        {upcoming.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No hay eventos próximos</p>
          </div>
        ) : (
          <div className="space-y-3">
            {upcoming.map((event) => (
              <div key={event.id} className="flex flex-col gap-2 p-4 bg-gray-50 rounded-lg sm:flex-row sm:items-center sm:justify-between">
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-gray-900 truncate">{event.title}</h3>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-sm text-gray-600">
                    <span className="shrink-0">{new Date(event.date).toLocaleDateString("es-ES")}</span>
                    <span className="flex items-center gap-1 shrink-0">
                      <Clock className="h-3.5 w-3.5" />
                      {event.time}
                    </span>
                    <span className="flex items-center gap-1 min-w-0">
                      <MapPin className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">{event.hotel}</span>
                    </span>
                    {(event.musician ?? event.band) && (
                      <span className="truncate">{event.musician ?? event.band}</span>
                    )}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2 sm:shrink-0">
                  {user?.role === "musician" && event.organizationName && (
                    <Badge variant="outline" className="text-xs">{event.organizationName}</Badge>
                  )}
                  {event.paymentStatus === "paid" ? (
                    <Badge variant="outline" className="text-green-700 border-green-300 bg-green-50 text-xs">
                      Pagado
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-amber-700 border-amber-300 bg-amber-50 text-xs">
                      Pendiente
                    </Badge>
                  )}
                  <Badge variant="outline">
                    {event.status === "scheduled" ? "Programado" : event.status}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
