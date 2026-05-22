/**
 * Integration tests — admin router
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest"
import { prisma } from "@/lib/prisma"
import { createTestCaller } from "./helpers"

const ORG_ID = "integration-admin-org"

beforeAll(async () => {
  await prisma.organization.upsert({
    where: { id: ORG_ID },
    update: {},
    create: { id: ORG_ID, name: "Admin Integration Org", slug: "integration-admin", status: "active" },
  })
  await prisma.subscription.upsert({
    where: { organizationId: ORG_ID },
    update: { status: "active", seatLimit: 10 },
    create: {
      organizationId: ORG_ID,
      stripeCustomerId: `cus_${ORG_ID}`,
      stripeSubscriptionId: `sub_${ORG_ID}`,
      stripePriceId: "price_growth_monthly",
      status: "active",
      seatLimit: 10,
      currentPeriodEnd: new Date(Date.now() + 30 * 86_400_000),
    },
  })
})

afterAll(async () => {
  await prisma.user.deleteMany({ where: { organizationId: ORG_ID } })
  await prisma.subscription.deleteMany({ where: { organizationId: ORG_ID } })
  await prisma.organization.deleteMany({ where: { id: ORG_ID } })
  await prisma.$disconnect()
})

describe("admin router", () => {
  it("listUsers returns paginated users", async () => {
    const caller = await createTestCaller({ role: "manager", orgId: ORG_ID })
    const result = await caller.admin.listUsers({})
    expect(result).toHaveProperty("items")
    expect(result).toHaveProperty("total")
    expect(Array.isArray(result.items)).toBe(true)
  })

  it("createUser adds user to org", async () => {
    const caller = await createTestCaller({ role: "manager", orgId: ORG_ID })
    const user = await caller.admin.createUser({
      name: "Integration User",
      email: `admin-test-${Date.now()}@test.com`,
      password: "password123",
      role: "musician",
    })
    expect(user.id).toBeTruthy()
    expect(user.name).toBe("Integration User")
  })

  it("deactivateUser marks user inactive", async () => {
    const caller = await createTestCaller({ role: "manager", orgId: ORG_ID, userId: "manager-admin-int" })
    const created = await caller.admin.createUser({
      name: "Deactivate Me",
      email: `deactivate-${Date.now()}@test.com`,
      password: "password123",
      role: "musician",
    })
    await caller.admin.deactivateUser({ id: created.id })
    const after = await prisma.user.findUnique({ where: { id: created.id } })
    expect(after?.isActive).toBe(false)
  })

  it("musician role cannot access admin.createUser", async () => {
    const caller = await createTestCaller({ role: "musician", orgId: ORG_ID })
    await expect(
      caller.admin.createUser({
        name: "Hacker",
        email: `hacker-${Date.now()}@test.com`,
        password: "password123",
        role: "musician",
      })
    ).rejects.toThrow()
  })
})
