/**
 * Notifications Feature Scenarios
 *
 * Source of truth for notification center and shell notification behavior.
 */

import { notificationFixtures, allNotifications } from "@/specs/fixtures"

export const notificationsScenarios = {
  loading: {
    "loads notifications on demand": {
      given: "empty $notifications store",
      when: "loadNotifications is triggered",
      then: [
        "loadNotificationsFx is called",
        "$isLoading is true during fetch",
        "$notifications is populated with returned notifications",
      ],
      expectedCount: allNotifications.length,
    },
  },

  readState: {
    "marks a single notification as read": {
      given: { notification: notificationFixtures.newEvent },
      when: "markAsRead is triggered",
      then: ["target notification has read=true", "unread count is reduced by one"],
    },

    "marks all notifications as read": {
      given: { notifications: allNotifications },
      when: "markAllAsRead is triggered",
      then: ["every notification has read=true", "unread count becomes zero"],
    },
  },

  deletion: {
    "deletes a notification": {
      given: { notificationId: notificationFixtures.scheduleChange.id },
      when: "deleteNotification is triggered",
      then: ["notification is removed from $notifications"],
    },
  },
} as const
