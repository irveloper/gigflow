import type { DefaultSession } from "next-auth"

declare module "next-auth" {
  interface Session {
    user: {
      id: string
      role: string | undefined
      isActive: boolean
      phone: string | undefined
      shows: string[]
      hourlyRate: number | undefined
      location: string | undefined
      contactPerson: string | undefined
      hotelId: string | undefined
      createdAt: string
    } & DefaultSession["user"]
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string
    role: string | undefined
    isActive: boolean
    phone: string | undefined
    shows: string[]
    hourlyRate: number | undefined
    location: string | undefined
    contactPerson: string | undefined
    hotelId: string | undefined
    createdAt: string
  }
}
