"use client";

import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { useLocale } from "@/lib/locale";
import { apiGet } from "@/lib/api";
import styles from "./ComparativeReports.module.css";
import { fmt } from "@/lib/formatters";

type Tab = "income" | "balance";

// --- 비교 손익계산서 타입 ---
interface ComparativeIncomeRow {
  type: string;
  code: string;
  name: string;
  currentAmount: number;
  previousAmount: number;
  difference: number;
  changeRate: number | null;
}

interface ComparativeIncomeData {
  rows: ComparativeIncomeRow[];
  currentTotal: { revenue: number; expense: number; netIncome: number };
  previousTotal: { revenue: number; expense: number; netIncome: number };
}

// --- 비교 대차대조표 타입 ---
interface ComparativeBalanceRow {
  section: string;
  code: string;
  name: string;
  currentAmount: number;
  previousAmount: number;
  difference: number;
  changeRate: number | null;
}

interface TotalEntry {
  current: number;
  previous: number;
  difference: number;
  changeRate: number | null;
}

interface ComparativeBalanceData {
  currentAssets: ComparativeBalanceRow[];
  nonCurrentAssets: ComparativeBalanceRow[];
  currentLiabilities: ComparativeBalanceRow[];
  nonCurrentLiabilities: ComparativeBalanceRow[];
  equity: ComparativeBalanceRow[];
  totals: {
    totalCurrentAssets: TotalEntry;
    totalNonCurrentAssets: TotalEntry;
    totalAssets: TotalEntry;
    totalCurrentLiabilities: TotalEntry;
    totalNonCurrentLiabilities: TotalEntry;
    totalLiabilities: TotalEntry;
    totalEquity: TotalEntry;
    retainedEarnings: TotalEntry;
    totalLiabilitiesAndEquity: TotalEntry;
  };
}


const fmtRate = (rate: number | null) => {
  if (rate === null) return "-";
  return `${rate >= 0 ? "+" : ""}${rate.toFixed(1)}%`;
};

// 연도 옵션 생성 (최근 10년)
function yearOptions(): number[] {
  const now = new Date().getFullYear();
  const years: number[] = [];
  for (let y = now; y >= now - 9; y--) years.push(y);
  return years;
}

export default function ComparativeReportsPage() {
  const { tenantId } = useAuth();
  const { t } = useLocale();
  const [activeTab, setActiveTab] = useState<Tab>("income");

  const currentYear = new Date().getFullYear();
  const [curYear, setCurYear] = useState(currentYear);
  const [prevYear, setPrevYear] = useState(currentYear - 1);

  const years = useMemo(() => yearOptions(), []);

  const tabs: { key: Tab; label: string }[] = [
    { key: "income", label: t("comp_tabIncome") },
    { key: "balance", label: t("comp_tabBalance") },
  ];

  return (
    <div>
      <h1 className={styles.title}>{t("comp_title")}</h1>
      <p className={styles.subtitle}>{t("comp_subtitle")}</p>

      <div className={styles.periodRow}>
        <span className={styles.periodLabel}>{t("comp_currentPeriod")}</span>
        <select
          className={styles.periodSelect}
          value={curYear}
          onChange={(e) => setCurYear(Number(e.target.value))}
        >
          {years.map((y) => (
            <option key={y} value={y}>{y}{t("comp_year")}</option>
          ))}
        </select>

        <span className={styles.periodLabel}>{t("comp_previousPeriod")}</span>
        <select
          className={styles.periodSelect}
          value={prevYear}
          onChange={(e) => setPrevYear(Number(e.target.value))}
        >
          {years.map((y) => (
            <option key={y} value={y}>{y}{t("comp_year")}</option>
          ))}
        </select>
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

      {activeTab === "income" && (
        <ComparativeIncomeView
          tenantId={tenantId}
          curYear={curYear}
          prevYear={prevYear}
        />
      )}
      {activeTab === "balance" && (
        <ComparativeBalanceView
          tenantId={tenantId}
          curYear={curYear}
          prevYear={prevYear}
        />
      )}
    </div>
  );
}

// --- 비교 손익계산서 뷰 ---
function ComparativeIncomeView({
  tenantId,
  curYear,
  prevYear,
}: {
  tenantId: string | null;
  curYear: number;
  prevYear: number;
}) {
  const { t } = useLocale();

  const { data, isLoading } = useQuery({
    queryKey: ["comparative-income", tenantId, curYear, prevYear],
    queryFn: () =>
      apiGet<ComparativeIncomeData>(
        `/reports/comparative-income?tenantId=${tenantId}&currentStart=${curYear}-01-01&currentEnd=${curYear}-12-31&previousStart=${prevYear}-01-01&previousEnd=${prevYear}-12-31`,
      ),
    enabled: !!tenantId,
  });

  if (isLoading || !data) return <p className={styles.loading}>{t("comp_loading")}</p>;

  const revenueRows = data.rows.filter((r) => r.type === "REVENUE");
  const expenseRows = data.rows.filter((r) => r.type === "EXPENSE");

  const diffNetIncome = data.currentTotal.netIncome - data.previousTotal.netIncome;
  const rateNetIncome = data.previousTotal.netIncome !== 0
    ? Math.round(((data.currentTotal.netIncome - data.previousTotal.netIncome) / Math.abs(data.previousTotal.netIncome)) * 10000) / 100
    : null;

  const renderDiffCell = (diff: number, rate: number | null) => (
    <>
      <td className={diff > 0 ? styles.positive : diff < 0 ? styles.negative : ""}>
        {fmt(diff)}
      </td>
      <td className={diff > 0 ? styles.positive : diff < 0 ? styles.negative : ""}>
        {fmtRate(rate)}
      </td>
    </>
  );

  return (
    <div className={styles.section}>
      <div className={styles.sectionHeader}>
        <h2 className={styles.sectionTitle}>{t("comp_incomeTitle")}</h2>
        <span className={styles.unit}>{t("comp_unit")}</span>
      </div>

      <table className={styles.compTable}>
        <thead>
          <tr>
            <th>{t("comp_colAccount")}</th>
            <th style={{ textAlign: "right" }}>{prevYear}{t("comp_year")} ({t("comp_previous")})</th>
            <th style={{ textAlign: "right" }}>{curYear}{t("comp_year")} ({t("comp_current")})</th>
            <th style={{ textAlign: "right" }}>{t("comp_colDiff")}</th>
            <th style={{ textAlign: "right" }}>{t("comp_colRate")}</th>
          </tr>
        </thead>
        <tbody>
          {/* 수익 */}
          {revenueRows.length > 0 && (
            <>
              <tr className={styles.groupHeader}>
                <td colSpan={5}>{t("comp_revenue")}</td>
              </tr>
              {revenueRows.map((r) => (
                <tr key={r.code}>
                  <td style={{ paddingLeft: 28 }}>{r.name}</td>
                  <td>{fmt(r.previousAmount)}</td>
                  <td>{fmt(r.currentAmount)}</td>
                  {renderDiffCell(r.difference, r.changeRate)}
                </tr>
              ))}
              <tr className={styles.subtotalRow}>
                <td>{t("comp_revenueTotal")}</td>
                <td>{fmt(data.previousTotal.revenue)}</td>
                <td>{fmt(data.currentTotal.revenue)}</td>
                {renderDiffCell(
                  data.currentTotal.revenue - data.previousTotal.revenue,
                  data.previousTotal.revenue !== 0
                    ? Math.round(((data.currentTotal.revenue - data.previousTotal.revenue) / Math.abs(data.previousTotal.revenue)) * 10000) / 100
                    : null,
                )}
              </tr>
            </>
          )}

          {/* 비용 */}
          {expenseRows.length > 0 && (
            <>
              <tr className={styles.groupHeader}>
                <td colSpan={5}>{t("comp_expense")}</td>
              </tr>
              {expenseRows.map((r) => (
                <tr key={r.code}>
                  <td style={{ paddingLeft: 28 }}>{r.name}</td>
                  <td>{fmt(r.previousAmount)}</td>
                  <td>{fmt(r.currentAmount)}</td>
                  {renderDiffCell(r.difference, r.changeRate)}
                </tr>
              ))}
              <tr className={styles.subtotalRow}>
                <td>{t("comp_expenseTotal")}</td>
                <td>{fmt(data.previousTotal.expense)}</td>
                <td>{fmt(data.currentTotal.expense)}</td>
                {renderDiffCell(
                  data.currentTotal.expense - data.previousTotal.expense,
                  data.previousTotal.expense !== 0
                    ? Math.round(((data.currentTotal.expense - data.previousTotal.expense) / Math.abs(data.previousTotal.expense)) * 10000) / 100
                    : null,
                )}
              </tr>
            </>
          )}

          {/* 당기순이익 */}
          <tr className={styles.grandTotalRow}>
            <td>{t("comp_netIncome")}</td>
            <td>{fmt(data.previousTotal.netIncome)}</td>
            <td>{fmt(data.currentTotal.netIncome)}</td>
            {renderDiffCell(diffNetIncome, rateNetIncome)}
          </tr>
        </tbody>
      </table>

      <div className={styles.summaryBar}>
        <div className={styles.summaryItem}>
          <span className={styles.summaryLabel}>{prevYear}{t("comp_year")} {t("comp_netIncome")}</span>
          <span className={`${styles.summaryValue} ${data.previousTotal.netIncome >= 0 ? styles.positive : styles.negative}`}>
            {fmt(data.previousTotal.netIncome)}
          </span>
        </div>
        <div className={styles.summaryItem}>
          <span className={styles.summaryLabel}>{curYear}{t("comp_year")} {t("comp_netIncome")}</span>
          <span className={`${styles.summaryValue} ${data.currentTotal.netIncome >= 0 ? styles.positive : styles.negative}`}>
            {fmt(data.currentTotal.netIncome)}
          </span>
        </div>
        <div className={styles.summaryItem}>
          <span className={styles.summaryLabel}>{t("comp_colDiff")}</span>
          <span className={`${styles.summaryValue} ${diffNetIncome >= 0 ? styles.positive : styles.negative}`}>
            {fmt(diffNetIncome)}
          </span>
        </div>
      </div>
    </div>
  );
}

// --- 비교 대차대조표 뷰 ---
function ComparativeBalanceView({
  tenantId,
  curYear,
  prevYear,
}: {
  tenantId: string | null;
  curYear: number;
  prevYear: number;
}) {
  const { t } = useLocale();

  const { data, isLoading } = useQuery({
    queryKey: ["comparative-balance", tenantId, curYear, prevYear],
    queryFn: () =>
      apiGet<ComparativeBalanceData>(
        `/reports/comparative-balance?tenantId=${tenantId}&currentEnd=${curYear}-12-31&previousEnd=${prevYear}-12-31`,
      ),
    enabled: !!tenantId,
  });

  if (isLoading || !data) return <p className={styles.loading}>{t("comp_loading")}</p>;

  const renderDiffCell = (diff: number, rate: number | null) => (
    <>
      <td className={diff > 0 ? styles.positive : diff < 0 ? styles.negative : ""}>
        {fmt(diff)}
      </td>
      <td className={diff > 0 ? styles.positive : diff < 0 ? styles.negative : ""}>
        {fmtRate(rate)}
      </td>
    </>
  );

  const renderRows = (rows: ComparativeBalanceRow[]) =>
    rows.map((r) => (
      <tr key={r.code}>
        <td style={{ paddingLeft: 28 }}>{r.name}</td>
        <td>{fmt(r.previousAmount)}</td>
        <td>{fmt(r.currentAmount)}</td>
        {renderDiffCell(r.difference, r.changeRate)}
      </tr>
    ));

  const renderTotalRow = (label: string, total: TotalEntry, isGrand = false) => (
    <tr className={isGrand ? styles.grandTotalRow : styles.subtotalRow}>
      <td>{label}</td>
      <td>{fmt(total.previous)}</td>
      <td>{fmt(total.current)}</td>
      {renderDiffCell(total.difference, total.changeRate)}
    </tr>
  );

  return (
    <div className={styles.section}>
      <div className={styles.sectionHeader}>
        <h2 className={styles.sectionTitle}>{t("comp_balanceTitle")}</h2>
        <span className={styles.unit}>{t("comp_unit")}</span>
      </div>

      <table className={styles.compTable}>
        <thead>
          <tr>
            <th>{t("comp_colAccount")}</th>
            <th style={{ textAlign: "right" }}>{prevYear}{t("comp_year")} ({t("comp_previous")})</th>
            <th style={{ textAlign: "right" }}>{curYear}{t("comp_year")} ({t("comp_current")})</th>
            <th style={{ textAlign: "right" }}>{t("comp_colDiff")}</th>
            <th style={{ textAlign: "right" }}>{t("comp_colRate")}</th>
          </tr>
        </thead>
        <tbody>
          {/* 자산 */}
          <tr className={styles.groupHeader}>
            <td colSpan={5}>{t("comp_currentAssets")}</td>
          </tr>
          {renderRows(data.currentAssets)}
          {renderTotalRow(t("comp_currentAssetsTotal"), data.totals.totalCurrentAssets)}

          <tr className={styles.groupHeader}>
            <td colSpan={5}>{t("comp_nonCurrentAssets")}</td>
          </tr>
          {renderRows(data.nonCurrentAssets)}
          {renderTotalRow(t("comp_nonCurrentAssetsTotal"), data.totals.totalNonCurrentAssets)}

          {renderTotalRow(t("comp_totalAssets"), data.totals.totalAssets, true)}

          {/* 부채 */}
          <tr className={styles.groupHeader}>
            <td colSpan={5}>{t("comp_currentLiabilities")}</td>
          </tr>
          {renderRows(data.currentLiabilities)}
          {renderTotalRow(t("comp_currentLiabilitiesTotal"), data.totals.totalCurrentLiabilities)}

          {data.nonCurrentLiabilities.length > 0 && (
            <>
              <tr className={styles.groupHeader}>
                <td colSpan={5}>{t("comp_nonCurrentLiabilities")}</td>
              </tr>
              {renderRows(data.nonCurrentLiabilities)}
              {renderTotalRow(t("comp_nonCurrentLiabilitiesTotal"), data.totals.totalNonCurrentLiabilities)}
            </>
          )}

          {/* 자본 */}
          <tr className={styles.groupHeader}>
            <td colSpan={5}>{t("comp_equity")}</td>
          </tr>
          {renderRows(data.equity)}
          {renderTotalRow(t("comp_equityTotal"), data.totals.totalEquity)}

          {(data.totals.retainedEarnings.current !== 0 || data.totals.retainedEarnings.previous !== 0) && (
            <tr>
              <td style={{ paddingLeft: 28 }}>{t("comp_retainedEarnings")}</td>
              <td>{fmt(data.totals.retainedEarnings.previous)}</td>
              <td>{fmt(data.totals.retainedEarnings.current)}</td>
              {renderDiffCell(data.totals.retainedEarnings.difference, data.totals.retainedEarnings.changeRate)}
            </tr>
          )}

          {renderTotalRow(t("comp_totalLiabilitiesAndEquity"), data.totals.totalLiabilitiesAndEquity, true)}
        </tbody>
      </table>

      <div className={styles.summaryBar}>
        <div className={styles.summaryItem}>
          <span className={styles.summaryLabel}>{prevYear}{t("comp_year")} {t("comp_totalAssets")}</span>
          <span className={styles.summaryValue}>{fmt(data.totals.totalAssets.previous)}</span>
        </div>
        <div className={styles.summaryItem}>
          <span className={styles.summaryLabel}>{curYear}{t("comp_year")} {t("comp_totalAssets")}</span>
          <span className={styles.summaryValue}>{fmt(data.totals.totalAssets.current)}</span>
        </div>
        <div className={styles.summaryItem}>
          <span className={styles.summaryLabel}>{t("comp_colDiff")}</span>
          <span className={`${styles.summaryValue} ${data.totals.totalAssets.difference >= 0 ? styles.positive : styles.negative}`}>
            {fmt(data.totals.totalAssets.difference)}
          </span>
        </div>
      </div>
    </div>
  );
}
