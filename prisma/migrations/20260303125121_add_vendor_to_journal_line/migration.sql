-- AlterTable
ALTER TABLE "JournalLine" ADD COLUMN     "vendorId" TEXT;

-- CreateIndex
CREATE INDEX "JournalLine_vendorId_idx" ON "JournalLine"("vendorId");

-- AddForeignKey
ALTER TABLE "JournalLine" ADD CONSTRAINT "JournalLine_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE SET NULL ON UPDATE CASCADE;
