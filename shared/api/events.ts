import type { Event, CreateEventInput } from "@/shared/types"
import { trpc } from "@/shared/lib/trpc"

// Phase 1: tRPC → mock data in server/routers/events.ts
// Phase 4: server/routers/events.ts replaced with Supabase queries

export async function fetchEvents(): Promise<Event[]> {
  return trpc.events.getAll.query()
}

export async function createEvent(input: CreateEventInput): Promise<Event> {
  return trpc.events.create.mutate(input)
}

export async function updateEvent(id: string, input: Partial<Event>): Promise<Event> {
  return trpc.events.update.mutate({ id, data: input })
}

export async function deleteEvent(id: string): Promise<void> {
  await trpc.events.delete.mutate({ id })
}
