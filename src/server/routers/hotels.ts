import { z } from "zod"
import { TRPCError } from "@trpc/server"
import { router, orgProcedure, managerProcedure } from "@/server/trpc"
import { CreateHotelInputSchema, HotelSchema } from "@/entities/hotel/schema"
import { OffsetPaginationInputSchema } from "@/specs/entities/pagination.schema"
import type { Hotel } from "@/shared/types"

type PrismaHotel = {
  id: string
  name: string
  email: string
  phone: string
  address: string
  city: string
  state: string
  stateCode: string
  countryCode: string
  country: string
  postalCode: string
  contactPerson: string
  isActive: boolean
  avatar: string | null
  createdAt: Date
}

type OrgLink = { contactPerson: string | null; contactPhone: string | null } | null

/**
 * Map a Prisma hotel row to the canonical Hotel type.
 * If an org link is provided, its contactPerson overrides the global one.
 */
function mapHotel(h: PrismaHotel, orgLink?: OrgLink): Hotel {
  return {
    id: h.id,
    name: h.name,
    email: h.email,
    phone: h.phone,
    address: h.address,
    city: h.city,
    state: h.state,
    stateCode: h.stateCode,
    countryCode: h.countryCode,
    country: h.country,
    postalCode: h.postalCode,
    contactPerson: orgLink?.contactPerson ?? h.contactPerson,
    isActive: h.isActive,
    avatar: h.avatar ?? undefined,
    createdAt: h.createdAt.toISOString(),
  }
}

export const hotelsRouter = router({
  /**
   * Returns hotels linked to the calling org with offset-based pagination.
   * Superadmin: returns all hotels (no org filter).
   * Returns { items, total }.
   */
  getAll: orgProcedure.input(OffsetPaginationInputSchema).query(async ({ ctx, input }) => {
    const { limit, offset } = input

    if (!ctx.organizationId) {
      const [rows, total] = await Promise.all([
        ctx.prisma.hotel.findMany({ orderBy: { name: "asc" }, take: limit, skip: offset }),
        ctx.prisma.hotel.count(),
      ])
      return { items: rows.map((h) => mapHotel(h)), total }
    }

    const [links, total] = await Promise.all([
      ctx.prisma.hotelOrganization.findMany({
        where: { organizationId: ctx.organizationId },
        include: { hotel: true },
        orderBy: { hotel: { name: "asc" } },
        take: limit,
        skip: offset,
      }),
      ctx.prisma.hotelOrganization.count({
        where: { organizationId: ctx.organizationId },
      }),
    ])
    return { items: links.map((l) => mapHotel(l.hotel, l)), total }
  }),

  /** Search platform-wide hotel directory (for linking UI). */
  search: orgProcedure
    .input(z.object({ query: z.string() }))
    .query(async ({ ctx, input }) => {
      const rows = await ctx.prisma.hotel.findMany({
        where: {
          name: { contains: input.query, mode: "insensitive" },
        },
        orderBy: { name: "asc" },
        take: 20,
      })
      return rows.map((h) => mapHotel(h))
    }),

  /**
   * Returns a hotel by id.
   * Org users: verifies the hotel is linked to their org.
   * Superadmin: no restriction.
   */
  getById: orgProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const row = await ctx.prisma.hotel.findUnique({ where: { id: input.id } })
      if (!row) throw new TRPCError({ code: "NOT_FOUND" })

      if (ctx.organizationId) {
        const link = await ctx.prisma.hotelOrganization.findUnique({
          where: {
            hotelId_organizationId: {
              hotelId: input.id,
              organizationId: ctx.organizationId,
            },
          },
        })
        if (!link) throw new TRPCError({ code: "FORBIDDEN" })
        return mapHotel(row, link)
      }

      return mapHotel(row)
    }),

  /**
   * Create a new hotel and automatically link it to the calling org.
   */
  create: managerProcedure
    .input(CreateHotelInputSchema)
    .mutation(async ({ ctx, input }) => {
      if (!ctx.organizationId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "No organization context" })
      }

      const row = await ctx.prisma.hotel.create({
        data: {
          name: input.name,
          email: input.email,
          phone: input.phone,
          address: input.address,
          city: input.city,
          state: input.state,
          stateCode: input.stateCode,
          countryCode: input.countryCode,
          country: input.country,
          postalCode: input.postalCode,
          contactPerson: input.contactPerson,
          isActive: input.isActive ?? true,
          avatar: input.avatar ?? null,
        },
      })

      // Auto-link to calling org
      await ctx.prisma.hotelOrganization.create({
        data: { hotelId: row.id, organizationId: ctx.organizationId },
      })

      return mapHotel(row)
    }),

  /**
   * Update shared hotel fields (applies to all orgs that share this hotel).
   * Requires the hotel to be linked to the calling org.
   */
  update: managerProcedure
    .input(HotelSchema)
    .mutation(async ({ ctx, input }) => {
      if (!ctx.organizationId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "No organization context" })
      }

      const link = await ctx.prisma.hotelOrganization.findUnique({
        where: {
          hotelId_organizationId: {
            hotelId: input.id,
            organizationId: ctx.organizationId,
          },
        },
      })
      if (!link) throw new TRPCError({ code: "FORBIDDEN" })

      const row = await ctx.prisma.hotel.update({
        where: { id: input.id },
        data: {
          name: input.name,
          email: input.email,
          phone: input.phone,
          address: input.address,
          city: input.city,
          state: input.state,
          stateCode: input.stateCode,
          countryCode: input.countryCode,
          country: input.country,
          postalCode: input.postalCode,
          contactPerson: input.contactPerson,
          isActive: input.isActive,
          avatar: input.avatar ?? null,
        },
      })
      return mapHotel(row, link)
    }),

  /**
   * Unlink hotel from org. Deletes the Hotel record only if no other orgs use it.
   */
  delete: managerProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.organizationId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "No organization context" })
      }

      const link = await ctx.prisma.hotelOrganization.findUnique({
        where: {
          hotelId_organizationId: {
            hotelId: input.id,
            organizationId: ctx.organizationId,
          },
        },
      })
      if (!link) throw new TRPCError({ code: "FORBIDDEN" })

      await ctx.prisma.hotelOrganization.delete({
        where: {
          hotelId_organizationId: {
            hotelId: input.id,
            organizationId: ctx.organizationId,
          },
        },
      })

      // Delete the hotel record itself if no other orgs reference it
      const remainingLinks = await ctx.prisma.hotelOrganization.count({
        where: { hotelId: input.id },
      })
      if (remainingLinks === 0) {
        await ctx.prisma.hotel.delete({ where: { id: input.id } })
      }
    }),

  /** Link an existing hotel to the calling org with optional org-specific contact. */
  linkHotel: managerProcedure
    .input(
      z.object({
        hotelId: z.string(),
        contactPerson: z.string().optional(),
        contactPhone: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (!ctx.organizationId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "No organization context" })
      }

      const hotel = await ctx.prisma.hotel.findUnique({ where: { id: input.hotelId } })
      if (!hotel) throw new TRPCError({ code: "NOT_FOUND" })

      const link = await ctx.prisma.hotelOrganization.upsert({
        where: {
          hotelId_organizationId: {
            hotelId: input.hotelId,
            organizationId: ctx.organizationId,
          },
        },
        update: {},
        create: {
          hotelId: input.hotelId,
          organizationId: ctx.organizationId,
          contactPerson: input.contactPerson ?? null,
          contactPhone: input.contactPhone ?? null,
        },
      })

      return mapHotel(hotel, link)
    }),

  /** Remove the org-hotel link (does not delete the hotel record). */
  unlinkHotel: managerProcedure
    .input(z.object({ hotelId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.organizationId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "No organization context" })
      }

      await ctx.prisma.hotelOrganization.delete({
        where: {
          hotelId_organizationId: {
            hotelId: input.hotelId,
            organizationId: ctx.organizationId,
          },
        },
      })
    }),

  /** Returns the org-specific contact stored on the join (null if no override). */
  getOrgContact: orgProcedure
    .input(z.object({ hotelId: z.string() }))
    .query(async ({ ctx, input }) => {
      if (!ctx.organizationId) return null
      const link = await ctx.prisma.hotelOrganization.findUnique({
        where: {
          hotelId_organizationId: {
            hotelId: input.hotelId,
            organizationId: ctx.organizationId,
          },
        },
      })
      return link ? { contactPerson: link.contactPerson, contactPhone: link.contactPhone } : null
    }),

  /** Update the org-specific contact person/phone for a linked hotel. */
  updateOrgHotelContact: managerProcedure
    .input(
      z.object({
        hotelId: z.string(),
        contactPerson: z.string().optional(),
        contactPhone: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (!ctx.organizationId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "No organization context" })
      }

      const link = await ctx.prisma.hotelOrganization.update({
        where: {
          hotelId_organizationId: {
            hotelId: input.hotelId,
            organizationId: ctx.organizationId,
          },
        },
        data: {
          contactPerson: input.contactPerson ?? null,
          contactPhone: input.contactPhone ?? null,
        },
      })

      const hotel = await ctx.prisma.hotel.findUnique({ where: { id: input.hotelId } })
      if (!hotel) throw new TRPCError({ code: "NOT_FOUND" })
      return mapHotel(hotel, link)
    }),
})
