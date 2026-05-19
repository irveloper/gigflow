import { createEvent, createEffect, createStore, sample } from "effector"
import { sileo } from "sileo"
import type { Notification, CreateNotificationInput } from "@/shared/types"
import {
  setNotifications,
  upsertNotification,
  markNotificationRead,
  markAllNotificationsRead,
  removeNotification,
} from "@/entities/notification"
import {
  $notifications,
  $readNotifications,
  $unreadCount,
  $unreadNotifications,
} from "@/entities/notification"
import * as notificationsApi from "@/shared/api/notifications"

// ---------------------------------------------------------------------------
// Re-export entity stores (public API for this feature)
// ---------------------------------------------------------------------------
export { $notifications, $unreadCount, $unreadNotifications, $readNotifications }

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------
export const loadNotifications = createEvent()
export const markAsRead = createEvent<string>()
export const markAllAsRead = createEvent()
export const deleteNotification = createEvent<string>()
export const addNotification = createEvent<CreateNotificationInput>()

// ---------------------------------------------------------------------------
// Effects
// ---------------------------------------------------------------------------
export const loadNotificationsFx = createEffect<void, Notification[]>(() =>
  notificationsApi.fetchNotifications(),
)

export const markAsReadFx = createEffect<string, void>((id) => notificationsApi.markNotificationRead(id))

export const markAllAsReadFx = createEffect<void, void>(() => notificationsApi.markAllNotificationsRead())

export const deleteNotificationFx = createEffect<string, void>((id) =>
  notificationsApi.deleteNotification(id),
)

export const $isLoading = createStore(false).on(
  [
    loadNotificationsFx.pending,
    markAsReadFx.pending,
    markAllAsReadFx.pending,
    deleteNotificationFx.pending,
  ],
  (_, pending) => pending,
)

// ---------------------------------------------------------------------------
// Wire events → effects → entity stores
// ---------------------------------------------------------------------------
sample({ clock: loadNotifications, target: loadNotificationsFx })
sample({ clock: loadNotificationsFx.doneData, target: setNotifications })

sample({ clock: markAsRead, target: markAsReadFx })
sample({
  clock: markAsReadFx.done,
  fn: ({ params }) => params,
  target: markNotificationRead,
})

sample({ clock: markAllAsRead, target: markAllAsReadFx })
sample({ clock: markAllAsReadFx.done, target: markAllNotificationsRead })

sample({ clock: deleteNotification, target: deleteNotificationFx })
sample({
  clock: deleteNotificationFx.done,
  fn: ({ params }) => params,
  target: removeNotification,
})

sample({
  clock: addNotification,
  fn: (input): Notification => ({
    ...input,
    id: Math.random().toString(36).slice(2, 9),
    timestamp: new Date().toISOString(),
  }),
  target: upsertNotification,
})

// ---------------------------------------------------------------------------
// Sileo toast feedback (client-side only)
// ---------------------------------------------------------------------------
if (typeof window !== "undefined") {
  markAsReadFx.done.watch(() => sileo.success({ title: "Marcado como leído" }))
  markAsReadFx.fail.watch(() => sileo.error({ title: "Error al marcar" }))

  markAllAsReadFx.done.watch(() => sileo.success({ title: "Todas marcadas como leídas" }))
  markAllAsReadFx.fail.watch(() => sileo.error({ title: "Error al marcar todas" }))

  deleteNotificationFx.done.watch(() => sileo.success({ title: "Notificación eliminada" }))
  deleteNotificationFx.fail.watch(() => sileo.error({ title: "Error al eliminar" }))

  loadNotificationsFx.fail.watch(() => sileo.error({ title: "Error al cargar notificaciones" }))

  addNotification.watch((notification) => {
    if (notification.actionUrl && notification.actionText) {
      sileo.action({
        title: notification.title,
        description: notification.message,
        button: {
          title: notification.actionText,
          onClick: () => { window.location.href = notification.actionUrl! },
        },
      })
      return
    }

    const dispatch = {
      success: () => sileo.success({ title: notification.title, description: notification.message }),
      error:   () => sileo.error({   title: notification.title, description: notification.message }),
      warning: () => sileo.warning({ title: notification.title, description: notification.message }),
      info:    () => sileo.info({    title: notification.title, description: notification.message }),
    }

    dispatch[notification.type]?.()
  })
}

// ---------------------------------------------------------------------------
// Consolidated export
// ---------------------------------------------------------------------------
export const notificationsModel = {
  $notifications,
  $unreadCount,
  $unreadNotifications,
  $readNotifications,
  $isLoading,
  loadNotifications,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  addNotification,
  loadNotificationsFx,
  markAsReadFx,
  markAllAsReadFx,
  deleteNotificationFx,
}
