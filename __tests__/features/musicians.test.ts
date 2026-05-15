/**
 * Musicians feature tests — derived from specs/features/musicians.scenarios.ts
 *
 * Each describe/it maps to a scenario in the spec file.
 * When behavior changes: update scenarios FIRST → update this file → update model.
 */

import { describe, it, expect } from "vitest"
import { allSettled, fork } from "effector"
import type { Musician } from "@/shared/types"
import { allMusicians, musicianFixtures } from "@/specs/fixtures"
import {
  loadMusicians,
  loadMusiciansFx,
  musicianCreated,
  createMusicianFx,
  musicianUpdated,
  updateMusicianFx,
  musicianDeleted,
  deleteMusicianFx,
  $isLoading,
  $error,
} from "@/features/musicians/model"
import { $musicians } from "@/entities/musician/model"

describe("musicians model", () => {
  describe("loading", () => {
    it("loads musicians on demand", async () => {
      const scope = fork({
        handlers: [[loadMusiciansFx, () => allMusicians]],
      })

      await allSettled(loadMusicians, { scope })

      const musicians = scope.getState($musicians)
      expect(musicians).toHaveLength(allMusicians.length)
      expect(scope.getState($isLoading)).toBe(false)
    })
  })

  describe("crud", () => {
    it("manager creates a musician", async () => {
      const input = {
        name: "Lucia Torres",
        email: "lucia@test.com",
        phone: "+52 998 555 0000",
        shows: ["Soul Night"],
        hourlyRate: 950,
        isActive: true,
      }
      const scope = fork({
        handlers: [
          [
            createMusicianFx,
            () => ({ ...input, id: "mock-musician-id", createdAt: new Date().toISOString() }),
          ],
        ],
      })
      const before = scope.getState($musicians).length

      await allSettled(musicianCreated, { scope, params: input })

      const musicians = scope.getState($musicians)
      expect(musicians.length).toBe(before + 1)

      const created = musicians[0] // addMusician prepends
      expect(created.name).toBe("Lucia Torres")
      expect(created.id).toBeTruthy()
      expect(created.createdAt).toBeTruthy()
      expect(created.hourlyRate).toBe(950)
    })

    it("manager updates a musician", async () => {
      const scope = fork({
        values: [[$musicians, allMusicians]],
        handlers: [[updateMusicianFx, (musician: Musician) => musician]],
      })

      const updated = { ...musicianFixtures.carlos, hourlyRate: 1000 }
      await allSettled(musicianUpdated, { scope, params: updated })

      const musicians = scope.getState($musicians)
      const found = musicians.find((m) => m.id === musicianFixtures.carlos.id)
      expect(found?.hourlyRate).toBe(1000)
    })

    it("manager deletes a musician", async () => {
      const scope = fork({
        values: [[$musicians, allMusicians]],
        handlers: [[deleteMusicianFx, (id: string) => id]],
      })

      await allSettled(musicianDeleted, { scope, params: musicianFixtures.ana.id })

      const musicians = scope.getState($musicians)
      expect(musicians.find((m) => m.id === musicianFixtures.ana.id)).toBeUndefined()
      expect(musicians.find((m) => m.id === musicianFixtures.carlos.id)).toBeDefined()
    })
  })

  describe("error handling", () => {
    it("$error is null after successful load", async () => {
      const scope = fork({
        handlers: [[loadMusiciansFx, () => allMusicians]],
      })
      await allSettled(loadMusicians, { scope })
      expect(scope.getState($error)).toBeNull()
    })

    it("$error clears when a new operation starts", async () => {
      const scope = fork({
        values: [[$error, "previous error"]],
        handlers: [[loadMusiciansFx, () => allMusicians]],
      })

      await allSettled(loadMusicians, { scope })

      expect(scope.getState($error)).toBeNull()
    })
  })
})
