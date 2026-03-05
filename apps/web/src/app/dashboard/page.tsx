"use client";

import { useQuery } from "@tanstack/react-query";
import { apiGet } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from "recharts";
import styles from "./page.module.css";

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

const fmt = (n: number) => n.toLocaleString();

export default function DashboardPage() {
  const { tenantId } = useAuth();

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

  return (
    <div>
      <h1 className={styles.title}>대시보드</h1>

      <div className={styles.cards}>
        <div className={styles.card}>
          <div className={styles.cardLabel}>총 영수증</div>
          <div className={styles.cardValue}>{documents.length}건</div>
        </div>
        <div className={styles.card}>
          <div className={styles.cardLabel}>총 지출</div>
          <div className={styles.cardValue}>{fmt(totalSpent)}원</div>
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
            {summary ? `${fmt(summary.netIncome)}원` : "-"}
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
                <Tooltip formatter={(v) => [`${fmt(Number(v))}원`, "지출"]} />
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
              <XAxis type="number" fontSize={12} tickFormatter={(v) => `${fmt(v)}원`} />
              <YAxis type="category" dataKey="name" fontSize={12} width={100} />
              <Tooltip formatter={(v) => [`${fmt(Number(v))}원`, "지출"]} />
              <Bar dataKey="total" fill={COLORS.primary} radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* 최근 전표 */}
      <div className={styles.section}>
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
                  {j.lines
                    .reduce((s, l) => s + Number(l.debit), 0)
                    .toLocaleString()}
                  원
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
    </div>
  );
}
