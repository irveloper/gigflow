import { initTRPC, TRPCError } from "@trpc/server"
import type { NextRequest } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"

export async function createTRPCContext(opts: { req: NextRequest }) {
  const session = await auth()
  return {
    req: opts.req,
    prisma,
    session,
  }
}

type Context = Awaited<ReturnType<typeof createTRPCContext>>

const t = initTRPC.context<Context>().create()

export const router = t.router
export const publicProcedure = t.procedure
export const createCallerFactory = t.createCallerFactory

export const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.session?.user) {
    throw new TRPCError({ code: "UNAUTHORIZED" })
  }
  return next({ ctx: { ...ctx, session: ctx.session } })
})

const roleGuard = (role: string) =>
  protectedProcedure.use(({ ctx, next }) => {
    if (ctx.session.user.role !== role) {
      throw new TRPCError({ code: "FORBIDDEN" })
    }
    return next({ ctx })
  })

export const managerProcedure = roleGuard("manager")
export const musicianProcedure = roleGuard("musician")
export const hotelProcedure = roleGuard("hotel")
