-- Step 1: Add new columns first (before dropping old ones)

-- AlterTable (Musician) — add new columns
ALTER TABLE "Musician"
ADD COLUMN "instruments" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN "styles" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable (User) — add new columns
ALTER TABLE "User"
ADD COLUMN "instruments" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN "styles" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- Step 2: Data migration — copy shows → instruments before dropping
UPDATE "Musician" SET "instruments" = "shows";
UPDATE "User" SET "instruments" = "shows";

-- Step 3: Drop old columns
ALTER TABLE "Musician" DROP COLUMN "shows";
ALTER TABLE "User" DROP COLUMN "shows";

-- AlterTable (Event) — add band fields
ALTER TABLE "Event"
ADD COLUMN "band" TEXT,
ADD COLUMN "bandId" TEXT;

-- CreateTable (Band)
CREATE TABLE "Band" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "genre" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Band_pkey" PRIMARY KEY ("id")
);

-- CreateTable (BandMember)
CREATE TABLE "BandMember" (
    "bandId" TEXT NOT NULL,
    "musicianId" TEXT NOT NULL,

    CONSTRAINT "BandMember_pkey" PRIMARY KEY ("bandId","musicianId")
);

-- CreateTable (BandOrganization)
CREATE TABLE "BandOrganization" (
    "bandId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,

    CONSTRAINT "BandOrganization_pkey" PRIMARY KEY ("bandId","organizationId")
);

-- CreateIndex
CREATE INDEX "Band_isActive_idx" ON "Band"("isActive");

-- AddForeignKey
ALTER TABLE "BandMember" ADD CONSTRAINT "BandMember_bandId_fkey" FOREIGN KEY ("bandId") REFERENCES "Band"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BandMember" ADD CONSTRAINT "BandMember_musicianId_fkey" FOREIGN KEY ("musicianId") REFERENCES "Musician"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BandOrganization" ADD CONSTRAINT "BandOrganization_bandId_fkey" FOREIGN KEY ("bandId") REFERENCES "Band"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BandOrganization" ADD CONSTRAINT "BandOrganization_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_bandId_fkey" FOREIGN KEY ("bandId") REFERENCES "Band"("id") ON DELETE SET NULL ON UPDATE CASCADE;
