/**
 * Calendar UX scenarios
 *
 * Source of truth for calendar-specific behavior.
 * Update here FIRST when requirements change.
 */

import { allEvents, eventFixtures } from "@/specs/fixtures"
import { userFixtures } from "@/specs/fixtures"

export const calendarScenarios = {
  visibility: {
    "musician sees only assigned events in calendar": {
      given: {
        events: allEvents,
        user: userFixtures.musician,
      },
      then: [
        "only events with musicianId matching the current musician are shown",
        "events assigned to other musicians are excluded",
      ],
      expectedIds: [
        eventFixtures.todayAcoustic.id,
        eventFixtures.todayJazz.id,
        eventFixtures.tomorrowPiano.id,
      ],
    },

    "manager sees all scheduled events in calendar": {
      given: {
        events: allEvents,
        user: userFixtures.manager,
      },
      then: [
        "all events are visible to managers",
        "no calendar filtering is applied by musician ownership",
      ],
      expectedCount: allEvents.length,
    },
  },

  adapter: {
    "calendar adapter maps event fields to FullCalendar input": {
      given: eventFixtures.todayAcoustic,
      then: [
        "calendar event id matches the domain event id",
        "calendar event start is derived from Event.date + Event.time",
        "calendar event end is derived from durationMinutes",
        "calendar event keeps the original event in extendedProps for click handling",
        "calendar event receives a status-based class name for styling",
      ],
      expectedStart: `${eventFixtures.todayAcoustic.date}T${eventFixtures.todayAcoustic.time}:00`,
      expectedEnd: `${eventFixtures.todayAcoustic.date}T21:00:00`,
      expectedClassName: "event-tone-scheduled",
    },

    "calendar range summary only includes events inside the active view": {
      given: {
        events: allEvents,
        start: eventFixtures.todayAcoustic.date,
        endExclusive: eventFixtures.nextWeekGuitar.date,
      },
      then: [
        "events on or after the visible start date are included",
        "events before the visible start date are excluded",
        "events on or after the exclusive end date are excluded",
      ],
      expectedIds: [
        eventFixtures.todayAcoustic.id,
        eventFixtures.todayJazz.id,
        eventFixtures.tomorrowPiano.id,
        eventFixtures.tomorrowVocal.id,
      ],
    },
  },
} as const
