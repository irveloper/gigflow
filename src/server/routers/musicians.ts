import crypto from "node:crypto"
import { z } from "zod"
import { TRPCError } from "@trpc/server"
import { router, orgProcedure, managerProcedure, protectedProcedure } from "@/server/trpc"
import { CreateMusicianInputSchema, MusicianSchema } from "@/entities/musician/schema"
import { OffsetPaginationInputSchema } from "@/specs/entities/pagination.schema"
import { sendEmail } from "@/lib/email"
import { musicianInvite as musicianInviteTemplate } from "@/lib/email-templates"
import { env } from "@/lib/env"
import type { Musician } from "@/shared/types"

type PrismaMusician = {
  id: string
  name: string
  email: string
  phone: string
  instruments: string[]
  styles: string[]
  pricePerSet: number
  isActive: boolean
  avatar: string | null
  createdAt: Date
}

function mapMusician(m: PrismaMusician): Musician {
  return {
    id: m.id,
    name: m.name,
    email: m.email,
    phone: m.phone,
    instruments: m.instruments,
    styles: m.styles,
    pricePerSet: m.pricePerSet,
    isActive: m.isActive,
    avatar: m.avatar ?? undefined,
    createdAt: m.createdAt.toISOString(),
  }
}

export const musiciansRouter = router({
  /**
   * Returns musicians linked to the calling org with offset-based pagination.
   * Superadmin: returns all musicians (no org filter).
   * Returns { items, total }.
   */
  getAll: orgProcedure.input(OffsetPaginationInputSchema).query(async ({ ctx, input }) => {
    const { limit, offset } = input

    if (!ctx.organizationId) {
      const [rows, total] = await Promise.all([
        ctx.prisma.musician.findMany({ orderBy: { name: "asc" }, take: limit, skip: offset }),
        ctx.prisma.musician.count(),
      ])
      return { items: rows.map(mapMusician), total }
    }

    const [links, total] = await Promise.all([
      ctx.prisma.musicianOrganization.findMany({
        where: { organizationId: ctx.organizationId },
        include: { musician: true },
        orderBy: { musician: { name: "asc" } },
        take: limit,
        skip: offset,
      }),
      ctx.prisma.musicianOrganization.count({
        where: { organizationId: ctx.organizationId },
      }),
    ])
    return { items: links.map((l) => mapMusician(l.musician)), total }
  }),

  /** Search platform-wide musician directory (for linking UI). */
  search: orgProcedure
    .input(z.object({ query: z.string() }))
    .query(async ({ ctx, input }) => {
      const rows = await ctx.prisma.musician.findMany({
        where: {
          name: { contains: input.query, mode: "insensitive" },
        },
        orderBy: { name: "asc" },
        take: 20,
      })
      return rows.map(mapMusician)
    }),

  /**
   * Returns a musician by id.
   * Org users: verifies the musician is linked to their org.
   * Superadmin: no restriction.
   */
  getById: orgProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const row = await ctx.prisma.musician.findUnique({ where: { id: input.id } })
      if (!row) throw new TRPCError({ code: "NOT_FOUND" })

      if (ctx.organizationId) {
        const link = await ctx.prisma.musicianOrganization.findUnique({
          where: {
            musicianId_organizationId: {
              musicianId: input.id,
              organizationId: ctx.organizationId,
            },
          },
        })
        if (!link) throw new TRPCError({ code: "FORBIDDEN" })
      }

      return mapMusician(row)
    }),

  /**
   * Create a new musician and automatically link them to the calling org.
   */
  create: managerProcedure
    .input(CreateMusicianInputSchema)
    .mutation(async ({ ctx, input }) => {
      if (!ctx.organizationId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "No organization context" })
      }

      // Check if musician already exists by email
      const existing = await ctx.prisma.musician.findUnique({
        where: { email: input.email },
      })
      if (existing) {
        const link = await ctx.prisma.musicianOrganization.findUnique({
          where: {
            musicianId_organizationId: {
              musicianId: existing.id,
              organizationId: ctx.organizationId,
            },
          },
        })
        if (link) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "Este correo electrónico ya está registrado y conectado a tu organización.",
          })
        }
        throw new TRPCError({
          code: "CONFLICT",
          message: "Este correo electrónico ya está registrado en el sistema. Puedes buscar al músico por su nombre para conectarlo.",
        })
      }

      const row = await ctx.prisma.musician.create({
        data: {
          name: input.name,
          email: input.email,
          phone: input.phone,
          instruments: input.instruments,
          styles: input.styles,
          pricePerSet: input.pricePerSet,
          isActive: input.isActive ?? true,
          avatar: input.avatar ?? null,
        },
      })

      // Auto-link to calling org
      await ctx.prisma.musicianOrganization.create({
        data: { musicianId: row.id, organizationId: ctx.organizationId },
      })

      return mapMusician(row)
    }),

  /**
   * Update shared musician fields (applies to all orgs that share this musician).
   * Requires the musician to be linked to the calling org.
   */
  update: managerProcedure
    .input(MusicianSchema)
    .mutation(async ({ ctx, input }) => {
      if (!ctx.organizationId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "No organization context" })
      }

      const link = await ctx.prisma.musicianOrganization.findUnique({
        where: {
          musicianId_organizationId: {
            musicianId: input.id,
            organizationId: ctx.organizationId,
          },
        },
      })
      if (!link) throw new TRPCError({ code: "FORBIDDEN" })

      // Check if email is already taken by another musician
      const existing = await ctx.prisma.musician.findFirst({
        where: {
          email: input.email,
          id: { not: input.id },
        },
      })
      if (existing) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Este correo electrónico ya está registrado para otro músico.",
        })
      }

      const row = await ctx.prisma.musician.update({
        where: { id: input.id },
        data: {
          name: input.name,
          email: input.email,
          phone: input.phone,
          instruments: input.instruments,
          styles: input.styles,
          pricePerSet: input.pricePerSet,
          isActive: input.isActive,
          avatar: input.avatar ?? null,
        },
      })
      return mapMusician(row)
    }),

  /**
   * Unlink musician from org. Deletes the Musician record only if no other orgs use them.
   */
  delete: managerProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.organizationId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "No organization context" })
      }

      const link = await ctx.prisma.musicianOrganization.findUnique({
        where: {
          musicianId_organizationId: {
            musicianId: input.id,
            organizationId: ctx.organizationId,
          },
        },
      })
      if (!link) throw new TRPCError({ code: "FORBIDDEN" })

      await ctx.prisma.musicianOrganization.delete({
        where: {
          musicianId_organizationId: {
            musicianId: input.id,
            organizationId: ctx.organizationId,
          },
        },
      })

      const remainingLinks = await ctx.prisma.musicianOrganization.count({
        where: { musicianId: input.id },
      })
      if (remainingLinks === 0) {
        await ctx.prisma.musician.delete({ where: { id: input.id } })
      }
    }),

  /** Link an existing musician to the calling org. */
  linkMusician: managerProcedure
    .input(z.object({ musicianId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.organizationId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "No organization context" })
      }

      const musician = await ctx.prisma.musician.findUnique({
        where: { id: input.musicianId },
      })
      if (!musician) throw new TRPCError({ code: "NOT_FOUND" })

      await ctx.prisma.musicianOrganization.upsert({
        where: {
          musicianId_organizationId: {
            musicianId: input.musicianId,
            organizationId: ctx.organizationId,
          },
        },
        update: {},
        create: {
          musicianId: input.musicianId,
          organizationId: ctx.organizationId,
        },
      })

      return mapMusician(musician)
    }),

  /**
   * Returns current-month stats for the authenticated musician.
   * - performances: non-cancelled events this month
   * - hoursWorked: sum of sets / 60 (rounded)
   * - hotels: distinct hotel count
   * - punctuality: % of non-cancelled events where checkedIn = true
   */
  myStats: protectedProcedure.query(async ({ ctx }) => {
    const musician = await ctx.prisma.musician.findUnique({
      where: { email: ctx.session.user.email! },
    })
    if (!musician) return { performances: 0, hoursWorked: 0, hotels: 0, punctuality: 100 }

    const bandLinks = await ctx.prisma.bandMember.findMany({
      where: { musicianId: musician.id },
      select: { bandId: true },
    })
    const bandIds = bandLinks.map((l) => l.bandId)

    const now = new Date()
    const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1)
    const monthEnd = `${nextMonth.getFullYear()}-${String(nextMonth.getMonth() + 1).padStart(2, "0")}-01`

    const events = await ctx.prisma.event.findMany({
      where: {
        status: { not: "cancelled" },
        date: { gte: monthStart, lt: monthEnd },
        OR: [
          { musicianId: musician.id },
          ...(bandIds.length > 0 ? [{ bandId: { in: bandIds } }] : []),
        ],
      },
      select: { sets: true, hotel: true, checkedIn: true },
    })

    const performances = events.length
    const hoursWorked = Math.round(events.reduce((sum, e) => sum + e.sets, 0) / 60)
    const hotels = new Set(events.map((e) => e.hotel)).size
    const punctuality = performances === 0
      ? 100
      : Math.round((events.filter((e) => e.checkedIn).length / performances) * 100)

    return { performances, hoursWorked, hotels, punctuality }
  }),

  /** Remove the org-musician link (does not delete the musician record). */
  unlinkMusician: managerProcedure
    .input(z.object({ musicianId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.organizationId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "No organization context" })
      }

      await ctx.prisma.musicianOrganization.delete({
        where: {
          musicianId_organizationId: {
            musicianId: input.musicianId,
            organizationId: ctx.organizationId,
          },
        },
      })
    }),

  /**
   * Send a portal invite to a musician.
   * Generates a single-use token (72h expiry) and emails a set-password link.
   * Throws CONFLICT if the musician already has a User account.
   */
  invite: managerProcedure
    .input(z.object({ musicianId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.organizationId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "No organization context" })
      }

      // Verify musician is linked to this org
      const link = await ctx.prisma.musicianOrganization.findUnique({
        where: {
          musicianId_organizationId: {
            musicianId: input.musicianId,
            organizationId: ctx.organizationId,
          },
        },
      })
      if (!link) throw new TRPCError({ code: "FORBIDDEN" })

      const musician = await ctx.prisma.musician.findUnique({
        where: { id: input.musicianId },
        include: { userAccount: { select: { id: true } } },
      })
      if (!musician) throw new TRPCError({ code: "NOT_FOUND" })

      if (musician.userAccount) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Este músico ya tiene una cuenta de portal.",
        })
      }

      // Invalidate any existing pending invites for this musician
      await ctx.prisma.musicianInvite.deleteMany({ where: { musicianId: input.musicianId } })

      const token = crypto.randomBytes(32).toString("hex")
      const expires = new Date(Date.now() + 72 * 60 * 60 * 1000) // 72 hours

      await ctx.prisma.musicianInvite.create({
        data: {
          musicianId: musician.id,
          organizationId: ctx.organizationId,
          email: musician.email,
          token,
          expires,
        },
      })

      const org = await ctx.prisma.organization.findUnique({
        where: { id: ctx.organizationId },
        select: { name: true },
      })

      const inviteLink = `${env.NEXTAUTH_URL}/auth/accept-invite?token=${token}`
      const { subject, html } = musicianInviteTemplate(
        musician.name,
        org?.name ?? "Tu organización",
        inviteLink,
      )

      try {
        await sendEmail(musician.email, subject, html)
      } catch (err) {
        console.error("[musicians.invite] Failed to send invite email", err)
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "No se pudo enviar el correo de invitación.",
        })
      }

      return { sent: true }
    }),
})
