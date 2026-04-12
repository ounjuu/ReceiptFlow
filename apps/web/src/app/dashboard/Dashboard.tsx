"use client";

import { useState, useCallback, ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiGet } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useLocale } from "@/lib/locale";
import styles from "./Dashboard.module.css";
import {
  STATUS_MAP_KEYS,
  COLORS,
  type DashboardSummary,
  type DashboardAlerts,
  type DashboardKpi,
  type BudgetVsActual,
  type JournalEntry,
  type PendingApproval,
  type AlertItem,
} from "./types";
import { DashboardAlertsBanner, FinancialCards, OperationalCards } from "./DashboardCards";
import { ChartGrid, JournalTypeChart, BudgetChart, TopVendorsChart, BottomGrid } from "./DashboardCharts";

// 위젯 정의
interface WidgetDef {
  id: string;
  label: string;
}

const ALL_WIDGETS: WidgetDef[] = [
  { id: "alerts", label: "알림" },
  { id: "financial", label: "재무 KPI" },
  { id: "operational", label: "운영 KPI" },
  { id: "chartGrid", label: "지출 추이 / 영수증 현황" },
  { id: "journalType", label: "전표 유형별 / 상태별" },
  { id: "budget", label: "예산 vs 실적" },
  { id: "topVendors", label: "상위 거래처" },
  { id: "bottomGrid", label: "최근 전표 / 결재 / 활동" },
];

const DEFAULT_ORDER = ALL_WIDGETS.map((w) => w.id);

function loadWidgetConfig(): { order: string[]; hidden: Set<string> } {
  try {
    const raw = localStorage.getItem("dashboard-widgets");
    if (raw) {
      const { order, hidden } = JSON.parse(raw);
      return { order: order || DEFAULT_ORDER, hidden: new Set(hidden || []) };
    }
  } catch { /* ignore */ }
  return { order: DEFAULT_ORDER, hidden: new Set<string>() };
}

function saveWidgetConfig(order: string[], hidden: Set<string>) {
  localStorage.setItem("dashboard-widgets", JSON.stringify({ order, hidden: [...hidden] }));
}

export default function DashboardPage() {
  const { tenantId } = useAuth();
  const { t } = useLocale();
  const currentYear = new Date().getFullYear();
  const [showSettings, setShowSettings] = useState(false);

  // 위젯 설정
  const [widgetConfig, setWidgetConfig] = useState(loadWidgetConfig);
  const { order, hidden } = widgetConfig;

  const moveWidget = useCallback((id: string, dir: -1 | 1) => {
    setWidgetConfig((prev) => {
      const idx = prev.order.indexOf(id);
      if (idx < 0) return prev;
      const target = idx + dir;
      if (target < 0 || target >= prev.order.length) return prev;
      const next = [...prev.order];
      [next[idx], next[target]] = [next[target], next[idx]];
      saveWidgetConfig(next, prev.hidden);
      return { ...prev, order: next };
    });
  }, []);

  const toggleWidget = useCallback((id: string) => {
    setWidgetConfig((prev) => {
      const next = new Set(prev.hidden);
      if (next.has(id)) next.delete(id); else next.add(id);
      saveWidgetConfig(prev.order, next);
      return { ...prev, hidden: next };
    });
  }, []);

  const resetWidgets = useCallback(() => {
    const config = { order: DEFAULT_ORDER, hidden: new Set<string>() };
    saveWidgetConfig(config.order, config.hidden);
    setWidgetConfig(config);
  }, []);

  // 데이터 조회
  const { data: summary } = useQuery({
    queryKey: ["dashboard-summary", tenantId],
    queryFn: () => apiGet<DashboardSummary>(`/reports/dashboard-summary?tenantId=${tenantId}`),
    enabled: !!tenantId,
  });

  const { data: alerts } = useQuery({
    queryKey: ["dashboard-alerts", tenantId],
    queryFn: () => apiGet<DashboardAlerts>(`/reports/dashboard-alerts?tenantId=${tenantId}`),
    enabled: !!tenantId,
  });

  const { data: kpi } = useQuery({
    queryKey: ["dashboard-kpi", tenantId],
    queryFn: () => apiGet<DashboardKpi>(`/reports/dashboard-kpi?tenantId=${tenantId}`),
    enabled: !!tenantId,
  });

  const { data: budgetData } = useQuery({
    queryKey: ["budgets-vs-actual", tenantId, currentYear],
    queryFn: () => apiGet<BudgetVsActual>(`/budgets/vs-actual?tenantId=${tenantId}&year=${currentYear}`),
    enabled: !!tenantId,
  });

  const { data: recentResult } = useQuery({
    queryKey: ["journals-recent", tenantId],
    queryFn: () => apiGet<{ data: JournalEntry[] }>(`/journals?tenantId=${tenantId}&limit=5&page=1`),
    enabled: !!tenantId,
  });
  const recentJournals = recentResult?.data ?? [];

  const { data: pendingApprovals = [] } = useQuery({
    queryKey: ["approvals-pending", tenantId],
    queryFn: () => apiGet<PendingApproval[]>(`/approvals/pending?tenantId=${tenantId}`),
    enabled: !!tenantId,
  });

  // 차트 데이터 가공
  const pieData = (summary?.statusCounts || []).map((s) => ({
    name: STATUS_MAP_KEYS[s.status] ? t(STATUS_MAP_KEYS[s.status].labelKey) : s.status,
    value: s.count,
    color: STATUS_MAP_KEYS[s.status]?.color || COLORS.muted,
  }));
  const totalDocs = pieData.reduce((s, p) => s + p.value, 0);

  const budgetChartData = (budgetData?.rows || [])
    .filter((r) => r.budget > 0)
    .slice(0, 10)
    .map((r) => ({
      name: r.accountName.length > 6 ? r.accountName.slice(0, 6) + "…" : r.accountName,
      예산: r.budget,
      실적: r.actual,
      집행률: r.rate,
    }));

  // 알림 구성
  const alertItems: AlertItem[] = [];
  if (alerts) {
    if (alerts.draftCount > 0) alertItems.push({ type: "warning", icon: "!", message: `${alerts.draftCount}건의 전표가 승인 대기 중입니다`, href: "/journals" });
    if (alerts.approvedCount > 0) alertItems.push({ type: "info", icon: "i", message: `${alerts.approvedCount}건의 전표가 전기 대기 중입니다`, href: "/journals" });
    if (!alerts.closing.isClosed && alerts.closing.daysUntilMonthEnd <= 3) alertItems.push({ type: "danger", icon: "!", message: `${alerts.closing.month}월 마감이 ${alerts.closing.daysUntilMonthEnd}일 남았습니다`, href: "/closings" });
    if (alerts.pendingDocCount > 0) alertItems.push({ type: "muted", icon: "i", message: `${alerts.pendingDocCount}건의 영수증이 처리 대기 중입니다`, href: "/documents" });
  }
  if (kpi) {
    if (kpi.inventory?.lowStockCount > 0) alertItems.push({ type: "danger", icon: "!", message: `${kpi.inventory.lowStockCount}개 품목의 재고가 부족합니다`, href: "/inventory" });
    if (kpi.expenseClaims?.pendingCount > 0) alertItems.push({ type: "warning", icon: "!", message: `${kpi.expenseClaims.pendingCount}건의 경비 정산이 대기 중입니다`, href: "/expense-claims" });
    if (kpi.approvals?.pendingCount > 0) alertItems.push({ type: "info", icon: "i", message: `${kpi.approvals.pendingCount}건의 결재가 대기 중입니다`, href: "/approvals" });
  }

  // 위젯 렌더 맵
  const widgetMap: Record<string, ReactNode> = {
    alerts: <DashboardAlertsBanner alertItems={alertItems} />,
    financial: <FinancialCards kpi={kpi} summary={summary} t={t} />,
    operational: <OperationalCards kpi={kpi} t={t} />,
    chartGrid: <ChartGrid summary={summary} pieData={pieData} totalDocs={totalDocs} />,
    journalType: <JournalTypeChart journalTypeCounts={summary?.journalTypeCounts} journalStatusCounts={summary?.journalStatusCounts} />,
    budget: <BudgetChart budgetChartData={budgetChartData} budgetData={budgetData} currentYear={currentYear} t={t} />,
    topVendors: <TopVendorsChart summary={summary} />,
    bottomGrid: <BottomGrid recentJournals={recentJournals} pendingApprovals={pendingApprovals} alerts={alerts} t={t} />,
  };

  return (
    <div>
      <div className={styles.dashHeader}>
        <h1 className={styles.title}>{t("dash_title")}</h1>
        <button
          className={styles.settingsBtn}
          onClick={() => setShowSettings((v) => !v)}
        >
          {showSettings ? "닫기" : "위젯 설정"}
        </button>
      </div>

      {showSettings && (
        <div className={styles.widgetSettings}>
          <div className={styles.widgetSettingsHeader}>
            <span>위젯 표시/순서 관리</span>
            <button className={styles.resetBtn} onClick={resetWidgets}>초기화</button>
          </div>
          {order.map((id, idx) => {
            const def = ALL_WIDGETS.find((w) => w.id === id);
            if (!def) return null;
            const isHidden = hidden.has(id);
            return (
              <div key={id} className={styles.widgetSettingRow}>
                <label className={styles.widgetToggle}>
                  <input
                    type="checkbox"
                    checked={!isHidden}
                    onChange={() => toggleWidget(id)}
                  />
                  <span>{def.label}</span>
                </label>
                <div className={styles.widgetMoveButtons}>
                  <button
                    disabled={idx === 0}
                    onClick={() => moveWidget(id, -1)}
                    className={styles.moveBtn}
                  >
                    ▲
                  </button>
                  <button
                    disabled={idx === order.length - 1}
                    onClick={() => moveWidget(id, 1)}
                    className={styles.moveBtn}
                  >
                    ▼
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {order.map((id) => {
        if (hidden.has(id)) return null;
        return <div key={id}>{widgetMap[id]}</div>;
      })}
    </div>
  );
}
