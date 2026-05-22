-- Add payment tracking fields to Event
ALTER TABLE "Event" ADD COLUMN "paymentStatus" TEXT NOT NULL DEFAULT 'pending';
ALTER TABLE "Event" ADD COLUMN "paymentNotes" TEXT;
