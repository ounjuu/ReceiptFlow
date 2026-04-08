"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { apiGet } from "@/lib/api";
import { exportToXlsx } from "@/lib/export-xlsx";
import styles from "./GeneralLedger.module.css";

interface GeneralLedgerEntry {
  date: string;
  journalEntryId: string;
  description: string;
  debit: number;
  credit: number;
  balance: number;
}

interface GeneralLedgerAccount {
  accountId: string;
  code: string;
  name: string;
  type: string;
  normalBalance: string;
  openingBalance: number;
  entries: GeneralLedgerEntry[];
  closingBalance: number;
  totalDebit: number;
  totalCredit: number;
}

interface GeneralLedgerData {
  accounts: GeneralLedgerAccount[];
}

interface AccountOption {
  id: string;
  code: string;
  name: string;
}

const fmt = (n: number | null | undefined) => (n ?? 0).toLocaleString("ko-KR");

const TYPE_LABELS: Record<string, string> = {
  ASSET: "자산",
  LIABILITY: "부채",
  EQUITY: "자본",
  REVENUE: "수익",
  EXPENSE: "비용",
};

export default function GeneralLedger() {
  const { tenantId } = useAuth();
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [accountId, setAccountId] = useState("");

  // 계정과목 목록 조회 (필터용)
  const { data: accountList } = useQuery({
    queryKey: ["accounts", tenantId],
    queryFn: () =>
      apiGet<AccountOption[]>(`/accounts?tenantId=${tenantId}`),
    enabled: !!tenantId,
  });

  // 총계정원장 데이터 조회
  const queryParams = [
    `tenantId=${tenantId}`,
    startDate && `startDate=${startDate}`,
    endDate && `endDate=${endDate}`,
    accountId && `accountId=${accountId}`,
  ].filter(Boolean).join("&");

  const { data, isLoading } = useQuery({
    queryKey: ["general-ledger", queryParams],
    queryFn: () =>
      apiGet<GeneralLedgerData>(`/reports/general-ledger?${queryParams}`),
    enabled: !!tenantId,
  });

  const handleDownload = () => {
    if (!data) return;

    const rows: (string | number | null)[][] = [];
    for (const account of data.accounts) {
      // 계정 헤더
      rows.push([`[${account.code}] ${account.name}`, "", "", "", ""]);
      // 전기이월
      rows.push(["", "전기이월", "", "", account.openingBalance]);
      // 거래 내역
      for (const entry of account.entries) {
        rows.push([
          entry.date,
          entry.description,
          entry.debit || null,
          entry.credit || null,
          entry.balance,
        ]);
      }
      // 합계
      rows.push(["", "합계", account.totalDebit, account.totalCredit, account.closingBalance]);
      // 빈 행 (계정 구분)
      rows.push(["", "", "", "", ""]);
    }

    exportToXlsx("총계정원장", "총계정원장", ["일자", "적요", "차변", "대변", "잔액"], rows);
  };

  return (
    <div>
      <h1 className={styles.title}>총계정원장</h1>
      <p className={styles.subtitle}>계정과목별 거래 내역과 잔액을 확인하세요</p>

      <div className={styles.filterRow}>
        <span className={styles.filterLabel}>기간</span>
        <input
          className={styles.filterInput}
          type="date"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
        />
        <span className={styles.filterSep}>~</span>
        <input
          className={styles.filterInput}
          type="date"
          value={endDate}
          onChange={(e) => setEndDate(e.target.value)}
        />

        <span className={styles.filterLabel}>계정과목</span>
        <select
          className={styles.filterSelect}
          value={accountId}
          onChange={(e) => setAccountId(e.target.value)}
        >
          <option value="">전체</option>
          {accountList?.map((acc) => (
            <option key={acc.id} value={acc.id}>
              [{acc.code}] {acc.name}
            </option>
          ))}
        </select>

        {(startDate || endDate || accountId) && (
          <button
            className={styles.filterClear}
            onClick={() => {
              setStartDate("");
              setEndDate("");
              setAccountId("");
            }}
          >
            초기화
          </button>
        )}
      </div>

      <div className={styles.headerRow}>
        <span className={styles.unit}>(단위: 원)</span>
        <button className={styles.downloadBtn} onClick={handleDownload} disabled={!data}>
          엑셀 다운로드
        </button>
      </div>

      {isLoading && <p className={styles.loading}>불러오는 중...</p>}

      {data && data.accounts.length === 0 && (
        <p className={styles.empty}>조회된 거래 내역이 없습니다</p>
      )}

      {data?.accounts.map((account) => (
        <div key={account.accountId} className={styles.accountSection}>
          <div className={styles.accountHeader}>
            <span className={styles.accountCode}>{account.code}</span>
            <span className={styles.accountName}>{account.name}</span>
            <span className={styles.accountType}>
              {TYPE_LABELS[account.type] || account.type}
            </span>
          </div>

          <table className={styles.accountTable}>
            <thead>
              <tr>
                <th>일자</th>
                <th>적요</th>
                <th className={styles.textRight}>차변</th>
                <th className={styles.textRight}>대변</th>
                <th className={styles.textRight}>잔액</th>
              </tr>
            </thead>
            <tbody>
              {/* 전기이월 */}
              <tr className={styles.carryForwardRow}>
                <td></td>
                <td>전기이월</td>
                <td className={styles.textRight}></td>
                <td className={styles.textRight}></td>
                <td className={styles.textRight}>{fmt(account.openingBalance)}</td>
              </tr>

              {/* 거래 내역 */}
              {account.entries.map((entry, idx) => (
                <tr key={`${entry.journalEntryId}-${idx}`}>
                  <td>{entry.date}</td>
                  <td>{entry.description}</td>
                  <td className={styles.textRight}>
                    {entry.debit ? fmt(entry.debit) : ""}
                  </td>
                  <td className={styles.textRight}>
                    {entry.credit ? fmt(entry.credit) : ""}
                  </td>
                  <td className={styles.textRight}>{fmt(entry.balance)}</td>
                </tr>
              ))}

              {/* 합계 */}
              <tr className={styles.totalRow}>
                <td></td>
                <td>합계</td>
                <td className={styles.textRight}>{fmt(account.totalDebit)}</td>
                <td className={styles.textRight}>{fmt(account.totalCredit)}</td>
                <td className={styles.textRight}>{fmt(account.closingBalance)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}
