import { z } from "zod"

export const SubscriptionStatusSchema = z.enum([
  "trialing",
  "active",
  "past_due",
  "suspended",
  "canceled",
])

export const SubscriptionSchema = z.object({
  id: z.string(),
  organizationId: z.string(),
  stripeCustomerId: z.string(),
  stripeSubscriptionId: z.string().nullable(),
  stripePriceId: z.string().nullable(),
  status: SubscriptionStatusSchema,
  trialEndsAt: z.string().datetime({ offset: true }).nullable(),
  currentPeriodEnd: z.string().datetime({ offset: true }).nullable(),
  seatLimit: z.number().int().positive(),
  cancelAtPeriodEnd: z.boolean(),
  createdAt: z.string().datetime({ offset: true }),
  updatedAt: z.string().datetime({ offset: true }),
})

export type Subscription = z.infer<typeof SubscriptionSchema>
export type SubscriptionStatus = z.infer<typeof SubscriptionStatusSchema>
