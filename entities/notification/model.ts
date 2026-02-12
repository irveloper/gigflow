// Re-export everything from the features/notifications/model to consolidate
// This entity layer re-exports the canonical notification model from the features layer
export {
  $notifications,
  $isLoading,
  $unreadCount,
  $unreadNotifications,
  $readNotifications,
  loadNotifications,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  addNotification,
  notificationsModel,
} from "@/features/notifications/model"

export type { Notification } from "@/features/notifications/model"
