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
      sets: 2,
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
      sets: 1,
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
      sets: 1,
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
      sets: 1,
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
        currentPeriodEnd: new Date(Date.now() + 30 * 86_400_000),
      },
    })

    const managerB = await createTestCaller({ role: "manager", orgId: orgB })
    await expect(managerB.events.getById({ id: created.id })).rejects.toThrow()

    // Cleanup
    await prisma.subscription.deleteMany({ where: { organizationId: orgB } })
    await prisma.organization.deleteMany({ where: { id: orgB } })
  })

  it("auto-calculates price from musician pricePerSet × sets", async () => {
    const caller = await createTestCaller({ role: "manager", orgId: ORG_ID })

    // Create a musician with a pricePerSet
    const musician = await prisma.musician.create({
      data: {
        name: "Pricing Test Musician",
        email: `pricing-test-${Date.now()}@test.com`,
        phone: "0000000000",
        instruments: ["Guitar"],
        styles: ["Jazz"],
        pricePerSet: 1000,
        isActive: true,
      },
    })
    await prisma.musicianOrganization.create({
      data: { musicianId: musician.id, organizationId: ORG_ID },
    })

    const event = await caller.events.create({
      title: "Pricing Test Event",
      date: "2026-12-15",
      time: "20:00",
      sets: 3,
      hotel: "Pricing Hotel",
      status: "scheduled",
      musicianId: musician.id,
      musician: musician.name,
    })

    expect(event.price).toBe(3000) // 1000 × 3

    // Cleanup
    await prisma.musicianOrganization.deleteMany({ where: { musicianId: musician.id } })
    await prisma.musician.delete({ where: { id: musician.id } })
  })

  it("blocks event creation when performer has no pricePerSet", async () => {
    const caller = await createTestCaller({ role: "manager", orgId: ORG_ID })

    // Create a band WITHOUT a pricePerSet (since Band.pricePerSet is nullable in schema and DB)
    const band = await prisma.band.create({
      data: {
        name: "No Rate Band",
        genre: "Jazz",
        pricePerSet: null,
        isActive: true,
      },
    })
    await prisma.bandOrganization.create({
      data: { bandId: band.id, organizationId: ORG_ID },
    })

    await expect(
      caller.events.create({
        title: "No Rate Event",
        date: "2026-12-16",
        time: "20:00",
        sets: 2,
        hotel: "Hotel Y",
        status: "scheduled",
        bandId: band.id,
        band: band.name,
      }),
    ).rejects.toThrow()

    // Cleanup
    await prisma.bandOrganization.deleteMany({ where: { bandId: band.id } })
    await prisma.band.delete({ where: { id: band.id } })
  })

  it("updatePaymentStatus updates event and logs audit log", async () => {
    const caller = await createTestCaller({ role: "manager", orgId: ORG_ID })
    const created = await caller.events.create({
      title: "Audit Test Event",
      date: "2026-12-17",
      time: "20:00",
      sets: 2,
      hotel: "Audit Hotel",
      status: "scheduled",
    })

    const updated = await caller.events.updatePaymentStatus({
      eventId: created.id,
      paymentStatus: "paid",
      paymentNotes: "Paid via bank transfer",
    })

    expect(updated.paymentStatus).toBe("paid")
    expect(updated.paymentNotes).toBe("Paid via bank transfer")

    // Check audit log
    const log = await prisma.eventAuditLog.findFirst({
      where: { eventId: created.id, action: "PAYMENT_STATUS_CHANGED" },
    })
    expect(log).toBeDefined()
    expect((log?.metadata as any)?.to).toBe("paid")

    // Cleanup
    await prisma.eventAuditLog.deleteMany({ where: { eventId: created.id } })
    await prisma.event.delete({ where: { id: created.id } })
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
