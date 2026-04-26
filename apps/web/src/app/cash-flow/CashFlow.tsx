"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiGet } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import styles from "./CashFlow.module.css";
import { DailyCashView, CashFlowView } from "./CashFlowTable";
import { CashForecastView } from "./CashForecast";
import type { Tab, DailyCashReport, CashFlowStatement, CashForecast } from "./types";

export default function CashFlowPage() {
  const { tenantId } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>("daily");

  // 기본 필터: 이번 달
  const now = new Date();
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  const monthEnd = now.toISOString().slice(0, 10);

  const [filterStart, setFilterStart] = useState(monthStart);
  const [filterEnd, setFilterEnd] = useState(monthEnd);

  const dateParams = [
    filterStart && `startDate=${filterStart}`,
    filterEnd && `endDate=${filterEnd}`,
  ].filter(Boolean).join("&");

  // 자금 일보 데이터
  const { data: dailyData, isError: dailyError } = useQuery({
    queryKey: ["reports", "daily-cash", dateParams],
    queryFn: () =>
      apiGet<DailyCashReport>(`/reports/daily-cash?tenantId=${tenantId}${dateParams ? `&${dateParams}` : ""}`),
    enabled: !!tenantId && activeTab === "daily",
  });

  // 현금 흐름표 데이터
  const { data: cashFlowData, isError: cashFlowError } = useQuery({
    queryKey: ["reports", "cash-flow", dateParams],
    queryFn: () =>
      apiGet<CashFlowStatement>(`/reports/cash-flow?tenantId=${tenantId}${dateParams ? `&${dateParams}` : ""}`),
    enabled: !!tenantId && activeTab === "cashflow",
  });

  // 자금 예측 데이터
  const { data: forecastData, isError: forecastError } = useQuery({
    queryKey: ["reports", "cash-forecast"],
    queryFn: () => apiGet<CashForecast>(`/reports/cash-forecast?tenantId=${tenantId}&months=3`),
    enabled: !!tenantId && activeTab === "forecast",
  });

  return (
    <div>
      <h1 className={styles.title}>자금 관리</h1>
      <p className={styles.subtitle}>일별 입출금 현황과 현금흐름표를 확인하세요</p>

      <div className={styles.filterRow}>
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
        {(filterStart !== monthStart || filterEnd !== monthEnd) && (
          <button
            className={styles.filterClear}
            onClick={() => { setFilterStart(monthStart); setFilterEnd(monthEnd); }}
          >
            이번 달
          </button>
        )}
      </div>

      <div className={styles.tabs}>
        <button
          className={`${styles.tab} ${activeTab === "daily" ? styles.tabActive : ""}`}
          onClick={() => setActiveTab("daily")}
        >
          자금 일보
        </button>
        <button
          className={`${styles.tab} ${activeTab === "cashflow" ? styles.tabActive : ""}`}
          onClick={() => setActiveTab("cashflow")}
        >
          현금 흐름표
        </button>
        <button
          className={`${styles.tab} ${activeTab === "forecast" ? styles.tabActive : ""}`}
          onClick={() => setActiveTab("forecast")}
        >
          자금 예측
        </button>
      </div>

      {activeTab === "daily" && (
        dailyError ? <p style={{ color: "var(--danger)" }}>데이터를 불러오지 못했습니다.</p> :
        dailyData ? <DailyCashView data={dailyData} /> : <p>불러오는 중...</p>
      )}
      {activeTab === "cashflow" && (
        cashFlowError ? <p style={{ color: "var(--danger)" }}>데이터를 불러오지 못했습니다.</p> :
        cashFlowData ? <CashFlowView data={cashFlowData} /> : <p>불러오는 중...</p>
      )}
      {activeTab === "forecast" && (
        forecastError ? <p style={{ color: "var(--danger)" }}>데이터를 불러오지 못했습니다.</p> :
        forecastData ? <CashForecastView data={forecastData} /> : <p>불러오는 중...</p>
      )}
    </div>
  );
}
