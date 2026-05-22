import { z } from "zod"
import { TRPCError } from "@trpc/server"
import { router, orgProcedure, managerProcedure } from "@/server/trpc"
import { CreateBandInputSchema } from "@/entities/band/schema"
import type { Band } from "@/shared/types"

type PrismaBand = {
  id: string
  name: string
  description: string | null
  genre: string | null
  pricePerSet: number | null
  isActive: boolean
  createdAt: Date
  members?: { musicianId: string }[]
}

function mapBand(b: PrismaBand): Band {
  return {
    id: b.id,
    name: b.name,
    description: b.description ?? undefined,
    genre: b.genre ?? undefined,
    pricePerSet: b.pricePerSet ?? undefined,
    isActive: b.isActive,
    createdAt: b.createdAt.toISOString(),
    members: b.members?.map((m) => m.musicianId),
  }
}

export const bandsRouter = router({
  /**
   * Returns active bands linked to the calling org (with members included).
   */
  getAll: orgProcedure.query(async ({ ctx }) => {
    if (!ctx.organizationId) {
      const rows = await ctx.prisma.band.findMany({
        where: { isActive: true },
        include: { members: { select: { musicianId: true } } },
        orderBy: { name: "asc" },
      })
      return rows.map(mapBand)
    }

    const links = await ctx.prisma.bandOrganization.findMany({
      where: { organizationId: ctx.organizationId },
      include: {
        band: {
          include: { members: { select: { musicianId: true } } },
        },
      },
      orderBy: { band: { name: "asc" } },
    })
    return links.filter((l) => l.band.isActive).map((l) => mapBand(l.band))
  }),

  /**
   * Returns a single band by id (org-scoped).
   */
  getById: orgProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const band = await ctx.prisma.band.findUnique({
        where: { id: input.id },
        include: { members: { select: { musicianId: true } } },
      })
      if (!band) throw new TRPCError({ code: "NOT_FOUND" })

      if (ctx.organizationId) {
        const link = await ctx.prisma.bandOrganization.findUnique({
          where: { bandId_organizationId: { bandId: input.id, organizationId: ctx.organizationId } },
        })
        if (!link) throw new TRPCError({ code: "FORBIDDEN" })
      }

      return mapBand(band)
    }),

  /**
   * Create a band with ≥2 members. Validates all members are linked to the org.
   * Auto-links the band to the calling org.
   */
  create: managerProcedure
    .input(CreateBandInputSchema)
    .mutation(async ({ ctx, input }) => {
      if (!ctx.organizationId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "No organization context" })
      }

      // Validate all members are linked to the org
      for (const musicianId of input.memberIds) {
        const link = await ctx.prisma.musicianOrganization.findUnique({
          where: {
            musicianId_organizationId: { musicianId, organizationId: ctx.organizationId },
          },
        })
        if (!link) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Musician ${musicianId} is not linked to your organization`,
          })
        }
      }

      const band = await ctx.prisma.band.create({
        data: {
          name: input.name,
          description: input.description ?? null,
          genre: input.genre ?? null,
          pricePerSet: input.pricePerSet ?? null,
          isActive: input.isActive ?? true,
          members: {
            create: input.memberIds.map((musicianId) => ({ musicianId })),
          },
          organizations: {
            create: { organizationId: ctx.organizationId },
          },
        },
        include: { members: { select: { musicianId: true } } },
      })

      return mapBand(band)
    }),

  /**
   * Update band metadata (name, description, genre).
   */
  update: managerProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().min(1).optional(),
        description: z.string().optional(),
        genre: z.string().optional(),
        pricePerSet: z.number().positive().nullable().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (!ctx.organizationId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "No organization context" })
      }

      const link = await ctx.prisma.bandOrganization.findUnique({
        where: { bandId_organizationId: { bandId: input.id, organizationId: ctx.organizationId } },
      })
      if (!link) throw new TRPCError({ code: "FORBIDDEN" })

      const band = await ctx.prisma.band.update({
        where: { id: input.id },
        data: {
          ...(input.name !== undefined && { name: input.name }),
          ...(input.description !== undefined && { description: input.description }),
          ...(input.genre !== undefined && { genre: input.genre }),
          ...(input.pricePerSet !== undefined && { pricePerSet: input.pricePerSet }),
        },
        include: { members: { select: { musicianId: true } } },
      })
      return mapBand(band)
    }),

  /**
   * Add a musician to a band. Validates musician is linked to the org.
   */
  addMember: managerProcedure
    .input(z.object({ bandId: z.string(), musicianId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.organizationId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "No organization context" })
      }

      const bandLink = await ctx.prisma.bandOrganization.findUnique({
        where: {
          bandId_organizationId: { bandId: input.bandId, organizationId: ctx.organizationId },
        },
      })
      if (!bandLink) throw new TRPCError({ code: "FORBIDDEN" })

      const musicianLink = await ctx.prisma.musicianOrganization.findUnique({
        where: {
          musicianId_organizationId: {
            musicianId: input.musicianId,
            organizationId: ctx.organizationId,
          },
        },
      })
      if (!musicianLink) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Musician is not linked to your organization",
        })
      }

      await ctx.prisma.bandMember.upsert({
        where: { bandId_musicianId: { bandId: input.bandId, musicianId: input.musicianId } },
        update: {},
        create: { bandId: input.bandId, musicianId: input.musicianId },
      })

      const band = await ctx.prisma.band.findUnique({
        where: { id: input.bandId },
        include: { members: { select: { musicianId: true } } },
      })
      return mapBand(band!)
    }),

  /**
   * Remove a musician from a band.
   * Validates band will still have ≥2 members after removal.
   */
  removeMember: managerProcedure
    .input(z.object({ bandId: z.string(), musicianId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.organizationId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "No organization context" })
      }

      const bandLink = await ctx.prisma.bandOrganization.findUnique({
        where: {
          bandId_organizationId: { bandId: input.bandId, organizationId: ctx.organizationId },
        },
      })
      if (!bandLink) throw new TRPCError({ code: "FORBIDDEN" })

      // Check member count before removal using a transaction
      const result = await ctx.prisma.$transaction(async (tx) => {
        const currentCount = await tx.bandMember.count({ where: { bandId: input.bandId } })
        if (currentCount <= 2) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "A band must have at least 2 members. Remove the band instead.",
          })
        }
        await tx.bandMember.delete({
          where: { bandId_musicianId: { bandId: input.bandId, musicianId: input.musicianId } },
        })
        return tx.band.findUnique({
          where: { id: input.bandId },
          include: { members: { select: { musicianId: true } } },
        })
      })

      return mapBand(result!)
    }),

  /**
   * Soft-delete a band (sets isActive: false). Band remains on historical events.
   */
  deactivate: managerProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.organizationId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "No organization context" })
      }

      const link = await ctx.prisma.bandOrganization.findUnique({
        where: { bandId_organizationId: { bandId: input.id, organizationId: ctx.organizationId } },
      })
      if (!link) throw new TRPCError({ code: "FORBIDDEN" })

      const band = await ctx.prisma.band.update({
        where: { id: input.id },
        data: { isActive: false },
        include: { members: { select: { musicianId: true } } },
      })
      return mapBand(band)
    }),
})
