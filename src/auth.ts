import "@/lib/env"
import NextAuth from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"
import { PrismaAdapter } from "@auth/prisma-adapter"
import bcrypt from "bcryptjs"
import { prisma } from "@/lib/prisma"
import { LoginInputSchema } from "@/entities/user/schema"
import { headers } from "next/headers"

import authConfig from "./auth.config"

export const {
  handlers: { GET, POST },
  auth,
  signIn,
  signOut,
  unstable_update,
} = NextAuth({
  ...authConfig,
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt" },
  callbacks: {
    ...authConfig.callbacks,
    async jwt({ token, user, trigger, session }) {
      console.log("[auth.ts] jwt callback start:", { trigger, tokenUserId: token?.id, hasUser: !!user, hasSession: !!session })
      let updatedToken = token
      if (authConfig.callbacks?.jwt) {
        updatedToken = await authConfig.callbacks.jwt({ token, user, trigger, session })
      }

      if (trigger === "update" && updatedToken.id) {
        console.log("[auth.ts] jwt update trigger database query for user:", updatedToken.id)
        const dbUser = await prisma.user.findUnique({
          where: { id: updatedToken.id as string },
          include: {
            organization: { select: { id: true, slug: true } },
            musician: { select: { id: true } },
          },
        })
        console.log("[auth.ts] dbUser query result:", {
          found: !!dbUser,
          organizationId: dbUser?.organizationId,
          organizationSlug: dbUser?.organization?.slug,
        })
        if (dbUser) {
          updatedToken.organizationId = dbUser.organizationId ?? undefined
          updatedToken.organizationSlug = dbUser.organization?.slug ?? undefined
          updatedToken.role = dbUser.role ?? undefined
          updatedToken.emailVerified = dbUser.emailVerified !== null
          updatedToken.musicianId = dbUser.musician?.id ?? undefined
        }
      }

      console.log("[auth.ts] jwt callback end:", {
        id: updatedToken.id,
        organizationId: updatedToken.organizationId,
        organizationSlug: updatedToken.organizationSlug
      })
      return updatedToken
    },
  },
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const parsed = LoginInputSchema.safeParse(credentials)
        if (!parsed.success) return null

        // Capture IP for audit log — available via next/headers in Next.js 15+
        let ipAddress: string | null = null
        let userAgent: string | null = null
        try {
          const hdrs = await headers()
          ipAddress = hdrs.get("x-forwarded-for")?.split(",")[0]?.trim() ?? hdrs.get("x-real-ip") ?? null
          userAgent = hdrs.get("user-agent")
        } catch {
          // headers() may throw outside request context (e.g. tests)
        }

        const dbUser = await prisma.user.findUnique({
          where: { email: parsed.data.email },
          include: {
            organization: { select: { id: true, slug: true } },
            musician: { select: { id: true } },
          },
        })

        const logFailure = async () => {
          try {
            await prisma.loginAuditLog.create({
              data: { email: parsed.data.email, userId: dbUser?.id ?? null, outcome: "failure", ipAddress, userAgent },
            })
          } catch { /* non-critical */ }
        }

        if (!dbUser?.password) { await logFailure(); return null }

        const valid = await bcrypt.compare(parsed.data.password, dbUser.password)
        if (!valid) { await logFailure(); return null }

        if (!dbUser.isActive) { await logFailure(); return null }

        // Log success
        try {
          await prisma.loginAuditLog.create({
            data: { email: dbUser.email, userId: dbUser.id, outcome: "success", ipAddress, userAgent },
          })
        } catch { /* non-critical */ }

        return {
          id: dbUser.id,
          name: dbUser.name,
          email: dbUser.email,
          role: dbUser.role ?? undefined,
          isActive: dbUser.isActive,
          emailVerified: dbUser.emailVerified !== null,
          phone: dbUser.phone ?? undefined,
          instruments: dbUser.instruments,
          styles: dbUser.styles,
          pricePerSet: dbUser.pricePerSet ?? undefined,
          location: dbUser.location ?? undefined,
          contactPerson: dbUser.contactPerson ?? undefined,
          hotelId: dbUser.hotelId ?? undefined,
          createdAt: dbUser.createdAt.toISOString(),
          organizationId: dbUser.organizationId ?? undefined,
          organizationSlug: dbUser.organization?.slug ?? undefined,
          musicianId: dbUser.musician?.id ?? undefined,
        }
      },
    }),
  ],
})

export { sessionToUser } from "@/shared/lib/session"
