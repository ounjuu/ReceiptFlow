"use client";

import { useQuery } from "@tanstack/react-query";
import { apiGet, TENANT_ID } from "@/lib/api";
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

export default function DashboardPage() {
  const { data: documents = [] } = useQuery({
    queryKey: ["documents"],
    queryFn: () => apiGet<Document[]>(`/documents?tenantId=${TENANT_ID}`),
  });

  const { data: journals = [] } = useQuery({
    queryKey: ["journals"],
    queryFn: () => apiGet<JournalEntry[]>(`/journals?tenantId=${TENANT_ID}`),
  });

  const totalSpent = documents.reduce(
    (sum, d) => sum + (d.totalAmount ? Number(d.totalAmount) : 0),
    0,
  );

  const recentJournals = journals.slice(0, 5);

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
          <div className={styles.cardValue}>
            {totalSpent.toLocaleString()}원
          </div>
        </div>
        <div className={styles.card}>
          <div className={styles.cardLabel}>총 전표</div>
          <div className={styles.cardValue}>{journals.length}건</div>
        </div>
      </div>

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
