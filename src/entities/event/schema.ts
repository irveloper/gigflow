import { z } from "zod"

// HH:MM format — used for display and scheduling
const TimeString = z.string().regex(/^\d{2}:\d{2}$/, "Must be HH:MM")
// YYYY-MM-DD format
const DateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD")
const Sets = z.number().int().min(1).max(12)

export const EventStatusSchema = z.enum(["scheduled", "in-progress", "completed", "cancelled"])
export const PaymentStatusSchema = z.enum(["pending", "paid"])

export const EventSchema = z.object({
  id: z.string(),
  title: z.string().min(1),
  description: z.string().optional(),
  date: DateString,
  time: TimeString,
  sets: Sets,
  hotel: z.string().min(1),       // display name
  hotelId: z.string().optional(), // relation key
  musician: z.string().optional(),   // display name (solo)
  musicianId: z.string().optional(), // relation key (solo)
  band: z.string().optional(),       // display name (band booking)
  bandId: z.string().optional(),     // relation key (band booking)
  status: EventStatusSchema,
  price: z.number().nullable().optional(),
  paymentStatus: PaymentStatusSchema.default("pending"),
  paymentNotes: z.string().nullable().optional(),
  checkedIn: z.boolean().default(false),
  checkInTime: z.string().optional(),
  checkInPhoto: z.string().optional(),
  checkInLocation: z.object({ lat: z.number(), lng: z.number() }).optional(),
  checkInComments: z.string().optional(),
  // Populated for musician cross-org view
  organizationName: z.string().optional(),
  organizationSlug: z.string().optional(),
})

export const CreateEventInputSchema = EventSchema.omit({ id: true, checkedIn: true, checkInTime: true, checkInPhoto: true, checkInLocation: true, checkInComments: true, price: true })

export const CheckInInputSchema = z.object({
  eventId: z.string(),
  photo: z.instanceof(File).optional(),
  timestamp: z.string().datetime({ offset: true }),
  location: z.object({ lat: z.number(), lng: z.number() }).optional(),
  comments: z.string().optional(),
})

export type Event = z.infer<typeof EventSchema>
export type EventStatus = z.infer<typeof EventStatusSchema>
export type PaymentStatus = z.infer<typeof PaymentStatusSchema>
export type CreateEventInput = z.infer<typeof CreateEventInputSchema>
export type CheckInInput = z.infer<typeof CheckInInputSchema>
