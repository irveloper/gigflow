/**
 * Hotels feature tests — derived from specs/features/hotels.scenarios.ts
 *
 * Each describe/it maps to a scenario in the spec file.
 * When behavior changes: update scenarios FIRST → update this file → update model.
 */

import { describe, it, expect } from "vitest"
import { allSettled, fork } from "effector"
import type { Hotel } from "@/shared/types"
import { allHotels, hotelFixtures } from "@/specs/fixtures"
import {
  loadHotels,
  loadHotelsFx,
  hotelCreated,
  createHotelFx,
  hotelUpdated,
  updateHotelFx,
  hotelRemoved,
  deleteHotelFx,
  hotelStatusToggled,
  toggleHotelStatusFx,
  $isLoading,
  $error,
} from "@/features/hotels/model"
import { $hotels, $activeHotels } from "@/entities/hotel/model"

describe("hotels model", () => {
  describe("loading", () => {
    it("loads hotels on demand", async () => {
      const scope = fork({
        handlers: [[loadHotelsFx, () => allHotels]],
      })

      await allSettled(loadHotels, { scope })

      const hotels = scope.getState($hotels)
      expect(hotels).toHaveLength(allHotels.length)
      expect(scope.getState($isLoading)).toBe(false)
    })

    it("$activeHotels reflects active subset", async () => {
      const scope = fork({
        handlers: [[loadHotelsFx, () => allHotels]],
      })
      await allSettled(loadHotels, { scope })

      const active = scope.getState($activeHotels)
      expect(active.every((h) => h.isActive)).toBe(true)
    })
  })

  describe("crud", () => {
    it("manager creates a hotel", async () => {
      const input = {
        name: "Hotel Fiesta",
        email: "eventos@fiesta.mx",
        phone: "+52 998 555 1111",
        location: "Cancún Centro",
        contactPerson: "Paola Rivera",
        isActive: true,
      }
      const scope = fork({
        handlers: [
          [
            createHotelFx,
            () => ({ ...input, id: "mock-hotel-id", createdAt: new Date().toISOString() }),
          ],
        ],
      })
      const before = scope.getState($hotels).length

      await allSettled(hotelCreated, { scope, params: input })

      const hotels = scope.getState($hotels)
      expect(hotels.length).toBe(before + 1)

      const created = hotels[hotels.length - 1]
      expect(created.name).toBe("Hotel Fiesta")
      expect(created.id).toBeTruthy()
      expect(created.createdAt).toBeTruthy()
    })

    it("manager updates a hotel", async () => {
      const scope = fork({
        values: [[$hotels, allHotels]],
        handlers: [[updateHotelFx, (hotel: Hotel) => hotel]],
      })

      const updated = { ...hotelFixtures.paradisus, contactPerson: "New Contact" }
      await allSettled(hotelUpdated, { scope, params: updated })

      const hotels = scope.getState($hotels)
      const found = hotels.find((h) => h.id === hotelFixtures.paradisus.id)
      expect(found?.contactPerson).toBe("New Contact")
    })

    it("manager removes a hotel", async () => {
      const scope = fork({
        values: [[$hotels, allHotels]],
        handlers: [[deleteHotelFx, (id: string) => id]],
      })

      await allSettled(hotelRemoved, { scope, params: hotelFixtures.xcaret.id })

      const hotels = scope.getState($hotels)
      expect(hotels.find((h) => h.id === hotelFixtures.xcaret.id)).toBeUndefined()
    })

    it("manager toggles hotel active state", async () => {
      const before = hotelFixtures.iberostar.isActive
      const scope = fork({
        values: [[$hotels, allHotels]],
        handlers: [
          [
            toggleHotelStatusFx,
            () => ({ ...hotelFixtures.iberostar, isActive: !hotelFixtures.iberostar.isActive }),
          ],
        ],
      })

      await allSettled(hotelStatusToggled, { scope, params: hotelFixtures.iberostar.id })

      const hotels = scope.getState($hotels)
      const toggled = hotels.find((h) => h.id === hotelFixtures.iberostar.id)
      expect(toggled?.isActive).toBe(!before)
    })
  })

  describe("error handling", () => {
    it("$error is null on successful operations", async () => {
      const scope = fork({
        handlers: [[loadHotelsFx, () => allHotels]],
      })
      await allSettled(loadHotels, { scope })
      expect(scope.getState($error)).toBeNull()
    })

    it("$error clears when a new operation starts", async () => {
      const scope = fork({
        values: [[$error, "previous error"]],
        handlers: [[loadHotelsFx, () => allHotels]],
      })

      await allSettled(loadHotels, { scope })

      expect(scope.getState($error)).toBeNull()
    })
  })
})
