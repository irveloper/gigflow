import { z } from "zod"
import bcrypt from "bcryptjs"
import { TRPCError } from "@trpc/server"
import { router, managerProcedure } from "@/server/trpc"
import { RegisterInputSchema, UserRoleSchema } from "@/entities/user/schema"
import type { User } from "@/shared/types"

const AdminCreateUserSchema = RegisterInputSchema

export const adminRouter = router({
  listUsers: managerProcedure.query(async ({ ctx }) => {
    const users = await ctx.prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
    })
    return users.map((u) => ({
      ...u,
      role: u.role ?? null,
      createdAt: u.createdAt.toISOString(),
    }))
  }),

  createUser: managerProcedure.input(AdminCreateUserSchema).mutation(async ({ ctx, input }) => {
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
        shows: input.shows ?? [],
        hourlyRate: input.hourlyRate ?? null,
        location: input.location ?? null,
        contactPerson: input.contactPerson ?? null,
      },
    })

    const user: User = {
      id: dbUser.id,
      email: dbUser.email,
      name: dbUser.name,
      role: dbUser.role as User["role"],
      phone: dbUser.phone ?? undefined,
      shows: dbUser.shows,
      hourlyRate: dbUser.hourlyRate ?? undefined,
      location: dbUser.location ?? undefined,
      contactPerson: dbUser.contactPerson ?? undefined,
      isActive: dbUser.isActive,
      createdAt: dbUser.createdAt.toISOString(),
    }

    return user
  }),

  deactivateUser: managerProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const user = await ctx.prisma.user.findUnique({ where: { id: input.id } })
      if (!user) throw new TRPCError({ code: "NOT_FOUND" })
      if (user.id === ctx.session.user.id) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Cannot deactivate your own account." })
      }

      await ctx.prisma.user.update({
        where: { id: input.id },
        data: { isActive: false },
      })

      return { success: true }
    }),
})
