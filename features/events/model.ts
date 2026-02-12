import { createStore, createEvent, createEffect, sample } from "effector"

export interface Event {
  id: string
  title: string
  description?: string
  date: string
  time: string
  hotel: string
  musician?: string
  musicianId?: string
  status: "scheduled" | "in-progress" | "completed" | "cancelled"
  checkedIn?: boolean
  checkInTime?: string
  checkInPhoto?: string
}

export interface CheckInData {
  eventId: string
  photo: File
  timestamp: string
}

// Events
export const loadEvents = createEvent()
export const eventCreated = createEvent<Omit<Event, "id">>()
export const updateEvent = createEvent<Event>()
export const deleteEvent = createEvent<string>()
export const checkIn = createEvent<CheckInData>()

// Effects
export const loadEventsFx = createEffect<void, Event[]>(async () => {
  // Simulación de carga de eventos
  await new Promise((resolve) => setTimeout(resolve, 500))

  const today = new Date()
  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000)
  const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
  const nextMonth = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)

  // Helper function to format date as YYYY-MM-DD
  const formatDate = (date: Date) => date.toISOString().split("T")[0]

  return [
    // Today's events
    {
      id: "1",
      title: "Acoustic Set - Lobby",
      description: "Presentación acústica en el lobby principal",
      date: formatDate(today),
      time: "19:00",
      hotel: "Hotel Paradisus Cancún",
      musician: "Carlos Mendoza",
      musicianId: "1",
      status: "scheduled",
      checkedIn: false,
    },
    {
      id: "2",
      title: "Jazz Trio - Restaurante",
      description: "Trio de jazz en el restaurante principal",
      date: formatDate(today),
      time: "21:30",
      hotel: "Hotel Paradisus Cancún",
      musician: "Carlos Mendoza",
      musicianId: "1",
      status: "scheduled",
      checkedIn: false,
    },
    // Tomorrow's events
    {
      id: "3",
      title: "Solo Piano - Bar",
      description: "Piano solo en el bar del hotel",
      date: formatDate(tomorrow),
      time: "20:00",
      hotel: "Hotel Moon Palace",
      musician: "Carlos Mendoza",
      musicianId: "1",
      status: "scheduled",
      checkedIn: false,
    },
    {
      id: "4",
      title: "Vocal Jazz - Terraza",
      description: "Presentación vocal en la terraza",
      date: formatDate(tomorrow),
      time: "18:30",
      hotel: "Hotel Xcaret",
      musician: "Ana Rodríguez",
      musicianId: "2",
      status: "scheduled",
      checkedIn: false,
    },
    // Next week events
    {
      id: "5",
      title: "Guitar Solo - Pool Bar",
      description: "Guitarra solista en el bar de la piscina",
      date: formatDate(nextWeek),
      time: "17:00",
      hotel: "Hotel Iberostar",
      musician: "Miguel Santos",
      musicianId: "3",
      status: "scheduled",
      checkedIn: false,
    },
    {
      id: "6",
      title: "Bossa Nova - Lobby",
      description: "Música bossa nova en el lobby",
      date: formatDate(nextWeek),
      time: "19:30",
      hotel: "Hotel Moon Palace",
      musician: "Ana Rodríguez",
      musicianId: "2",
      status: "scheduled",
      checkedIn: false,
    },
    // Past events (for testing)
    {
      id: "7",
      title: "Latin Jazz - Restaurante",
      description: "Jazz latino en el restaurante",
      date: formatDate(new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)), // 2 days ago
      time: "20:00",
      hotel: "Hotel Paradisus Cancún",
      musician: "Miguel Santos",
      musicianId: "3",
      status: "completed",
      checkedIn: true,
      checkInTime: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: "8",
      title: "Acoustic Duo - Bar",
      description: "Dúo acústico en el bar",
      date: formatDate(new Date(Date.now() - 1 * 24 * 60 * 60 * 1000)), // Yesterday
      time: "21:00",
      hotel: "Hotel Xcaret",
      musician: "Carlos Mendoza",
      musicianId: "1",
      status: "completed",
      checkedIn: true,
      checkInTime: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    },
    // More future events for calendar testing
    {
      id: "9",
      title: "Saxophone Solo - Lobby",
      description: "Saxofón solista en el lobby",
      date: formatDate(new Date(Date.now() + 3 * 24 * 60 * 60 * 1000)), // 3 days from now
      time: "18:00",
      hotel: "Hotel Paradisus Cancún",
      musician: "Ana Rodríguez",
      musicianId: "2",
      status: "scheduled",
      checkedIn: false,
    },
    {
      id: "10",
      title: "Classical Guitar - Terraza",
      description: "Guitarra clásica en la terraza",
      date: formatDate(new Date(Date.now() + 5 * 24 * 60 * 60 * 1000)), // 5 days from now
      time: "19:00",
      hotel: "Hotel Moon Palace",
      musician: "Miguel Santos",
      musicianId: "3",
      status: "scheduled",
      checkedIn: false,
    },
  ]
})

export const checkInFx = createEffect<CheckInData, Event>(async (data) => {
  await new Promise((resolve) => setTimeout(resolve, 1000))

  // Simulación de check-in exitoso
  return {
    id: data.eventId,
    title: "Event Updated",
    date: new Date().toISOString().split("T")[0],
    time: "19:00",
    hotel: "Hotel Test",
    status: "in-progress" as const,
    checkedIn: true,
    checkInTime: data.timestamp,
    checkInPhoto: URL.createObjectURL(data.photo),
  }
})

// Stores
export const $events = createStore<Event[]>([])
export const $isLoading = createStore(false)

export const $todayEvents = $events.map((events) => {
  const today = new Date().toISOString().split("T")[0]
  return events.filter((event) => event.date === today)
})

export const $upcomingEvents = $events.map((events) => {
  const today = new Date().toISOString().split("T")[0]
  return events.filter((event) => event.date > today)
})

// Sample connections
sample({
  clock: loadEvents,
  target: loadEventsFx,
})

sample({
  clock: loadEventsFx.doneData,
  target: $events,
})

sample({
  clock: checkIn,
  target: checkInFx,
})

sample({
  clock: checkInFx.doneData,
  source: $events,
  fn: (events, updatedEvent) =>
    events.map((event) =>
      event.id === updatedEvent.id
        ? { ...event, checkedIn: true, checkInTime: updatedEvent.checkInTime, status: "in-progress" as const }
        : event,
    ),
  target: $events,
})

sample({
  clock: [loadEventsFx.pending, checkInFx.pending],
  target: $isLoading,
})

// Initialize
setTimeout(() => {
  loadEvents()
}, 200)

export const eventsModel = {
  $events,
  $todayEvents,
  $upcomingEvents,
  $isLoading,
  loadEvents,
  eventCreated,
  updateEvent,
  deleteEvent,
  checkIn,
  loadEventsFx,
  checkInFx,
}
