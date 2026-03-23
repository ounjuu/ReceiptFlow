"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost, apiPatch, apiDelete } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { exportToXlsx } from "@/lib/export-xlsx";
import styles from "./Departments.module.css";
import { Department, PnLResult, ComparisonRow, fmt } from "./types";
import DepartmentForm from "./DepartmentForm";
import { DepartmentList, DepartmentPnL, DepartmentComparison } from "./DepartmentTable";

export default function DepartmentsPage() {
  const { tenantId, canEdit, canDelete } = useAuth();
  const queryClient = useQueryClient();

  const [tab, setTab] = useState<"manage" | "pnl" | "compare">("manage");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // 관리 폼
  const [formCode, setFormCode] = useState("");
  const [formName, setFormName] = useState("");
  const [formDesc, setFormDesc] = useState("");
  const [formManager, setFormManager] = useState("");
  const [formBudget, setFormBudget] = useState("");
  const [formError, setFormError] = useState("");

  // 손익 탭
  const [selectedDeptId, setSelectedDeptId] = useState("");
  const [pnlStartDate, setPnlStartDate] = useState("");
  const [pnlEndDate, setPnlEndDate] = useState("");

  // 부서 목록
  const { data: departments = [] } = useQuery({
    queryKey: ["departments"],
    queryFn: () => apiGet<Department[]>(`/departments?tenantId=${tenantId}`),
    enabled: !!tenantId,
  });

  // 부서 손익
  const { data: pnlData } = useQuery({
    queryKey: ["department-pnl", selectedDeptId, pnlStartDate, pnlEndDate],
    queryFn: () => {
      let url = `/departments/${selectedDeptId}/pnl?tenantId=${tenantId}`;
      if (pnlStartDate) url += `&startDate=${pnlStartDate}`;
      if (pnlEndDate) url += `&endDate=${pnlEndDate}`;
      return apiGet<PnLResult>(url);
    },
    enabled: !!tenantId && !!selectedDeptId && tab === "pnl",
  });

  // 부서 비교
  const { data: comparison = [] } = useQuery({
    queryKey: ["department-comparison"],
    queryFn: () => apiGet<ComparisonRow[]>(`/departments/pnl/comparison?tenantId=${tenantId}`),
    enabled: !!tenantId && tab === "compare",
  });

  // 등록
  const createMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => apiPost("/departments", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["departments"] });
      resetForm();
    },
    onError: (err: Error) => setFormError(err.message),
  });

  // 수정
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      apiPatch(`/departments/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["departments"] });
      queryClient.invalidateQueries({ queryKey: ["department-comparison"] });
      resetForm();
    },
    onError: (err: Error) => setFormError(err.message),
  });

  // 삭제
  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiDelete(`/departments/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["departments"] });
      queryClient.invalidateQueries({ queryKey: ["department-comparison"] });
    },
  });

  const resetForm = () => {
    setShowForm(false);
    setEditingId(null);
    setFormCode("");
    setFormName("");
    setFormDesc("");
    setFormManager("");
    setFormBudget("");
    setFormError("");
  };

  const startEdit = (d: Department) => {
    setEditingId(d.id);
    setShowForm(true);
    setFormCode(d.code);
    setFormName(d.name);
    setFormDesc(d.description || "");
    setFormManager(d.manager || "");
    setFormBudget(d.budget != null ? String(d.budget) : "");
    setFormError("");
  };

  const handleSubmit = () => {
    setFormError("");
    if (!formCode || !formName) {
      setFormError("코드와 이름은 필수입니다");
      return;
    }

    if (editingId) {
      updateMutation.mutate({
        id: editingId,
        data: {
          name: formName,
          description: formDesc || undefined,
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
        manager: formManager || undefined,
        budget: formBudget ? Number(formBudget) : undefined,
      });
    }
  };

  const handleDelete = (d: Department) => {
    if (confirm(`${d.name} 부서를 삭제하시겠습니까?`)) {
      deleteMutation.mutate(d.id);
    }
  };

  const handleToggleForm = () => {
    if (showForm) resetForm();
    else setShowForm(true);
  };

  // 비교 탭 요약
  const totalRevAll = comparison.reduce((s, r) => s + r.totalRevenue, 0);
  const totalExpAll = comparison.reduce((s, r) => s + r.totalExpense, 0);
  const totalNetAll = comparison.reduce((s, r) => s + r.netIncome, 0);

  const exportComparison = () => {
    if (comparison.length === 0) return;
    exportToXlsx(
      "부서별_손익비교",
      "부서비교",
      ["코드", "부서명", "담당자", "예산", "총수익", "총비용", "순이익", "이익률(%)"],
      comparison.map((r) => [
        r.code,
        r.name,
        r.manager || "-",
        r.budget ?? "-",
        r.totalRevenue,
        r.totalExpense,
        r.netIncome,
        r.profitMargin,
      ]),
    );
  };

  const selectedDept = departments.find((d) => d.id === selectedDeptId);
  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <div>
      <h1 className={styles.title}>부서별 손익</h1>
      <p className={styles.subtitle}>
        부서별 수익/비용을 추적하고 손익을 분석합니다
      </p>

      {/* 요약 카드 */}
      <div className={styles.summaryCards}>
        <div className={styles.summaryCard}>
          <div className={styles.summaryLabel}>전체 부서</div>
          <div className={styles.summaryValue}>{departments.length}개</div>
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
          부서 관리
        </button>
        <button
          className={`${styles.tab} ${tab === "pnl" ? styles.tabActive : ""}`}
          onClick={() => setTab("pnl")}
        >
          부서 손익
        </button>
        <button
          className={`${styles.tab} ${tab === "compare" ? styles.tabActive : ""}`}
          onClick={() => setTab("compare")}
        >
          부서 비교
        </button>
      </div>

      {/* 부서 관리 탭 */}
      {tab === "manage" && (
        <DepartmentList
          departments={departments}
          canEdit={canEdit}
          canDelete={canDelete}
          showForm={showForm}
          onToggleForm={handleToggleForm}
          onEdit={startEdit}
          onDelete={handleDelete}
          formSlot={
            <DepartmentForm
              editingId={editingId}
              formCode={formCode}
              formName={formName}
              formDesc={formDesc}
              formManager={formManager}
              formBudget={formBudget}
              formError={formError}
              isPending={isPending}
              onCodeChange={setFormCode}
              onNameChange={setFormName}
              onDescChange={setFormDesc}
              onManagerChange={setFormManager}
              onBudgetChange={setFormBudget}
              onSubmit={handleSubmit}
              onCancel={resetForm}
            />
          }
        />
      )}

      {/* 부서 손익 탭 */}
      {tab === "pnl" && (
        <DepartmentPnL
          departments={departments}
          selectedDeptId={selectedDeptId}
          selectedDeptName={selectedDept?.name}
          pnlStartDate={pnlStartDate}
          pnlEndDate={pnlEndDate}
          pnlData={pnlData}
          onDeptChange={setSelectedDeptId}
          onStartDateChange={setPnlStartDate}
          onEndDateChange={setPnlEndDate}
        />
      )}

      {/* 부서 비교 탭 */}
      {tab === "compare" && (
        <DepartmentComparison
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
