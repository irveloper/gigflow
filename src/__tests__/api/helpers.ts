/**
 * Integration test helpers — shared context factory for tRPC callers.
 *
 * Usage:
 *   const caller = createTestCaller({ role: "manager", orgId: "org-1" })
 *   const result = await caller.events.getAll({})
 */
import { prisma } from "@/lib/prisma"
import { appRouter } from "@/server/routers/index"
import { createCallerFactory } from "@/server/trpc"
import type { Session } from "next-auth"
import type { NextRequest } from "next/server"

type Role = "manager" | "musician" | "hotel" | "superadmin"

interface TestContextOptions {
  role: Role
  orgId?: string | null
  orgSlug?: string
  subscriptionStatus?: "active" | "trialing" | "past_due" | "suspended" | "canceled"
  userId?: string
  emailVerified?: boolean
}

function buildSession(opts: TestContextOptions): Session {
  const {
    role,
    orgId = null,
    orgSlug = "test-org",
    userId = `user-${role}`,
    emailVerified = true,
  } = opts

  return {
    user: {
      id: userId,
      name: "Test User",
      email: `${role}@test.com`,
      role,
      isActive: true,
      emailVerified: emailVerified as unknown as boolean & Date,
      phone: undefined,
      instruments: [],
      styles: [],
      hourlyRate: undefined,
      location: undefined,
      contactPerson: undefined,
      hotelId: undefined,
      createdAt: new Date().toISOString(),
      organizationId: orgId ?? undefined,
      organizationSlug: orgId ? orgSlug : undefined,
      musicianId: undefined,
    },
    expires: new Date(Date.now() + 86_400_000).toISOString(),
  }
}

const callerFactory = createCallerFactory(appRouter)

/**
 * Returns a tRPC caller with a fake session.
 * If `subscriptionStatus` is provided, ensures a subscription row exists in the DB before returning.
 */
export async function createTestCaller(opts: TestContextOptions) {
  const session = buildSession(opts)

  // If a specific subscription status is needed, upsert it in the test DB
  if (opts.orgId && opts.subscriptionStatus && opts.subscriptionStatus !== "active") {
    await prisma.subscription.upsert({
      where: { organizationId: opts.orgId },
      update: { status: opts.subscriptionStatus },
      create: {
        organizationId: opts.orgId,
        stripeCustomerId: `cus_test_${opts.orgId}`,
        stripeSubscriptionId: `sub_test_${opts.orgId}`,
        stripePriceId: "price_starter_monthly",
        status: opts.subscriptionStatus,
        seatLimit: 3,
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 30 * 86_400_000),
      },
    })
  }

  return callerFactory({
    req: {} as NextRequest,
    prisma,
    session,
    organizationId: opts.orgId ?? null,
  })
}
