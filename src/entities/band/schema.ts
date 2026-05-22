import { z } from "zod"

export const BandSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  description: z.string().optional(),
  genre: z.string().optional(),
  pricePerSet: z.number().positive().optional(),
  isActive: z.boolean().default(true),
  createdAt: z.string().datetime({ offset: true }),
  members: z.array(z.string()).optional(), // musician IDs
})

export const BandMemberSchema = z.object({
  bandId: z.string(),
  musicianId: z.string(),
})

export const CreateBandInputSchema = BandSchema.omit({ id: true, createdAt: true }).extend({
  memberIds: z.array(z.string()).min(2, "A band must have at least 2 members"),
})

export type Band = z.infer<typeof BandSchema>
export type BandMember = z.infer<typeof BandMemberSchema>
export type CreateBandInput = z.infer<typeof CreateBandInputSchema>
