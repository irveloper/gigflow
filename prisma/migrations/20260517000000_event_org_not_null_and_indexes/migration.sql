-- Backfill Event.organizationId: assign orphaned events to the first organization.
-- Events with no organizationId pre-date multitenancy; they belong to the founding org.
-- Events that still have NULL after this (i.e. no org exists) are deleted to preserve
-- the NOT NULL constraint introduced below.
UPDATE "Event"
SET "organizationId" = (SELECT "id" FROM "Organization" ORDER BY "createdAt" ASC LIMIT 1)
WHERE "organizationId" IS NULL;

DELETE FROM "Event" WHERE "organizationId" IS NULL;

-- AlterTable: make Event.organizationId non-nullable
ALTER TABLE "Event" ALTER COLUMN "organizationId" SET NOT NULL;

-- CreateIndex: Event.organizationId (most-queried filter)
CREATE INDEX "Event_organizationId_idx" ON "Event"("organizationId");

-- CreateIndex: User.organizationId
CREATE INDEX "User_organizationId_idx" ON "User"("organizationId");

-- CreateIndex: Musician.isActive
CREATE INDEX "Musician_isActive_idx" ON "Musician"("isActive");

-- CreateIndex: Hotel.isActive
CREATE INDEX "Hotel_isActive_idx" ON "Hotel"("isActive");
