/**
 * Integration tests — bands router
 * Requires a running database (DATABASE_URL env var).
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest"
import { prisma } from "@/lib/prisma"
import { createTestCaller } from "./helpers"

const ORG_ID = "integration-bands-org"
const ORG_SLUG = "integration-bands"

let musician1Id: string
let musician2Id: string

beforeAll(async () => {
  await prisma.organization.upsert({
    where: { id: ORG_ID },
    update: {},
    create: { id: ORG_ID, name: "Bands Integration Org", slug: ORG_SLUG, status: "active" },
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

  // Create two musicians linked to the org
  const m1 = await prisma.musician.create({
    data: {
      name: "Band Test Musician 1",
      email: `band-m1-${Date.now()}@test.com`,
      phone: "1000000001",
      instruments: ["Guitar"],
      styles: ["Jazz"],
      pricePerSet: 800,
      isActive: true,
    },
  })
  const m2 = await prisma.musician.create({
    data: {
      name: "Band Test Musician 2",
      email: `band-m2-${Date.now()}@test.com`,
      phone: "1000000002",
      instruments: ["Bass"],
      styles: ["Jazz"],
      pricePerSet: 700,
      isActive: true,
    },
  })
  musician1Id = m1.id
  musician2Id = m2.id

  await prisma.musicianOrganization.createMany({
    data: [
      { musicianId: musician1Id, organizationId: ORG_ID },
      { musicianId: musician2Id, organizationId: ORG_ID },
    ],
  })
})

afterAll(async () => {
  await prisma.bandOrganization.deleteMany({ where: { organizationId: ORG_ID } })
  await prisma.bandMember.deleteMany({ where: { musicianId: { in: [musician1Id, musician2Id] } } })
  await prisma.musicianOrganization.deleteMany({ where: { organizationId: ORG_ID } })
  await prisma.musician.deleteMany({ where: { id: { in: [musician1Id, musician2Id] } } })
  await prisma.subscription.deleteMany({ where: { organizationId: ORG_ID } })
  await prisma.organization.deleteMany({ where: { id: ORG_ID } })
  await prisma.$disconnect()
})

describe("bands router", () => {
  it("create band with pricePerSet", async () => {
    const caller = await createTestCaller({ role: "manager", orgId: ORG_ID })

    const band = await caller.bands.create({
      name: "Test Jazz Band",
      genre: "Jazz",
      pricePerSet: 2000,
      isActive: true,
      memberIds: [musician1Id, musician2Id],
    })

    expect(band.name).toBe("Test Jazz Band")
    expect(band.pricePerSet).toBe(2000)
    expect(band.members).toHaveLength(2)
  })

  it("update band pricePerSet", async () => {
    const caller = await createTestCaller({ role: "manager", orgId: ORG_ID })

    const band = await caller.bands.create({
      name: "Updatable Band",
      isActive: true,
      memberIds: [musician1Id, musician2Id],
    })

    expect(band.pricePerSet).toBeUndefined()

    const updated = await caller.bands.update({
      id: band.id,
      pricePerSet: 1500,
    })

    expect(updated.pricePerSet).toBe(1500)
  })

  it("clear band pricePerSet by setting null", async () => {
    const caller = await createTestCaller({ role: "manager", orgId: ORG_ID })

    const band = await caller.bands.create({
      name: "Nullable Rate Band",
      pricePerSet: 1200,
      isActive: true,
      memberIds: [musician1Id, musician2Id],
    })

    const cleared = await caller.bands.update({
      id: band.id,
      pricePerSet: null,
    })

    expect(cleared.pricePerSet).toBeUndefined()
  })
})
