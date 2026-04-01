"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { apiGet } from "@/lib/api";
import { exportToXlsx } from "@/lib/export-xlsx";
import styles from "./SummaryTable.module.css";

// 일계표 응답 타입
interface DailySummaryRow {
  code: string;
  name: string;
  type: string;
  debit: number;
  credit: number;
}

interface DailySummaryData {
  date: string;
  rows: DailySummaryRow[];
  totalDebit: number;
  totalCredit: number;
}

// 월계표 응답 타입
interface MonthlySummaryRow {
  code: string;
  name: string;
  type: string;
  monthDebit: number;
  monthCredit: number;
  cumulativeDebit: number;
  cumulativeCredit: number;
}

interface MonthlySummaryData {
  year: number;
  month: number;
  rows: MonthlySummaryRow[];
  totalMonthDebit: number;
  totalMonthCredit: number;
  totalCumulativeDebit: number;
  totalCumulativeCredit: number;
}

const fmt = (n: number) => n.toLocaleString("ko-KR");

const TYPE_LABELS: Record<string, string> = {
  ASSET: "자산",
  LIABILITY: "부채",
  EQUITY: "자본",
  REVENUE: "수익",
  EXPENSE: "비용",
};

type TabType = "daily" | "monthly";

export default function SummaryTable() {
  const { tenantId } = useAuth();
  const [tab, setTab] = useState<TabType>("daily");

  // 일계표 상태
  const today = new Date().toISOString().slice(0, 10);
  const [dailyDate, setDailyDate] = useState(today);

  // 월계표 상태
  const now = new Date();
  const [monthlyYear, setMonthlyYear] = useState(now.getFullYear());
  const [monthlyMonth, setMonthlyMonth] = useState(now.getMonth() + 1);

  // 일계표 조회
  const dailyParams = `tenantId=${tenantId}&date=${dailyDate}`;
  const { data: dailyData, isLoading: dailyLoading } = useQuery({
    queryKey: ["daily-summary", dailyParams],
    queryFn: () => apiGet<DailySummaryData>(`/reports/daily-summary?${dailyParams}`),
    enabled: !!tenantId && tab === "daily" && !!dailyDate,
  });

  // 월계표 조회
  const monthlyParams = `tenantId=${tenantId}&year=${monthlyYear}&month=${monthlyMonth}`;
  const { data: monthlyData, isLoading: monthlyLoading } = useQuery({
    queryKey: ["monthly-summary", monthlyParams],
    queryFn: () => apiGet<MonthlySummaryData>(`/reports/monthly-summary?${monthlyParams}`),
    enabled: !!tenantId && tab === "monthly",
  });

  // 일계표 엑셀 다운로드
  const handleDailyDownload = () => {
    if (!dailyData) return;
    const rows = dailyData.rows.map((r) => [
      r.code,
      r.name,
      TYPE_LABELS[r.type] || r.type,
      r.debit || null,
      r.credit || null,
    ]);
    rows.push(["", "합계", "", dailyData.totalDebit, dailyData.totalCredit]);
    exportToXlsx(
      `일계표_${dailyDate}`,
      "일계표",
      ["계정코드", "계정명", "구분", "차변", "대변"],
      rows,
    );
  };

  // 월계표 엑셀 다운로드
  const handleMonthlyDownload = () => {
    if (!monthlyData) return;
    const rows = monthlyData.rows.map((r) => [
      r.code,
      r.name,
      TYPE_LABELS[r.type] || r.type,
      r.monthDebit || null,
      r.monthCredit || null,
      r.cumulativeDebit || null,
      r.cumulativeCredit || null,
    ]);
    rows.push([
      "",
      "합계",
      "",
      monthlyData.totalMonthDebit,
      monthlyData.totalMonthCredit,
      monthlyData.totalCumulativeDebit,
      monthlyData.totalCumulativeCredit,
    ]);
    exportToXlsx(
      `월계표_${monthlyYear}-${String(monthlyMonth).padStart(2, "0")}`,
      "월계표",
      ["계정코드", "계정명", "구분", "당월 차변", "당월 대변", "누적 차변", "누적 대변"],
      rows,
    );
  };

  // 연도 옵션 (현재 연도 기준 +-2)
  const yearOptions = Array.from({ length: 5 }, (_, i) => now.getFullYear() - 2 + i);

  return (
    <div>
      <h1 className={styles.title}>일/월계표</h1>
      <p className={styles.subtitle}>일별 또는 월별 계정과목별 차변/대변 합계를 조회합니다</p>

      {/* 탭 */}
      <div className={styles.tabs}>
        <button
          className={`${styles.tab} ${tab === "daily" ? styles.tabActive : ""}`}
          onClick={() => setTab("daily")}
        >
          일계표
        </button>
        <button
          className={`${styles.tab} ${tab === "monthly" ? styles.tabActive : ""}`}
          onClick={() => setTab("monthly")}
        >
          월계표
        </button>
      </div>

      {/* 일계표 탭 */}
      {tab === "daily" && (
        <>
          <div className={styles.filterRow}>
            <span className={styles.filterLabel}>일자</span>
            <input
              className={styles.filterInput}
              type="date"
              value={dailyDate}
              onChange={(e) => setDailyDate(e.target.value)}
            />
          </div>

          <div className={styles.headerRow}>
            <span className={styles.unit}>(단위: 원)</span>
            <button
              className={styles.downloadBtn}
              onClick={handleDailyDownload}
              disabled={!dailyData}
            >
              엑셀 다운로드
            </button>
          </div>

          {dailyLoading && <p className={styles.loading}>불러오는 중...</p>}

          {dailyData && dailyData.rows.length === 0 && (
            <p className={styles.empty}>해당 일자에 조회된 거래가 없습니다</p>
          )}

          {dailyData && dailyData.rows.length > 0 && (
            <div className={styles.tableWrapper}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>계정코드</th>
                    <th>계정명</th>
                    <th className={styles.textRight}>차변</th>
                    <th className={styles.textRight}>대변</th>
                  </tr>
                </thead>
                <tbody>
                  {dailyData.rows.map((row) => (
                    <tr key={row.code}>
                      <td>{row.code}</td>
                      <td>
                        {row.name}
                        <span className={styles.typeTag}>
                          {TYPE_LABELS[row.type] || row.type}
                        </span>
                      </td>
                      <td className={styles.textRight}>
                        {row.debit ? fmt(row.debit) : ""}
                      </td>
                      <td className={styles.textRight}>
                        {row.credit ? fmt(row.credit) : ""}
                      </td>
                    </tr>
                  ))}
                  <tr className={styles.totalRow}>
                    <td></td>
                    <td>합계</td>
                    <td className={styles.textRight}>{fmt(dailyData.totalDebit)}</td>
                    <td className={styles.textRight}>{fmt(dailyData.totalCredit)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* 월계표 탭 */}
      {tab === "monthly" && (
        <>
          <div className={styles.filterRow}>
            <span className={styles.filterLabel}>연도</span>
            <select
              className={styles.filterSelect}
              value={monthlyYear}
              onChange={(e) => setMonthlyYear(Number(e.target.value))}
            >
              {yearOptions.map((y) => (
                <option key={y} value={y}>
                  {y}년
                </option>
              ))}
            </select>

            <span className={styles.filterLabel}>월</span>
            <select
              className={styles.filterSelect}
              value={monthlyMonth}
              onChange={(e) => setMonthlyMonth(Number(e.target.value))}
            >
              {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                <option key={m} value={m}>
                  {m}월
                </option>
              ))}
            </select>
          </div>

          <div className={styles.headerRow}>
            <span className={styles.unit}>(단위: 원)</span>
            <button
              className={styles.downloadBtn}
              onClick={handleMonthlyDownload}
              disabled={!monthlyData}
            >
              엑셀 다운로드
            </button>
          </div>

          {monthlyLoading && <p className={styles.loading}>불러오는 중...</p>}

          {monthlyData && monthlyData.rows.length === 0 && (
            <p className={styles.empty}>해당 월에 조회된 거래가 없습니다</p>
          )}

          {monthlyData && monthlyData.rows.length > 0 && (
            <div className={styles.tableWrapper}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>계정코드</th>
                    <th>계정명</th>
                    <th className={styles.textRight}>당월 차변</th>
                    <th className={styles.textRight}>당월 대변</th>
                    <th className={styles.textRight}>누적 차변</th>
                    <th className={styles.textRight}>누적 대변</th>
                  </tr>
                </thead>
                <tbody>
                  {monthlyData.rows.map((row) => (
                    <tr key={row.code}>
                      <td>{row.code}</td>
                      <td>
                        {row.name}
                        <span className={styles.typeTag}>
                          {TYPE_LABELS[row.type] || row.type}
                        </span>
                      </td>
                      <td className={styles.textRight}>
                        {row.monthDebit ? fmt(row.monthDebit) : ""}
                      </td>
                      <td className={styles.textRight}>
                        {row.monthCredit ? fmt(row.monthCredit) : ""}
                      </td>
                      <td className={styles.textRight}>
                        {row.cumulativeDebit ? fmt(row.cumulativeDebit) : ""}
                      </td>
                      <td className={styles.textRight}>
                        {row.cumulativeCredit ? fmt(row.cumulativeCredit) : ""}
                      </td>
                    </tr>
                  ))}
                  <tr className={styles.totalRow}>
                    <td></td>
                    <td>합계</td>
                    <td className={styles.textRight}>{fmt(monthlyData.totalMonthDebit)}</td>
                    <td className={styles.textRight}>{fmt(monthlyData.totalMonthCredit)}</td>
                    <td className={styles.textRight}>{fmt(monthlyData.totalCumulativeDebit)}</td>
                    <td className={styles.textRight}>{fmt(monthlyData.totalCumulativeCredit)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
