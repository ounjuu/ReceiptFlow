"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { apiGet } from "@/lib/api";
import { exportToXlsx } from "@/lib/export-xlsx";
import { usePagination } from "@/lib/usePagination";
import { Pagination } from "@/lib/Pagination";
import styles from "./AccountLedger.module.css";

interface AccountLedgerEntry {
  date: string;
  journalEntryId: string;
  description: string;
  counterpartCode: string;
  counterpartName: string;
  vendorName: string | null;
  debit: number;
  credit: number;
  balance: number;
}

interface AccountLedgerData {
  account: {
    id: string;
    code: string;
    name: string;
    type: string;
    normalBalance: string;
  };
  openingBalance: number;
  entries: AccountLedgerEntry[];
  closingBalance: number;
  totalDebit: number;
  totalCredit: number;
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

export default function AccountLedger() {
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

  // 계정별원장 데이터 조회
  const queryParams = [
    `tenantId=${tenantId}`,
    `accountId=${accountId}`,
    startDate && `startDate=${startDate}`,
    endDate && `endDate=${endDate}`,
  ].filter(Boolean).join("&");

  const { data, isLoading } = useQuery({
    queryKey: ["account-ledger", queryParams],
    queryFn: () =>
      apiGet<AccountLedgerData>(`/reports/account-ledger?${queryParams}`),
    enabled: !!tenantId && !!accountId,
  });

  const allEntries = data?.entries ?? [];
  const { pageData: pagedEntries, page, totalPages, total, setPage } = usePagination(allEntries, 50);

  const handleDownload = () => {
    if (!data) return;

    const rows: (string | number | null)[][] = [];
    // 계정 헤더
    rows.push([`[${data.account.code}] ${data.account.name}`, "", "", "", "", "", ""]);
    // 전기이월
    rows.push(["", "전기이월", "", "", "", "", data.openingBalance]);
    // 거래 내역
    for (const entry of data.entries) {
      rows.push([
        entry.date,
        entry.description,
        entry.counterpartName === "제"
          ? `${entry.counterpartCode} (제)`
          : `${entry.counterpartCode} ${entry.counterpartName}`,
        entry.vendorName || "",
        entry.debit || null,
        entry.credit || null,
        entry.balance,
      ]);
    }
    // 합계
    rows.push(["", "합계", "", "", data.totalDebit, data.totalCredit, data.closingBalance]);

    exportToXlsx(
      "계정별원장",
      "계정별원장",
      ["일자", "적요", "상대계정", "거래처", "차변", "대변", "잔액"],
      rows,
    );
  };

  return (
    <div>
      <h1 className={styles.title}>계정별원장</h1>
      <p className={styles.subtitle}>계정과목의 상세 거래 내역과 상대계정 정보를 확인하세요</p>

      <div className={styles.filterRow}>
        <span className={styles.filterLabel}>계정과목</span>
        <select
          className={styles.filterSelect}
          value={accountId}
          onChange={(e) => setAccountId(e.target.value)}
        >
          <option value="">계정을 선택하세요</option>
          {accountList?.map((acc) => (
            <option key={acc.id} value={acc.id}>
              [{acc.code}] {acc.name}
            </option>
          ))}
        </select>

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

        {(startDate || endDate) && (
          <button
            className={styles.filterClear}
            onClick={() => {
              setStartDate("");
              setEndDate("");
            }}
          >
            초기화
          </button>
        )}
      </div>

      {!accountId && (
        <p className={styles.placeholder}>조회할 계정과목을 선택하세요</p>
      )}

      {accountId && (
        <>
          <div className={styles.headerRow}>
            <span className={styles.unit}>(단위: 원)</span>
            <button className={styles.downloadBtn} onClick={handleDownload} disabled={!data}>
              엑셀 다운로드
            </button>
          </div>

          {isLoading && <p className={styles.loading}>불러오는 중...</p>}

          {data && data.entries.length === 0 && data.openingBalance === 0 && (
            <p className={styles.empty}>조회된 거래 내역이 없습니다</p>
          )}

          {data && (data.entries.length > 0 || data.openingBalance !== 0) && (
            <div className={styles.accountSection}>
              <div className={styles.accountHeader}>
                <span className={styles.accountCode}>{data.account.code}</span>
                <span className={styles.accountName}>{data.account.name}</span>
                <span className={styles.accountType}>
                  {TYPE_LABELS[data.account.type] || data.account.type}
                </span>
              </div>

              <table className={styles.accountTable}>
                <thead>
                  <tr>
                    <th>일자</th>
                    <th>적요</th>
                    <th>상대계정</th>
                    <th>거래처</th>
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
                    <td></td>
                    <td></td>
                    <td className={styles.textRight}></td>
                    <td className={styles.textRight}></td>
                    <td className={styles.textRight}>{fmt(data.openingBalance)}</td>
                  </tr>

                  {/* 거래 내역 */}
                  {pagedEntries.map((entry, idx) => (
                    <tr key={`${entry.journalEntryId}-${idx}`}>
                      <td>{entry.date}</td>
                      <td>{entry.description}</td>
                      <td>
                        {entry.counterpartName === "제" ? (
                          <span className={styles.counterpartMulti}>
                            {entry.counterpartCode} (제)
                          </span>
                        ) : (
                          <span className={styles.counterpart}>
                            {entry.counterpartCode && `${entry.counterpartCode} ${entry.counterpartName}`}
                          </span>
                        )}
                      </td>
                      <td>{entry.vendorName || ""}</td>
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
                    <td></td>
                    <td></td>
                    <td className={styles.textRight}>{fmt(data.totalDebit)}</td>
                    <td className={styles.textRight}>{fmt(data.totalCredit)}</td>
                    <td className={styles.textRight}>{fmt(data.closingBalance)}</td>
                  </tr>
                </tbody>
              </table>
              <Pagination page={page} totalPages={totalPages} total={total} onPageChange={setPage} />
            </div>
          )}
        </>
      )}
    </div>
  );
}
