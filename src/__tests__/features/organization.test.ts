/**
 * Organization feature tests — derived from specs/features/organization.scenarios.ts
 *
 * Tests the Effector org model behavior using fork + handler overrides.
 * When behavior changes: update scenarios FIRST → update this file → update model.
 */

import { describe, it, expect, vi } from "vitest"
import { allSettled, fork } from "effector"
import { organizationFixtures } from "@/specs/fixtures"

vi.mock("@/auth", () => ({
  handlers: { GET: vi.fn(), POST: vi.fn() },
  auth: vi.fn(),
  signIn: vi.fn(),
  signOut: vi.fn(),
}))
vi.mock("next-auth/react", () => ({
  signIn: vi.fn(),
  signOut: vi.fn(),
  getSession: vi.fn(),
  SessionProvider: ({ children }: { children: React.ReactNode }) => children,
}))

import {
  loadOrg,
  loadMyOrgFx,
  orgCreated,
  createOrgFx,
  orgUpdated,
  updateOrgFx,
  $isLoading,
  $error,
} from "@/features/org/model"
import { $organization } from "@/entities/organization/model"

const orgA = organizationFixtures.sonidosDelMar
const orgB = organizationFixtures.ritmoCaribe

describe("organization model", () => {
  describe("creation", () => {
    it("create org — $organization is populated on success", async () => {
      const scope = fork({
        handlers: [[createOrgFx, () => orgA]],
      })

      await allSettled(orgCreated, {
        scope,
        params: { name: orgA.name, slug: orgA.slug },
      })

      expect(scope.getState($organization)).toEqual(orgA)
      expect(scope.getState($isLoading)).toBe(false)
      expect(scope.getState($error)).toBeNull()
    })

    it("create org clears $error on retry", async () => {
      // Seed an error state, then trigger orgCreated — $error should clear
      const scope = fork({
        values: [[$error, "Slug ya en uso"]],
        handlers: [[createOrgFx, () => orgA]],
      })

      expect(scope.getState($error)).toBe("Slug ya en uso")

      await allSettled(orgCreated, {
        scope,
        params: { name: orgA.name, slug: orgA.slug },
      })

      expect(scope.getState($error)).toBeNull()
    })

    it("create org — $error is set on failure", async () => {
      const scope = fork({
        handlers: [
          [createOrgFx, () => { throw new Error("Slug already taken") }],
        ],
      })

      await allSettled(orgCreated, {
        scope,
        params: { name: orgA.name, slug: orgA.slug },
      })

      expect(scope.getState($error)).toBe("Slug already taken")
      expect(scope.getState($organization)).toBeNull()
    })
  })

  describe("loading", () => {
    it("load org — $organization is populated from API", async () => {
      const scope = fork({
        handlers: [[loadMyOrgFx, () => orgA]],
      })

      await allSettled(loadOrg, { scope })

      expect(scope.getState($organization)).toEqual(orgA)
      expect(scope.getState($isLoading)).toBe(false)
    })

    it("load org — returns null for pending user without error surfacing", async () => {
      const scope = fork({
        handlers: [[loadMyOrgFx, () => null]],
      })

      await allSettled(loadOrg, { scope })

      expect(scope.getState($organization)).toBeNull()
      expect(scope.getState($isLoading)).toBe(false)
      // loadMyOrgFx swallows errors — $error is not set on load failure
      expect(scope.getState($error)).toBeNull()
    })
  })

  describe("update", () => {
    it("update org — $organization reflects updated fields", async () => {
      const updated = { ...orgA, name: "Nuevo Nombre" }
      const scope = fork({
        values: [[$organization, orgA]],
        handlers: [[updateOrgFx, () => updated]],
      })

      await allSettled(orgUpdated, {
        scope,
        params: { name: "Nuevo Nombre" },
      })

      expect(scope.getState($organization)?.name).toBe("Nuevo Nombre")
      expect(scope.getState($isLoading)).toBe(false)
    })
  })

  describe("data isolation — model layer", () => {
    it("superadmin bypasses org isolation — loadMyOrgFx returns null without error", async () => {
      // Superadmin has no org — loadMyOrgFx should resolve to null cleanly
      const scope = fork({
        handlers: [[loadMyOrgFx, () => null]],
      })

      await allSettled(loadOrg, { scope })

      expect(scope.getState($organization)).toBeNull()
      expect(scope.getState($error)).toBeNull()
    })

    it("loading org B after org A replaces $organization", async () => {
      const scope = fork({
        values: [[$organization, orgA]],
        handlers: [[loadMyOrgFx, () => orgB]],
      })

      await allSettled(loadOrg, { scope })

      expect(scope.getState($organization)).toEqual(orgB)
    })
  })
})
