import { createStore, createEvent } from "effector"
import type { User } from "@/shared/types"

// Events
export const setUser = createEvent<User>()
export const clearUser = createEvent()

// Stores
export const $user = createStore<User | null>(null)
export const $userRole = $user.map((user) => user?.role ?? null)

// Handlers
$user.on(setUser, (_, user) => user).on(clearUser, () => null)
