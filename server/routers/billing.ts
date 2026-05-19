import { z } from "zod"
import { TRPCError } from "@trpc/server"
import { router, managerProcedure, orgProcedure } from "@/server/trpc"
import { stripe, PLANS, seatLimitForPrice } from "@/lib/stripe"
import { env } from "@/lib/env"
import type { Subscription } from "@/shared/types"

function mapSubscription(s: {
  id: string
  organizationId: string
  stripeCustomerId: string
  stripeSubscriptionId: string | null
  stripePriceId: string | null
  status: string
  trialEndsAt: Date | null
  currentPeriodEnd: Date | null
  seatLimit: number
  cancelAtPeriodEnd: boolean
  createdAt: Date
  updatedAt: Date
}): Subscription {
  return {
    id: s.id,
    organizationId: s.organizationId,
    stripeCustomerId: s.stripeCustomerId,
    stripeSubscriptionId: s.stripeSubscriptionId,
    stripePriceId: s.stripePriceId,
    status: s.status as Subscription["status"],
    trialEndsAt: s.trialEndsAt?.toISOString() ?? null,
    currentPeriodEnd: s.currentPeriodEnd?.toISOString() ?? null,
    seatLimit: s.seatLimit,
    cancelAtPeriodEnd: s.cancelAtPeriodEnd,
    createdAt: s.createdAt.toISOString(),
    updatedAt: s.updatedAt.toISOString(),
  }
}

export const billingRouter = router({
  /**
   * Returns the current subscription for the caller's org.
   * Used by billing settings page and post-checkout polling.
   */
  getSubscription: orgProcedure.query(async ({ ctx }) => {
    if (!ctx.organizationId) {
      throw new TRPCError({ code: "NOT_FOUND", message: "No organization context" })
    }
    const sub = await ctx.prisma.subscription.findUnique({
      where: { organizationId: ctx.organizationId },
    })
    if (!sub) throw new TRPCError({ code: "NOT_FOUND", message: "No subscription found" })
    return mapSubscription(sub)
  }),

  /**
   * Creates a Stripe Checkout Session for a new subscription.
   * Called from the onboarding plan selector or upgrade flow.
   */
  createCheckoutSession: managerProcedure
    .input(
      z.object({
        priceId: z.string(),
        orgName: z.string().min(1),
        orgSlug: z.string().min(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id
      const baseUrl = env.NEXTAUTH_URL

      // Reuse existing Stripe customer if one already exists for this org
      let stripeCustomerId: string | undefined
      if (ctx.organizationId) {
        const existing = await ctx.prisma.subscription.findUnique({
          where: { organizationId: ctx.organizationId },
          select: { stripeCustomerId: true },
        })
        stripeCustomerId = existing?.stripeCustomerId
      }

      if (!stripeCustomerId) {
        const customer = await stripe.customers.create({
          email: ctx.session.user.email ?? undefined,
          name: ctx.session.user.name ?? undefined,
          metadata: { userId, orgSlug: input.orgSlug, orgName: input.orgName },
        })
        stripeCustomerId = customer.id
      }

      const session = await stripe.checkout.sessions.create({
        customer: stripeCustomerId,
        mode: "subscription",
        line_items: [{ price: input.priceId, quantity: 1 }],
        subscription_data: {
          trial_period_days: 7,
          metadata: { orgSlug: input.orgSlug, orgName: input.orgName, userId },
        },
        success_url: `${baseUrl}/onboarding/success?session_id={CHECKOUT_SESSION_ID}&slug=${input.orgSlug}`,
        cancel_url: `${baseUrl}/onboarding/plan`,
        allow_promotion_codes: true,
        metadata: { orgSlug: input.orgSlug, orgName: input.orgName, userId },
      })

      return { url: session.url!, sessionId: session.id, stripeCustomerId }
    }),

  /**
   * Creates a Stripe Customer Portal session so the org owner can manage
   * their plan, payment method, and invoices.
   */
  createPortalSession: managerProcedure.mutation(async ({ ctx }) => {
    if (!ctx.organizationId) {
      throw new TRPCError({ code: "FORBIDDEN", message: "No organization context" })
    }
    const sub = await ctx.prisma.subscription.findUnique({
      where: { organizationId: ctx.organizationId },
      select: { stripeCustomerId: true },
    })
    if (!sub) throw new TRPCError({ code: "NOT_FOUND", message: "No subscription found" })

    const session = await stripe.billingPortal.sessions.create({
      customer: sub.stripeCustomerId,
      return_url: `${env.NEXTAUTH_URL}/org/${ctx.session.user.organizationSlug}/settings/billing`,
    })

    return { url: session.url }
  }),

  /**
   * Returns pricing info for all plans — used by plan selector UI.
   * Public-ish: only requires auth, not org context.
   */
  getPlans: managerProcedure.query(() => {
    return Object.entries(PLANS).map(([key, plan]) => ({
      key,
      name: plan.name,
      seatLimit: plan.seatLimit,
      monthlyPriceId: plan.monthly,
      annualPriceId: plan.annual,
    }))
  }),
})
