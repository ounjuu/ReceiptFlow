"use client";

import styles from "./Approvals.module.css";
import {
  DOC_TYPE_LABEL,
  STATUS_LABEL,
  type PendingApproval,
  type Submission,
} from "./types";

// --- 결재 대기 테이블 ---

export interface PendingTableProps {
  pendingApprovals: PendingApproval[];
  comments: Record<string, string>;
  onCommentChange: (id: string, value: string) => void;
  onProcess: (requestId: string, action: string) => void;
  isProcessing: boolean;
}

export function PendingTable({
  pendingApprovals,
  comments,
  onCommentChange,
  onProcess,
  isProcessing,
}: PendingTableProps) {
  return (
    <div className={styles.section}>
      <h2 className={styles.sectionTitle}>결재 대기 목록</h2>
      <table>
        <thead>
          <tr>
            <th>문서유형</th>
            <th>내용</th>
            <th>요청자</th>
            <th>요청일</th>
            <th>결재 단계</th>
            <th>처리</th>
          </tr>
        </thead>
        <tbody>
          {pendingApprovals.map((a) => (
            <tr key={a.id}>
              <td>
                <span
                  className={`${styles.badge} ${
                    a.documentType === "JOURNAL"
                      ? styles.badgeJournal
                      : styles.badgeTaxInvoice
                  }`}
                >
                  {DOC_TYPE_LABEL[a.documentType] || a.documentType}
                </span>
              </td>
              <td>
                {a.documentInfo.description ||
                  (a.documentInfo.date
                    ? new Date(a.documentInfo.date).toLocaleDateString("ko-KR")
                    : "-")}
              </td>
              <td>{a.submitterName}</td>
              <td>{new Date(a.createdAt).toLocaleDateString("ko-KR")}</td>
              <td>
                {a.currentStep}/{a.totalSteps}단계
              </td>
              <td>
                <div className={styles.actionArea}>
                  <input
                    className={styles.commentInput}
                    placeholder="의견 (선택)"
                    value={comments[a.id] || ""}
                    onChange={(e) => onCommentChange(a.id, e.target.value)}
                  />
                  <button
                    className={styles.approveBtn}
                    onClick={() => onProcess(a.id, "APPROVED")}
                    disabled={isProcessing}
                  >
                    승인
                  </button>
                  <button
                    className={styles.rejectBtn}
                    onClick={() => onProcess(a.id, "REJECTED")}
                    disabled={isProcessing}
                  >
                    반려
                  </button>
                </div>
              </td>
            </tr>
          ))}
          {pendingApprovals.length === 0 && (
            <tr>
              <td
                colSpan={6}
                style={{ textAlign: "center", color: "var(--text-muted)" }}
              >
                결재 대기 건이 없습니다
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

// --- 내 결재 현황 테이블 ---

export interface SubmissionsTableProps {
  submissions: Submission[];
}

export function SubmissionsTable({ submissions }: SubmissionsTableProps) {
  return (
    <div className={styles.section}>
      <h2 className={styles.sectionTitle}>내 결재 요청 현황</h2>
      <table>
        <thead>
          <tr>
            <th>문서유형</th>
            <th>내용</th>
            <th>요청일</th>
            <th>진행 상태</th>
            <th>결재 흐름</th>
          </tr>
        </thead>
        <tbody>
          {submissions.map((s) => (
            <tr key={s.id}>
              <td>
                <span
                  className={`${styles.badge} ${
                    s.documentType === "JOURNAL"
                      ? styles.badgeJournal
                      : styles.badgeTaxInvoice
                  }`}
                >
                  {DOC_TYPE_LABEL[s.documentType] || s.documentType}
                </span>
              </td>
              <td>
                {s.documentInfo.description ||
                  (s.documentInfo.date
                    ? new Date(s.documentInfo.date).toLocaleDateString("ko-KR")
                    : "-")}
              </td>
              <td>{new Date(s.createdAt).toLocaleDateString("ko-KR")}</td>
              <td>
                <span
                  className={`${styles.badge} ${
                    s.status === "PENDING"
                      ? styles.badgePending
                      : s.status === "APPROVED"
                        ? styles.badgeApproved
                        : styles.badgeRejected
                  }`}
                >
                  {STATUS_LABEL[s.status] || s.status}
                </span>
                {s.status === "PENDING" && (
                  <span
                    style={{
                      marginLeft: "8px",
                      fontSize: "0.8rem",
                      color: "var(--text-muted)",
                    }}
                  >
                    ({s.currentStep}/{s.totalSteps}단계)
                  </span>
                )}
              </td>
              <td>
                <div className={styles.flowSteps}>
                  {Array.from({ length: s.totalSteps }, (_, i) => {
                    const step = i + 1;
                    const actionForStep = s.actions.find(
                      (a) => a.step === step,
                    );
                    let cls = styles.flowStepWaiting;
                    let label = `${step}단계`;

                    if (actionForStep) {
                      if (actionForStep.action === "APPROVED") {
                        cls = styles.flowStepDone;
                        label = `${actionForStep.approver.name} ✓`;
                      } else {
                        cls = styles.flowStepWaiting;
                        label = `${actionForStep.approver.name} ✗`;
                      }
                    } else if (
                      step === s.currentStep &&
                      s.status === "PENDING"
                    ) {
                      cls = styles.flowStepCurrent;
                    }

                    return (
                      <span key={step}>
                        {step > 1 && (
                          <span className={styles.flowArrow}> → </span>
                        )}
                        <span className={`${styles.flowStep} ${cls}`}>
                          {label}
                        </span>
                      </span>
                    );
                  })}
                </div>
              </td>
            </tr>
          ))}
          {submissions.length === 0 && (
            <tr>
              <td
                colSpan={5}
                style={{ textAlign: "center", color: "var(--text-muted)" }}
              >
                결재 요청 내역이 없습니다
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
