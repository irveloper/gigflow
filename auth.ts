import "@/lib/env"
import NextAuth from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"
import { PrismaAdapter } from "@auth/prisma-adapter"
import bcrypt from "bcryptjs"
import { prisma } from "@/lib/prisma"
import { LoginInputSchema } from "@/entities/user/schema"

export const {
  handlers: { GET, POST },
  auth,
  signIn,
  signOut,
} = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt" },
  pages: {
    signIn: "/auth/login",
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

        const dbUser = await prisma.user.findUnique({
          where: { email: parsed.data.email },
        })
        if (!dbUser?.password) return null

        const valid = await bcrypt.compare(parsed.data.password, dbUser.password)
        if (!valid) return null

        if (!dbUser.isActive) return null

        return {
          id: dbUser.id,
          name: dbUser.name,
          email: dbUser.email,
          role: dbUser.role ?? undefined,
          isActive: dbUser.isActive,
          phone: dbUser.phone ?? undefined,
          shows: dbUser.shows,
          hourlyRate: dbUser.hourlyRate ?? undefined,
          location: dbUser.location ?? undefined,
          contactPerson: dbUser.contactPerson ?? undefined,
          hotelId: dbUser.hotelId ?? undefined,
          createdAt: dbUser.createdAt.toISOString(),
        }
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        const u = user as unknown as {
          id: string
          role?: string
          isActive: boolean
          phone?: string
          shows: string[]
          hourlyRate?: number
          location?: string
          contactPerson?: string
          hotelId?: string
          createdAt: string
        }
        token.id = u.id
        token.role = u.role
        token.isActive = u.isActive
        token.phone = u.phone
        token.shows = u.shows ?? []
        token.hourlyRate = u.hourlyRate
        token.location = u.location
        token.contactPerson = u.contactPerson
        token.hotelId = u.hotelId
        token.createdAt = u.createdAt
      }
      return token
    },
    session({ session, token }) {
      session.user.id = token.id
      session.user.role = token.role
      session.user.isActive = token.isActive
      session.user.phone = token.phone
      session.user.shows = token.shows ?? []
      session.user.hourlyRate = token.hourlyRate
      session.user.location = token.location
      session.user.contactPerson = token.contactPerson
      session.user.hotelId = token.hotelId
      session.user.createdAt = token.createdAt
      return session
    },
  },
})

export { sessionToUser } from "@/shared/lib/session"
