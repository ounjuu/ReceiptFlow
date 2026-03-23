"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiGet } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { exportToXlsx } from "@/lib/export-xlsx";
import styles from "./VendorLedger.module.css";
import type { BalanceSummary, Vendor, VendorLedgerData } from "./types";
import { SummaryCards, VendorBalanceTable, VendorLedgerDetail } from "./VendorLedgerTable";

export default function VendorLedgerPage() {
  const { tenantId } = useAuth();
  const [selectedVendorId, setSelectedVendorId] = useState<string | null>(null);
  const [filterStart, setFilterStart] = useState("");
  const [filterEnd, setFilterEnd] = useState("");

  // 거래처 목록
  const { data: vendors = [] } = useQuery({
    queryKey: ["vendors"],
    queryFn: () => apiGet<Vendor[]>(`/vendors?tenantId=${tenantId}`),
    enabled: !!tenantId,
  });

  // 잔액 요약
  const { data: summary } = useQuery({
    queryKey: ["vendorBalanceSummary"],
    queryFn: () => apiGet<BalanceSummary>(`/vendors/balance-summary?tenantId=${tenantId}`),
    enabled: !!tenantId,
  });

  // 개별 거래처 원장
  const dateParams = [
    filterStart && `startDate=${filterStart}`,
    filterEnd && `endDate=${filterEnd}`,
  ].filter(Boolean).join("&");

  const { data: ledger } = useQuery({
    queryKey: ["vendorLedger", selectedVendorId, filterStart, filterEnd],
    queryFn: () =>
      apiGet<VendorLedgerData>(
        `/vendors/${selectedVendorId}/ledger?tenantId=${tenantId}${dateParams ? `&${dateParams}` : ""}`
      ),
    enabled: !!tenantId && !!selectedVendorId,
  });

  const selectedVendor = vendors.find((v) => v.id === selectedVendorId);

  // 잔액 요약 엑셀
  const exportSummary = () => {
    if (!summary) return;
    exportToXlsx(
      "거래처잔액요약",
      "잔액요약",
      ["거래처명", "사업자번호", "차변합계", "대변합계", "잔액", "구분"],
      summary.vendors.map((v) => [
        v.name,
        v.bizNo || "",
        v.totalDebit,
        v.totalCredit,
        v.balance,
        v.balance > 0 ? "미수" : "미지급",
      ])
    );
  };

  // 원장 엑셀
  const exportLedger = () => {
    if (!ledger || !selectedVendor) return;
    const rows: (string | number)[][] = [];
    rows.push(["기초잔액", "", "", "", "", ledger.openingBalance]);
    ledger.entries.forEach((e) =>
      rows.push([
        new Date(e.date).toLocaleDateString("ko-KR"),
        e.description,
        `${e.accountCode} ${e.accountName}`,
        e.debit,
        e.credit,
        e.balance,
      ])
    );
    rows.push(["합계", "", "", ledger.totalDebit, ledger.totalCredit, ledger.closingBalance]);
    exportToXlsx(
      `거래처원장_${selectedVendor.name}`,
      "원장",
      ["일자", "적요", "계정", "차변", "대변", "잔액"],
      rows
    );
  };

  return (
    <div>
      <h1 className={styles.title}>거래처 원장</h1>
      <p className={styles.subtitle}>거래처별 거래 내역과 미수/미지급 잔액을 확인하세요</p>

      {/* 잔액 요약 카드 */}
      {summary && <SummaryCards summary={summary} />}

      {/* 거래처별 잔액 테이블 */}
      {!selectedVendorId && (
        <VendorBalanceTable
          summary={summary}
          onVendorClick={(vendorId) => setSelectedVendorId(vendorId)}
          onExportSummary={exportSummary}
        />
      )}

      {/* 거래처 원장 상세 */}
      {selectedVendorId && (
        <VendorLedgerDetail
          selectedVendorId={selectedVendorId}
          selectedVendor={selectedVendor}
          vendors={vendors}
          filterStart={filterStart}
          filterEnd={filterEnd}
          ledger={ledger}
          onBack={() => setSelectedVendorId(null)}
          onVendorChange={(id) => setSelectedVendorId(id)}
          onFilterStartChange={setFilterStart}
          onFilterEndChange={setFilterEnd}
          onFilterClear={() => { setFilterStart(""); setFilterEnd(""); }}
          onExportLedger={exportLedger}
        />
      )}
    </div>
  );
}
