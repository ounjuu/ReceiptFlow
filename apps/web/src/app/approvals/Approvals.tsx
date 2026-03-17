"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost, apiPut } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import styles from "./Approvals.module.css";

interface ApprovalLine {
  id: string;
  documentType: string;
  step: number;
  approverId: string;
  approver: { id: string; name: string; email: string };
}

interface ApprovalActionItem {
  id: string;
  step: number;
  approverId: string;
  approver: { id: string; name: string };
  action: string;
  comment: string | null;
  createdAt: string;
}

interface PendingApproval {
  id: string;
  documentType: string;
  documentId: string;
  currentStep: number;
  totalSteps: number;
  status: string;
  submittedBy: string;
  submitterName: string;
  createdAt: string;
  documentInfo: { description: string; date: string };
  actions: ApprovalActionItem[];
}

interface Submission {
  id: string;
  documentType: string;
  documentId: string;
  currentStep: number;
  totalSteps: number;
  status: string;
  createdAt: string;
  documentInfo: { description: string; date: string };
  actions: ApprovalActionItem[];
}

interface Member {
  id: string;
  userId: string;
  email: string;
  name: string;
  role: string;
}

const DOC_TYPE_LABEL: Record<string, string> = {
  JOURNAL: "전표",
  TAX_INVOICE: "세금계산서",
  EXPENSE_CLAIM: "경비 정산",
};

const STATUS_LABEL: Record<string, string> = {
  PENDING: "진행중",
  APPROVED: "승인완료",
  REJECTED: "반려",
};

export default function ApprovalsPage() {
  const { tenantId, user, isAdmin } = useAuth();
  const queryClient = useQueryClient();

  const [tab, setTab] = useState<"pending" | "submissions" | "settings">("pending");
  const [comments, setComments] = useState<Record<string, string>>({});

  // 결재선 설정용
  const [lineDocType, setLineDocType] = useState("JOURNAL");
  const [newApproverId, setNewApproverId] = useState("");

  // 내 결재 대기
  const { data: pendingApprovals = [] } = useQuery({
    queryKey: ["approvals-pending"],
    queryFn: () =>
      apiGet<PendingApproval[]>(`/approvals/pending?tenantId=${tenantId}`),
    enabled: !!tenantId,
  });

  // 내 결재 요청 현황
  const { data: submissions = [] } = useQuery({
    queryKey: ["approvals-submissions"],
    queryFn: () =>
      apiGet<Submission[]>(`/approvals/submissions?tenantId=${tenantId}`),
    enabled: !!tenantId,
  });

  // 결재선 조회
  const { data: approvalLines = [] } = useQuery({
    queryKey: ["approval-lines"],
    queryFn: () =>
      apiGet<ApprovalLine[]>(`/approvals/lines?tenantId=${tenantId}`),
    enabled: !!tenantId,
  });

  // 멤버 목록 (결재자 선택용)
  const { data: members = [] } = useQuery({
    queryKey: ["members"],
    queryFn: () => apiGet<Member[]>(`/auth/members?tenantId=${tenantId}`),
    enabled: !!tenantId && isAdmin,
  });

  // 승인/반려
  const processMutation = useMutation({
    mutationFn: ({
      requestId,
      action,
      comment,
    }: {
      requestId: string;
      action: string;
      comment?: string;
    }) => apiPost(`/approvals/${requestId}/process`, { action, comment }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["approvals-pending"] });
      queryClient.invalidateQueries({ queryKey: ["approvals-submissions"] });
      setComments({});
    },
  });

  // 결재선 설정
  const setLinesMutation = useMutation({
    mutationFn: (data: {
      tenantId: string;
      documentType: string;
      lines: { step: number; approverId: string }[];
    }) => apiPut("/approvals/lines", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["approval-lines"] });
    },
  });

  const handleProcess = (requestId: string, action: string) => {
    processMutation.mutate({
      requestId,
      action,
      comment: comments[requestId] || undefined,
    });
  };

  const filteredLines = approvalLines.filter(
    (l) => l.documentType === lineDocType,
  );

  const handleAddLine = () => {
    if (!newApproverId) return;
    const currentLines = filteredLines.map((l) => ({
      step: l.step,
      approverId: l.approverId,
    }));
    currentLines.push({
      step: currentLines.length + 1,
      approverId: newApproverId,
    });
    setLinesMutation.mutate({
      tenantId: tenantId!,
      documentType: lineDocType,
      lines: currentLines,
    });
    setNewApproverId("");
  };

  const handleRemoveLine = (step: number) => {
    const currentLines = filteredLines
      .filter((l) => l.step !== step)
      .map((l, i) => ({
        step: i + 1,
        approverId: l.approverId,
      }));
    setLinesMutation.mutate({
      tenantId: tenantId!,
      documentType: lineDocType,
      lines: currentLines,
    });
  };

  return (
    <div>
      <h1 className={styles.title}>전자결재</h1>
      <p className={styles.subtitle}>
        결재 요청을 확인하고 승인/반려 처리하세요
      </p>

      {/* 요약 카드 */}
      <div className={styles.summaryCards}>
        <div className={styles.summaryCard}>
          <div className={styles.summaryLabel}>결재 대기</div>
          <div className={styles.summaryValue}>{pendingApprovals.length}건</div>
        </div>
        <div className={styles.summaryCard}>
          <div className={styles.summaryLabel}>내 요청 (진행중)</div>
          <div className={styles.summaryValue}>
            {submissions.filter((s) => s.status === "PENDING").length}건
          </div>
        </div>
        <div className={styles.summaryCard}>
          <div className={styles.summaryLabel}>내 요청 (완료)</div>
          <div className={styles.summaryValue}>
            {submissions.filter((s) => s.status !== "PENDING").length}건
          </div>
        </div>
      </div>

      {/* 탭 */}
      <div className={styles.tabs}>
        <button
          className={`${styles.tab} ${tab === "pending" ? styles.tabActive : ""}`}
          onClick={() => setTab("pending")}
        >
          결재 대기 ({pendingApprovals.length})
        </button>
        <button
          className={`${styles.tab} ${tab === "submissions" ? styles.tabActive : ""}`}
          onClick={() => setTab("submissions")}
        >
          내 결재 현황
        </button>
        {isAdmin && (
          <button
            className={`${styles.tab} ${tab === "settings" ? styles.tabActive : ""}`}
            onClick={() => setTab("settings")}
          >
            결재선 설정
          </button>
        )}
      </div>

      {/* 결재 대기 */}
      {tab === "pending" && (
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
                        ? new Date(a.documentInfo.date).toLocaleDateString(
                            "ko-KR",
                          )
                        : "-")}
                  </td>
                  <td>{a.submitterName}</td>
                  <td>
                    {new Date(a.createdAt).toLocaleDateString("ko-KR")}
                  </td>
                  <td>
                    {a.currentStep}/{a.totalSteps}단계
                  </td>
                  <td>
                    <div className={styles.actionArea}>
                      <input
                        className={styles.commentInput}
                        placeholder="의견 (선택)"
                        value={comments[a.id] || ""}
                        onChange={(e) =>
                          setComments((prev) => ({
                            ...prev,
                            [a.id]: e.target.value,
                          }))
                        }
                      />
                      <button
                        className={styles.approveBtn}
                        onClick={() => handleProcess(a.id, "APPROVED")}
                        disabled={processMutation.isPending}
                      >
                        승인
                      </button>
                      <button
                        className={styles.rejectBtn}
                        onClick={() => handleProcess(a.id, "REJECTED")}
                        disabled={processMutation.isPending}
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
      )}

      {/* 내 결재 현황 */}
      {tab === "submissions" && (
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
                        ? new Date(s.documentInfo.date).toLocaleDateString(
                            "ko-KR",
                          )
                        : "-")}
                  </td>
                  <td>
                    {new Date(s.createdAt).toLocaleDateString("ko-KR")}
                  </td>
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
                        } else if (step === s.currentStep && s.status === "PENDING") {
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
      )}

      {/* 결재선 설정 */}
      {tab === "settings" && isAdmin && (
        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>결재선 설정</h2>
          </div>

          <div className={styles.formRow} style={{ marginBottom: "16px" }}>
            <span className={styles.formLabel}>문서 유형</span>
            <select
              className={styles.formSelect}
              value={lineDocType}
              onChange={(e) => setLineDocType(e.target.value)}
            >
              <option value="JOURNAL">전표</option>
              <option value="TAX_INVOICE">세금계산서</option>
              <option value="EXPENSE_CLAIM">경비 정산</option>
            </select>
          </div>

          <div className={styles.lineList}>
            {filteredLines.map((l) => (
              <div key={l.id} className={styles.lineItem}>
                <span className={styles.lineStep}>{l.step}단계</span>
                <span className={styles.lineName}>
                  {l.approver.name} ({l.approver.email})
                </span>
                <button
                  className={styles.lineRemove}
                  onClick={() => handleRemoveLine(l.step)}
                >
                  ×
                </button>
              </div>
            ))}
            {filteredLines.length === 0 && (
              <p style={{ color: "var(--text-muted)", fontSize: "0.9rem" }}>
                결재선이 설정되지 않았습니다. 결재선이 없으면 기존 방식(직접
                상태 변경)으로 동작합니다.
              </p>
            )}
          </div>

          <div className={styles.formRow}>
            <span className={styles.formLabel}>결재자 추가</span>
            <select
              className={styles.formSelect}
              value={newApproverId}
              onChange={(e) => setNewApproverId(e.target.value)}
            >
              <option value="">선택</option>
              {members
                .filter((m) => m.role !== "VIEWER")
                .map((m) => (
                  <option key={m.userId} value={m.userId}>
                    {m.name} ({m.email}) - {m.role}
                  </option>
                ))}
            </select>
            <button
              className={styles.primaryBtn}
              onClick={handleAddLine}
              disabled={!newApproverId || setLinesMutation.isPending}
            >
              추가
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
