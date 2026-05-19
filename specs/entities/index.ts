/**
 * specs/entities — canonical Zod schemas and inferred types
 *
 * SINGLE SOURCE OF TRUTH for all domain types.
 * shared/types/index.ts re-exports these for app-layer consumption.
 * No imports from app/, features/, or entities/ runtime code allowed here.
 */
export {
  EventSchema,
  EventStatusSchema,
  CreateEventInputSchema,
  CheckInInputSchema,
} from "@/entities/event/schema"
export type { Event, EventStatus, CreateEventInput, CheckInInput } from "@/entities/event/schema"

export { HotelSchema, CreateHotelInputSchema } from "@/entities/hotel/schema"
export type { Hotel, CreateHotelInput } from "@/entities/hotel/schema"

export { BandSchema, BandMemberSchema, CreateBandInputSchema } from "@/entities/band/schema"
export type { Band, BandMember, CreateBandInput } from "@/entities/band/schema"

export { MusicianSchema, CreateMusicianInputSchema } from "@/entities/musician/schema"
export type { Musician, CreateMusicianInput } from "@/entities/musician/schema"

export {
  NotificationSchema,
  NotificationTypeSchema,
  CreateNotificationInputSchema,
} from "@/entities/notification/schema"
export type {
  Notification,
  NotificationType,
  CreateNotificationInput,
} from "@/entities/notification/schema"

export {
  UserSchema,
  UserRoleSchema,
  LoginInputSchema,
  RegisterInputSchema,
} from "@/entities/user/schema"
export type { User, UserRole, LoginInput, RegisterInput } from "@/entities/user/schema"

export {
  OrganizationSchema,
  OrganizationStatusSchema,
  CreateOrganizationInputSchema,
  UpdateOrganizationInputSchema,
  HotelOrganizationSchema,
  MusicianOrganizationSchema,
} from "@/entities/organization/schema"
export type {
  Organization,
  OrganizationStatus,
  CreateOrganizationInput,
  UpdateOrganizationInput,
  HotelOrganization,
  MusicianOrganization,
} from "@/entities/organization/schema"

export { SubscriptionSchema, SubscriptionStatusSchema } from "@/entities/subscription/schema"
export type { Subscription, SubscriptionStatus } from "@/entities/subscription/schema"

export {
  CursorPaginationInputSchema,
  OffsetPaginationInputSchema,
  CursorPaginatedResponseSchema,
  OffsetPaginatedResponseSchema,
} from "./pagination.schema"
export type { CursorPaginationInput, OffsetPaginationInput } from "./pagination.schema"
