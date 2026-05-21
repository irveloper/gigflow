/**
 * Calendar feature tests — derived from __tests__/scenarios/calendar.scenarios.ts
 *
 * Each describe/it maps to a scenario in the spec file.
 * When behavior changes: update scenarios FIRST → update this file → update lib.
 */

import { describe, it, expect } from "vitest"
import type { allEvents, } from "@/shared/mocks/events"
import { calendarScenarios } from "@/__tests__/scenarios/calendar.scenarios"
import {
  filterEventsForCalendar,
  toFullCalendarEvents,
  getEventsInRange,
} from "@/entities/event"

describe("calendar", () => {
  describe("visibility", () => {
    it("musician sees only assigned events in calendar", () => {
      const scenario = calendarScenarios.visibility["musician sees only assigned events in calendar"]
      const result = filterEventsForCalendar(scenario.given.events as typeof allEvents, scenario.given.user)

      const ids = result.map((e) => e.id)
      expect(ids).toEqual(expect.arrayContaining([...scenario.expectedIds]))
      expect(ids).toHaveLength(scenario.expectedIds.length)
    })

    it("manager sees all scheduled events in calendar", () => {
      const scenario = calendarScenarios.visibility["manager sees all scheduled events in calendar"]
      const result = filterEventsForCalendar(scenario.given.events as typeof allEvents, scenario.given.user)

      expect(result).toHaveLength(scenario.expectedCount)
    })
  })

  describe("adapter", () => {
    it("calendar adapter maps event fields to FullCalendar input", () => {
      const scenario = calendarScenarios.adapter["calendar adapter maps event fields to FullCalendar input"]
      const [mapped] = toFullCalendarEvents([scenario.given])

      expect(mapped.id).toBe(scenario.given.id)
      expect(mapped.start).toBe(scenario.expectedStart)
      expect(mapped.end).toBe(scenario.expectedEnd)
      expect(mapped.classNames).toContain(scenario.expectedClassName)
      expect((mapped.extendedProps as { originalEvent: unknown }).originalEvent).toEqual(scenario.given)
    })

    it("calendar range summary only includes events inside the active view", () => {
      const scenario = calendarScenarios.adapter["calendar range summary only includes events inside the active view"]
      const result = getEventsInRange(
        scenario.given.events as typeof allEvents,
        new Date(scenario.given.start),
        new Date(scenario.given.endExclusive),
      )

      const ids = result.map((e) => e.id)
      expect(ids).toEqual(expect.arrayContaining([...scenario.expectedIds]))
      expect(ids).toHaveLength(scenario.expectedIds.length)
    })
  })
})
