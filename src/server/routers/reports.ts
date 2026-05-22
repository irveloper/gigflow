import { z } from "zod"
import { router, orgProcedure } from "@/server/trpc"

const dateRangeInput = z.object({
  from: z.string().date(), // YYYY-MM-DD
  to: z.string().date(),   // YYYY-MM-DD (inclusive)
})

export const reportsRouter = router({
  /**
   * Returns aggregated KPIs and breakdowns for a given date range.
   * Scoped to the calling org.
   * totalPayout → pendingPayout (outstanding) + paidPayout (collected).
   */
  summary: orgProcedure
    .input(dateRangeInput)
    .query(async ({ ctx, input }) => {
      const where = {
        ...(ctx.organizationId ? { organizationId: ctx.organizationId } : {}),
        date: { gte: input.from, lte: input.to },
        status: { not: "cancelled" as const },
      }

      const events = await ctx.prisma.event.findMany({
        where,
        select: {
          id: true,
          date: true,
          sets: true,
          price: true,
          status: true,
          checkedIn: true,
          musicianId: true,
          musician: true,
          bandId: true,
          band: true,
          hotel: true,
          hotelId: true,
          paymentStatus: true,
        },
      })

      // KPIs
      const totalEvents = events.length
      const totalSets = events.reduce((sum, e) => sum + e.sets, 0)
      const pendingPayout = events
        .filter((e) => e.paymentStatus === "pending" && e.price !== null)
        .reduce((sum, e) => sum + (e.price ?? 0), 0)
      const paidPayout = events
        .filter((e) => e.paymentStatus === "paid" && e.price !== null)
        .reduce((sum, e) => sum + (e.price ?? 0), 0)
      const checkedInCount = events.filter((e) => e.checkedIn || e.status === "completed").length
      const checkInRate = totalEvents > 0 ? Math.round((checkedInCount / totalEvents) * 100) : 0

      // By musician (solo events only)
      const musicianMap = new Map<string, { name: string; events: number; sets: number; payout: number }>()
      for (const e of events) {
        if (!e.musicianId || !e.musician) continue
        const existing = musicianMap.get(e.musicianId) ?? { name: e.musician, events: 0, sets: 0, payout: 0 }
        musicianMap.set(e.musicianId, {
          name: existing.name,
          events: existing.events + 1,
          sets: existing.sets + e.sets,
          payout: existing.payout + (e.price ?? 0),
        })
      }

      // By band
      const bandMap = new Map<string, { name: string; events: number; sets: number; payout: number }>()
      for (const e of events) {
        if (!e.bandId || !e.band) continue
        const existing = bandMap.get(e.bandId) ?? { name: e.band, events: 0, sets: 0, payout: 0 }
        bandMap.set(e.bandId, {
          name: existing.name,
          events: existing.events + 1,
          sets: existing.sets + e.sets,
          payout: existing.payout + (e.price ?? 0),
        })
      }

      // By hotel
      const hotelMap = new Map<string, { name: string; events: number; sets: number; revenue: number }>()
      for (const e of events) {
        const key = e.hotelId ?? e.hotel
        const existing = hotelMap.get(key) ?? { name: e.hotel, events: 0, sets: 0, revenue: 0 }
        hotelMap.set(key, {
          name: existing.name,
          events: existing.events + 1,
          sets: existing.sets + e.sets,
          revenue: existing.revenue + (e.price ?? 0),
        })
      }

      // By month (YYYY-MM)
      const monthMap = new Map<string, { month: string; events: number; sets: number; payout: number }>()
      for (const e of events) {
        const month = e.date.slice(0, 7) // "YYYY-MM"
        const existing = monthMap.get(month) ?? { month, events: 0, sets: 0, payout: 0 }
        monthMap.set(month, {
          month: existing.month,
          events: existing.events + 1,
          sets: existing.sets + e.sets,
          payout: existing.payout + (e.price ?? 0),
        })
      }

      return {
        kpis: { totalEvents, totalSets, pendingPayout, paidPayout, checkInRate },
        byMusician: Array.from(musicianMap.values()).sort((a, b) => b.payout - a.payout),
        byBand: Array.from(bandMap.values()).sort((a, b) => b.payout - a.payout),
        byHotel: Array.from(hotelMap.values()).sort((a, b) => b.revenue - a.revenue),
        byMonth: Array.from(monthMap.values()).sort((a, b) => a.month.localeCompare(b.month)),
      }
    }),

  /**
   * Returns a flat list of non-cancelled events with payment fields for the Pagos tab.
   * Accessible to all org members (read-only).
   */
  payments: orgProcedure
    .input(dateRangeInput)
    .query(async ({ ctx, input }) => {
      const where = {
        ...(ctx.organizationId ? { organizationId: ctx.organizationId } : {}),
        date: { gte: input.from, lte: input.to },
        status: { not: "cancelled" as const },
      }

      const events = await ctx.prisma.event.findMany({
        where,
        select: {
          id: true,
          title: true,
          date: true,
          hotel: true,
          hotelId: true,
          musician: true,
          musicianId: true,
          band: true,
          bandId: true,
          sets: true,
          price: true,
          paymentStatus: true,
          paymentNotes: true,
          status: true,
        },
        orderBy: [{ date: "asc" }, { id: "asc" }],
      })

      const pendingTotal = events
        .filter((e) => e.paymentStatus === "pending" && e.price !== null)
        .reduce((sum, e) => sum + (e.price ?? 0), 0)

      const paidTotal = events
        .filter((e) => e.paymentStatus === "paid" && e.price !== null)
        .reduce((sum, e) => sum + (e.price ?? 0), 0)

      return {
        events: events.map((e) => ({
          id: e.id,
          title: e.title,
          date: e.date,
          hotel: e.hotel,
          hotelId: e.hotelId,
          performer: e.musician ?? e.band ?? null,
          musicianId: e.musicianId,
          bandId: e.bandId,
          sets: e.sets,
          price: e.price,
          paymentStatus: e.paymentStatus as "pending" | "paid",
          paymentNotes: e.paymentNotes,
          status: e.status,
        })),
        pendingTotal,
        paidTotal,
      }
    }),
})
