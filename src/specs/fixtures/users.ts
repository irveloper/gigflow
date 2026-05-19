import type { User } from "@/specs/entities"

const NOW = "2026-04-21T00:00:00.000Z"

export const userFixtures = {
  musician: {
    id: "user-1",
    email: "musico@test.com",
    name: "Carlos Mendoza",
    role: "musician",
    avatar: "/placeholder-user.jpg",
    phone: "+52 998 123 4567",
    instruments: ["Acoustic Set", "Jazz Trio", "Solo Piano"],
    styles: ["jazz", "acoustic"],
    hourlyRate: 800,
    musicianId: "user-1",
    createdAt: NOW,
  },
  manager: {
    id: "user-2",
    email: "gerente@test.com",
    name: "Ana Garcia",
    role: "manager",
    avatar: "/placeholder-user.jpg",
    phone: "+52 998 765 4321",
    createdAt: NOW,
    organizationId: "org-1",
    organizationSlug: "plugin-cancun",
  },
  hotel: {
    id: "user-3",
    email: "hotel@test.com",
    name: "Hotel Paradisus",
    role: "hotel",
    avatar: "/placeholder-logo.png",
    phone: "+52 998 888 0000",
    hotel: "Paradisus Cancun",
    hotelId: "seed-hotel-1",
    location: "Cancun, Mexico",
    contactPerson: "Roberto Martinez",
    createdAt: NOW,
  },
} satisfies Record<string, User>

export const DEMO_PASSWORD = "123456"
