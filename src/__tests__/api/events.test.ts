/**
 * Integration tests — events router
 * Requires a running database (DATABASE_URL env var).
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest"
import { prisma } from "@/lib/prisma"
import { createTestCaller } from "./helpers"
import type { NextRequest } from "next/server"

const ORG_ID = "integration-events-org"
const ORG_SLUG = "integration-events"

beforeAll(async () => {
  // Ensure a clean org + subscription for these tests
  await prisma.organization.upsert({
    where: { id: ORG_ID },
    update: {},
    create: { id: ORG_ID, name: "Events Integration Org", slug: ORG_SLUG, status: "active" },
  })
  await prisma.subscription.upsert({
    where: { organizationId: ORG_ID },
    update: { status: "active" },
    create: {
      organizationId: ORG_ID,
      stripeCustomerId: `cus_test_${ORG_ID}`,
      stripeSubscriptionId: `sub_test_${ORG_ID}`,
      stripePriceId: "price_starter_monthly",
      status: "active",
      seatLimit: 10,
      currentPeriodStart: new Date(),
      currentPeriodEnd: new Date(Date.now() + 30 * 86_400_000),
    },
  })
})

afterAll(async () => {
  await prisma.event.deleteMany({ where: { organizationId: ORG_ID } })
  await prisma.subscription.deleteMany({ where: { organizationId: ORG_ID } })
  await prisma.organization.deleteMany({ where: { id: ORG_ID } })
  await prisma.$disconnect()
})

describe("events router", () => {
  it("getAll returns paginated events for org", async () => {
    const caller = await createTestCaller({ role: "manager", orgId: ORG_ID })
    const result = await caller.events.getAll({})
    expect(result).toHaveProperty("items")
    expect(result).toHaveProperty("total")
    expect(result).toHaveProperty("nextCursor")
    expect(Array.isArray(result.items)).toBe(true)
  })

  it("create + getById round trip", async () => {
    const caller = await createTestCaller({ role: "manager", orgId: ORG_ID })
    const created = await caller.events.create({
      title: "Integration Test Event",
      date: "2026-12-01",
      time: "20:00",
      durationMinutes: 90,
      hotel: "Test Hotel",
      status: "scheduled",
    })
    expect(created.id).toBeTruthy()

    const found = await caller.events.getById({ id: created.id })
    expect(found.title).toBe("Integration Test Event")
  })

  it("update event", async () => {
    const caller = await createTestCaller({ role: "manager", orgId: ORG_ID })
    const created = await caller.events.create({
      title: "Update Me",
      date: "2026-12-02",
      time: "19:00",
      durationMinutes: 60,
      hotel: "Hotel Test",
      status: "scheduled",
    })
    const updated = await caller.events.update({ id: created.id, data: { title: "Updated Title" } })
    expect(updated.title).toBe("Updated Title")
  })

  it("delete event", async () => {
    const caller = await createTestCaller({ role: "manager", orgId: ORG_ID })
    const created = await caller.events.create({
      title: "Delete Me",
      date: "2026-12-03",
      time: "18:00",
      durationMinutes: 45,
      hotel: "Hotel X",
      status: "scheduled",
    })
    await caller.events.delete({ id: created.id })
    await expect(caller.events.getById({ id: created.id })).rejects.toThrow()
  })

  it("rejects wrong-org access on getById", async () => {
    const managerA = await createTestCaller({ role: "manager", orgId: ORG_ID })
    const created = await managerA.events.create({
      title: "Org A Event",
      date: "2026-12-04",
      time: "21:00",
      durationMinutes: 60,
      hotel: "Hotel A",
      status: "scheduled",
    })

    const orgB = "integration-events-org-b"
    await prisma.organization.upsert({
      where: { id: orgB },
      update: {},
      create: { id: orgB, name: "Org B", slug: "integration-events-b", status: "active" },
    })
    await prisma.subscription.upsert({
      where: { organizationId: orgB },
      update: { status: "active" },
      create: {
        organizationId: orgB,
        stripeCustomerId: "cus_b",
        stripeSubscriptionId: "sub_b",
        stripePriceId: "price_starter_monthly",
        status: "active",
        seatLimit: 3,
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 30 * 86_400_000),
      },
    })

    const managerB = await createTestCaller({ role: "manager", orgId: orgB })
    await expect(managerB.events.getById({ id: created.id })).rejects.toThrow()

    // Cleanup
    await prisma.subscription.deleteMany({ where: { organizationId: orgB } })
    await prisma.organization.deleteMany({ where: { id: orgB } })
  })

  it("rejects access from unauthenticated context", async () => {
    const { appRouter } = await import("@/server/routers/index")
    const { createCallerFactory } = await import("@/server/trpc")
    const factory = createCallerFactory(appRouter)
    const caller = factory({
      req: {} as NextRequest,
      prisma,
      session: null,
      organizationId: null,
    })
    await expect(caller.events.getAll({})).rejects.toThrow()
  })
})
