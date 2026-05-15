/**
 * Idempotent seed — safe to run multiple times.
 * Uses upsert with deterministic IDs from specs/fixtures.
 *
 * Usage: pnpm db:seed
 */

import { PrismaClient } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import { Pool } from "pg"
import bcrypt from "bcryptjs"

// Ensure local environment variables are loaded for the seed script
try {
  process.loadEnvFile('.env.local')
} catch (e) {
  // Ignore if file doesn't exist
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
})
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

const DEMO_PASSWORD = "123456"

async function main() {
  console.log("🌱 Seeding database...")

  const hashedPassword = await bcrypt.hash(DEMO_PASSWORD, 12)

  // ── Users ────────────────────────────────────────────────────────────────────

  const manager = await prisma.user.upsert({
    where: { email: "gerente@test.com" },
    update: {},
    create: {
      id: "seed-user-manager",
      email: "gerente@test.com",
      name: "Ana Garcia",
      password: hashedPassword,
      role: "manager",
      phone: "+52 998 765 4321",
      isActive: true,
    },
  })
  console.log("  ✓ Manager:", manager.email)

  const musician1 = await prisma.user.upsert({
    where: { email: "musico@test.com" },
    update: {},
    create: {
      id: "seed-user-musician-1",
      email: "musico@test.com",
      name: "Carlos Mendoza",
      password: hashedPassword,
      role: "musician",
      phone: "+52 998 123 4567",
      shows: ["Acoustic Set", "Jazz Trio", "Solo Piano"],
      hourlyRate: 800,
      isActive: true,
    },
  })
  console.log("  ✓ Musician:", musician1.email)

  const musician2 = await prisma.user.upsert({
    where: { email: "ana@test.com" },
    update: {},
    create: {
      id: "seed-user-musician-2",
      email: "ana@test.com",
      name: "Ana Rodríguez",
      password: hashedPassword,
      role: "musician",
      phone: "+52 998 234 5678",
      shows: ["Vocal Jazz", "Bossa Nova", "Boleros"],
      hourlyRate: 750,
      isActive: true,
    },
  })
  console.log("  ✓ Musician:", musician2.email)

  const hotelUser = await prisma.user.upsert({
    where: { email: "hotel@test.com" },
    update: {},
    create: {
      id: "seed-user-hotel",
      email: "hotel@test.com",
      name: "Hotel Paradisus",
      password: hashedPassword,
      role: "hotel",
      phone: "+52 998 888 0000",
      location: "Blvd. Kukulcan Km 16.5, Zona Hotelera, Cancún",
      contactPerson: "Roberto Martinez",
      isActive: true,
    },
  })
  console.log("  ✓ Hotel user:", hotelUser.email)

  // ── Hotel domain record ───────────────────────────────────────────────────────

  const hotel = await prisma.hotel.upsert({
    where: { email: "eventos@paradisus.mx" },
    update: {},
    create: {
      id: "seed-hotel-1",
      name: "Hotel Paradisus Cancún",
      email: "eventos@paradisus.mx",
      phone: "+52 998 888 0000",
      location: "Blvd. Kukulcan Km 16.5, Zona Hotelera, Cancún",
      contactPerson: "Roberto Martinez",
      isActive: true,
    },
  })
  console.log("  ✓ Hotel:", hotel.name)

  // ── Musician domain records ───────────────────────────────────────────────────

  const musicianRecord1 = await prisma.musician.upsert({
    where: { email: "musico@test.com" },
    update: {},
    create: {
      id: "seed-musician-1",
      name: "Carlos Mendoza",
      email: "musico@test.com",
      phone: "+52 998 123 4567",
      shows: ["Acoustic Set", "Jazz Trio", "Solo Piano"],
      hourlyRate: 800,
      isActive: true,
    },
  })
  console.log("  ✓ Musician record:", musicianRecord1.name)

  const musicianRecord2 = await prisma.musician.upsert({
    where: { email: "ana@test.com" },
    update: {},
    create: {
      id: "seed-musician-2",
      name: "Ana Rodríguez",
      email: "ana@test.com",
      phone: "+52 998 234 5678",
      shows: ["Vocal Jazz", "Bossa Nova", "Boleros"],
      hourlyRate: 750,
      isActive: true,
    },
  })
  console.log("  ✓ Musician record:", musicianRecord2.name)

  // ── Sample events ─────────────────────────────────────────────────────────────

  const event1 = await prisma.event.upsert({
    where: { id: "seed-event-1" },
    update: {},
    create: {
      id: "seed-event-1",
      title: "Noche de Jazz — Paradisus",
      description: "Presentación de jazz en vivo para huéspedes del hotel",
      date: "2026-06-15",
      time: "20:00",
      durationMinutes: 120,
      hotel: hotel.name,
      hotelId: hotel.id,
      musician: musicianRecord1.name,
      musicianId: musicianRecord1.id,
      status: "scheduled",
    },
  })
  console.log("  ✓ Event:", event1.title)

  const event2 = await prisma.event.upsert({
    where: { id: "seed-event-2" },
    update: {},
    create: {
      id: "seed-event-2",
      title: "Bossa Nova Brunch",
      description: "Música bossa nova durante el brunch dominical",
      date: "2026-06-22",
      time: "11:00",
      durationMinutes: 90,
      hotel: hotel.name,
      hotelId: hotel.id,
      musician: musicianRecord2.name,
      musicianId: musicianRecord2.id,
      status: "scheduled",
    },
  })
  console.log("  ✓ Event:", event2.title)

  // ── Sample notification ───────────────────────────────────────────────────────

  await prisma.notification.upsert({
    where: { id: "seed-notif-1" },
    update: {},
    create: {
      id: "seed-notif-1",
      userId: musician1.id,
      title: "Nuevo evento asignado",
      message: `Tienes un nuevo evento: ${event1.title} el ${event1.date}`,
      type: "info",
      read: false,
      eventId: event1.id,
    },
  })
  console.log("  ✓ Notification created")

  console.log("\n✅ Seed complete.")
  console.log("\nDemo credentials (all use password: 123456):")
  console.log("  Manager:  gerente@test.com")
  console.log("  Musician: musico@test.com")
  console.log("  Musician: ana@test.com")
  console.log("  Hotel:    hotel@test.com")
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
    await pool.end()
  })
