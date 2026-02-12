import { createStore, createEvent, createEffect, sample } from "effector"

export interface Notification {
  id: string
  title: string
  message: string
  type: "info" | "warning" | "success" | "error"
  timestamp: string
  read: boolean
  actionUrl?: string
  actionText?: string
  userId?: string
  eventId?: string
}

// Events
export const loadNotifications = createEvent()
export const markAsRead = createEvent<string>()
export const markAllAsRead = createEvent()
export const deleteNotification = createEvent<string>()
export const addNotification = createEvent<Omit<Notification, "id" | "timestamp">>()

// Effects
export const loadNotificationsFx = createEffect<void, Notification[]>(async () => {
  await new Promise((resolve) => setTimeout(resolve, 300))

  const now = new Date()
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000)
  const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000)

  return [
    {
      id: "1",
      title: "Nuevo evento asignado",
      message: "Se te ha asignado un nuevo evento: 'Acoustic Set - Lobby' para hoy a las 19:00",
      type: "info",
      timestamp: now.toISOString(),
      read: false,
      actionUrl: "/check-in/1",
      actionText: "Ver evento",
      eventId: "1",
    },
    {
      id: "2",
      title: "Recordatorio de check-in",
      message: "No olvides hacer check-in para tu presentación de hoy a las 21:30",
      type: "warning",
      timestamp: new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString(),
      read: false,
      actionUrl: "/check-in/2",
      actionText: "Hacer check-in",
      eventId: "2",
    },
    {
      id: "3",
      title: "Check-in confirmado",
      message: "Tu check-in para 'Jazz Trio - Restaurante' ha sido registrado exitosamente",
      type: "success",
      timestamp: yesterday.toISOString(),
      read: true,
      eventId: "2",
    },
    {
      id: "4",
      title: "Evento próximo",
      message: "Tienes una presentación mañana: 'Solo Piano - Bar' a las 20:00",
      type: "info",
      timestamp: yesterday.toISOString(),
      read: false,
      actionUrl: "/calendar",
      actionText: "Ver calendario",
      eventId: "3",
    },
    {
      id: "5",
      title: "Pago procesado",
      message: "Se ha procesado el pago de $1,600 por tus presentaciones de la semana pasada",
      type: "success",
      timestamp: twoDaysAgo.toISOString(),
      read: true,
    },
    {
      id: "6",
      title: "Cambio de horario",
      message: "El evento 'Guitar Solo - Pool Bar' ha sido reprogramado para las 17:30",
      type: "warning",
      timestamp: twoDaysAgo.toISOString(),
      read: false,
      actionUrl: "/calendar",
      actionText: "Ver cambios",
      eventId: "5",
    },
  ]
})

export const markAsReadFx = createEffect<string, void>(async (notificationId) => {
  await new Promise((resolve) => setTimeout(resolve, 200))
  console.log(`Marked notification ${notificationId} as read`)
})

export const markAllAsReadFx = createEffect<void, void>(async () => {
  await new Promise((resolve) => setTimeout(resolve, 300))
  console.log("Marked all notifications as read")
})

export const deleteNotificationFx = createEffect<string, void>(async (notificationId) => {
  await new Promise((resolve) => setTimeout(resolve, 200))
  console.log(`Deleted notification ${notificationId}`)
})

// Stores
export const $notifications = createStore<Notification[]>([])
export const $isLoading = createStore(false)

export const $unreadCount = $notifications.map((notifications) => notifications.filter((n) => !n.read).length)

export const $unreadNotifications = $notifications.map((notifications) =>
  notifications
    .filter((n) => !n.read)
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()),
)

export const $readNotifications = $notifications.map((notifications) =>
  notifications.filter((n) => n.read).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()),
)

// Sample connections
sample({
  clock: loadNotifications,
  target: loadNotificationsFx,
})

sample({
  clock: loadNotificationsFx.doneData,
  target: $notifications,
})

sample({
  clock: markAsRead,
  target: markAsReadFx,
})

sample({
  clock: markAsReadFx.done,
  source: $notifications,
  fn: (notifications, { params: notificationId }) =>
    notifications.map((n) => (n.id === notificationId ? { ...n, read: true } : n)),
  target: $notifications,
})

sample({
  clock: markAllAsRead,
  target: markAllAsReadFx,
})

sample({
  clock: markAllAsReadFx.done,
  source: $notifications,
  fn: (notifications) => notifications.map((n) => ({ ...n, read: true })),
  target: $notifications,
})

sample({
  clock: deleteNotification,
  target: deleteNotificationFx,
})

sample({
  clock: deleteNotificationFx.done,
  source: $notifications,
  fn: (notifications, { params: notificationId }) => notifications.filter((n) => n.id !== notificationId),
  target: $notifications,
})

sample({
  clock: addNotification,
  source: $notifications,
  fn: (notifications, newNotification) => [
    {
      ...newNotification,
      id: Math.random().toString(36).substr(2, 9),
      timestamp: new Date().toISOString(),
    },
    ...notifications,
  ],
  target: $notifications,
})

sample({
  clock: [loadNotificationsFx.pending, markAsReadFx.pending, markAllAsReadFx.pending, deleteNotificationFx.pending],
  target: $isLoading,
})

// Initialize
setTimeout(() => {
  loadNotifications()
}, 500)

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
