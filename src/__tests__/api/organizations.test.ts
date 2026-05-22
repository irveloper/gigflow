/**
 * Integration tests — organizations router
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest"
import { prisma } from "@/lib/prisma"
import { createTestCaller } from "./helpers"

const ORG_A = "integration-org-a"
const ORG_B = "integration-org-b"

async function ensureOrg(id: string, slug: string) {
  await prisma.organization.upsert({
    where: { id },
    update: {},
    create: { id, name: `Org ${id}`, slug, status: "active" },
  })
  await prisma.subscription.upsert({
    where: { organizationId: id },
    update: { status: "active" },
    create: {
      organizationId: id,
      stripeCustomerId: `cus_${id}`,
      stripeSubscriptionId: `sub_${id}`,
      stripePriceId: "price_starter_monthly",
      status: "active",
      seatLimit: 3,
      currentPeriodEnd: new Date(Date.now() + 30 * 86_400_000),
    },
  })
}

beforeAll(async () => {
  await ensureOrg(ORG_A, "integration-org-a-slug")
  await ensureOrg(ORG_B, "integration-org-b-slug")
})

afterAll(async () => {
  await prisma.subscription.deleteMany({ where: { organizationId: { in: [ORG_A, ORG_B] } } })
  await prisma.organization.deleteMany({ where: { id: { in: [ORG_A, ORG_B] } } })
  await prisma.$disconnect()
})

describe("organizations router", () => {
  it("checkSlug returns true for available slug", async () => {
    const caller = await createTestCaller({ role: "manager", orgId: ORG_A })
    const result = await caller.organizations.checkSlug({ slug: "definitely-unique-slug-xyz999" })
    expect(result.available).toBe(true)
  })

  it("checkSlug returns false for taken slug", async () => {
    const caller = await createTestCaller({ role: "manager", orgId: ORG_A })
    const result = await caller.organizations.checkSlug({ slug: "integration-org-a-slug" })
    expect(result.available).toBe(false)
  })

  it("getMyOrg returns calling org", async () => {
    const caller = await createTestCaller({ role: "manager", orgId: ORG_A })
    const org = await caller.organizations.getMyOrg()
    expect(org?.id).toBe(ORG_A)
  })

  it("update org settings", async () => {
    const caller = await createTestCaller({ role: "manager", orgId: ORG_A })
    const updated = await caller.organizations.update({ name: "Updated Name A" })
    expect(updated.name).toBe("Updated Name A")
    // Restore
    await prisma.organization.update({ where: { id: ORG_A }, data: { name: `Org ${ORG_A}` } })
  })

  it("cross-tenant isolation: getMyOrg returns own org, not another", async () => {
    const callerA = await createTestCaller({ role: "manager", orgId: ORG_A })
    const callerB = await createTestCaller({ role: "manager", orgId: ORG_B })

    const orgA = await callerA.organizations.getMyOrg()
    const orgB = await callerB.organizations.getMyOrg()

    expect(orgA?.id).toBe(ORG_A)
    expect(orgB?.id).toBe(ORG_B)
    expect(orgA?.id).not.toBe(orgB?.id)
  })

  it("skipPayment flow creates organization, subscription and updates user role", async () => {
    const testUserId = "test-user-skip-payment"
    const testSlug = "test-skip-payment-slug"
    
    // Ensure clean state for the test user/org
    await prisma.subscription.deleteMany({ where: { organization: { slug: testSlug } } })
    await prisma.organization.deleteMany({ where: { slug: testSlug } })
    await prisma.user.deleteMany({ where: { id: testUserId } })

    // Create the test user first so update works
    await prisma.user.create({
      data: {
        id: testUserId,
        email: "skip-payment@test.com",
        name: "Skip Payment User",
        role: "manager",
        password: "hashed_password",
      }
    })

    const caller = await createTestCaller({ role: "manager", userId: testUserId })
    const result = await caller.organizations.initiateCheckout({
      name: "Skip Payment Org",
      slug: testSlug,
      planKey: "growth",
      billing: "monthly",
      skipPayment: true,
    })

    expect(result.url).toBe(`/onboarding/success?slug=${testSlug}`)

    // Verify Organization was created
    const org = await prisma.organization.findUnique({
      where: { slug: testSlug }
    })
    expect(org).toBeDefined()
    expect(org?.name).toBe("Skip Payment Org")
    expect(org?.status).toBe("active")

    // Verify Subscription was created with correct seat limit for Growth plan (10)
    const sub = await prisma.subscription.findFirst({
      where: { organizationId: org?.id }
    })
    expect(sub).toBeDefined()
    expect(sub?.status).toBe("active")
    expect(sub?.seatLimit).toBe(10)

    // Verify User role was updated to manager and organizationId is set
    const user = await prisma.user.findUnique({
      where: { id: testUserId }
    })
    expect(user?.role).toBe("manager")
    expect(user?.organizationId).toBe(org?.id)

    // Cleanup
    await prisma.subscription.deleteMany({ where: { organizationId: org?.id } })
    await prisma.organization.deleteMany({ where: { id: org?.id } })
    await prisma.user.delete({ where: { id: testUserId } })
  })
})
