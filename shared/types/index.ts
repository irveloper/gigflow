/**
 * Canonical types — derived from Zod schemas in entities/[slice]/schema.ts
 *
 * DO NOT define types manually here.
 * Add fields to the schema file, then `z.infer<>` provides the type.
 */
export type { User, UserRole, LoginInput, RegisterInput } from "@/entities/user/schema"
export type { Event, EventStatus, CreateEventInput, CheckInInput } from "@/entities/event/schema"
export type { Hotel, CreateHotelInput } from "@/entities/hotel/schema"
export type { Musician, CreateMusicianInput } from "@/entities/musician/schema"
export type { Notification, NotificationType, CreateNotificationInput } from "@/entities/notification/schema"
