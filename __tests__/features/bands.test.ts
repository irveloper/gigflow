/**
 * Bands feature tests — derived from specs/features/bands.scenarios.ts
 *
 * Each describe/it maps to a scenario in the spec file.
 * When behavior changes: update scenarios FIRST → update this file → update model.
 */

import { describe, it, expect } from "vitest"
import { allSettled, fork } from "effector"
import type { Band } from "@/shared/types"
import { allBands, bandFixtures } from "@/specs/fixtures"
import {
  loadBands,
  loadBandsFx,
  bandCreated,
  createBandFx,
  bandUpdated,
  updateBandFx,
  memberAdded,
  addMemberFx,
  memberRemoved,
  removeMemberFx,
  bandDeactivated,
  deactivateBandFx,
  $isLoading,
  $error,
} from "@/features/bands/model"
import { $bands } from "@/entities/band"

describe("bands model", () => {
  describe("loading", () => {
    it("loads bands on demand", async () => {
      const scope = fork({
        handlers: [[loadBandsFx, () => allBands]],
      })

      await allSettled(loadBands, { scope })

      const bands = scope.getState($bands)
      expect(bands).toHaveLength(allBands.length)
      expect(scope.getState($isLoading)).toBe(false)
    })

    it("$isLoading is false after load completes", async () => {
      const scope = fork({
        handlers: [[loadBandsFx, () => allBands]],
      })

      await allSettled(loadBands, { scope })
      expect(scope.getState($isLoading)).toBe(false)
    })
  })

  describe("crud", () => {
    it("manager creates a band with minimum 2 members", async () => {
      const input = {
        name: "Duo Caribe",
        genre: "Latin",
        isActive: true,
        memberIds: ["user-1", "user-4"],
      }
      const createdBand: Band = {
        id: "band-new",
        name: input.name,
        genre: input.genre,
        isActive: true,
        createdAt: new Date().toISOString(),
        members: input.memberIds,
      }
      const scope = fork({
        handlers: [[createBandFx, () => createdBand]],
      })
      const before = scope.getState($bands).length

      await allSettled(bandCreated, { scope, params: input })

      const bands = scope.getState($bands)
      expect(bands.length).toBe(before + 1)
      const created = bands[0] // addBand prepends
      expect(created.name).toBe("Duo Caribe")
      expect(created.members).toContain("user-1")
      expect(created.members).toContain("user-4")
    })

    it("manager updates a band's metadata", async () => {
      const updatedBand = { ...bandFixtures.jazzTrio, genre: "Jazz Fusion" }
      const scope = fork({
        values: [[$bands, allBands]],
        handlers: [[updateBandFx, () => updatedBand]],
      })

      await allSettled(bandUpdated, {
        scope,
        params: { id: bandFixtures.jazzTrio.id, genre: "Jazz Fusion" },
      })

      const bands = scope.getState($bands)
      const found = bands.find((b) => b.id === bandFixtures.jazzTrio.id)
      expect(found?.genre).toBe("Jazz Fusion")
    })
  })

  describe("member management", () => {
    it("adds a member to a band", async () => {
      const bandAfterAdd: Band = {
        ...bandFixtures.jazzTrio,
        members: [...(bandFixtures.jazzTrio.members ?? []), "user-5"],
      }
      const scope = fork({
        values: [[$bands, allBands]],
        handlers: [[addMemberFx, () => bandAfterAdd]],
      })

      await allSettled(memberAdded, {
        scope,
        params: { bandId: bandFixtures.jazzTrio.id, musicianId: "user-5" },
      })

      const bands = scope.getState($bands)
      const found = bands.find((b) => b.id === bandFixtures.jazzTrio.id)
      expect(found?.members).toContain("user-5")
    })

    it("removes a member from a band", async () => {
      const threeMemberBand: Band = {
        ...bandFixtures.jazzTrio,
        members: ["user-1", "user-4", "user-5"],
      }
      const bandAfterRemove: Band = {
        ...bandFixtures.jazzTrio,
        members: ["user-1", "user-4"],
      }
      const scope = fork({
        values: [[$bands, [threeMemberBand, bandFixtures.flamencoGroup]]],
        handlers: [[removeMemberFx, () => bandAfterRemove]],
      })

      await allSettled(memberRemoved, {
        scope,
        params: { bandId: bandFixtures.jazzTrio.id, musicianId: "user-5" },
      })

      const bands = scope.getState($bands)
      const found = bands.find((b) => b.id === bandFixtures.jazzTrio.id)
      expect(found?.members).not.toContain("user-5")
      expect(found?.members).toHaveLength(2)
    })
  })

  describe("deactivate", () => {
    it("deactivating a band marks it as inactive", async () => {
      const inactiveBand: Band = { ...bandFixtures.jazzTrio, isActive: false }
      const scope = fork({
        values: [[$bands, allBands]],
        handlers: [[deactivateBandFx, () => inactiveBand]],
      })

      await allSettled(bandDeactivated, { scope, params: bandFixtures.jazzTrio.id })

      const bands = scope.getState($bands)
      const found = bands.find((b) => b.id === bandFixtures.jazzTrio.id)
      expect(found?.isActive).toBe(false)
    })

    it("deactivated band remains in the store (soft delete)", async () => {
      const inactiveBand: Band = { ...bandFixtures.jazzTrio, isActive: false }
      const scope = fork({
        values: [[$bands, allBands]],
        handlers: [[deactivateBandFx, () => inactiveBand]],
      })

      await allSettled(bandDeactivated, { scope, params: bandFixtures.jazzTrio.id })

      const bands = scope.getState($bands)
      expect(bands.find((b) => b.id === bandFixtures.jazzTrio.id)).toBeDefined()
    })
  })

  describe("error handling", () => {
    it("$error is null after successful load", async () => {
      const scope = fork({
        handlers: [[loadBandsFx, () => allBands]],
      })
      await allSettled(loadBands, { scope })
      expect(scope.getState($error)).toBeNull()
    })

    it("$error clears when a new operation starts", async () => {
      const scope = fork({
        values: [[$error, "previous error"]],
        handlers: [[loadBandsFx, () => allBands]],
      })
      await allSettled(loadBands, { scope })
      expect(scope.getState($error)).toBeNull()
    })
  })
})
