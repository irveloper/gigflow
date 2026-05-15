import { z } from "zod"
import { TRPCError } from "@trpc/server"
import { router, protectedProcedure, managerProcedure } from "@/server/trpc"
import { CreateHotelInputSchema, HotelSchema } from "@/entities/hotel/schema"
import type { Hotel } from "@/shared/types"

function mapHotel(h: {
  id: string
  name: string
  email: string
  phone: string
  location: string
  contactPerson: string
  isActive: boolean
  avatar: string | null
  createdAt: Date
}): Hotel {
  return {
    id: h.id,
    name: h.name,
    email: h.email,
    phone: h.phone,
    location: h.location,
    contactPerson: h.contactPerson,
    isActive: h.isActive,
    avatar: h.avatar ?? undefined,
    createdAt: h.createdAt.toISOString(),
  }
}

export const hotelsRouter = router({
  getAll: protectedProcedure.query(async ({ ctx }) => {
    const rows = await ctx.prisma.hotel.findMany({ orderBy: { name: "asc" } })
    return rows.map(mapHotel)
  }),

  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const row = await ctx.prisma.hotel.findUnique({ where: { id: input.id } })
      if (!row) throw new TRPCError({ code: "NOT_FOUND" })
      return mapHotel(row)
    }),

  create: managerProcedure
    .input(CreateHotelInputSchema)
    .mutation(async ({ ctx, input }) => {
      const row = await ctx.prisma.hotel.create({
        data: {
          name: input.name,
          email: input.email,
          phone: input.phone,
          location: input.location,
          contactPerson: input.contactPerson,
          isActive: input.isActive ?? true,
          avatar: input.avatar ?? null,
        },
      })
      return mapHotel(row)
    }),

  update: managerProcedure
    .input(HotelSchema)
    .mutation(async ({ ctx, input }) => {
      const row = await ctx.prisma.hotel.update({
        where: { id: input.id },
        data: {
          name: input.name,
          email: input.email,
          phone: input.phone,
          location: input.location,
          contactPerson: input.contactPerson,
          isActive: input.isActive,
          avatar: input.avatar ?? null,
        },
      })
      return mapHotel(row)
    }),

  delete: managerProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.prisma.hotel.delete({ where: { id: input.id } })
    }),
})
