"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost, apiPatch, apiDelete } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { exportToXlsx } from "@/lib/export-xlsx";
import styles from "./Departments.module.css";

interface Department {
  id: string;
  code: string;
  name: string;
  description: string | null;
  manager: string | null;
  budget: number | null;
}

interface PnLAccount {
  code: string;
  name: string;
  amount: number;
}

interface PnLResult {
  revenue: PnLAccount[];
  totalRevenue: number;
  expense: PnLAccount[];
  totalExpense: number;
  netIncome: number;
  profitMargin: number;
}

interface ComparisonRow {
  id: string;
  code: string;
  name: string;
  manager: string | null;
  budget: number | null;
  totalRevenue: number;
  totalExpense: number;
  netIncome: number;
  profitMargin: number;
}

const fmt = (n: number) => n.toLocaleString();

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
        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>부서 목록</h2>
            {canEdit && (
              <button
                className={styles.primaryBtn}
                onClick={() => {
                  if (showForm) resetForm();
                  else setShowForm(true);
                }}
              >
                {showForm ? "취소" : "부서 등록"}
              </button>
            )}
          </div>

          {showForm && (
            <div className={styles.form}>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>코드 *</label>
                <input
                  className={styles.formInput}
                  value={formCode}
                  onChange={(e) => setFormCode(e.target.value)}
                  placeholder="DP-001"
                  readOnly={!!editingId}
                />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>이름 *</label>
                <input
                  className={styles.formInput}
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="부서명"
                />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>담당자</label>
                <input
                  className={styles.formInput}
                  value={formManager}
                  onChange={(e) => setFormManager(e.target.value)}
                  placeholder="담당자명"
                />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>예산</label>
                <input
                  className={styles.formInput}
                  type="number"
                  value={formBudget}
                  onChange={(e) => setFormBudget(e.target.value)}
                  placeholder="0"
                />
              </div>
              <div className={styles.formGroupFull}>
                <label className={styles.formLabel}>설명</label>
                <input
                  className={styles.formInput}
                  value={formDesc}
                  onChange={(e) => setFormDesc(e.target.value)}
                  placeholder="부서 설명"
                />
              </div>
              {formError && (
                <div className={styles.formGroupFull} style={{ color: "var(--danger)", fontSize: "0.85rem" }}>
                  {formError}
                </div>
              )}
              <div className={styles.formActions}>
                <button className={styles.secondaryBtn} onClick={resetForm}>
                  취소
                </button>
                <button
                  className={styles.primaryBtn}
                  onClick={handleSubmit}
                  disabled={isPending}
                >
                  {isPending ? "저장 중..." : editingId ? "수정" : "등록"}
                </button>
              </div>
            </div>
          )}

          <table>
            <thead>
              <tr>
                <th>코드</th>
                <th>부서명</th>
                <th>담당자</th>
                <th>설명</th>
                <th style={{ textAlign: "right" }}>예산</th>
                {(canEdit || canDelete) && <th>관리</th>}
              </tr>
            </thead>
            <tbody>
              {departments.map((d) => (
                <tr key={d.id}>
                  <td>{d.code}</td>
                  <td>{d.name}</td>
                  <td>{d.manager || "-"}</td>
                  <td>{d.description || "-"}</td>
                  <td style={{ textAlign: "right" }}>
                    {d.budget != null ? `${fmt(d.budget)}원` : "-"}
                  </td>
                  {(canEdit || canDelete) && (
                    <td>
                      <div className={styles.actions}>
                        {canEdit && (
                          <button className={styles.editBtn} onClick={() => startEdit(d)}>
                            수정
                          </button>
                        )}
                        {canDelete && (
                          <button
                            className={styles.dangerBtn}
                            onClick={() => {
                              if (confirm(`${d.name} 부서를 삭제하시겠습니까?`)) {
                                deleteMutation.mutate(d.id);
                              }
                            }}
                          >
                            삭제
                          </button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))}
              {departments.length === 0 && (
                <tr>
                  <td
                    colSpan={(canEdit || canDelete) ? 6 : 5}
                    style={{ textAlign: "center", color: "var(--text-muted)" }}
                  >
                    등록된 부서가 없습니다
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* 부서 손익 탭 */}
      {tab === "pnl" && (
        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>부서별 손익 분석</h2>
            <div className={styles.sectionHeaderRight}>
              <select
                className={styles.controlSelect}
                value={selectedDeptId}
                onChange={(e) => setSelectedDeptId(e.target.value)}
              >
                <option value="">부서 선택</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.code} {d.name}
                  </option>
                ))}
              </select>
              <input
                className={styles.formInput}
                type="date"
                value={pnlStartDate}
                onChange={(e) => setPnlStartDate(e.target.value)}
                style={{ width: 150 }}
              />
              <span className={styles.unit}>~</span>
              <input
                className={styles.formInput}
                type="date"
                value={pnlEndDate}
                onChange={(e) => setPnlEndDate(e.target.value)}
                style={{ width: 150 }}
              />
            </div>
          </div>

          {!selectedDeptId && (
            <p style={{ textAlign: "center", color: "var(--text-muted)", padding: 40 }}>
              부서를 선택하세요
            </p>
          )}

          {selectedDeptId && pnlData && (
            <>
              {/* 요약 */}
              <div className={styles.summaryCards} style={{ marginBottom: 20 }}>
                <div className={styles.summaryCard}>
                  <div className={styles.summaryLabel}>부서</div>
                  <div className={styles.summaryValue} style={{ fontSize: "1rem" }}>
                    {selectedDept?.name}
                  </div>
                </div>
                <div className={styles.summaryCard}>
                  <div className={styles.summaryLabel}>총 수익</div>
                  <div className={`${styles.summaryValue} ${styles.summaryPositive}`}>
                    {fmt(pnlData.totalRevenue)}원
                  </div>
                </div>
                <div className={styles.summaryCard}>
                  <div className={styles.summaryLabel}>총 비용</div>
                  <div className={styles.summaryValue}>{fmt(pnlData.totalExpense)}원</div>
                </div>
                <div className={styles.summaryCard}>
                  <div className={styles.summaryLabel}>순이익 (이익률 {pnlData.profitMargin}%)</div>
                  <div className={`${styles.summaryValue} ${pnlData.netIncome >= 0 ? styles.summaryPositive : styles.summaryNegative}`}>
                    {fmt(pnlData.netIncome)}원
                  </div>
                </div>
              </div>

              {/* 수익/비용 상세 */}
              <div className={styles.pnlGrid}>
                <div className={styles.pnlCard}>
                  <div className={styles.pnlCardTitle}>수익</div>
                  {pnlData.revenue.map((r) => (
                    <div key={r.code} className={styles.pnlItem}>
                      <span>{r.code} {r.name}</span>
                      <span>{fmt(r.amount)}원</span>
                    </div>
                  ))}
                  {pnlData.revenue.length === 0 && (
                    <div style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>수익 내역 없음</div>
                  )}
                  <div className={styles.pnlTotal}>
                    <span>합계</span>
                    <span>{fmt(pnlData.totalRevenue)}원</span>
                  </div>
                </div>
                <div className={styles.pnlCard}>
                  <div className={styles.pnlCardTitle}>비용</div>
                  {pnlData.expense.map((r) => (
                    <div key={r.code} className={styles.pnlItem}>
                      <span>{r.code} {r.name}</span>
                      <span>{fmt(r.amount)}원</span>
                    </div>
                  ))}
                  {pnlData.expense.length === 0 && (
                    <div style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>비용 내역 없음</div>
                  )}
                  <div className={styles.pnlTotal}>
                    <span>합계</span>
                    <span>{fmt(pnlData.totalExpense)}원</span>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* 부서 비교 탭 */}
      {tab === "compare" && (
        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>부서별 손익 비교</h2>
            <div className={styles.sectionHeaderRight}>
              <span className={styles.unit}>(단위: 원)</span>
              <button
                className={styles.downloadBtn}
                onClick={exportComparison}
                disabled={comparison.length === 0}
              >
                엑셀 다운로드
              </button>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th>코드</th>
                <th>부서명</th>
                <th>담당자</th>
                <th style={{ textAlign: "right" }}>예산</th>
                <th style={{ textAlign: "right" }}>총수익</th>
                <th style={{ textAlign: "right" }}>총비용</th>
                <th style={{ textAlign: "right" }}>순이익</th>
                <th style={{ textAlign: "right" }}>이익률</th>
                <th style={{ textAlign: "right", minWidth: 160 }}>예산소진</th>
              </tr>
            </thead>
            <tbody>
              {comparison.map((r) => {
                const budgetRate = r.budget && r.budget > 0
                  ? Math.round((r.totalExpense / r.budget) * 1000) / 10
                  : null;
                return (
                  <tr key={r.id}>
                    <td>{r.code}</td>
                    <td>{r.name}</td>
                    <td>{r.manager || "-"}</td>
                    <td style={{ textAlign: "right" }}>
                      {r.budget != null ? fmt(r.budget) : "-"}
                    </td>
                    <td style={{ textAlign: "right" }}>{fmt(r.totalRevenue)}</td>
                    <td style={{ textAlign: "right" }}>{fmt(r.totalExpense)}</td>
                    <td style={{ textAlign: "right" }} className={r.netIncome >= 0 ? styles.profitPositive : styles.profitNegative}>
                      {fmt(r.netIncome)}
                    </td>
                    <td style={{ textAlign: "right" }} className={r.profitMargin >= 0 ? styles.profitPositive : styles.profitNegative}>
                      {r.profitMargin}%
                    </td>
                    <td style={{ textAlign: "right" }}>
                      {budgetRate != null ? (
                        <div className={styles.rateCell}>
                          <div className={styles.progressBar}>
                            <div
                              className={styles.progressFill}
                              style={{
                                width: `${Math.min(budgetRate, 100)}%`,
                                backgroundColor: budgetRate > 100 ? "#ef4444" : budgetRate > 80 ? "#f59e0b" : "#22c55e",
                              }}
                            />
                          </div>
                          <span>{budgetRate}%</span>
                        </div>
                      ) : "-"}
                    </td>
                  </tr>
                );
              })}
              {comparison.length > 0 && (
                <tr style={{ fontWeight: 700 }}>
                  <td colSpan={4}>합계</td>
                  <td style={{ textAlign: "right" }}>{fmt(totalRevAll)}</td>
                  <td style={{ textAlign: "right" }}>{fmt(totalExpAll)}</td>
                  <td style={{ textAlign: "right" }} className={totalNetAll >= 0 ? styles.profitPositive : styles.profitNegative}>
                    {fmt(totalNetAll)}
                  </td>
                  <td colSpan={2}></td>
                </tr>
              )}
              {comparison.length === 0 && (
                <tr>
                  <td colSpan={9} style={{ textAlign: "center", color: "var(--text-muted)" }}>
                    부서가 없습니다
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
