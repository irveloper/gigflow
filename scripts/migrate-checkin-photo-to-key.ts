/**
 * One-time migration: convert Event.checkInPhoto from full S3 URLs to object keys.
 *
 * Before: https://gigflow.s3.us-east-1.amazonaws.com/checkins/{userId}/{eventId}/{ts}.jpg
 * After:  checkins/{userId}/{eventId}/{ts}.jpg
 *
 * Safe to re-run — rows that already contain a key (no "://") are skipped.
 *
 * Run with: pnpm tsx scripts/migrate-checkin-photo-to-key.ts
 */

import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

async function main() {
  const events = await prisma.event.findMany({
    where: { checkInPhoto: { not: null } },
    select: { id: true, checkInPhoto: true },
  })

  console.log(`Found ${events.length} event(s) with checkInPhoto set.`)

  let updated = 0
  let skipped = 0

  for (const event of events) {
    const photo = event.checkInPhoto!

    // Already a key — no "://" means not a URL
    if (!photo.includes("://")) {
      skipped++
      continue
    }

    try {
      const url = new URL(photo)
      // pathname is "/{key}" — strip the leading slash
      const key = url.pathname.slice(1)

      await prisma.event.update({
        where: { id: event.id },
        data: { checkInPhoto: key },
      })

      updated++
      console.log(`  ✓ ${event.id}: ${photo} → ${key}`)
    } catch (err) {
      console.error(`  ✗ ${event.id}: failed to parse "${photo}"`, err)
    }
  }

  console.log(`\nDone. Updated ${updated}, skipped ${skipped} (already keys).`)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
