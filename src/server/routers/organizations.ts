import { z } from "zod"
import { TRPCError } from "@trpc/server"
import { router, protectedProcedure, orgProcedure, superAdminProcedure } from "@/server/trpc"
import {
  CreateOrganizationInputSchema,
  UpdateOrganizationInputSchema,
} from "@/entities/organization/schema"
import { stripe, } from "@/lib/stripe"
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
   * Initiates org creation via Stripe Checkout.
   * The org is NOT created here — the webhook handler creates it after payment.
   * Returns a Stripe Checkout URL; client redirects to it.
   */
  initiateCheckout: protectedProcedure
    .input(
      CreateOrganizationInputSchema.extend({
        priceId: z.string().min(1, "Price ID is required"),
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

      const customer = await stripe.customers.create({
        email: ctx.session.user.email ?? undefined,
        name: ctx.session.user.name ?? undefined,
        metadata: { userId, orgSlug: input.slug, orgName: input.name },
      })

      const session = await stripe.checkout.sessions.create({
        customer: customer.id,
        mode: "subscription",
        line_items: [{ price: input.priceId, quantity: 1 }],
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
