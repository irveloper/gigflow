// Re-export everything from the features/events/model to consolidate
// This entity layer re-exports the canonical event model from the features layer
export {
  $events,
  $isLoading,
  $todayEvents,
  $upcomingEvents,
  loadEvents,
  eventCreated,
  updateEvent,
  deleteEvent,
  checkIn as checkInEvent,
  checkInFx,
  loadEventsFx,
  eventsModel,
} from "@/features/events/model"

export type { Event, CheckInData } from "@/features/events/model"
