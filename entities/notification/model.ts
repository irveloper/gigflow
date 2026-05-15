import { createStore, createEvent } from "effector"
import type { Notification } from "@/shared/types"

// ---------------------------------------------------------------------------
// Primitive events — feature layer wires effects to these
// ---------------------------------------------------------------------------
export const setNotifications = createEvent<Notification[]>()
export const upsertNotification = createEvent<Notification>()
export const markNotificationRead = createEvent<string>()
export const markAllNotificationsRead = createEvent()
export const removeNotification = createEvent<string>()

// ---------------------------------------------------------------------------
// Stores
// ---------------------------------------------------------------------------
export const $notifications = createStore<Notification[]>([])
  .on(setNotifications, (_, notifications) => notifications)
  .on(upsertNotification, (notifications, notification) => [notification, ...notifications])
  .on(markNotificationRead, (notifications, id) =>
    notifications.map((n) => (n.id === id ? { ...n, read: true } : n)),
  )
  .on(markAllNotificationsRead, (notifications) =>
    notifications.map((n) => ({ ...n, read: true })),
  )
  .on(removeNotification, (notifications, id) =>
    notifications.filter((n) => n.id !== id),
  )

// ---------------------------------------------------------------------------
// Derived stores
// ---------------------------------------------------------------------------
export const $unreadCount = $notifications.map(
  (notifications) => notifications.filter((n) => !n.read).length,
)

export const $unreadNotifications = $notifications.map((notifications) =>
  notifications
    .filter((n) => !n.read)
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()),
)

export const $readNotifications = $notifications.map((notifications) =>
  notifications
    .filter((n) => n.read)
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()),
)
