import { z } from "zod"
import { TRPCError } from "@trpc/server"
import { router, protectedProcedure, managerProcedure } from "@/server/trpc"
import { CreateEventInputSchema, EventSchema } from "@/entities/event/schema"
import type { Event } from "@/shared/types"

function mapEvent(e: {
  id: string
  title: string
  description: string | null
  date: string
  time: string
  durationMinutes: number
  hotel: string
  hotelId: string | null
  musician: string | null
  musicianId: string | null
  status: string
  checkedIn: boolean
  checkInTime: Date | null
  checkInPhoto: string | null
  checkInLocation: unknown
  checkInComments: string | null
}): Event {
  return {
    id: e.id,
    title: e.title,
    description: e.description ?? undefined,
    date: e.date,
    time: e.time,
    durationMinutes: e.durationMinutes,
    hotel: e.hotel,
    hotelId: e.hotelId ?? undefined,
    musician: e.musician ?? undefined,
    musicianId: e.musicianId ?? undefined,
    status: e.status as Event["status"],
    checkedIn: e.checkedIn,
    checkInTime: e.checkInTime?.toISOString(),
    checkInPhoto: e.checkInPhoto ?? undefined,
    checkInLocation: e.checkInLocation as Event["checkInLocation"],
    checkInComments: e.checkInComments ?? undefined,
  }
}

export const eventsRouter = router({
  getAll: protectedProcedure.query(async ({ ctx }) => {
    const rows = await ctx.prisma.event.findMany({ orderBy: { date: "asc" } })
    return rows.map(mapEvent)
  }),

  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const row = await ctx.prisma.event.findUnique({ where: { id: input.id } })
      if (!row) throw new TRPCError({ code: "NOT_FOUND" })
      return mapEvent(row)
    }),

  create: managerProcedure
    .input(CreateEventInputSchema)
    .mutation(async ({ ctx, input }) => {
      const row = await ctx.prisma.event.create({
        data: {
          title: input.title,
          description: input.description ?? null,
          date: input.date,
          time: input.time,
          durationMinutes: input.durationMinutes,
          hotel: input.hotel,
          hotelId: input.hotelId ?? null,
          musician: input.musician ?? null,
          musicianId: input.musicianId ?? null,
          status: input.status,
        },
      })
      return mapEvent(row)
    }),

  update: managerProcedure
    .input(z.object({ id: z.string(), data: EventSchema.partial() }))
    .mutation(async ({ ctx, input }) => {
      const row = await ctx.prisma.event.update({
        where: { id: input.id },
        data: {
          title: input.data.title,
          description: input.data.description ?? null,
          date: input.data.date,
          time: input.data.time,
          durationMinutes: input.data.durationMinutes,
          hotel: input.data.hotel,
          hotelId: input.data.hotelId ?? null,
          musician: input.data.musician ?? null,
          musicianId: input.data.musicianId ?? null,
          status: input.data.status,
          checkedIn: input.data.checkedIn,
          checkInTime: input.data.checkInTime ? new Date(input.data.checkInTime) : null,
          checkInPhoto: input.data.checkInPhoto ?? null,
          checkInLocation: input.data.checkInLocation ?? undefined,
          checkInComments: input.data.checkInComments ?? null,
        },
      })
      return mapEvent(row)
    }),

  delete: managerProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.prisma.event.delete({ where: { id: input.id } })
    }),

  checkIn: protectedProcedure
    .input(
      z.object({
        eventId: z.string(),
        photoUrl: z.string().url().optional(),
        timestamp: z.string().datetime({ offset: true }),
        location: z.object({ lat: z.number(), lng: z.number() }).optional(),
        comments: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const row = await ctx.prisma.event.findUnique({ where: { id: input.eventId } })
      if (!row) throw new TRPCError({ code: "NOT_FOUND" })

      const updated = await ctx.prisma.event.update({
        where: { id: input.eventId },
        data: {
          checkedIn: true,
          status: "in-progress",
          checkInTime: new Date(input.timestamp),
          checkInPhoto: input.photoUrl ?? null,
          checkInLocation: input.location ?? undefined,
          checkInComments: input.comments ?? null,
        },
      })
      return mapEvent(updated)
    }),
})
