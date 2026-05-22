/**
 * Integration tests — billing router
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest"
import { prisma } from "@/lib/prisma"
import { createTestCaller } from "./helpers"
import { TRPCError } from "@trpc/server"

const ORG_ACTIVE = "integration-billing-active"
const ORG_SUSPENDED = "integration-billing-suspended"

beforeAll(async () => {
  for (const id of [ORG_ACTIVE, ORG_SUSPENDED]) {
    await prisma.organization.upsert({
      where: { id },
      update: {},
      create: { id, name: `Billing Org ${id}`, slug: `billing-${id}`, status: "active" },
    })
  }

  await prisma.subscription.upsert({
    where: { organizationId: ORG_ACTIVE },
    update: { status: "active", seatLimit: 3 },
    create: {
      organizationId: ORG_ACTIVE,
      stripeCustomerId: `cus_${ORG_ACTIVE}`,
      stripeSubscriptionId: `sub_${ORG_ACTIVE}`,
      stripePriceId: "price_starter_monthly",
      status: "active",
      seatLimit: 3,
      currentPeriodEnd: new Date(Date.now() + 30 * 86_400_000),
    },
  })

  await prisma.subscription.upsert({
    where: { organizationId: ORG_SUSPENDED },
    update: { status: "suspended" },
    create: {
      organizationId: ORG_SUSPENDED,
      stripeCustomerId: `cus_${ORG_SUSPENDED}`,
      stripeSubscriptionId: `sub_${ORG_SUSPENDED}`,
      stripePriceId: "price_starter_monthly",
      status: "suspended",
      seatLimit: 3,
      currentPeriodEnd: new Date(Date.now() + 30 * 86_400_000),
    },
  })
})

afterAll(async () => {
  await prisma.user.deleteMany({ where: { organizationId: { in: [ORG_ACTIVE, ORG_SUSPENDED] } } })
  await prisma.subscription.deleteMany({ where: { organizationId: { in: [ORG_ACTIVE, ORG_SUSPENDED] } } })
  await prisma.organization.deleteMany({ where: { id: { in: [ORG_ACTIVE, ORG_SUSPENDED] } } })
  await prisma.$disconnect()
})

describe("billing router", () => {
  it("getSubscription returns subscription for active org", async () => {
    const caller = await createTestCaller({ role: "manager", orgId: ORG_ACTIVE })
    const sub = await caller.billing.getSubscription()
    expect(sub).not.toBeNull()
    expect(sub?.status).toBe("active")
  })

  it("getPlans returns plan config", async () => {
    const caller = await createTestCaller({ role: "manager", orgId: ORG_ACTIVE })
    const plans = await caller.billing.getPlans()
    const keys = plans.map((p) => p.key)
    expect(keys).toContain("starter")
    expect(keys).toContain("growth")
    expect(keys).toContain("pro")
  })

  it("suspended org throws SUBSCRIPTION_INACTIVE on orgProcedure endpoints", async () => {
    const caller = await createTestCaller({ role: "manager", orgId: ORG_SUSPENDED })
    try {
      await caller.events.getAll({})
      throw new Error("Expected FORBIDDEN")
    } catch (err) {
      expect(err instanceof TRPCError || (err as Error).message.includes("SUBSCRIPTION_INACTIVE")).toBe(true)
    }
  })

  it("seat limit blocks user creation when at cap", async () => {
    // Fill seats to the limit (3) for ORG_ACTIVE
    const existingCount = await prisma.user.count({
      where: { organizationId: ORG_ACTIVE, isActive: true },
    })
    const seatLimit = 3

    // Create users up to the limit
    const usersToCreate = seatLimit - existingCount
    for (let i = 0; i < usersToCreate; i++) {
      await prisma.user.create({
        data: {
          name: `Seat User ${i}`,
          email: `seat-user-${i}-${Date.now()}@test.com`,
          password: "hashed",
          role: "musician",
          isActive: true,
          organizationId: ORG_ACTIVE,
        },
      })
    }

    const caller = await createTestCaller({ role: "manager", orgId: ORG_ACTIVE })
    try {
      await caller.admin.createUser({
        name: "Over Limit User",
        email: `over-limit-${Date.now()}@test.com`,
        password: "password123",
        role: "musician",
      })
      throw new Error("Expected SEAT_LIMIT_REACHED error")
    } catch (err) {
      const message = (err as Error).message
      expect(message).toContain("SEAT_LIMIT_REACHED")
    }
  })
})
