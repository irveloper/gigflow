/**
 * Events feature tests — derived from specs/features/events.scenarios.ts
 *
 * Each describe/it maps to a scenario in the spec file.
 * When behavior changes: update scenarios FIRST → update this file → update model.
 */

import { describe, it, expect } from "vitest"
import { allSettled, fork } from "effector"
import { allEvents, eventFixtures } from "@/specs/fixtures"
import {
  loadEvents,
  loadEventsFx,
  eventCreated,
  createEventFx,
  updateEvent,
  deleteEvent,
  deleteEventFx,
  cancelEvent,
  completeEvent,
  confirmCheckIn,
  rejectCheckIn,
  $pendingCheckIns,
  $isLoading,
} from "@/features/events/model"
import { $events, $todayEvents, $upcomingEvents } from "@/entities/event/model"

// Use actual current date so derived stores ($todayEvents, $upcomingEvents) compute correctly
const actualToday = new Date().toISOString().split("T")[0]
const actualTomorrow = new Date(Date.now() + 86400000).toISOString().split("T")[0]
const actualYesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0]

const seedEvents = [
  { ...eventFixtures.todayAcoustic, date: actualToday, id: "seed-today-1" },
  { ...eventFixtures.todayJazz, date: actualToday, id: "seed-today-2" },
  { ...eventFixtures.tomorrowPiano, date: actualTomorrow, id: "seed-tomorrow-1" },
  { ...eventFixtures.completedLatinJazz, date: actualYesterday, id: "seed-yesterday-1" },
]

describe("events model", () => {
  describe("loading", () => {
    it("loads all events on demand", async () => {
      const scope = fork({
        handlers: [[loadEventsFx, () => allEvents]],
      })

      await allSettled(loadEvents, { scope })

      const events = scope.getState($events)
      expect(events).toHaveLength(allEvents.length)
      expect(scope.getState($isLoading)).toBe(false)
    })
  })

  describe("derived stores", () => {
    it("$todayEvents contains only today's events", () => {
      const scope = fork({ values: [[$events, seedEvents]] })

      const todayEvents = scope.getState($todayEvents)
      const ids = todayEvents.map((e) => e.id)

      expect(ids).toContain("seed-today-1")
      expect(ids).toContain("seed-today-2")
      expect(ids).not.toContain("seed-tomorrow-1")
      expect(ids).not.toContain("seed-yesterday-1")
    })

    it("$upcomingEvents contains only future events", () => {
      const scope = fork({ values: [[$events, seedEvents]] })

      const upcoming = scope.getState($upcomingEvents)
      const ids = upcoming.map((e) => e.id)

      expect(ids).toContain("seed-tomorrow-1")
      expect(ids).not.toContain("seed-today-1")
      expect(ids).not.toContain("seed-yesterday-1")
    })
  })

  describe("actions", () => {
    it("cancelEvent sets status to cancelled", async () => {
      const scope = fork({ values: [[$events, [eventFixtures.todayAcoustic]]] })

      await allSettled(cancelEvent, { scope, params: eventFixtures.todayAcoustic.id })

      const updated = scope.getState($events).find((e) => e.id === eventFixtures.todayAcoustic.id)
      expect(updated?.status).toBe("cancelled")
      expect(updated?.title).toBe(eventFixtures.todayAcoustic.title)
    })

    it("completeEvent sets status to completed and checkedIn to true", async () => {
      const scope = fork({ values: [[$events, [eventFixtures.todayAcoustic]]] })

      await allSettled(completeEvent, { scope, params: eventFixtures.todayAcoustic.id })

      const updated = scope.getState($events).find((e) => e.id === eventFixtures.todayAcoustic.id)
      expect(updated?.status).toBe("completed")
      expect(updated?.checkedIn).toBe(true)
      expect(updated?.title).toBe(eventFixtures.todayAcoustic.title)
    })

    it("confirmCheckIn sets status to completed", async () => {
      const pending = { ...eventFixtures.todayAcoustic, status: "in-progress" as const, checkedIn: true }
      const scope = fork({ values: [[$events, [pending]]] })

      await allSettled(confirmCheckIn, { scope, params: pending.id })

      const updated = scope.getState($events).find((e) => e.id === pending.id)
      expect(updated?.status).toBe("completed")
      expect(updated?.checkedIn).toBe(true)
    })

    it("rejectCheckIn resets check-in fields", async () => {
      const pending = {
        ...eventFixtures.todayAcoustic,
        status: "in-progress" as const,
        checkedIn: true,
        checkInTime: new Date().toISOString(),
        checkInLocation: "Lobby",
      }
      const scope = fork({ values: [[$events, [pending]]] })

      await allSettled(rejectCheckIn, { scope, params: pending.id })

      const updated = scope.getState($events).find((e) => e.id === pending.id)
      expect(updated?.status).toBe("scheduled")
      expect(updated?.checkedIn).toBe(false)
      expect(updated?.checkInTime).toBeUndefined()
      expect(updated?.checkInLocation).toBeUndefined()
    })

    it("$pendingCheckIns contains only in-progress checked-in events", () => {
      const pendingEvent = { ...eventFixtures.todayAcoustic, status: "in-progress" as const, checkedIn: true }
      const scope = fork({ values: [[$events, [pendingEvent, eventFixtures.todayJazz]]] })

      const pending = scope.getState($pendingCheckIns)
      expect(pending.map((e) => e.id)).toEqual([pendingEvent.id])
    })
  })

  describe("crud", () => {
    it("manager creates a new event", async () => {
      const input = {
        title: "New Show",
        date: "2026-05-01",
        time: "20:00",
        durationMinutes: 60,
        hotel: "Hotel Test",
        status: "scheduled" as const,
      }
      const scope = fork({
        handlers: [
          [createEventFx, () => ({ ...input, id: "mock-id", checkedIn: false as const })],
        ],
      })
      const before = scope.getState($events).length

      await allSettled(eventCreated, { scope, params: input })

      const events = scope.getState($events)
      expect(events.length).toBe(before + 1)

      const created = events[0]
      expect(created.title).toBe("New Show")
      expect(created.status).toBe("scheduled")
      expect(created.checkedIn).toBe(false)
      expect(created.id).toBeTruthy()
    })

    it("manager updates an existing event", async () => {
      const scope = fork({
        values: [[$events, [eventFixtures.tomorrowPiano, eventFixtures.todayAcoustic]]],
      })

      const updated = { ...eventFixtures.tomorrowPiano, title: "Updated Piano" }
      await allSettled(updateEvent, { scope, params: updated })

      const events = scope.getState($events)
      const found = events.find((e) => e.id === eventFixtures.tomorrowPiano.id)
      expect(found?.title).toBe("Updated Piano")

      // other events unchanged
      const other = events.find((e) => e.id === eventFixtures.todayAcoustic.id)
      expect(other?.title).toBe(eventFixtures.todayAcoustic.title)
    })

    it("manager deletes an event", async () => {
      const scope = fork({
        values: [[$events, [eventFixtures.tomorrowPiano, eventFixtures.todayAcoustic]]],
        handlers: [[deleteEventFx, () => undefined]],
      })

      await allSettled(deleteEvent, { scope, params: eventFixtures.tomorrowPiano.id })

      const events = scope.getState($events)
      expect(events.find((e) => e.id === eventFixtures.tomorrowPiano.id)).toBeUndefined()
      expect(events.find((e) => e.id === eventFixtures.todayAcoustic.id)).toBeDefined()
    })
  })
})
