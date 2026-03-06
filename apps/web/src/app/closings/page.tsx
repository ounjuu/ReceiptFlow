"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost, apiPatch } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import styles from "./page.module.css";

interface PeriodSummary {
  total: number;
  posted: number;
  draft: number;
  approved: number;
  unposted: number;
}

interface AccountingPeriod {
  id: string;
  year: number;
  month: number;
  status: string;
  closedAt: string | null;
  closedBy: string | null;
}

const now = new Date();

export default function ClosingsPage() {
  const { tenantId, isAdmin, role } = useAuth();
  const queryClient = useQueryClient();

  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);

  const canClose = role === "ADMIN" || role === "ACCOUNTANT";

  // 전표 현황 조회
  const { data: summary } = useQuery({
    queryKey: ["closing-summary", year, month],
    queryFn: () =>
      apiGet<PeriodSummary>(
        `/closings/summary?tenantId=${tenantId}&year=${year}&month=${month}`,
      ),
  });

  // 마감 이력 조회
  const { data: periods = [] } = useQuery({
    queryKey: ["closing-periods"],
    queryFn: () =>
      apiGet<AccountingPeriod[]>(`/closings?tenantId=${tenantId}`),
  });

  // 현재 선택 월의 마감 상태
  const currentPeriod = periods.find(
    (p) => p.year === year && p.month === month,
  );
  const isClosed = currentPeriod?.status === "CLOSED";

  // 마감 실행
  const closeMut = useMutation({
    mutationFn: () =>
      apiPost("/closings", { tenantId, year, month }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["closing-periods"] });
      queryClient.invalidateQueries({ queryKey: ["closing-summary"] });
    },
  });

  // 마감 취소
  const reopenMut = useMutation({
    mutationFn: () =>
      apiPatch(`/closings/${currentPeriod!.id}/reopen`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["closing-periods"] });
      queryClient.invalidateQueries({ queryKey: ["closing-summary"] });
    },
  });

  const years = Array.from({ length: 5 }, (_, i) => now.getFullYear() - 2 + i);
  const months = Array.from({ length: 12 }, (_, i) => i + 1);

  return (
    <div>
      <h1 className={styles.title}>결산 관리</h1>

      {/* 기간 선택 */}
      <div className={styles.controls}>
        <div className={styles.formRow}>
          <span className={styles.label}>연도</span>
          <select
            className={styles.select}
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
          >
            {years.map((y) => (
              <option key={y} value={y}>
                {y}년
              </option>
            ))}
          </select>
        </div>
        <div className={styles.formRow}>
          <span className={styles.label}>월</span>
          <select
            className={styles.select}
            value={month}
            onChange={(e) => setMonth(Number(e.target.value))}
          >
            {months.map((m) => (
              <option key={m} value={m}>
                {m}월
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* 전표 현황 카드 */}
      <div className={styles.summaryCards}>
        <div className={styles.card}>
          <div className={styles.cardLabel}>총 전표</div>
          <div className={styles.cardValue}>{summary?.total ?? "-"}건</div>
        </div>
        <div className={styles.card}>
          <div className={styles.cardLabel}>확정(POSTED)</div>
          <div className={styles.cardValue} style={{ color: "#4caf82" }}>
            {summary?.posted ?? "-"}건
          </div>
        </div>
        <div className={styles.card}>
          <div className={styles.cardLabel}>초안(DRAFT)</div>
          <div className={styles.cardValue} style={{ color: "#e5a336" }}>
            {summary?.draft ?? "-"}건
          </div>
        </div>
        <div className={styles.card}>
          <div className={styles.cardLabel}>승인대기(APPROVED)</div>
          <div className={styles.cardValue} style={{ color: "#7c5cbf" }}>
            {summary?.approved ?? "-"}건
          </div>
        </div>
      </div>

      {/* 마감 상태 & 액션 */}
      <div className={styles.actionSection}>
        <div>
          <span
            className={`${styles.statusBadge} ${isClosed ? styles.statusClosed : styles.statusOpen}`}
          >
            {isClosed ? "🔒" : "🔓"} {year}년 {month}월 -{" "}
            {isClosed ? "마감됨" : "미마감"}
          </span>
          {isClosed && currentPeriod?.closedAt && (
            <span style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginLeft: 12 }}>
              (마감일: {new Date(currentPeriod.closedAt).toLocaleDateString("ko-KR")})
            </span>
          )}
        </div>
        <div>
          {!isClosed && canClose && (
            <button
              className={styles.closeBtn}
              disabled={closeMut.isPending || (summary != null && summary.unposted > 0)}
              onClick={() => {
                if (confirm(`${year}년 ${month}월을 마감하시겠습니까?\n마감 후 해당 기간의 전표를 수정/삭제할 수 없습니다.`)) {
                  closeMut.mutate();
                }
              }}
            >
              {closeMut.isPending ? "처리 중..." : "월 마감"}
            </button>
          )}
          {isClosed && isAdmin && (
            <button
              className={styles.reopenBtn}
              disabled={reopenMut.isPending}
              onClick={() => {
                if (confirm(`${year}년 ${month}월 마감을 취소하시겠습니까?`)) {
                  reopenMut.mutate();
                }
              }}
            >
              {reopenMut.isPending ? "처리 중..." : "마감 취소"}
            </button>
          )}
        </div>
      </div>

      {/* 에러 메시지 */}
      {closeMut.isError && (
        <p className={styles.error}>
          {(closeMut.error as Error).message}
        </p>
      )}
      {reopenMut.isError && (
        <p className={styles.error}>
          {(reopenMut.error as Error).message}
        </p>
      )}
      {!isClosed && summary && summary.unposted > 0 && (
        <p className={styles.error}>
          미확정 전표가 {summary.unposted}건 있습니다. 모든 전표를 확정(POSTED)한 후 마감할 수 있습니다.
        </p>
      )}

      {/* 마감 이력 */}
      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>마감 이력</h2>
        {periods.length > 0 ? (
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
        ) : (
          <p className={styles.empty}>마감 이력이 없습니다</p>
        )}
      </div>
    </div>
  );
}
