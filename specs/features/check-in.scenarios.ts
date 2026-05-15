/**
 * Check-in Feature Scenarios
 *
 * Source of truth for check-in flow behavior.
 * Update here FIRST when requirements change.
 */

import { eventFixtures } from "@/specs/fixtures"
import { userFixtures } from "@/specs/fixtures"

export const checkInScenarios = {
  validation: {
    "musician can check in to own scheduled event": {
      given: {
        user: userFixtures.musician,
        event: eventFixtures.todayAcoustic, // musicianId matches user.id
      },
      then: ["check-in form is accessible", "photo upload is enabled"],
    },

    "musician cannot check in to another musician's event": {
      given: {
        user: userFixtures.musician,
        event: eventFixtures.tomorrowVocal, // musicianId = user-4, not user-1
      },
      then: ["check-in is not available", "redirect or access denied"],
    },

    "musician cannot check in to already-completed event": {
      given: {
        user: userFixtures.musician,
        event: eventFixtures.completedLatinJazz, // status = 'completed'
      },
      then: ["check-in button is disabled or hidden", "completed status is shown"],
    },
  },

  submission: {
    "check-in succeeds with photo": {
      given: {
        eventId: eventFixtures.todayAcoustic.id,
        photo: "valid File object (image/*)",
        timestamp: "ISO datetime string",
      },
      when: "check-in form is submitted",
      then: [
        "checkInFx is called with eventId, photo, timestamp",
        "event status becomes 'in-progress'",
        "checkedIn becomes true",
        "checkInTime is set",
        "success notification is shown",
        "user is redirected away from check-in page",
      ],
    },

    "check-in fails without photo": {
      given: { eventId: eventFixtures.todayAcoustic.id, photo: null },
      when: "check-in form is submitted",
      then: ["form validation error is shown", "checkInFx is NOT called"],
    },
  },
} as const
