import { createStore, createEvent } from "effector"
import type { Musician } from "@/shared/types"

// ---------------------------------------------------------------------------
// Primitive events — feature layer wires effects to these
// ---------------------------------------------------------------------------
export const setMusicians = createEvent<Musician[]>()
export const addMusician = createEvent<Musician>()
export const updateMusician = createEvent<Musician>()
export const removeMusician = createEvent<string>()

// ---------------------------------------------------------------------------
// Stores
// ---------------------------------------------------------------------------
export const $musicians = createStore<Musician[]>([])
  .on(setMusicians, (_, musicians) => musicians)
  .on(addMusician, (musicians, musician) => [musician, ...musicians])
  .on(updateMusician, (musicians, updated) =>
    musicians.map((m) => (m.id === updated.id ? updated : m)),
  )
  .on(removeMusician, (musicians, id) => musicians.filter((m) => m.id !== id))
