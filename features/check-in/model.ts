import { createStore, createEvent, createEffect, sample } from "effector"
import type { CheckInInput, Event } from "@/shared/types"
import type { CheckInResult } from "@/shared/api/check-in"
// Entity primitives — correct FSD: feature → entity (never feature → feature)
import { $events, updateEventById } from "@/entities/event/model"
import { upsertNotification } from "@/entities/notification/model"
import * as checkInApi from "@/shared/api/check-in"

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------
export const startCheckIn = createEvent<string>()
export const submitCheckIn = createEvent<CheckInInput>()
export const cancelCheckIn = createEvent()

// ---------------------------------------------------------------------------
// Effects
// ---------------------------------------------------------------------------
export const submitCheckInFx = createEffect<CheckInInput, CheckInResult>((data) =>
  checkInApi.submitCheckIn(data),
)

// ---------------------------------------------------------------------------
// Stores
// ---------------------------------------------------------------------------
export const $currentEventId = createStore<string | null>(null)
  .on(startCheckIn, (_, id) => id)
  .on(cancelCheckIn, () => null)

export const $isCheckingIn = createStore(false).on(submitCheckInFx.pending, (_, pending) => pending)

export const $checkInError = createStore<string | null>(null)
  .on(submitCheckInFx.failData, (_, error) => error.message)
  .on(submitCheckIn, () => null)
  .on(cancelCheckIn, () => null)

// ---------------------------------------------------------------------------
// Wire — all coordination via entity primitives, no cross-feature imports
// ---------------------------------------------------------------------------
sample({ clock: submitCheckIn, target: submitCheckInFx })

// Merge check-in data onto the existing event — preserves all original fields
const _checkInMerged = sample({
  source: $events,
  clock: submitCheckInFx.doneData,
  fn: (events, data): Event | null => {
    const existing = events.find((e) => e.id === data.eventId)
    if (!existing) return null
    return {
      ...existing,
      status: "in-progress",
      checkedIn: true,
      checkInTime: data.timestamp,
      checkInPhoto: data.photoUrl,
      checkInLocation: data.location,
      checkInComments: data.comments,
    }
  },
})
sample({ clock: _checkInMerged, filter: (e): e is Event => e != null, target: updateEventById })

// Add success notification via entity primitive
sample({
  clock: submitCheckInFx.done,
  fn: () => ({
    id: Math.random().toString(36).slice(2, 9),
    title: "Check-in exitoso",
    message: "Tu check-in ha sido registrado correctamente",
    type: "success" as const,
    timestamp: new Date().toISOString(),
    read: false,
  }),
  target: upsertNotification,
})

sample({
  clock: submitCheckInFx.done,
  fn: () => null,
  target: $currentEventId,
})
