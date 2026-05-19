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

      expect(scope.getState($user)?.organizationSlug).toBe("plugin-cancun")
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
})
