import { initTRPC, TRPCError } from "@trpc/server"
import type { NextRequest } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import * as Sentry from "@sentry/nextjs"

export async function createTRPCContext(opts: { req: NextRequest }) {
  const session = await auth()
  return {
    req: opts.req,
    prisma,
    session,
    organizationId: session?.user?.organizationId ?? null,
  }
}

type Context = Awaited<ReturnType<typeof createTRPCContext>>

const t = initTRPC.context<Context>().create()

/** Middleware that sets Sentry scope tags for org/subscription context. */
const sentryOrgMiddleware = t.middleware(({ ctx, next }) => {
  if (ctx.session?.user) {
    Sentry.setTag("org.id", ctx.organizationId ?? "none")
    Sentry.setTag("org.slug", ctx.session.user.organizationSlug ?? "none")
  }
  return next({ ctx })
})

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

/** Requires a valid org context. Superadmin bypasses (ctx.organizationId stays null).
 *  For regular org users, also loads the Subscription and enforces active/trialing status. */
export const orgProcedure = protectedProcedure.use(async ({ ctx, next }) => {
  const isSuperAdmin = ctx.session.user.role === "superadmin"
  if (!ctx.organizationId && !isSuperAdmin) {
    throw new TRPCError({ code: "FORBIDDEN", message: "No organization context" })
  }

  if (ctx.organizationId && !isSuperAdmin) {
    const sub = await ctx.prisma.subscription.findUnique({
      where: { organizationId: ctx.organizationId },
    })
    if (sub && (sub.status === "suspended" || sub.status === "canceled")) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "SUBSCRIPTION_INACTIVE",
      })
    }
  }

  return next({ ctx })
})

/** Superadmin-only. */
export const superAdminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.session.user.role !== "superadmin") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Superadmin required" })
  }
  return next({ ctx })
})
