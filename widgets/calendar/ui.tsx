"use client"

import "./fullcalendar.css"
import FullCalendar from "@fullcalendar/react"
import dayGridPlugin from "@fullcalendar/daygrid"
import interactionPlugin from "@fullcalendar/interaction"
import timeGridPlugin from "@fullcalendar/timegrid"
import esLocale from "@fullcalendar/core/locales/es"
import type { DatesSetArg, EventClickArg, EventContentArg, EventDropArg } from "@fullcalendar/core"
import { addMonths, format, startOfMonth } from "date-fns"
import { es } from "date-fns/locale"
import { useEffect, useState } from "react"
import { useUnit } from "effector-react"
import Link from "next/link"
import { CalendarDays, Camera, Clock3, MapPin, Sparkles } from "lucide-react"
import {
  filterEventsForCalendar,
  getCalendarEventTone,
  getCalendarSummary,
  getEventStatusLabel,
  getEventTimeLabel,
  getEventsInRange,
  hasSchedulingConflict,
  rescheduleEvent,
  sortEventsChronologically,
  toFullCalendarEvents,
} from "@/entities/event"
import { $user } from "@/entities/user"
import { eventsModel } from "@/features/events"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { sileo } from "sileo"

const TODAY = format(new Date(), "yyyy-MM-dd")

const TONE_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  "checked-in": "default",
  "in-progress": "secondary",
  "cancelled": "destructive",
  "scheduled": "outline",
}
const toneVariant = (event: Parameters<typeof getCalendarEventTone>[0]) =>
  TONE_VARIANT[getCalendarEventTone(event)] ?? "outline"

export function CalendarExperience() {
  const { events, user, isLoading } = useUnit({
    events: eventsModel.$events,
    user: $user,
    isLoading: eventsModel.$isLoading,
  })
  const [selectedEvent, setSelectedEvent] = useState<null | (typeof events)[number]>(null)
  const [visibleRange, setVisibleRange] = useState(() => {
    const now = new Date()

    return {
      start: startOfMonth(now),
      end: startOfMonth(addMonths(now, 1)),
    }
  })

  useEffect(() => {
    if (events.length === 0) {
      eventsModel.loadEvents()
    }
  }, [events.length])

  const visibleEvents = filterEventsForCalendar(events, user)
  const calendarEvents = toFullCalendarEvents(visibleEvents)
  const todayEvents = sortEventsChronologically(visibleEvents.filter((event) => event.date === TODAY))
  const upcomingEvents = sortEventsChronologically(visibleEvents.filter((event) => event.date > TODAY)).slice(0, 5)
  const activeRangeEvents = sortEventsChronologically(getEventsInRange(visibleEvents, visibleRange.start, visibleRange.end))
  const activeSummary = getCalendarSummary(activeRangeEvents)
  const featuredEvent =
    visibleEvents.find((event) => event.id === selectedEvent?.id) ?? todayEvents[0] ?? upcomingEvents[0] ?? activeRangeEvents[0] ?? null

  const handleDatesSet = (info: DatesSetArg) => {
    setVisibleRange((currentRange) => {
      if (
        currentRange.start.getTime() === info.start.getTime() &&
        currentRange.end.getTime() === info.end.getTime()
      ) {
        return currentRange
      }

      return {
        start: info.start,
        end: info.end,
      }
    })
  }

  const handleEventClick = (info: EventClickArg) => {
    setSelectedEvent(info.event.extendedProps.originalEvent ?? null)
  }

  const handleEventDrop = (info: EventDropArg) => {
    const originalEvent = info.event.extendedProps.originalEvent

    if (!originalEvent || !info.event.start) {
      info.revert()
      return
    }

    if (originalEvent.status === "completed" || originalEvent.status === "cancelled") {
      info.revert()
      sileo.error({ title: "Movimiento no permitido", description: "Solo los eventos activos pueden reprogramarse desde el calendario." })
      return
    }

    const movedEvent = rescheduleEvent(originalEvent, info.event.start)

    if (hasSchedulingConflict(movedEvent, events, originalEvent.id)) {
      info.revert()
      sileo.error({ title: "Conflicto de horario", description: "Ese músico ya tiene otro evento en ese horario. El movimiento fue revertido." })
      return
    }

    eventsModel.updateEvent(movedEvent)
    setSelectedEvent((currentEvent) => (currentEvent?.id === movedEvent.id ? movedEvent : currentEvent))
    sileo.success({ title: "Evento reprogramado", description: `${movedEvent.title} ahora inicia a las ${movedEvent.time}.` })
  }

  const renderEventContent = (content: EventContentArg) => {
    const originalEvent = content.event.extendedProps.originalEvent

    return (
      <div className="calendar-event-chip">
        <span className="calendar-event-time">{content.timeText || originalEvent?.time}</span>
        <span className="calendar-event-title">{content.event.title}</span>
        {content.view.type === "timeGridWeek" && originalEvent?.hotel ? (
          <span className="calendar-event-meta">{originalEvent.hotel}</span>
        ) : null}
      </div>
    )
  }

  return (
    <>
      <div className="space-y-6 p-4 md:p-6">
        <section className="flex flex-col gap-3 rounded-[1.75rem] border border-border/70 bg-card px-5 py-5 shadow-sm md:px-7">
          <div className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-2">
              <div>
                <h1 className="text-3xl font-semibold tracking-tight text-balance">
                  {user?.role === "musician" ? "Mi agenda operativa" : "Calendario operativo de eventos"}
                </h1>
                <p className="mt-2 max-w-3xl text-sm text-muted-foreground md:text-base">
                  Navega entre vista mensual y semanal, abre detalles al hacer clic y mantén el calendario desacoplado
                  del resto de la ruta.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-2xl border border-border/70 bg-background px-4 py-3">
                <p className="text-xs font-semibold tracking-[0.16em] uppercase text-muted-foreground">En vista</p>
                <p className="mt-2 text-2xl font-semibold">{activeSummary.totalEvents}</p>
              </div>
              <div className="rounded-2xl border border-border/70 bg-background px-4 py-3">
                <p className="text-xs font-semibold tracking-[0.16em] uppercase text-muted-foreground">Check-ins</p>
                <p className="mt-2 text-2xl font-semibold">{activeSummary.completedEvents}</p>
              </div>
              <div className="rounded-2xl border border-border/70 bg-background px-4 py-3">
                <p className="text-xs font-semibold tracking-[0.16em] uppercase text-muted-foreground">Hoteles</p>
                <p className="mt-2 text-2xl font-semibold">{activeSummary.hotelCount}</p>
              </div>
              <div className="rounded-2xl border border-border/70 bg-background px-4 py-3">
                <p className="text-xs font-semibold tracking-[0.16em] uppercase text-muted-foreground">Horas est.</p>
                <p className="mt-2 text-2xl font-semibold">{activeSummary.estimatedHours}h</p>
              </div>
            </div>
          </div>
        </section>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.7fr)_minmax(19rem,0.85fr)]">
          <Card className="overflow-hidden border-border/70 shadow-sm">
            <CardHeader className="border-b border-border/70 bg-muted/30">
              <CardTitle className="flex items-center gap-2 text-xl">
                <CalendarDays className="h-5 w-5 text-primary" />
                Vista principal
              </CardTitle>
              <CardDescription>
                Vista mensual, semanal o diaria. Clic en evento para detalles; arrastra para reprogramar (gerentes); "+N" abre la vista del día.
              </CardDescription>
            </CardHeader>

            <CardContent className="p-3 md:p-5">
              {isLoading && visibleEvents.length === 0 ? (
                <div className="flex min-h-[32rem] items-center justify-center rounded-[1.5rem] border border-dashed border-border bg-muted/20">
                  <div className="space-y-3 text-center">
                    <div className="mx-auto h-11 w-11 animate-spin rounded-full border-2 border-primary/30 border-t-primary" />
                    <p className="text-sm text-muted-foreground">Cargando calendario...</p>
                  </div>
                </div>
              ) : (
                <div className="calendar-shell">
                  <FullCalendar
                    plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
                    initialView={user?.role === "musician" ? "timeGridWeek" : "dayGridMonth"}
                    locales={[esLocale]}
                    locale="es"
                    firstDay={1}
                    height="auto"
                    editable={user?.role === "manager"}
                    eventStartEditable={user?.role === "manager"}
                    eventDurationEditable={false}
                    dayMaxEventRows={4}
                    moreLinkClick="day"
                    nowIndicator
                    headerToolbar={{
                      left: "prev,next today",
                      center: "title",
                      right: "dayGridMonth,timeGridWeek,timeGridDay",
                    }}
                    buttonText={{
                      today: "Hoy",
                      month: "Mes",
                      week: "Semana",
                      day: "Día",
                    }}
                    allDaySlot={false}
                    slotMinTime="08:00:00"
                    slotMaxTime="24:00:00"
                    scrollTime="17:00:00"
                    slotLabelInterval="01:00"
                    slotDuration="00:30:00"
                    eventMaxStack={3}
                    eventTimeFormat={{
                      hour: "2-digit",
                      minute: "2-digit",
                      hour12: false,
                    }}
                    events={calendarEvents}
                    datesSet={handleDatesSet}
                    eventClick={handleEventClick}
                    eventDrop={handleEventDrop}
                    eventContent={renderEventContent}
                    noEventsText="No hay eventos en este rango"
                  />
                </div>
              )}
            </CardContent>
          </Card>

          <div className="space-y-6">
            <Card className="border-border/70 shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Sparkles className="h-4 w-4 text-primary" />
                  Evento destacado
                </CardTitle>
                <CardDescription>
                  {featuredEvent
                    ? "Haz clic sobre un evento del calendario para inspeccionar su detalle completo."
                    : "Cuando haya eventos visibles, aquí aparecerá el siguiente foco operativo."}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {featuredEvent ? (
                  <div className="space-y-4 rounded-[1.5rem] border border-border/70 bg-muted/20 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h2 className="text-lg font-semibold">{featuredEvent.title}</h2>
                        <p className="text-sm text-muted-foreground">{featuredEvent.description ?? "Sin descripción adicional."}</p>
                      </div>
                      <Badge variant={toneVariant(featuredEvent)}>
                        {getEventStatusLabel(featuredEvent)}
                      </Badge>
                    </div>

                    <div className="space-y-2 text-sm text-muted-foreground">
                      <div className="flex items-center gap-2">
                        <Clock3 className="h-4 w-4 text-primary" />
                        <span>
                          {format(new Date(`${featuredEvent.date}T${featuredEvent.time}:00`), "EEEE d 'de' MMMM, HH:mm", {
                            locale: es,
                          })}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-primary" />
                        <span>{featuredEvent.hotel}</span>
                      </div>
                      {featuredEvent.musician ? (
                        <div className="flex items-center gap-2">
                          <CalendarDays className="h-4 w-4 text-primary" />
                          <span>{featuredEvent.musician}</span>
                        </div>
                      ) : null}
                    </div>

                    {user?.role === "musician" && featuredEvent.status === "scheduled" ? (
                      <Button asChild className="w-full rounded-full">
                        <Link href={`/check-in/${featuredEvent.id}`}>
                          <Camera className="mr-2 h-4 w-4" />
                          Ir a check-in
                        </Link>
                      </Button>
                    ) : null}
                  </div>
                ) : (
                  <div className="rounded-[1.5rem] border border-dashed border-border bg-muted/20 p-6 text-center text-sm text-muted-foreground">
                    No hay eventos visibles para este usuario.
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="border-border/70 shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg">Eventos de hoy</CardTitle>
                <CardDescription>{format(new Date(), "EEEE d 'de' MMMM", { locale: es })}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {todayEvents.length > 0 ? (
                  todayEvents.map((event) => (
                    <button
                      type="button"
                      key={event.id}
                      className="w-full rounded-2xl border border-border/70 bg-background p-4 text-left transition-colors hover:bg-muted/30 focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none aria-selected:border-primary aria-selected:bg-muted/30"
                      aria-selected={selectedEvent?.id === event.id}
                      onClick={() => setSelectedEvent(event)}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold">{event.title}</p>
                          <p className="mt-1 text-sm text-muted-foreground">
                            {getEventTimeLabel(event)} · {event.hotel}
                          </p>
                        </div>
                        <Badge variant={toneVariant(event)}>{getEventStatusLabel(event)}</Badge>
                      </div>
                    </button>
                  ))
                ) : (
                  <div className="rounded-2xl border border-dashed border-border bg-muted/20 p-4 text-sm text-muted-foreground">
                    No hay eventos programados para hoy.
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="border-border/70 shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg">Próximos eventos</CardTitle>
                <CardDescription>Los siguientes cinco compromisos visibles para este usuario.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {upcomingEvents.length > 0 ? (
                  upcomingEvents.map((event) => (
                    <button
                      type="button"
                      key={event.id}
                      className="w-full rounded-2xl border border-border/70 bg-background p-4 text-left transition-colors hover:bg-muted/30 focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none aria-selected:border-primary aria-selected:bg-muted/30"
                      aria-selected={selectedEvent?.id === event.id}
                      onClick={() => setSelectedEvent(event)}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold">{event.title}</p>
                          <p className="mt-1 text-sm text-muted-foreground">
                            {format(new Date(`${event.date}T${event.time}:00`), "d MMM", { locale: es })} · {getEventTimeLabel(event)} · {event.hotel}
                          </p>
                        </div>
                        <Badge variant={toneVariant(event)}>{getEventStatusLabel(event)}</Badge>
                      </div>
                    </button>
                  ))
                ) : (
                  <div className="rounded-2xl border border-dashed border-border bg-muted/20 p-4 text-sm text-muted-foreground">
                    No hay eventos próximos.
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      <Dialog open={selectedEvent !== null} onOpenChange={(open) => !open && setSelectedEvent(null)}>
        <DialogContent>
          {selectedEvent ? (
            <>
              <DialogHeader>
                <DialogTitle>{selectedEvent.title}</DialogTitle>
                <DialogDescription>{selectedEvent.description ?? "Sin descripción adicional."}</DialogDescription>
              </DialogHeader>

              <div className="space-y-3 rounded-2xl border border-border/70 bg-muted/20 p-4 text-sm text-muted-foreground">
                <div className="flex items-center justify-between gap-3">
                  <span>Estado</span>
                  <Badge variant={toneVariant(selectedEvent)}>
                    {getEventStatusLabel(selectedEvent)}
                  </Badge>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span>Fecha</span>
                  <span className="font-medium text-foreground">
                    {format(new Date(`${selectedEvent.date}T${selectedEvent.time}:00`), "EEEE d 'de' MMMM, HH:mm", {
                      locale: es,
                    })}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span>Hotel</span>
                  <span className="font-medium text-foreground">{selectedEvent.hotel}</span>
                </div>
                {selectedEvent.musician ? (
                  <div className="flex items-center justify-between gap-3">
                    <span>Músico</span>
                    <span className="font-medium text-foreground">{selectedEvent.musician}</span>
                  </div>
                ) : null}
              </div>

              <DialogFooter>
                {user?.role === "musician" && selectedEvent.status === "scheduled" ? (
                  <Button asChild className="rounded-full">
                    <Link href={`/check-in/${selectedEvent.id}`}>
                      <Camera className="mr-2 h-4 w-4" />
                      Hacer check-in
                    </Link>
                  </Button>
                ) : null}
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  )
}
