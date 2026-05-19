import { z } from "zod"

export const OrganizationStatusSchema = z.enum([
  "trialing",
  "active",
  "past_due",
  "suspended",
  "canceled",
])

export const OrganizationSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  slug: z.string().min(1).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug must be lowercase alphanumeric with hyphens"),
  status: OrganizationStatusSchema.default("active"),
  createdAt: z.string().datetime({ offset: true }),
  updatedAt: z.string().datetime({ offset: true }),
})

export const CreateOrganizationInputSchema = z.object({
  name: z.string().min(1),
  slug: z.string().min(1).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug must be lowercase alphanumeric with hyphens"),
})

export const UpdateOrganizationInputSchema = z.object({
  name: z.string().min(1).optional(),
  slug: z.string().min(1).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).optional(),
  status: OrganizationStatusSchema.optional(),
})

// Join table schemas
export const HotelOrganizationSchema = z.object({
  hotelId: z.string(),
  organizationId: z.string(),
  contactPerson: z.string().optional(),
  contactPhone: z.string().optional(),
})

export const MusicianOrganizationSchema = z.object({
  musicianId: z.string(),
  organizationId: z.string(),
})

export type Organization = z.infer<typeof OrganizationSchema>
export type OrganizationStatus = z.infer<typeof OrganizationStatusSchema>
export type CreateOrganizationInput = z.infer<typeof CreateOrganizationInputSchema>
export type UpdateOrganizationInput = z.infer<typeof UpdateOrganizationInputSchema>
export type HotelOrganization = z.infer<typeof HotelOrganizationSchema>
export type MusicianOrganization = z.infer<typeof MusicianOrganizationSchema>
