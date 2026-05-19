import type { Hotel, CreateHotelInput } from "@/shared/types"
import { trpc } from "@/shared/lib/trpc"

// Phase 1: tRPC → mock data in server/routers/hotels.ts
// Phase 4: server/routers/hotels.ts replaced with Supabase queries

export async function fetchHotels(opts?: { limit?: number; offset?: number }): Promise<{ items: Hotel[]; total: number }> {
  return trpc.hotels.getAll.query(opts ?? {})
}

export async function createHotel(input: CreateHotelInput): Promise<Hotel> {
  return trpc.hotels.create.mutate(input)
}

export async function updateHotel(hotel: Hotel): Promise<Hotel> {
  return trpc.hotels.update.mutate(hotel)
}

export async function deleteHotel(id: string): Promise<string> {
  return trpc.hotels.delete.mutate({ id })
}
