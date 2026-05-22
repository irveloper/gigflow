"use client"

import { use, useEffect, useState } from "react"
import Link from "next/link"
import { useUnit } from "effector-react"
import { $user } from "@/entities/user/model"
import { eventsModel } from "@/features/events/model"
import { EventAuditLogFeed } from "@/components/event-audit-log-feed"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { AlertTriangle, ArrowLeft, Calendar, Clock, MapPin, Users, History } from "lucide-react"
import { getEventStatusLabel } from "@/entities/event"
import type { Event } from "@/shared/types"

const STATUS_BADGE: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  "scheduled": "outline",
  "in-progress": "secondary",
  "completed": "default",
  "cancelled": "destructive",
}

export default function EventDetailPage({
  params,
}: {
  params: Promise<{ slug: string; eventId: string }>
}) {
  const { slug, eventId } = use(params)
  const user = useUnit($user)
  const { events } = useUnit({ events: eventsModel.$events })
  const [event, setEvent] = useState<Event | null>(null)

  useEffect(() => {
    eventsModel.loadEvents()
  }, [])

  useEffect(() => {
    const found = events.find((e) => e.id === eventId) ?? null
    setEvent(found)
  }, [events, eventId])

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
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link href={`/org/${slug}/admin/events`}>
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back to Events
          </Link>
        </Button>
      </div>

      {/* Event summary */}
      {event ? (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between gap-4">
              <CardTitle className="text-xl">{event.title}</CardTitle>
              <Badge variant={STATUS_BADGE[event.status] ?? "outline"}>
                {getEventStatusLabel(event)}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3 text-sm text-gray-600">
              <span className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-gray-400" />
                {new Date(event.date).toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
              </span>
              <span className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-gray-400" />
                {event.time} · {event.durationMinutes} min
              </span>
              <span className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-gray-400" />
                {event.hotel}
              </span>
              <span className="flex items-center gap-2">
                <Users className="h-4 w-4 text-gray-400" />
                {event.musician ?? event.band ?? "No performer assigned"}
              </span>
              {event.price != null && (
                <span className="col-span-2 flex items-center gap-2 font-medium text-gray-800">
                  Price: ${event.price.toLocaleString("es-MX")}
                </span>
              )}
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-4">
            <div className="h-24 bg-gray-100 rounded-lg animate-pulse" />
          </CardContent>
        </Card>
      )}

      {/* Audit log */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <History className="h-5 w-5 text-gray-500" />
          <h2 className="text-base font-semibold text-gray-900">Audit Log</h2>
        </div>
        <EventAuditLogFeed eventId={eventId} />
      </div>
    </div>
  )
}
