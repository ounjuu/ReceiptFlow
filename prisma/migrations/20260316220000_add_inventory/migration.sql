-- AlterTable: Product에 재고 필드 추가
ALTER TABLE "Product" ADD COLUMN "currentStock" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Product" ADD COLUMN "avgCost" DECIMAL(18,2) NOT NULL DEFAULT 0;
ALTER TABLE "Product" ADD COLUMN "safetyStock" INTEGER NOT NULL DEFAULT 0;

-- CreateTable: InventoryTransaction
CREATE TABLE "InventoryTransaction" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "txNo" TEXT NOT NULL,
    "txType" TEXT NOT NULL,
    "txDate" DATE NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitCost" DECIMAL(18,2) NOT NULL,
    "totalCost" DECIMAL(18,2) NOT NULL,
    "reason" TEXT,
    "tradeId" TEXT,
    "journalEntryId" TEXT,
    "beforeStock" INTEGER NOT NULL,
    "afterStock" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InventoryTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "InventoryTransaction_journalEntryId_key" ON "InventoryTransaction"("journalEntryId");
CREATE UNIQUE INDEX "InventoryTransaction_tenantId_txNo_key" ON "InventoryTransaction"("tenantId", "txNo");
CREATE INDEX "InventoryTransaction_tenantId_idx" ON "InventoryTransaction"("tenantId");
CREATE INDEX "InventoryTransaction_productId_idx" ON "InventoryTransaction"("productId");
CREATE INDEX "InventoryTransaction_txDate_idx" ON "InventoryTransaction"("txDate");

-- AddForeignKey
ALTER TABLE "InventoryTransaction" ADD CONSTRAINT "InventoryTransaction_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InventoryTransaction" ADD CONSTRAINT "InventoryTransaction_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InventoryTransaction" ADD CONSTRAINT "InventoryTransaction_journalEntryId_fkey" FOREIGN KEY ("journalEntryId") REFERENCES "JournalEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;
