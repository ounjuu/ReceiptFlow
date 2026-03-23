"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost, apiDelete } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { exportToXlsx } from "@/lib/export-xlsx";
import styles from "./Budgets.module.css";
import type { BudgetItem, AccountOption, VsActualData, BudgetGridRow } from "./types";
import { fmt, now } from "./types";
import BudgetForm from "./BudgetForm";
import { BudgetSettingTable, BudgetComparisonTable } from "./BudgetTable";

export default function BudgetsPage() {
  const { tenantId, canEdit, canDelete } = useAuth();
  const queryClient = useQueryClient();

  const [tab, setTab] = useState<"setting" | "comparison">("setting");
  const [year, setYear] = useState(now.getFullYear());
  const [showForm, setShowForm] = useState(false);

  // 예산 설정 폼
  const [formAccountId, setFormAccountId] = useState("");
  const [formMonth, setFormMonth] = useState(1);
  const [formAmount, setFormAmount] = useState("");
  const [formNote, setFormNote] = useState("");
  const [bulkMode, setBulkMode] = useState(false);
  const [bulkAmount, setBulkAmount] = useState("");

  // 비교 탭
  const [compYear, setCompYear] = useState(now.getFullYear());
  const [compMonth, setCompMonth] = useState<number | undefined>(
    now.getMonth() + 1,
  );

  // 계정과목 조회
  const { data: allAccounts = [] } = useQuery({
    queryKey: ["accounts"],
    queryFn: () =>
      apiGet<AccountOption[]>(`/accounts?tenantId=${tenantId}`),
    enabled: !!tenantId,
  });
  const expenseAccounts = allAccounts.filter((a) => a.type === "EXPENSE");

  // 예산 목록
  const { data: budgets = [] } = useQuery({
    queryKey: ["budgets", year],
    queryFn: () =>
      apiGet<BudgetItem[]>(`/budgets?tenantId=${tenantId}&year=${year}`),
    enabled: !!tenantId,
  });

  // 예산 vs 실적
  const { data: vsActual } = useQuery({
    queryKey: ["budget-vs-actual", compYear, compMonth],
    queryFn: () => {
      let url = `/budgets/vs-actual?tenantId=${tenantId}&year=${compYear}`;
      if (compMonth) url += `&month=${compMonth}`;
      return apiGet<VsActualData>(url);
    },
    enabled: !!tenantId && tab === "comparison",
  });

  // 예산 등록/수정
  const upsertMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => apiPost("/budgets", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["budgets"] });
      queryClient.invalidateQueries({ queryKey: ["budget-vs-actual"] });
      resetForm();
      setShowForm(false);
    },
  });

  // 예산 삭제
  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiDelete(`/budgets/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["budgets"] });
      queryClient.invalidateQueries({ queryKey: ["budget-vs-actual"] });
    },
  });

  const resetForm = () => {
    setFormAccountId("");
    setFormMonth(1);
    setFormAmount("");
    setFormNote("");
    setBulkMode(false);
    setBulkAmount("");
  };

  const handleUpsert = () => {
    if (!formAccountId || !formAmount) return;

    if (bulkMode) {
      // 12개월 일괄 등록
      const amount = Number(bulkAmount || formAmount);
      for (let m = 1; m <= 12; m++) {
        upsertMutation.mutate({
          tenantId,
          accountId: formAccountId,
          year,
          month: m,
          amount,
          note: formNote || undefined,
        });
      }
    } else {
      upsertMutation.mutate({
        tenantId,
        accountId: formAccountId,
        year,
        month: formMonth,
        amount: Number(formAmount),
        note: formNote || undefined,
      });
    }
  };

  // 계정별 월별 그리드 데이터 구성
  const accountBudgetMap = new Map<string, BudgetGridRow>();
  for (const b of budgets) {
    if (!accountBudgetMap.has(b.accountId)) {
      accountBudgetMap.set(b.accountId, {
        accountId: b.accountId,
        code: b.accountCode,
        name: b.accountName,
        months: {},
      });
    }
    accountBudgetMap.get(b.accountId)!.months[b.month] = {
      id: b.id,
      amount: b.amount,
    };
  }
  const budgetGrid = [...accountBudgetMap.values()].sort((a, b) =>
    a.code.localeCompare(b.code),
  );

  // 요약
  const totalBudget = budgets.reduce((s, b) => s + b.amount, 0);

  // 엑셀 내보내기
  const exportComparison = () => {
    if (!vsActual || vsActual.rows.length === 0) return;
    const periodLabel = compMonth
      ? `${compYear}-${String(compMonth).padStart(2, "0")}`
      : `${compYear}`;
    exportToXlsx(
      `예산대비실적_${periodLabel}`,
      "예산vs실적",
      ["계정코드", "계정명", "예산", "실적", "차이", "소진율(%)"],
      vsActual.rows.map((r) => [
        r.accountCode,
        r.accountName,
        r.budget,
        r.actual,
        r.variance,
        r.rate,
      ]),
    );
  };

  const handleDeleteRow = (months: Record<number, { id: string; amount: number }>) => {
    Object.values(months).forEach((m) => deleteMutation.mutate(m.id));
  };

  return (
    <div>
      <h1 className={styles.title}>예산 관리</h1>
      <p className={styles.subtitle}>
        계정별 예산을 설정하고 실적과 비교하여 예산 소진율을 관리합니다
      </p>

      {/* 요약 카드 */}
      <div className={styles.summaryCards}>
        <div className={styles.summaryCard}>
          <div className={styles.summaryLabel}>{year}년 총 예산</div>
          <div className={styles.summaryValue}>{fmt(totalBudget)}원</div>
        </div>
        <div className={styles.summaryCard}>
          <div className={styles.summaryLabel}>총 실적</div>
          <div className={styles.summaryValue}>
            {vsActual ? `${fmt(vsActual.totalActual)}원` : "-"}
          </div>
        </div>
        <div className={styles.summaryCard}>
          <div className={styles.summaryLabel}>잔여 예산</div>
          <div className={styles.summaryValue}>
            {vsActual ? `${fmt(vsActual.totalVariance)}원` : "-"}
          </div>
        </div>
        <div className={styles.summaryCard}>
          <div className={styles.summaryLabel}>소진율</div>
          <div className={styles.summaryValue}>
            {vsActual ? `${vsActual.totalRate}%` : "-"}
          </div>
        </div>
      </div>

      {/* 탭 */}
      <div className={styles.tabs}>
        <button
          className={`${styles.tab} ${tab === "setting" ? styles.tabActive : ""}`}
          onClick={() => setTab("setting")}
        >
          예산 설정
        </button>
        <button
          className={`${styles.tab} ${tab === "comparison" ? styles.tabActive : ""}`}
          onClick={() => setTab("comparison")}
        >
          예산 vs 실적
        </button>
      </div>

      {/* 예산 설정 탭 */}
      {tab === "setting" && (
        <BudgetSettingTable
          year={year}
          setYear={setYear}
          canEdit={canEdit}
          canDelete={canDelete}
          showForm={showForm}
          setShowForm={setShowForm}
          budgetGrid={budgetGrid}
          onDeleteRow={handleDeleteRow}
        >
          <BudgetForm
            formAccountId={formAccountId}
            setFormAccountId={setFormAccountId}
            formMonth={formMonth}
            setFormMonth={setFormMonth}
            formAmount={formAmount}
            setFormAmount={setFormAmount}
            formNote={formNote}
            setFormNote={setFormNote}
            bulkMode={bulkMode}
            setBulkMode={setBulkMode}
            expenseAccounts={expenseAccounts}
            isPending={upsertMutation.isPending}
            onSubmit={handleUpsert}
            onCancel={() => {
              resetForm();
              setShowForm(false);
            }}
          />
        </BudgetSettingTable>
      )}

      {/* 예산 vs 실적 탭 */}
      {tab === "comparison" && (
        <BudgetComparisonTable
          compYear={compYear}
          setCompYear={setCompYear}
          compMonth={compMonth}
          setCompMonth={setCompMonth}
          vsActual={vsActual}
          onExport={exportComparison}
        />
      )}
    </div>
  );
}
