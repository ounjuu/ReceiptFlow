-- CreateTable
CREATE TABLE "JournalTemplate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "tenantId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JournalTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JournalTemplateLine" (
    "id" TEXT NOT NULL,
    "debit" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "credit" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "journalTemplateId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "vendorId" TEXT,

    CONSTRAINT "JournalTemplateLine_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "JournalTemplate_tenantId_idx" ON "JournalTemplate"("tenantId");

-- CreateIndex
CREATE INDEX "JournalTemplateLine_journalTemplateId_idx" ON "JournalTemplateLine"("journalTemplateId");

-- AddForeignKey
ALTER TABLE "JournalTemplate" ADD CONSTRAINT "JournalTemplate_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalTemplateLine" ADD CONSTRAINT "JournalTemplateLine_journalTemplateId_fkey" FOREIGN KEY ("journalTemplateId") REFERENCES "JournalTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalTemplateLine" ADD CONSTRAINT "JournalTemplateLine_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalTemplateLine" ADD CONSTRAINT "JournalTemplateLine_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE SET NULL ON UPDATE CASCADE;
