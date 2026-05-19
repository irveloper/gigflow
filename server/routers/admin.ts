import { z } from "zod"
import bcrypt from "bcryptjs"
import { TRPCError } from "@trpc/server"
import { router, managerProcedure, superAdminProcedure } from "@/server/trpc"
import { RegisterInputSchema, UserRoleSchema } from "@/entities/user/schema"
import { OffsetPaginationInputSchema } from "@/specs/entities/pagination.schema"
import type { User } from "@/shared/types"

const AdminCreateUserSchema = RegisterInputSchema

export const adminRouter = router({
  /** List users in the calling org with offset-based pagination. Returns { items, total }. */
  listUsers: managerProcedure.input(OffsetPaginationInputSchema).query(async ({ ctx, input }) => {
    const where = ctx.organizationId ? { organizationId: ctx.organizationId } : {}
    const { limit, offset } = input

    const [users, total] = await Promise.all([
      ctx.prisma.user.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          isActive: true,
          organizationId: true,
          createdAt: true,
        },
      }),
      ctx.prisma.user.count({ where }),
    ])

    return {
      items: users.map((u) => ({
        ...u,
        role: u.role ?? null,
        createdAt: u.createdAt.toISOString(),
      })),
      total,
    }
  }),

  /** Create a user and assign them to the calling org. Blocked if seat limit reached. */
  createUser: managerProcedure.input(AdminCreateUserSchema).mutation(async ({ ctx, input }) => {
    if (!ctx.organizationId) {
      throw new TRPCError({ code: "FORBIDDEN", message: "No organization context" })
    }

    // Enforce seat limit
    const sub = await ctx.prisma.subscription.findUnique({
      where: { organizationId: ctx.organizationId },
      select: { seatLimit: true },
    })
    if (sub) {
      const activeCount = await ctx.prisma.user.count({
        where: { organizationId: ctx.organizationId, isActive: true },
      })
      if (activeCount >= sub.seatLimit) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "SEAT_LIMIT_REACHED",
        })
      }
    }

    const exists = await ctx.prisma.user.findUnique({ where: { email: input.email } })
    if (exists) throw new TRPCError({ code: "CONFLICT", message: "Email ya registrado" })

    const hashed = await bcrypt.hash(input.password, 12)

    const dbUser = await ctx.prisma.user.create({
      data: {
        email: input.email,
        name: input.name,
        password: hashed,
        role: input.role,
        phone: input.phone ?? null,
        instruments: input.instruments ?? [],
        styles: input.styles ?? [],
        hourlyRate: input.hourlyRate ?? null,
        location: input.location ?? null,
        contactPerson: input.contactPerson ?? null,
        organizationId: ctx.organizationId,
      },
    })

    const user: User = {
      id: dbUser.id,
      email: dbUser.email,
      name: dbUser.name,
      role: dbUser.role as User["role"],
      phone: dbUser.phone ?? undefined,
      instruments: dbUser.instruments,
      styles: dbUser.styles,
      hourlyRate: dbUser.hourlyRate ?? undefined,
      location: dbUser.location ?? undefined,
      contactPerson: dbUser.contactPerson ?? undefined,
      isActive: dbUser.isActive,
      createdAt: dbUser.createdAt.toISOString(),
    }

    return user
  }),

  /** Deactivate a user within the calling org. */
  deactivateUser: managerProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const user = await ctx.prisma.user.findUnique({ where: { id: input.id } })
      if (!user) throw new TRPCError({ code: "NOT_FOUND" })
      if (user.id === ctx.session.user.id) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Cannot deactivate your own account." })
      }
      // Ensure the target user belongs to the calling manager's org
      if (ctx.organizationId && user.organizationId !== ctx.organizationId) {
        throw new TRPCError({ code: "FORBIDDEN" })
      }

      await ctx.prisma.user.update({
        where: { id: input.id },
        data: { isActive: false },
      })

      return { success: true }
    }),

  /** Reactivate a previously deactivated user within the calling org. */
  reactivateUser: managerProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const user = await ctx.prisma.user.findUnique({ where: { id: input.id } })
      if (!user) throw new TRPCError({ code: "NOT_FOUND" })
      if (ctx.organizationId && user.organizationId !== ctx.organizationId) {
        throw new TRPCError({ code: "FORBIDDEN" })
      }

      await ctx.prisma.user.update({
        where: { id: input.id },
        data: { isActive: true },
      })

      return { success: true }
    }),

  /**
   * Paginated login audit log for the calling org's users.
   * Manager sees their org's users only; superadmin sees all.
   */
  listLoginHistory: managerProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(100).default(50),
        offset: z.number().min(0).default(0),
      }),
    )
    .query(async ({ ctx, input }) => {
      // Get emails of users in this org to scope the log
      let emailFilter: { in: string[] } | undefined
      if (ctx.organizationId) {
        const users = await ctx.prisma.user.findMany({
          where: { organizationId: ctx.organizationId },
          select: { email: true },
        })
        emailFilter = { in: users.map((u) => u.email) }
      }

      const [items, total] = await Promise.all([
        ctx.prisma.loginAuditLog.findMany({
          where: emailFilter ? { email: emailFilter } : {},
          orderBy: { timestamp: "desc" },
          take: input.limit,
          skip: input.offset,
        }),
        ctx.prisma.loginAuditLog.count({
          where: emailFilter ? { email: emailFilter } : {},
        }),
      ])

      return {
        items: items.map((log) => ({
          ...log,
          timestamp: log.timestamp.toISOString(),
        })),
        total,
      }
    }),
})
