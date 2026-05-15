import { createEvent, createEffect, createStore, sample } from "effector"
import type { CreateEventInput, Event } from "@/shared/types"
import {
  addEvent,
  $events,
  $todayEvents,
  $upcomingEvents,
  setEvents,
  updateEventById,
  removeEventById,
} from "@/entities/event"
import * as eventsApi from "@/shared/api/events"

// ---------------------------------------------------------------------------
// Re-export entity stores (public API for this feature)
// ---------------------------------------------------------------------------
export { $events, $todayEvents, $upcomingEvents }

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------
export const loadEvents = createEvent()
export const eventCreated = createEvent<CreateEventInput>()
export const updateEvent = createEvent<Event>()
export const deleteEvent = createEvent<string>()
export const cancelEvent = createEvent<string>()
export const completeEvent = createEvent<string>()
export const confirmCheckIn = createEvent<string>()
export const rejectCheckIn = createEvent<string>()

// ---------------------------------------------------------------------------
// Effects
// ---------------------------------------------------------------------------
export const loadEventsFx = createEffect<void, Event[]>(() => eventsApi.fetchEvents())

export const $isLoading = createStore(false).on(loadEventsFx.pending, (_, pending) => pending)

// ---------------------------------------------------------------------------
// Wire events → effects → entity stores
// ---------------------------------------------------------------------------
export const createEventFx = createEffect<CreateEventInput, Event>((input) => eventsApi.createEvent(input))
export const deleteEventFx = createEffect<string, void>((id) => eventsApi.deleteEvent(id))

sample({ clock: loadEvents, target: loadEventsFx })
sample({ clock: loadEventsFx.doneData, target: setEvents })
sample({ clock: eventCreated, target: createEventFx })
sample({ clock: createEventFx.doneData, target: addEvent })
sample({ clock: updateEvent, target: updateEventById })
sample({ clock: deleteEvent, target: deleteEventFx })
sample({ clock: deleteEventFx.done, fn: ({ params }) => params, target: removeEventById })

const _cancelMapped = sample({
  source: $events,
  clock: cancelEvent,
  fn: (events, id): Event | null => {
    const e = events.find((ev) => ev.id === id)
    return e ? { ...e, status: "cancelled" } : null
  },
})
sample({ clock: _cancelMapped, filter: (e): e is Event => e != null, target: updateEventById })

const _completeMapped = sample({
  source: $events,
  clock: completeEvent,
  fn: (events, id): Event | null => {
    const e = events.find((ev) => ev.id === id)
    return e ? { ...e, status: "completed", checkedIn: true } : null
  },
})
sample({ clock: _completeMapped, filter: (e): e is Event => e != null, target: updateEventById })

const _confirmMapped = sample({
  source: $events,
  clock: confirmCheckIn,
  fn: (events, id): Event | null => {
    const e = events.find((ev) => ev.id === id)
    return e ? { ...e, status: "completed" } : null
  },
})
sample({ clock: _confirmMapped, filter: (e): e is Event => e != null, target: updateEventById })

const _rejectMapped = sample({
  source: $events,
  clock: rejectCheckIn,
  fn: (events, id): Event | null => {
    const e = events.find((ev) => ev.id === id)
    return e
      ? {
          ...e,
          status: "scheduled",
          checkedIn: false,
          checkInTime: undefined,
          checkInLocation: undefined,
          checkInComments: undefined,
        }
      : null
  },
})
sample({ clock: _rejectMapped, filter: (e): e is Event => e != null, target: updateEventById })

export const $pendingCheckIns = $events.map((events) =>
  events.filter((e) => e.status === "in-progress" && e.checkedIn),
)

// ---------------------------------------------------------------------------
// Consolidated export
// ---------------------------------------------------------------------------
export const eventsModel = {
  $events,
  $todayEvents,
  $upcomingEvents,
  $pendingCheckIns,
  $isLoading,
  loadEvents,
  eventCreated,
  updateEvent,
  deleteEvent,
  cancelEvent,
  completeEvent,
  confirmCheckIn,
  rejectCheckIn,
  loadEventsFx,
  createEventFx,
  deleteEventFx,
}
