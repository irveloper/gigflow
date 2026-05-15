/**
 * Musicians Feature Scenarios
 *
 * Source of truth for musician management behavior.
 */

import { allMusicians, musicianFixtures } from "@/specs/fixtures"

export const musiciansScenarios = {
  loading: {
    "loads musicians on demand": {
      given: "empty $musicians store",
      when: "loadMusicians is triggered",
      then: ["loadMusiciansFx is called", "$musicians is populated", "$isLoading reflects request state"],
      expectedCount: allMusicians.length,
    },
  },

  crud: {
    "manager creates a musician": {
      given: {
        input: {
          name: "Lucia Torres",
          email: "lucia@test.com",
          phone: "+52 998 555 0000",
          shows: ["Soul Night"],
          hourlyRate: 950,
          isActive: true,
        },
      },
      when: "musicianCreated is triggered",
      then: ["new musician is added to $musicians with generated id and createdAt"],
    },

    "manager deletes a musician": {
      given: { musicianId: musicianFixtures.ana.id },
      when: "musicianDeleted is triggered",
      then: ["musician is removed from $musicians"],
    },
  },
} as const
