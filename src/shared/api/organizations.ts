import type { CreateOrganizationInput, UpdateOrganizationInput, Organization } from "@/shared/types"
import { trpc } from "@/shared/lib/trpc"

export async function fetchMyOrg(): Promise<Organization> {
  return trpc.organizations.getMyOrg.query()
}

export async function createOrg(input: CreateOrganizationInput): Promise<Organization> {
  return trpc.organizations.create.mutate(input)
}

export async function updateOrg(input: UpdateOrganizationInput): Promise<Organization> {
  return trpc.organizations.update.mutate(input)
}

export async function checkSlug(slug: string): Promise<{ available: boolean }> {
  return trpc.organizations.checkSlug.query({ slug })
}
