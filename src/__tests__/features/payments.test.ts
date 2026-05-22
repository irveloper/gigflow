/**
 * Payments feature tests — derived from specs/features/payments.scenarios.ts
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest"
import { prisma } from "@/lib/prisma"
import { createTestCaller } from "../api/helpers"

const ORG_ID = "integration-payments-org"
const ORG_SLUG = "integration-payments"

beforeAll(async () => {
  await prisma.organization.upsert({
    where: { id: ORG_ID },
    update: {},
    create: { id: ORG_ID, name: "Payments Integration Org", slug: ORG_SLUG, status: "active" },
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
  await prisma.eventAuditLog.deleteMany({ where: { organizationId: ORG_ID } })
  await prisma.event.deleteMany({ where: { organizationId: ORG_ID } })
  await prisma.subscription.deleteMany({ where: { organizationId: ORG_ID } })
  await prisma.organization.deleteMany({ where: { id: ORG_ID } })
  await prisma.$disconnect()
})

describe("payments feature", () => {
  describe("defaultStatus", () => {
    it("new event defaults to pending payment status", async () => {
      const caller = await createTestCaller({ role: "manager", orgId: ORG_ID })
      const event = await caller.events.create({
        title: "Default Pending Event",
        date: "2026-12-01",
        time: "20:00",
        sets: 2,
        hotel: "Test Hotel",
        status: "scheduled",
      })

      expect(event.paymentStatus).toBe("pending")
      expect(event.paymentNotes).toBeNull()

      // Verify DB default
      const dbEvent = await prisma.event.findUnique({ where: { id: event.id } })
      expect(dbEvent?.paymentStatus).toBe("pending")
      expect(dbEvent?.paymentNotes).toBeNull()
    })
  })

  describe("markPaid", () => {
    it("manager marks a pending event as paid", async () => {
      const caller = await createTestCaller({ role: "manager", orgId: ORG_ID })
      const event = await caller.events.create({
        title: "Event to pay",
        date: "2026-12-02",
        time: "20:00",
        sets: 2,
        hotel: "Test Hotel",
        status: "scheduled",
      })

      const notes = "Paid via SPEI ref 12345"
      const updated = await caller.events.updatePaymentStatus({
        eventId: event.id,
        paymentStatus: "paid",
        paymentNotes: notes,
      })

      expect(updated.paymentStatus).toBe("paid")
      expect(updated.paymentNotes).toBe(notes)

      // Verify audit log
      const auditLogs = await prisma.eventAuditLog.findMany({
        where: { eventId: event.id, action: "PAYMENT_STATUS_CHANGED" },
      })
      expect(auditLogs).toHaveLength(1)
      const metadata = auditLogs[0].metadata as any
      expect(metadata.from).toBe("pending")
      expect(metadata.to).toBe("paid")
      expect(metadata.notes).toBe(notes)
    })

    it("manager reverts a paid event to pending", async () => {
      const caller = await createTestCaller({ role: "manager", orgId: ORG_ID })
      const event = await caller.events.create({
        title: "Event to revert",
        date: "2026-12-03",
        time: "20:00",
        sets: 2,
        hotel: "Test Hotel",
        status: "scheduled",
      })

      // Mark paid first
      await caller.events.updatePaymentStatus({
        eventId: event.id,
        paymentStatus: "paid",
        paymentNotes: "notes to clear",
      })

      // Revert to pending
      const updated = await caller.events.updatePaymentStatus({
        eventId: event.id,
        paymentStatus: "pending",
      })

      expect(updated.paymentStatus).toBe("pending")
      expect(updated.paymentNotes).toBeNull()

      // Verify audit log has the reverted entry
      const auditLogs = await prisma.eventAuditLog.findMany({
        where: { eventId: event.id, action: "PAYMENT_STATUS_CHANGED" },
        orderBy: { timestamp: "desc" },
      })
      // Should have 2 payment changes: pending -> paid, paid -> pending
      expect(auditLogs.length).toBeGreaterThanOrEqual(2)
      const latestMetadata = auditLogs[0].metadata as any
      expect(latestMetadata.from).toBe("paid")
      expect(latestMetadata.to).toBe("pending")
      expect(latestMetadata.notes).toBeNull()
    })

    it("non-manager cannot change payment status", async () => {
      const managerCaller = await createTestCaller({ role: "manager", orgId: ORG_ID })
      const event = await managerCaller.events.create({
        title: "Event for music restriction",
        date: "2026-12-04",
        time: "20:00",
        sets: 2,
        hotel: "Test Hotel",
        status: "scheduled",
      })

      const musicianCaller = await createTestCaller({ role: "musician", orgId: ORG_ID })
      await expect(
        musicianCaller.events.updatePaymentStatus({
          eventId: event.id,
          paymentStatus: "paid",
        })
      ).rejects.toThrow()

      // Assert status remains unchanged
      const dbEvent = await prisma.event.findUnique({ where: { id: event.id } })
      expect(dbEvent?.paymentStatus).toBe("pending")
    })
  })

  describe("paymentsQuery", () => {
    it("payments query excludes cancelled events", async () => {
      const caller = await createTestCaller({ role: "manager", orgId: ORG_ID })
      
      const event1 = await caller.events.create({
        title: "Active Event",
        date: "2026-06-01",
        time: "20:00",
        sets: 2,
        hotel: "Test Hotel",
        status: "scheduled",
      })

      const event2 = await caller.events.create({
        title: "Cancelled Event",
        date: "2026-06-02",
        time: "20:00",
        sets: 2,
        hotel: "Test Hotel",
        status: "cancelled",
      })

      const report = await caller.reports.payments({
        from: "2026-06-01",
        to: "2026-06-05",
      })

      const eventIds = report.events.map(e => e.id)
      expect(eventIds).toContain(event1.id)
      expect(eventIds).not.toContain(event2.id)
    })

    it("null-price events appear in list but are excluded from totals", async () => {
      const caller = await createTestCaller({ role: "manager", orgId: ORG_ID })

      // Event without performer has price = null
      const nullPriceEvent = await caller.events.create({
        title: "Null Price Event",
        date: "2026-07-01",
        time: "20:00",
        sets: 2,
        hotel: "Test Hotel",
        status: "scheduled",
      })

      // We need a priced event. Let's create a musician with pricePerSet
      const musician = await prisma.musician.create({
        data: {
          name: "Paid Musician",
          email: `paid-musician-${Date.now()}@test.com`,
          phone: "0000000000",
          instruments: ["Piano"],
          styles: ["Classical"],
          pricePerSet: 500,
          isActive: true,
        }
      })
      await prisma.musicianOrganization.create({
        data: { musicianId: musician.id, organizationId: ORG_ID }
      })

      const pricedEvent = await caller.events.create({
        title: "Priced Event",
        date: "2026-07-02",
        time: "20:00",
        sets: 2,
        hotel: "Test Hotel",
        status: "scheduled",
        musicianId: musician.id,
        musician: musician.name,
      })

      const report = await caller.reports.payments({
        from: "2026-07-01",
        to: "2026-07-05",
      })

      const eventIds = report.events.map(e => e.id)
      expect(eventIds).toContain(nullPriceEvent.id)
      expect(eventIds).toContain(pricedEvent.id)

      // pricedEvent price is 500 * 2 = 1000. nullPriceEvent has price = null.
      // pendingTotal should be 1000.
      expect(report.pendingTotal).toBe(1000)
      expect(report.paidTotal).toBe(0)

      // Cleanup musician
      await prisma.musicianOrganization.deleteMany({ where: { musicianId: musician.id } })
      await prisma.musician.delete({ where: { id: musician.id } })
    })

    it("pendingTotal and paidTotal are calculated correctly", async () => {
      const caller = await createTestCaller({ role: "manager", orgId: ORG_ID })

      const musician = await prisma.musician.create({
        data: {
          name: "Calc Musician",
          email: `calc-musician-${Date.now()}@test.com`,
          phone: "0000000000",
          instruments: ["Piano"],
          styles: ["Classical"],
          pricePerSet: 800,
          isActive: true,
        }
      })
      await prisma.musicianOrganization.create({
        data: { musicianId: musician.id, organizationId: ORG_ID }
      })

      // Pending event: price 800
      const pendingEvent = await caller.events.create({
        title: "Pending Event",
        date: "2026-08-01",
        time: "20:00",
        sets: 1,
        hotel: "Hotel A",
        status: "scheduled",
        musicianId: musician.id,
        musician: musician.name,
      })

      // Paid event: price 1600
      const paidEvent = await caller.events.create({
        title: "Paid Event",
        date: "2026-08-02",
        time: "20:00",
        sets: 2,
        hotel: "Hotel B",
        status: "scheduled",
        musicianId: musician.id,
        musician: musician.name,
      })
      await caller.events.updatePaymentStatus({
        eventId: paidEvent.id,
        paymentStatus: "paid",
      })

      const report = await caller.reports.payments({
        from: "2026-08-01",
        to: "2026-08-05",
      })

      expect(report.pendingTotal).toBe(800)
      expect(report.paidTotal).toBe(1600)

      // Cleanup
      await prisma.musicianOrganization.deleteMany({ where: { musicianId: musician.id } })
      await prisma.musician.delete({ where: { id: musician.id } })
    })
  })

  describe("overdueIndicator", () => {
    it("pending event with past date is present in list (UI derives vencido)", async () => {
      const caller = await createTestCaller({ role: "manager", orgId: ORG_ID })
      
      const event = await caller.events.create({
        title: "Past Event",
        date: "2026-01-01",
        time: "20:00",
        sets: 1,
        hotel: "Hotel Past",
        status: "scheduled",
      })

      const report = await caller.reports.payments({
        from: "2026-01-01",
        to: "2026-01-02",
      })

      const found = report.events.find(e => e.id === event.id)
      expect(found).toBeDefined()
      expect(found?.paymentStatus).toBe("pending")
      expect(found?.date).toBe("2026-01-01")
    })
  })

  describe("musicianVisibility", () => {
    it("musician can see payment status on their own events (read-only)", async () => {
      const managerCaller = await createTestCaller({ role: "manager", orgId: ORG_ID })
      const event = await managerCaller.events.create({
        title: "Musician Visible Event",
        date: "2026-09-01",
        time: "20:00",
        sets: 2,
        hotel: "Test Hotel",
        status: "scheduled",
      })

      await managerCaller.events.updatePaymentStatus({
        eventId: event.id,
        paymentStatus: "paid",
        paymentNotes: "Shared notes",
      })

      const musicianCaller = await createTestCaller({ role: "musician", orgId: ORG_ID })
      const report = await musicianCaller.reports.payments({
        from: "2026-09-01",
        to: "2026-09-02",
      })

      const found = report.events.find(e => e.id === event.id)
      expect(found).toBeDefined()
      expect(found?.paymentStatus).toBe("paid")
      expect(found?.paymentNotes).toBe("Shared notes")
    })
  })
})
