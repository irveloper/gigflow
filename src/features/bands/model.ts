import { createEvent, createEffect, createStore, sample } from "effector"
import type { Band, CreateBandInput } from "@/shared/types"
import { $bands, setBands, addBand, updateBand } from "@/entities/band"
import * as bandsApi from "@/shared/api/bands"

export { $bands }

export const loadBands = createEvent()
export const bandCreated = createEvent<CreateBandInput>()
export const bandUpdated = createEvent<{ id: string; name?: string; description?: string; genre?: string }>()
export const memberAdded = createEvent<{ bandId: string; musicianId: string }>()
export const memberRemoved = createEvent<{ bandId: string; musicianId: string }>()
export const bandDeactivated = createEvent<string>()

export const loadBandsFx = createEffect<void, Band[]>(() => bandsApi.fetchBands())

export const createBandFx = createEffect<CreateBandInput, Band>((data) => bandsApi.createBand(data))

export const updateBandFx = createEffect<
  { id: string; name?: string; description?: string; genre?: string },
  Band
>((data) => bandsApi.updateBand(data))

export const addMemberFx = createEffect<{ bandId: string; musicianId: string }, Band>(({ bandId, musicianId }) =>
  bandsApi.addBandMember(bandId, musicianId),
)

export const removeMemberFx = createEffect<{ bandId: string; musicianId: string }, Band>(({ bandId, musicianId }) =>
  bandsApi.removeBandMember(bandId, musicianId),
)

export const deactivateBandFx = createEffect<string, Band>((id) => bandsApi.deactivateBand(id))

export const $isLoading = createStore(false).on(
  [
    loadBandsFx.pending,
    createBandFx.pending,
    updateBandFx.pending,
    addMemberFx.pending,
    removeMemberFx.pending,
    deactivateBandFx.pending,
  ],
  (_, pending) => pending,
)

export const $error = createStore<string | null>(null)
  .on(
    [
      loadBandsFx.failData,
      createBandFx.failData,
      updateBandFx.failData,
      addMemberFx.failData,
      removeMemberFx.failData,
      deactivateBandFx.failData,
    ],
    (_, error) => error.message,
  )
  .on([loadBands, bandCreated, bandUpdated, memberAdded, memberRemoved, bandDeactivated], () => null)

sample({ clock: loadBands, target: loadBandsFx })
sample({ clock: bandCreated, target: createBandFx })
sample({ clock: bandUpdated, target: updateBandFx })
sample({ clock: memberAdded, target: addMemberFx })
sample({ clock: memberRemoved, target: removeMemberFx })
sample({ clock: bandDeactivated, target: deactivateBandFx })

sample({ clock: loadBandsFx.doneData, target: setBands })
sample({ clock: createBandFx.doneData, target: addBand })
sample({ clock: updateBandFx.doneData, target: updateBand })
sample({ clock: addMemberFx.doneData, target: updateBand })
sample({ clock: removeMemberFx.doneData, target: updateBand })
sample({ clock: deactivateBandFx.doneData, target: updateBand })

export const bandsModel = {
  $bands,
  $isLoading,
  $error,
  loadBands,
  bandCreated,
  bandUpdated,
  memberAdded,
  memberRemoved,
  bandDeactivated,
  loadBandsFx,
  createBandFx,
  updateBandFx,
  addMemberFx,
  removeMemberFx,
  deactivateBandFx,
}
