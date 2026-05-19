import { createStore, createEvent } from "effector"
import type { Band } from "@/shared/types"

export const setBands = createEvent<Band[]>()
export const addBand = createEvent<Band>()
export const updateBand = createEvent<Band>()
export const removeBand = createEvent<string>()

export const $bands = createStore<Band[]>([])
  .on(setBands, (_, bands) => bands)
  .on(addBand, (bands, band) => [band, ...bands])
  .on(updateBand, (bands, updated) => bands.map((b) => (b.id === updated.id ? updated : b)))
  .on(removeBand, (bands, id) => bands.filter((b) => b.id !== id))
