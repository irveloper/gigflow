import { z } from "zod"
import { TRPCError } from "@trpc/server"
import { router, protectedProcedure, managerProcedure } from "@/server/trpc"
import { CreateMusicianInputSchema, MusicianSchema } from "@/entities/musician/schema"
import type { Musician } from "@/shared/types"

function mapMusician(m: {
  id: string
  name: string
  email: string
  phone: string
  shows: string[]
  hourlyRate: number
  isActive: boolean
  avatar: string | null
  createdAt: Date
}): Musician {
  return {
    id: m.id,
    name: m.name,
    email: m.email,
    phone: m.phone,
    shows: m.shows,
    hourlyRate: m.hourlyRate,
    isActive: m.isActive,
    avatar: m.avatar ?? undefined,
    createdAt: m.createdAt.toISOString(),
  }
}

export const musiciansRouter = router({
  getAll: protectedProcedure.query(async ({ ctx }) => {
    const rows = await ctx.prisma.musician.findMany({ orderBy: { name: "asc" } })
    return rows.map(mapMusician)
  }),

  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const row = await ctx.prisma.musician.findUnique({ where: { id: input.id } })
      if (!row) throw new TRPCError({ code: "NOT_FOUND" })
      return mapMusician(row)
    }),

  create: managerProcedure
    .input(CreateMusicianInputSchema)
    .mutation(async ({ ctx, input }) => {
      const row = await ctx.prisma.musician.create({
        data: {
          name: input.name,
          email: input.email,
          phone: input.phone,
          shows: input.shows,
          hourlyRate: input.hourlyRate,
          isActive: input.isActive ?? true,
          avatar: input.avatar ?? null,
        },
      })
      return mapMusician(row)
    }),

  update: managerProcedure
    .input(MusicianSchema)
    .mutation(async ({ ctx, input }) => {
      const row = await ctx.prisma.musician.update({
        where: { id: input.id },
        data: {
          name: input.name,
          email: input.email,
          phone: input.phone,
          shows: input.shows,
          hourlyRate: input.hourlyRate,
          isActive: input.isActive,
          avatar: input.avatar ?? null,
        },
      })
      return mapMusician(row)
    }),

  delete: managerProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.prisma.musician.delete({ where: { id: input.id } })
    }),
})
