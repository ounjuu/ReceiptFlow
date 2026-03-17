"use client";

import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { apiGet } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from "recharts";
import styles from "./Dashboard.module.css";

interface Document {
  id: string;
  totalAmount: string | null;
  status: string;
}

interface JournalEntry {
  id: string;
  date: string;
  description: string | null;
  status: string;
  lines: { debit: string; credit: string; account: { name: string } }[];
}

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

const COLORS = {
  primary: "#7c5cbf",
  success: "#4caf82",
  danger: "#d95454",
  warning: "#e5a336",
  muted: "#8578a0",
};

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  PENDING: { label: "대기", color: COLORS.warning },
  OCR_DONE: { label: "OCR 완료", color: COLORS.primary },
  JOURNAL_CREATED: { label: "전표 생성", color: COLORS.success },
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
  const router = useRouter();

  const { data: documents = [] } = useQuery({
    queryKey: ["documents"],
    queryFn: () => apiGet<Document[]>(`/documents?tenantId=${tenantId}`),
  });

  const { data: journals = [] } = useQuery({
    queryKey: ["journals"],
    queryFn: () => apiGet<JournalEntry[]>(`/journals?tenantId=${tenantId}`),
  });

  const { data: summary } = useQuery({
    queryKey: ["dashboard-summary"],
    queryFn: () => apiGet<DashboardSummary>(`/reports/dashboard-summary?tenantId=${tenantId}`),
  });

  const { data: alerts } = useQuery({
    queryKey: ["dashboard-alerts"],
    queryFn: () => apiGet<DashboardAlerts>(`/reports/dashboard-alerts?tenantId=${tenantId}`),
  });

  const totalSpent = documents.reduce(
    (sum, d) => sum + (d.totalAmount ? Number(d.totalAmount) : 0),
    0,
  );

  const recentJournals = journals.slice(0, 5);

  // 파이 차트 데이터
  const pieData = (summary?.statusCounts || []).map((s) => ({
    name: STATUS_MAP[s.status]?.label || s.status,
    value: s.count,
    color: STATUS_MAP[s.status]?.color || COLORS.muted,
  }));

  // 알림 항목 구성
  const alertItems: { type: string; icon: string; message: string; href: string }[] = [];
  if (alerts) {
    if (alerts.draftCount > 0) {
      alertItems.push({
        type: "warning",
        icon: "!",
        message: `${alerts.draftCount}건의 전표가 승인 대기 중입니다`,
        href: "/journals",
      });
    }
    if (alerts.approvedCount > 0) {
      alertItems.push({
        type: "info",
        icon: "i",
        message: `${alerts.approvedCount}건의 전표가 전기 대기 중입니다`,
        href: "/journals",
      });
    }
    if (!alerts.closing.isClosed && alerts.closing.daysUntilMonthEnd <= 3) {
      alertItems.push({
        type: "danger",
        icon: "!",
        message: `${alerts.closing.month}월 마감이 ${alerts.closing.daysUntilMonthEnd}일 남았습니다`,
        href: "/closings",
      });
    }
    if (alerts.pendingDocCount > 0) {
      alertItems.push({
        type: "muted",
        icon: "i",
        message: `${alerts.pendingDocCount}건의 영수증이 처리 대기 중입니다`,
        href: "/documents",
      });
    }
  }

  return (
    <div>
      <h1 className={styles.title}>대시보드</h1>

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

      <div className={styles.cards}>
        <div className={styles.card}>
          <div className={styles.cardLabel}>총 영수증</div>
          <div className={styles.cardValue}>{documents.length}건</div>
        </div>
        <div className={styles.card}>
          <div className={styles.cardLabel}>총 지출</div>
          <div className={styles.cardValue}>₩{fmt(totalSpent)}</div>
        </div>
        <div className={styles.card}>
          <div className={styles.cardLabel}>총 전표</div>
          <div className={styles.cardValue}>{journals.length}건</div>
        </div>
        <div className={styles.card}>
          <div className={styles.cardLabel}>당기순이익</div>
          <div
            className={styles.cardValue}
            style={{ color: summary && summary.netIncome >= 0 ? COLORS.success : COLORS.danger }}
          >
            {summary ? `₩${fmt(summary.netIncome)}` : "-"}
          </div>
        </div>
      </div>

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
          <h2 className={styles.sectionTitle}>영수증 처리 현황</h2>
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

      <div className={styles.bottomGrid}>
        {/* 최근 전표 */}
        <div className={styles.section} style={{ marginBottom: 0 }}>
          <h2 className={styles.sectionTitle}>최근 전표</h2>
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
                  <td>{j.status}</td>
                  <td>
                    ₩{j.lines
                      .reduce((s, l) => s + Number(l.debit), 0)
                      .toLocaleString()}
                  </td>
                </tr>
              ))}
              {recentJournals.length === 0 && (
                <tr>
                  <td colSpan={4} style={{ textAlign: "center", color: "var(--text-muted)" }}>
                    전표가 없습니다
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* 최근 활동 */}
        <div className={styles.section} style={{ marginBottom: 0 }}>
          <h2 className={styles.sectionTitle}>최근 활동</h2>
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
            <p className={styles.empty}>활동 내역이 없습니다</p>
          )}
        </div>
      </div>
    </div>
  );
}
