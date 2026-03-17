-- CreateTable
CREATE TABLE "ExpenseClaim" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "claimNo" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "claimDate" DATE NOT NULL,
    "totalAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "memo" TEXT,
    "settledAt" TIMESTAMP(3),
    "journalEntryId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExpenseClaim_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExpenseClaimItem" (
    "id" TEXT NOT NULL,
    "expenseClaimId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "expenseDate" DATE NOT NULL,
    "receiptUrl" TEXT,

    CONSTRAINT "ExpenseClaimItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ExpenseClaim_journalEntryId_key" ON "ExpenseClaim"("journalEntryId");

-- CreateIndex
CREATE UNIQUE INDEX "ExpenseClaim_tenantId_claimNo_key" ON "ExpenseClaim"("tenantId", "claimNo");

-- CreateIndex
CREATE INDEX "ExpenseClaim_tenantId_idx" ON "ExpenseClaim"("tenantId");

-- CreateIndex
CREATE INDEX "ExpenseClaimItem_expenseClaimId_idx" ON "ExpenseClaimItem"("expenseClaimId");

-- AddForeignKey
ALTER TABLE "ExpenseClaim" ADD CONSTRAINT "ExpenseClaim_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExpenseClaim" ADD CONSTRAINT "ExpenseClaim_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExpenseClaim" ADD CONSTRAINT "ExpenseClaim_journalEntryId_fkey" FOREIGN KEY ("journalEntryId") REFERENCES "JournalEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExpenseClaimItem" ADD CONSTRAINT "ExpenseClaimItem_expenseClaimId_fkey" FOREIGN KEY ("expenseClaimId") REFERENCES "ExpenseClaim"("id") ON DELETE CASCADE ON UPDATE CASCADE;
