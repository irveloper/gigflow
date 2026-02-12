import { createStore, createEvent, createEffect, sample } from "effector"
import { setUser, clearUser, $user } from "@/entities/user/model"
import type { User } from "@/shared/types"

// Events
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

// Effects
export const loginFx = createEffect<{ email: string; password: string }, User>(
  async ({ email, password }) => {
    await new Promise((resolve) => setTimeout(resolve, 1000))

    const demoUsers: Record<string, User> = {
      "musico@test.com": {
        id: "1",
        email: "musico@test.com",
        name: "Carlos Mendoza",
        role: "musician",
        avatar: "/placeholder-user.jpg",
        phone: "+52 998 123 4567",
        shows: ["Acoustic Set", "Jazz Trio", "Solo Piano"],
        hourlyRate: 800,
        createdAt: new Date().toISOString(),
      },
      "gerente@test.com": {
        id: "2",
        email: "gerente@test.com",
        name: "Ana Garcia",
        role: "manager",
        avatar: "/placeholder-user.jpg",
        phone: "+52 998 765 4321",
        createdAt: new Date().toISOString(),
      },
      "hotel@test.com": {
        id: "3",
        email: "hotel@test.com",
        name: "Hotel Paradisus",
        role: "hotel",
        avatar: "/placeholder-logo.png",
        phone: "+52 998 888 0000",
        hotel: "Paradisus Cancun",
        location: "Cancun, Mexico",
        contactPerson: "Roberto Martinez",
        createdAt: new Date().toISOString(),
      },
    }

    const user = demoUsers[email]
    if (!user || password !== "123456") {
      throw new Error("Credenciales invalidas")
    }

    localStorage.setItem("user", JSON.stringify(user))
    return user
  },
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
>(async ({ email, name, role }) => {
  await new Promise((resolve) => setTimeout(resolve, 1000))

  const user: User = {
    id: Math.random().toString(36).substr(2, 9),
    email,
    name,
    role: role as "musician" | "manager" | "hotel",
    createdAt: new Date().toISOString(),
  }

  localStorage.setItem("user", JSON.stringify(user))
  return user
})

export const checkAuthFx = createEffect<void, User | null>(async () => {
  const userData = localStorage.getItem("user")
  if (userData) {
    return JSON.parse(userData)
  }
  return null
})

export const logoutFx = createEffect<void, void>(async () => {
  localStorage.removeItem("user")
})

// Stores
export const $isLoading = createStore(false)
export const $authError = createStore<string | null>(null)

// Handlers
$isLoading
  .on(loginFx.pending, (_, pending) => pending)
  .on(registerFx.pending, (_, pending) => pending)
  .on(checkAuthFx.pending, (_, pending) => pending)

$authError
  .on(loginFx.failData, (_, error) => error.message)
  .on(registerFx.failData, (_, error) => error.message)
  .on(loginSubmitted, () => null)
  .on(registerSubmitted, () => null)

// Sample connections
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
sample({ clock: logoutFx.done, target: clearUser })

// Export consolidated auth model
export const authModel = {
  loginSubmitted,
  registerSubmitted,
  logout,
  checkAuth,
  $isLoading,
  $authError,
  $user,
  loginFx,
  registerFx,
  checkAuthFx,
  logoutFx,
}
