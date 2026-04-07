"use client";

import { useRouter } from "next/navigation";
import type { TranslationKey } from "@/lib/translations";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
  ComposedChart, Line,
} from "recharts";
import styles from "./Dashboard.module.css";
import {
  COLORS,
  fmt,
  timeAgo,
  JOURNAL_STATUS_KEYS,
  DOC_TYPE_LABEL,
  ACTION_LABELS,
  JOURNAL_TYPE_LABELS,
  JOURNAL_TYPE_COLORS,
  JOURNAL_STATUS_LABELS,
  JOURNAL_STATUS_COLORS,
  type DashboardSummary,
  type DashboardAlerts,
  type BudgetVsActual,
  type JournalEntry,
  type PendingApproval,
  type PieDataEntry,
  type BudgetChartEntry,
} from "./types";

// --- 월별 지출 + 영수증 현황 (2열 차트 그리드) ---

export interface ChartGridProps {
  summary: DashboardSummary | undefined;
  pieData: PieDataEntry[];
  totalDocs: number;
}

export function ChartGrid({ summary, pieData, totalDocs }: ChartGridProps) {
  return (
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
  );
}

// --- 전표 유형별 / 상태별 현황 차트 ---

export interface JournalTypeChartProps {
  journals: JournalEntry[];
}

export function JournalTypeChart({ journals }: JournalTypeChartProps) {
  // 유형별 집계
  const typeCounts = journals.reduce<Record<string, number>>((acc, j) => {
    const type = j.journalType || "GENERAL";
    acc[type] = (acc[type] || 0) + 1;
    return acc;
  }, {});

  const typeData = Object.entries(typeCounts).map(([key, value]) => ({
    name: JOURNAL_TYPE_LABELS[key] || key,
    value,
    color: JOURNAL_TYPE_COLORS[key] || COLORS.muted,
  }));

  const totalJournals = typeData.reduce((s, d) => s + d.value, 0);

  // 상태별 집계
  const statusCounts = journals.reduce<Record<string, number>>((acc, j) => {
    acc[j.status] = (acc[j.status] || 0) + 1;
    return acc;
  }, {});

  const statusData = Object.entries(statusCounts).map(([key, value]) => ({
    name: JOURNAL_STATUS_LABELS[key] || key,
    value,
    fill: JOURNAL_STATUS_COLORS[key] || COLORS.muted,
  }));

  return (
    <div className={styles.chartGrid}>
      {/* 전표 유형별 현황 (도넛) */}
      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>전표 유형별 현황 ({totalJournals}건)</h2>
        {typeData.length > 0 ? (
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie
                data={typeData}
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={90}
                paddingAngle={3}
                dataKey="value"
                label={({ name, value }) => `${name} ${value}건`}
              >
                {typeData.map((entry, i) => (
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

      {/* 전표 상태별 현황 (바) */}
      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>전표 상태별 현황</h2>
        {statusData.length > 0 ? (
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={statusData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e8e4f0" />
              <XAxis dataKey="name" fontSize={12} />
              <YAxis fontSize={12} allowDecimals={false} />
              <Tooltip formatter={(v) => [`${v}건`, "건수"]} />
              <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                {statusData.map((entry, i) => (
                  <Cell key={i} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <p className={styles.empty}>데이터가 없습니다</p>
        )}
      </div>
    </div>
  );
}

// --- 예산 vs 실적 차트 ---

export interface BudgetChartProps {
  budgetChartData: BudgetChartEntry[];
  budgetData: BudgetVsActual | undefined;
  currentYear: number;
  t: (key: TranslationKey, params?: Record<string, string | number>) => string;
}

export function BudgetChart({ budgetChartData, budgetData, currentYear, t }: BudgetChartProps) {
  if (budgetChartData.length === 0) return null;

  return (
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
  );
}

// --- 상위 거래처 TOP5 ---

export interface TopVendorsChartProps {
  summary: DashboardSummary | undefined;
}

export function TopVendorsChart({ summary }: TopVendorsChartProps) {
  if (!summary || summary.topVendors.length === 0) return null;

  return (
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
  );
}

// --- 하단 3열 그리드: 최근 전표, 결재 대기, 최근 활동 ---

export interface BottomGridProps {
  recentJournals: JournalEntry[];
  pendingApprovals: PendingApproval[];
  alerts: DashboardAlerts | undefined;
  t: (key: TranslationKey, params?: Record<string, string | number>) => string;
}

export function BottomGrid({ recentJournals, pendingApprovals, alerts, t }: BottomGridProps) {
  const router = useRouter();

  return (
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
  );
}
