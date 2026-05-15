import type { Notification, CreateNotificationInput } from "@/shared/types"
import { trpc } from "@/shared/lib/trpc"

// Phase 1: tRPC → mock data in server/routers/notifications.ts
// Phase 4: server/routers/notifications.ts replaced with Supabase queries

export async function fetchNotifications(userId: string): Promise<Notification[]> {
  return trpc.notifications.getAll.query({ userId })
}

export async function markNotificationRead(id: string): Promise<void> {
  await trpc.notifications.markRead.mutate({ id })
}

export async function markAllNotificationsRead(): Promise<void> {
  await trpc.notifications.markAllRead.mutate()
}

export async function deleteNotification(id: string): Promise<void> {
  await trpc.notifications.delete.mutate({ id })
}

export async function createNotification(input: CreateNotificationInput): Promise<Notification> {
  return trpc.notifications.create.mutate(input)
}
