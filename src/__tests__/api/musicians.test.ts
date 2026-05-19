/**
 * Integration tests — musicians router
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest"
import { prisma } from "@/lib/prisma"
import { createTestCaller } from "./helpers"
import type { NextRequest } from "next/server"

const ORG_ID = "integration-musicians-org"
const ORG_SLUG = "integration-musicians"

beforeAll(async () => {
  await prisma.organization.upsert({
    where: { id: ORG_ID },
    update: {},
    create: { id: ORG_ID, name: "Musicians Integration Org", slug: ORG_SLUG, status: "active" },
  })
  await prisma.subscription.upsert({
    where: { organizationId: ORG_ID },
    update: { status: "active" },
    create: {
      organizationId: ORG_ID,
      stripeCustomerId: `cus_${ORG_ID}`,
      stripeSubscriptionId: `sub_${ORG_ID}`,
      stripePriceId: "price_starter_monthly",
      status: "active",
      seatLimit: 10,
      currentPeriodStart: new Date(),
      currentPeriodEnd: new Date(Date.now() + 30 * 86_400_000),
    },
  })
})

afterAll(async () => {
  // Unlink musicians first
  const links = await prisma.musicianOrganization.findMany({ where: { organizationId: ORG_ID } })
  await prisma.musicianOrganization.deleteMany({ where: { organizationId: ORG_ID } })
  const remainingCounts = await Promise.all(
    links.map((l) => prisma.musicianOrganization.count({ where: { musicianId: l.musicianId } }))
  )
  for (let i = 0; i < links.length; i++) {
    if (remainingCounts[i] === 0) {
      await prisma.musician.deleteMany({ where: { id: links[i].musicianId } })
    }
  }
  await prisma.subscription.deleteMany({ where: { organizationId: ORG_ID } })
  await prisma.organization.deleteMany({ where: { id: ORG_ID } })
  await prisma.$disconnect()
})

describe("musicians router", () => {
  it("getAll returns paginated musicians", async () => {
    const caller = await createTestCaller({ role: "manager", orgId: ORG_ID })
    const result = await caller.musicians.getAll({})
    expect(result).toHaveProperty("items")
    expect(result).toHaveProperty("total")
  })

  it("create musician", async () => {
    const caller = await createTestCaller({ role: "manager", orgId: ORG_ID })
    const musician = await caller.musicians.create({
      name: "Integration Musician",
      email: `musician-int-${Date.now()}@test.com`,
      phone: "+52 998 000 0001",
      instruments: ["Jazz"],
      styles: [],
      hourlyRate: 500,
      isActive: true,
    })
    expect(musician.id).toBeTruthy()
    expect(musician.name).toBe("Integration Musician")
  })

  it("update musician", async () => {
    const caller = await createTestCaller({ role: "manager", orgId: ORG_ID })
    const musician = await caller.musicians.create({
      name: "Update Musician",
      email: `musician-upd-${Date.now()}@test.com`,
      phone: "+52 998 000 0002",
      instruments: ["Rock"],
      styles: [],
      hourlyRate: 600,
      isActive: true,
    })
    const updated = await caller.musicians.update({ ...musician, hourlyRate: 700 })
    expect(updated.hourlyRate).toBe(700)
  })

  it("delete musician", async () => {
    const caller = await createTestCaller({ role: "manager", orgId: ORG_ID })
    const musician = await caller.musicians.create({
      name: "Delete Musician",
      email: `musician-del-${Date.now()}@test.com`,
      phone: "+52 998 000 0003",
      instruments: [],
      styles: [],
      hourlyRate: 400,
      isActive: true,
    })
    await caller.musicians.delete({ id: musician.id })
    const after = await caller.musicians.getAll({})
    expect(after.items.find((m) => m.id === musician.id)).toBeUndefined()
  })

  it("rejects unauthenticated access", async () => {
    const { appRouter } = await import("@/server/routers/index")
    const { createCallerFactory } = await import("@/server/trpc")
    const factory = createCallerFactory(appRouter)
    const caller = factory({
      req: {} as NextRequest,
      prisma,
      session: null,
      organizationId: null,
    })
    await expect(caller.musicians.getAll({})).rejects.toThrow()
  })
})
