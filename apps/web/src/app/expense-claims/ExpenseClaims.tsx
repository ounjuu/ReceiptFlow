"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost, apiPatch, apiDelete } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { exportToXlsx } from "@/lib/export-xlsx";
import styles from "./ExpenseClaims.module.css";

interface Employee {
  id: string;
  name: string;
  employeeNo: string;
  department: string | null;
}

interface ExpenseItem {
  id?: string;
  category: string;
  description: string;
  amount: number;
  expenseDate: string;
  receiptUrl?: string;
}

interface ExpenseClaim {
  id: string;
  claimNo: string;
  title: string;
  claimDate: string;
  totalAmount: number;
  status: string;
  memo: string | null;
  employeeId: string;
  employee: Employee;
  items: ExpenseItem[];
  settledAt: string | null;
  journalEntryId: string | null;
  createdAt: string;
}

interface Summary {
  draft: number;
  pending: number;
  approved: number;
  settled: number;
  rejected: number;
  totalSettled: number;
  totalPending: number;
}

const CATEGORIES = ["교통비", "식비", "숙박비", "회의비", "사무용품", "기타"];

const STATUS_LABEL: Record<string, string> = {
  DRAFT: "임시저장",
  PENDING_APPROVAL: "결재중",
  APPROVED: "승인",
  REJECTED: "반려",
  SETTLED: "정산완료",
};

const STATUS_STYLE: Record<string, string> = {
  DRAFT: "badgeDraft",
  PENDING_APPROVAL: "badgePending",
  APPROVED: "badgeApproved",
  REJECTED: "badgeRejected",
  SETTLED: "badgeSettled",
};

const fmt = (n: number) => n.toLocaleString();
const today = () => new Date().toISOString().slice(0, 10);

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

  const approvedClaims = claims.filter((c) => c.status === "APPROVED");
  const settledClaims = claims.filter((c) => c.status === "SETTLED");

  return (
    <div>
      <h1 className={styles.title}>경비 정산</h1>
      <p className={styles.subtitle}>직원 경비를 신청하고 승인 후 정산 처리합니다</p>

      {/* 요약 카드 */}
      <div className={styles.summaryCards}>
        <div className={styles.summaryCard}>
          <div className={styles.summaryLabel}>결재 대기</div>
          <div className={styles.summaryValue}>{summary?.pending ?? 0}건</div>
        </div>
        <div className={styles.summaryCard}>
          <div className={styles.summaryLabel}>승인 (미정산)</div>
          <div className={styles.summaryValue}>{summary?.approved ?? 0}건</div>
        </div>
        <div className={styles.summaryCard}>
          <div className={styles.summaryLabel}>정산 완료</div>
          <div className={styles.summaryValue}>{fmt(summary?.totalSettled ?? 0)}원</div>
        </div>
        <div className={styles.summaryCard}>
          <div className={styles.summaryLabel}>미정산 금액</div>
          <div className={styles.summaryValue}>{fmt(summary?.totalPending ?? 0)}원</div>
        </div>
      </div>

      {/* 탭 */}
      <div className={styles.tabs}>
        <button
          className={`${styles.tab} ${tab === "create" ? styles.tabActive : ""}`}
          onClick={() => setTab("create")}
        >
          경비 신청
        </button>
        <button
          className={`${styles.tab} ${tab === "list" ? styles.tabActive : ""}`}
          onClick={() => setTab("list")}
        >
          신청 현황
        </button>
        {canEdit && (
          <button
            className={`${styles.tab} ${tab === "settle" ? styles.tabActive : ""}`}
            onClick={() => setTab("settle")}
          >
            경비 처리
          </button>
        )}
      </div>

      {/* 경비 신청 탭 */}
      {tab === "create" && (
        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>경비 신청서 작성</h2>
          <div className={styles.form}>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>직원</label>
              <select
                className={styles.formSelect}
                value={formEmployeeId}
                onChange={(e) => setFormEmployeeId(e.target.value)}
              >
                <option value="">선택</option>
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.name} ({emp.employeeNo})
                  </option>
                ))}
              </select>
            </div>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>신청일</label>
              <input
                className={styles.formInput}
                type="date"
                value={formDate}
                onChange={(e) => setFormDate(e.target.value)}
              />
            </div>
            <div className={styles.formGroupFull}>
              <label className={styles.formLabel}>제목</label>
              <input
                className={styles.formInput}
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
                placeholder="예: 3월 출장 경비"
              />
            </div>
            <div className={styles.formGroupFull}>
              <label className={styles.formLabel}>메모</label>
              <textarea
                className={styles.formTextarea}
                value={formMemo}
                onChange={(e) => setFormMemo(e.target.value)}
                placeholder="비고 사항 (선택)"
              />
            </div>
          </div>

          {/* 경비 항목 */}
          <h3 className={styles.sectionTitle} style={{ marginBottom: "12px" }}>경비 항목</h3>
          <div style={{ marginBottom: "8px" }}>
            <div className={styles.itemRow} style={{ fontWeight: 600, fontSize: "0.8rem", color: "var(--text-muted)" }}>
              <span>카테고리</span>
              <span>설명</span>
              <span>금액</span>
              <span>사용일</span>
              <span />
            </div>
          </div>
          {formItems.map((item, idx) => (
            <div key={idx} className={styles.itemRow}>
              <select
                className={styles.itemInput}
                value={item.category}
                onChange={(e) => handleItemChange(idx, "category", e.target.value)}
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
              <input
                className={styles.itemInput}
                value={item.description}
                onChange={(e) => handleItemChange(idx, "description", e.target.value)}
                placeholder="내역"
              />
              <input
                className={styles.itemInput}
                type="number"
                value={item.amount || ""}
                onChange={(e) => handleItemChange(idx, "amount", Number(e.target.value))}
                placeholder="0"
              />
              <input
                className={styles.itemInput}
                type="date"
                value={item.expenseDate}
                onChange={(e) => handleItemChange(idx, "expenseDate", e.target.value)}
              />
              <button className={styles.removeItemBtn} onClick={() => handleRemoveItem(idx)}>
                ×
              </button>
            </div>
          ))}
          <button className={styles.secondaryBtn} onClick={handleAddItem} style={{ marginTop: "8px" }}>
            + 항목 추가
          </button>

          <div className={styles.totalRow}>
            <span>합계:</span>
            <span>{fmt(totalAmount)}원</span>
          </div>

          <div className={styles.formActions}>
            <button
              className={styles.secondaryBtn}
              onClick={() => handleCreate(false)}
              disabled={createMutation.isPending}
            >
              임시저장
            </button>
            <button
              className={styles.primaryBtn}
              onClick={() => handleCreate(true)}
              disabled={createMutation.isPending}
            >
              결재 요청
            </button>
          </div>
        </div>
      )}

      {/* 신청 현황 탭 */}
      {tab === "list" && (
        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>신청 현황</h2>
            <button className={styles.downloadBtn} onClick={handleExport}>
              엑셀 다운로드
            </button>
          </div>

          <div className={styles.filterRow}>
            <select
              className={styles.filterSelect}
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
            >
              <option value="">전체 상태</option>
              <option value="DRAFT">임시저장</option>
              <option value="PENDING_APPROVAL">결재중</option>
              <option value="APPROVED">승인</option>
              <option value="REJECTED">반려</option>
              <option value="SETTLED">정산완료</option>
            </select>
          </div>

          <table>
            <thead>
              <tr>
                <th>신청번호</th>
                <th>제목</th>
                <th>직원</th>
                <th>신청일</th>
                <th>합계</th>
                <th>상태</th>
                <th>작업</th>
              </tr>
            </thead>
            <tbody>
              {claims.map((c) => (
                <tr key={c.id}>
                  <td>{c.claimNo}</td>
                  <td>{c.title}</td>
                  <td>{c.employee.name}</td>
                  <td>{new Date(c.claimDate).toLocaleDateString("ko-KR")}</td>
                  <td style={{ textAlign: "right" }}>{fmt(c.totalAmount)}원</td>
                  <td>
                    <span className={`${styles.badge} ${styles[STATUS_STYLE[c.status]] || ""}`}>
                      {STATUS_LABEL[c.status] || c.status}
                    </span>
                  </td>
                  <td>
                    {c.status === "DRAFT" && (
                      <>
                        <button
                          className={styles.primaryBtn}
                          style={{ fontSize: "0.8rem", padding: "4px 10px", marginRight: "4px" }}
                          onClick={() => submitMutation.mutate(c.id)}
                          disabled={submitMutation.isPending}
                        >
                          결재요청
                        </button>
                        <button
                          className={styles.dangerBtn}
                          onClick={() => {
                            if (confirm("삭제하시겠습니까?")) deleteMutation.mutate(c.id);
                          }}
                          disabled={deleteMutation.isPending}
                        >
                          삭제
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
              {claims.length === 0 && (
                <tr>
                  <td colSpan={7} style={{ textAlign: "center", color: "var(--text-muted)" }}>
                    경비 신청 내역이 없습니다
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* 경비 처리 탭 */}
      {tab === "settle" && canEdit && (
        <>
          {/* 승인 건 정산 처리 */}
          <div className={styles.section}>
            <h2 className={styles.sectionTitle}>승인 건 정산 대기</h2>
            <table>
              <thead>
                <tr>
                  <th>신청번호</th>
                  <th>제목</th>
                  <th>직원</th>
                  <th>합계</th>
                  <th>작업</th>
                </tr>
              </thead>
              <tbody>
                {approvedClaims.map((c) => (
                  <tr key={c.id}>
                    <td>{c.claimNo}</td>
                    <td>{c.title}</td>
                    <td>{c.employee.name}</td>
                    <td style={{ textAlign: "right" }}>{fmt(c.totalAmount)}원</td>
                    <td>
                      <button className={styles.settleBtn} onClick={() => setSettleModal(c)}>
                        정산 처리
                      </button>
                    </td>
                  </tr>
                ))}
                {approvedClaims.length === 0 && (
                  <tr>
                    <td colSpan={5} style={{ textAlign: "center", color: "var(--text-muted)" }}>
                      정산 대기 건이 없습니다
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* 정산 완료 내역 */}
          <div className={styles.section}>
            <h2 className={styles.sectionTitle}>정산 완료 내역</h2>
            <table>
              <thead>
                <tr>
                  <th>신청번호</th>
                  <th>제목</th>
                  <th>직원</th>
                  <th>합계</th>
                  <th>정산일</th>
                </tr>
              </thead>
              <tbody>
                {settledClaims.map((c) => (
                  <tr key={c.id}>
                    <td>{c.claimNo}</td>
                    <td>{c.title}</td>
                    <td>{c.employee.name}</td>
                    <td style={{ textAlign: "right" }}>{fmt(c.totalAmount)}원</td>
                    <td>{c.settledAt ? new Date(c.settledAt).toLocaleDateString("ko-KR") : "-"}</td>
                  </tr>
                ))}
                {settledClaims.length === 0 && (
                  <tr>
                    <td colSpan={5} style={{ textAlign: "center", color: "var(--text-muted)" }}>
                      정산 완료 내역이 없습니다
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* 정산 모달 */}
      {settleModal && (
        <div className={styles.modalOverlay} onClick={() => setSettleModal(null)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <h3 className={styles.modalTitle}>정산 처리</h3>
            <p style={{ marginBottom: "12px", fontSize: "0.9rem" }}>
              <strong>{settleModal.title}</strong> ({settleModal.claimNo})<br />
              금액: {fmt(settleModal.totalAmount)}원
            </p>
            <div className={styles.formGroup} style={{ marginBottom: "12px" }}>
              <label className={styles.formLabel}>차변 계정 (경비)</label>
              <input
                className={styles.formInput}
                value={settleDebit}
                onChange={(e) => setSettleDebit(e.target.value)}
                placeholder="50800"
              />
              <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>기본: 50800 복리후생비</span>
            </div>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>대변 계정</label>
              <input
                className={styles.formInput}
                value={settleCredit}
                onChange={(e) => setSettleCredit(e.target.value)}
                placeholder="25300"
              />
              <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>기본: 25300 미지급금</span>
            </div>
            <div className={styles.modalActions}>
              <button className={styles.secondaryBtn} onClick={() => setSettleModal(null)}>
                취소
              </button>
              <button
                className={styles.primaryBtn}
                onClick={() =>
                  settleMutation.mutate({
                    id: settleModal.id,
                    debitAccountCode: settleDebit,
                    creditAccountCode: settleCredit,
                  })
                }
                disabled={settleMutation.isPending}
              >
                정산 실행
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
