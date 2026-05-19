import type { Musician } from "@/specs/entities"

const NOW = "2026-04-21T00:00:00.000Z"

export const musicianFixtures = {
  carlos: {
    id: "user-1",
    name: "Carlos Mendoza",
    email: "musico@test.com",
    phone: "+52 998 123 4567",
    instruments: ["Piano", "Guitar"],
    styles: ["Jazz", "Acoustic"],
    hourlyRate: 800,
    isActive: true,
    avatar: "/placeholder-user.jpg",
    createdAt: NOW,
  },
  ana: {
    id: "user-4",
    name: "Ana Rodríguez",
    email: "ana@test.com",
    phone: "+52 998 234 5678",
    instruments: ["Voice", "Guitar"],
    styles: ["Jazz", "Bossa Nova", "Bolero"],
    hourlyRate: 750,
    isActive: true,
    createdAt: NOW,
  },
  miguel: {
    id: "user-5",
    name: "Miguel Santos",
    email: "miguel@test.com",
    phone: "+52 998 345 6789",
    instruments: ["Guitar", "Percussion"],
    styles: ["Flamenco", "Latin Pop"],
    hourlyRate: 900,
    isActive: true,
    createdAt: NOW,
  },
} satisfies Record<string, Musician>

export const allMusicians: Musician[] = Object.values(musicianFixtures)
