"use client";

import { useQuery } from "@tanstack/react-query";
import { apiGet, TENANT_ID } from "@/lib/api";
import styles from "./page.module.css";

interface JournalEntry {
  id: string;
  date: string;
  description: string | null;
  status: string;
  documentId: string | null;
  lines: { debit: string; credit: string; account: { code: string; name: string } }[];
}

function statusLabel(status: string) {
  switch (status) {
    case "DRAFT": return { text: "임시", cls: styles.statusDraft };
    case "APPROVED": return { text: "승인", cls: styles.statusApproved };
    case "POSTED": return { text: "확정", cls: styles.statusPosted };
    default: return { text: status, cls: "" };
  }
}

export default function JournalsPage() {
  const { data: journals = [] } = useQuery({
    queryKey: ["journals"],
    queryFn: () => apiGet<JournalEntry[]>(`/journals?tenantId=${TENANT_ID}`),
  });

  return (
    <div>
      <h1 className={styles.title}>전표 관리</h1>

      <div className={styles.tableSection}>
        <table>
          <thead>
            <tr>
              <th>날짜</th>
              <th>설명</th>
              <th>상태</th>
              <th>차변 합계</th>
              <th>대변 합계</th>
              <th>영수증 연결</th>
            </tr>
          </thead>
          <tbody>
            {journals.map((j) => {
              const s = statusLabel(j.status);
              const totalDebit = j.lines.reduce((sum, l) => sum + Number(l.debit), 0);
              const totalCredit = j.lines.reduce((sum, l) => sum + Number(l.credit), 0);
              return (
                <tr key={j.id}>
                  <td>{new Date(j.date).toLocaleDateString("ko-KR")}</td>
                  <td>{j.description || "-"}</td>
                  <td>
                    <span className={`${styles.status} ${s.cls}`}>{s.text}</span>
                  </td>
                  <td>{totalDebit.toLocaleString()}원</td>
                  <td>{totalCredit.toLocaleString()}원</td>
                  <td>{j.documentId ? "O" : "-"}</td>
                </tr>
              );
            })}
            {journals.length === 0 && (
              <tr>
                <td colSpan={6} style={{ textAlign: "center", color: "var(--text-muted)" }}>
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
