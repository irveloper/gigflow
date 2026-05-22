import { createEvent, createEffect, createStore, sample } from "effector"
import type { CreateOrganizationInput, UpdateOrganizationInput, Organization } from "@/shared/types"
import { $organization, organizationSet, organizationCleared } from "@/entities/organization/model"
import { $user } from "@/entities/user/model"
import { checkAuthFx } from "@/features/auth/model"
import * as orgsApi from "@/shared/api/organizations"

export { $organization }

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------
export const loadOrg = createEvent()
export const orgCreated = createEvent<CreateOrganizationInput>()
export const orgUpdated = createEvent<UpdateOrganizationInput>()

// ---------------------------------------------------------------------------
// Effects
// ---------------------------------------------------------------------------
export const loadMyOrgFx = createEffect<void, Organization | null>(async () => {
  const user = $user.getState()
  if (!user?.organizationId) {
    return null
  }
  try {
    return await orgsApi.fetchMyOrg()
  } catch {
    // Pending users and superadmin have no org — not an error worth surfacing
    return null
  }
})

export const createOrgFx = createEffect<CreateOrganizationInput, Organization>((input) =>
  orgsApi.createOrg(input),
)

export const updateOrgFx = createEffect<UpdateOrganizationInput, Organization>((input) =>
  orgsApi.updateOrg(input),
)

// ---------------------------------------------------------------------------
// Stores
// ---------------------------------------------------------------------------
export const $isLoading = createStore(false).on(
  [loadMyOrgFx.pending, createOrgFx.pending, updateOrgFx.pending],
  (_, pending) => pending,
)

export const $error = createStore<string | null>(null)
  .on(
    [createOrgFx.failData, updateOrgFx.failData],
    (_, error) => error.message,
  )
  .on([loadOrg, orgCreated, orgUpdated], () => null)

// ---------------------------------------------------------------------------
// Sample connections
// ---------------------------------------------------------------------------
sample({ clock: loadOrg, target: loadMyOrgFx })
sample({ clock: orgCreated, target: createOrgFx })
sample({ clock: orgUpdated, target: updateOrgFx })

sample({
  clock: loadMyOrgFx.doneData,
  filter: (org): org is Organization => org !== null,
  target: organizationSet,
})
sample({ clock: createOrgFx.doneData, target: organizationSet })
sample({ clock: updateOrgFx.doneData, target: organizationSet })

// After auth check resolves with a logged-in user, attempt to load their org.
// Pending users and superadmin will silently get null back.
sample({
  clock: checkAuthFx.doneData,
  filter: (user): user is NonNullable<typeof user> => user !== null && !!user.organizationId,
  target: loadMyOrgFx,
})

// Clear org on logout
sample({ clock: checkAuthFx.doneData, filter: (user) => user === null, target: organizationCleared })

// ---------------------------------------------------------------------------
// Consolidated export
// ---------------------------------------------------------------------------
export const orgModel = {
  $organization,
  $isLoading,
  $error,
  loadOrg,
  orgCreated,
  orgUpdated,
  loadMyOrgFx,
  createOrgFx,
  updateOrgFx,
}
