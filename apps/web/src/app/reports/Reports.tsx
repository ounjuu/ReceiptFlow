"use client";

import { useState } from "react";
import { useAuth } from "@/lib/auth";
import styles from "./Reports.module.css";
import { tabs, type Tab } from "./types";
import { TrialBalanceView, IncomeStatementView, BalanceSheetView } from "./ReportTable";

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
