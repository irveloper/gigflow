import { z } from "zod"
import bcrypt from "bcryptjs"
import { TRPCError } from "@trpc/server"
import { router, publicProcedure, protectedProcedure } from "@/server/trpc"
import { RegisterInputSchema } from "@/entities/user/schema"
import type { User } from "@/shared/types"

export const authRouter = router({
  register: publicProcedure
    .input(RegisterInputSchema)
    .mutation(async ({ ctx, input }) => {
      if (input.role === "manager") throw new TRPCError({ code: "FORBIDDEN", message: "Manager accounts must be created by an administrator." })

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

  me: protectedProcedure.query(async ({ ctx }) => {
    const dbUser = await ctx.prisma.user.findUnique({
      where: { email: ctx.session.user.email! },
    })
    if (!dbUser) throw new TRPCError({ code: "NOT_FOUND" })
    if (!dbUser.role) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "role_pending" })

    const user: User = {
      id: dbUser.id,
      email: dbUser.email,
      name: dbUser.name,
      role: dbUser.role as User["role"],
      avatar: dbUser.image ?? undefined,
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
})
