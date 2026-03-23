"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost, apiPatch, apiDelete } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { exportToXlsx } from "@/lib/export-xlsx";
import styles from "./Projects.module.css";
import { Project, PnLResult, ComparisonRow, fmt, statusLabel } from "./types";
import ProjectForm from "./ProjectForm";
import { ProjectListTable, ProjectPnL, ProjectComparison } from "./ProjectTable";

export default function ProjectsPage() {
  const { tenantId, canEdit, canDelete } = useAuth();
  const queryClient = useQueryClient();

  const [tab, setTab] = useState<"manage" | "pnl" | "compare">("manage");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // 관리 폼
  const [formCode, setFormCode] = useState("");
  const [formName, setFormName] = useState("");
  const [formDesc, setFormDesc] = useState("");
  const [formStartDate, setFormStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [formEndDate, setFormEndDate] = useState("");
  const [formManager, setFormManager] = useState("");
  const [formBudget, setFormBudget] = useState("");
  const [formStatus, setFormStatus] = useState("ACTIVE");
  const [formError, setFormError] = useState("");

  // 손익 탭
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [pnlStartDate, setPnlStartDate] = useState("");
  const [pnlEndDate, setPnlEndDate] = useState("");

  // 프로젝트 목록
  const { data: projects = [] } = useQuery({
    queryKey: ["projects"],
    queryFn: () => apiGet<Project[]>(`/projects?tenantId=${tenantId}`),
    enabled: !!tenantId,
  });

  // 프로젝트 손익
  const { data: pnlData } = useQuery({
    queryKey: ["project-pnl", selectedProjectId, pnlStartDate, pnlEndDate],
    queryFn: () => {
      let url = `/projects/${selectedProjectId}/pnl?tenantId=${tenantId}`;
      if (pnlStartDate) url += `&startDate=${pnlStartDate}`;
      if (pnlEndDate) url += `&endDate=${pnlEndDate}`;
      return apiGet<PnLResult>(url);
    },
    enabled: !!tenantId && !!selectedProjectId && tab === "pnl",
  });

  // 프로젝트 비교
  const { data: comparison = [] } = useQuery({
    queryKey: ["project-comparison"],
    queryFn: () => apiGet<ComparisonRow[]>(`/projects/pnl/comparison?tenantId=${tenantId}`),
    enabled: !!tenantId && tab === "compare",
  });

  // 등록
  const createMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => apiPost("/projects", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      resetForm();
    },
    onError: (err: Error) => setFormError(err.message),
  });

  // 수정
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      apiPatch(`/projects/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      queryClient.invalidateQueries({ queryKey: ["project-comparison"] });
      resetForm();
    },
    onError: (err: Error) => setFormError(err.message),
  });

  // 삭제
  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiDelete(`/projects/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      queryClient.invalidateQueries({ queryKey: ["project-comparison"] });
    },
  });

  const resetForm = () => {
    setShowForm(false);
    setEditingId(null);
    setFormCode("");
    setFormName("");
    setFormDesc("");
    setFormStartDate(new Date().toISOString().slice(0, 10));
    setFormEndDate("");
    setFormManager("");
    setFormBudget("");
    setFormStatus("ACTIVE");
    setFormError("");
  };

  const startEdit = (p: Project) => {
    setEditingId(p.id);
    setShowForm(true);
    setFormCode(p.code);
    setFormName(p.name);
    setFormDesc(p.description || "");
    setFormStartDate(new Date(p.startDate).toISOString().slice(0, 10));
    setFormEndDate(p.endDate ? new Date(p.endDate).toISOString().slice(0, 10) : "");
    setFormManager(p.manager || "");
    setFormBudget(p.budget != null ? String(p.budget) : "");
    setFormStatus(p.status);
    setFormError("");
  };

  const handleSubmit = () => {
    setFormError("");
    if (!formCode || !formName || !formStartDate) {
      setFormError("코드, 이름, 시작일은 필수입니다");
      return;
    }

    if (editingId) {
      updateMutation.mutate({
        id: editingId,
        data: {
          name: formName,
          description: formDesc || undefined,
          status: formStatus,
          endDate: formEndDate || undefined,
          manager: formManager || undefined,
          budget: formBudget ? Number(formBudget) : undefined,
        },
      });
    } else {
      createMutation.mutate({
        tenantId,
        code: formCode,
        name: formName,
        description: formDesc || undefined,
        startDate: formStartDate,
        endDate: formEndDate || undefined,
        manager: formManager || undefined,
        budget: formBudget ? Number(formBudget) : undefined,
      });
    }
  };

  // 비교 탭 요약
  const totalRevAll = comparison.reduce((s, r) => s + r.totalRevenue, 0);
  const totalExpAll = comparison.reduce((s, r) => s + r.totalExpense, 0);
  const totalNetAll = comparison.reduce((s, r) => s + r.netIncome, 0);

  const exportComparison = () => {
    if (comparison.length === 0) return;
    exportToXlsx(
      "프로젝트별_손익비교",
      "프로젝트비교",
      ["코드", "프로젝트명", "상태", "예산", "총수익", "총비용", "순이익", "이익률(%)"],
      comparison.map((r) => [
        r.code,
        r.name,
        statusLabel(r.status).text,
        r.budget ?? "-",
        r.totalRevenue,
        r.totalExpense,
        r.netIncome,
        r.profitMargin,
      ]),
    );
  };

  const selectedProject = projects.find((p) => p.id === selectedProjectId);
  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <div>
      <h1 className={styles.title}>프로젝트 손익</h1>
      <p className={styles.subtitle}>
        프로젝트별 수익/비용을 추적하고 손익을 분석합니다
      </p>

      {/* 요약 카드 */}
      <div className={styles.summaryCards}>
        <div className={styles.summaryCard}>
          <div className={styles.summaryLabel}>전체 프로젝트</div>
          <div className={styles.summaryValue}>{projects.length}개</div>
        </div>
        <div className={styles.summaryCard}>
          <div className={styles.summaryLabel}>총 수익</div>
          <div className={`${styles.summaryValue} ${styles.summaryPositive}`}>
            {fmt(totalRevAll)}원
          </div>
        </div>
        <div className={styles.summaryCard}>
          <div className={styles.summaryLabel}>총 비용</div>
          <div className={styles.summaryValue}>{fmt(totalExpAll)}원</div>
        </div>
        <div className={styles.summaryCard}>
          <div className={styles.summaryLabel}>총 순이익</div>
          <div className={`${styles.summaryValue} ${totalNetAll >= 0 ? styles.summaryPositive : styles.summaryNegative}`}>
            {fmt(totalNetAll)}원
          </div>
        </div>
      </div>

      {/* 탭 */}
      <div className={styles.tabs}>
        <button
          className={`${styles.tab} ${tab === "manage" ? styles.tabActive : ""}`}
          onClick={() => setTab("manage")}
        >
          프로젝트 관리
        </button>
        <button
          className={`${styles.tab} ${tab === "pnl" ? styles.tabActive : ""}`}
          onClick={() => setTab("pnl")}
        >
          프로젝트 손익
        </button>
        <button
          className={`${styles.tab} ${tab === "compare" ? styles.tabActive : ""}`}
          onClick={() => setTab("compare")}
        >
          프로젝트 비교
        </button>
      </div>

      {/* 프로젝트 관리 탭 */}
      {tab === "manage" && (
        <div className={styles.section}>
          <ProjectForm
            showForm={showForm}
            editingId={editingId}
            formCode={formCode}
            formName={formName}
            formDesc={formDesc}
            formStartDate={formStartDate}
            formEndDate={formEndDate}
            formManager={formManager}
            formBudget={formBudget}
            formStatus={formStatus}
            formError={formError}
            isPending={isPending}
            canEdit={canEdit}
            onFormCodeChange={setFormCode}
            onFormNameChange={setFormName}
            onFormDescChange={setFormDesc}
            onFormStartDateChange={setFormStartDate}
            onFormEndDateChange={setFormEndDate}
            onFormManagerChange={setFormManager}
            onFormBudgetChange={setFormBudget}
            onFormStatusChange={setFormStatus}
            onToggleForm={() => {
              if (showForm) resetForm();
              else setShowForm(true);
            }}
            onResetForm={resetForm}
            onSubmit={handleSubmit}
          />

          <ProjectListTable
            projects={projects}
            canEdit={canEdit}
            canDelete={canDelete}
            onEdit={startEdit}
            onDelete={(p) => {
              if (confirm(`${p.name} 프로젝트를 삭제하시겠습니까?`)) {
                deleteMutation.mutate(p.id);
              }
            }}
          />
        </div>
      )}

      {/* 프로젝트 손익 탭 */}
      {tab === "pnl" && (
        <ProjectPnL
          projects={projects}
          selectedProjectId={selectedProjectId}
          selectedProject={selectedProject}
          pnlStartDate={pnlStartDate}
          pnlEndDate={pnlEndDate}
          pnlData={pnlData}
          onSelectedProjectIdChange={setSelectedProjectId}
          onPnlStartDateChange={setPnlStartDate}
          onPnlEndDateChange={setPnlEndDate}
        />
      )}

      {/* 프로젝트 비교 탭 */}
      {tab === "compare" && (
        <ProjectComparison
          comparison={comparison}
          totalRevAll={totalRevAll}
          totalExpAll={totalExpAll}
          totalNetAll={totalNetAll}
          onExport={exportComparison}
        />
      )}
    </div>
  );
}
