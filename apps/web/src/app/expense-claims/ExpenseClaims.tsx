"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost, apiDelete } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { exportToXlsx } from "@/lib/export-xlsx";
import styles from "./ExpenseClaims.module.css";
import { Employee, ExpenseItem, ExpenseClaim, Summary, STATUS_LABEL, today } from "./types";
import ExpenseClaimForm from "./ExpenseClaimForm";
import ExpenseClaimTable from "./ExpenseClaimTable";

export default function ExpenseClaimsPage() {
  const { tenantId, canEdit } = useAuth();
  const queryClient = useQueryClient();

  const [tab, setTab] = useState<"create" | "list" | "settle">("create");

  // 신청 폼
  const [formEmployeeId, setFormEmployeeId] = useState("");
  const [formTitle, setFormTitle] = useState("");
  const [formDate, setFormDate] = useState(today());
  const [formMemo, setFormMemo] = useState("");
  const [formItems, setFormItems] = useState<ExpenseItem[]>([
    { category: "교통비", description: "", amount: 0, expenseDate: today() },
  ]);

  // 목록 필터
  const [filterStatus, setFilterStatus] = useState("");

  // 정산 모달
  const [settleModal, setSettleModal] = useState<ExpenseClaim | null>(null);
  const [settleDebit, setSettleDebit] = useState("50800");
  const [settleCredit, setSettleCredit] = useState("25300");

  // 데이터 조회
  const { data: employees = [] } = useQuery({
    queryKey: ["payroll-employees"],
    queryFn: () => apiGet<Employee[]>(`/payroll/employees?tenantId=${tenantId}`),
    enabled: !!tenantId,
  });

  const { data: summary } = useQuery({
    queryKey: ["expense-claims-summary"],
    queryFn: () => apiGet<Summary>(`/expense-claims/summary?tenantId=${tenantId}`),
    enabled: !!tenantId,
  });

  const { data: claims = [] } = useQuery({
    queryKey: ["expense-claims", filterStatus],
    queryFn: () => {
      let url = `/expense-claims?tenantId=${tenantId}`;
      if (filterStatus) url += `&status=${filterStatus}`;
      return apiGet<ExpenseClaim[]>(url);
    },
    enabled: !!tenantId,
  });

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ["expense-claims"] });
    queryClient.invalidateQueries({ queryKey: ["expense-claims-summary"] });
  };

  // 생성
  const createMutation = useMutation({
    mutationFn: (data: {
      tenantId: string;
      employeeId: string;
      title: string;
      claimDate: string;
      memo?: string;
      items: ExpenseItem[];
    }) => apiPost("/expense-claims", data),
    onSuccess: () => {
      invalidateAll();
      resetForm();
      setTab("list");
    },
  });

  // 삭제
  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiDelete(`/expense-claims/${id}`),
    onSuccess: invalidateAll,
  });

  // 결재 요청
  const submitMutation = useMutation({
    mutationFn: (id: string) => apiPost(`/expense-claims/${id}/submit`, {}),
    onSuccess: invalidateAll,
  });

  // 정산
  const settleMutation = useMutation({
    mutationFn: ({ id, debitAccountCode, creditAccountCode }: {
      id: string;
      debitAccountCode: string;
      creditAccountCode: string;
    }) => apiPost(`/expense-claims/${id}/settle`, { debitAccountCode, creditAccountCode }),
    onSuccess: () => {
      invalidateAll();
      setSettleModal(null);
    },
  });

  const resetForm = () => {
    setFormEmployeeId("");
    setFormTitle("");
    setFormDate(today());
    setFormMemo("");
    setFormItems([{ category: "교통비", description: "", amount: 0, expenseDate: today() }]);
  };

  const handleAddItem = () => {
    setFormItems([...formItems, { category: "교통비", description: "", amount: 0, expenseDate: today() }]);
  };

  const handleRemoveItem = (idx: number) => {
    if (formItems.length <= 1) return;
    setFormItems(formItems.filter((_, i) => i !== idx));
  };

  const handleItemChange = (idx: number, field: keyof ExpenseItem, value: string | number) => {
    const updated = [...formItems];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (updated[idx] as any)[field] = value;
    setFormItems(updated);
  };

  const totalAmount = formItems.reduce((sum, i) => sum + (Number(i.amount) || 0), 0);

  const handleCreate = (andSubmit: boolean) => {
    if (!formEmployeeId || !formTitle || formItems.length === 0) return;
    const validItems = formItems.filter((i) => i.description && i.amount > 0);
    if (validItems.length === 0) return;

    createMutation.mutate(
      {
        tenantId: tenantId!,
        employeeId: formEmployeeId,
        title: formTitle,
        claimDate: formDate,
        memo: formMemo || undefined,
        items: validItems,
      },
      {
        onSuccess: (data: unknown) => {
          if (andSubmit && data && typeof data === "object" && "id" in data) {
            submitMutation.mutate((data as { id: string }).id);
          }
        },
      },
    );
  };

  const handleExport = () => {
    const headers = ["신청번호", "제목", "직원", "신청일", "합계금액", "상태"];
    const rows = claims.map((c) => [
      c.claimNo,
      c.title,
      c.employee.name,
      new Date(c.claimDate).toLocaleDateString("ko-KR"),
      c.totalAmount,
      STATUS_LABEL[c.status] || c.status,
    ]);
    exportToXlsx("경비정산", "경비정산", headers, rows);
  };

  const handleSettle = () => {
    if (!settleModal) return;
    settleMutation.mutate({
      id: settleModal.id,
      debitAccountCode: settleDebit,
      creditAccountCode: settleCredit,
    });
  };

  const approvedClaims = claims.filter((c) => c.status === "APPROVED");
  const settledClaims = claims.filter((c) => c.status === "SETTLED");

  return (
    <div>
      <h1 className={styles.title}>경비 정산</h1>
      <p className={styles.subtitle}>직원 경비를 신청하고 승인 후 정산 처리합니다</p>

      <ExpenseClaimTable
        summary={summary}
        tab={tab}
        onTabChange={setTab}
        canEdit={canEdit}
        claims={claims}
        filterStatus={filterStatus}
        onFilterStatusChange={setFilterStatus}
        onExport={handleExport}
        onSubmit={(id) => submitMutation.mutate(id)}
        isSubmitting={submitMutation.isPending}
        onDelete={(id) => deleteMutation.mutate(id)}
        isDeleting={deleteMutation.isPending}
        approvedClaims={approvedClaims}
        settledClaims={settledClaims}
        onOpenSettleModal={setSettleModal}
        settleModal={settleModal}
        onCloseSettleModal={() => setSettleModal(null)}
        settleDebit={settleDebit}
        onSettleDebitChange={setSettleDebit}
        settleCredit={settleCredit}
        onSettleCreditChange={setSettleCredit}
        onSettle={handleSettle}
        isSettling={settleMutation.isPending}
      />

      {tab === "create" && (
        <ExpenseClaimForm
          employees={employees}
          formEmployeeId={formEmployeeId}
          onFormEmployeeIdChange={setFormEmployeeId}
          formTitle={formTitle}
          onFormTitleChange={setFormTitle}
          formDate={formDate}
          onFormDateChange={setFormDate}
          formMemo={formMemo}
          onFormMemoChange={setFormMemo}
          formItems={formItems}
          onAddItem={handleAddItem}
          onRemoveItem={handleRemoveItem}
          onItemChange={handleItemChange}
          totalAmount={totalAmount}
          onCreate={handleCreate}
          isCreating={createMutation.isPending}
        />
      )}
    </div>
  );
}
