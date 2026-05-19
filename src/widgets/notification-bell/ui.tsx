"use client"

import { useEffect } from "react"
import { useUnit } from "effector-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Badge } from "@/components/ui/badge"
import { Bell, CheckCheck } from "lucide-react"
import {
  $notifications,
  $unreadCount,
  loadNotifications,
  markAsRead,
  markAllAsRead,
} from "@/features/notifications/model"
import { $organization } from "@/entities/organization/model"

export function NotificationsDropdown() {
  const { notifications, unreadCount, organization } = useUnit({
    notifications: $notifications,
    unreadCount: $unreadCount,
    organization: $organization,
  })
  const notificationsHref = organization?.slug
    ? `/org/${organization.slug}/notifications`
    : "/notifications"

  useEffect(() => {
    loadNotifications()
  }, [])

  const handleMarkAsRead = (notificationId: string) => {
    markAsRead(notificationId)
  }

  const handleMarkAllAsRead = () => {
    markAllAsRead()
  }

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case "success":
        return "✅"
      case "warning":
        return "⚠️"
      case "error":
        return "❌"
      default:
        return "ℹ️"
    }
  }

  const formatTime = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60))

    if (diffInMinutes < 1) return "Ahora"
    if (diffInMinutes < 60) return `${diffInMinutes}m`
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h`
    return `${Math.floor(diffInMinutes / 1440)}d`
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
            >
              {unreadCount > 9 ? "9+" : unreadCount}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-80" align="end" forceMount>
        <DropdownMenuLabel className="flex items-center justify-between">
          <span>Notificaciones</span>
          {unreadCount > 0 && (
            <Button variant="ghost" size="sm" onClick={handleMarkAllAsRead} className="h-auto p-1 text-xs">
              <CheckCheck className="h-3 w-3 mr-1" />
              Marcar todas
            </Button>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />

        {notifications.length === 0 ? (
          <div className="p-4 text-center text-sm text-gray-500">No tienes notificaciones</div>
        ) : (
          <div className="max-h-96 overflow-y-auto">
            {notifications.slice(0, 10).map((notification) => (
              <DropdownMenuItem
                key={notification.id}
                className={`flex items-start gap-3 p-3 cursor-pointer ${!notification.read ? "bg-blue-50" : ""}`}
                onClick={() => !notification.read && handleMarkAsRead(notification.id)}
              >
                <div className="flex-shrink-0 text-lg">{getNotificationIcon(notification.type)}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-sm font-medium text-gray-900 truncate">{notification.title}</p>
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-gray-500">{formatTime(notification.timestamp)}</span>
                      {!notification.read && <div className="w-2 h-2 bg-blue-600 rounded-full"></div>}
                    </div>
                  </div>
                  <p className="text-xs text-gray-600 line-clamp-2">{notification.message}</p>
                </div>
              </DropdownMenuItem>
            ))}
          </div>
        )}

        {notifications.length > 10 && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <a href={notificationsHref} className="text-center text-sm text-blue-600 cursor-pointer">
                Ver todas las notificaciones
              </a>
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
