import { createStore, createEvent, createEffect, sample } from "effector"
import { checkIn } from "@/features/events/model"
import { addNotification } from "@/features/notifications/model"

export interface CheckInFormData {
  eventId: string
  photo: File
  notes?: string
}

// Events
export const startCheckIn = createEvent<string>()
export const submitCheckIn = createEvent<CheckInFormData>()
export const cancelCheckIn = createEvent()

// Effects
export const submitCheckInFx = createEffect<CheckInFormData, void>(async (data) => {
  await new Promise((resolve) => setTimeout(resolve, 1500))
  console.log("Check-in successful for event:", data.eventId)
})

// Stores
export const $currentEventId = createStore<string | null>(null)
export const $isCheckingIn = createStore(false)
export const $checkInError = createStore<string | null>(null)

// Handlers
$currentEventId.on(startCheckIn, (_, id) => id).on(cancelCheckIn, () => null)
$isCheckingIn.on(submitCheckInFx.pending, (_, pending) => pending)
$checkInError
  .on(submitCheckInFx.failData, (_, error) => error.message)
  .on(submitCheckIn, () => null)
  .on(cancelCheckIn, () => null)

// Sample connections
sample({ clock: submitCheckIn, target: submitCheckInFx })

sample({
  clock: submitCheckIn,
  fn: (data) => ({
    eventId: data.eventId,
    photo: data.photo,
    timestamp: new Date().toISOString(),
  }),
  target: checkIn,
})

sample({
  clock: submitCheckInFx.done,
  fn: () => ({
    title: "Check-in exitoso",
    message: "Tu check-in ha sido registrado correctamente",
    type: "success" as const,
    read: false,
  }),
  target: addNotification,
})

sample({
  clock: submitCheckInFx.done,
  fn: () => null,
  target: $currentEventId,
})
