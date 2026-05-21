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
        instruments: ["Jazz"],
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

  orgSlug: {
    "org user has organizationSlug after checkAuth resolves": {
      given: "session contains a user with organizationSlug set",
      when: "checkAuth is triggered and checkAuthFx resolves",
      then: [
        "$user.organizationSlug equals the slug from the session",
        "nav prefix can be derived without waiting for loadMyOrgFx",
      ],
      expectedUser: "userFixtures.manager (has organizationSlug: 'gigflow')",
    },

    "non-org user has no organizationSlug after checkAuth resolves": {
      given: "session contains a user without organizationSlug (superadmin or pending)",
      when: "checkAuth is triggered and checkAuthFx resolves",
      then: ["$user.organizationSlug is undefined", "nav prefix stays empty string"],
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

  emailVerification: {
    "verified user session has emailVerified true after login": {
      given: { email: userFixtures.verifiedNoOrg.email, password: DEMO_PASSWORD, dbEmailVerified: true },
      when: "loginSubmitted is triggered and authorize() fetches user from DB",
      then: [
        "JWT token.emailVerified is true",
        "session.user.emailVerified is true (not corrupted by type cast)",
        "middleware does NOT redirect to /auth/pending?verify=1",
      ],
    },

    "verified user on pending page sees create-org mode": {
      given: { session: { emailVerified: true, organizationSlug: undefined } },
      when: "user visits /auth/pending (any query params)",
      then: [
        "pending page resolves session state",
        "create-org mode is shown (not check-inbox mode)",
        "ActivationStepper displays step 2 as current",
      ],
    },

    "verified user with org on pending page is redirected to dashboard": {
      given: { session: { emailVerified: true, organizationSlug: "gigflow" } },
      when: "user visits /auth/pending",
      then: [
        "router.replace is called with /org/gigflow",
        "user never sees pending page content",
      ],
    },

    "unverified user blocked from /org/new": {
      given: { session: { emailVerified: false, organizationSlug: undefined } },
      when: "user navigates to /org/new",
      then: [
        "middleware redirects to /auth/pending?verify=1",
        "user does not see the org creation form",
      ],
    },

    "logged-in user clicks verify link — redirected to /auth/pending without re-auth": {
      given: "user is authenticated (session cookie present) and visits /api/auth/verify-email with valid token",
      when: "verify-email route processes the request",
      then: [
        "DB: user.emailVerified is set to a Date",
        "JWT is updated in-place (emailVerified: true)",
        "user is redirected to /auth/pending (no verify=1 param)",
        "user is NOT shown the login form",
      ],
    },

    "logged-out user clicks verify link — lands on create-org mode after login": {
      given: "user has no active session and visits /api/auth/verify-email with valid token",
      when: "verify-email route processes the request",
      then: [
        "DB: user.emailVerified is set to a Date",
        "auth cookies are cleared",
        "user is redirected to /auth/login?verified=1&from=/auth/pending",
        "after login, middleware redirects to /auth/pending",
        "pending page shows create-org mode (emailVerified: true in fresh JWT)",
      ],
    },
  },
} as const
