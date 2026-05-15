/**
 * App Shell Scenarios
 *
 * Source of truth for the unified org shell contract.
 */

export const appShellScenarios = {
  navigation: {
    "musician sees calendar, notifications, and profile routes": {
      given: { role: "musician" },
      then: ["navigation includes home, calendar, notifications, and profile"],
    },

    "manager sees operational routes in the shared shell": {
      given: { role: "manager" },
      then: ["navigation includes admin events, musicians, hotels, reports, and notifications"],
    },

    "hotel sees hotel dashboard plus shared routes": {
      given: { role: "hotel" },
      then: ["navigation includes hotel dashboard, calendar, and notifications"],
    },
  },

  dashboard: {
    "dashboard quick actions change by role": {
      given: "authenticated user role",
      then: ["home dashboard quick actions are role-aware while using the same shell framework"],
    },
  },
} as const
