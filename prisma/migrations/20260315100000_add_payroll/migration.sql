-- CreateTable
CREATE TABLE "Employee" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "employeeNo" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "department" TEXT,
    "position" TEXT,
    "joinDate" TIMESTAMP(3) NOT NULL,
    "leaveDate" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "baseSalary" DECIMAL(18,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Employee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayrollRecord" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "baseSalary" DECIMAL(18,2) NOT NULL,
    "overtimePay" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "bonusPay" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "grossPay" DECIMAL(18,2) NOT NULL,
    "nationalPension" DECIMAL(18,2) NOT NULL,
    "healthInsurance" DECIMAL(18,2) NOT NULL,
    "longTermCare" DECIMAL(18,2) NOT NULL,
    "employmentInsurance" DECIMAL(18,2) NOT NULL,
    "incomeTax" DECIMAL(18,2) NOT NULL,
    "localIncomeTax" DECIMAL(18,2) NOT NULL,
    "totalDeduction" DECIMAL(18,2) NOT NULL,
    "netPay" DECIMAL(18,2) NOT NULL,
    "journalEntryId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PayrollRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Employee_tenantId_idx" ON "Employee"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "Employee_tenantId_employeeNo_key" ON "Employee"("tenantId", "employeeNo");

-- CreateIndex
CREATE INDEX "PayrollRecord_employeeId_idx" ON "PayrollRecord"("employeeId");

-- CreateIndex
CREATE UNIQUE INDEX "PayrollRecord_employeeId_period_key" ON "PayrollRecord"("employeeId", "period");

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollRecord" ADD CONSTRAINT "PayrollRecord_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollRecord" ADD CONSTRAINT "PayrollRecord_journalEntryId_fkey" FOREIGN KEY ("journalEntryId") REFERENCES "JournalEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;
