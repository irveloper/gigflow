import type { NextAuthConfig } from "next-auth"

export default {
  providers: [],
  pages: {
    signIn: "/auth/login",
  },
  callbacks: {
    jwt({ token, user, trigger, session }) {
      if (trigger === "update" && session) {
        const s = session as { user?: { organizationId?: string; organizationSlug?: string; role?: string } }
        if (s.user?.organizationId !== undefined) token.organizationId = s.user.organizationId
        if (s.user?.organizationSlug !== undefined) token.organizationSlug = s.user.organizationSlug
        if (s.user?.role !== undefined) token.role = s.user.role
      }
      if (user) {
        const u = user as unknown as {
          id: string
          role?: string
          isActive: boolean
          emailVerified: boolean
          phone?: string
          instruments: string[]
          styles: string[]
          hourlyRate?: number
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
        token.hourlyRate = u.hourlyRate
        token.location = u.location
        token.contactPerson = u.contactPerson
        token.hotelId = u.hotelId
        token.createdAt = u.createdAt
        token.organizationId = u.organizationId
        token.organizationSlug = u.organizationSlug
        token.musicianId = u.musicianId
      }
      return token
    },
    session({ session, token }) {
      session.user.id = token.id as string
      session.user.role = token.role as string | undefined
      session.user.isActive = token.isActive as boolean
      session.user.emailVerified = token.emailVerified as unknown as typeof session.user.emailVerified
      session.user.phone = token.phone as string | undefined
      session.user.instruments = (token.instruments as string[]) ?? []
      session.user.styles = (token.styles as string[]) ?? []
      session.user.hourlyRate = token.hourlyRate as number | undefined
      session.user.location = token.location as string | undefined
      session.user.contactPerson = token.contactPerson as string | undefined
      session.user.hotelId = token.hotelId as string | undefined
      session.user.createdAt = token.createdAt as string
      session.user.organizationId = token.organizationId as string | undefined
      session.user.organizationSlug = token.organizationSlug as string | undefined
      session.user.musicianId = token.musicianId as string | undefined
      return session
    },
  },
} satisfies NextAuthConfig
