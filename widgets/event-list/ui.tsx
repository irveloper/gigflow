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
          <div className="space-y-4">
            {events.map((event) => (
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
  const events = useUnit(eventsModel.$upcomingEvents)
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
          <div className="space-y-4">
            {upcoming.map((event) => (
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
  )
}
