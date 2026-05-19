import type { Event, CreateEventInput } from "@/shared/types"
import { trpc } from "@/shared/lib/trpc"

export async function fetchEvents(opts?: { limit?: number; cursor?: string }): Promise<{ items: Event[]; nextCursor: string | null; total: number }> {
  return trpc.events.getAll.query(opts ?? {})
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
