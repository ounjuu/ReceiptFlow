"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost, apiDelete } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { exportToXlsx } from "@/lib/export-xlsx";
import styles from "./Budgets.module.css";

interface BudgetItem {
  id: string;
  accountId: string;
  accountCode: string;
  accountName: string;
  accountType: string;
  year: number;
  month: number;
  amount: number;
  note: string | null;
}

interface AccountOption {
  id: string;
  code: string;
  name: string;
  type: string;
}

interface VsActualRow {
  accountId: string;
  accountCode: string;
  accountName: string;
  budget: number;
  actual: number;
  variance: number;
  rate: number;
}

interface VsActualData {
  rows: VsActualRow[];
  totalBudget: number;
  totalActual: number;
  totalVariance: number;
  totalRate: number;
}

const fmt = (n: number) => n.toLocaleString();
const now = new Date();

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
  const accountBudgetMap = new Map<
    string,
    { accountId: string; code: string; name: string; months: Record<number, { id: string; amount: number }> }
  >();
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

  const getRateColor = (rate: number) => {
    if (rate > 100) return styles.rateDanger;
    if (rate > 80) return styles.rateWarning;
    return styles.rateNormal;
  };

  const getProgressColor = (rate: number) => {
    if (rate > 100) return "#ef4444";
    if (rate > 80) return "#f59e0b";
    return "#22c55e";
  };

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
        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>
              {year}년 예산 설정
            </h2>
            <div className={styles.sectionHeaderRight}>
              <select
                className={styles.controlSelect}
                value={year}
                onChange={(e) => setYear(Number(e.target.value))}
              >
                {[now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1].map(
                  (y) => (
                    <option key={y} value={y}>
                      {y}년
                    </option>
                  ),
                )}
              </select>
              {canEdit && (
                <button
                  className={styles.primaryBtn}
                  onClick={() => setShowForm(!showForm)}
                >
                  {showForm ? "취소" : "예산 등록"}
                </button>
              )}
            </div>
          </div>

          {/* 등록 폼 */}
          {showForm && (
            <div className={styles.form}>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>계정과목 *</label>
                <select
                  className={styles.formSelect}
                  value={formAccountId}
                  onChange={(e) => setFormAccountId(e.target.value)}
                >
                  <option value="">선택</option>
                  {expenseAccounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.code} {a.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>
                  <input
                    type="checkbox"
                    checked={bulkMode}
                    onChange={(e) => setBulkMode(e.target.checked)}
                    style={{ marginRight: 6 }}
                  />
                  12개월 동일 금액
                </label>
                {!bulkMode && (
                  <select
                    className={styles.formSelect}
                    value={formMonth}
                    onChange={(e) => setFormMonth(Number(e.target.value))}
                  >
                    {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                      <option key={m} value={m}>
                        {m}월
                      </option>
                    ))}
                  </select>
                )}
              </div>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>금액 *</label>
                <input
                  className={styles.formInput}
                  type="number"
                  value={formAmount}
                  onChange={(e) => setFormAmount(e.target.value)}
                  placeholder="0"
                />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>비고</label>
                <input
                  className={styles.formInput}
                  value={formNote}
                  onChange={(e) => setFormNote(e.target.value)}
                  placeholder="선택사항"
                />
              </div>
              <div className={styles.formActions}>
                <button
                  className={styles.secondaryBtn}
                  onClick={() => {
                    resetForm();
                    setShowForm(false);
                  }}
                >
                  취소
                </button>
                <button
                  className={styles.primaryBtn}
                  onClick={handleUpsert}
                  disabled={upsertMutation.isPending}
                >
                  {upsertMutation.isPending ? "저장 중..." : "저장"}
                </button>
              </div>
            </div>
          )}

          {/* 계정별 월별 예산 테이블 */}
          <div style={{ overflowX: "auto" }}>
            <table>
              <thead>
                <tr>
                  <th>계정</th>
                  {Array.from({ length: 12 }, (_, i) => (
                    <th key={i} style={{ textAlign: "right" }}>
                      {i + 1}월
                    </th>
                  ))}
                  <th style={{ textAlign: "right" }}>합계</th>
                  {canDelete && <th></th>}
                </tr>
              </thead>
              <tbody>
                {budgetGrid.map((row) => {
                  const total = Object.values(row.months).reduce(
                    (s, m) => s + m.amount,
                    0,
                  );
                  return (
                    <tr key={row.accountId}>
                      <td style={{ whiteSpace: "nowrap" }}>
                        {row.code} {row.name}
                      </td>
                      {Array.from({ length: 12 }, (_, i) => {
                        const m = row.months[i + 1];
                        return (
                          <td
                            key={i}
                            style={{
                              textAlign: "right",
                              color: m ? "inherit" : "var(--text-muted)",
                            }}
                          >
                            {m ? fmt(m.amount) : "-"}
                          </td>
                        );
                      })}
                      <td style={{ textAlign: "right", fontWeight: 600 }}>
                        {fmt(total)}
                      </td>
                      {canDelete && (
                        <td>
                          <button
                            className={styles.dangerBtn}
                            onClick={() => {
                              Object.values(row.months).forEach((m) =>
                                deleteMutation.mutate(m.id),
                              );
                            }}
                          >
                            삭제
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })}
                {budgetGrid.length === 0 && (
                  <tr>
                    <td
                      colSpan={canDelete ? 15 : 14}
                      style={{ textAlign: "center", color: "var(--text-muted)" }}
                    >
                      등록된 예산이 없습니다
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 예산 vs 실적 탭 */}
      {tab === "comparison" && (
        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>예산 vs 실적</h2>
            <div className={styles.sectionHeaderRight}>
              <select
                className={styles.controlSelect}
                value={compYear}
                onChange={(e) => setCompYear(Number(e.target.value))}
              >
                {[now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1].map(
                  (y) => (
                    <option key={y} value={y}>
                      {y}년
                    </option>
                  ),
                )}
              </select>
              <select
                className={styles.controlSelect}
                value={compMonth ?? ""}
                onChange={(e) => {
                  const v = e.target.value;
                  setCompMonth(v ? Number(v) : undefined);
                }}
              >
                <option value="">연간</option>
                {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                  <option key={m} value={m}>
                    {m}월
                  </option>
                ))}
              </select>
              <span className={styles.unit}>(단위: 원)</span>
              <button
                className={styles.downloadBtn}
                onClick={exportComparison}
                disabled={!vsActual || vsActual.rows.length === 0}
              >
                엑셀 다운로드
              </button>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th>계정코드</th>
                <th>계정명</th>
                <th style={{ textAlign: "right" }}>예산</th>
                <th style={{ textAlign: "right" }}>실적</th>
                <th style={{ textAlign: "right" }}>차이</th>
                <th style={{ textAlign: "right", minWidth: 180 }}>소진율</th>
              </tr>
            </thead>
            <tbody>
              {vsActual?.rows.map((r) => (
                <tr key={r.accountId}>
                  <td>{r.accountCode}</td>
                  <td>{r.accountName}</td>
                  <td style={{ textAlign: "right" }}>{fmt(r.budget)}</td>
                  <td style={{ textAlign: "right" }}>{fmt(r.actual)}</td>
                  <td
                    style={{
                      textAlign: "right",
                      color: r.variance < 0 ? "var(--danger)" : "inherit",
                    }}
                  >
                    {fmt(r.variance)}
                  </td>
                  <td style={{ textAlign: "right" }}>
                    <div className={styles.rateCell}>
                      <div className={styles.progressBar}>
                        <div
                          className={styles.progressFill}
                          style={{
                            width: `${Math.min(r.rate, 100)}%`,
                            backgroundColor: getProgressColor(r.rate),
                          }}
                        />
                      </div>
                      <span className={getRateColor(r.rate)}>
                        {r.rate}%
                      </span>
                    </div>
                  </td>
                </tr>
              ))}
              {vsActual && vsActual.rows.length > 0 && (
                <tr style={{ fontWeight: 700 }}>
                  <td colSpan={2}>합계</td>
                  <td style={{ textAlign: "right" }}>
                    {fmt(vsActual.totalBudget)}
                  </td>
                  <td style={{ textAlign: "right" }}>
                    {fmt(vsActual.totalActual)}
                  </td>
                  <td
                    style={{
                      textAlign: "right",
                      color:
                        vsActual.totalVariance < 0
                          ? "var(--danger)"
                          : "inherit",
                    }}
                  >
                    {fmt(vsActual.totalVariance)}
                  </td>
                  <td style={{ textAlign: "right" }}>
                    <div className={styles.rateCell}>
                      <div className={styles.progressBar}>
                        <div
                          className={styles.progressFill}
                          style={{
                            width: `${Math.min(vsActual.totalRate, 100)}%`,
                            backgroundColor: getProgressColor(
                              vsActual.totalRate,
                            ),
                          }}
                        />
                      </div>
                      <span className={getRateColor(vsActual.totalRate)}>
                        {vsActual.totalRate}%
                      </span>
                    </div>
                  </td>
                </tr>
              )}
              {(!vsActual || vsActual.rows.length === 0) && (
                <tr>
                  <td
                    colSpan={6}
                    style={{ textAlign: "center", color: "var(--text-muted)" }}
                  >
                    해당 기간의 예산/실적 데이터가 없습니다
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
