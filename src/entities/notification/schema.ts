import { z } from "zod"

export const NotificationTypeSchema = z.enum(["info", "warning", "success", "error"])

export const NotificationSchema = z.object({
  id: z.string(),
  title: z.string().min(1),
  message: z.string().min(1),
  type: NotificationTypeSchema,
  timestamp: z.string().datetime({ offset: true }),
  read: z.boolean().default(false),
  actionUrl: z.string().optional(),
  actionText: z.string().optional(),
  userId: z.string().optional(),
  eventId: z.string().optional(),
})

export const CreateNotificationInputSchema = NotificationSchema.omit({ id: true, timestamp: true })

export type Notification = z.infer<typeof NotificationSchema>
export type NotificationType = z.infer<typeof NotificationTypeSchema>
export type CreateNotificationInput = z.infer<typeof CreateNotificationInputSchema>
