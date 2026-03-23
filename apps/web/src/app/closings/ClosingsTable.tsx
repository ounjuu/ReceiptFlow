"use client";

import type { AccountingPeriod } from "./types";
import styles from "./Closings.module.css";

interface ClosingsTableProps {
  periods: AccountingPeriod[];
}

export default function ClosingsTable({ periods }: ClosingsTableProps) {
  if (periods.length === 0) {
    return <p className={styles.empty}>마감 이력이 없습니다</p>;
  }

  return (
    <table>
      <thead>
        <tr>
          <th>기간</th>
          <th>상태</th>
          <th>마감일</th>
        </tr>
      </thead>
      <tbody>
        {periods.map((p) => (
          <tr key={p.id}>
            <td>
              {p.year}년 {p.month}월
            </td>
            <td>
              <span
                style={{
                  color: p.status === "CLOSED" ? "#d95454" : "#7c5cbf",
                  fontWeight: 600,
                }}
              >
                {p.status === "CLOSED" ? "🔒 마감" : "🔓 미마감"}
              </span>
            </td>
            <td>
              {p.closedAt
                ? new Date(p.closedAt).toLocaleDateString("ko-KR")
                : "-"}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
