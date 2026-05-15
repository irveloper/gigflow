import { createEvent, createEffect, createStore, sample } from "effector"
import type { CreateMusicianInput, Musician } from "@/shared/types"
import { addMusician, $musicians, removeMusician, setMusicians, updateMusician } from "@/entities/musician"
import * as musiciansApi from "@/shared/api/musicians"

export { $musicians }

export const loadMusicians = createEvent()
export const musicianCreated = createEvent<CreateMusicianInput>()
export const musicianUpdated = createEvent<Musician>()
export const musicianDeleted = createEvent<string>()

export const loadMusiciansFx = createEffect<void, Musician[]>(() => musiciansApi.fetchMusicians())

export const createMusicianFx = createEffect<CreateMusicianInput, Musician>((data) =>
  musiciansApi.createMusician(data),
)

export const updateMusicianFx = createEffect<Musician, Musician>((musician) =>
  musiciansApi.updateMusician(musician),
)

export const deleteMusicianFx = createEffect<string, string>((id) => musiciansApi.deleteMusician(id))

export const $isLoading = createStore(false).on(
  [
    loadMusiciansFx.pending,
    createMusicianFx.pending,
    updateMusicianFx.pending,
    deleteMusicianFx.pending,
  ],
  (_, pending) => pending,
)

export const $error = createStore<string | null>(null)
  .on(
    [
      loadMusiciansFx.failData,
      createMusicianFx.failData,
      updateMusicianFx.failData,
      deleteMusicianFx.failData,
    ],
    (_, error) => error.message,
  )
  .on([loadMusicians, musicianCreated, musicianUpdated, musicianDeleted], () => null)

sample({ clock: loadMusicians, target: loadMusiciansFx })
sample({ clock: musicianCreated, target: createMusicianFx })
sample({ clock: musicianUpdated, target: updateMusicianFx })
sample({ clock: musicianDeleted, target: deleteMusicianFx })

sample({ clock: loadMusiciansFx.doneData, target: setMusicians })
sample({ clock: createMusicianFx.doneData, target: addMusician })
sample({ clock: updateMusicianFx.doneData, target: updateMusician })
sample({ clock: deleteMusicianFx.doneData, target: removeMusician })

export const musiciansModel = {
  $musicians,
  $isLoading,
  $error,
  loadMusicians,
  musicianCreated,
  musicianUpdated,
  musicianDeleted,
  loadMusiciansFx,
  createMusicianFx,
  updateMusicianFx,
  deleteMusicianFx,
}
