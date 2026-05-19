/**
 * Events feature tests — derived from specs/features/events.scenarios.ts
 *
 * Each describe/it maps to a scenario in the spec file.
 * When behavior changes: update scenarios FIRST → update this file → update model.
 */

import { describe, it, expect, beforeEach } from "vitest"
import { filterEventsForCalendar } from "@/entities/event"
import { userFixtures } from "@/specs/fixtures"
import type { Event } from "@/shared/types"
import { allSettled, fork } from "effector"
import { allEvents, eventFixtures, bandFixtures } from "@/specs/fixtures"
import { getSchedulingConflicts } from "@/entities/event"
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
        handlers: [[loadEventsFx, () => ({ items: allEvents, nextCursor: null, total: allEvents.length })]],
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

  describe("band scheduling", () => {
    const BASE_DATE = "2026-04-21"
    const bandMemberIds = {
      "band-1": bandFixtures.jazzTrio.members ?? [],
      "band-2": bandFixtures.flamencoGroup.members ?? [],
    }

    const makeEvent = (overrides: Partial<(typeof eventFixtures.todayAcoustic)>) => ({
      ...eventFixtures.todayAcoustic,
      date: BASE_DATE,
      ...overrides,
    })

    it("solo musician booked in band at same time causes conflict", () => {
      const candidate = makeEvent({
        id: "candidate-solo",
        musicianId: "user-1", // carlos — member of jazzTrio
        bandId: undefined,
        time: "20:00",
        durationMinutes: 60,
      })
      const existing = makeEvent({
        id: "existing-band-event",
        musicianId: undefined,
        bandId: "band-1", // jazzTrio — has carlos
        time: "20:30",
        durationMinutes: 60,
      })

      const conflicts = getSchedulingConflicts({ candidate, events: [existing], bandMemberIds })
      expect(conflicts.map((e) => e.id)).toContain("existing-band-event")
    })

    it("band member already booked solo causes conflict", () => {
      const candidate = makeEvent({
        id: "candidate-band",
        musicianId: undefined,
        bandId: "band-1", // jazzTrio — has carlos
        time: "20:00",
        durationMinutes: 60,
      })
      const existing = makeEvent({
        id: "existing-solo",
        musicianId: "user-1", // carlos — member of jazzTrio
        bandId: undefined,
        time: "20:30",
        durationMinutes: 60,
      })

      const conflicts = getSchedulingConflicts({ candidate, events: [existing], bandMemberIds })
      expect(conflicts.map((e) => e.id)).toContain("existing-solo")
    })

    it("two bands sharing a member at same time causes conflict", () => {
      const candidate = makeEvent({
        id: "candidate-band-2",
        musicianId: undefined,
        bandId: "band-2", // flamencoGroup — has carlos
        time: "20:00",
        durationMinutes: 60,
      })
      const existing = makeEvent({
        id: "existing-band-1",
        musicianId: undefined,
        bandId: "band-1", // jazzTrio — also has carlos
        time: "20:00",
        durationMinutes: 60,
      })

      const conflicts = getSchedulingConflicts({ candidate, events: [existing], bandMemberIds })
      expect(conflicts.map((e) => e.id)).toContain("existing-band-1")
    })

    it("non-overlapping solo + band slots cause no conflict", () => {
      const candidate = makeEvent({
        id: "candidate-solo-late",
        musicianId: "user-1", // carlos
        bandId: undefined,
        time: "22:00",
        durationMinutes: 60,
      })
      const existing = makeEvent({
        id: "existing-band-early",
        musicianId: undefined,
        bandId: "band-1", // jazzTrio — has carlos, ends 21:00
        time: "20:00",
        durationMinutes: 60,
      })

      const conflicts = getSchedulingConflicts({ candidate, events: [existing], bandMemberIds })
      expect(conflicts).toHaveLength(0)
    })

    it("manager creates an event with bandId", async () => {
      const input = {
        title: "Jazz Night Pool",
        date: BASE_DATE,
        time: "20:00",
        durationMinutes: 90,
        hotel: "Hotel Sunset",
        status: "scheduled" as const,
        bandId: bandFixtures.jazzTrio.id,
        band: bandFixtures.jazzTrio.name,
      }
      const scope = fork({
        handlers: [
          [createEventFx, () => ({ ...input, id: "mock-band-event-id", checkedIn: false as const })],
        ],
      })
      const before = scope.getState($events).length

      await allSettled(eventCreated, { scope, params: input })

      const events = scope.getState($events)
      expect(events.length).toBe(before + 1)
      const created = events[0]
      expect(created.bandId).toBe(bandFixtures.jazzTrio.id)
      expect(created.band).toBe(bandFixtures.jazzTrio.name)
      expect(created.musicianId).toBeUndefined()
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

describe("filterEventsForCalendar", () => {
  const musicianEvent: Event = {
    ...eventFixtures.todayAcoustic,
    id: "ev-musician-match",
    musicianId: "user-1",
  }
  const otherEvent: Event = {
    ...eventFixtures.tomorrowPiano,
    id: "ev-other-musician",
    musicianId: "user-99",
  }
  const events = [musicianEvent, otherEvent]

  it("musician sees only their own events", () => {
    const result = filterEventsForCalendar(events, userFixtures.musician)
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe("ev-musician-match")
  })

  it("musician with no matching events sees empty list", () => {
    const result = filterEventsForCalendar([otherEvent], userFixtures.musician)
    expect(result).toHaveLength(0)
  })

  it("manager sees all events", () => {
    const result = filterEventsForCalendar(events, userFixtures.manager)
    expect(result).toHaveLength(2)
  })

  it("null user sees all events", () => {
    const result = filterEventsForCalendar(events, null)
    expect(result).toHaveLength(2)
  })
})
