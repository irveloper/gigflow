/**
 * Check-in feature tests — derived from specs/features/check-in.scenarios.ts
 *
 * Each describe/it maps to a scenario in the spec file.
 * When behavior changes: update scenarios FIRST → update this file → update model.
 */

import { describe, it, expect } from "vitest"
import { allSettled, fork } from "effector"
import { eventFixtures } from "@/specs/fixtures"
import {
  startCheckIn,
  submitCheckIn,
  cancelCheckIn,
  submitCheckInFx,
  $currentEventId,
  $isCheckingIn,
  $checkInError,
} from "@/features/check-in/model"
import { $events } from "@/entities/event/model"
import { $notifications } from "@/entities/notification/model"

describe("check-in model", () => {
  describe("state management", () => {
    it("startCheckIn sets current event id", async () => {
      const scope = fork()

      await allSettled(startCheckIn, { scope, params: eventFixtures.todayAcoustic.id })

      expect(scope.getState($currentEventId)).toBe(eventFixtures.todayAcoustic.id)
    })

    it("cancelCheckIn clears current event id", async () => {
      const scope = fork({
        values: [[$currentEventId, eventFixtures.todayAcoustic.id]],
      })

      await allSettled(cancelCheckIn, { scope })

      expect(scope.getState($currentEventId)).toBeNull()
    })
  })

  describe("submission", () => {
    it("check-in succeeds with valid data", async () => {
      const timestamp = new Date().toISOString()
      const scope = fork({
        values: [[$events, [eventFixtures.todayAcoustic]]],
        handlers: [
          [
            submitCheckInFx,
            () =>
              Promise.resolve({
                eventId: eventFixtures.todayAcoustic.id,
                timestamp,
              }),
          ],
        ],
      })

      const checkInData = {
        eventId: eventFixtures.todayAcoustic.id,
        photo: new File([""], "photo.jpg", { type: "image/jpeg" }),
        timestamp,
      }

      expect(scope.getState($isCheckingIn)).toBe(false)

      await allSettled(submitCheckIn, { scope, params: checkInData })

      expect(scope.getState($isCheckingIn)).toBe(false)
      expect(scope.getState($checkInError)).toBeNull()

      // event updated in entity store — original fields preserved, check-in fields set
      const events = scope.getState($events)
      const updated = events.find((e) => e.id === eventFixtures.todayAcoustic.id)
      expect(updated?.checkedIn).toBe(true)
      expect(updated?.status).toBe("in-progress")
      expect(updated?.checkInTime).toBeTruthy()
      // original fields intact
      expect(updated?.title).toBe(eventFixtures.todayAcoustic.title)
      expect(updated?.hotel).toBe(eventFixtures.todayAcoustic.hotel)
      expect(updated?.musician).toBe(eventFixtures.todayAcoustic.musician)
      expect(updated?.date).toBe(eventFixtures.todayAcoustic.date)
      expect(updated?.sets).toBe(eventFixtures.todayAcoustic.sets)
    })

    it("check-in adds success notification", async () => {
      const timestamp = new Date().toISOString()
      const scope = fork({
        values: [[$events, [eventFixtures.todayAcoustic]]],
        handlers: [
          [
            submitCheckInFx,
            () =>
              Promise.resolve({
                eventId: eventFixtures.todayAcoustic.id,
                timestamp,
              }),
          ],
        ],
      })

      const checkInData = {
        eventId: eventFixtures.todayAcoustic.id,
        photo: new File([""], "photo.jpg", { type: "image/jpeg" }),
        timestamp,
      }

      await allSettled(submitCheckIn, { scope, params: checkInData })

      const notifications = scope.getState($notifications)
      expect(notifications.length).toBeGreaterThan(0)

      const successNotif = notifications.find((n) => n.type === "success")
      expect(successNotif).toBeDefined()
    })

    it("submitCheckInFx error sets $checkInError", async () => {
      const scope = fork({
        handlers: [
          [submitCheckInFx, () => Promise.reject(new Error("Network error"))],
        ],
      })

      const checkInData = {
        eventId: "nonexistent",
        photo: new File([""], "photo.jpg", { type: "image/jpeg" }),
        timestamp: new Date().toISOString(),
      }

      await allSettled(submitCheckIn, { scope, params: checkInData })

      expect(scope.getState($checkInError)).toBe("Network error")
    })
  })
})
