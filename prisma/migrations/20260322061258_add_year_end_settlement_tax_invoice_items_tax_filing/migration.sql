-- AlterTable
ALTER TABLE "TaxInvoice" ADD COLUMN     "hometaxImportedAt" TIMESTAMP(3),
ADD COLUMN     "hometaxSyncStatus" TEXT,
ADD COLUMN     "xmlRaw" TEXT;

-- CreateTable
CREATE TABLE "JournalRule" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "vendorName" TEXT,
    "keywords" TEXT,
    "amountMin" DECIMAL(18,2),
    "amountMax" DECIMAL(18,2),
    "debitAccountId" TEXT NOT NULL,
    "creditAccountId" TEXT NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JournalRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaxInvoiceItem" (
    "id" TEXT NOT NULL,
    "taxInvoiceId" TEXT NOT NULL,
    "sequenceNo" INTEGER NOT NULL,
    "itemDate" TIMESTAMP(3),
    "itemName" TEXT,
    "specification" TEXT,
    "quantity" DECIMAL(18,4),
    "unitPrice" DECIMAL(18,2),
    "supplyAmount" DECIMAL(18,2) NOT NULL,
    "taxAmount" DECIMAL(18,2) NOT NULL,
    "remark" TEXT,

    CONSTRAINT "TaxInvoiceItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "YearEndSettlement" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "annualGrossPay" DECIMAL(18,2) NOT NULL,
    "dependents" INTEGER NOT NULL DEFAULT 1,
    "dependentsUnder20" INTEGER NOT NULL DEFAULT 0,
    "dependentsOver70" INTEGER NOT NULL DEFAULT 0,
    "insurancePremium" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "medicalExpense" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "medicalExpenseSevere" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "educationExpense" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "educationExpenseChild" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "donationPolitical" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "donationLegal" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "donationDesignated" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "creditCardUsage" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "debitCardUsage" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "cashReceiptUsage" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "traditionalMarket" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "publicTransport" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "housingLoanInterest" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "housingRent" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "pensionSaving" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "earnedIncomeDeduction" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "earnedIncome" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "personalDeduction" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "specialDeduction" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "otherDeduction" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "taxableIncome" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "calculatedTax" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "taxCredit" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "determinedTax" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "alreadyPaidTax" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "finalTax" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "YearEndSettlement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaxFiling" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "filingType" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "period" TEXT NOT NULL,
    "filingData" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "generatedAt" TIMESTAMP(3),
    "exportedAt" TIMESTAMP(3),
    "filedAt" TIMESTAMP(3),
    "filingReference" TEXT,
    "taxableAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "taxAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TaxFiling_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "JournalRule_tenantId_idx" ON "JournalRule"("tenantId");

-- CreateIndex
CREATE INDEX "TaxInvoiceItem_taxInvoiceId_idx" ON "TaxInvoiceItem"("taxInvoiceId");

-- CreateIndex
CREATE INDEX "YearEndSettlement_employeeId_idx" ON "YearEndSettlement"("employeeId");

-- CreateIndex
CREATE UNIQUE INDEX "YearEndSettlement_employeeId_year_key" ON "YearEndSettlement"("employeeId", "year");

-- CreateIndex
CREATE INDEX "TaxFiling_tenantId_idx" ON "TaxFiling"("tenantId");

-- CreateIndex
CREATE INDEX "TaxFiling_filingType_idx" ON "TaxFiling"("filingType");

-- CreateIndex
CREATE UNIQUE INDEX "TaxFiling_tenantId_filingType_year_period_key" ON "TaxFiling"("tenantId", "filingType", "year", "period");

-- AddForeignKey
ALTER TABLE "JournalRule" ADD CONSTRAINT "JournalRule_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalRule" ADD CONSTRAINT "JournalRule_debitAccountId_fkey" FOREIGN KEY ("debitAccountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalRule" ADD CONSTRAINT "JournalRule_creditAccountId_fkey" FOREIGN KEY ("creditAccountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaxInvoiceItem" ADD CONSTRAINT "TaxInvoiceItem_taxInvoiceId_fkey" FOREIGN KEY ("taxInvoiceId") REFERENCES "TaxInvoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "YearEndSettlement" ADD CONSTRAINT "YearEndSettlement_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaxFiling" ADD CONSTRAINT "TaxFiling_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
