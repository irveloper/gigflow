import { z } from "zod"
import { TRPCError } from "@trpc/server"
import { router, protectedProcedure, orgProcedure, superAdminProcedure } from "@/server/trpc"
import {
  CreateOrganizationInputSchema,
  UpdateOrganizationInputSchema,
} from "@/entities/organization/schema"
import { stripe, PLANS, seatLimitForPrice, type PlanKey } from "@/lib/stripe"
import { env } from "@/lib/env"
import type { Organization } from "@/shared/types"

function mapOrg(o: {
  id: string
  name: string
  slug: string
  status: string
  createdAt: Date
  updatedAt: Date
}): Organization {
  return {
    id: o.id,
    name: o.name,
    slug: o.slug,
    status: o.status as Organization["status"],
    createdAt: o.createdAt.toISOString(),
    updatedAt: o.updatedAt.toISOString(),
  }
}

export const organizationsRouter = router({
  /** Check if a slug is available. */
  checkSlug: protectedProcedure
    .input(z.object({ slug: z.string() }))
    .query(async ({ ctx, input }) => {
      const existing = await ctx.prisma.organization.findUnique({
        where: { slug: input.slug },
      })
      return { available: !existing }
    }),

  /**
   * Initiates org creation via Stripe Checkout or direct skip-payment bypass.
   * If skipPayment is true, creates organization and subscription directly.
   * Otherwise, returns a Stripe Checkout URL; client redirects to it.
   */
  initiateCheckout: protectedProcedure
    .input(
      CreateOrganizationInputSchema.extend({
        priceId: z.string().optional(),
        planKey: z.string().optional(),
        billing: z.string().optional(),
        skipPayment: z.boolean().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id

      const existing = await ctx.prisma.organization.findUnique({
        where: { slug: input.slug },
      })
      if (existing) {
        throw new TRPCError({ code: "CONFLICT", message: "Slug already taken" })
      }

      // Resolve Stripe price ID from planKey and billing if not directly provided
      let priceId = input.priceId
      if (!priceId && input.planKey && input.billing) {
        const plan = PLANS[input.planKey as PlanKey]
        if (plan) {
          priceId = input.billing === "annual" ? plan.annual : plan.monthly
        }
      }

      const seatLimit = priceId ? seatLimitForPrice(priceId) : 3

      // Skip payment flow (mock subscription and create org directly)
      if (input.skipPayment) {
        const org = await ctx.prisma.organization.upsert({
          where: { slug: input.slug },
          update: { status: "active" },
          create: { name: input.name, slug: input.slug, status: "active" },
        })

        const mockCustomerId = `mock-cus-${Math.random().toString(36).substring(7)}`
        const mockSubId = `mock-sub-${Math.random().toString(36).substring(7)}`

        await ctx.prisma.subscription.upsert({
          where: { stripeCustomerId: mockCustomerId },
          update: {
            stripeSubscriptionId: mockSubId,
            stripePriceId: priceId ?? "mock-price",
            status: "active",
            seatLimit,
            currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
          },
          create: {
            organizationId: org.id,
            stripeCustomerId: mockCustomerId,
            stripeSubscriptionId: mockSubId,
            stripePriceId: priceId ?? "mock-price",
            status: "active",
            seatLimit,
            currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          },
        })

        await ctx.prisma.user.update({
          where: { id: userId },
          data: { organizationId: org.id, role: "manager" },
        })

        return {
          url: `/onboarding/success?slug=${input.slug}`,
          sessionId: "mock-session",
        }
      }

      // Standard Stripe Checkout flow
      if (!priceId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Selected plan is not configured. Please contact support or skip payment.",
        })
      }

      const customer = await stripe.customers.create({
        email: ctx.session.user.email ?? undefined,
        name: ctx.session.user.name ?? undefined,
        metadata: { userId, orgSlug: input.slug, orgName: input.name },
      })

      const session = await stripe.checkout.sessions.create({
        customer: customer.id,
        mode: "subscription",
        line_items: [{ price: priceId, quantity: 1 }],
        subscription_data: {
          trial_period_days: 7,
          metadata: { orgSlug: input.slug, orgName: input.name, userId },
        },
        success_url: `${env.NEXTAUTH_URL}/onboarding/success?session_id={CHECKOUT_SESSION_ID}&slug=${input.slug}`,
        cancel_url: `${env.NEXTAUTH_URL}/onboarding/plan`,
        allow_promotion_codes: true,
        metadata: { orgSlug: input.slug, orgName: input.name, userId },
      })

      return { url: session.url!, sessionId: session.id }
    }),

  /** Returns the calling user's organization. */
  getMyOrg: orgProcedure.query(async ({ ctx }) => {
    if (!ctx.organizationId) {
      throw new TRPCError({ code: "NOT_FOUND", message: "No organization context" })
    }
    const org = await ctx.prisma.organization.findUnique({
      where: { id: ctx.organizationId },
    })
    if (!org) throw new TRPCError({ code: "NOT_FOUND" })
    return mapOrg(org)
  }),

  /** Update own org's name or slug. Manager-only. */
  update: orgProcedure
    .input(UpdateOrganizationInputSchema)
    .mutation(async ({ ctx, input }) => {
      if (ctx.session.user.role !== "manager") {
        throw new TRPCError({ code: "FORBIDDEN" })
      }
      if (!ctx.organizationId) {
        throw new TRPCError({ code: "FORBIDDEN" })
      }

      if (input.slug) {
        const conflict = await ctx.prisma.organization.findFirst({
          where: { slug: input.slug, id: { not: ctx.organizationId } },
        })
        if (conflict) {
          throw new TRPCError({ code: "CONFLICT", message: "Slug already taken" })
        }
      }

      const org = await ctx.prisma.organization.update({
        where: { id: ctx.organizationId },
        data: {
          ...(input.name && { name: input.name }),
          ...(input.slug && { slug: input.slug }),
          ...(input.status && { status: input.status }),
        },
      })
      return mapOrg(org)
    }),

  /** Super-admin: get one org's full detail (hotels, musicians, events, users). */
  getOrgDetail: superAdminProcedure
    .input(z.object({ orgId: z.string() }))
    .query(async ({ ctx, input }) => {
      const org = await ctx.prisma.organization.findUnique({
        where: { id: input.orgId },
        include: {
          users: { select: { id: true, name: true, email: true, role: true, isActive: true } },
          events: {
            select: { id: true, name: true, date: true, time: true, status: true },
            orderBy: { date: "asc" },
          },
          hotels: {
            select: {
              hotel: { select: { id: true, name: true, location: true, isActive: true } },
              contactPerson: true,
              contactPhone: true,
            },
          },
          musicians: {
            select: {
              musician: { select: { id: true, name: true, instruments: true, isActive: true } },
            },
          },
        },
      })
      if (!org) throw new TRPCError({ code: "NOT_FOUND" })
      return {
        ...mapOrg(org),
        users: org.users,
        events: org.events.map((e) => ({ ...e })),
        hotels: org.hotels.map((h) => ({
          ...h.hotel,
          contactPerson: h.contactPerson,
          contactPhone: h.contactPhone,
        })),
        musicians: org.musicians.map((m) => m.musician),
      }
    }),

  /** Super-admin: list all orgs with counts. */
  listAll: superAdminProcedure.query(async ({ ctx }) => {
    const orgs = await ctx.prisma.organization.findMany({
      orderBy: { createdAt: "asc" },
      include: {
        _count: {
          select: { users: true, hotels: true, musicians: true, events: true },
        },
      },
    })
    return orgs.map((o) => ({
      ...mapOrg(o),
      counts: o._count,
    }))
  }),
})
