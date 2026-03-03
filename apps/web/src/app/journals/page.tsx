"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost, apiPatch, apiDelete, TENANT_ID } from "@/lib/api";
import styles from "./page.module.css";

interface Account {
  id: string;
  code: string;
  name: string;
  type: string;
}

interface JournalLine {
  debit: string;
  credit: string;
  account: { id: string; code: string; name: string };
}

interface JournalEntry {
  id: string;
  date: string;
  description: string | null;
  status: string;
  documentId: string | null;
  lines: JournalLine[];
}

interface LineInput {
  accountId: string;
  debit: number;
  credit: number;
}

function statusLabel(status: string) {
  switch (status) {
    case "DRAFT": return { text: "임시", cls: styles.statusDraft };
    case "APPROVED": return { text: "승인", cls: styles.statusApproved };
    case "POSTED": return { text: "확정", cls: styles.statusPosted };
    default: return { text: status, cls: "" };
  }
}

export default function JournalsPage() {
  const queryClient = useQueryClient();
  const [formMode, setFormMode] = useState<"none" | "create" | "edit">("none");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [description, setDescription] = useState("");
  const [lines, setLines] = useState<LineInput[]>([
    { accountId: "", debit: 0, credit: 0 },
    { accountId: "", debit: 0, credit: 0 },
  ]);
  const [error, setError] = useState("");

  // 기간 필터
  const [filterStart, setFilterStart] = useState("");
  const [filterEnd, setFilterEnd] = useState("");

  const dateParams = [
    filterStart && `startDate=${filterStart}`,
    filterEnd && `endDate=${filterEnd}`,
  ].filter(Boolean).join("&");

  const { data: journals = [] } = useQuery({
    queryKey: ["journals", filterStart, filterEnd],
    queryFn: () => apiGet<JournalEntry[]>(`/journals?tenantId=${TENANT_ID}${dateParams ? `&${dateParams}` : ""}`),
  });

  const { data: accounts = [] } = useQuery({
    queryKey: ["accounts"],
    queryFn: () => apiGet<Account[]>(`/accounts?tenantId=${TENANT_ID}`),
    enabled: formMode !== "none",
  });

  const createMutation = useMutation({
    mutationFn: (body: {
      tenantId: string;
      date: string;
      description: string;
      lines: LineInput[];
    }) => apiPost<JournalEntry>("/journals", body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["journals"] });
      resetForm();
    },
    onError: (err: Error) => setError(err.message),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Record<string, unknown> }) =>
      apiPatch<JournalEntry>(`/journals/${id}`, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["journals"] });
      resetForm();
    },
    onError: (err: Error) => setError(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiDelete(`/journals/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["journals"] });
      queryClient.invalidateQueries({ queryKey: ["documents"] });
    },
  });

  const resetForm = () => {
    setFormMode("none");
    setEditingId(null);
    setDate(new Date().toISOString().slice(0, 10));
    setDescription("");
    setLines([
      { accountId: "", debit: 0, credit: 0 },
      { accountId: "", debit: 0, credit: 0 },
    ]);
    setError("");
  };

  const startEdit = (j: JournalEntry) => {
    setFormMode("edit");
    setEditingId(j.id);
    setDate(new Date(j.date).toISOString().slice(0, 10));
    setDescription(j.description || "");
    setLines(
      j.lines.map((l) => ({
        accountId: l.account.id,
        debit: Number(l.debit),
        credit: Number(l.credit),
      })),
    );
    setError("");
  };

  const updateLine = (index: number, field: keyof LineInput, value: string) => {
    setLines((prev) =>
      prev.map((l, i) =>
        i === index
          ? { ...l, [field]: field === "accountId" ? value : Number(value) || 0 }
          : l,
      ),
    );
  };

  const addLine = () => {
    setLines((prev) => [...prev, { accountId: "", debit: 0, credit: 0 }]);
  };

  const removeLine = (index: number) => {
    if (lines.length <= 2) return;
    setLines((prev) => prev.filter((_, i) => i !== index));
  };

  const totalDebit = lines.reduce((s, l) => s + l.debit, 0);
  const totalCredit = lines.reduce((s, l) => s + l.credit, 0);
  const isBalanced = Math.abs(totalDebit - totalCredit) < 0.01;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (lines.some((l) => !l.accountId)) {
      setError("모든 라인의 계정을 선택해주세요");
      return;
    }
    if (!isBalanced) {
      setError("차변과 대변의 합계가 일치하지 않습니다");
      return;
    }
    if (totalDebit === 0) {
      setError("금액을 입력해주세요");
      return;
    }

    if (formMode === "edit" && editingId) {
      updateMutation.mutate({
        id: editingId,
        body: { date, description, lines },
      });
    } else {
      createMutation.mutate({
        tenantId: TENANT_ID,
        date,
        description,
        lines,
      });
    }
  };

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      apiPatch<JournalEntry>(`/journals/${id}`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["journals"] });
    },
  });

  const handleDelete = (id: string) => {
    if (confirm("이 전표를 삭제하시겠습니까?")) {
      deleteMutation.mutate(id);
    }
  };

  const nextStatus = (current: string): { label: string; next: string } | null => {
    switch (current) {
      case "DRAFT": return { label: "승인", next: "APPROVED" };
      case "APPROVED": return { label: "확정", next: "POSTED" };
      default: return null;
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <div>
      <div className={styles.header}>
        <h1 className={styles.title}>전표 관리</h1>
        {formMode === "none" && (
          <button
            className={styles.addBtn}
            onClick={() => setFormMode("create")}
          >
            수기 전표 추가
          </button>
        )}
      </div>

      {formMode !== "none" && (
        <div className={styles.formSection}>
          <h2 className={styles.sectionTitle}>
            {formMode === "edit" ? "전표 수정" : "수기 전표 입력"}
          </h2>
          <form onSubmit={handleSubmit}>
            <div className={styles.formTop}>
              <div className={styles.formRow}>
                <label className={styles.label}>날짜</label>
                <input
                  className={styles.input}
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  required
                />
              </div>
              <div className={styles.formRow} style={{ flex: 1 }}>
                <label className={styles.label}>설명</label>
                <input
                  className={styles.input}
                  type="text"
                  placeholder="예: 사무용품 구매"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>
            </div>

            <div className={styles.linesHeader}>
              <span>계정과목</span>
              <span>차변</span>
              <span>대변</span>
              <span></span>
            </div>

            {lines.map((line, i) => (
              <div key={i} className={styles.lineRow}>
                <select
                  className={styles.select}
                  value={line.accountId}
                  onChange={(e) => updateLine(i, "accountId", e.target.value)}
                >
                  <option value="">계정 선택</option>
                  {accounts.map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.code} {acc.name}
                    </option>
                  ))}
                </select>
                <input
                  className={styles.input}
                  type="number"
                  value={line.debit || ""}
                  onChange={(e) => updateLine(i, "debit", e.target.value)}
                  placeholder="0"
                  min={0}
                />
                <input
                  className={styles.input}
                  type="number"
                  value={line.credit || ""}
                  onChange={(e) => updateLine(i, "credit", e.target.value)}
                  placeholder="0"
                  min={0}
                />
                <button
                  type="button"
                  className={styles.removeBtn}
                  onClick={() => removeLine(i)}
                  disabled={lines.length <= 2}
                >
                  X
                </button>
              </div>
            ))}

            <div className={styles.lineFooter}>
              <button
                type="button"
                className={styles.addLineBtn}
                onClick={addLine}
              >
                + 라인 추가
              </button>
              <div className={styles.totals}>
                <span>차변: {totalDebit.toLocaleString()}원</span>
                <span>대변: {totalCredit.toLocaleString()}원</span>
                <span className={isBalanced ? styles.balanced : styles.unbalanced}>
                  {isBalanced ? "균형" : "불균형"}
                </span>
              </div>
            </div>

            {error && <p className={styles.error}>{error}</p>}

            <div className={styles.formActions}>
              <button
                type="submit"
                className={styles.submitBtn}
                disabled={isPending || !isBalanced}
              >
                {isPending
                  ? "저장 중..."
                  : formMode === "edit"
                    ? "수정 저장"
                    : "전표 저장"}
              </button>
              <button
                type="button"
                className={styles.cancelFormBtn}
                onClick={resetForm}
              >
                취소
              </button>
            </div>
          </form>
        </div>
      )}

      <div className={styles.tableSection}>
        <div className={styles.tableHeader}>
          <h2 className={styles.sectionTitle}>전표 목록</h2>
          <div className={styles.filterRow}>
            <span className={styles.filterLabel}>전표일 기준</span>
            <input
              className={styles.filterInput}
              type="date"
              value={filterStart}
              onChange={(e) => setFilterStart(e.target.value)}
            />
            <span className={styles.filterSep}>~</span>
            <input
              className={styles.filterInput}
              type="date"
              value={filterEnd}
              onChange={(e) => setFilterEnd(e.target.value)}
            />
            {(filterStart || filterEnd) && (
              <button
                className={styles.filterClear}
                onClick={() => { setFilterStart(""); setFilterEnd(""); }}
              >
                초기화
              </button>
            )}
          </div>
        </div>
        <table>
          <thead>
            <tr>
              <th>날짜</th>
              <th>설명</th>
              <th>상태</th>
              <th>차변 합계</th>
              <th>대변 합계</th>
              <th>영수증</th>
              <th>관리</th>
            </tr>
          </thead>
          <tbody>
            {journals.map((j) => {
              const s = statusLabel(j.status);
              const jTotalDebit = j.lines.reduce((sum, l) => sum + Number(l.debit), 0);
              const jTotalCredit = j.lines.reduce((sum, l) => sum + Number(l.credit), 0);
              return (
                <tr key={j.id}>
                  <td>{new Date(j.date).toLocaleDateString("ko-KR")}</td>
                  <td>{j.description || "-"}</td>
                  <td>
                    <span className={`${styles.status} ${s.cls}`}>{s.text}</span>
                  </td>
                  <td>{jTotalDebit.toLocaleString()}원</td>
                  <td>{jTotalCredit.toLocaleString()}원</td>
                  <td>{j.documentId ? "O" : "-"}</td>
                  <td>
                    <div className={styles.actions}>
                      {nextStatus(j.status) && (
                        <button
                          className={styles.statusBtn}
                          onClick={() => {
                            const ns = nextStatus(j.status)!;
                            statusMutation.mutate({ id: j.id, status: ns.next });
                          }}
                          disabled={statusMutation.isPending}
                        >
                          {nextStatus(j.status)!.label}
                        </button>
                      )}
                      {j.status !== "POSTED" && (
                        <>
                          <button
                            className={styles.editBtn}
                            onClick={() => startEdit(j)}
                          >
                            수정
                          </button>
                          <button
                            className={styles.deleteBtn}
                            onClick={() => handleDelete(j.id)}
                          >
                            삭제
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
            {journals.length === 0 && (
              <tr>
                <td colSpan={7} style={{ textAlign: "center", color: "var(--text-muted)" }}>
                  전표가 없습니다
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
