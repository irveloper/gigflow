/**
 * Events Feature Scenarios
 *
 * Source of truth for event management behavior.
 * Update here FIRST when requirements change.
 */

import { eventFixtures, allEvents, bandFixtures } from "@/specs/fixtures"
import { userFixtures } from "@/specs/fixtures"

const TODAY = "2026-04-21"

export const eventsScenarios = {
  loading: {
    "loads all events on demand": {
      given: "empty $events store",
      when: "loadEvents is triggered",
      then: [
        "loadEventsFx is called",
        "$isLoading is true during fetch",
        "$events is populated with returned events",
        "$isLoading is false after fetch",
      ],
      expectedCount: allEvents.length,
    },
  },

  derived: {
    "$todayEvents contains only today's events": {
      given: { events: allEvents, today: TODAY },
      then: [
        "only events with date === today are included",
        "events from yesterday are excluded",
        "events from tomorrow are excluded",
      ],
      expectedIds: [eventFixtures.todayAcoustic.id, eventFixtures.todayJazz.id],
    },

    "$upcomingEvents contains only future events": {
      given: { events: allEvents, today: TODAY },
      then: ["only events with date > today are included", "today's events are excluded", "past events are excluded"],
    },
  },

  checkIn: {
    "musician checks in to scheduled event": {
      given: {
        event: eventFixtures.todayAcoustic,
        user: userFixtures.musician,
        photo: "File object",
      },
      when: "checkIn event is triggered with eventId + photo + timestamp",
      then: [
        "checkInFx is called",
        "$isLoading is true during check-in",
        "event in $events is updated: checkedIn=true, status='in-progress', checkInTime set",
        "$isLoading is false after check-in",
      ],
    },
  },

  crud: {
    "manager creates a new event": {
      given: { user: userFixtures.manager, input: "CreateEventInput" },
      when: "eventCreated is triggered",
      then: [
        "new event appears in $events with generated id",
        "event status is 'scheduled'",
        "checkedIn is false",
        "durationMinutes is preserved for scheduling views",
      ],
    },

    "manager updates an existing event": {
      given: { event: eventFixtures.tomorrowPiano },
      when: "updateEvent is triggered with modified event",
      then: ["$events contains the updated event", "other events are unchanged"],
    },

    "manager deletes an event": {
      given: { eventId: eventFixtures.tomorrowPiano.id },
      when: "deleteEvent is triggered with eventId",
      then: ["event is removed from $events", "other events are unchanged"],
    },
  },

  actions: {
    "cancelEvent sets status to cancelled": {
      given: { event: eventFixtures.todayAcoustic },
      when: "cancelEvent is triggered with eventId",
      then: ["event status becomes 'cancelled'", "all other fields are preserved"],
    },

    "completeEvent sets status to completed and checkedIn to true": {
      given: { event: eventFixtures.todayAcoustic },
      when: "completeEvent is triggered with eventId",
      then: ["event status becomes 'completed'", "checkedIn is true", "all other fields are preserved"],
    },

    "confirmCheckIn sets status to completed": {
      given: { event: { ...eventFixtures.todayAcoustic, status: "in-progress", checkedIn: true } },
      when: "confirmCheckIn is triggered with eventId",
      then: ["event status becomes 'completed'", "checkedIn remains true"],
    },

    "rejectCheckIn resets check-in fields": {
      given: { event: { ...eventFixtures.todayAcoustic, status: "in-progress", checkedIn: true } },
      when: "rejectCheckIn is triggered with eventId",
      then: [
        "event status reverts to 'scheduled'",
        "checkedIn becomes false",
        "checkInTime, checkInLocation, checkInComments are cleared",
      ],
    },

    "$pendingCheckIns contains in-progress checked-in events": {
      given: {
        events: [
          { ...eventFixtures.todayAcoustic, status: "in-progress", checkedIn: true },
          eventFixtures.todayJazz,
        ],
      },
      then: ["only events with status='in-progress' and checkedIn=true are included"],
    },
  },

  scheduling: {
    "calendar adapter preserves event duration in the rendered range": {
      given: { event: eventFixtures.todayAcoustic },
      when: "event is converted for calendar rendering",
      then: [
        "calendar start uses Event.date + Event.time",
        "calendar end is derived from durationMinutes",
        "the original event remains available for click handling",
      ],
      expectedEnd: `${eventFixtures.todayAcoustic.date}T21:00:00`,
    },

    "manager cannot schedule overlapping events for the same musician": {
      given: {
        candidate: {
          ...eventFixtures.todayAcoustic,
          id: "candidate-overlap",
          time: "20:00",
        },
        existing: [eventFixtures.todayJazz],
      },
      when: "schedule conflict validation runs",
      then: [
        "overlap is detected when the same musician already has a colliding event",
        "the conflicting event ids are returned for UI feedback",
      ],
      expectedConflictIds: [eventFixtures.todayJazz.id],
    },
  },

  bands: {
    "manager books a band for an event": {
      given: { user: userFixtures.manager, band: bandFixtures.jazzTrio },
      when: "eventCreated is triggered with bandId set and no musicianId",
      then: [
        "event is created with bandId = jazzTrio.id",
        "event.band is the band display name",
        "event.musicianId is null",
      ],
    },

    "conflict: solo musician already booked in band at same time": {
      given: {
        candidate: {
          ...eventFixtures.todayAcoustic,
          id: "candidate-solo",
          musicianId: "user-1", // carlos — member of jazzTrio
          bandId: undefined,
          time: "20:00",
          durationMinutes: 60,
        },
        existing: [
          {
            ...eventFixtures.todayAcoustic,
            id: "existing-band-event",
            musicianId: undefined,
            bandId: "band-1", // jazzTrio — has carlos as member
            time: "20:30",
            durationMinutes: 60,
          },
        ],
        bandMemberIds: { "band-1": ["user-1", "user-4"] },
      },
      when: "schedule conflict validation runs",
      then: ["conflict is detected: carlos is in jazzTrio booked at overlapping time"],
      expectedConflictIds: ["existing-band-event"],
    },

    "conflict: band member already booked solo at same time": {
      given: {
        candidate: {
          ...eventFixtures.todayAcoustic,
          id: "candidate-band",
          musicianId: undefined,
          bandId: "band-1", // jazzTrio — has carlos (user-1)
          time: "20:00",
          durationMinutes: 60,
        },
        existing: [
          {
            ...eventFixtures.todayAcoustic,
            id: "existing-solo",
            musicianId: "user-1", // carlos — member of jazzTrio
            bandId: undefined,
            time: "20:30",
            durationMinutes: 60,
          },
        ],
        bandMemberIds: { "band-1": ["user-1", "user-4"] },
      },
      when: "schedule conflict validation runs",
      then: ["conflict is detected: carlos (band member) is already booked solo at overlapping time"],
      expectedConflictIds: ["existing-solo"],
    },

    "conflict: shared band member in two band events at same time": {
      given: {
        candidate: {
          ...eventFixtures.todayAcoustic,
          id: "candidate-band-2",
          musicianId: undefined,
          bandId: "band-2", // flamencoGroup — has carlos (user-1)
          time: "20:00",
          durationMinutes: 60,
        },
        existing: [
          {
            ...eventFixtures.todayAcoustic,
            id: "existing-band-1",
            musicianId: undefined,
            bandId: "band-1", // jazzTrio — also has carlos (user-1)
            time: "20:00",
            durationMinutes: 60,
          },
        ],
        bandMemberIds: {
          "band-1": ["user-1", "user-4"],
          "band-2": ["user-1", "user-5"],
        },
      },
      when: "schedule conflict validation runs",
      then: ["conflict is detected: carlos is shared member of both bands booked at same time"],
      expectedConflictIds: ["existing-band-1"],
    },

    "no conflict: same musician, non-overlapping solo + band slots": {
      given: {
        candidate: {
          ...eventFixtures.todayAcoustic,
          id: "candidate-solo-late",
          musicianId: "user-1", // carlos
          bandId: undefined,
          time: "22:00",
          durationMinutes: 60,
        },
        existing: [
          {
            ...eventFixtures.todayAcoustic,
            id: "existing-band-early",
            musicianId: undefined,
            bandId: "band-1", // jazzTrio — has carlos, ends at 21:00
            time: "20:00",
            durationMinutes: 60,
          },
        ],
        bandMemberIds: { "band-1": ["user-1", "user-4"] },
      },
      when: "schedule conflict validation runs",
      then: ["no conflict: slots do not overlap (band ends 21:00, solo starts 22:00)"],
      expectedConflictIds: [],
    },
  },
} as const
