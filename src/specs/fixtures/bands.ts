import type { Band } from "@/specs/entities"

const NOW = "2026-04-21T00:00:00.000Z"

// Member IDs reference musicianFixtures: carlos=user-1, ana=user-4, miguel=user-5

export const bandFixtures = {
  jazzTrio: {
    id: "band-1",
    name: "Jazz Trio Cancún",
    description: "Trío de jazz con piano, guitarra y voz",
    genre: "Jazz",
    isActive: true,
    createdAt: NOW,
    members: ["user-1", "user-4"], // carlos + ana
  },
  flamencoGroup: {
    id: "band-2",
    name: "Flamenco Fusión",
    description: "Grupo de flamenco con fusión latina",
    genre: "Flamenco",
    isActive: true,
    createdAt: NOW,
    members: ["user-1", "user-5"], // carlos + miguel
  },
} satisfies Record<string, Band>

export const allBands: Band[] = Object.values(bandFixtures)
