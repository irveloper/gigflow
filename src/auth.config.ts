import type { NextAuthConfig } from "next-auth"

export default {
  providers: [],
  pages: {
    signIn: "/auth/login",
  },
  callbacks: {
    jwt({ token, user, trigger, session }) {
      console.log("[auth.config.ts] jwt callback start:", { trigger, tokenUserId: token?.id, hasUser: !!user, hasSession: !!session })
      if (trigger === "update" && session) {
        console.log("[auth.config.ts] jwt update with session:", session)
        const s = session as { user?: { organizationId?: string; organizationSlug?: string; role?: string; emailVerified?: Date | null | boolean } }
        if (s.user?.organizationId !== undefined) token.organizationId = s.user.organizationId
        if (s.user?.organizationSlug !== undefined) token.organizationSlug = s.user.organizationSlug
        if (s.user?.role !== undefined) token.role = s.user.role
        if (s.user?.emailVerified !== undefined) token.emailVerified = !!s.user.emailVerified
      }
      if (user) {
        console.log("[auth.config.ts] jwt user login:", user.id)
        const u = user as unknown as {
          id: string
          role?: string
          isActive: boolean
          emailVerified: boolean
          phone?: string
          instruments: string[]
          styles: string[]
          pricePerSet?: number
          location?: string
          contactPerson?: string
          hotelId?: string
          createdAt: string
          organizationId?: string
          organizationSlug?: string
          musicianId?: string
        }
        token.id = u.id
        token.role = u.role
        token.isActive = u.isActive
        token.emailVerified = u.emailVerified
        token.phone = u.phone
        token.instruments = u.instruments ?? []
        token.styles = u.styles ?? []
        token.pricePerSet = u.pricePerSet
        token.location = u.location
        token.contactPerson = u.contactPerson
        token.hotelId = u.hotelId
        token.createdAt = u.createdAt
        token.organizationId = u.organizationId
        token.organizationSlug = u.organizationSlug
        token.musicianId = u.musicianId
      }
      console.log("[auth.config.ts] jwt callback end:", {
        id: token.id,
        organizationId: token.organizationId,
        organizationSlug: token.organizationSlug
      })
      return token
    },
    session({ session, token }) {
      console.log("[auth.config.ts] session callback start:", { sessionUserId: session?.user?.id, tokenUserId: token?.id })
      session.user.id = token.id as string
      session.user.role = token.role as string | undefined
      session.user.isActive = token.isActive as boolean
      session.user.emailVerified = token.emailVerified ? new Date() : null
      session.user.phone = token.phone as string | undefined
      session.user.instruments = (token.instruments as string[]) ?? []
      session.user.styles = (token.styles as string[]) ?? []
      session.user.pricePerSet = token.pricePerSet as number | undefined
      session.user.location = token.location as string | undefined
      session.user.contactPerson = token.contactPerson as string | undefined
      session.user.hotelId = token.hotelId as string | undefined
      session.user.createdAt = token.createdAt as string
      session.user.organizationId = token.organizationId as string | undefined
      session.user.organizationSlug = token.organizationSlug as string | undefined
      session.user.musicianId = token.musicianId as string | undefined
      console.log("[auth.config.ts] session callback end:", {
        id: session.user.id,
        organizationId: session.user.organizationId,
        organizationSlug: session.user.organizationSlug
      })
      return session
    },
  },
} satisfies NextAuthConfig
