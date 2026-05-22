import { z } from "zod"
import { TRPCError } from "@trpc/server"
import { router, orgProcedure, managerProcedure, protectedProcedure } from "@/server/trpc"
import { CreateEventInputSchema, EventSchema, PaymentStatusSchema } from "@/entities/event/schema"
import { CursorPaginationInputSchema } from "@/specs/entities/pagination.schema"
import { eventsOverlap } from "@/entities/event/lib"
import { writeEventAuditEntry, diffEventFields } from "@/server/lib/audit"
import type { Event } from "@/shared/types"
import type { PrismaClient } from "@prisma/client"

type ConflictCheckInput = {
  date: string
  time: string
  sets: number
  musicianId?: string | null
  bandId?: string | null
  organizationId: string
}

/**
 * Asserts no scheduling conflict for the given performer on the given date/time.
 * Throws TRPCError if a conflict is found.
 */
async function assertNoPerformerConflict({
  ctx,
  input,
  ignoreEventId,
}: {
  ctx: { prisma: PrismaClient }
  input: ConflictCheckInput
  ignoreEventId?: string
}) {
  if (!input.musicianId && !input.bandId) return

  // Load all non-cancelled events on same date in the org
  const existingEvents = await ctx.prisma.event.findMany({
    where: {
      organizationId: input.organizationId,
      date: input.date,
      status: { not: "cancelled" },
      ...(ignoreEventId ? { id: { not: ignoreEventId } } : {}),
    },
    select: {
      id: true,
      time: true,
      sets: true,
      date: true,
      musicianId: true,
      bandId: true,
    },
  })

  const candidate = { date: input.date, time: input.time, sets: input.sets }

  for (const event of existingEvents) {
    const existing = { date: event.date, time: event.time, sets: event.sets }
    if (!eventsOverlap(candidate, existing)) continue

    // Solo booking conflict checks
    if (input.musicianId) {
      // solo vs solo
      if (event.musicianId === input.musicianId) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Musician is already booked at this time",
        })
      }
      // solo vs band (musician is member of band in existing event)
      if (event.bandId) {
        const memberLink = await ctx.prisma.bandMember.findUnique({
          where: { bandId_musicianId: { bandId: event.bandId, musicianId: input.musicianId } },
        })
        if (memberLink) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "Musician is already performing with a band at this time",
          })
        }
      }
    }

    // Band booking conflict checks
    if (input.bandId) {
      const candidateMembers = await ctx.prisma.bandMember.findMany({
        where: { bandId: input.bandId },
        select: { musicianId: true },
      })
      const candidateMemberIds = candidateMembers.map((m) => m.musicianId)

      // band vs solo
      if (event.musicianId && candidateMemberIds.includes(event.musicianId)) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "A band member is already booked solo at this time",
        })
      }

      // band vs band (any shared member)
      if (event.bandId) {
        const existingMembers = await ctx.prisma.bandMember.findMany({
          where: { bandId: event.bandId },
          select: { musicianId: true },
        })
        const existingMemberIds = existingMembers.map((m) => m.musicianId)
        const hasSharedMember = candidateMemberIds.some((id) => existingMemberIds.includes(id))
        if (hasSharedMember) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "A band member is already performing with another band at this time",
          })
        }
      }
    }
  }
}

function mapEvent(e: {
  id: string
  title: string
  description: string | null
  date: string
  time: string
  sets: number
  hotel: string
  hotelId: string | null
  musician: string | null
  musicianId: string | null
  band: string | null
  bandId: string | null
  status: string
  checkedIn: boolean
  checkInTime: Date | null
  checkInPhoto: string | null
  checkInLocation: unknown
  checkInComments: string | null
  price?: number | null
  paymentStatus?: string | null
  paymentNotes?: string | null
  organizationId?: string | null
  organization?: { name: string; slug: string } | null
}): Event {
  return {
    id: e.id,
    title: e.title,
    description: e.description ?? undefined,
    date: e.date,
    time: e.time,
    sets: e.sets,
    hotel: e.hotel,
    hotelId: e.hotelId ?? undefined,
    musician: e.musician ?? undefined,
    musicianId: e.musicianId ?? undefined,
    band: e.band ?? undefined,
    bandId: e.bandId ?? undefined,
    status: e.status as Event["status"],
    price: e.price ?? null,
    paymentStatus: (e.paymentStatus as Event["paymentStatus"]) ?? "pending",
    paymentNotes: e.paymentNotes ?? null,
    checkedIn: e.checkedIn,
    checkInTime: e.checkInTime?.toISOString(),
    checkInPhoto: e.checkInPhoto ?? undefined,
    checkInLocation: EventSchema.shape.checkInLocation.catch(undefined).parse(e.checkInLocation ?? undefined),
    checkInComments: e.checkInComments ?? undefined,
    organizationName: e.organization?.name,
    organizationSlug: e.organization?.slug,
  }
}

export const eventsRouter = router({
  /**
   * Returns events scoped to the calling org with cursor-based pagination.
   * Musicians: see all their own events across all orgs (cross-org view).
   * Superadmin: no filter.
   * Returns { items, nextCursor, total }.
   */
  getAll: orgProcedure.input(CursorPaginationInputSchema).query(async ({ ctx, input }) => {
    const { role, email } = ctx.session.user
    const { limit, cursor } = input

    if (role === "musician") {
      const musicianRecord = await ctx.prisma.musician.findUnique({ where: { email: email! } })
      if (!musicianRecord) return { items: [], nextCursor: null, total: 0 }

      // Include events where musician is solo performer OR member of booked band
      const bandLinks = await ctx.prisma.bandMember.findMany({
        where: { musicianId: musicianRecord.id },
        select: { bandId: true },
      })
      const bandIds = bandLinks.map((l) => l.bandId)

      const where = {
        OR: [
          { musicianId: musicianRecord.id },
          ...(bandIds.length > 0 ? [{ bandId: { in: bandIds } }] : []),
        ],
      }
      const [rows, total] = await Promise.all([
        ctx.prisma.event.findMany({
          where,
          orderBy: [{ date: "asc" }, { id: "asc" }],
          take: limit + 1,
          ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
          include: { organization: { select: { name: true, slug: true } } },
        }),
        ctx.prisma.event.count({ where }),
      ])

      let nextCursor: string | null = null
      if (rows.length > limit) {
        nextCursor = rows[limit].id
        rows.pop()
      }
      return { items: rows.map(mapEvent), nextCursor, total }
    }

    // Org-scoped for manager/hotel/superadmin
    const where = ctx.organizationId ? { organizationId: ctx.organizationId } : {}
    const [rows, total] = await Promise.all([
      ctx.prisma.event.findMany({
        where,
        orderBy: [{ date: "asc" }, { id: "asc" }],
        take: limit + 1,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      }),
      ctx.prisma.event.count({ where }),
    ])

    let nextCursor: string | null = null
    if (rows.length > limit) {
      nextCursor = rows[limit].id
      rows.pop()
    }
    return { items: rows.map(mapEvent), nextCursor, total }
  }),

  /**
   * Returns a single event by id.
   * Musicians: may access any event they are assigned to.
   * Org users: restricted to their org's events.
   */
  getById: orgProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const row = await ctx.prisma.event.findUnique({ where: { id: input.id } })
      if (!row) throw new TRPCError({ code: "NOT_FOUND" })

      const role = ctx.session.user.role

      if (role === "musician") {
        const musicianRecord = await ctx.prisma.musician.findUnique({
          where: { email: ctx.session.user.email! },
        })
        if (!musicianRecord || row.musicianId !== musicianRecord.id) {
          throw new TRPCError({ code: "FORBIDDEN" })
        }
        return mapEvent(row)
      }

      if (ctx.organizationId && row.organizationId !== ctx.organizationId) {
        throw new TRPCError({ code: "FORBIDDEN" })
      }

      return mapEvent(row)
    }),

  /**
   * Create an event scoped to the calling org.
   * Validates that the hotel and musician are both linked to the org.
   */
  create: managerProcedure
    .input(CreateEventInputSchema)
    .mutation(async ({ ctx, input }) => {
      if (!ctx.organizationId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "No organization context" })
      }

      if (input.musicianId && input.bandId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "An event cannot have both a solo musician and a band",
        })
      }

      if (input.hotelId) {
        const hotelLink = await ctx.prisma.hotelOrganization.findUnique({
          where: {
            hotelId_organizationId: {
              hotelId: input.hotelId,
              organizationId: ctx.organizationId,
            },
          },
        })
        if (!hotelLink) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Hotel not linked to your organization",
          })
        }
      }

      if (input.musicianId) {
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
            message: "Musician not linked to your organization",
          })
        }
      }

      if (input.bandId) {
        const bandLink = await ctx.prisma.bandOrganization.findUnique({
          where: {
            bandId_organizationId: {
              bandId: input.bandId,
              organizationId: ctx.organizationId,
            },
          },
        })
        if (!bandLink) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Band not linked to your organization",
          })
        }
      }

      // Server-side scheduling conflict detection
      await assertNoPerformerConflict({ ctx, input: { ...input, organizationId: ctx.organizationId } })

      // Look up performer rate — locked at booking time
      let performerRate: number | null = null
      if (input.musicianId) {
        const musician = await ctx.prisma.musician.findUnique({
          where: { id: input.musicianId },
          select: { pricePerSet: true },
        })
        performerRate = musician?.pricePerSet ?? null
      } else if (input.bandId) {
        const band = await ctx.prisma.band.findUnique({
          where: { id: input.bandId },
          select: { pricePerSet: true },
        })
        performerRate = band?.pricePerSet ?? null
      }

      if ((input.musicianId || input.bandId) && performerRate === null) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "El artista no tiene tarifa por set configurada. Configura la tarifa antes de crear el evento.",
        })
      }

      const price = performerRate !== null ? performerRate * input.sets : null

      const row = await ctx.prisma.event.create({
        data: {
          title: input.title,
          description: input.description ?? null,
          date: input.date,
          time: input.time,
          sets: input.sets,
          hotel: input.hotel,
          hotelId: input.hotelId ?? null,
          musician: input.musician ?? null,
          musicianId: input.musicianId ?? null,
          band: input.band ?? null,
          bandId: input.bandId ?? null,
          status: input.status,
          price,
          organizationId: ctx.organizationId,
        },
      })

      await writeEventAuditEntry(ctx.prisma, {
        eventId: row.id,
        organizationId: ctx.organizationId,
        actorId: ctx.session.user.id,
        actorName: ctx.session.user.name ?? ctx.session.user.email ?? "Unknown",
        actorRole: "manager",
        action: "EVENT_CREATED",
        metadata: { title: row.title },
      })

      return mapEvent(row)
    }),

  update: managerProcedure
    .input(z.object({ id: z.string(), data: EventSchema.partial() }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.organizationId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "No organization context" })
      }

      const existing = await ctx.prisma.event.findUnique({ where: { id: input.id } })
      if (!existing) throw new TRPCError({ code: "NOT_FOUND" })
      if (existing.organizationId !== ctx.organizationId) {
        throw new TRPCError({ code: "FORBIDDEN" })
      }

      if (input.data.musicianId && input.data.bandId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "An event cannot have both a solo musician and a band",
        })
      }

      // Merge existing event with incoming partial data to build candidate for conflict check
      if (input.data.musicianId || input.data.bandId || input.data.date || input.data.time || input.data.sets) {
        const merged = {
          ...existing,
          ...input.data,
          organizationId: ctx.organizationId!,
        }
        await assertNoPerformerConflict({ ctx, input: merged, ignoreEventId: input.id })
      }

      // Recalculate price when sets or performer changes
      let updatedPrice: number | null | undefined = undefined
      const performerChanged = input.data.musicianId !== undefined || input.data.bandId !== undefined
      const setsChanged = input.data.sets !== undefined
      if (performerChanged || setsChanged) {
        const effectiveMusicianId = input.data.musicianId !== undefined ? input.data.musicianId : existing.musicianId
        const effectiveBandId = input.data.bandId !== undefined ? input.data.bandId : existing.bandId
        const effectiveSets = input.data.sets !== undefined ? input.data.sets : existing.sets

        let performerRate: number | null = null
        if (effectiveMusicianId) {
          const musician = await ctx.prisma.musician.findUnique({
            where: { id: effectiveMusicianId },
            select: { pricePerSet: true },
          })
          performerRate = musician?.pricePerSet ?? null
        } else if (effectiveBandId) {
          const band = await ctx.prisma.band.findUnique({
            where: { id: effectiveBandId },
            select: { pricePerSet: true },
          })
          performerRate = band?.pricePerSet ?? null
        }

        if ((effectiveMusicianId || effectiveBandId) && performerRate === null) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "El artista no tiene tarifa por set configurada. Configura la tarifa antes de guardar el evento.",
          })
        }

        updatedPrice = performerRate !== null ? performerRate * effectiveSets : null
      }

      const diff = diffEventFields(existing, input.data)
      const actorBase = {
        eventId: input.id,
        organizationId: ctx.organizationId,
        actorId: ctx.session.user.id,
        actorName: ctx.session.user.name ?? ctx.session.user.email ?? "Unknown",
        actorRole: "manager" as const,
      }

      const row = await ctx.prisma.event.update({
        where: { id: input.id },
        data: {
          title: input.data.title,
          description: input.data.description ?? null,
          date: input.data.date,
          time: input.data.time,
          sets: input.data.sets,
          hotel: input.data.hotel,
          hotelId: input.data.hotelId ?? null,
          musician: input.data.musician ?? null,
          musicianId: input.data.musicianId ?? null,
          band: input.data.band ?? null,
          bandId: input.data.bandId ?? null,
          status: input.data.status,
          checkedIn: input.data.checkedIn,
          checkInTime: input.data.checkInTime ? new Date(input.data.checkInTime) : null,
          checkInPhoto: input.data.checkInPhoto ?? null,
          checkInLocation: input.data.checkInLocation ?? undefined,
          checkInComments: input.data.checkInComments ?? null,
          ...(updatedPrice !== undefined ? { price: updatedPrice } : {}),
        },
      })

      // Musician change
      if (diff.musicianChange) {
        const { from, to } = diff.musicianChange
        const action = from === null ? "MUSICIAN_ASSIGNED" : to === null ? "MUSICIAN_REMOVED" : "MUSICIAN_CHANGED"
        await writeEventAuditEntry(ctx.prisma, {
          ...actorBase,
          action,
          metadata: {
            from: from ? { musicianId: from, musicianName: existing.musician } : null,
            to: to ? { musicianId: to, musicianName: input.data.musician } : null,
          },
        })
      }

      // Band change
      if (diff.bandChange) {
        const { from, to } = diff.bandChange
        const action = from === null ? "BAND_ASSIGNED" : to === null ? "BAND_REMOVED" : "BAND_CHANGED"
        await writeEventAuditEntry(ctx.prisma, {
          ...actorBase,
          action,
          metadata: {
            from: from ? { bandId: from, bandName: existing.band } : null,
            to: to ? { bandId: to, bandName: input.data.band } : null,
          },
        })
      }

      // Status change
      if (diff.statusChange) {
        await writeEventAuditEntry(ctx.prisma, {
          ...actorBase,
          action: "STATUS_CHANGED",
          metadata: { from: diff.statusChange.from, to: diff.statusChange.to },
        })
      }

      // Sets change
      if (diff.fieldChanges.some((c) => c.field === "sets")) {
        const change = diff.fieldChanges.find((c) => c.field === "sets")!
        await writeEventAuditEntry(ctx.prisma, {
          ...actorBase,
          action: "SETS_CHANGE",
          metadata: { from: change.from, to: change.to },
        })
      }

      // Price change
      if (diff.priceChange) {
        await writeEventAuditEntry(ctx.prisma, {
          ...actorBase,
          action: "PRICE_CHANGED",
          metadata: { from: diff.priceChange.from, to: diff.priceChange.to },
        })
      }

      // Generic scalar field changes
      for (const change of diff.fieldChanges) {
        await writeEventAuditEntry(ctx.prisma, {
          ...actorBase,
          action: "FIELD_UPDATED",
          metadata: { field: change.field, from: change.from, to: change.to },
        })
      }

      return mapEvent(row)
    }),

  delete: managerProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.organizationId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "No organization context" })
      }

      const existing = await ctx.prisma.event.findUnique({ where: { id: input.id } })
      if (!existing) throw new TRPCError({ code: "NOT_FOUND" })
      if (existing.organizationId !== ctx.organizationId) {
        throw new TRPCError({ code: "FORBIDDEN" })
      }

      await writeEventAuditEntry(ctx.prisma, {
        eventId: existing.id,
        organizationId: existing.organizationId,
        actorId: ctx.session.user.id,
        actorName: ctx.session.user.name ?? ctx.session.user.email ?? "Unknown",
        actorRole: "manager",
        action: "EVENT_DELETED",
        metadata: { title: existing.title },
      })

      await ctx.prisma.event.delete({ where: { id: input.id } })
    }),

  /**
   * Check in to an event.
   * Musicians can check in to their own events; managers to any org event.
   */
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

      const role = ctx.session.user.role

      if (role === "musician") {
        // Musician can only check in to their own events
        const musicianRecord = await ctx.prisma.musician.findUnique({
          where: { email: ctx.session.user.email! },
        })
        if (!musicianRecord || row.musicianId !== musicianRecord.id) {
          throw new TRPCError({ code: "FORBIDDEN" })
        }
      } else if (ctx.organizationId && row.organizationId !== ctx.organizationId) {
        throw new TRPCError({ code: "FORBIDDEN" })
      }

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

      await writeEventAuditEntry(ctx.prisma, {
        eventId: row.id,
        organizationId: row.organizationId,
        actorId: ctx.session.user.id,
        actorName: ctx.session.user.name ?? ctx.session.user.email ?? "Unknown",
        actorRole: (ctx.session.user.role as "manager" | "musician") ?? "musician",
        action: "CHECK_IN_RECORDED",
        metadata: { time: input.timestamp, location: input.location ?? null },
      })

      return mapEvent(updated)
    }),

  /**
   * Update the payment status (and optional notes) for an event.
   * Manager-only. Writes a PAYMENT_STATUS_CHANGED audit entry.
   */
  updatePaymentStatus: managerProcedure
    .input(
      z.object({
        eventId: z.string(),
        paymentStatus: PaymentStatusSchema,
        paymentNotes: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (!ctx.organizationId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "No organization context" })
      }

      const existing = await ctx.prisma.event.findUnique({ where: { id: input.eventId } })
      if (!existing) throw new TRPCError({ code: "NOT_FOUND" })
      if (existing.organizationId !== ctx.organizationId) {
        throw new TRPCError({ code: "FORBIDDEN" })
      }

      const updated = await ctx.prisma.event.update({
        where: { id: input.eventId },
        data: {
          paymentStatus: input.paymentStatus,
          paymentNotes: input.paymentNotes ?? null,
        },
      })

      await writeEventAuditEntry(ctx.prisma, {
        eventId: existing.id,
        organizationId: ctx.organizationId,
        actorId: ctx.session.user.id,
        actorName: ctx.session.user.name ?? ctx.session.user.email ?? "Unknown",
        actorRole: "manager",
        action: "PAYMENT_STATUS_CHANGED",
        metadata: {
          from: existing.paymentStatus,
          to: input.paymentStatus,
          notes: input.paymentNotes ?? null,
        },
      })

      return mapEvent(updated)
    }),
})
