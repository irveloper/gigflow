/**
 * Dedicated Demo Seeder File
 * Creates 1 Organization with:
 * - 30 Hotels (linked via HotelOrganization)
 * - 50 Musicians (linked via MusicianOrganization, each with a User account)
 * - 5 Bands (composed of some of the musicians, linked via BandOrganization)
 * - 75+ Events distributed across past, present, and future with various statuses and check-ins
 * - Rich EventAuditLog history for all events
 * - Notifications for the demo users
 *
 * Usage: npx tsx prisma/demo-seed.ts
 */

import { PrismaClient, Prisma } from "@prisma/client"
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
const ORG_ID = "demo-org"
const ORG_SLUG = "gigflow-resorts"
const ORG_NAME = "GigFlow Resorts & Entertainment"

// Base date for relative event generation
const BASE_DATE_STR = "2026-05-22"

function getRelativeDateString(offsetDays: number): string {
  const baseDate = new Date(`${BASE_DATE_STR}T00:00:00.000Z`)
  baseDate.setUTCDate(baseDate.getUTCDate() + offsetDays)
  const yyyy = baseDate.getUTCFullYear()
  const mm = String(baseDate.getUTCMonth() + 1).padStart(2, "0")
  const dd = String(baseDate.getUTCDate()).padStart(2, "0")
  return `${yyyy}-${mm}-${dd}`
}

function getRelativeDateTime(offsetDays: number, timeStr: string): string {
  const dateStr = getRelativeDateString(offsetDays)
  return new Date(`${dateStr}T${timeStr}:00.000Z`).toISOString()
}

// 30 Luxury Hotels in Mexico
const HOTEL_NAMES = [
  "Grand Velas Riviera Maya",
  "Rosewood Mayakoba",
  "Banyan Tree Mayakoba",
  "Secrets Akumal Riviera",
  "Dreams Jade Resort",
  "Paradisus Playa del Carmen",
  "Hyatt Zilara Cancun",
  "Hyatt Ziva Cancun",
  "The Ritz-Carlton Cancun",
  "JW Marriott Cancun Resort",
  "Waldorf Astoria Cancun",
  "Hilton Cancun All-Inclusive",
  "Kempinski Hotel Cancun",
  "Iberostar Grand Paraiso",
  "Valentin Imperial Riviera",
  "El Dorado Maroma",
  "Unico 20 87 Riviera Maya",
  "TRS Yucatan Hotel",
  "Hard Rock Riviera Maya",
  "Bahia Principe Akumal",
  "Barcelo Maya Palace",
  "Occidental at Xcaret Destination",
  "Fairmont Mayakoba",
  "Viceroy Riviera Maya",
  "Zoetry Paraiso de la Bonita",
  "Riu Palace Peninsula",
  "Royalton Riviera Cancun",
  "Excellence Riviera Cancun",
  "Finest Playa Mujeres",
  "Beloved Playa Mujeres"
]

// 50 Musicians
const MUSICIAN_NAMES = [
  "Alejandro Sanz Tribute",
  "Luis Miguel Tribute",
  "Shakira Acoustics",
  "Juanes Style",
  "Carlos Vives Vibe",
  "Maná Cover Band",
  "Soda Stereo Tribute",
  "Gustavo Cerati Tribute",
  "Mercedes Sosa Folk",
  "Astor Piazzolla Quintet",
  "Carlos Santana Tribute",
  "Tito Puente Mambo Band",
  "Celia Cruz Tribute",
  "Buena Vista Social Club Style",
  "Bebo Valdés Piano",
  "Chucho Valdés Jazz",
  "Joao Gilberto Bossa",
  "Antonio Carlos Jobim Tribute",
  "Caetano Veloso Style",
  "Gilberto Gil Vibe",
  "Jorge Ben Jor Style",
  "Gal Costa Tribute",
  "Elis Regina Tribute",
  "Baden Powell Guitar",
  "Paco de Lucía Flamenco",
  "Vicente Amigo Style",
  "Tomatito Flamenco",
  "Camarón Tribute",
  "Gipsy Kings Style",
  "Django Reinhardt Gypsy",
  "Stephane Grappelli Violin",
  "Miles Davis Tribute",
  "John Coltrane Tribute",
  "Charlie Parker Tribute",
  "Thelonious Monk Piano",
  "Bill Evans Tribute",
  "Duke Ellington Swing",
  "Louis Armstrong Tribute",
  "Ella Fitzgerald Tribute",
  "Billie Holiday Tribute",
  "Nina Simone Tribute",
  "Sarah Vaughan Tribute",
  "Frank Sinatra Tribute",
  "Dean Martin Tribute",
  "Sammy Davis Jr. Tribute",
  "Tony Bennett Tribute",
  "Nat King Cole Tribute",
  "Chet Baker Tribute",
  "Stan Getz Sax",
  "Joao Donato Samba"
]

const INSTRUMENTS_LIST = [
  ["Acoustic Guitar", "Voice"],
  ["Electric Guitar"],
  ["Saxophone"],
  ["Piano", "Keyboard"],
  ["Violin", "Cello"],
  ["Flute"],
  ["Percussion", "Drums"],
  ["Turntables", "DJ Mixer"],
  ["Harp"]
]

const STYLES_LIST = [
  ["Jazz", "Bossa Nova"],
  ["Flamenco", "Classical Guitar"],
  ["Latin Pop", "Rock"],
  ["Electronic", "Lounge"],
  ["Classical", "Instrumental"],
  ["Salsa", "Cumbia"],
  ["Mariachi", "Traditional"],
  ["Blues", "Soul"]
]

const PRICE_PER_SET_OPTIONS = [600, 800, 1000, 1200, 1500, 1800, 2000, 2500]

async function cleanDatabase() {
  console.log("🧹 Cleaning existing demo data...")

  // Delete Audit Logs for demo-org or demo events
  const deletedAuditLogs = await prisma.eventAuditLog.deleteMany({
    where: { organizationId: ORG_ID }
  })
  console.log(`  - Deleted ${deletedAuditLogs.count} EventAuditLogs`)

  // Delete Notifications
  const deletedNotifs = await prisma.notification.deleteMany({
    where: {
      user: {
        organizationId: ORG_ID
      }
    }
  })
  console.log(`  - Deleted ${deletedNotifs.count} Notifications`)

  // Delete Events under demo-org
  const deletedEvents = await prisma.event.deleteMany({
    where: { organizationId: ORG_ID }
  })
  console.log(`  - Deleted ${deletedEvents.count} Events`)

  // Delete Band Member links
  const deletedBandMembers = await prisma.bandMember.deleteMany({
    where: {
      band: {
        organizations: {
          some: { organizationId: ORG_ID }
        }
      }
    }
  })
  console.log(`  - Deleted ${deletedBandMembers.count} BandMembers`)

  // Delete Band Organizations
  const deletedBandOrgs = await prisma.bandOrganization.deleteMany({
    where: { organizationId: ORG_ID }
  })
  console.log(`  - Deleted ${deletedBandOrgs.count} BandOrganizations`)

  // Delete Bands
  const deletedBands = await prisma.band.deleteMany({
    where: {
      id: { startsWith: "demo-band-" }
    }
  })
  console.log(`  - Deleted ${deletedBands.count} Bands`)

  // Delete Hotel Organizations
  const deletedHotelOrgs = await prisma.hotelOrganization.deleteMany({
    where: { organizationId: ORG_ID }
  })
  console.log(`  - Deleted ${deletedHotelOrgs.count} HotelOrganizations`)

  // Delete Hotels
  const deletedHotels = await prisma.hotel.deleteMany({
    where: {
      id: { startsWith: "demo-hotel-" }
    }
  })
  console.log(`  - Deleted ${deletedHotels.count} Hotels`)

  // Delete Musician Organizations
  const deletedMusicianOrgs = await prisma.musicianOrganization.deleteMany({
    where: { organizationId: ORG_ID }
  })
  console.log(`  - Deleted ${deletedMusicianOrgs.count} MusicianOrganizations`)

  // Delete Users (musicians, managers, hotel contacts)
  const deletedUsers = await prisma.user.deleteMany({
    where: { organizationId: ORG_ID }
  })
  console.log(`  - Deleted ${deletedUsers.count} Users`)

  // Delete Musicians
  const deletedMusicians = await prisma.musician.deleteMany({
    where: {
      id: { startsWith: "demo-musician-" }
    }
  })
  console.log(`  - Deleted ${deletedMusicians.count} Musicians`)

  // Delete Subscription
  const deletedSub = await prisma.subscription.deleteMany({
    where: { organizationId: ORG_ID }
  })
  console.log(`  - Deleted ${deletedSub.count} Subscription`)

  // Delete Organization
  const deletedOrg = await prisma.organization.deleteMany({
    where: { id: ORG_ID }
  })
  console.log(`  - Deleted ${deletedOrg.count} Organization`)
}

async function main() {
  console.log("🌱 Starting demo database seed...")
  const hashedPassword = await bcrypt.hash(DEMO_PASSWORD, 12)

  // 1. Clean existing demo seed data
  await cleanDatabase()

  // 2. Create Organization
  const org = await prisma.organization.create({
    data: {
      id: ORG_ID,
      name: ORG_NAME,
      slug: ORG_SLUG,
      status: "active"
    }
  })
  console.log(`✓ Created Organization: ${org.name} (${org.slug})`)

  // 3. Create Subscription
  await prisma.subscription.create({
    data: {
      id: "demo-sub",
      organizationId: org.id,
      stripeCustomerId: "cus_demo_org_owner",
      stripeSubscriptionId: "sub_demo_org_owner",
      stripePriceId: "price_dev_growth_monthly",
      status: "active",
      seatLimit: 100,
      cancelAtPeriodEnd: false,
      currentPeriodEnd: new Date("2027-05-22")
    }
  })
  console.log("✓ Created Subscription")

  // 4. Create Manager/Owner User
  const manager = await prisma.user.create({
    data: {
      id: "demo-user-manager",
      email: "owner@demo.com",
      name: "Sebastian Valenzuela",
      password: hashedPassword,
      role: "manager",
      phone: "+52 984 888 1234",
      isActive: true,
      emailVerified: new Date(),
      organizationId: org.id
    }
  })
  console.log(`✓ Created Manager User: ${manager.email} (Password: ${DEMO_PASSWORD})`)

  // 5. Create 30 Hotels
  console.log("🏨 Seeding 30 Hotels...")
  const hotels: any[] = []
  for (let i = 0; i < HOTEL_NAMES.length; i++) {
    const name = HOTEL_NAMES[i]
    const id = `demo-hotel-${i + 1}`
    const email = `events@hotel-${i + 1}.demo.com`

    const hotel = await prisma.hotel.create({
      data: {
        id,
        name,
        email,
        phone: `+52 984 555 10${String(i + 1).padStart(2, "0")}`,
        address: `Blvd. Kukulcan Km ${10 + i * 0.5}, Zona Hotelera`,
        city: i % 2 === 0 ? "Cancún" : "Playa del Carmen",
        state: "Quintana Roo",
        stateCode: "ROO",
        countryCode: "MX",
        country: "Mexico",
        postalCode: i % 2 === 0 ? "77500" : "77710",
        contactPerson: `Manager Hotel ${i + 1}`,
        isActive: true
      }
    })

    // Link Hotel to Organization
    await prisma.hotelOrganization.create({
      data: {
        hotelId: hotel.id,
        organizationId: org.id,
        contactPerson: hotel.contactPerson,
        contactPhone: hotel.phone
      }
    })

    hotels.push(hotel)
  }
  console.log(`✓ Seeded ${hotels.length} hotels and linked them to the organization`)

  // Create User accounts for the first 5 hotels
  for (let i = 0; i < 5; i++) {
    await prisma.user.create({
      data: {
        id: `demo-user-hotel-${i + 1}`,
        email: `hotel${i + 1}@demo.com`,
        name: `Coordinator - ${hotels[i].name}`,
        password: hashedPassword,
        role: "hotel",
        phone: hotels[i].phone,
        isActive: true,
        emailVerified: new Date(),
        organizationId: org.id,
        hotelId: hotels[i].id
      }
    })
  }
  console.log("✓ Created 5 Hotel User accounts (hotel1@demo.com to hotel5@demo.com)")

  // 6. Create 50 Musicians
  console.log("🎵 Seeding 50 Musicians...")
  const musicians: any[] = []
  for (let i = 0; i < MUSICIAN_NAMES.length; i++) {
    const name = MUSICIAN_NAMES[i]
    const id = `demo-musician-${i + 1}`
    const email = `musician${i + 1}@demo.com`

    const musician = await prisma.musician.create({
      data: {
        id,
        name,
        email,
        phone: `+52 998 777 20${String(i + 1).padStart(2, "0")}`,
        instruments: INSTRUMENTS_LIST[i % INSTRUMENTS_LIST.length],
        styles: STYLES_LIST[i % STYLES_LIST.length],
        pricePerSet: PRICE_PER_SET_OPTIONS[i % PRICE_PER_SET_OPTIONS.length],
        isActive: true
      }
    })

    // Link Musician to Organization
    await prisma.musicianOrganization.create({
      data: {
        musicianId: musician.id,
        organizationId: org.id
      }
    })

    // Create User account for this musician so they can log in
    await prisma.user.create({
      data: {
        id: `demo-user-musician-${i + 1}`,
        email,
        name,
        password: hashedPassword,
        role: "musician",
        phone: musician.phone,
        instruments: musician.instruments,
        styles: musician.styles,
        pricePerSet: musician.pricePerSet,
        isActive: true,
        emailVerified: new Date(),
        organizationId: org.id,
        musicianId: musician.id
      }
    })

    musicians.push(musician)
  }
  console.log(`✓ Seeded ${musicians.length} musicians, linked them to organization, and created User accounts (musician1@demo.com to musician50@demo.com)`)

  // 7. Create 5 Bands
  console.log("🎷 Seeding 5 Bands...")
  const bands: any[] = []
  const bandSpecs = [
    { name: "Cancun Jazz Quartet", genre: "Jazz", pricePerSet: 3500, memberOffsets: [0, 1, 2, 3] },
    { name: "Cabo Flamenco Duo", genre: "Flamenco", pricePerSet: 1800, memberOffsets: [4, 5] },
    { name: "Riviera Bossa & Soul", genre: "Bossa Nova", pricePerSet: 2600, memberOffsets: [6, 7, 8] },
    { name: "Mayan Acoustic Trio", genre: "Acoustic", pricePerSet: 2200, memberOffsets: [9, 10, 11] },
    { name: "Tulum DJ & Sax Live", genre: "Electronic / Lounge", pricePerSet: 3000, memberOffsets: [12, 13] }
  ]

  for (let i = 0; i < bandSpecs.length; i++) {
    const spec = bandSpecs[i]
    const band = await prisma.band.create({
      data: {
        id: `demo-band-${i + 1}`,
        name: spec.name,
        description: `Premium musical group playing ${spec.genre} for upscale hotel venues.`,
        genre: spec.genre,
        pricePerSet: spec.pricePerSet,
        isActive: true
      }
    })

    // Link to Org
    await prisma.bandOrganization.create({
      data: {
        bandId: band.id,
        organizationId: org.id
      }
    })

    // Add members
    for (const offset of spec.memberOffsets) {
      await prisma.bandMember.create({
        data: {
          bandId: band.id,
          musicianId: musicians[offset].id
        }
      })
    }

    bands.push(band)
  }
  console.log(`✓ Seeded ${bands.length} bands and associated their members`)

  // 8. Create Events (75 events)
  console.log("📅 Generating 75 events (past, present, future)...")
  let eventsCreated = 0
  const auditLogsToCreate: any[] = []

  // Define offsets: past (-60 to -1), present (0), future (1 to 60)
  // Past: 35 events
  // Present: 10 events
  // Future: 30 events

  // Helper to record audit log locally for bulk insertion later
  function recordAuditLog(
    eventId: string,
    action: string,
    actorRole: "manager" | "musician" | "system",
    actorName: string,
    actorId: string | null,
    offsetDays: number,
    timeStr: string,
    metadata?: any
  ) {
    // Generate timestamp slightly relative to event time
    const eventTime = getRelativeDateTime(offsetDays, timeStr)
    const timestamp = new Date(eventTime)
    if (action === "EVENT_CREATED") {
      timestamp.setDate(timestamp.getDate() - 14) // created 2 weeks before
    } else if (action === "MUSICIAN_ASSIGNED" || action === "BAND_ASSIGNED") {
      timestamp.setDate(timestamp.getDate() - 13) // assigned 13 days before
    } else if (action === "CHECK_IN_RECORDED") {
      timestamp.setMinutes(timestamp.getMinutes() + 5) // checked in 5 mins late
    } else if (action === "STATUS_CHANGED") {
      timestamp.setHours(timestamp.getHours() + 2) // completed 2 hours later
    } else if (action === "PAYMENT_STATUS_CHANGED") {
      timestamp.setDate(timestamp.getDate() + 1) // paid 1 day later
    }

    auditLogsToCreate.push({
      eventId,
      organizationId: org.id,
      actorId,
      actorName,
      actorRole,
      action,
      metadata: metadata || null,
      timestamp
    })
  }

  // Helper to determine musical concept from musician or band
  function getConcept(musician: any, band: any): string {
    if (band) {
      const genre = band.genre.toLowerCase()
      if (genre.includes("jazz")) return "Jazz Trio"
      if (genre.includes("bossa")) return "Bossa Nova"
      if (genre.includes("flamenco")) return "Guitar Solo"
      if (genre.includes("acoustic")) return "Acoustic Set"
      return "Acoustic Set"
    }
    if (musician) {
      const styles = (musician.styles || []).map((s: string) => s.toLowerCase())
      const instruments = (musician.instruments || []).map((i: string) => i.toLowerCase())
      const all = [...styles, ...instruments]
      if (all.some(s => s.includes("sax"))) return "Saxophone Solo"
      if (all.some(s => s.includes("piano") || s.includes("keyboard"))) return "Solo Piano"
      if (all.some(s => s.includes("guitar") || s.includes("flamenco"))) return "Guitar Solo"
      if (all.some(s => s.includes("bossa"))) return "Bossa Nova"
      if (all.some(s => s.includes("jazz"))) return "Vocal Jazz"
      if (all.some(s => s.includes("voice") || s.includes("vocal"))) return "Vocal Jazz"
      if (all.some(s => s.includes("salsa") || s.includes("cumbia") || s.includes("latin"))) return "Latin Jazz"
    }
    return "Acoustic Set"
  }

  // --- PAST EVENTS (35 events, offsets: -60 to -1) ---
  for (let idx = 0; idx < 35; idx++) {
    const eventId = `demo-event-past-${idx + 1}`
    const offsetDays = -Math.floor(idx * 1.6 + 1) // distributed dates
    const dateStr = getRelativeDateString(offsetDays)
    const timeStr = ["13:00", "16:30", "19:00", "20:00", "21:30"][idx % 5]
    const sets = [1, 2, 3][idx % 3]

    const hotel = hotels[idx % hotels.length]

    // Determine booking type (80% Solo, 20% Band)
    const isBand = idx % 5 === 0
    const musician = !isBand ? musicians[(idx * 7) % musicians.length] : null
    const band = isBand ? bands[idx % bands.length] : null

    // Determine status (85% completed, 15% cancelled)
    const isCancelled = idx % 7 === 0
    const status = isCancelled ? "cancelled" : "completed"

    const pricePerSet = musician ? musician.pricePerSet : (band ? band.pricePerSet : 1000)
    const price = sets * pricePerSet

    // Check-in info
    const checkedIn = !isCancelled && idx % 10 !== 0 // 10% missed check-in but completed
    const checkInTime = checkedIn ? getRelativeDateTime(offsetDays, timeStr) : null
    const checkInLocation = checkedIn ? ["Restaurante Principal", "Sky Bar", "Lobby", "Beach Club"][idx % 4] : null
    const checkInComments = checkedIn ? "Set up complete, audio levels optimized." : null

    // Payment info
    const isPaid = !isCancelled && idx % 3 !== 0 // 66% paid
    const paymentStatus = isPaid ? "paid" : "pending"
    const paymentNotes = isPaid ? `SPEI Transfer Ref: TXN-${Math.floor(100000 + Math.random() * 900000)}` : null

    const concept = getConcept(musician, band)

    await prisma.event.create({
      data: {
        id: eventId,
        title: musician ? `${musician.name} en Vivo` : `${band?.name} Show`,
        description: `Presentación en vivo para huéspedes de ${hotel.name}.`,
        concept,
        date: dateStr,
        time: timeStr,
        sets,
        hotel: hotel.name,
        hotelId: hotel.id,
        musician: musician ? musician.name : null,
        musicianId: musician ? musician.id : null,
        band: band ? band.name : null,
        bandId: band ? band.id : null,
        status,
        checkedIn,
        checkInTime: checkInTime ? new Date(checkInTime) : null,
        checkInLocation: checkInLocation ? checkInLocation : Prisma.DbNull,
        checkInComments,
        price,
        paymentStatus,
        paymentNotes,
        organizationId: org.id
      }
    })

    // Record Audit Logs
    recordAuditLog(eventId, "EVENT_CREATED", "manager", manager.name, manager.id, offsetDays, timeStr)
    if (musician) {
      recordAuditLog(eventId, "MUSICIAN_ASSIGNED", "manager", manager.name, manager.id, offsetDays, timeStr, { musicianId: musician.id, name: musician.name })
    } else if (band) {
      recordAuditLog(eventId, "BAND_ASSIGNED", "manager", manager.name, manager.id, offsetDays, timeStr, { bandId: band.id, name: band.name })
    }

    if (status === "cancelled") {
      recordAuditLog(eventId, "STATUS_CHANGED", "manager", manager.name, manager.id, offsetDays, timeStr, { from: "scheduled", to: "cancelled", reason: "Weather issues" })
    } else {
      if (checkedIn && checkInTime) {
        const musId = musician ? musician.id : null
        const musName = musician ? musician.name : `Band Crew - ${band?.name}`
        recordAuditLog(eventId, "CHECK_IN_RECORDED", "musician", musName, musId, offsetDays, timeStr, { location: checkInLocation })
      }
      recordAuditLog(eventId, "STATUS_CHANGED", "system", "System", null, offsetDays, timeStr, { from: "scheduled", to: "completed" })
      if (isPaid) {
        recordAuditLog(eventId, "PAYMENT_STATUS_CHANGED", "manager", manager.name, manager.id, offsetDays, timeStr, { from: "pending", to: "paid", notes: paymentNotes })
      }
    }

    eventsCreated++
  }

  // --- PRESENT EVENTS (10 events, offset: 0, today `2026-05-22`) ---
  const presentEventsData = [
    // 1. Morning event, completed, checked-in, paid
    {
      time: "09:00",
      sets: 2,
      hotelIdx: 0,
      isBand: false,
      musIdx: 0,
      status: "completed",
      checkedIn: true,
      paymentStatus: "paid"
    },
    // 2. Brunch event, completed, checked-in, pending payment
    {
      time: "11:30",
      sets: 1,
      hotelIdx: 1,
      isBand: false,
      musIdx: 1,
      status: "completed",
      checkedIn: true,
      paymentStatus: "pending"
    },
    // 3. Lunch event, in-progress, checked-in, pending payment
    {
      time: "13:00",
      sets: 2,
      hotelIdx: 2,
      isBand: true,
      bandIdx: 0,
      status: "in-progress",
      checkedIn: true,
      paymentStatus: "pending"
    },
    // 4. Afternoon event, scheduled, checked-in (early check-in), pending payment
    {
      time: "15:00",
      sets: 2,
      hotelIdx: 3,
      isBand: false,
      musIdx: 2,
      status: "scheduled",
      checkedIn: true,
      paymentStatus: "pending"
    },
    // 5. Sunset event, scheduled, unchecked-in, pending payment
    {
      time: "18:00",
      sets: 1,
      hotelIdx: 4,
      isBand: false,
      musIdx: 3,
      status: "scheduled",
      checkedIn: false,
      paymentStatus: "pending"
    },
    // 6. Dinner event, scheduled, unchecked-in, pending payment
    {
      time: "20:00",
      sets: 2,
      hotelIdx: 5,
      isBand: true,
      bandIdx: 1,
      status: "scheduled",
      checkedIn: false,
      paymentStatus: "pending"
    },
    // 7. Late evening event, scheduled, unchecked-in, pending payment
    {
      time: "21:30",
      sets: 2,
      hotelIdx: 6,
      isBand: false,
      musIdx: 4,
      status: "scheduled",
      checkedIn: false,
      paymentStatus: "pending"
    },
    // 8. Canceled event, cancelled, pending
    {
      time: "17:00",
      sets: 2,
      hotelIdx: 7,
      isBand: false,
      musIdx: 5,
      status: "cancelled",
      checkedIn: false,
      paymentStatus: "pending"
    },
    // 9. Unassigned event, scheduled, pending
    {
      time: "19:00",
      sets: 2,
      hotelIdx: 8,
      isBand: false,
      isUnassigned: true,
      status: "scheduled",
      checkedIn: false,
      paymentStatus: "pending"
    },
    // 10. Late night event, scheduled, unchecked-in, pending
    {
      time: "23:00",
      sets: 1,
      hotelIdx: 9,
      isBand: false,
      musIdx: 6,
      status: "scheduled",
      checkedIn: false,
      paymentStatus: "pending"
    }
  ]

  for (let idx = 0; idx < presentEventsData.length; idx++) {
    const data = presentEventsData[idx]
    const eventId = `demo-event-today-${idx + 1}`
    const hotel = hotels[data.hotelIdx]
    const musician = !data.isBand && !data.isUnassigned ? musicians[data.musIdx!] : null
    const band = data.isBand ? bands[data.bandIdx!] : null

    const pricePerSet = musician ? musician.pricePerSet : (band ? band.pricePerSet : 1000)
    const price = data.isUnassigned ? null : data.sets * pricePerSet

    const checkInTime = data.checkedIn ? getRelativeDateTime(0, data.time) : null
    const checkInLocation = data.checkedIn ? "Lobby Deck" : null
    const checkInComments = data.checkedIn ? "Verified by manager" : null

    const paymentNotes = data.paymentStatus === "paid" ? "Paid at checkout" : null

    const concept = getConcept(musician, band)

    await prisma.event.create({
      data: {
        id: eventId,
        title: data.isUnassigned
          ? "Show Acústico Pendiente"
          : (musician ? `${musician.name} en Vivo` : `${band?.name} Show`),
        description: `Presentación del día de hoy en ${hotel.name}.`,
        concept,
        date: BASE_DATE_STR,
        time: data.time,
        sets: data.sets,
        hotel: hotel.name,
        hotelId: hotel.id,
        musician: musician ? musician.name : null,
        musicianId: musician ? musician.id : null,
        band: band ? band.name : null,
        bandId: band ? band.id : null,
        status: data.status,
        checkedIn: data.checkedIn,
        checkInTime: checkInTime ? new Date(checkInTime) : null,
        checkInLocation: checkInLocation ? checkInLocation : Prisma.DbNull,
        checkInComments,
        price,
        paymentStatus: data.paymentStatus,
        paymentNotes,
        organizationId: org.id
      }
    })

    // Audit logs
    recordAuditLog(eventId, "EVENT_CREATED", "manager", manager.name, manager.id, 0, data.time)
    if (musician) {
      recordAuditLog(eventId, "MUSICIAN_ASSIGNED", "manager", manager.name, manager.id, 0, data.time, { musicianId: musician.id, name: musician.name })
    } else if (band) {
      recordAuditLog(eventId, "BAND_ASSIGNED", "manager", manager.name, manager.id, 0, data.time, { bandId: band.id, name: band.name })
    }

    if (data.status === "cancelled") {
      recordAuditLog(eventId, "STATUS_CHANGED", "manager", manager.name, manager.id, 0, data.time, { from: "scheduled", to: "cancelled", reason: "Hotel request" })
    } else {
      if (data.checkedIn && checkInTime) {
        const musId = musician ? musician.id : null
        const musName = musician ? musician.name : `Band Crew - ${band?.name}`
        recordAuditLog(eventId, "CHECK_IN_RECORDED", "musician", musName, musId, 0, data.time, { location: "Lobby Deck" })
      }
      if (data.status === "completed") {
        recordAuditLog(eventId, "STATUS_CHANGED", "system", "System", null, 0, data.time, { from: "scheduled", to: "completed" })
        if (data.paymentStatus === "paid") {
          recordAuditLog(eventId, "PAYMENT_STATUS_CHANGED", "manager", manager.name, manager.id, 0, data.time, { from: "pending", to: "paid", notes: paymentNotes })
        }
      }
    }

    eventsCreated++
  }

  // --- FUTURE EVENTS (30 events, offsets: 1 to 60) ---
  for (let idx = 0; idx < 30; idx++) {
    const eventId = `demo-event-future-${idx + 1}`
    const offsetDays = Math.floor(idx * 2 + 1) // distributed dates
    const dateStr = getRelativeDateString(offsetDays)
    const timeStr = ["14:00", "17:00", "19:30", "20:00", "21:00"][idx % 5]
    const sets = [1, 2, 3][idx % 3]

    const hotel = hotels[(idx + 10) % hotels.length]

    // Determine type: 80% solo, 15% band, 5% unassigned
    const typeRoll = idx % 20
    let musician: any = null
    let band: any = null
    let isUnassigned = false

    if (typeRoll === 0) {
      isUnassigned = true
    } else if (typeRoll >= 17) {
      band = bands[idx % bands.length]
    } else {
      musician = musicians[(idx * 11) % musicians.length]
    }

    // Status: 95% scheduled, 5% cancelled
    const isCancelled = idx === 13 || idx === 27 // two cancelled future events
    const status = isCancelled ? "cancelled" : "scheduled"

    const pricePerSet = musician ? musician.pricePerSet : (band ? band.pricePerSet : 1000)
    const price = isUnassigned ? null : sets * pricePerSet

    const concept = getConcept(musician, band)

    await prisma.event.create({
      data: {
        id: eventId,
        title: isUnassigned
          ? "Banda o Solista por Confirmar"
          : (musician ? `${musician.name} en Vivo` : `${band?.name} Show`),
        description: `Presentación programada en ${hotel.name}.`,
        concept,
        date: dateStr,
        time: timeStr,
        sets,
        hotel: hotel.name,
        hotelId: hotel.id,
        musician: musician ? musician.name : null,
        musicianId: musician ? musician.id : null,
        band: band ? band.name : null,
        bandId: band ? band.id : null,
        status,
        checkedIn: false,
        price,
        paymentStatus: "pending",
        organizationId: org.id
      }
    })

    // Audit logs
    recordAuditLog(eventId, "EVENT_CREATED", "manager", manager.name, manager.id, offsetDays, timeStr)
    if (musician) {
      recordAuditLog(eventId, "MUSICIAN_ASSIGNED", "manager", manager.name, manager.id, offsetDays, timeStr, { musicianId: musician.id, name: musician.name })
    } else if (band) {
      recordAuditLog(eventId, "BAND_ASSIGNED", "manager", manager.name, manager.id, offsetDays, timeStr, { bandId: band.id, name: band.name })
    }

    if (status === "cancelled") {
      recordAuditLog(eventId, "STATUS_CHANGED", "manager", manager.name, manager.id, offsetDays, timeStr, { from: "scheduled", to: "cancelled", reason: "Venue booking adjustment" })
    }

    eventsCreated++
  }

  // Bulk create Audit Logs
  console.log(`✓ Seeded ${eventsCreated} events across past, present, and future`)
  console.log(`📄 Seeding ${auditLogsToCreate.length} event audit log entries...`)
  await prisma.eventAuditLog.createMany({
    data: auditLogsToCreate
  })
  console.log("✓ EventAuditLog entries created")

  // 9. Notifications (for manager and musicians)
  console.log("🔔 Seeding Notifications...")
  const notifData = [
    {
      userId: manager.id,
      title: "Chequeo pendiente hoy",
      message: `${musicians[3].name} tiene una presentación programada en ${hotels[4].name} hoy a las 18:00 y no ha registrado check-in.`,
      type: "warning",
      read: false,
      eventId: "demo-event-today-5"
    },
    {
      userId: manager.id,
      title: "Check-in exitoso",
      message: `${musicians[2].name} completó su check-in en ${hotels[3].name} a tiempo.`,
      type: "success",
      read: false,
      eventId: "demo-event-today-4"
    },
    {
      userId: "demo-user-musician-3", // Musician 3
      title: "Confirmación de Presentación",
      message: `Has sido asignado a un nuevo evento en ${hotels[3].name} para el día de hoy a las 15:00.`,
      type: "info",
      read: false,
      eventId: "demo-event-today-4"
    },
    {
      userId: "demo-user-musician-4", // Musician 4
      title: "Recordatorio de Presentación",
      message: `Recuerda realizar tu check-in para el show de las 18:00 hoy en ${hotels[4].name}.`,
      type: "warning",
      read: false,
      eventId: "demo-event-today-5"
    }
  ]

  for (let i = 0; i < notifData.length; i++) {
    await prisma.notification.create({
      data: {
        id: `demo-notif-${i + 1}`,
        userId: notifData[i].userId,
        title: notifData[i].title,
        message: notifData[i].message,
        type: notifData[i].type,
        read: notifData[i].read,
        eventId: notifData[i].eventId
      }
    })
  }
  console.log("✓ Notifications seeded")

  console.log(`
========================================================================
🎉 Demo database seeding finished successfully!
========================================================================
Summary of seeded records:
  - 1 Organization : ${ORG_NAME} (slug: ${ORG_SLUG})
  - 1 Subscription : Active (seatLimit: 100)
  - 30 Hotels      : Linked to the Org via HotelOrganization
  - 50 Musicians   : Linked to the Org via MusicianOrganization
  - 5 Bands        : Composed of various musicians, linked via BandOrganization
  - 75 Events      : Distributed (35 past, 10 present, 30 future)
  - 120+ AuditLogs : Providing realistic historical logging feed
  - 4 Notifications: Set up for today's demo alerts

Demo credentials (Password for all: ${DEMO_PASSWORD})
  - Manager/Owner : owner@demo.com
  - Hotel Contacts: hotel1@demo.com to hotel5@demo.com
  - Musicians     : musician1@demo.com to musician50@demo.com
========================================================================
`)
}

main()
  .catch((e) => {
    console.error("❌ Error during demo seeding:", e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
    await pool.end()
  })
