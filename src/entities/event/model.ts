import { createStore, createEvent } from "effector"
import type { Event } from "@/shared/types"

// ---------------------------------------------------------------------------
// Primitive events — feature layer wires effects to these
// ---------------------------------------------------------------------------
export const setEvents = createEvent<Event[]>()
export const addEvent = createEvent<Event>()
export const updateEventById = createEvent<Event>()
export const removeEventById = createEvent<string>()

// ---------------------------------------------------------------------------
// Stores
// ---------------------------------------------------------------------------
export const $events = createStore<Event[]>([])
  .on(setEvents, (_, events) => events)
  .on(addEvent, (events, event) => [event, ...events])
  .on(updateEventById, (events, updated) =>
    events.map((e) => (e.id === updated.id ? updated : e)),
  )
  .on(removeEventById, (events, id) => events.filter((e) => e.id !== id))

// ---------------------------------------------------------------------------
// Derived stores
// ---------------------------------------------------------------------------
export const $todayEvents = $events.map((events) => {
  const today = new Date().toISOString().split("T")[0]
  return events.filter((e) => e.date === today)
})

export const $upcomingEvents = $events.map((events) => {
  const today = new Date().toISOString().split("T")[0]
  return events.filter((e) => e.date > today)
})
