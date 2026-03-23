"use client";

import styles from "./VendorLedger.module.css";
import { fmt } from "./types";
import type { BalanceSummary, Vendor, VendorLedgerData } from "./types";

/* ── 잔액 요약 카드 ── */

export interface SummaryCardsProps {
  summary: BalanceSummary;
}

export function SummaryCards({ summary }: SummaryCardsProps) {
  return (
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
  );
}

/* ── 거래처별 잔액 테이블 ── */

export interface VendorBalanceTableProps {
  summary: BalanceSummary | undefined;
  onVendorClick: (vendorId: string) => void;
  onExportSummary: () => void;
}

export function VendorBalanceTable({ summary, onVendorClick, onExportSummary }: VendorBalanceTableProps) {
  return (
    <div className={styles.section}>
      <div className={styles.sectionHeader}>
        <h2 className={styles.sectionTitle}>거래처별 잔액</h2>
        <div className={styles.sectionHeaderRight}>
          <span className={styles.unit}>(단위: 원)</span>
          <button
            className={styles.downloadBtn}
            onClick={onExportSummary}
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
              onClick={() => onVendorClick(v.vendorId)}
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
  );
}

/* ── 거래처 원장 상세 (컨트롤 + 테이블 + 서머리 바) ── */

export interface VendorLedgerDetailProps {
  selectedVendorId: string;
  selectedVendor: Vendor | undefined;
  vendors: Vendor[];
  filterStart: string;
  filterEnd: string;
  ledger: VendorLedgerData | undefined;
  onBack: () => void;
  onVendorChange: (vendorId: string) => void;
  onFilterStartChange: (value: string) => void;
  onFilterEndChange: (value: string) => void;
  onFilterClear: () => void;
  onExportLedger: () => void;
}

export function VendorLedgerDetail({
  selectedVendorId,
  selectedVendor,
  vendors,
  filterStart,
  filterEnd,
  ledger,
  onBack,
  onVendorChange,
  onFilterStartChange,
  onFilterEndChange,
  onFilterClear,
  onExportLedger,
}: VendorLedgerDetailProps) {
  return (
    <>
      <div className={styles.ledgerControls}>
        <button className={styles.backBtn} onClick={onBack}>
          목록으로
        </button>
        <select
          className={styles.select}
          value={selectedVendorId}
          onChange={(e) => onVendorChange(e.target.value)}
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
          onChange={(e) => onFilterStartChange(e.target.value)}
        />
        <span className={styles.filterSep}>~</span>
        <input
          className={styles.filterInput}
          type="date"
          value={filterEnd}
          onChange={(e) => onFilterEndChange(e.target.value)}
        />
        {(filterStart || filterEnd) && (
          <button
            className={styles.filterClear}
            onClick={onFilterClear}
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
              onClick={onExportLedger}
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
  );
}
