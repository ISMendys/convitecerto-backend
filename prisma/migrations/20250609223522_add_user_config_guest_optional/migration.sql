-- DropForeignKey
ALTER TABLE "Guest" DROP CONSTRAINT "Guest_eventId_fkey";

-- AlterTable
ALTER TABLE "Guest" ALTER COLUMN "eventId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "Guest" ADD CONSTRAINT "Guest_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE SET NULL ON UPDATE CASCADE;
