/**
 * Event scheduling tests — derived from __tests__/scenarios/events.scenarios.ts
 *
 * When behavior changes: update scenarios FIRST → update this file → update runtime code.
 */

import { describe, expect, it } from "vitest"
import {
  getEventTimeLabel,
  getSchedulingConflicts,
  hasSchedulingConflict,
  rescheduleEvent,
} from "@/entities/event"
import { eventFixtures } from "@/shared/mocks/events"
import { eventsScenarios } from "@/__tests__/scenarios/events.scenarios"

describe("event scheduling helpers", () => {
  it("calendar adapter preserves event duration in the rendered range", () => {
    expect(getEventTimeLabel(eventFixtures.todayAcoustic)).toBe("19:00 - 21:00")
  })

  it("manager cannot schedule overlapping events for the same musician", () => {
    const conflicts = getSchedulingConflicts({
      candidate: {
        ...eventFixtures.todayAcoustic,
        id: "candidate-overlap",
        time: "20:00",
      },
      events: [eventFixtures.todayJazz],
    })

    expect(conflicts.map((event) => event.id)).toEqual(
      eventsScenarios.scheduling["manager cannot schedule overlapping events for the same musician"].expectedConflictIds,
    )
    expect(
      hasSchedulingConflict(
        {
          ...eventFixtures.todayAcoustic,
          id: "candidate-overlap",
          time: "20:00",
        },
        [eventFixtures.todayJazz],
      ),
    ).toBe(true)
  })

  it("rescheduleEvent preserves duration while moving the start slot", () => {
    const moved = rescheduleEvent(eventFixtures.todayAcoustic, new Date("2026-04-23T18:15:00"))

    expect(moved.date).toBe("2026-04-23")
    expect(moved.time).toBe("18:15")
    expect(moved.sets).toBe(eventFixtures.todayAcoustic.sets)
    expect(getEventTimeLabel(moved)).toBe("18:15 - 20:15")
  })
})
