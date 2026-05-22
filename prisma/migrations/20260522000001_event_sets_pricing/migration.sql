-- Migration: event_sets_pricing
-- Replace durationMinutes with sets (1 set = 1 hour) on Event.
-- Rename hourlyRate → pricePerSet on Musician and User.
-- Add pricePerSet to Band.

-- ── Event: durationMinutes → sets ────────────────────────────────────────────

-- Step 1: Add sets column with a temporary default
ALTER TABLE "Event" ADD COLUMN "sets" INTEGER NOT NULL DEFAULT 2;

-- Step 2: Compute sets from durationMinutes (90 min → 2 sets via CEIL)
UPDATE "Event" SET "sets" = CEIL("durationMinutes"::float / 60);

-- Step 3: Drop the temporary default
ALTER TABLE "Event" ALTER COLUMN "sets" DROP DEFAULT;

-- Step 4: Drop durationMinutes
ALTER TABLE "Event" DROP COLUMN "durationMinutes";

-- ── Musician: hourlyRate → pricePerSet ───────────────────────────────────────

ALTER TABLE "Musician" RENAME COLUMN "hourlyRate" TO "pricePerSet";

-- ── User: hourlyRate → pricePerSet ───────────────────────────────────────────

ALTER TABLE "User" RENAME COLUMN "hourlyRate" TO "pricePerSet";

-- ── Band: add pricePerSet ─────────────────────────────────────────────────────

ALTER TABLE "Band" ADD COLUMN "pricePerSet" DOUBLE PRECISION;
