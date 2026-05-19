import type { Band, CreateBandInput } from "@/shared/types"
import { trpc } from "@/shared/lib/trpc"

export async function fetchBands(): Promise<Band[]> {
  return trpc.bands.getAll.query()
}

export async function createBand(input: CreateBandInput): Promise<Band> {
  return trpc.bands.create.mutate(input)
}

export async function updateBand(input: {
  id: string
  name?: string
  description?: string
  genre?: string
}): Promise<Band> {
  return trpc.bands.update.mutate(input)
}

export async function addBandMember(bandId: string, musicianId: string): Promise<Band> {
  return trpc.bands.addMember.mutate({ bandId, musicianId })
}

export async function removeBandMember(bandId: string, musicianId: string): Promise<Band> {
  return trpc.bands.removeMember.mutate({ bandId, musicianId })
}

export async function deactivateBand(id: string): Promise<Band> {
  return trpc.bands.deactivate.mutate({ id })
}
