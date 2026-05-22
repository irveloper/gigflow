/**
 * Event calendar adapter tests — derived from __tests__/scenarios/calendar.scenarios.ts
 *
 * When behavior changes: update scenarios FIRST → update this file → update runtime code.
 */

import { describe, expect, it } from "vitest"
import {
  filterEventsForCalendar,
  getCalendarSummary,
  getEventsInRange,
  toFullCalendarEvents,
} from "@/entities/event"
import { allEvents, eventFixtures } from "@/shared/mocks/events"
import { calendarScenarios } from "@/__tests__/scenarios/calendar.scenarios"
import { userFixtures } from "@/shared/mocks/users"

describe("event calendar adapter", () => {
  describe("visibility", () => {
    it("musician sees only assigned events in calendar", () => {
      const filtered = filterEventsForCalendar(allEvents, userFixtures.musician)

      expect(filtered.map((event) => event.id)).toEqual(
        calendarScenarios.visibility["musician sees only assigned events in calendar"].expectedIds,
      )
    })

    it("manager sees all scheduled events in calendar", () => {
      const filtered = filterEventsForCalendar(allEvents, userFixtures.manager)

      expect(filtered).toHaveLength(
        calendarScenarios.visibility["manager sees all scheduled events in calendar"].expectedCount,
      )
    })
  })

  describe("adapter", () => {
    it("calendar adapter maps event fields to FullCalendar input", () => {
      const [calendarEvent] = toFullCalendarEvents([eventFixtures.todayAcoustic])

      expect(calendarEvent.id).toBe(eventFixtures.todayAcoustic.id)
      expect(calendarEvent.start).toBe(
        calendarScenarios.adapter["calendar adapter maps event fields to FullCalendar input"].expectedStart,
      )
      expect(calendarEvent.end).toBe(
        calendarScenarios.adapter["calendar adapter maps event fields to FullCalendar input"].expectedEnd,
      )
      expect(calendarEvent.classNames).toContain(
        calendarScenarios.adapter["calendar adapter maps event fields to FullCalendar input"].expectedClassName,
      )
      expect(calendarEvent.extendedProps?.originalEvent).toEqual(eventFixtures.todayAcoustic)
    })

    it("calendar range summary only includes events inside the active view", () => {
      const rangeEvents = getEventsInRange(
        allEvents,
        new Date(`${eventFixtures.todayAcoustic.date}T00:00:00`),
        new Date(`${eventFixtures.nextWeekGuitar.date}T00:00:00`),
      )

      expect(rangeEvents.map((event) => event.id)).toEqual(
        calendarScenarios.adapter["calendar range summary only includes events inside the active view"].expectedIds,
      )

      expect(getCalendarSummary(rangeEvents)).toEqual({
        totalEvents: 4,
        completedEvents: 0,
        hotelCount: 3,
        totalSets: 8,
      })
    })
  })
})
