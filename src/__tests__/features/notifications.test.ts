/**
 * Notifications feature tests — derived from specs/features/notifications.scenarios.ts
 *
 * Each describe/it maps to a scenario in the spec file.
 * When behavior changes: update scenarios FIRST → update this file → update model.
 */

import { describe, it, expect } from "vitest"
import { allSettled, fork } from "effector"
import { allNotifications, notificationFixtures } from "@/specs/fixtures"
import {
  loadNotifications,
  loadNotificationsFx,
  markAsRead,
  markAsReadFx,
  markAllAsRead,
  markAllAsReadFx,
  deleteNotification,
  deleteNotificationFx,
  addNotification,
  $isLoading,
} from "@/features/notifications/model"
import {
  $notifications,
  $unreadCount,
} from "@/entities/notification/model"

describe("notifications model", () => {
  describe("loading", () => {
    it("loads notifications on demand", async () => {
      const scope = fork({
        handlers: [[loadNotificationsFx, () => allNotifications]],
      })

      await allSettled(loadNotifications, { scope })

      const notifications = scope.getState($notifications)
      expect(notifications).toHaveLength(allNotifications.length)
      expect(scope.getState($isLoading)).toBe(false)
    })
  })

  describe("read state", () => {
    it("marks a single notification as read", async () => {
      const scope = fork({
        values: [[$notifications, allNotifications]],
        handlers: [[markAsReadFx, () => undefined]],
      })

      const unreadBefore = scope.getState($unreadCount)
      const target = notificationFixtures.newEvent // read: false

      await allSettled(markAsRead, { scope, params: target.id })

      const notifications = scope.getState($notifications)
      const updated = notifications.find((n) => n.id === target.id)
      expect(updated?.read).toBe(true)
      expect(scope.getState($unreadCount)).toBe(unreadBefore - 1)
    })

    it("marks all notifications as read", async () => {
      const scope = fork({
        values: [[$notifications, allNotifications]],
        handlers: [[markAllAsReadFx, () => undefined]],
      })

      await allSettled(markAllAsRead, { scope })

      const notifications = scope.getState($notifications)
      expect(notifications.every((n) => n.read)).toBe(true)
      expect(scope.getState($unreadCount)).toBe(0)
    })
  })

  describe("deletion", () => {
    it("deletes a notification", async () => {
      const scope = fork({
        values: [[$notifications, allNotifications]],
        handlers: [[deleteNotificationFx, () => undefined]],
      })

      const target = notificationFixtures.scheduleChange

      await allSettled(deleteNotification, { scope, params: target.id })

      const notifications = scope.getState($notifications)
      expect(notifications.find((n) => n.id === target.id)).toBeUndefined()
      expect(notifications.length).toBe(allNotifications.length - 1)
    })
  })

  describe("add notification", () => {
    it("adds a new notification with generated id and timestamp", async () => {
      const scope = fork()

      await allSettled(addNotification, {
        scope,
        params: {
          title: "Test",
          message: "Test message",
          type: "info",
          read: false,
        },
      })

      const notifications = scope.getState($notifications)
      expect(notifications.length).toBe(1)
      expect(notifications[0].id).toBeTruthy()
      expect(notifications[0].timestamp).toBeTruthy()
      expect(notifications[0].title).toBe("Test")
    })
  })
})
