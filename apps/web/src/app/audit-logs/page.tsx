"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiGet } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import styles from "./page.module.css";

interface AuditLog {
  id: string;
  userId: string;
  action: string;
  entityType: string;
  entityId: string;
  description: string | null;
  createdAt: string;
}

interface AuditLogResponse {
  data: AuditLog[];
  total: number;
  limit: number;
  offset: number;
}

const ACTION_LABELS: Record<string, { label: string; cls: string }> = {
  JOURNAL_CREATED: { label: "전표 생성", cls: styles.actionCreate },
  JOURNAL_UPDATED: { label: "전표 수정", cls: styles.actionUpdate },
  JOURNAL_STATUS_CHANGED: { label: "상태 변경", cls: styles.actionUpdate },
  JOURNAL_DELETED: { label: "전표 삭제", cls: styles.actionDelete },
  JOURNAL_BATCH_STATUS: { label: "일괄 변경", cls: styles.actionUpdate },
  PERIOD_CLOSED: { label: "월 마감", cls: styles.actionClose },
  PERIOD_REOPENED: { label: "마감 취소", cls: styles.actionDelete },
};

const PAGE_SIZE = 30;

export default function AuditLogsPage() {
  const { tenantId, isAdmin } = useAuth();
  const [action, setAction] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [offset, setOffset] = useState(0);

  const params = new URLSearchParams({ tenantId: tenantId || "" });
  if (action) params.set("action", action);
  if (startDate) params.set("startDate", startDate);
  if (endDate) params.set("endDate", endDate);
  params.set("limit", String(PAGE_SIZE));
  params.set("offset", String(offset));

  const { data } = useQuery({
    queryKey: ["audit-logs", action, startDate, endDate, offset],
    queryFn: () => apiGet<AuditLogResponse>(`/audit-logs?${params.toString()}`),
    enabled: isAdmin,
  });

  const logs = data?.data || [];
  const total = data?.total || 0;

  if (!isAdmin) {
    return (
      <div>
        <h1 className={styles.title}>감사 로그</h1>
        <p className={styles.empty}>관리자만 접근할 수 있습니다.</p>
      </div>
    );
  }

  return (
    <div>
      <h1 className={styles.title}>감사 로그</h1>

      {/* 필터 */}
      <div className={styles.filters}>
        <div className={styles.formRow}>
          <span className={styles.label}>작업 유형</span>
          <select
            className={styles.select}
            value={action}
            onChange={(e) => { setAction(e.target.value); setOffset(0); }}
          >
            <option value="">전체</option>
            <option value="JOURNAL_CREATED">전표 생성</option>
            <option value="JOURNAL_UPDATED">전표 수정</option>
            <option value="JOURNAL_STATUS_CHANGED">상태 변경</option>
            <option value="JOURNAL_DELETED">전표 삭제</option>
            <option value="JOURNAL_BATCH_STATUS">일괄 변경</option>
            <option value="PERIOD_CLOSED">월 마감</option>
            <option value="PERIOD_REOPENED">마감 취소</option>
          </select>
        </div>
        <div className={styles.formRow}>
          <span className={styles.label}>시작일</span>
          <input
            className={styles.filterInput}
            type="date"
            value={startDate}
            onChange={(e) => { setStartDate(e.target.value); setOffset(0); }}
          />
        </div>
        <div className={styles.formRow}>
          <span className={styles.label}>종료일</span>
          <input
            className={styles.filterInput}
            type="date"
            value={endDate}
            onChange={(e) => { setEndDate(e.target.value); setOffset(0); }}
          />
        </div>
        {(action || startDate || endDate) && (
          <button
            className={styles.clearBtn}
            onClick={() => { setAction(""); setStartDate(""); setEndDate(""); setOffset(0); }}
          >
            초기화
          </button>
        )}
      </div>

      {/* 테이블 */}
      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>작업 이력 ({total}건)</h2>
        {logs.length > 0 ? (
          <>
            <table>
              <thead>
                <tr>
                  <th>시간</th>
                  <th>작업</th>
                  <th>대상</th>
                  <th>설명</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => {
                  const info = ACTION_LABELS[log.action] || { label: log.action, cls: "" };
                  return (
                    <tr key={log.id}>
                      <td style={{ whiteSpace: "nowrap" }}>
                        {new Date(log.createdAt).toLocaleString("ko-KR")}
                      </td>
                      <td>
                        <span className={`${styles.actionBadge} ${info.cls}`}>
                          {info.label}
                        </span>
                      </td>
                      <td style={{ fontSize: "0.85rem" }}>{log.entityType}</td>
                      <td>{log.description || "-"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* 페이지네이션 */}
            <div className={styles.pagination}>
              <span className={styles.pageInfo}>
                {offset + 1} - {Math.min(offset + PAGE_SIZE, total)} / {total}건
              </span>
              <div className={styles.pageButtons}>
                <button
                  className={styles.pageBtn}
                  disabled={offset === 0}
                  onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
                >
                  이전
                </button>
                <button
                  className={styles.pageBtn}
                  disabled={offset + PAGE_SIZE >= total}
                  onClick={() => setOffset(offset + PAGE_SIZE)}
                >
                  다음
                </button>
              </div>
            </div>
          </>
        ) : (
          <p className={styles.empty}>감사 로그가 없습니다</p>
        )}
      </div>
    </div>
  );
}
