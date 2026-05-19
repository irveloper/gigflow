import { createStore, createEvent } from "effector"
import type { Organization } from "@/shared/types"

export const organizationSet = createEvent<Organization>()
export const organizationCleared = createEvent()

export const $organization = createStore<Organization | null>(null)
  .on(organizationSet, (_, org) => org)
  .on(organizationCleared, () => null)
