import type { EventInput } from "@fullcalendar/core"
import { addMinutes, format } from "date-fns"
import type { Event, User } from "@/shared/types"

export const filterEventsForCalendar = (events: Event[], user: User | null) =>
  user?.role === "musician" ? events.filter((event) => event.musicianId === user.musicianId) : events

export const getEventStartDate = (event: Pick<Event, "date" | "time">) => new Date(`${event.date}T${event.time}:00`)

export const getEventEndDate = (event: Pick<Event, "date" | "time" | "durationMinutes">) =>
  addMinutes(getEventStartDate(event), event.durationMinutes)

export const getEventTimeLabel = (event: Pick<Event, "date" | "time" | "durationMinutes">) => {
  const start = getEventStartDate(event)
  const end = getEventEndDate(event)

  return `${format(start, "HH:mm")} - ${format(end, "HH:mm")}`
}

export const getCalendarEventTone = (event: Event) => {
  if (event.status === "completed") {
    return "checked-in"
  }

  if (event.status === "cancelled") {
    return "cancelled"
  }

  // in-progress + checkedIn = pending manager confirmation → warning tone
  // in-progress without checkedIn = musician is actively performing
  if (event.status === "in-progress") {
    return "in-progress"
  }

  return "scheduled"
}

export const getEventStatusLabel = (event: Event) => {
  if (event.status === "completed") {
    return "Completado"
  }

  if (event.status === "cancelled") {
    return "Cancelado"
  }

  if (event.status === "in-progress" && event.checkedIn) {
    return "Pendiente de confirmación"
  }

  if (event.status === "in-progress") {
    return "En curso"
  }

  return "Programado"
}

export const toFullCalendarEvents = (events: Event[]): EventInput[] =>
  events.map((event) => ({
    id: event.id,
    title: event.title,
    start: format(getEventStartDate(event), "yyyy-MM-dd'T'HH:mm:ss"),
    end: format(getEventEndDate(event), "yyyy-MM-dd'T'HH:mm:ss"),
    allDay: false,
    classNames: [`event-tone-${getCalendarEventTone(event)}`],
    extendedProps: {
      originalEvent: event,
    },
  }))

export const eventsOverlap = (
  left: Pick<Event, "date" | "time" | "durationMinutes">,
  right: Pick<Event, "date" | "time" | "durationMinutes">,
) => getEventStartDate(left) < getEventEndDate(right) && getEventEndDate(left) > getEventStartDate(right)

export const getSchedulingConflicts = ({
  candidate,
  events,
  ignoreEventId,
  bandMemberIds = {},
}: {
  candidate: Event
  events: Event[]
  ignoreEventId?: string
  /** Map of bandId → musicianId[] for client-side pre-validation */
  bandMemberIds?: Record<string, string[]>
}) =>
  events.filter((event) => {
    if (event.id === ignoreEventId || event.id === candidate.id) return false
    if (event.status === "cancelled") return false
    if (!eventsOverlap(candidate, event)) return false

    const candidateMusicianId = candidate.musicianId
    const candidateBandMembers = candidate.bandId ? (bandMemberIds[candidate.bandId] ?? []) : []
    const eventMusicianId = event.musicianId
    const eventBandMembers = event.bandId ? (bandMemberIds[event.bandId] ?? []) : []

    // solo vs solo
    if (candidateMusicianId && eventMusicianId && candidateMusicianId === eventMusicianId) return true
    // solo vs band
    if (candidateMusicianId && eventBandMembers.includes(candidateMusicianId)) return true
    // band vs solo
    if (eventMusicianId && candidateBandMembers.includes(eventMusicianId)) return true
    // band vs band (any shared member)
    if (candidateBandMembers.some((id) => eventBandMembers.includes(id))) return true

    return false
  })

export const hasSchedulingConflict = (
  candidate: Event,
  events: Event[],
  ignoreEventId?: string,
  bandMemberIds?: Record<string, string[]>,
) => getSchedulingConflicts({ candidate, events, ignoreEventId, bandMemberIds }).length > 0

export const rescheduleEvent = (event: Event, start: Date): Event => ({
  ...event,
  date: format(start, "yyyy-MM-dd"),
  time: format(start, "HH:mm"),
})

export const getEventsInRange = (events: Event[], start: Date, endExclusive: Date) => {
  const startKey = format(start, "yyyy-MM-dd")
  const endKey = format(endExclusive, "yyyy-MM-dd")

  return events.filter((event) => event.date >= startKey && event.date < endKey)
}

export const sortEventsChronologically = (events: Event[]) =>
  [...events].sort((left, right) => `${left.date}T${left.time}`.localeCompare(`${right.date}T${right.time}`))

export const getCalendarSummary = (events: Event[]) => ({
  totalEvents: events.length,
  completedEvents: events.filter((event) => event.checkedIn || event.status === "completed").length,
  hotelCount: new Set(events.map((event) => event.hotel)).size,
  estimatedHours: events.reduce((total, event) => total + event.durationMinutes, 0) / 60,
})
