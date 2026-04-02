-- CreateIndex
CREATE INDEX "JournalEntry_tenantId_status_date_idx" ON "JournalEntry"("tenantId", "status", "date");

-- CreateIndex
CREATE INDEX "PayrollRecord_period_idx" ON "PayrollRecord"("period");
