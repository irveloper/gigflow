import { z } from "zod"

// HH:MM format — used for display and scheduling
const TimeString = z.string().regex(/^\d{2}:\d{2}$/, "Must be HH:MM")
// YYYY-MM-DD format
const DateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD")
const DurationMinutes = z.number().int().positive().max(12 * 60)

export const EventStatusSchema = z.enum(["scheduled", "in-progress", "completed", "cancelled"])

export const EventSchema = z.object({
  id: z.string(),
  title: z.string().min(1),
  description: z.string().optional(),
  date: DateString,
  time: TimeString,
  durationMinutes: DurationMinutes,
  hotel: z.string().min(1),       // display name
  hotelId: z.string().optional(), // relation key
  musician: z.string().optional(),   // display name
  musicianId: z.string().optional(), // relation key
  status: EventStatusSchema,
  checkedIn: z.boolean().default(false),
  checkInTime: z.string().optional(),
  checkInPhoto: z.string().optional(),
  checkInLocation: z.object({ lat: z.number(), lng: z.number() }).optional(),
  checkInComments: z.string().optional(),
})

export const CreateEventInputSchema = EventSchema.omit({ id: true, checkedIn: true, checkInTime: true, checkInPhoto: true, checkInLocation: true, checkInComments: true })

export const CheckInInputSchema = z.object({
  eventId: z.string(),
  photo: z.instanceof(File).optional(),
  timestamp: z.string().datetime({ offset: true }),
  location: z.object({ lat: z.number(), lng: z.number() }).optional(),
  comments: z.string().optional(),
})

export type Event = z.infer<typeof EventSchema>
export type EventStatus = z.infer<typeof EventStatusSchema>
export type CreateEventInput = z.infer<typeof CreateEventInputSchema>
export type CheckInInput = z.infer<typeof CheckInInputSchema>
