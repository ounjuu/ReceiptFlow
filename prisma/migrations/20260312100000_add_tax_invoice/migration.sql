-- CreateTable
CREATE TABLE "TaxInvoice" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "invoiceType" TEXT NOT NULL,
    "invoiceNo" TEXT,
    "invoiceDate" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "issuerBizNo" TEXT NOT NULL,
    "issuerName" TEXT NOT NULL,
    "recipientBizNo" TEXT NOT NULL,
    "recipientName" TEXT NOT NULL,
    "supplyAmount" DECIMAL(18,2) NOT NULL,
    "taxAmount" DECIMAL(18,2) NOT NULL,
    "totalAmount" DECIMAL(18,2) NOT NULL,
    "approvalNo" TEXT,
    "vendorId" TEXT,
    "journalEntryId" TEXT,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TaxInvoice_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TaxInvoice_tenantId_idx" ON "TaxInvoice"("tenantId");
CREATE INDEX "TaxInvoice_invoiceDate_idx" ON "TaxInvoice"("invoiceDate");
CREATE INDEX "TaxInvoice_invoiceType_idx" ON "TaxInvoice"("invoiceType");
CREATE UNIQUE INDEX "TaxInvoice_journalEntryId_key" ON "TaxInvoice"("journalEntryId");

-- AddForeignKey
ALTER TABLE "TaxInvoice" ADD CONSTRAINT "TaxInvoice_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TaxInvoice" ADD CONSTRAINT "TaxInvoice_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TaxInvoice" ADD CONSTRAINT "TaxInvoice_journalEntryId_fkey" FOREIGN KEY ("journalEntryId") REFERENCES "JournalEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;
