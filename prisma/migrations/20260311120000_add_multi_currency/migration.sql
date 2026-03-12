-- AlterTable: Tenant에 기본통화 추가
ALTER TABLE "Tenant" ADD COLUMN "defaultCurrency" TEXT NOT NULL DEFAULT 'KRW';

-- AlterTable: Document에 통화 추가
ALTER TABLE "Document" ADD COLUMN "currency" TEXT NOT NULL DEFAULT 'KRW';

-- AlterTable: JournalEntry에 통화/환율 추가
ALTER TABLE "JournalEntry" ADD COLUMN "currency" TEXT NOT NULL DEFAULT 'KRW';
ALTER TABLE "JournalEntry" ADD COLUMN "exchangeRate" DECIMAL(18,6) NOT NULL DEFAULT 1;

-- CreateTable: 환율 테이블
CREATE TABLE "ExchangeRate" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "rate" DECIMAL(18,6) NOT NULL,
    "date" DATE NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExchangeRate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ExchangeRate_tenantId_idx" ON "ExchangeRate"("tenantId");
CREATE UNIQUE INDEX "ExchangeRate_tenantId_currency_date_key" ON "ExchangeRate"("tenantId", "currency", "date");

-- AddForeignKey
ALTER TABLE "ExchangeRate" ADD CONSTRAINT "ExchangeRate_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
