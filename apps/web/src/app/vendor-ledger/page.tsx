"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiGet } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { exportToXlsx } from "@/lib/export-xlsx";
import styles from "./page.module.css";

interface VendorBalance {
  vendorId: string;
  name: string;
  bizNo: string | null;
  totalDebit: number;
  totalCredit: number;
  balance: number;
}

interface BalanceSummary {
  vendors: VendorBalance[];
  totalReceivable: number;
  totalPayable: number;
  netBalance: number;
}

interface LedgerEntry {
  date: string;
  description: string;
  accountCode: string;
  accountName: string;
  debit: number;
  credit: number;
  balance: number;
}

interface VendorLedger {
  openingBalance: number;
  entries: LedgerEntry[];
  totalDebit: number;
  totalCredit: number;
  closingBalance: number;
}

interface Vendor {
  id: string;
  name: string;
  bizNo: string | null;
}

const fmt = (n: number) => n.toLocaleString();

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
      apiGet<VendorLedger>(
        `/vendors/${selectedVendorId}/ledger?tenantId=${tenantId}${dateParams ? `&${dateParams}` : ""}`
      ),
    enabled: !!tenantId && !!selectedVendorId,
  });

  const selectedVendor = vendors.find((v) => v.id === selectedVendorId);

  const handleVendorClick = (vendorId: string) => {
    setSelectedVendorId(vendorId);
  };

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
      {summary && (
        <div className={styles.summaryCards}>
          <div className={styles.summaryCard}>
            <div className={styles.summaryLabel}>총 미수금 (받을 돈)</div>
            <div className={`${styles.summaryValue} ${styles.positive}`}>
              ₩{fmt(summary.totalReceivable)}
            </div>
          </div>
          <div className={styles.summaryCard}>
            <div className={styles.summaryLabel}>총 미지급금 (줄 돈)</div>
            <div className={`${styles.summaryValue} ${styles.negative}`}>
              ₩{fmt(summary.totalPayable)}
            </div>
          </div>
          <div className={styles.summaryCard}>
            <div className={styles.summaryLabel}>순잔액</div>
            <div className={`${styles.summaryValue} ${summary.netBalance >= 0 ? styles.positive : styles.negative}`}>
              {summary.netBalance >= 0 ? "" : "-"}₩{fmt(Math.abs(summary.netBalance))}
            </div>
          </div>
        </div>
      )}

      {/* 거래처별 잔액 테이블 */}
      {!selectedVendorId && (
        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>거래처별 잔액</h2>
            <div className={styles.sectionHeaderRight}>
              <span className={styles.unit}>(단위: 원)</span>
              <button
                className={styles.downloadBtn}
                onClick={exportSummary}
                disabled={!summary || summary.vendors.length === 0}
              >
                엑셀 다운로드
              </button>
            </div>
          </div>
          <table>
            <thead>
              <tr>
                <th>거래처명</th>
                <th>사업자번호</th>
                <th style={{ textAlign: "right" }}>차변 합계</th>
                <th style={{ textAlign: "right" }}>대변 합계</th>
                <th style={{ textAlign: "right" }}>잔액</th>
                <th>구분</th>
              </tr>
            </thead>
            <tbody>
              {summary?.vendors.map((v) => (
                <tr
                  key={v.vendorId}
                  className={styles.clickableRow}
                  onClick={() => handleVendorClick(v.vendorId)}
                >
                  <td>{v.name}</td>
                  <td>{v.bizNo || "-"}</td>
                  <td style={{ textAlign: "right" }}>₩{fmt(v.totalDebit)}</td>
                  <td style={{ textAlign: "right" }}>₩{fmt(v.totalCredit)}</td>
                  <td style={{ textAlign: "right", fontWeight: 600 }}>
                    <span className={v.balance >= 0 ? styles.positive : styles.negative}>
                      {v.balance >= 0 ? "" : "-"}₩{fmt(Math.abs(v.balance))}
                    </span>
                  </td>
                  <td>
                    <span className={`${styles.badge} ${v.balance > 0 ? styles.badgeReceivable : styles.badgePayable}`}>
                      {v.balance > 0 ? "미수" : "미지급"}
                    </span>
                  </td>
                </tr>
              ))}
              {(!summary || summary.vendors.length === 0) && (
                <tr>
                  <td colSpan={6} style={{ textAlign: "center", color: "var(--text-muted)" }}>
                    잔액이 있는 거래처가 없습니다
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* 거래처 원장 상세 */}
      {selectedVendorId && (
        <>
          <div className={styles.ledgerControls}>
            <button className={styles.backBtn} onClick={() => setSelectedVendorId(null)}>
              목록으로
            </button>
            <select
              className={styles.select}
              value={selectedVendorId}
              onChange={(e) => setSelectedVendorId(e.target.value)}
            >
              {vendors.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name} {v.bizNo ? `(${v.bizNo})` : ""}
                </option>
              ))}
            </select>
            <span className={styles.filterLabel}>기간</span>
            <input
              className={styles.filterInput}
              type="date"
              value={filterStart}
              onChange={(e) => setFilterStart(e.target.value)}
            />
            <span className={styles.filterSep}>~</span>
            <input
              className={styles.filterInput}
              type="date"
              value={filterEnd}
              onChange={(e) => setFilterEnd(e.target.value)}
            />
            {(filterStart || filterEnd) && (
              <button
                className={styles.filterClear}
                onClick={() => { setFilterStart(""); setFilterEnd(""); }}
              >
                초기화
              </button>
            )}
          </div>

          <div className={styles.section}>
            <div className={styles.sectionHeader}>
              <h2 className={styles.sectionTitle}>
                {selectedVendor?.name || ""} 원장
              </h2>
              <div className={styles.sectionHeaderRight}>
                <span className={styles.unit}>(단위: 원)</span>
                <button
                  className={styles.downloadBtn}
                  onClick={exportLedger}
                  disabled={!ledger || ledger.entries.length === 0}
                >
                  엑셀 다운로드
                </button>
              </div>
            </div>

            {!ledger ? (
              <p>불러오는 중...</p>
            ) : (
              <>
                <table>
                  <thead>
                    <tr>
                      <th>일자</th>
                      <th>적요</th>
                      <th>계정</th>
                      <th style={{ textAlign: "right" }}>차변</th>
                      <th style={{ textAlign: "right" }}>대변</th>
                      <th style={{ textAlign: "right" }}>잔액</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className={styles.openingRow}>
                      <td colSpan={5}>기초잔액</td>
                      <td style={{ textAlign: "right" }}>₩{fmt(ledger.openingBalance)}</td>
                    </tr>
                    {ledger.entries.map((e, i) => (
                      <tr key={i}>
                        <td>{new Date(e.date).toLocaleDateString("ko-KR")}</td>
                        <td>{e.description || "-"}</td>
                        <td>{e.accountCode} {e.accountName}</td>
                        <td style={{ textAlign: "right", color: e.debit > 0 ? "var(--success)" : undefined }}>
                          {e.debit > 0 ? `₩${fmt(e.debit)}` : "-"}
                        </td>
                        <td style={{ textAlign: "right", color: e.credit > 0 ? "var(--danger)" : undefined }}>
                          {e.credit > 0 ? `₩${fmt(e.credit)}` : "-"}
                        </td>
                        <td style={{ textAlign: "right", fontWeight: 600 }}>
                          ₩{fmt(e.balance)}
                        </td>
                      </tr>
                    ))}
                    {ledger.entries.length === 0 && (
                      <tr>
                        <td colSpan={6} style={{ textAlign: "center", color: "var(--text-muted)" }}>
                          해당 기간에 거래 내역이 없습니다
                        </td>
                      </tr>
                    )}
                    <tr className={styles.totalRow}>
                      <td colSpan={3}>합계</td>
                      <td style={{ textAlign: "right" }}>₩{fmt(ledger.totalDebit)}</td>
                      <td style={{ textAlign: "right" }}>₩{fmt(ledger.totalCredit)}</td>
                      <td style={{ textAlign: "right" }}>₩{fmt(ledger.closingBalance)}</td>
                    </tr>
                  </tbody>
                </table>

                <div className={styles.summaryBar}>
                  <div className={styles.summaryBarItem}>
                    <span className={styles.summaryBarLabel}>기초잔액</span>
                    <span className={styles.summaryBarValue}>₩{fmt(ledger.openingBalance)}</span>
                  </div>
                  <div className={styles.summaryBarItem}>
                    <span className={styles.summaryBarLabel}>차변 합계</span>
                    <span className={`${styles.summaryBarValue} ${styles.positive}`}>
                      ₩{fmt(ledger.totalDebit)}
                    </span>
                  </div>
                  <div className={styles.summaryBarItem}>
                    <span className={styles.summaryBarLabel}>대변 합계</span>
                    <span className={`${styles.summaryBarValue} ${styles.negative}`}>
                      ₩{fmt(ledger.totalCredit)}
                    </span>
                  </div>
                  <div className={styles.summaryBarItem}>
                    <span className={styles.summaryBarLabel}>기말잔액</span>
                    <span className={styles.summaryBarValue}>₩{fmt(ledger.closingBalance)}</span>
                  </div>
                </div>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}
