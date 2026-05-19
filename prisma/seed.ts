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

try {
  process.loadEnvFile(".env.local")
} catch {
  // ignore if file doesn't exist
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

const DEMO_PASSWORD = "123456"

// ── Helpers ───────────────────────────────────────────────────────────────────

const checkIn = (date: string, hour: number) => ({
  checkedIn: true,
  checkInTime: new Date(`${date}T${String(hour).padStart(2, "0")}:05:00.000Z`).toISOString(),
  checkInLocation: ["Lobby principal", "Entrada del restaurante", "Terraza del lobby", "Bar del pool"][Math.floor(Math.random() * 4)],
})

async function main() {
  console.log("🌱 Seeding database...")

  const hashedPassword = await bcrypt.hash(DEMO_PASSWORD, 12)

  // ── Organizations ─────────────────────────────────────────────────────────

  const orgA = await prisma.organization.upsert({
    where: { id: "org-1" },
    update: {},
    create: { id: "org-1", name: "Sonidos del Mar", slug: "sonidos-del-mar", status: "active" },
  })
  const orgB = await prisma.organization.upsert({
    where: { id: "org-2" },
    update: {},
    create: { id: "org-2", name: "Ritmo Caribe", slug: "ritmo-caribe", status: "active" },
  })
  console.log(`  ✓ Orgs: ${orgA.name}, ${orgB.name}`)

  // ── Subscriptions ─────────────────────────────────────────────────────────

  await prisma.subscription.upsert({
    where: { organizationId: orgA.id },
    update: {},
    create: {
      id: "seed-sub-1",
      organizationId: orgA.id,
      stripeCustomerId: "cus_dev_seed_org_a",
      stripeSubscriptionId: "sub_dev_seed_org_a",
      stripePriceId: "price_dev_growth_monthly",
      status: "active",
      seatLimit: 10,
      cancelAtPeriodEnd: false,
      currentPeriodEnd: new Date("2026-06-17"),
    },
  })
  await prisma.subscription.upsert({
    where: { organizationId: orgB.id },
    update: {},
    create: {
      id: "seed-sub-2",
      organizationId: orgB.id,
      stripeCustomerId: "cus_dev_seed_org_b",
      stripeSubscriptionId: "sub_dev_seed_org_b",
      stripePriceId: "price_dev_starter_monthly",
      status: "active",
      seatLimit: 5,
      cancelAtPeriodEnd: false,
      currentPeriodEnd: new Date("2026-06-17"),
    },
  })
  console.log("  ✓ Subscriptions seeded")

  // ── Super-admin ───────────────────────────────────────────────────────────

  await prisma.user.upsert({
    where: { email: "admin@platform.com" },
    update: {},
    create: {
      id: "seed-user-superadmin",
      email: "admin@platform.com",
      name: "Platform Admin",
      password: hashedPassword,
      role: "superadmin",
      isActive: true,
    },
  })
  console.log("  ✓ Super-admin seeded")

  // ── Users — Org A (Sonidos del Mar) ───────────────────────────────────────

  const managerA = await prisma.user.upsert({
    where: { email: "gerente@test.com" },
    update: { organizationId: orgA.id },
    create: {
      id: "seed-user-manager",
      email: "gerente@test.com",
      name: "Ana Garcia",
      password: hashedPassword,
      role: "manager",
      phone: "+52 998 765 4321",
      isActive: true,
      organizationId: orgA.id,
    },
  })

  await prisma.user.upsert({
    where: { email: "musico@test.com" },
    update: { organizationId: orgA.id },
    create: {
      id: "seed-user-musician-1",
      email: "musico@test.com",
      name: "Carlos Mendoza",
      password: hashedPassword,
      role: "musician",
      phone: "+52 998 123 4567",
      instruments: ["Piano", "Guitar"],
      styles: ["Jazz", "Acoustic"],
      hourlyRate: 800,
      isActive: true,
      organizationId: orgA.id,
    },
  })

  // ── Users — Org B (Ritmo Caribe) ──────────────────────────────────────────

  const managerB = await prisma.user.upsert({
    where: { email: "gerente2@test.com" },
    update: { organizationId: orgB.id },
    create: {
      id: "seed-user-manager-b",
      email: "gerente2@test.com",
      name: "Diego Ruiz",
      password: hashedPassword,
      role: "manager",
      phone: "+52 998 555 9900",
      isActive: true,
      organizationId: orgB.id,
    },
  })

  await prisma.user.upsert({
    where: { email: "ana@test.com" },
    update: { organizationId: orgB.id },
    create: {
      id: "seed-user-musician-2",
      email: "ana@test.com",
      name: "Ana Rodríguez",
      password: hashedPassword,
      role: "musician",
      phone: "+52 998 234 5678",
      instruments: ["Voice", "Guitar"],
      styles: ["Jazz", "Bossa Nova", "Bolero"],
      hourlyRate: 750,
      isActive: true,
      organizationId: orgB.id,
    },
  })

  await prisma.user.upsert({
    where: { email: "hotel@test.com" },
    update: { organizationId: orgA.id },
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
      organizationId: orgA.id,
    },
  })
  console.log(`  ✓ Users seeded (manager: ${managerA.email}, ${managerB.email})`)

  // ── Hotels ────────────────────────────────────────────────────────────────

  const hotelParadisus = await prisma.hotel.upsert({
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
  const hotelMoonPalace = await prisma.hotel.upsert({
    where: { email: "eventos@moonpalace.mx" },
    update: {},
    create: {
      id: "seed-hotel-2",
      name: "Hotel Moon Palace",
      email: "eventos@moonpalace.mx",
      phone: "+52 998 777 1111",
      location: "Carretera Cancún-Chetumal Km 340, Cancún",
      contactPerson: "Laura Hernández",
      isActive: true,
    },
  })
  const hotelXcaret = await prisma.hotel.upsert({
    where: { email: "eventos@xcaret.mx" },
    update: {},
    create: {
      id: "seed-hotel-3",
      name: "Hotel Xcaret",
      email: "eventos@xcaret.mx",
      phone: "+52 998 777 2222",
      location: "Carretera Federal 307 Km 282, Playa del Carmen",
      contactPerson: "Diego Ruiz",
      isActive: true,
    },
  })
  const hotelIberostar = await prisma.hotel.upsert({
    where: { email: "eventos@iberostar.mx" },
    update: {},
    create: {
      id: "seed-hotel-4",
      name: "Hotel Iberostar",
      email: "eventos@iberostar.mx",
      phone: "+52 998 777 3333",
      location: "Blvd. Kukulcan Km 17, Zona Hotelera, Cancún",
      contactPerson: "Sofia Morales",
      isActive: true,
    },
  })
  const hotelHyatt = await prisma.hotel.upsert({
    where: { email: "eventos@hyatt.mx" },
    update: {},
    create: {
      id: "seed-hotel-5",
      name: "Hyatt Ziva Cancún",
      email: "eventos@hyatt.mx",
      phone: "+52 998 777 4444",
      location: "Blvd. Kukulcan Km 11.5, Zona Hotelera, Cancún",
      contactPerson: "Carlos Vega",
      isActive: true,
    },
  })
  console.log("  ✓ Hotels seeded (5 hotels)")

  // ── Musician domain records ────────────────────────────────────────────────

  const mCarlos = await prisma.musician.upsert({
    where: { email: "musico@test.com" },
    update: {},
    create: {
      id: "seed-musician-1",
      name: "Carlos Mendoza",
      email: "musico@test.com",
      phone: "+52 998 123 4567",
      instruments: ["Piano", "Guitar"],
      styles: ["Jazz", "Acoustic"],
      hourlyRate: 800,
      isActive: true,
    },
  })
  const mAna = await prisma.musician.upsert({
    where: { email: "ana@test.com" },
    update: {},
    create: {
      id: "seed-musician-2",
      name: "Ana Rodríguez",
      email: "ana@test.com",
      phone: "+52 998 234 5678",
      instruments: ["Voice", "Guitar"],
      styles: ["Jazz", "Bossa Nova", "Bolero"],
      hourlyRate: 750,
      isActive: true,
    },
  })
  const mMiguel = await prisma.musician.upsert({
    where: { email: "miguel@test.com" },
    update: {},
    create: {
      id: "seed-musician-3",
      name: "Miguel Santos",
      email: "miguel@test.com",
      phone: "+52 998 345 6789",
      instruments: ["Guitar", "Percussion"],
      styles: ["Flamenco", "Latin Pop"],
      hourlyRate: 900,
      isActive: true,
    },
  })
  const mSofia = await prisma.musician.upsert({
    where: { email: "sofia@test.com" },
    update: {},
    create: {
      id: "seed-musician-4",
      name: "Sofía Vargas",
      email: "sofia@test.com",
      phone: "+52 998 456 7890",
      instruments: ["Violin", "Piano"],
      styles: ["Classical", "Romantic"],
      hourlyRate: 1100,
      isActive: true,
    },
  })
  const mLuis = await prisma.musician.upsert({
    where: { email: "luis@test.com" },
    update: {},
    create: {
      id: "seed-musician-5",
      name: "Luis Morales",
      email: "luis@test.com",
      phone: "+52 998 567 8901",
      instruments: ["Saxophone"],
      styles: ["Jazz", "Blues"],
      hourlyRate: 950,
      isActive: true,
    },
  })
  const mMariaElena = await prisma.musician.upsert({
    where: { email: "mariaelena@test.com" },
    update: {},
    create: {
      id: "seed-musician-6",
      name: "María Elena Castro",
      email: "mariaelena@test.com",
      phone: "+52 998 678 9012",
      instruments: ["Voice"],
      styles: ["Bolero", "Latin Pop"],
      hourlyRate: 850,
      isActive: true,
    },
  })
  console.log("  ✓ Musician records seeded (6 musicians)")

  // Link musician Users → domain records
  await prisma.user.update({ where: { email: "musico@test.com" }, data: { musicianId: mCarlos.id } })
  await prisma.user.update({ where: { email: "ana@test.com" }, data: { musicianId: mAna.id } })
  console.log("  ✓ Musician user ↔ record links set")

  // ── Hotel ↔ Organization links ────────────────────────────────────────────

  const hotelOrgLinks = [
    // Org A: Paradisus, Moon Palace, Iberostar, Hyatt
    { hotelId: hotelParadisus.id, organizationId: orgA.id, contactPerson: "Roberto Martinez", contactPhone: "+52 998 888 0001" },
    { hotelId: hotelMoonPalace.id, organizationId: orgA.id, contactPerson: "Laura Hernández", contactPhone: "+52 998 777 1112" },
    { hotelId: hotelIberostar.id, organizationId: orgA.id, contactPerson: "Sofia Morales", contactPhone: "+52 998 777 3334" },
    { hotelId: hotelHyatt.id, organizationId: orgA.id, contactPerson: "Carlos Vega", contactPhone: "+52 998 777 4445" },
    // Org B: Paradisus (shared), Xcaret, Hyatt (shared)
    { hotelId: hotelParadisus.id, organizationId: orgB.id, contactPerson: "Carmen López", contactPhone: "+52 998 888 0002" },
    { hotelId: hotelXcaret.id, organizationId: orgB.id, contactPerson: "Diego Ruiz", contactPhone: "+52 998 777 2223" },
    { hotelId: hotelHyatt.id, organizationId: orgB.id, contactPerson: "Patricia Sánchez", contactPhone: "+52 998 777 4446" },
  ]
  for (const link of hotelOrgLinks) {
    await prisma.hotelOrganization.upsert({
      where: { hotelId_organizationId: { hotelId: link.hotelId, organizationId: link.organizationId } },
      update: {},
      create: link,
    })
  }
  console.log("  ✓ Hotel-org links created")

  // ── Musician ↔ Organization links ─────────────────────────────────────────

  const musicianOrgLinks = [
    // Org A: Carlos, Miguel, Sofía, Luis
    { musicianId: mCarlos.id, organizationId: orgA.id },
    { musicianId: mMiguel.id, organizationId: orgA.id },
    { musicianId: mSofia.id, organizationId: orgA.id },
    { musicianId: mLuis.id, organizationId: orgA.id },
    // Org B: Ana, Miguel (shared), María Elena
    { musicianId: mAna.id, organizationId: orgB.id },
    { musicianId: mMiguel.id, organizationId: orgB.id },
    { musicianId: mMariaElena.id, organizationId: orgB.id },
  ]
  for (const link of musicianOrgLinks) {
    await prisma.musicianOrganization.upsert({
      where: { musicianId_organizationId: { musicianId: link.musicianId, organizationId: link.organizationId } },
      update: {},
      create: link,
    })
  }
  console.log("  ✓ Musician-org links created")

  // ── Bands ──────────────────────────────────────────────────────────────────

  const band1 = await prisma.band.upsert({
    where: { id: "seed-band-1" },
    update: {},
    create: { id: "seed-band-1", name: "Jazz Trio Cancún", description: "Trío de jazz con piano, guitarra y saxofón", genre: "Jazz", isActive: true },
  })
  const band2 = await prisma.band.upsert({
    where: { id: "seed-band-2" },
    update: {},
    create: { id: "seed-band-2", name: "Flamenco Fusión", description: "Grupo de flamenco con fusión latina", genre: "Flamenco", isActive: true },
  })
  const band3 = await prisma.band.upsert({
    where: { id: "seed-band-3" },
    update: {},
    create: { id: "seed-band-3", name: "Caribbean Sunset Duo", description: "Dúo de bossa nova y música caribeña", genre: "Bossa Nova / Latin", isActive: true },
  })
  console.log(`  ✓ Bands seeded: ${band1.name}, ${band2.name}, ${band3.name}`)

  // BandMember links
  // Jazz Trio: Carlos (piano) + Luis (sax) + Ana (voice)
  const bandMembers = [
    { bandId: band1.id, musicianId: mCarlos.id },
    { bandId: band1.id, musicianId: mLuis.id },
    { bandId: band1.id, musicianId: mAna.id },
    // Flamenco Fusión: Miguel (guitar) + Carlos (piano)
    { bandId: band2.id, musicianId: mMiguel.id },
    { bandId: band2.id, musicianId: mCarlos.id },
    // Caribbean Sunset Duo: Ana (voice) + Miguel (guitar)
    { bandId: band3.id, musicianId: mAna.id },
    { bandId: band3.id, musicianId: mMiguel.id },
  ]
  for (const bm of bandMembers) {
    await prisma.bandMember.upsert({
      where: { bandId_musicianId: { bandId: bm.bandId, musicianId: bm.musicianId } },
      update: {},
      create: bm,
    })
  }

  // BandOrganization links
  // Jazz Trio → Org A; Flamenco Fusión → Org A + B; Caribbean Sunset → Org B
  const bandOrgLinks = [
    { bandId: band1.id, organizationId: orgA.id },
    { bandId: band2.id, organizationId: orgA.id },
    { bandId: band2.id, organizationId: orgB.id },
    { bandId: band3.id, organizationId: orgB.id },
  ]
  for (const bo of bandOrgLinks) {
    await prisma.bandOrganization.upsert({
      where: { bandId_organizationId: { bandId: bo.bandId, organizationId: bo.organizationId } },
      update: {},
      create: bo,
    })
  }
  console.log("  ✓ Band-org and band-member links created")

  // ── Events ─────────────────────────────────────────────────────────────────
  // 55 events across two orgs: mix of solo/band, completed/cancelled/scheduled
  // Dates relative to seed date 2026-05-18

  type EventSeed = {
    id: string
    title: string
    description: string
    date: string
    time: string
    durationMinutes: number
    hotel: string
    hotelId: string
    musician?: string
    musicianId?: string
    band?: string
    bandId?: string
    status: "scheduled" | "in-progress" | "completed" | "cancelled"
    checkedIn?: boolean
    checkInTime?: string
    checkInLocation?: string
    organizationId: string
  }

  const H = {
    paradisus: { hotel: hotelParadisus.name, hotelId: hotelParadisus.id },
    moon: { hotel: hotelMoonPalace.name, hotelId: hotelMoonPalace.id },
    xcaret: { hotel: hotelXcaret.name, hotelId: hotelXcaret.id },
    iberostar: { hotel: hotelIberostar.name, hotelId: hotelIberostar.id },
    hyatt: { hotel: hotelHyatt.name, hotelId: hotelHyatt.id },
  }
  const done = (date: string, startHour: number) => ({ status: "completed" as const, ...checkIn(date, startHour) })
  const cancelled = { status: "cancelled" as const }
  const scheduled = { status: "scheduled" as const }

  const events: EventSeed[] = [
    // ── ORG A — PAST (completed / cancelled) ─────────────────────────────────

    {
      id: "seed-ev-01",
      title: "Noche de Jazz — Paradisus",
      description: "Presentación de jazz clásico en el restaurante del hotel durante la cena",
      date: "2026-03-05", time: "20:00", durationMinutes: 120,
      ...H.paradisus, musician: mCarlos.name, musicianId: mCarlos.id,
      ...done("2026-03-05", 20), organizationId: orgA.id,
    },
    {
      id: "seed-ev-02",
      title: "Jazz Trio en Moon Palace",
      description: "Show del Jazz Trio Cancún para los huéspedes del bar de la alberca",
      date: "2026-03-12", time: "19:30", durationMinutes: 90,
      ...H.moon, band: band1.name, bandId: band1.id,
      ...done("2026-03-12", 19), organizationId: orgA.id,
    },
    {
      id: "seed-ev-03",
      title: "Flamenco Show — Iberostar",
      description: "Actuación de flamenco para la noche de gala del hotel",
      date: "2026-03-19", time: "21:00", durationMinutes: 75,
      ...H.iberostar, musician: mMiguel.name, musicianId: mMiguel.id,
      ...done("2026-03-19", 21), organizationId: orgA.id,
    },
    {
      id: "seed-ev-04",
      title: "Cuerdas Clásicas — Hyatt",
      description: "Sofía Vargas en violín para la bienvenida de grupo corporativo",
      date: "2026-03-26", time: "18:00", durationMinutes: 60,
      ...H.hyatt, musician: mSofia.name, musicianId: mSofia.id,
      ...done("2026-03-26", 18), organizationId: orgA.id,
    },
    {
      id: "seed-ev-05",
      title: "Sax & Soul Cocktail — Moon Palace",
      description: "Luis Morales en saxofón para la hora del cóctel en la terraza",
      date: "2026-04-02", time: "17:00", durationMinutes: 60,
      ...H.moon, musician: mLuis.name, musicianId: mLuis.id,
      ...done("2026-04-02", 17), organizationId: orgA.id,
    },
    {
      id: "seed-ev-06",
      title: "Flamenco Fusión — Paradisus",
      description: "Show de flamenco y fusión latina con la banda completa",
      date: "2026-04-09", time: "20:30", durationMinutes: 100,
      ...H.paradisus, band: band2.name, bandId: band2.id,
      ...done("2026-04-09", 20), organizationId: orgA.id,
    },
    {
      id: "seed-ev-07",
      title: "Velada Acústica — Iberostar",
      description: "Carlos Mendoza en guitarra acústica — cancelado por lluvia",
      date: "2026-04-11", time: "19:00", durationMinutes: 90,
      ...H.iberostar, musician: mCarlos.name, musicianId: mCarlos.id,
      ...cancelled, organizationId: orgA.id,
    },
    {
      id: "seed-ev-08",
      title: "Jazz Trio en Hyatt",
      description: "Noche de jazz para la temporada alta de bodas",
      date: "2026-04-16", time: "20:00", durationMinutes: 120,
      ...H.hyatt, band: band1.name, bandId: band1.id,
      ...done("2026-04-16", 20), organizationId: orgA.id,
    },
    {
      id: "seed-ev-09",
      title: "Violín Romántico — Moon Palace",
      description: "Serenata de violín para cena de aniversario de parejas",
      date: "2026-04-18", time: "19:00", durationMinutes: 60,
      ...H.moon, musician: mSofia.name, musicianId: mSofia.id,
      ...done("2026-04-18", 19), organizationId: orgA.id,
    },
    {
      id: "seed-ev-10",
      title: "Piano Jazz Bar — Paradisus",
      description: "Carlos en piano solo para el jazz bar del lobby",
      date: "2026-04-23", time: "21:00", durationMinutes: 90,
      ...H.paradisus, musician: mCarlos.name, musicianId: mCarlos.id,
      ...done("2026-04-23", 21), organizationId: orgA.id,
    },
    {
      id: "seed-ev-11",
      title: "Flamenco Pool — Moon Palace",
      description: "Actuación junto a la alberca principal — cancelado por mantenimiento",
      date: "2026-04-25", time: "16:00", durationMinutes: 60,
      ...H.moon, band: band2.name, bandId: band2.id,
      ...cancelled, organizationId: orgA.id,
    },
    {
      id: "seed-ev-12",
      title: "Jazz Trio Brunch — Iberostar",
      description: "Brunch dominical con jazz en vivo en la terraza del restaurante",
      date: "2026-04-30", time: "11:00", durationMinutes: 90,
      ...H.iberostar, band: band1.name, bandId: band1.id,
      ...done("2026-04-30", 11), organizationId: orgA.id,
    },
    {
      id: "seed-ev-13",
      title: "Flamenco Cena — Hyatt",
      description: "Miguel Santos en guitarra flamenca para la cena de huéspedes VIP",
      date: "2026-05-03", time: "20:00", durationMinutes: 75,
      ...H.hyatt, musician: mMiguel.name, musicianId: mMiguel.id,
      ...done("2026-05-03", 20), organizationId: orgA.id,
    },
    {
      id: "seed-ev-14",
      title: "Sax Sunset — Paradisus",
      description: "Luis Morales en saxofón para la hora del atardecer en la terraza",
      date: "2026-05-07", time: "17:30", durationMinutes: 60,
      ...H.paradisus, musician: mLuis.name, musicianId: mLuis.id,
      ...done("2026-05-07", 17), organizationId: orgA.id,
    },
    {
      id: "seed-ev-15",
      title: "Acústico Pool — Moon Palace",
      description: "Carlos Mendoza guitarra acústica junto a la alberca — cancelado",
      date: "2026-05-10", time: "15:00", durationMinutes: 60,
      ...H.moon, musician: mCarlos.name, musicianId: mCarlos.id,
      ...cancelled, organizationId: orgA.id,
    },
    {
      id: "seed-ev-16",
      title: "Clasicismo & Vino — Iberostar",
      description: "Sofía Vargas: violín clásico durante la cata de vinos",
      date: "2026-05-14", time: "18:30", durationMinutes: 75,
      ...H.iberostar, musician: mSofia.name, musicianId: mSofia.id,
      ...done("2026-05-14", 18), organizationId: orgA.id,
    },
    {
      id: "seed-ev-17",
      title: "Jazz Trio Noche — Paradisus",
      description: "Cierre de semana con el jazz trio en el bar del lobby",
      date: "2026-05-15", time: "21:00", durationMinutes: 120,
      ...H.paradisus, band: band1.name, bandId: band1.id,
      ...done("2026-05-15", 21), organizationId: orgA.id,
    },
    {
      id: "seed-ev-18",
      title: "Flamenco Fusión — Hyatt",
      description: "Espectáculo de flamenco y percusión para evento de bodas",
      date: "2026-05-17", time: "20:00", durationMinutes: 90,
      ...H.hyatt, band: band2.name, bandId: band2.id,
      ...done("2026-05-17", 20), organizationId: orgA.id,
    },

    // ── ORG A — PRESENT / TODAY (2026-05-18) ──────────────────────────────────

    {
      id: "seed-ev-19",
      title: "Cocktail de Saxofón — Moon Palace",
      description: "Luis Morales en la hora del cóctel de bienvenida a grupo de convenciones",
      date: "2026-05-18", time: "18:00", durationMinutes: 60,
      ...H.moon, musician: mLuis.name, musicianId: mLuis.id,
      ...scheduled, organizationId: orgA.id,
    },
    {
      id: "seed-ev-20",
      title: "Jazz Trio — Paradisus (Esta Noche)",
      description: "Actuación estelar del Jazz Trio Cancún para la cena de gala",
      date: "2026-05-18", time: "21:00", durationMinutes: 120,
      ...H.paradisus, band: band1.name, bandId: band1.id,
      ...scheduled, organizationId: orgA.id,
    },

    // ── ORG A — PRÓXIMOS (Semana 2 de mayo) ───────────────────────────────────

    {
      id: "seed-ev-21",
      title: "Piano & Candlelight — Iberostar",
      description: "Carlos Mendoza en piano para cena romántica del día de las madres",
      date: "2026-05-20", time: "19:00", durationMinutes: 90,
      ...H.iberostar, musician: mCarlos.name, musicianId: mCarlos.id,
      ...scheduled, organizationId: orgA.id,
    },
    {
      id: "seed-ev-22",
      title: "Violin & Spa — Hyatt",
      description: "Sofía Vargas en el área de spa para jornada de relajación",
      date: "2026-05-21", time: "10:00", durationMinutes: 60,
      ...H.hyatt, musician: mSofia.name, musicianId: mSofia.id,
      ...scheduled, organizationId: orgA.id,
    },
    {
      id: "seed-ev-23",
      title: "Flamenco Fusión Show — Moon Palace",
      description: "Gran espectáculo de flamenco para grupo de agencias de viaje",
      date: "2026-05-22", time: "20:30", durationMinutes: 100,
      ...H.moon, band: band2.name, bandId: band2.id,
      ...scheduled, organizationId: orgA.id,
    },
    {
      id: "seed-ev-24",
      title: "Guitar Flamenco Pool — Paradisus",
      description: "Miguel Santos en guitarra flamenca para la tarde en la alberca",
      date: "2026-05-24", time: "15:30", durationMinutes: 60,
      ...H.paradisus, musician: mMiguel.name, musicianId: mMiguel.id,
      ...scheduled, organizationId: orgA.id,
    },
    {
      id: "seed-ev-25",
      title: "Jazz Trio Brunch — Hyatt",
      description: "Brunch de jazz para cierre de mes con grupo corporativo",
      date: "2026-05-28", time: "11:30", durationMinutes: 90,
      ...H.hyatt, band: band1.name, bandId: band1.id,
      ...scheduled, organizationId: orgA.id,
    },
    {
      id: "seed-ev-26",
      title: "Sax Lounge — Iberostar",
      description: "Luis Morales: saxofón blues para la noche de fin de semana",
      date: "2026-05-30", time: "22:00", durationMinutes: 75,
      ...H.iberostar, musician: mLuis.name, musicianId: mLuis.id,
      ...scheduled, organizationId: orgA.id,
    },

    // ── ORG A — JUNIO ──────────────────────────────────────────────────────────

    {
      id: "seed-ev-27",
      title: "Jazz Noche — Moon Palace",
      description: "Carlos en piano, noche de jazz para inauguración de nueva ala del hotel",
      date: "2026-06-04", time: "20:00", durationMinutes: 120,
      ...H.moon, musician: mCarlos.name, musicianId: mCarlos.id,
      ...scheduled, organizationId: orgA.id,
    },
    {
      id: "seed-ev-28",
      title: "Cuerdas Clásicas — Paradisus",
      description: "Sofía Vargas: recital de violín para boda en la playa",
      date: "2026-06-07", time: "17:00", durationMinutes: 45,
      ...H.paradisus, musician: mSofia.name, musicianId: mSofia.id,
      ...scheduled, organizationId: orgA.id,
    },
    {
      id: "seed-ev-29",
      title: "Jazz Trio — Iberostar",
      description: "Noche grande de jazz para apertura de temporada alta",
      date: "2026-06-11", time: "21:00", durationMinutes: 120,
      ...H.iberostar, band: band1.name, bandId: band1.id,
      ...scheduled, organizationId: orgA.id,
    },
    {
      id: "seed-ev-30",
      title: "Flamenco Fusión — Hyatt",
      description: "Cierre de semana con show completo de flamenco y percusión",
      date: "2026-06-14", time: "20:00", durationMinutes: 90,
      ...H.hyatt, band: band2.name, bandId: band2.id,
      ...scheduled, organizationId: orgA.id,
    },
    {
      id: "seed-ev-31",
      title: "Sax Cocktail — Moon Palace",
      description: "Luis Morales para recepción de grupo de incentivos",
      date: "2026-06-18", time: "17:30", durationMinutes: 60,
      ...H.moon, musician: mLuis.name, musicianId: mLuis.id,
      ...scheduled, organizationId: orgA.id,
    },
    {
      id: "seed-ev-32",
      title: "Piano Lounge — Paradisus",
      description: "Carlos Mendoza: jazz piano para el bar lounge del hotel",
      date: "2026-06-21", time: "21:00", durationMinutes: 90,
      ...H.paradisus, musician: mCarlos.name, musicianId: mCarlos.id,
      ...scheduled, organizationId: orgA.id,
    },
    {
      id: "seed-ev-33",
      title: "Violin Serenade — Iberostar",
      description: "Sofía Vargas: serenata de violín para aniversario de hotel",
      date: "2026-06-25", time: "19:00", durationMinutes: 60,
      ...H.iberostar, musician: mSofia.name, musicianId: mSofia.id,
      ...scheduled, organizationId: orgA.id,
    },
    {
      id: "seed-ev-34",
      title: "Flamenco Guitar Solo — Moon Palace",
      description: "Miguel Santos en guitarra flamenca para evento de lujo",
      date: "2026-06-28", time: "20:00", durationMinutes: 75,
      ...H.moon, musician: mMiguel.name, musicianId: mMiguel.id,
      ...scheduled, organizationId: orgA.id,
    },
    {
      id: "seed-ev-35",
      title: "Jazz Trio Cierre de Junio — Hyatt",
      description: "Actuación de cierre de temporada con el trío completo",
      date: "2026-06-30", time: "20:30", durationMinutes: 120,
      ...H.hyatt, band: band1.name, bandId: band1.id,
      ...scheduled, organizationId: orgA.id,
    },

    // ── ORG B — PAST (completed / cancelled) ──────────────────────────────────

    {
      id: "seed-ev-36",
      title: "Bossa Nova Brunch — Paradisus",
      description: "Ana Rodríguez en voz y guitarra para brunch dominical",
      date: "2026-03-08", time: "11:00", durationMinutes: 90,
      ...H.paradisus, musician: mAna.name, musicianId: mAna.id,
      ...done("2026-03-08", 11), organizationId: orgB.id,
    },
    {
      id: "seed-ev-37",
      title: "Caribbean Sunset — Xcaret",
      description: "Dúo de música latina y bossa nova para show de noche",
      date: "2026-03-15", time: "20:00", durationMinutes: 100,
      ...H.xcaret, band: band3.name, bandId: band3.id,
      ...done("2026-03-15", 20), organizationId: orgB.id,
    },
    {
      id: "seed-ev-38",
      title: "Flamenco Fusión — Xcaret",
      description: "Show completo de flamenco con fusión latina para evento especial",
      date: "2026-03-22", time: "21:00", durationMinutes: 90,
      ...H.xcaret, band: band2.name, bandId: band2.id,
      ...done("2026-03-22", 21), organizationId: orgB.id,
    },
    {
      id: "seed-ev-39",
      title: "Boleros & Vino — Hyatt",
      description: "María Elena Castro en boleros para cena romántica",
      date: "2026-03-28", time: "19:30", durationMinutes: 60,
      ...H.hyatt, musician: mMariaElena.name, musicianId: mMariaElena.id,
      ...done("2026-03-28", 19), organizationId: orgB.id,
    },
    {
      id: "seed-ev-40",
      title: "Bossa Nova Pool — Xcaret",
      description: "Ana Rodríguez junto a la alberca principal, tarde caribeña",
      date: "2026-04-05", time: "15:30", durationMinutes: 60,
      ...H.xcaret, musician: mAna.name, musicianId: mAna.id,
      ...done("2026-04-05", 15), organizationId: orgB.id,
    },
    {
      id: "seed-ev-41",
      title: "Caribbean Sunset — Hyatt",
      description: "Dúo de bossa nova para cocktail de bienvenida a grupo VIP",
      date: "2026-04-12", time: "17:00", durationMinutes: 75,
      ...H.hyatt, band: band3.name, bandId: band3.id,
      ...done("2026-04-12", 17), organizationId: orgB.id,
    },
    {
      id: "seed-ev-42",
      title: "Flamenco Guitar — Paradisus",
      description: "Miguel Santos en solitario — cancelado por tormenta eléctrica",
      date: "2026-04-19", time: "20:00", durationMinutes: 75,
      ...H.paradisus, musician: mMiguel.name, musicianId: mMiguel.id,
      ...cancelled, organizationId: orgB.id,
    },
    {
      id: "seed-ev-43",
      title: "Latin Pop Night — Xcaret",
      description: "María Elena Castro: éxitos del pop latino para show nocturno",
      date: "2026-04-25", time: "21:00", durationMinutes: 90,
      ...H.xcaret, musician: mMariaElena.name, musicianId: mMariaElena.id,
      ...done("2026-04-25", 21), organizationId: orgB.id,
    },
    {
      id: "seed-ev-44",
      title: "Caribbean Sunset — Xcaret",
      description: "Ana & Miguel en el show nocturno de temporada alta",
      date: "2026-05-03", time: "20:30", durationMinutes: 90,
      ...H.xcaret, band: band3.name, bandId: band3.id,
      ...done("2026-05-03", 20), organizationId: orgB.id,
    },
    {
      id: "seed-ev-45",
      title: "Boleros al Atardecer — Hyatt",
      description: "María Elena Castro en boleros para happy hour de la terraza",
      date: "2026-05-10", time: "17:00", durationMinutes: 60,
      ...H.hyatt, musician: mMariaElena.name, musicianId: mMariaElena.id,
      ...done("2026-05-10", 17), organizationId: orgB.id,
    },
    {
      id: "seed-ev-46",
      title: "Bossa Nova Brunch — Xcaret",
      description: "Ana Rodríguez para brunch de fin de semana en el restaurante principal",
      date: "2026-05-16", time: "12:00", durationMinutes: 75,
      ...H.xcaret, musician: mAna.name, musicianId: mAna.id,
      ...done("2026-05-16", 12), organizationId: orgB.id,
    },

    // ── ORG B — PRESENT / TODAY (2026-05-18) ──────────────────────────────────

    {
      id: "seed-ev-47",
      title: "Boleros Cena — Paradisus",
      description: "María Elena Castro en boleros para la cena de esta noche",
      date: "2026-05-18", time: "20:00", durationMinutes: 60,
      ...H.paradisus, musician: mMariaElena.name, musicianId: mMariaElena.id,
      ...scheduled, organizationId: orgB.id,
    },
    {
      id: "seed-ev-48",
      title: "Caribbean Sunset — Xcaret (Esta Noche)",
      description: "Show del dúo para la noche de gala del Xcaret",
      date: "2026-05-18", time: "21:30", durationMinutes: 90,
      ...H.xcaret, band: band3.name, bandId: band3.id,
      ...scheduled, organizationId: orgB.id,
    },

    // ── ORG B — PRÓXIMOS ───────────────────────────────────────────────────────

    {
      id: "seed-ev-49",
      title: "Bossa Nova Cena — Hyatt",
      description: "Ana Rodríguez: voz y guitarra para cena de grupo europeo",
      date: "2026-05-22", time: "19:30", durationMinutes: 75,
      ...H.hyatt, musician: mAna.name, musicianId: mAna.id,
      ...scheduled, organizationId: orgB.id,
    },
    {
      id: "seed-ev-50",
      title: "Caribbean Sunset — Paradisus",
      description: "Dúo para la fiesta de piscina de fin de semana",
      date: "2026-05-23", time: "16:00", durationMinutes: 90,
      ...H.paradisus, band: band3.name, bandId: band3.id,
      ...scheduled, organizationId: orgB.id,
    },
    {
      id: "seed-ev-51",
      title: "Latin Pop & Cocktails — Xcaret",
      description: "María Elena Castro para el cocktail de bienvenida de convención",
      date: "2026-05-29", time: "18:00", durationMinutes: 60,
      ...H.xcaret, musician: mMariaElena.name, musicianId: mMariaElena.id,
      ...scheduled, organizationId: orgB.id,
    },
    {
      id: "seed-ev-52",
      title: "Flamenco Fusión — Xcaret",
      description: "Show completo de flamenco para noche de gala de junio",
      date: "2026-06-06", time: "21:00", durationMinutes: 100,
      ...H.xcaret, band: band2.name, bandId: band2.id,
      ...scheduled, organizationId: orgB.id,
    },
    {
      id: "seed-ev-53",
      title: "Caribbean Sunset — Hyatt",
      description: "Ana & Miguel para brunch de verano del Hyatt",
      date: "2026-06-13", time: "11:30", durationMinutes: 90,
      ...H.hyatt, band: band3.name, bandId: band3.id,
      ...scheduled, organizationId: orgB.id,
    },
    {
      id: "seed-ev-54",
      title: "Flamenco Guitar Solo — Xcaret",
      description: "Miguel Santos en guitarra flamenca para cena especial de aniversario",
      date: "2026-06-20", time: "20:00", durationMinutes: 75,
      ...H.xcaret, musician: mMiguel.name, musicianId: mMiguel.id,
      ...scheduled, organizationId: orgB.id,
    },
    {
      id: "seed-ev-55",
      title: "Boleros del Caribe — Paradisus",
      description: "María Elena Castro: noche de boleros en la terraza frente al mar",
      date: "2026-06-27", time: "19:00", durationMinutes: 90,
      ...H.paradisus, musician: mMariaElena.name, musicianId: mMariaElena.id,
      ...scheduled, organizationId: orgB.id,
    },
  ]

  let eventsCreated = 0
  for (const ev of events) {
    await prisma.event.upsert({
      where: { id: ev.id },
      update: {},
      create: {
        id: ev.id,
        title: ev.title,
        description: ev.description,
        date: ev.date,
        time: ev.time,
        durationMinutes: ev.durationMinutes,
        hotel: ev.hotel,
        hotelId: ev.hotelId,
        musician: ev.musician,
        musicianId: ev.musicianId,
        band: ev.band,
        bandId: ev.bandId,
        status: ev.status,
        checkedIn: ev.checkedIn ?? false,
        checkInTime: ev.checkInTime,
        checkInLocation: ev.checkInLocation,
        organizationId: ev.organizationId,
      },
    })
    eventsCreated++
  }
  console.log(`  ✓ ${eventsCreated} events seeded (past/completed + cancelled + scheduled)`)

  // ── Notifications ─────────────────────────────────────────────────────────

  await prisma.notification.upsert({
    where: { id: "seed-notif-1" },
    update: {},
    create: {
      id: "seed-notif-1",
      userId: managerA.id,
      title: "Nuevo evento esta noche",
      message: "Jazz Trio Cancún se presenta en Paradisus a las 21:00",
      type: "info",
      read: false,
      eventId: "seed-ev-20",
    },
  })
  await prisma.notification.upsert({
    where: { id: "seed-notif-2" },
    update: {},
    create: {
      id: "seed-notif-2",
      userId: managerB.id,
      title: "Evento confirmado",
      message: "Caribbean Sunset Duo confirmado en Xcaret para esta noche",
      type: "success",
      read: false,
      eventId: "seed-ev-48",
    },
  })
  console.log("  ✓ Notifications seeded")

  console.log(`
✅ Seed complete — ${eventsCreated} events across 2 orgs.

Demo credentials (all use password: 123456)
  Super-admin : admin@platform.com
  Manager A   : gerente@test.com        (Sonidos del Mar)
  Manager B   : gerente2@test.com       (Ritmo Caribe)
  Musician    : musico@test.com          (Carlos — Org A)
  Musician    : ana@test.com             (Ana — Org B)
  Hotel user  : hotel@test.com           (Org A)

Musicians: Carlos, Ana, Miguel, Sofía, Luis, María Elena
Bands    : Jazz Trio Cancún, Flamenco Fusión, Caribbean Sunset Duo
Hotels   : Paradisus, Moon Palace, Xcaret, Iberostar, Hyatt Ziva
`)
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
