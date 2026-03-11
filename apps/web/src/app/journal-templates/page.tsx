"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost, apiPatch, apiDelete } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import styles from "./page.module.css";

interface Account {
  id: string;
  code: string;
  name: string;
}

interface TemplateLine {
  debit: string;
  credit: string;
  account: { id: string; code: string; name: string };
  vendor: { id: string; name: string } | null;
}

interface JournalTemplate {
  id: string;
  name: string;
  description: string | null;
  lines: TemplateLine[];
}

interface LineInput {
  accountId: string;
  vendorId: string;
  debit: number;
  credit: number;
}

const emptyLine = (): LineInput => ({ accountId: "", vendorId: "", debit: 0, credit: 0 });

export default function JournalTemplatesPage() {
  const { tenantId, canEdit, canDelete } = useAuth();
  const queryClient = useQueryClient();

  const [formMode, setFormMode] = useState<"none" | "create" | "edit">("none");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [lines, setLines] = useState<LineInput[]>([emptyLine(), emptyLine()]);
  const [error, setError] = useState("");

  // 적용 모달
  const [applyId, setApplyId] = useState<string | null>(null);
  const [applyDate, setApplyDate] = useState(new Date().toISOString().slice(0, 10));

  const { data: templates = [] } = useQuery({
    queryKey: ["journal-templates"],
    queryFn: () => apiGet<JournalTemplate[]>(`/journal-templates?tenantId=${tenantId}`),
  });

  const { data: accounts = [] } = useQuery({
    queryKey: ["accounts"],
    queryFn: () => apiGet<Account[]>(`/accounts?tenantId=${tenantId}`),
    enabled: formMode !== "none",
  });

  const createMut = useMutation({
    mutationFn: (body: { tenantId: string; name: string; description: string; lines: { accountId: string; vendorId?: string; debit: number; credit: number }[] }) =>
      apiPost("/journal-templates", body),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["journal-templates"] }); resetForm(); },
    onError: (err: Error) => setError(err.message),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Record<string, unknown> }) =>
      apiPatch(`/journal-templates/${id}`, body),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["journal-templates"] }); resetForm(); },
    onError: (err: Error) => setError(err.message),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => apiDelete(`/journal-templates/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["journal-templates"] }),
  });

  const applyMut = useMutation({
    mutationFn: ({ id, date }: { id: string; date: string }) =>
      apiPost(`/journal-templates/${id}/apply`, { tenantId, date }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["journals"] });
      setApplyId(null);
      alert("전표가 생성되었습니다.");
    },
    onError: (err: Error) => alert(err.message),
  });

  const resetForm = () => {
    setFormMode("none");
    setEditingId(null);
    setName("");
    setDescription("");
    setLines([emptyLine(), emptyLine()]);
    setError("");
  };

  const startEdit = (t: JournalTemplate) => {
    setFormMode("edit");
    setEditingId(t.id);
    setName(t.name);
    setDescription(t.description || "");
    setLines(t.lines.map((l) => ({
      accountId: l.account.id,
      vendorId: l.vendor?.id || "",
      debit: Number(l.debit),
      credit: Number(l.credit),
    })));
    setError("");
  };

  const updateLine = (i: number, field: keyof LineInput, value: string) => {
    setLines((prev) => prev.map((l, idx) => {
      if (idx !== i) return l;
      if (field === "debit" || field === "credit") return { ...l, [field]: Number(value) || 0 };
      return { ...l, [field]: value };
    }));
  };

  const totalDebit = lines.reduce((s, l) => s + l.debit, 0);
  const totalCredit = lines.reduce((s, l) => s + l.credit, 0);
  const isBalanced = Math.abs(totalDebit - totalCredit) < 0.01;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!name.trim()) { setError("템플릿 이름을 입력해주세요"); return; }
    if (lines.some((l) => !l.accountId)) { setError("모든 라인의 계정을 선택해주세요"); return; }
    if (!isBalanced) { setError("차변과 대변의 합계가 일치하지 않습니다"); return; }
    if (totalDebit === 0) { setError("금액을 입력해주세요"); return; }

    const submitLines = lines.map((l) => ({
      accountId: l.accountId,
      vendorId: l.vendorId || undefined,
      debit: l.debit,
      credit: l.credit,
    }));

    if (formMode === "edit" && editingId) {
      updateMut.mutate({ id: editingId, body: { name, description, lines: submitLines } });
    } else {
      createMut.mutate({ tenantId: tenantId!, name, description, lines: submitLines });
    }
  };

  const isPending = createMut.isPending || updateMut.isPending;

  return (
    <div>
      <div className={styles.header}>
        <h1 className={styles.title}>반복 전표</h1>
        {formMode === "none" && canEdit && (
          <button className={styles.addBtn} onClick={() => setFormMode("create")}>
            템플릿 추가
          </button>
        )}
      </div>

      {/* 생성/수정 폼 */}
      {formMode !== "none" && (
        <div className={styles.formSection}>
          <h2 className={styles.sectionTitle}>
            {formMode === "edit" ? "템플릿 수정" : "템플릿 등록"}
          </h2>
          <form onSubmit={handleSubmit}>
            <div className={styles.formTop}>
              <div className={styles.formRow}>
                <label className={styles.label}>템플릿 이름</label>
                <input
                  className={styles.input}
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="예: 월세 납부"
                  required
                />
              </div>
              <div className={styles.formRow} style={{ flex: 1 }}>
                <label className={styles.label}>설명</label>
                <input
                  className={styles.input}
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="예: 매월 사무실 월세"
                />
              </div>
            </div>

            <div className={styles.linesHeader}>
              <span>계정과목</span>
              <span>거래처 (선택)</span>
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
                    <option key={acc.id} value={acc.id}>{acc.code} {acc.name}</option>
                  ))}
                </select>
                <select
                  className={styles.select}
                  value={line.vendorId}
                  onChange={(e) => updateLine(i, "vendorId", e.target.value)}
                >
                  <option value="">거래처 없음</option>
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
                  onClick={() => lines.length > 2 && setLines((prev) => prev.filter((_, idx) => idx !== i))}
                  disabled={lines.length <= 2}
                >
                  X
                </button>
              </div>
            ))}

            <div className={styles.lineFooter}>
              <button type="button" className={styles.addLineBtn} onClick={() => setLines((prev) => [...prev, emptyLine()])}>
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
              <button type="submit" className={styles.submitBtn} disabled={isPending || !isBalanced}>
                {isPending ? "저장 중..." : formMode === "edit" ? "수정 저장" : "템플릿 저장"}
              </button>
              <button type="button" className={styles.cancelFormBtn} onClick={resetForm}>취소</button>
            </div>
          </form>
        </div>
      )}

      {/* 목록 */}
      <div className={styles.tableSection}>
        <h2 className={styles.sectionTitle}>템플릿 목록</h2>
        {templates.length > 0 ? (
          <table>
            <thead>
              <tr>
                <th>이름</th>
                <th>설명</th>
                <th>라인 수</th>
                <th>차변 합계</th>
                <th>관리</th>
              </tr>
            </thead>
            <tbody>
              {templates.map((t) => {
                const tDebit = t.lines.reduce((s, l) => s + Number(l.debit), 0);
                return (
                  <tr key={t.id}>
                    <td style={{ fontWeight: 600 }}>{t.name}</td>
                    <td>{t.description || "-"}</td>
                    <td>{t.lines.length}건</td>
                    <td>{tDebit.toLocaleString()}원</td>
                    <td>
                      <div className={styles.actions}>
                        {canEdit && (
                          <button className={styles.applyBtn} onClick={() => setApplyId(t.id)}>
                            적용
                          </button>
                        )}
                        {canEdit && (
                          <button className={styles.editBtn} onClick={() => startEdit(t)}>
                            수정
                          </button>
                        )}
                        {canDelete && (
                          <button
                            className={styles.deleteBtn}
                            onClick={() => { if (confirm("이 템플릿을 삭제하시겠습니까?")) deleteMut.mutate(t.id); }}
                          >
                            삭제
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <p className={styles.empty}>등록된 템플릿이 없습니다</p>
        )}
      </div>

      {/* 적용 모달 */}
      {applyId && (
        <div className={styles.applyOverlay} onClick={() => setApplyId(null)}>
          <div className={styles.applyModal} onClick={(e) => e.stopPropagation()}>
            <h3>전표 생성</h3>
            <div className={styles.formRow}>
              <label className={styles.label}>전표 날짜</label>
              <input
                className={styles.input}
                type="date"
                value={applyDate}
                onChange={(e) => setApplyDate(e.target.value)}
              />
            </div>
            <div className={styles.applyActions}>
              <button
                className={styles.submitBtn}
                disabled={applyMut.isPending}
                onClick={() => applyMut.mutate({ id: applyId, date: applyDate })}
              >
                {applyMut.isPending ? "생성 중..." : "전표 생성"}
              </button>
              <button className={styles.cancelFormBtn} onClick={() => setApplyId(null)}>취소</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
