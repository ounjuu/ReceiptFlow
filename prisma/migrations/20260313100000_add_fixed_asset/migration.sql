-- CreateTable
CREATE TABLE "FixedAsset" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "tenantId" TEXT NOT NULL,
    "assetAccountId" TEXT NOT NULL,
    "depreciationAccountId" TEXT NOT NULL,
    "accumulatedDepAccountId" TEXT NOT NULL,
    "acquisitionDate" TIMESTAMP(3) NOT NULL,
    "acquisitionCost" DECIMAL(18,2) NOT NULL,
    "usefulLifeMonths" INTEGER NOT NULL,
    "residualValue" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "depreciationMethod" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "disposalDate" TIMESTAMP(3),
    "disposalAmount" DECIMAL(18,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FixedAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DepreciationRecord" (
    "id" TEXT NOT NULL,
    "fixedAssetId" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "accumulatedAmount" DECIMAL(18,2) NOT NULL,
    "bookValue" DECIMAL(18,2) NOT NULL,
    "journalEntryId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DepreciationRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FixedAsset_tenantId_idx" ON "FixedAsset"("tenantId");

-- CreateIndex
CREATE INDEX "DepreciationRecord_fixedAssetId_idx" ON "DepreciationRecord"("fixedAssetId");

-- CreateIndex
CREATE UNIQUE INDEX "DepreciationRecord_fixedAssetId_period_key" ON "DepreciationRecord"("fixedAssetId", "period");

-- AddForeignKey
ALTER TABLE "FixedAsset" ADD CONSTRAINT "FixedAsset_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FixedAsset" ADD CONSTRAINT "FixedAsset_assetAccountId_fkey" FOREIGN KEY ("assetAccountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FixedAsset" ADD CONSTRAINT "FixedAsset_depreciationAccountId_fkey" FOREIGN KEY ("depreciationAccountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FixedAsset" ADD CONSTRAINT "FixedAsset_accumulatedDepAccountId_fkey" FOREIGN KEY ("accumulatedDepAccountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DepreciationRecord" ADD CONSTRAINT "DepreciationRecord_fixedAssetId_fkey" FOREIGN KEY ("fixedAssetId") REFERENCES "FixedAsset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DepreciationRecord" ADD CONSTRAINT "DepreciationRecord_journalEntryId_fkey" FOREIGN KEY ("journalEntryId") REFERENCES "JournalEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;
