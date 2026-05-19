/**
 * Integration tests — hotels router
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest"
import { prisma } from "@/lib/prisma"
import { createTestCaller } from "./helpers"

const ORG_ID = "integration-hotels-org"
const ORG_SLUG = "integration-hotels"

beforeAll(async () => {
  await prisma.organization.upsert({
    where: { id: ORG_ID },
    update: {},
    create: { id: ORG_ID, name: "Hotels Integration Org", slug: ORG_SLUG, status: "active" },
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
  const links = await prisma.hotelOrganization.findMany({ where: { organizationId: ORG_ID } })
  await prisma.hotelOrganization.deleteMany({ where: { organizationId: ORG_ID } })
  for (const link of links) {
    const remaining = await prisma.hotelOrganization.count({ where: { hotelId: link.hotelId } })
    if (remaining === 0) {
      await prisma.hotel.deleteMany({ where: { id: link.hotelId } })
    }
  }
  await prisma.subscription.deleteMany({ where: { organizationId: ORG_ID } })
  await prisma.organization.deleteMany({ where: { id: ORG_ID } })
  await prisma.$disconnect()
})

describe("hotels router", () => {
  it("getAll returns paginated hotels", async () => {
    const caller = await createTestCaller({ role: "manager", orgId: ORG_ID })
    const result = await caller.hotels.getAll({})
    expect(result).toHaveProperty("items")
    expect(result).toHaveProperty("total")
  })

  it("create hotel", async () => {
    const caller = await createTestCaller({ role: "manager", orgId: ORG_ID })
    const hotel = await caller.hotels.create({
      name: "Integration Hotel",
      email: `hotel-int-${Date.now()}@test.com`,
      phone: "+52 998 000 0010",
      location: "Cancún",
      contactPerson: "Test Person",
      isActive: true,
    })
    expect(hotel.id).toBeTruthy()
    expect(hotel.name).toBe("Integration Hotel")
  })

  it("update hotel", async () => {
    const caller = await createTestCaller({ role: "manager", orgId: ORG_ID })
    const hotel = await caller.hotels.create({
      name: "Update Hotel",
      email: `hotel-upd-${Date.now()}@test.com`,
      phone: "+52 998 000 0011",
      location: "Cancún",
      contactPerson: "Contact",
      isActive: true,
    })
    const updated = await caller.hotels.update({ ...hotel, contactPerson: "New Contact" })
    expect(updated.contactPerson).toBe("New Contact")
  })

  it("delete hotel", async () => {
    const caller = await createTestCaller({ role: "manager", orgId: ORG_ID })
    const hotel = await caller.hotels.create({
      name: "Delete Hotel",
      email: `hotel-del-${Date.now()}@test.com`,
      phone: "+52 998 000 0012",
      location: "Cancún",
      contactPerson: "Contact",
      isActive: true,
    })
    await caller.hotels.delete({ id: hotel.id })
    const after = await caller.hotels.getAll({})
    expect(after.items.find((h) => h.id === hotel.id)).toBeUndefined()
  })

  it("rejects unauthenticated access", async () => {
    const { appRouter } = await import("@/server/routers/index")
    const { createCallerFactory } = await import("@/server/trpc")
    const factory = createCallerFactory(appRouter)
    const caller = factory({
      req: {} as Parameters<typeof factory>[0]["req"],
      prisma,
      session: null,
      organizationId: null,
    })
    await expect(caller.hotels.getAll({})).rejects.toThrow()
  })
})
