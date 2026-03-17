"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost, apiPatch, apiDelete } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { exportToXlsx } from "@/lib/export-xlsx";
import styles from "./Projects.module.css";

interface Project {
  id: string;
  code: string;
  name: string;
  description: string | null;
  status: string;
  startDate: string;
  endDate: string | null;
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
  status: string;
  budget: number | null;
  totalRevenue: number;
  totalExpense: number;
  netIncome: number;
  profitMargin: number;
}

const fmt = (n: number) => n.toLocaleString();

const statusLabel = (s: string) => {
  switch (s) {
    case "ACTIVE": return { text: "진행중", cls: styles.statusActive };
    case "COMPLETED": return { text: "완료", cls: styles.statusCompleted };
    case "ON_HOLD": return { text: "보류", cls: styles.statusOnHold };
    default: return { text: s, cls: "" };
  }
};

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
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>프로젝트 목록</h2>
            {canEdit && (
              <button
                className={styles.primaryBtn}
                onClick={() => {
                  if (showForm) resetForm();
                  else setShowForm(true);
                }}
              >
                {showForm ? "취소" : "프로젝트 등록"}
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
                  placeholder="PJ-001"
                  readOnly={!!editingId}
                />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>이름 *</label>
                <input
                  className={styles.formInput}
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="프로젝트명"
                />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>시작일 *</label>
                <input
                  className={styles.formInput}
                  type="date"
                  value={formStartDate}
                  onChange={(e) => setFormStartDate(e.target.value)}
                  readOnly={!!editingId}
                />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>종료일</label>
                <input
                  className={styles.formInput}
                  type="date"
                  value={formEndDate}
                  onChange={(e) => setFormEndDate(e.target.value)}
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
              {editingId && (
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>상태</label>
                  <select
                    className={styles.formSelect}
                    value={formStatus}
                    onChange={(e) => setFormStatus(e.target.value)}
                  >
                    <option value="ACTIVE">진행중</option>
                    <option value="COMPLETED">완료</option>
                    <option value="ON_HOLD">보류</option>
                  </select>
                </div>
              )}
              <div className={styles.formGroupFull}>
                <label className={styles.formLabel}>설명</label>
                <input
                  className={styles.formInput}
                  value={formDesc}
                  onChange={(e) => setFormDesc(e.target.value)}
                  placeholder="프로젝트 설명"
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
                <th>프로젝트명</th>
                <th>상태</th>
                <th>시작일</th>
                <th>종료일</th>
                <th>담당자</th>
                <th style={{ textAlign: "right" }}>예산</th>
                {(canEdit || canDelete) && <th>관리</th>}
              </tr>
            </thead>
            <tbody>
              {projects.map((p) => {
                const s = statusLabel(p.status);
                return (
                  <tr key={p.id}>
                    <td>{p.code}</td>
                    <td>{p.name}</td>
                    <td>
                      <span className={`${styles.status} ${s.cls}`}>{s.text}</span>
                    </td>
                    <td>{new Date(p.startDate).toLocaleDateString("ko-KR")}</td>
                    <td>{p.endDate ? new Date(p.endDate).toLocaleDateString("ko-KR") : "-"}</td>
                    <td>{p.manager || "-"}</td>
                    <td style={{ textAlign: "right" }}>
                      {p.budget != null ? `${fmt(p.budget)}원` : "-"}
                    </td>
                    {(canEdit || canDelete) && (
                      <td>
                        <div className={styles.actions}>
                          {canEdit && (
                            <button className={styles.editBtn} onClick={() => startEdit(p)}>
                              수정
                            </button>
                          )}
                          {canDelete && (
                            <button
                              className={styles.dangerBtn}
                              onClick={() => {
                                if (confirm(`${p.name} 프로젝트를 삭제하시겠습니까?`)) {
                                  deleteMutation.mutate(p.id);
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
                );
              })}
              {projects.length === 0 && (
                <tr>
                  <td
                    colSpan={(canEdit || canDelete) ? 8 : 7}
                    style={{ textAlign: "center", color: "var(--text-muted)" }}
                  >
                    등록된 프로젝트가 없습니다
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* 프로젝트 손익 탭 */}
      {tab === "pnl" && (
        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>프로젝트별 손익 분석</h2>
            <div className={styles.sectionHeaderRight}>
              <select
                className={styles.controlSelect}
                value={selectedProjectId}
                onChange={(e) => setSelectedProjectId(e.target.value)}
              >
                <option value="">프로젝트 선택</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.code} {p.name}
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

          {!selectedProjectId && (
            <p style={{ textAlign: "center", color: "var(--text-muted)", padding: 40 }}>
              프로젝트를 선택하세요
            </p>
          )}

          {selectedProjectId && pnlData && (
            <>
              {/* 요약 */}
              <div className={styles.summaryCards} style={{ marginBottom: 20 }}>
                <div className={styles.summaryCard}>
                  <div className={styles.summaryLabel}>프로젝트</div>
                  <div className={styles.summaryValue} style={{ fontSize: "1rem" }}>
                    {selectedProject?.name}
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

      {/* 프로젝트 비교 탭 */}
      {tab === "compare" && (
        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>프로젝트별 손익 비교</h2>
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
                <th>프로젝트명</th>
                <th>상태</th>
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
                const s = statusLabel(r.status);
                const budgetRate = r.budget && r.budget > 0
                  ? Math.round((r.totalExpense / r.budget) * 1000) / 10
                  : null;
                return (
                  <tr key={r.id}>
                    <td>{r.code}</td>
                    <td>{r.name}</td>
                    <td>
                      <span className={`${styles.status} ${s.cls}`}>{s.text}</span>
                    </td>
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
                    프로젝트가 없습니다
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
