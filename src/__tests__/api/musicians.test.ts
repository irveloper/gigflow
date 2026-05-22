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
      instruments: ["Guitar"],
      styles: ["Jazz"],
      pricePerSet: 500,
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
      instruments: ["Guitar"],
      styles: ["Rock"],
      pricePerSet: 600,
      isActive: true,
    })
    const updated = await caller.musicians.update({ ...musician, pricePerSet: 700 })
    expect(updated.pricePerSet).toBe(700)
  })

  it("delete musician", async () => {
    const caller = await createTestCaller({ role: "manager", orgId: ORG_ID })
    const musician = await caller.musicians.create({
      name: "Delete Musician",
      email: `musician-del-${Date.now()}@test.com`,
      phone: "+52 998 000 0003",
      instruments: ["Guitar"],
      styles: ["Jazz"],
      pricePerSet: 400,
      isActive: true,
    })
    await caller.musicians.delete({ id: musician.id })
    const after = await caller.musicians.getAll({})
    expect(after.items.find((m) => m.id === musician.id)).toBeUndefined()
  })

  it("rejects duplicate email connected to same org", async () => {
    const caller = await createTestCaller({ role: "manager", orgId: ORG_ID })
    const email = `musician-dup-${Date.now()}@test.com`
    await caller.musicians.create({
      name: "Original Musician",
      email,
      phone: "+52 998 000 0004",
      instruments: ["Guitar"],
      styles: ["Jazz"],
      pricePerSet: 400,
      isActive: true,
    })

    await expect(
      caller.musicians.create({
        name: "Duplicate Musician",
        email,
        phone: "+52 998 000 0005",
        instruments: ["Piano"],
        styles: ["Blues"],
        pricePerSet: 500,
        isActive: true,
      })
    ).rejects.toThrowError("Este correo electrónico ya está registrado y conectado a tu organización.")
  })

  it("rejects duplicate email registered in system but not connected to current org", async () => {
    const caller1 = await createTestCaller({ role: "manager", orgId: ORG_ID })
    const OTHER_ORG_ID = "other-org-id"
    await prisma.organization.upsert({
      where: { id: OTHER_ORG_ID },
      update: {},
      create: { id: OTHER_ORG_ID, name: "Other Org", slug: "other-org", status: "active" },
    })
    const caller2 = await createTestCaller({ role: "manager", orgId: OTHER_ORG_ID })

    const email = `musician-other-${Date.now()}@test.com`
    await caller1.musicians.create({
      name: "Musician in Org 1",
      email,
      phone: "+52 998 000 0006",
      instruments: ["Guitar"],
      styles: ["Jazz"],
      pricePerSet: 400,
      isActive: true,
    })

    await expect(
      caller2.musicians.create({
        name: "Musician in Org 2",
        email,
        phone: "+52 998 000 0007",
        instruments: ["Piano"],
        styles: ["Blues"],
        pricePerSet: 500,
        isActive: true,
      })
    ).rejects.toThrowError("Este correo electrónico ya está registrado en el sistema. Puedes buscar al músico por su nombre para conectarlo.")

    // Clean up other org
    await prisma.musicianOrganization.deleteMany({ where: { organizationId: OTHER_ORG_ID } })
    await prisma.organization.delete({ where: { id: OTHER_ORG_ID } })
  })

  it("rejects update to email already taken by another musician", async () => {
    const caller = await createTestCaller({ role: "manager", orgId: ORG_ID })
    const email1 = `musician-u1-${Date.now()}@test.com`
    const email2 = `musician-u2-${Date.now()}@test.com`

    const m1 = await caller.musicians.create({
      name: "Musician 1",
      email: email1,
      phone: "+52 998 000 0008",
      instruments: ["Guitar"],
      styles: ["Jazz"],
      pricePerSet: 400,
      isActive: true,
    })

    const m2 = await caller.musicians.create({
      name: "Musician 2",
      email: email2,
      phone: "+52 998 000 0009",
      instruments: ["Piano"],
      styles: ["Blues"],
      pricePerSet: 500,
      isActive: true,
    })

    await expect(
      caller.musicians.update({
        ...m2,
        email: email1,
      })
    ).rejects.toThrowError("Este correo electrónico ya está registrado para otro músico.")
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
