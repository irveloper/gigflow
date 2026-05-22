import { z } from "zod"
import { TRPCError } from "@trpc/server"
import { router, protectedProcedure } from "@/server/trpc"
import { CreateNotificationInputSchema } from "@/entities/notification/schema"
import { writeEventAuditEntry } from "@/server/lib/audit"
import type { Notification } from "@/shared/types"

function mapNotification(n: {
  id: string
  userId: string
  title: string
  message: string
  type: string
  read: boolean
  timestamp: Date
  actionUrl: string | null
  actionText: string | null
  eventId: string | null
}): Notification {
  return {
    id: n.id,
    userId: n.userId,
    title: n.title,
    message: n.message,
    type: n.type as Notification["type"],
    read: n.read,
    timestamp: n.timestamp.toISOString(),
    actionUrl: n.actionUrl ?? undefined,
    actionText: n.actionText ?? undefined,
    eventId: n.eventId ?? undefined,
  }
}

export const notificationsRouter = router({
  getAll: protectedProcedure
    .input(z.object({ userId: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      // Always scope to the authenticated user — ignore any client-supplied userId
      const userId = ctx.session.user.id
      if (input.userId && input.userId !== userId) {
        throw new TRPCError({ code: "FORBIDDEN" })
      }
      const rows = await ctx.prisma.notification.findMany({
        where: { userId },
        orderBy: { timestamp: "desc" },
      })
      return rows.map(mapNotification)
    }),

  create: protectedProcedure
    .input(CreateNotificationInputSchema)
    .mutation(async ({ ctx, input }) => {
      // Force userId to session user — cannot create notifications for others
      const row = await ctx.prisma.notification.create({
        data: {
          userId: ctx.session.user.id,
          title: input.title,
          message: input.message,
          type: input.type,
          read: input.read ?? false,
          actionUrl: input.actionUrl ?? null,
          actionText: input.actionText ?? null,
          eventId: input.eventId ?? null,
        },
      })

      if (input.eventId) {
        const event = await ctx.prisma.event.findUnique({
          where: { id: input.eventId },
          select: { organizationId: true },
        })
        if (event) {
          await writeEventAuditEntry(ctx.prisma, {
            eventId: input.eventId,
            organizationId: event.organizationId,
            actorId: ctx.session.user.id,
            actorName: ctx.session.user.name ?? ctx.session.user.email ?? "Unknown",
            actorRole: "manager",
            action: "INVITATION_SENT",
            metadata: { userId: ctx.session.user.id, notificationId: row.id },
          })
        }
      }

      return mapNotification(row)
    }),

  markRead: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.prisma.notification.findUnique({
        where: { id: input.id },
        select: { userId: true, eventId: true },
      })
      if (!existing) throw new TRPCError({ code: "NOT_FOUND" })
      if (existing.userId !== ctx.session.user.id) throw new TRPCError({ code: "FORBIDDEN" })
      await ctx.prisma.notification.update({
        where: { id: input.id },
        data: { read: true },
      })

      if (existing.eventId) {
        const event = await ctx.prisma.event.findUnique({
          where: { id: existing.eventId },
          select: { organizationId: true },
        })
        if (event) {
          await writeEventAuditEntry(ctx.prisma, {
            eventId: existing.eventId,
            organizationId: event.organizationId,
            actorId: ctx.session.user.id,
            actorName: ctx.session.user.name ?? ctx.session.user.email ?? "Unknown",
            actorRole: (ctx.session.user.role as "manager" | "musician") ?? "musician",
            action: "INVITATION_READ",
            metadata: { notificationId: input.id },
          })
        }
      }
    }),

  markAllRead: protectedProcedure.mutation(async ({ ctx }) => {
    const userId = ctx.session.user.id

    // Fetch event-linked unread notifications before bulk update for audit purposes
    const eventLinked = await ctx.prisma.notification.findMany({
      where: { userId, read: false, eventId: { not: null } },
      select: { id: true, eventId: true },
    })

    await ctx.prisma.notification.updateMany({
      where: { userId },
      data: { read: true },
    })

    // Write one INVITATION_READ entry per event-linked notification
    for (const notif of eventLinked) {
      if (!notif.eventId) continue
      const event = await ctx.prisma.event.findUnique({
        where: { id: notif.eventId },
        select: { organizationId: true },
      })
      if (event) {
        await writeEventAuditEntry(ctx.prisma, {
          eventId: notif.eventId,
          organizationId: event.organizationId,
          actorId: userId,
          actorName: ctx.session.user.name ?? ctx.session.user.email ?? "Unknown",
          actorRole: (ctx.session.user.role as "manager" | "musician") ?? "musician",
          action: "INVITATION_READ",
          metadata: { notificationId: notif.id },
        })
      }
    }
  }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.prisma.notification.findUnique({
        where: { id: input.id },
        select: { userId: true },
      })
      if (!existing) throw new TRPCError({ code: "NOT_FOUND" })
      if (existing.userId !== ctx.session.user.id) throw new TRPCError({ code: "FORBIDDEN" })
      await ctx.prisma.notification.delete({ where: { id: input.id } })
    }),
})
