"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost, apiPut } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import styles from "./Approvals.module.css";
import type { PendingApproval, Submission, ApprovalLine, Member } from "./types";
import { PendingTable, SubmissionsTable } from "./ApprovalTable";
import { ApprovalForm } from "./ApprovalForm";

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

  const handleCommentChange = (id: string, value: string) => {
    setComments((prev) => ({ ...prev, [id]: value }));
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
        <PendingTable
          pendingApprovals={pendingApprovals}
          comments={comments}
          onCommentChange={handleCommentChange}
          onProcess={handleProcess}
          isProcessing={processMutation.isPending}
        />
      )}

      {/* 내 결재 현황 */}
      {tab === "submissions" && (
        <SubmissionsTable submissions={submissions} />
      )}

      {/* 결재선 설정 */}
      {tab === "settings" && isAdmin && (
        <ApprovalForm
          lineDocType={lineDocType}
          onLineDocTypeChange={setLineDocType}
          filteredLines={filteredLines}
          members={members}
          newApproverId={newApproverId}
          onNewApproverIdChange={setNewApproverId}
          onAddLine={handleAddLine}
          onRemoveLine={handleRemoveLine}
          isSaving={setLinesMutation.isPending}
        />
      )}
    </div>
  );
}
