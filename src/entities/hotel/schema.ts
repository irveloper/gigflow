import { z } from "zod"

export const HotelSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  email: z.string().email(),
  phone: z.string().min(1),
  location: z.string().min(1),
  contactPerson: z.string().min(1),
  isActive: z.boolean().default(true),
  avatar: z.string().optional(),
  createdAt: z.string().datetime({ offset: true }),
})

export const CreateHotelInputSchema = HotelSchema.omit({ id: true, createdAt: true })

export type Hotel = z.infer<typeof HotelSchema>
export type CreateHotelInput = z.infer<typeof CreateHotelInputSchema>
