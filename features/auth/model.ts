import { createStore, createEvent, createEffect, sample } from "effector"
import { setUser, clearUser, $user } from "@/entities/user/model"
import type { User } from "@/shared/types"
import * as authApi from "@/shared/api/auth"

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------
export const loginSubmitted = createEvent<{ email: string; password: string }>()
export const registerSubmitted = createEvent<{
  email: string
  password: string
  name: string
  role: string
  phone?: string
  shows?: string[]
  hotel?: string
  hourlyRate?: number
  location?: string
  contactPerson?: string
}>()
export const logout = createEvent()
export const checkAuth = createEvent()

// ---------------------------------------------------------------------------
// Effects
// ---------------------------------------------------------------------------
export const loginFx = createEffect<{ email: string; password: string }, User>(({ email, password }) =>
  authApi.login({ email, password }),
)

export const registerFx = createEffect<
  {
    email: string
    password: string
    name: string
    role: string
    phone?: string
    shows?: string[]
    hotel?: string
    hourlyRate?: number
    location?: string
    contactPerson?: string
  },
  User
>(({ email, password, name, role, ...rest }) =>
  authApi.register({
    email,
    password,
    name,
    role: role as "musician" | "manager" | "hotel",
    ...rest,
  }),
)

export const checkAuthFx = createEffect<void, User | null>(() => authApi.getSession())

export const logoutFx = createEffect<void, void>(() => authApi.logout())

// ---------------------------------------------------------------------------
// Stores
// ---------------------------------------------------------------------------
export const $isLoading = createStore(false)
export const $isCheckingAuth = createStore(false)
export const $isAuthResolved = createStore(false)
export const $authError = createStore<string | null>(null)
export const $isPending = createStore(false)

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------
$isLoading
  .on(loginFx.pending, (_, pending) => pending)
  .on(registerFx.pending, (_, pending) => pending)

$isCheckingAuth.on(checkAuthFx.pending, (_, pending) => pending)

$isAuthResolved.on(checkAuth, () => false).on(checkAuthFx.finally, () => true)

$authError
  .on(loginFx.failData, (_, error) =>
    error.message === "ROLE_PENDING" ? null : error.message,
  )
  .on(registerFx.failData, (_, error) => error.message)
  .on(loginSubmitted, () => null)
  .on(registerSubmitted, () => null)
  .on(loginFx, () => null)
  .on(registerFx, () => null)

$isPending
  .on(checkAuth, () => false)
  .on(loginSubmitted, () => false)
  .on(checkAuthFx.failData, (_, err) => err.message === "ROLE_PENDING")
  .on(loginFx.failData, (_, err) => err.message === "ROLE_PENDING")

// ---------------------------------------------------------------------------
// Sample connections
// ---------------------------------------------------------------------------
sample({ clock: loginSubmitted, target: loginFx })
sample({ clock: registerSubmitted, target: registerFx })
sample({ clock: logout, target: logoutFx })
sample({ clock: checkAuth, target: checkAuthFx })

sample({ clock: loginFx.doneData, target: setUser })
sample({ clock: registerFx.doneData, target: setUser })
sample({
  clock: checkAuthFx.doneData,
  filter: (user): user is User => user !== null,
  target: setUser,
})
sample({
  clock: checkAuthFx.doneData,
  filter: (user): user is null => user === null,
  target: clearUser,
})
sample({ clock: logoutFx.done, target: clearUser })

// ---------------------------------------------------------------------------
// Consolidated export
// ---------------------------------------------------------------------------
export const authModel = {
  loginSubmitted,
  registerSubmitted,
  logout,
  checkAuth,
  $isLoading,
  $isCheckingAuth,
  $isAuthResolved,
  $authError,
  $isPending,
  $user,
  loginFx,
  registerFx,
  checkAuthFx,
  logoutFx,
}
