import { createStore, createEvent, createEffect, sample } from "effector"
import type { Musician } from "@/shared/types"

// Events
export const loadMusicians = createEvent()
export const createMusician = createEvent<Omit<Musician, "id" | "createdAt">>()
export const updateMusician = createEvent<{ id: string; data: Partial<Musician> }>()
export const deleteMusician = createEvent<string>()

// Effects
export const loadMusiciansFx = createEffect<void, Musician[]>(async () => {
  await new Promise((resolve) => setTimeout(resolve, 500))

  const mockMusicians: Musician[] = [
    {
      id: "1",
      name: "Carlos Mendoza",
      email: "carlos@example.com",
      phone: "+52 998 123 4567",
      shows: ["Acoustic Set", "Jazz Trio", "Solo Piano"],
      hourlyRate: 800,
      isActive: true,
      avatar: "/placeholder-user.jpg",
      createdAt: new Date().toISOString(),
    },
    {
      id: "2",
      name: "María González",
      email: "maria@example.com",
      phone: "+52 998 765 4321",
      shows: ["Vocal Performance", "Guitar & Vocals"],
      hourlyRate: 750,
      isActive: true,
      avatar: "/placeholder-user.jpg",
      createdAt: new Date().toISOString(),
    },
  ]

  return mockMusicians
})

export const createMusicianFx = createEffect<Omit<Musician, "id" | "createdAt">, Musician>(
  async (musicianData) => {
    await new Promise((resolve) => setTimeout(resolve, 1000))

    const newMusician: Musician = {
      ...musicianData,
      id: Math.random().toString(36).substr(2, 9),
      createdAt: new Date().toISOString(),
    }

    return newMusician
  },
)

export const updateMusicianFx = createEffect<{ id: string; data: Partial<Musician> }, Musician>(
  async ({ id, data }) => {
    await new Promise((resolve) => setTimeout(resolve, 1000))

    // Mock updated musician
    const updatedMusician: Musician = {
      id,
      name: data.name || "Updated Musician",
      email: data.email || "updated@example.com",
      phone: data.phone || "+52 998 000 0000",
      shows: data.shows || ["Updated Show"],
      hourlyRate: data.hourlyRate || 600,
      isActive: data.isActive ?? true,
      createdAt: new Date().toISOString(),
    }

    return updatedMusician
  },
)

export const deleteMusicianFx = createEffect<string, string>(async (id) => {
  await new Promise((resolve) => setTimeout(resolve, 500))
  return id
})

// Stores
export const $musicians = createStore<Musician[]>([])
export const $isLoading = createStore(false)
export const $error = createStore<string | null>(null)

// Handlers
$musicians
  .on(loadMusiciansFx.doneData, (_, musicians) => musicians)
  .on(createMusicianFx.doneData, (musicians, newMusician) => [...musicians, newMusician])
  .on(updateMusicianFx.doneData, (musicians, updatedMusician) =>
    musicians.map((m) => (m.id === updatedMusician.id ? updatedMusician : m)),
  )
  .on(deleteMusicianFx.doneData, (musicians, deletedId) => musicians.filter((m) => m.id !== deletedId))

$isLoading.on(
  [loadMusiciansFx.pending, createMusicianFx.pending, updateMusicianFx.pending, deleteMusicianFx.pending],
  (_, pending) => pending,
)

$error
  .on(
    [loadMusiciansFx.failData, createMusicianFx.failData, updateMusicianFx.failData, deleteMusicianFx.failData],
    (_, error) => error.message,
  )
  .on([loadMusicians, createMusician, updateMusician, deleteMusician], () => null)

// Sample connections
sample({
  clock: loadMusicians,
  target: loadMusiciansFx,
})

sample({
  clock: createMusician,
  target: createMusicianFx,
})

sample({
  clock: updateMusician,
  target: updateMusicianFx,
})

sample({
  clock: deleteMusician,
  target: deleteMusicianFx,
})
