import { z } from "zod"
import { TRPCError } from "@trpc/server"
import { router, managerProcedure } from "@/server/trpc"
import type { EventAuditLog } from "@/shared/types"

function mapAuditLog(row: {
  id: string
  eventId: string
  organizationId: string
  actorId: string | null
  actorName: string
  actorRole: string
  action: string
  metadata: unknown
  timestamp: Date
}): EventAuditLog {
  return {
    id: row.id,
    eventId: row.eventId,
    organizationId: row.organizationId,
    actorId: row.actorId,
    actorName: row.actorName,
    actorRole: row.actorRole as EventAuditLog["actorRole"],
    action: row.action as EventAuditLog["action"],
    metadata: (row.metadata as Record<string, unknown>) ?? null,
    timestamp: row.timestamp.toISOString(),
  }
}

export const eventAuditLogsRouter = router({
  list: managerProcedure
    .input(
      z.object({
        eventId: z.string(),
        limit: z.number().min(1).max(200).default(20),
        offset: z.number().min(0).default(0),
      }),
    )
    .query(async ({ ctx, input }) => {
      if (!ctx.organizationId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "No organization context" })
      }

      // Verify event belongs to this org — never trust client-supplied org
      const event = await ctx.prisma.event.findUnique({
        where: { id: input.eventId },
        select: { organizationId: true },
      })
      if (!event || event.organizationId !== ctx.organizationId) {
        throw new TRPCError({ code: "FORBIDDEN" })
      }

      const [items, total] = await Promise.all([
        ctx.prisma.eventAuditLog.findMany({
          where: { eventId: input.eventId },
          orderBy: { timestamp: "desc" },
          take: input.limit,
          skip: input.offset,
        }),
        ctx.prisma.eventAuditLog.count({
          where: { eventId: input.eventId },
        }),
      ])

      return {
        items: items.map(mapAuditLog),
        total,
      }
    }),
})
