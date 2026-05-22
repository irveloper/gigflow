import { z } from "zod"

export const EventAuditLogActionSchema = z.enum([
  "EVENT_CREATED",
  "MUSICIAN_ASSIGNED",
  "MUSICIAN_CHANGED",
  "MUSICIAN_REMOVED",
  "BAND_ASSIGNED",
  "BAND_CHANGED",
  "BAND_REMOVED",
  "INVITATION_SENT",
  "INVITATION_READ",
  "CHECK_IN_RECORDED",
  "CHECK_IN_CONFIRMED",
  "CHECK_IN_REJECTED",
  "STATUS_CHANGED",
  "SETS_CHANGE",
  "FIELD_UPDATED",
  "PRICE_CHANGED",
  "EVENT_DELETED",
  "PAYMENT_STATUS_CHANGED",
])

export const EventAuditLogSchema = z.object({
  id: z.string(),
  eventId: z.string(),
  organizationId: z.string(),
  actorId: z.string().nullable(),
  actorName: z.string(),
  actorRole: z.enum(["manager", "musician", "system"]),
  action: EventAuditLogActionSchema,
  metadata: z.record(z.string(), z.unknown()).nullable(),
  timestamp: z.string(), // ISO string — serialized from DateTime
})

export type EventAuditLog = z.infer<typeof EventAuditLogSchema>
export type EventAuditLogAction = z.infer<typeof EventAuditLogActionSchema>
