import { z } from "zod"

export const UserRoleSchema = z.enum(["musician", "manager", "hotel"])

export const UserSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  name: z.string().min(1),
  role: UserRoleSchema,
  avatar: z.string().optional(),
  phone: z.string().optional(),
  // musician-specific
  shows: z.array(z.string()).optional(),
  hourlyRate: z.number().positive().optional(),
  // hotel-specific
  hotel: z.string().optional(),
  location: z.string().optional(),
  contactPerson: z.string().optional(),
  isActive: z.boolean().optional(),
  createdAt: z.string().datetime({ offset: true }),
})

export const LoginInputSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
})

export const RegisterInputSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  name: z.string().min(1),
  role: UserRoleSchema,
  phone: z.string().optional(),
  // musician-specific
  shows: z.array(z.string()).optional(),
  hourlyRate: z.number().positive().optional(),
  // hotel-specific
  hotel: z.string().optional(),
  location: z.string().optional(),
  contactPerson: z.string().optional(),
})

export type User = z.infer<typeof UserSchema>
export type UserRole = z.infer<typeof UserRoleSchema>
export type LoginInput = z.infer<typeof LoginInputSchema>
export type RegisterInput = z.infer<typeof RegisterInputSchema>
