import type { Organization } from "@/specs/entities"

const NOW = "2026-04-21T00:00:00.000Z"

export const organizationFixtures = {
  sonidosDelMar: {
    id: "org-1",
    name: "Sonidos del Mar",
    slug: "sonidos-del-mar",
    status: "active",
    createdAt: NOW,
    updatedAt: NOW,
  },
  ritmoCaribe: {
    id: "org-2",
    name: "Ritmo Caribe",
    slug: "ritmo-caribe",
    status: "active",
    createdAt: NOW,
    updatedAt: NOW,
  },
} satisfies Record<string, Organization>

export const allOrganizations: Organization[] = Object.values(organizationFixtures)
