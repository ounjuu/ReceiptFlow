"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { apiGet } from "@/lib/api";
import { exportToXlsx } from "@/lib/export-xlsx";
import { usePagination } from "@/lib/usePagination";
import { Pagination } from "@/lib/Pagination";
import styles from "./JournalBook.module.css";

interface JournalLine {
  accountCode: string;
  accountName: string;
  vendorName: string | null;
  debit: number;
  credit: number;
}

interface JournalBookEntry {
  id: string;
  date: string;
  description: string;
  lines: JournalLine[];
  totalDebit: number;
  totalCredit: number;
}

interface JournalBookData {
  entries: JournalBookEntry[];
  grandTotalDebit: number;
  grandTotalCredit: number;
  entryCount: number;
}

const fmt = (n: number | null | undefined) => (n ?? 0).toLocaleString("ko-KR");

export default function JournalBook() {
  const { tenantId } = useAuth();
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const queryParams = [
    `tenantId=${tenantId}`,
    startDate && `startDate=${startDate}`,
    endDate && `endDate=${endDate}`,
  ]
    .filter(Boolean)
    .join("&");

  const { data, isLoading } = useQuery({
    queryKey: ["journal-book", queryParams],
    queryFn: () =>
      apiGet<JournalBookData>(`/reports/journal-book?${queryParams}`),
    enabled: !!tenantId,
  });

  const allEntries = data?.entries ?? [];
  const { pageData: pagedEntries, page, totalPages, total, setPage } = usePagination(allEntries, 50);

  const handleDownload = () => {
    if (!data) return;

    const rows: (string | number | null)[][] = [];
    for (const entry of data.entries) {
      entry.lines.forEach((line, idx) => {
        rows.push([
          idx === 0 ? entry.date : "",
          idx === 0 ? (entry.description || "") : "",
          `${line.accountCode} ${line.accountName}`,
          line.vendorName ?? "",
          line.debit || null,
          line.credit || null,
        ]);
      });
      // 전표 구분용 빈 행
      rows.push(["", "", "", "", null, null]);
    }
    // 합계
    rows.push(["", "합계", "", "", data.grandTotalDebit, data.grandTotalCredit]);

    exportToXlsx(
      "분개장",
      "분개장",
      ["일자", "적요", "계정과목", "거래처", "차변", "대변"],
      rows,
    );
  };

  return (
    <div>
      <h1 className={styles.title}>분개장</h1>
      <p className={styles.subtitle}>모든 전표를 일자순으로 조회합니다</p>

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
        {data && (
          <div className={styles.summaryInfo}>
            <span>총 <strong>{data.entryCount}</strong>건</span>
            <span className={styles.summaryDivider}>|</span>
            <span>차변합계 <strong>{fmt(data.grandTotalDebit)}</strong></span>
            <span className={styles.summaryDivider}>|</span>
            <span>대변합계 <strong>{fmt(data.grandTotalCredit)}</strong></span>
          </div>
        )}
        <div className={styles.headerActions}>
          <span className={styles.unit}>(단위: 원)</span>
          <button
            className={styles.downloadBtn}
            onClick={handleDownload}
            disabled={!data}
          >
            엑셀 다운로드
          </button>
        </div>
      </div>

      {isLoading && <p className={styles.loading}>불러오는 중...</p>}

      {data && data.entries.length === 0 && (
        <p className={styles.empty}>조회된 전표가 없습니다</p>
      )}

      {data && data.entries.length > 0 && (
        <div className={styles.tableWrapper}>
          <table className={styles.journalTable}>
            <thead>
              <tr>
                <th className={styles.colDate}>일자</th>
                <th className={styles.colDesc}>적요</th>
                <th className={styles.colAccount}>계정과목</th>
                <th className={styles.colVendor}>거래처</th>
                <th className={`${styles.colAmount} ${styles.textRight}`}>
                  차변
                </th>
                <th className={`${styles.colAmount} ${styles.textRight}`}>
                  대변
                </th>
              </tr>
            </thead>
            <tbody>
              {pagedEntries.map((entry, entryIdx) => (
                entry.lines.map((line, lineIdx) => (
                  <tr
                    key={`${entry.id}-${lineIdx}`}
                    className={
                      lineIdx === entry.lines.length - 1 && entryIdx < pagedEntries.length - 1
                        ? styles.entryLastLine
                        : ""
                    }
                  >
                    <td className={styles.colDate}>
                      {lineIdx === 0 ? entry.date : ""}
                    </td>
                    <td className={styles.colDesc}>
                      {lineIdx === 0 ? entry.description : ""}
                    </td>
                    <td className={styles.colAccount}>
                      <span className={styles.accountCode}>
                        {line.accountCode}
                      </span>{" "}
                      {line.accountName}
                    </td>
                    <td className={styles.colVendor}>
                      {line.vendorName ?? ""}
                    </td>
                    <td className={`${styles.colAmount} ${styles.textRight}`}>
                      {line.debit ? fmt(line.debit) : ""}
                    </td>
                    <td className={`${styles.colAmount} ${styles.textRight}`}>
                      {line.credit ? fmt(line.credit) : ""}
                    </td>
                  </tr>
                ))
              ))}
              {/* 합계 행 */}
              <tr className={styles.totalRow}>
                <td></td>
                <td>합계</td>
                <td></td>
                <td></td>
                <td className={styles.textRight}>
                  {fmt(data.grandTotalDebit)}
                </td>
                <td className={styles.textRight}>
                  {fmt(data.grandTotalCredit)}
                </td>
              </tr>
            </tbody>
          </table>
          <Pagination page={page} totalPages={totalPages} total={total} onPageChange={setPage} />
        </div>
      )}
    </div>
  );
}
