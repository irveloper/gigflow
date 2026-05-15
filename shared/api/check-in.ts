import type { CheckInInput } from "@/shared/types"
import { uploadCheckInPhoto } from "@/shared/api/storage"
import { trpc } from "@/shared/lib/trpc"

export type CheckInResult = {
  eventId: string
  timestamp: string
  location?: { lat: number; lng: number }
  comments?: string
  photoUrl?: string
}

export async function submitCheckIn(input: CheckInInput): Promise<CheckInResult> {
  let photoUrl: string | undefined

  if (input.photo) {
    const { signedUrl } = await uploadCheckInPhoto(input.photo, input.eventId)
    photoUrl = signedUrl
  }

  await trpc.events.checkIn.mutate({
    eventId: input.eventId,
    photoUrl,
    timestamp: input.timestamp,
    location: input.location,
    comments: input.comments,
  })

  return {
    eventId: input.eventId,
    timestamp: input.timestamp,
    location: input.location,
    comments: input.comments,
    photoUrl,
  }
}

export async function confirmCheckIn(eventId: string): Promise<void> {
  await trpc.events.update.mutate({
    id: eventId,
    data: { status: "completed" },
  })
}

export async function rejectCheckIn(eventId: string): Promise<void> {
  await trpc.events.update.mutate({
    id: eventId,
    data: { status: "scheduled", checkedIn: false },
  })
}
