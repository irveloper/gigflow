-- Migration: hotel_location_fields
-- Replace unstructured `location` string with 7 structured address columns.
-- Existing rows (all Mexico-based) receive sensible defaults.

-- Step 1: Add new columns with temporary defaults
ALTER TABLE "Hotel" ADD COLUMN "address"     TEXT NOT NULL DEFAULT '';
ALTER TABLE "Hotel" ADD COLUMN "city"        TEXT NOT NULL DEFAULT '';
ALTER TABLE "Hotel" ADD COLUMN "state"       TEXT NOT NULL DEFAULT '';
ALTER TABLE "Hotel" ADD COLUMN "stateCode"   TEXT NOT NULL DEFAULT '';
ALTER TABLE "Hotel" ADD COLUMN "countryCode" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Hotel" ADD COLUMN "country"     TEXT NOT NULL DEFAULT '';
ALTER TABLE "Hotel" ADD COLUMN "postalCode"  TEXT NOT NULL DEFAULT '';

-- Step 2: Migrate existing data (all rows are Mexico hotels)
UPDATE "Hotel" SET
  "address"     = "location",
  "city"        = 'Cancún',
  "state"       = 'Quintana Roo',
  "stateCode"   = 'ROO',
  "countryCode" = 'MX',
  "country"     = 'Mexico',
  "postalCode"  = '77500';

-- Step 3: Drop temporary defaults (columns remain NOT NULL)
ALTER TABLE "Hotel" ALTER COLUMN "address"     DROP DEFAULT;
ALTER TABLE "Hotel" ALTER COLUMN "city"        DROP DEFAULT;
ALTER TABLE "Hotel" ALTER COLUMN "state"       DROP DEFAULT;
ALTER TABLE "Hotel" ALTER COLUMN "stateCode"   DROP DEFAULT;
ALTER TABLE "Hotel" ALTER COLUMN "countryCode" DROP DEFAULT;
ALTER TABLE "Hotel" ALTER COLUMN "country"     DROP DEFAULT;
ALTER TABLE "Hotel" ALTER COLUMN "postalCode"  DROP DEFAULT;

-- Step 4: Drop old location column
ALTER TABLE "Hotel" DROP COLUMN "location";
