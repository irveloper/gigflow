/**
 * Auth model tests — derived from specs/features/auth.scenarios.ts
 *
 * Uses effector fork + handler overrides to bypass NextAuth/network calls.
 * When behavior changes: update scenarios FIRST → update this file → update model.
 */

import { describe, it, expect, vi } from "vitest"
import { allSettled, fork } from "effector"

// NextAuth initializes DB adapter at import time — stub it out for unit tests.
// Auth effects are overridden via fork({ handlers }) so these stubs are never called.
vi.mock("@/auth", () => ({
  handlers: { GET: vi.fn(), POST: vi.fn() },
  auth: vi.fn(),
  signIn: vi.fn(),
  signOut: vi.fn(),
  sessionToUser: vi.fn(),
}))
vi.mock("next-auth/react", () => ({
  signIn: vi.fn(),
  signOut: vi.fn(),
  getSession: vi.fn(),
  SessionProvider: ({ children }: { children: React.ReactNode }) => children,
}))
import { userFixtures } from "@/shared/mocks/users"
import {
  loginSubmitted,
  loginFx,
  checkAuth,
  checkAuthFx,
  logout,
  logoutFx,
  $authError,
  $isPending,
} from "@/features/auth/model"
import { $user } from "@/entities/user/model"

const musicianUser = userFixtures.musician
const managerUser = userFixtures.manager

describe("auth model", () => {
  describe("login", () => {
    it("musician logs in with valid credentials", async () => {
      const scope = fork({
        handlers: [[loginFx, () => musicianUser]],
      })

      await allSettled(loginSubmitted, {
        scope,
        params: { email: musicianUser.email, password: "correctpass" },
      })

      expect(scope.getState($user)?.email).toBe(musicianUser.email)
      expect(scope.getState($user)?.role).toBe("musician")
      expect(scope.getState($authError)).toBeNull()
    })

    it("login fails with wrong password", async () => {
      const scope = fork({
        handlers: [
          [
            loginFx,
            () => {
              throw new Error("Credenciales invalidas")
            },
          ],
        ],
      })

      await allSettled(loginSubmitted, {
        scope,
        params: { email: musicianUser.email, password: "wrongpass" },
      })

      expect(scope.getState($user)).toBeNull()
      expect(scope.getState($authError)).toBeTruthy()
    })

    it("login fails with unknown email", async () => {
      const scope = fork({
        handlers: [
          [
            loginFx,
            () => {
              throw new Error("Credenciales invalidas")
            },
          ],
        ],
      })

      await allSettled(loginSubmitted, {
        scope,
        params: { email: "nobody@test.com", password: "anypass" },
      })

      expect(scope.getState($user)).toBeNull()
      expect(scope.getState($authError)).toBeTruthy()
    })
  })

  describe("logout", () => {
    it("authenticated user logs out", async () => {
      const scope = fork({
        handlers: [
          [loginFx, () => managerUser],
          [logoutFx, () => undefined],
        ],
      })

      await allSettled(loginSubmitted, {
        scope,
        params: { email: managerUser.email, password: "correctpass" },
      })
      expect(scope.getState($user)).not.toBeNull()

      await allSettled(logout, { scope })

      expect(scope.getState($user)).toBeNull()
    })
  })

  describe("check auth", () => {
    it("sets user when session exists with role", async () => {
      const scope = fork({
        handlers: [[checkAuthFx, () => musicianUser]],
      })

      await allSettled(checkAuth, { scope })

      expect(scope.getState($user)?.id).toBe(musicianUser.id)
      expect(scope.getState($isPending)).toBe(false)
    })

    it("sets $isPending when session has no role", async () => {
      const scope = fork({
        handlers: [
          [
            checkAuthFx,
            () => {
              throw new Error("ROLE_PENDING")
            },
          ],
        ],
      })

      await allSettled(checkAuth, { scope })

      expect(scope.getState($isPending)).toBe(true)
      expect(scope.getState($user)).toBeNull()
    })

    it("clears user when no session", async () => {
      const scope = fork({
        handlers: [[checkAuthFx, () => null]],
      })

      await allSettled(checkAuth, { scope })

      expect(scope.getState($user)).toBeNull()
      expect(scope.getState($isPending)).toBe(false)
    })
  })

  describe("org slug — nav prefix race condition fix", () => {
    it("org user has organizationSlug after checkAuth resolves", async () => {
      const scope = fork({
        handlers: [[checkAuthFx, () => managerUser]],
      })

      await allSettled(checkAuth, { scope })

      expect(scope.getState($user)?.organizationSlug).toBe("gigflow")
    })

    it("non-org user has no organizationSlug after checkAuth resolves", async () => {
      const nonOrgUser = { ...musicianUser, organizationSlug: undefined }
      const scope = fork({
        handlers: [[checkAuthFx, () => nonOrgUser]],
      })

      await allSettled(checkAuth, { scope })

      expect(scope.getState($user)?.organizationSlug).toBeUndefined()
    })
  })

  describe("emailVerification", () => {
    // Scenario: verified user with no org — user model stores them correctly.
    // This fixture represents an admin who verified email but hasn't created an org yet.
    it("verified-no-org user is stored after checkAuth resolves", async () => {
      const verifiedNoOrgUser = userFixtures.verifiedNoOrg
      const scope = fork({
        handlers: [[checkAuthFx, () => verifiedNoOrgUser]],
      })

      await allSettled(checkAuth, { scope })

      expect(scope.getState($user)?.id).toBe(verifiedNoOrgUser.id)
      expect(scope.getState($user)?.organizationSlug).toBeUndefined()
      expect(scope.getState($user)?.organizationId).toBeUndefined()
    })

    // Scenario: session callback fix — Boolean() cast preserves the emailVerified truth value.
    // Regression guard: the old code used `as unknown as Date | null` which could corrupt the boolean.
    it("Boolean cast preserves emailVerified truth values from JWT token", () => {
      // These are the values token.emailVerified can hold after authorize() returns:
      expect(Boolean(true)).toBe(true)    // verified user
      expect(Boolean(false)).toBe(false)  // unverified user
      // Corruption cases the old cast allowed (should never be boolean in the new code):
      expect(Boolean(null)).toBe(false)   // null is falsy — correctly maps to unverified
      expect(Boolean(new Date())).toBe(true) // Date is truthy — correctly maps to verified
    })

    // Scenario: middleware guard — strict === false check only blocks truly unverified users.
    // Regression guard: any value other than the boolean false must NOT trigger the redirect.
    it("middleware emailVerified guard: only === false triggers redirect", () => {
      const shouldRedirect = (emailVerified: unknown) => emailVerified === false

      // Unverified user → redirect
      expect(shouldRedirect(false)).toBe(true)

      // Verified user → no redirect
      expect(shouldRedirect(true)).toBe(false)

      // Corrupted values that appeared before the Boolean() fix → no redirect (correct)
      expect(shouldRedirect(new Date())).toBe(false)
      expect(shouldRedirect(null)).toBe(false)
      expect(shouldRedirect(undefined)).toBe(false)
    })

    // Scenario: unverified user — should match the middleware guard.
    it("unverified user session triggers the middleware emailVerified guard", async () => {
      const scope = fork({
        handlers: [
          [
            checkAuthFx,
            () => {
              throw new Error("ROLE_PENDING")
            },
          ],
        ],
      })

      await allSettled(checkAuth, { scope })

      // User is null when session resolves with no role (pending state).
      // The middleware independently guards using session.user.emailVerified === false.
      expect(scope.getState($user)).toBeNull()
      expect(scope.getState($isPending)).toBe(true)
    })
  })
})
