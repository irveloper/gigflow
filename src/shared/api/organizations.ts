import type { CreateOrganizationInput, UpdateOrganizationInput, Organization } from "@/shared/types"
import { trpc } from "@/shared/lib/trpc"

export async function fetchMyOrg(): Promise<Organization> {
  return trpc.organizations.getMyOrg.query()
}

export async function createOrg(_input: CreateOrganizationInput): Promise<Organization> {
  throw new Error("Org creation is handled via trpc.organizations.initiateCheckout (Stripe flow)")
}

export async function updateOrg(input: UpdateOrganizationInput): Promise<Organization> {
  return trpc.organizations.update.mutate(input)
}

export async function checkSlug(slug: string): Promise<{ available: boolean }> {
  return trpc.organizations.checkSlug.query({ slug })
}
