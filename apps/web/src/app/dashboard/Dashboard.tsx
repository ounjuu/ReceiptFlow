"use client";

import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { apiGet } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useLocale } from "@/lib/locale";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
  ComposedChart, Line,
} from "recharts";
import styles from "./Dashboard.module.css";

interface DashboardSummary {
  monthlyExpense: { month: string; total: number }[];
  statusCounts: { status: string; count: number }[];
  topVendors: { name: string; total: number }[];
  totalRevenue: number;
  totalExpense: number;
  netIncome: number;
}

interface DashboardAlerts {
  draftCount: number;
  approvedCount: number;
  pendingDocCount: number;
  closing: { year: number; month: number; isClosed: boolean; daysUntilMonthEnd: number };
  recentLogs: {
    id: string;
    action: string;
    description: string | null;
    createdAt: string;
    userName: string;
  }[];
}

interface DashboardKpi {
  trades: { salesTotal: number; salesRemaining: number; purchaseTotal: number; purchaseRemaining: number };
  bankBalance: number;
  expenseClaims: { pendingCount: number; pendingAmount: number };
  inventory: { lowStockCount: number };
  approvals: { pendingCount: number };
  budget: { year: number; totalBudget: number };
}

interface BudgetVsActual {
  rows: { accountName: string; budget: number; actual: number; variance: number; rate: number }[];
  totalBudget: number;
  totalActual: number;
  totalVariance: number;
  totalRate: number;
}

interface JournalEntry {
  id: string;
  date: string;
  description: string | null;
  status: string;
  lines: { debit: string; credit: string; account: { name: string } }[];
}

interface PendingApproval {
  id: string;
  documentType: string;
  status: string;
  currentStep: number;
  totalSteps: number;
  submittedBy: string;
  createdAt: string;
}

const COLORS = {
  primary: "#7c5cbf",
  primaryLight: "#ede8f5",
  success: "#4caf82",
  danger: "#d95454",
  warning: "#e5a336",
  muted: "#8578a0",
};

const STATUS_MAP_KEYS: Record<string, { labelKey: "docStatus_PENDING" | "docStatus_OCR_DONE" | "docStatus_JOURNAL_CREATED"; color: string }> = {
  PENDING: { labelKey: "docStatus_PENDING", color: COLORS.warning },
  OCR_DONE: { labelKey: "docStatus_OCR_DONE", color: COLORS.primary },
  JOURNAL_CREATED: { labelKey: "docStatus_JOURNAL_CREATED", color: COLORS.success },
};

const JOURNAL_STATUS_KEYS: Record<string, "status_DRAFT" | "status_APPROVED" | "status_POSTED"> = {
  DRAFT: "status_DRAFT",
  APPROVED: "status_APPROVED",
  POSTED: "status_POSTED",
};

const DOC_TYPE_LABEL: Record<string, string> = {
  JOURNAL: "전표",
  TAX_INVOICE: "세금계산서",
};

const ACTION_LABELS: Record<string, string> = {
  JOURNAL_CREATED: "전표 생성",
  JOURNAL_UPDATED: "전표 수정",
  JOURNAL_STATUS_CHANGED: "상태 변경",
  JOURNAL_DELETED: "전표 삭제",
  JOURNAL_BATCH_STATUS: "일괄 변경",
  PERIOD_CLOSED: "월 마감",
  PERIOD_REOPENED: "마감 취소",
};

const fmt = (n: number) => n.toLocaleString();

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "방금 전";
  if (minutes < 60) return `${minutes}분 전`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}시간 전`;
  const days = Math.floor(hours / 24);
  return `${days}일 전`;
}

export default function DashboardPage() {
  const { tenantId } = useAuth();
  const { t } = useLocale();
  const router = useRouter();
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

  const { data: recentJournals = [] } = useQuery({
    queryKey: ["journals-recent", tenantId],
    queryFn: () => apiGet<JournalEntry[]>(`/journals?tenantId=${tenantId}`),
    enabled: !!tenantId,
    select: (data) => data.slice(0, 5),
  });

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
  const alertItems: { type: string; icon: string; message: string; href: string }[] = [];
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

      {/* 알림 배너 */}
      {alertItems.length > 0 && (
        <div className={styles.alertsSection}>
          {alertItems.map((item, i) => (
            <div
              key={i}
              className={`${styles.alertItem} ${styles[`alert_${item.type}`]}`}
              onClick={() => router.push(item.href)}
            >
              <span className={styles.alertIcon}>{item.icon}</span>
              <span className={styles.alertMessage}>{item.message}</span>
              <span className={styles.alertArrow}>&rarr;</span>
            </div>
          ))}
        </div>
      )}

      {/* KPI 카드 Row 1 — 재무 */}
      <div className={styles.cards}>
        <div className={styles.card}>
          <div className={styles.cardLabel}>{t("dash_monthlySales")}</div>
          <div className={styles.cardValue} style={{ color: COLORS.primary }}>
            ₩{fmt(kpi?.trades.salesTotal || 0)}
          </div>
        </div>
        <div className={styles.card}>
          <div className={styles.cardLabel}>{t("dash_monthlyPurchase")}</div>
          <div className={styles.cardValue} style={{ color: COLORS.warning }}>
            ₩{fmt(kpi?.trades.purchaseTotal || 0)}
          </div>
        </div>
        <div className={styles.card}>
          <div className={styles.cardLabel}>{t("dash_netIncome")}</div>
          <div
            className={styles.cardValue}
            style={{ color: summary && summary.netIncome >= 0 ? COLORS.success : COLORS.danger }}
          >
            {summary ? `₩${fmt(summary.netIncome)}` : "-"}
          </div>
        </div>
        <div className={styles.card}>
          <div className={styles.cardLabel}>{t("dash_bankBalance")}</div>
          <div className={styles.cardValue} style={{ color: COLORS.primary }}>
            ₩{fmt(kpi?.bankBalance || 0)}
          </div>
        </div>
      </div>

      {/* KPI 카드 Row 2 — 운영 */}
      <div className={styles.cards}>
        <div className={styles.card}>
          <div className={styles.cardLabel}>{t("dash_receivable")}</div>
          <div
            className={styles.cardValue}
            style={{ color: (kpi?.trades.salesRemaining || 0) > 0 ? COLORS.danger : COLORS.success }}
          >
            ₩{fmt(kpi?.trades.salesRemaining || 0)}
          </div>
        </div>
        <div className={styles.card}>
          <div className={styles.cardLabel}>{t("dash_payable")}</div>
          <div
            className={styles.cardValue}
            style={{ color: (kpi?.trades.purchaseRemaining || 0) > 0 ? COLORS.warning : COLORS.success }}
          >
            ₩{fmt(kpi?.trades.purchaseRemaining || 0)}
          </div>
        </div>
        <div className={styles.card}>
          <div className={styles.cardLabel}>{t("dash_pendingExpense")}</div>
          <div className={styles.cardValue}>
            {t("dash_count", { count: kpi?.expenseClaims.pendingCount || 0 })}
          </div>
          {kpi && kpi.expenseClaims.pendingAmount > 0 && (
            <div className={styles.cardSub}>{t("dash_amount", { amount: fmt(kpi.expenseClaims.pendingAmount) })}</div>
          )}
        </div>
        <div className={styles.card}>
          <div className={styles.cardLabel}>{t("dash_pendingApproval")}</div>
          <div className={styles.cardValue}>
            {t("dash_count", { count: kpi?.approvals.pendingCount || 0 })}
          </div>
        </div>
      </div>

      {/* 차트 그리드 */}
      <div className={styles.chartGrid}>
        {/* 월별 지출 추이 */}
        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>월별 지출 추이</h2>
          {summary && summary.monthlyExpense.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={summary.monthlyExpense}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e8e4f0" />
                <XAxis dataKey="month" fontSize={12} />
                <YAxis fontSize={12} tickFormatter={(v) => `${(v / 10000).toFixed(0)}만`} />
                <Tooltip formatter={(v) => [`₩${fmt(Number(v))}`, "지출"]} />
                <Bar dataKey="total" fill={COLORS.primary} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className={styles.empty}>데이터가 없습니다</p>
          )}
        </div>

        {/* 영수증 처리 현황 */}
        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>영수증 처리 현황 ({totalDocs}건)</h2>
          {pieData.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={90}
                  paddingAngle={3}
                  dataKey="value"
                  label={({ name, value }) => `${name} ${value}건`}
                >
                  {pieData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <p className={styles.empty}>데이터가 없습니다</p>
          )}
        </div>
      </div>

      {/* 예산 vs 실적 */}
      {budgetChartData.length > 0 && (
        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>{t("dash_budgetVsActual")} ({currentYear})</h2>
            {budgetData && (
              <div className={styles.budgetSummary}>
                <span>{t("dash_budget")} ₩{fmt(budgetData.totalBudget)}</span>
                <span>{t("dash_actual")} ₩{fmt(budgetData.totalActual)}</span>
                <span className={styles.budgetRate}>{budgetData.totalRate.toFixed(1)}%</span>
              </div>
            )}
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <ComposedChart data={budgetChartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e8e4f0" />
              <XAxis dataKey="name" fontSize={11} />
              <YAxis yAxisId="left" fontSize={12} tickFormatter={(v) => `${(v / 10000).toFixed(0)}만`} />
              <YAxis yAxisId="right" orientation="right" fontSize={12} tickFormatter={(v) => `${v}%`} />
              <Tooltip
                formatter={(v, name) => {
                  const n = Number(v);
                  return name === "집행률" ? [`${n.toFixed(1)}%`, name] : [`₩${fmt(n)}`, name];
                }}
              />
              <Legend />
              <Bar yAxisId="left" dataKey="예산" fill={COLORS.primaryLight} radius={[4, 4, 0, 0]} />
              <Bar yAxisId="left" dataKey="실적" fill={COLORS.primary} radius={[4, 4, 0, 0]} />
              <Line yAxisId="right" type="monotone" dataKey="집행률" stroke={COLORS.warning} strokeWidth={2} dot={{ r: 3 }} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* 상위 거래처 TOP5 */}
      {summary && summary.topVendors.length > 0 && (
        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>상위 거래처 TOP5</h2>
          <ResponsiveContainer width="100%" height={Math.max(200, summary.topVendors.length * 44)}>
            <BarChart data={summary.topVendors} layout="vertical" margin={{ left: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e8e4f0" />
              <XAxis type="number" fontSize={12} tickFormatter={(v) => `₩${fmt(v)}`} />
              <YAxis type="category" dataKey="name" fontSize={12} width={100} />
              <Tooltip formatter={(v) => [`₩${fmt(Number(v))}`, "지출"]} />
              <Bar dataKey="total" fill={COLORS.primary} radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* 하단 3열 그리드 */}
      <div className={styles.bottomGrid}>
        {/* 최근 전표 */}
        <div className={styles.section} style={{ marginBottom: 0 }}>
          <h2 className={styles.sectionTitle}>{t("dash_recentJournals")}</h2>
          <table>
            <thead>
              <tr>
                <th>날짜</th>
                <th>설명</th>
                <th>상태</th>
                <th>차변 합계</th>
              </tr>
            </thead>
            <tbody>
              {recentJournals.map((j) => (
                <tr key={j.id}>
                  <td>{new Date(j.date).toLocaleDateString("ko-KR")}</td>
                  <td>{j.description || "-"}</td>
                  <td>
                    <span className={styles.statusBadge} data-status={j.status}>
                      {JOURNAL_STATUS_KEYS[j.status] ? t(JOURNAL_STATUS_KEYS[j.status]) : j.status}
                    </span>
                  </td>
                  <td>₩{j.lines.reduce((s, l) => s + Number(l.debit), 0).toLocaleString()}</td>
                </tr>
              ))}
              {recentJournals.length === 0 && (
                <tr>
                  <td colSpan={4} style={{ textAlign: "center", color: "var(--text-muted)" }}>
                    {t("dash_noJournals")}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* 결재 대기 */}
        <div className={styles.section} style={{ marginBottom: 0 }}>
          <h2 className={styles.sectionTitle}>{t("dash_pendingApprovals")}</h2>
          {pendingApprovals.length > 0 ? (
            <div className={styles.approvalList}>
              {pendingApprovals.slice(0, 8).map((a) => (
                <div key={a.id} className={styles.approvalItem} onClick={() => router.push("/approvals")}>
                  <div className={styles.approvalTop}>
                    <span className={styles.approvalType}>
                      {DOC_TYPE_LABEL[a.documentType] || a.documentType}
                    </span>
                    <span className={styles.approvalStep}>
                      {a.currentStep}/{a.totalSteps}단계
                    </span>
                  </div>
                  <div className={styles.approvalTime}>{timeAgo(a.createdAt)}</div>
                </div>
              ))}
            </div>
          ) : (
            <p className={styles.empty}>{t("dash_noApprovals")}</p>
          )}
        </div>

        {/* 최근 활동 */}
        <div className={styles.section} style={{ marginBottom: 0 }}>
          <h2 className={styles.sectionTitle}>{t("dash_recentActivity")}</h2>
          {alerts && alerts.recentLogs.length > 0 ? (
            <div className={styles.activityFeed}>
              {alerts.recentLogs.map((log) => (
                <div key={log.id} className={styles.activityItem}>
                  <div className={styles.activityDot} />
                  <div className={styles.activityContent}>
                    <div className={styles.activityTop}>
                      <span className={styles.activityUser}>{log.userName}</span>
                      <span className={styles.activityAction}>
                        {ACTION_LABELS[log.action] || log.action}
                      </span>
                    </div>
                    {log.description && (
                      <div className={styles.activityDesc}>{log.description}</div>
                    )}
                    <div className={styles.activityTime}>{timeAgo(log.createdAt)}</div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className={styles.empty}>{t("dash_noActivity")}</p>
          )}
        </div>
      </div>
    </div>
  );
}
