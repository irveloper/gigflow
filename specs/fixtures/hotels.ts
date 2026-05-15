import type { Hotel } from "@/specs/entities"

const NOW = "2026-04-21T00:00:00.000Z"

export const hotelFixtures = {
  paradisus: {
    id: "hotel-1",
    name: "Hotel Paradisus Cancún",
    email: "eventos@paradisus.mx",
    phone: "+52 998 888 0000",
    location: "Blvd. Kukulcan Km 16.5, Zona Hotelera, Cancún",
    contactPerson: "Roberto Martinez",
    isActive: true,
    avatar: "/placeholder-logo.png",
    createdAt: NOW,
  },
  moonPalace: {
    id: "hotel-2",
    name: "Hotel Moon Palace",
    email: "eventos@moonpalace.mx",
    phone: "+52 998 777 1111",
    location: "Carretera Cancún-Chetumal Km 340, Cancún",
    contactPerson: "Laura Hernández",
    isActive: true,
    createdAt: NOW,
  },
  xcaret: {
    id: "hotel-3",
    name: "Hotel Xcaret",
    email: "eventos@xcaret.mx",
    phone: "+52 998 777 2222",
    location: "Carretera Federal 307 Km 282, Playa del Carmen",
    contactPerson: "Diego Ruiz",
    isActive: true,
    createdAt: NOW,
  },
  iberostar: {
    id: "hotel-4",
    name: "Hotel Iberostar",
    email: "eventos@iberostar.mx",
    phone: "+52 998 777 3333",
    location: "Blvd. Kukulcan Km 17, Zona Hotelera, Cancún",
    contactPerson: "Sofia Morales",
    isActive: true,
    createdAt: NOW,
  },
} satisfies Record<string, Hotel>

export const allHotels: Hotel[] = Object.values(hotelFixtures)
