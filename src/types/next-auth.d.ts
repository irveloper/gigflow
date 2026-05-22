import type { DefaultSession } from "next-auth"

declare module "next-auth" {
  interface Session {
    user: {
      id: string
      role?: string
      isActive: boolean
      emailVerified: Date | null
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
    } & DefaultSession["user"]
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string
    role?: string
    isActive?: boolean
    emailVerified?: boolean
    phone?: string
    instruments?: string[]
    styles?: string[]
    pricePerSet?: number
    location?: string
    contactPerson?: string
    hotelId?: string
    createdAt?: string
    organizationId?: string
    organizationSlug?: string
    musicianId?: string
  }
}
