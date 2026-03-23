"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost, apiPatch, apiDelete } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import styles from "./JournalTemplates.module.css";
import { Account, JournalTemplate, LineInput, emptyLine } from "./types";
import JournalTemplateForm from "./JournalTemplateForm";
import JournalTemplateTable from "./JournalTemplateTable";

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
        <JournalTemplateForm
          formMode={formMode}
          name={name}
          setName={setName}
          description={description}
          setDescription={setDescription}
          lines={lines}
          setLines={setLines}
          accounts={accounts}
          updateLine={updateLine}
          totalDebit={totalDebit}
          totalCredit={totalCredit}
          isBalanced={isBalanced}
          error={error}
          isPending={isPending}
          onSubmit={handleSubmit}
          onCancel={resetForm}
        />
      )}

      {/* 목록 */}
      <JournalTemplateTable
        templates={templates}
        canEdit={canEdit}
        canDelete={canDelete}
        onApply={(id) => setApplyId(id)}
        onEdit={startEdit}
        onDelete={(id) => deleteMut.mutate(id)}
      />

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
