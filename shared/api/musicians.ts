import type { Musician, CreateMusicianInput } from "@/shared/types"
import { trpc } from "@/shared/lib/trpc"

// Phase 1: tRPC → mock data in server/routers/musicians.ts
// Phase 4: server/routers/musicians.ts replaced with Supabase queries

export async function fetchMusicians(): Promise<Musician[]> {
  return trpc.musicians.getAll.query()
}

export async function createMusician(input: CreateMusicianInput): Promise<Musician> {
  return trpc.musicians.create.mutate(input)
}

export async function updateMusician(musician: Musician): Promise<Musician> {
  return trpc.musicians.update.mutate(musician)
}

export async function deleteMusician(id: string): Promise<string> {
  return trpc.musicians.delete.mutate({ id })
}
