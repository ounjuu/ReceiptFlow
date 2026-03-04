-- 중복 사업자번호 데이터 정리 (같은 tenantId + bizNo인 경우 최초 것만 유지)
DELETE FROM "Vendor" v1
USING "Vendor" v2
WHERE v1."tenantId" = v2."tenantId"
  AND v1."bizNo" = v2."bizNo"
  AND v1."bizNo" IS NOT NULL
  AND v1."createdAt" > v2."createdAt";

-- CreateIndex
CREATE UNIQUE INDEX "Vendor_tenantId_bizNo_key" ON "Vendor"("tenantId", "bizNo");
