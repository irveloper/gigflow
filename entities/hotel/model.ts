import { createStore, createEvent } from "effector"
import type { Hotel } from "@/shared/types"

// ---------------------------------------------------------------------------
// Primitive events — feature layer wires effects to these
// ---------------------------------------------------------------------------
export const setHotels = createEvent<Hotel[]>()
export const addHotel = createEvent<Hotel>()
export const updateHotel = createEvent<Hotel>()
export const removeHotel = createEvent<string>()

// ---------------------------------------------------------------------------
// Stores
// ---------------------------------------------------------------------------
export const $hotels = createStore<Hotel[]>([])
  .on(setHotels, (_, hotels) => hotels)
  .on(addHotel, (hotels, hotel) => [...hotels, hotel])
  .on(updateHotel, (hotels, updated) =>
    hotels.map((h) => (h.id === updated.id ? updated : h)),
  )
  .on(removeHotel, (hotels, id) => hotels.filter((h) => h.id !== id))

export const $activeHotels = $hotels.map((hotels) => hotels.filter((h) => h.isActive))
