"use client";

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

export default function DashboardPage() {
  const { tenantId } = useAuth();
  const { t } = useLocale();
  const currentYear = new Date().getFullYear();

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

  const { data: allJournals = [] } = useQuery({
    queryKey: ["journals-recent", tenantId],
    queryFn: () => apiGet<JournalEntry[]>(`/journals?tenantId=${tenantId}`),
    enabled: !!tenantId,
  });

  const recentJournals = allJournals.slice(0, 5);

  const { data: pendingApprovals = [] } = useQuery({
    queryKey: ["approvals-pending", tenantId],
    queryFn: () => apiGet<PendingApproval[]>(`/approvals/pending?tenantId=${tenantId}`),
    enabled: !!tenantId,
  });

  // 파이 차트
  const pieData = (summary?.statusCounts || []).map((s) => ({
    name: STATUS_MAP_KEYS[s.status] ? t(STATUS_MAP_KEYS[s.status].labelKey) : s.status,
    value: s.count,
    color: STATUS_MAP_KEYS[s.status]?.color || COLORS.muted,
  }));

  const totalDocs = pieData.reduce((s, p) => s + p.value, 0);

  // 예산 vs 실적 차트 데이터 (상위 10개)
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
    if (alerts.draftCount > 0) {
      alertItems.push({ type: "warning", icon: "!", message: `${alerts.draftCount}건의 전표가 승인 대기 중입니다`, href: "/journals" });
    }
    if (alerts.approvedCount > 0) {
      alertItems.push({ type: "info", icon: "i", message: `${alerts.approvedCount}건의 전표가 전기 대기 중입니다`, href: "/journals" });
    }
    if (!alerts.closing.isClosed && alerts.closing.daysUntilMonthEnd <= 3) {
      alertItems.push({ type: "danger", icon: "!", message: `${alerts.closing.month}월 마감이 ${alerts.closing.daysUntilMonthEnd}일 남았습니다`, href: "/closings" });
    }
    if (alerts.pendingDocCount > 0) {
      alertItems.push({ type: "muted", icon: "i", message: `${alerts.pendingDocCount}건의 영수증이 처리 대기 중입니다`, href: "/documents" });
    }
  }
  if (kpi) {
    if (kpi.inventory.lowStockCount > 0) {
      alertItems.push({ type: "danger", icon: "!", message: `${kpi.inventory.lowStockCount}개 품목의 재고가 부족합니다`, href: "/inventory" });
    }
    if (kpi.expenseClaims.pendingCount > 0) {
      alertItems.push({ type: "warning", icon: "!", message: `${kpi.expenseClaims.pendingCount}건의 경비 정산이 대기 중입니다`, href: "/expense-claims" });
    }
    if (kpi.approvals.pendingCount > 0) {
      alertItems.push({ type: "info", icon: "i", message: `${kpi.approvals.pendingCount}건의 결재가 대기 중입니다`, href: "/approvals" });
    }
  }

  return (
    <div>
      <h1 className={styles.title}>{t("dash_title")}</h1>

      <DashboardAlertsBanner alertItems={alertItems} />

      <FinancialCards kpi={kpi} summary={summary} t={t} />

      <OperationalCards kpi={kpi} t={t} />

      <ChartGrid summary={summary} pieData={pieData} totalDocs={totalDocs} />

      <JournalTypeChart journals={allJournals} />

      <BudgetChart
        budgetChartData={budgetChartData}
        budgetData={budgetData}
        currentYear={currentYear}
        t={t}
      />

      <TopVendorsChart summary={summary} />

      <BottomGrid
        recentJournals={recentJournals}
        pendingApprovals={pendingApprovals}
        alerts={alerts}
        t={t}
      />
    </div>
  );
}
