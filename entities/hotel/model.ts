import { createStore, createEvent, createEffect, sample } from "effector"
import type { Hotel } from "@/shared/types"

// Events
export const setHotels = createEvent<Hotel[]>()
export const addHotel = createEvent<Hotel>()
export const updateHotel = createEvent<Hotel>()
export const removeHotel = createEvent<string>()

// Effects
export const loadHotelsFx = createEffect<void, Hotel[]>(async () => {
  await new Promise((resolve) => setTimeout(resolve, 500))

  return [
    {
      id: "1",
      name: "Hotel Paradisus Cancún",
      location: "Cancún, Quintana Roo",
      contactPerson: "María González",
      email: "maria@paradisus.com",
      phone: "+52 998 881 1100",
      isActive: true,
      createdAt: new Date().toISOString(),
    },
    {
      id: "2",
      name: "Hotel Moon Palace",
      location: "Cancún, Quintana Roo",
      contactPerson: "Carlos Ruiz",
      email: "carlos@moonpalace.com",
      phone: "+52 998 881 6000",
      isActive: true,
      createdAt: new Date().toISOString(),
    },
    {
      id: "3",
      name: "Hotel Xcaret",
      location: "Playa del Carmen, Quintana Roo",
      contactPerson: "Ana Martínez",
      email: "ana@xcaret.com",
      phone: "+52 984 206 3000",
      isActive: true,
      createdAt: new Date().toISOString(),
    },
  ]
})

// Stores
export const $hotels = createStore<Hotel[]>([])
export const $isLoading = createStore(false)
export const $activeHotels = $hotels.map((hotels) => hotels.filter((hotel) => hotel.isActive))

// Sample connections
sample({
  clock: setHotels,
  target: $hotels,
})

sample({
  clock: addHotel,
  source: $hotels,
  fn: (hotels, newHotel) => [...hotels, newHotel],
  target: $hotels,
})

sample({
  clock: updateHotel,
  source: $hotels,
  fn: (hotels, updatedHotel) => hotels.map((hotel) => (hotel.id === updatedHotel.id ? updatedHotel : hotel)),
  target: $hotels,
})

sample({
  clock: removeHotel,
  source: $hotels,
  fn: (hotels, hotelId) => hotels.filter((hotel) => hotel.id !== hotelId),
  target: $hotels,
})

sample({
  clock: loadHotelsFx.doneData,
  target: setHotels,
})

sample({
  clock: loadHotelsFx.pending,
  target: $isLoading,
})
