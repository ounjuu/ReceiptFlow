"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { apiGet } from "@/lib/api";
import { exportToXlsx } from "@/lib/export-xlsx";
import styles from "./CashBook.module.css";

interface CashBookEntry {
  date: string;
  journalEntryId: string;
  description: string;
  counterpartCode: string;
  counterpartName: string;
  vendorName: string | null;
  income: number;
  expense: number;
  balance: number;
}

interface CashBookData {
  account: {
    id: string;
    code: string;
    name: string;
  };
  openingBalance: number;
  entries: CashBookEntry[];
  closingBalance: number;
  totalIncome: number;
  totalExpense: number;
}

const fmt = (n: number) => n.toLocaleString("ko-KR");

export default function CashBook() {
  const { tenantId } = useAuth();
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // 현금출납장 데이터 조회
  const queryParams = [
    `tenantId=${tenantId}`,
    startDate && `startDate=${startDate}`,
    endDate && `endDate=${endDate}`,
  ].filter(Boolean).join("&");

  const { data, isLoading } = useQuery({
    queryKey: ["cash-book", queryParams],
    queryFn: () =>
      apiGet<CashBookData>(`/reports/cash-book?${queryParams}`),
    enabled: !!tenantId,
  });

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
        entry.income || null,
        entry.expense || null,
        entry.balance,
      ]);
    }
    // 합계
    rows.push(["", "합계", "", "", data.totalIncome, data.totalExpense, data.closingBalance]);

    exportToXlsx(
      "현금출납장",
      "현금출납장",
      ["일자", "적요", "상대계정", "거래처", "입금", "출금", "잔액"],
      rows,
    );
  };

  return (
    <div>
      <h1 className={styles.title}>현금출납장</h1>
      <p className={styles.subtitle}>현금 계정의 입출금 내역을 확인하세요</p>

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
          </div>

          <table className={styles.accountTable}>
            <thead>
              <tr>
                <th>일자</th>
                <th>적요</th>
                <th>상대계정</th>
                <th>거래처</th>
                <th className={styles.textRight}>입금</th>
                <th className={styles.textRight}>출금</th>
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
              {data.entries.map((entry, idx) => (
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
                    {entry.income ? fmt(entry.income) : ""}
                  </td>
                  <td className={styles.textRight}>
                    {entry.expense ? fmt(entry.expense) : ""}
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
                <td className={styles.textRight}>{fmt(data.totalIncome)}</td>
                <td className={styles.textRight}>{fmt(data.totalExpense)}</td>
                <td className={styles.textRight}>{fmt(data.closingBalance)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
