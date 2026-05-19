-- AddColumn
ALTER TABLE "User" ADD COLUMN "musicianId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "User_musicianId_key" ON "User"("musicianId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_musicianId_fkey" FOREIGN KEY ("musicianId") REFERENCES "Musician"("id") ON DELETE SET NULL ON UPDATE CASCADE;
