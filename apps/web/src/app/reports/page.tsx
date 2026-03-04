"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiGet } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { exportToXlsx } from "@/lib/export-xlsx";
import styles from "./page.module.css";

type Tab = "trial-balance" | "income-statement" | "balance-sheet";

// --- 타입 ---

interface TrialRow {
  code: string;
  name: string;
  type: string;
  debit: number;
  credit: number;
  balance: number;
}

interface TrialBalance {
  rows: TrialRow[];
  totalDebit: number;
  totalCredit: number;
}

interface IncomeRow extends TrialRow {
  amount: number;
}

interface IncomeStatement {
  revenue: IncomeRow[];
  totalRevenue: number;
  expense: IncomeRow[];
  totalExpense: number;
  netIncome: number;
}

interface BalanceRow extends TrialRow {
  amount: number;
}

interface BalanceSheet {
  currentAssets: BalanceRow[];
  totalCurrentAssets: number;
  nonCurrentAssets: BalanceRow[];
  totalNonCurrentAssets: number;
  totalAssets: number;
  currentLiabilities: BalanceRow[];
  totalCurrentLiabilities: number;
  nonCurrentLiabilities: BalanceRow[];
  totalNonCurrentLiabilities: number;
  totalLiabilities: number;
  equity: BalanceRow[];
  totalEquity: number;
  retainedEarnings: number;
  totalLiabilitiesAndEquity: number;
  isBalanced: boolean;
}

const fmt = (n: number) => n.toLocaleString();

const tabs: { key: Tab; label: string }[] = [
  { key: "trial-balance", label: "시산표" },
  { key: "income-statement", label: "손익계산서" },
  { key: "balance-sheet", label: "재무상태표" },
];

// --- 메인 ---

export default function ReportsPage() {
  const { tenantId } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>("balance-sheet");
  const [filterStart, setFilterStart] = useState("");
  const [filterEnd, setFilterEnd] = useState("");

  const dateParams = [
    filterStart && `startDate=${filterStart}`,
    filterEnd && `endDate=${filterEnd}`,
  ].filter(Boolean).join("&");

  return (
    <div>
      <h1 className={styles.title}>재무제표</h1>
      <p className={styles.subtitle}>회사의 재무 상태를 확인하세요</p>

      <div className={styles.filterRow}>
        <span className={styles.filterLabel}>전표일 기준</span>
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

      <div className={styles.tabs}>
        {tabs.map((tab) => (
          <button
            key={tab.key}
            className={`${styles.tab} ${activeTab === tab.key ? styles.tabActive : ""}`}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "trial-balance" && <TrialBalanceView dateParams={dateParams} tenantId={tenantId} />}
      {activeTab === "income-statement" && <IncomeStatementView dateParams={dateParams} tenantId={tenantId} />}
      {activeTab === "balance-sheet" && <BalanceSheetView dateParams={dateParams} tenantId={tenantId} />}
    </div>
  );
}

// --- 시산표 ---

function TrialBalanceView({ dateParams, tenantId }: { dateParams: string; tenantId: string | null }) {
  const { data } = useQuery({
    queryKey: ["reports", "trial-balance", dateParams],
    queryFn: () =>
      apiGet<TrialBalance>(`/reports/trial-balance?tenantId=${tenantId}${dateParams ? `&${dateParams}` : ""}`),
  });

  if (!data) return <p>불러오는 중...</p>;

  return (
    <div className={styles.section}>
      <div className={styles.sectionHeader}>
        <h2 className={styles.sectionTitle}>시산표</h2>
        <div className={styles.sectionHeaderRight}>
          <span className={styles.unit}>(단위: 원)</span>
          <button
            className={styles.downloadBtn}
            onClick={() => {
              const rows = data.rows.map((r) => [r.code, r.name, r.type, r.debit, r.credit, r.balance]);
              rows.push(["합계", "", "", data.totalDebit, data.totalCredit, ""]);
              exportToXlsx("시산표", "시산표", ["코드", "계정명", "유형", "차변", "대변", "잔액"], rows as (string | number | null)[][]);
            }}
          >
            엑셀 다운로드
          </button>
        </div>
      </div>
      <table>
        <thead>
          <tr>
            <th>코드</th>
            <th>계정명</th>
            <th>유형</th>
            <th style={{ textAlign: "right" }}>차변</th>
            <th style={{ textAlign: "right" }}>대변</th>
            <th style={{ textAlign: "right" }}>잔액</th>
          </tr>
        </thead>
        <tbody>
          {data.rows.map((row) => (
            <tr key={row.code}>
              <td>{row.code}</td>
              <td>{row.name}</td>
              <td>{row.type}</td>
              <td style={{ textAlign: "right" }}>{fmt(row.debit)}</td>
              <td style={{ textAlign: "right" }}>{fmt(row.credit)}</td>
              <td style={{ textAlign: "right" }}>{fmt(row.balance)}</td>
            </tr>
          ))}
          <tr className={styles.totalRow}>
            <td colSpan={3}>합계</td>
            <td style={{ textAlign: "right" }}>{fmt(data.totalDebit)}</td>
            <td style={{ textAlign: "right" }}>{fmt(data.totalCredit)}</td>
            <td></td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

// --- 손익계산서 ---

function IncomeStatementView({ dateParams, tenantId }: { dateParams: string; tenantId: string | null }) {
  const { data } = useQuery({
    queryKey: ["reports", "income-statement", dateParams],
    queryFn: () =>
      apiGet<IncomeStatement>(
        `/reports/income-statement?tenantId=${tenantId}${dateParams ? `&${dateParams}` : ""}`,
      ),
  });

  if (!data) return <p>불러오는 중...</p>;

  return (
    <>
      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>손익계산서</h2>
          <div className={styles.sectionHeaderRight}>
            <span className={styles.unit}>(단위: 원)</span>
            <button
              className={styles.downloadBtn}
              onClick={() => {
                const rows: (string | number)[][] = [];
                if (data.revenue.length > 0) {
                  rows.push(["수익", "", ""]);
                  data.revenue.forEach((r) => rows.push([r.code, r.name, r.amount]));
                  rows.push(["수익 합계", "", data.totalRevenue]);
                }
                if (data.expense.length > 0) {
                  rows.push(["비용", "", ""]);
                  data.expense.forEach((r) => rows.push([r.code, r.name, r.amount]));
                  rows.push(["비용 합계", "", data.totalExpense]);
                }
                rows.push(["당기순이익", "", data.netIncome]);
                exportToXlsx("손익계산서", "손익계산서", ["코드", "계정명", "금액"], rows);
              }}
            >
              엑셀 다운로드
            </button>
          </div>
        </div>
        <table>
          <thead>
            <tr>
              <th>코드</th>
              <th>계정명</th>
              <th style={{ textAlign: "right" }}>금액</th>
            </tr>
          </thead>
          <tbody>
            {data.revenue.length > 0 && (
              <>
                <tr className={styles.totalRow}>
                  <td colSpan={3}>수익</td>
                </tr>
                {data.revenue.map((r) => (
                  <tr key={r.code}>
                    <td>{r.code}</td>
                    <td>{r.name}</td>
                    <td style={{ textAlign: "right" }}>{fmt(r.amount)}</td>
                  </tr>
                ))}
                <tr className={styles.subtotalRow}>
                  <td colSpan={2}>수익 합계</td>
                  <td style={{ textAlign: "right" }}>
                    {fmt(data.totalRevenue)}
                  </td>
                </tr>
              </>
            )}
            {data.expense.length > 0 && (
              <>
                <tr className={styles.totalRow}>
                  <td colSpan={3}>비용</td>
                </tr>
                {data.expense.map((r) => (
                  <tr key={r.code}>
                    <td>{r.code}</td>
                    <td>{r.name}</td>
                    <td style={{ textAlign: "right" }}>{fmt(r.amount)}</td>
                  </tr>
                ))}
                <tr className={styles.subtotalRow}>
                  <td colSpan={2}>비용 합계</td>
                  <td style={{ textAlign: "right" }}>
                    {fmt(data.totalExpense)}
                  </td>
                </tr>
              </>
            )}
          </tbody>
        </table>
      </div>
      <div className={styles.summaryBar}>
        <div className={styles.summaryItem}>
          <span className={styles.summaryLabel}>당기순이익</span>
          <span
            className={`${styles.summaryValue} ${data.netIncome >= 0 ? styles.positive : styles.negative}`}
          >
            {fmt(data.netIncome)}
          </span>
        </div>
      </div>
    </>
  );
}

// --- 재무상태표 ---

function BalanceSheetView({ dateParams, tenantId }: { dateParams: string; tenantId: string | null }) {
  const { data } = useQuery({
    queryKey: ["reports", "balance-sheet", dateParams],
    queryFn: () =>
      apiGet<BalanceSheet>(`/reports/balance-sheet?tenantId=${tenantId}${dateParams ? `&${dateParams}` : ""}`),
  });

  if (!data) return <p>불러오는 중...</p>;

  const downloadXlsx = () => {
    const rows: (string | number)[][] = [];
    const push = (category: string, items: BalanceRow[]) => {
      items.forEach((r) => rows.push([category, r.name, r.amount]));
    };
    push("유동자산", data.currentAssets);
    rows.push(["유동자산 합계", "", data.totalCurrentAssets]);
    push("비유동자산", data.nonCurrentAssets);
    rows.push(["비유동자산 합계", "", data.totalNonCurrentAssets]);
    rows.push(["자산 총계", "", data.totalAssets]);
    push("유동부채", data.currentLiabilities);
    rows.push(["유동부채 합계", "", data.totalCurrentLiabilities]);
    push("비유동부채", data.nonCurrentLiabilities);
    rows.push(["비유동부채 합계", "", data.totalNonCurrentLiabilities]);
    push("자본", data.equity);
    if (data.retainedEarnings !== 0)
      rows.push(["자본", "이익잉여금(당기)", data.retainedEarnings]);
    rows.push(["부채 및 자본 총계", "", data.totalLiabilitiesAndEquity]);
    exportToXlsx("재무상태표", "재무상태표", ["구분", "계정명", "금액"], rows);
  };

  const renderGroup = (
    label: string,
    rows: BalanceRow[],
    total: number,
  ) => (
    <>
      <tr className={styles.groupHeader}>
        <td colSpan={2}>{label}</td>
      </tr>
      {rows.map((r) => (
        <tr key={r.code}>
          <td style={{ paddingLeft: 28 }}>{r.name}</td>
          <td style={{ textAlign: "right" }}>{fmt(r.amount)}</td>
        </tr>
      ))}
      <tr className={styles.subtotalRow}>
        <td>{label} 합계</td>
        <td style={{ textAlign: "right" }}>{fmt(total)}</td>
      </tr>
    </>
  );

  return (
    <>
      <div className={styles.sectionHeader}>
        <h2 className={styles.sectionTitle}>재무상태표</h2>
        <div className={styles.sectionHeaderRight}>
          <span className={styles.unit}>(단위: 원)</span>
          <button className={styles.downloadBtn} onClick={downloadXlsx}>
            엑셀 다운로드
          </button>
        </div>
      </div>

      <div className={styles.bsGrid}>
        {/* 자산 */}
        <div className={styles.section}>
          <h3 className={styles.sectionTitle}>자산</h3>
          <table>
            <tbody>
              {renderGroup("유동자산", data.currentAssets, data.totalCurrentAssets)}
              {renderGroup("비유동자산", data.nonCurrentAssets, data.totalNonCurrentAssets)}
              <tr className={styles.grandTotalRow}>
                <td>자산 총계</td>
                <td style={{ textAlign: "right" }}>{fmt(data.totalAssets)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* 부채 및 자본 */}
        <div className={styles.section}>
          <h3 className={styles.sectionTitle}>부채 및 자본</h3>
          <table>
            <tbody>
              {renderGroup("유동부채", data.currentLiabilities, data.totalCurrentLiabilities)}
              {data.nonCurrentLiabilities.length > 0 &&
                renderGroup("비유동부채", data.nonCurrentLiabilities, data.totalNonCurrentLiabilities)}
              {renderGroup("자본", data.equity, data.totalEquity)}
              {data.retainedEarnings !== 0 && (
                <tr>
                  <td style={{ paddingLeft: 28 }}>이익잉여금 (당기)</td>
                  <td style={{ textAlign: "right" }}>
                    {fmt(data.retainedEarnings)}
                  </td>
                </tr>
              )}
              <tr className={styles.grandTotalRow}>
                <td>부채 및 자본 총계</td>
                <td style={{ textAlign: "right" }}>
                  {fmt(data.totalLiabilitiesAndEquity)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div className={styles.summaryBar}>
        <div className={styles.summaryItem}>
          <span className={styles.summaryLabel}>자산 총계</span>
          <span className={styles.summaryValue}>{fmt(data.totalAssets)}</span>
        </div>
        <div className={styles.summaryItem}>
          <span className={styles.summaryLabel}>부채+자본 총계</span>
          <span className={styles.summaryValue}>
            {fmt(data.totalLiabilitiesAndEquity)}
          </span>
        </div>
        <div className={styles.summaryItem}>
          <span className={styles.summaryLabel}>대차균형</span>
          <span
            className={`${styles.summaryValue} ${data.isBalanced ? styles.positive : styles.negative}`}
          >
            {data.isBalanced ? "균형" : "불균형"}
          </span>
        </div>
      </div>
    </>
  );
}
