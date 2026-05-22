import type { DefaultSession } from "next-auth"

declare module "next-auth" {
  interface Session {
    user: {
      id: string
      // 'musician' | 'manager' | 'hotel' | 'superadmin' | undefined (pending)
      role: string | undefined
      isActive: boolean
      emailVerified: boolean
      phone: string | undefined
      instruments: string[]
      styles: string[]
      pricePerSet: number | undefined
      location: string | undefined
      contactPerson: string | undefined
      hotelId: string | undefined
      createdAt: string
      // org membership — undefined for superadmin and pending users
      organizationId: string | undefined
      organizationSlug: string | undefined
      // musician record link — set for role = 'musician'
      musicianId: string | undefined
    } & DefaultSession["user"]
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string
    role: string | undefined
    isActive: boolean
    emailVerified: boolean
    phone: string | undefined
    instruments: string[]
    styles: string[]
    pricePerSet: number | undefined
    location: string | undefined
    contactPerson: string | undefined
    hotelId: string | undefined
    createdAt: string
    organizationId: string | undefined
    organizationSlug: string | undefined
    musicianId: string | undefined
  }
}
