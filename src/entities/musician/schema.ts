import { z } from "zod"

export const MusicianSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  email: z.string().email(),
  phone: z.string().min(1),
  instruments: z.array(z.string()).min(1),
  styles: z.array(z.string()).min(1),
  pricePerSet: z.number().positive(),
  isActive: z.boolean().default(true),
  avatar: z.string().optional(),
  createdAt: z.string().datetime({ offset: true }),
})

export const CreateMusicianInputSchema = MusicianSchema.omit({ id: true, createdAt: true })

export type Musician = z.infer<typeof MusicianSchema>
export type CreateMusicianInput = z.infer<typeof CreateMusicianInputSchema>
