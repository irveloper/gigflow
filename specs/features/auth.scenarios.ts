/**
 * Auth Feature Scenarios
 *
 * Source of truth for auth behavior. Each scenario maps directly to:
 *   - A vitest describe/it block in __tests__/features/auth.test.ts
 *   - A product requirement
 *
 * When behavior changes, update here FIRST, then update the model and tests.
 */

import { userFixtures, DEMO_PASSWORD } from "@/specs/fixtures"

export const authScenarios = {
  login: {
    "musician logs in with valid credentials": {
      given: { email: userFixtures.musician.email, password: DEMO_PASSWORD },
      when: "loginSubmitted is triggered",
      then: [
        "$user is set to musician user",
        "$isLoading is true during request then false",
        "auth cookie is set with user data",
        "localStorage contains user JSON",
      ],
      expectedUser: userFixtures.musician,
    },

    "manager logs in with valid credentials": {
      given: { email: userFixtures.manager.email, password: DEMO_PASSWORD },
      when: "loginSubmitted is triggered",
      then: ["$user is set to manager user", "auth cookie is set"],
      expectedUser: userFixtures.manager,
    },

    "hotel user logs in with valid credentials": {
      given: { email: userFixtures.hotel.email, password: DEMO_PASSWORD },
      when: "loginSubmitted is triggered",
      then: ["$user is set to hotel user", "auth cookie is set"],
      expectedUser: userFixtures.hotel,
    },

    "login fails with unknown email": {
      given: { email: "nobody@test.com", password: DEMO_PASSWORD },
      when: "loginSubmitted is triggered",
      then: ["loginFx throws", "$authError contains error message", "$user remains null"],
    },

    "login fails with wrong password": {
      given: { email: userFixtures.musician.email, password: "wrongpass" },
      when: "loginSubmitted is triggered",
      then: ["loginFx throws", "$authError contains error message", "$user remains null"],
    },
  },

  register: {
    "new musician registers successfully": {
      given: {
        email: "newmusic@test.com",
        password: DEMO_PASSWORD,
        name: "Nueva Musica",
        role: "musician",
        shows: ["Jazz"],
        hourlyRate: 700,
      },
      when: "registerSubmitted is triggered",
      then: ["registerFx succeeds", "$user is set", "auth cookie is set", "localStorage contains user JSON"],
    },
  },

  logout: {
    "authenticated user logs out": {
      given: "user is logged in",
      when: "logout event is triggered",
      then: ["$user is null", "auth cookie is cleared", "localStorage user entry is removed"],
    },
  },

  sessionRestore: {
    "returns existing user from localStorage": {
      given: "localStorage has valid user JSON",
      when: "checkAuth is triggered",
      then: ["$user is set from localStorage data", "auth cookie is re-synced", "$isAuthResolved becomes true"],
    },

    "clears stale data when localStorage is empty": {
      given: "localStorage has no user",
      when: "checkAuth is triggered",
      then: ["$user remains null", "auth cookie is cleared", "$isAuthResolved becomes true"],
    },
  },
} as const
