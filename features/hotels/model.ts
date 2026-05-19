import { createEvent, createEffect, createStore, sample } from "effector"
import type { CreateHotelInput, Hotel } from "@/shared/types"
import { $activeHotels, addHotel, $hotels, removeHotel, setHotels, updateHotel } from "@/entities/hotel"
import * as hotelsApi from "@/shared/api/hotels"

export { $activeHotels, $hotels }

export const loadHotels = createEvent()
export const hotelCreated = createEvent<CreateHotelInput>()
export const hotelUpdated = createEvent<Hotel>()
export const hotelRemoved = createEvent<string>()
export const hotelStatusToggled = createEvent<string>()

type HotelsPage = { items: Hotel[]; total: number }

export const loadHotelsFx = createEffect<void, HotelsPage>(() => hotelsApi.fetchHotels())

export const $hotelsTotal = createStore(0).on(loadHotelsFx.doneData, (_, data) => data.total)

export const createHotelFx = createEffect<CreateHotelInput, Hotel>((data) => hotelsApi.createHotel(data))

export const updateHotelFx = createEffect<Hotel, Hotel>((hotel) => hotelsApi.updateHotel(hotel))

export const deleteHotelFx = createEffect<string, string>((id) => hotelsApi.deleteHotel(id))

export const toggleHotelStatusFx = createEffect<string, Hotel>((id) => {
  const hotel = $hotels.getState().find((entry) => entry.id === id)
  if (!hotel) throw new Error("Hotel not found")
  return hotelsApi.updateHotel({ ...hotel, isActive: !hotel.isActive })
})

export const $isLoading = createStore(false).on(
  [
    loadHotelsFx.pending,
    createHotelFx.pending,
    updateHotelFx.pending,
    deleteHotelFx.pending,
    toggleHotelStatusFx.pending,
  ],
  (_, pending) => pending,
)

export const $error = createStore<string | null>(null)
  .on(
    [
      loadHotelsFx.failData,
      createHotelFx.failData,
      updateHotelFx.failData,
      deleteHotelFx.failData,
      toggleHotelStatusFx.failData,
    ],
    (_, error) => error.message,
  )
  .on([loadHotels, hotelCreated, hotelUpdated, hotelRemoved, hotelStatusToggled], () => null)

sample({ clock: loadHotels, target: loadHotelsFx })
sample({ clock: hotelCreated, target: createHotelFx })
sample({ clock: hotelUpdated, target: updateHotelFx })
sample({ clock: hotelRemoved, target: deleteHotelFx })
sample({ clock: hotelStatusToggled, target: toggleHotelStatusFx })

sample({ clock: loadHotelsFx.doneData, fn: (data) => data.items, target: setHotels })
sample({ clock: createHotelFx.doneData, target: addHotel })
sample({ clock: updateHotelFx.doneData, target: updateHotel })
sample({ clock: deleteHotelFx.doneData, target: removeHotel })
sample({ clock: toggleHotelStatusFx.doneData, target: updateHotel })

export const hotelsModel = {
  $hotels,
  $hotelsTotal,
  $activeHotels,
  $isLoading,
  $error,
  loadHotels,
  hotelCreated,
  hotelUpdated,
  hotelRemoved,
  hotelStatusToggled,
  loadHotelsFx,
  createHotelFx,
  updateHotelFx,
  deleteHotelFx,
  toggleHotelStatusFx,
}
