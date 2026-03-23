"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { apiGet, apiPost, apiPatch, apiDelete } from "@/lib/api";
import type { Account, JournalRule, RuleForm } from "./types";
import { emptyForm } from "./types";
import JournalRuleForm from "./JournalRuleForm";
import JournalRuleTable from "./JournalRuleTable";
import styles from "./JournalRules.module.css";

export default function JournalRules() {
  const { tenantId, canEdit } = useAuth();
  const qc = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<RuleForm>(emptyForm);

  const { data: rules = [] } = useQuery({
    queryKey: ["journal-rules", tenantId],
    queryFn: () => apiGet<JournalRule[]>(`/journal-rules?tenantId=${tenantId}`),
    enabled: !!tenantId,
  });

  const { data: accounts = [] } = useQuery({
    queryKey: ["accounts", tenantId],
    queryFn: () => apiGet<Account[]>(`/accounts?tenantId=${tenantId}`),
    enabled: !!tenantId,
  });

  const createMut = useMutation({
    mutationFn: (data: Record<string, unknown>) => apiPost("/journal-rules", data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["journal-rules"] }); closeModal(); },
  });

  const updateMut = useMutation({
    mutationFn: ({ id, ...data }: Record<string, unknown> & { id: string }) => apiPatch(`/journal-rules/${id}`, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["journal-rules"] }); closeModal(); },
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => apiDelete(`/journal-rules/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["journal-rules"] }),
  });

  const toggleMut = useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) => apiPatch(`/journal-rules/${id}`, { enabled }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["journal-rules"] }),
  });

  const closeModal = () => {
    setShowModal(false);
    setEditingId(null);
    setForm(emptyForm);
  };

  const openCreate = () => {
    setForm(emptyForm);
    setEditingId(null);
    setShowModal(true);
  };

  const openEdit = (rule: JournalRule) => {
    setForm({
      name: rule.name,
      vendorName: rule.vendorName || "",
      keywords: rule.keywords || "",
      amountMin: rule.amountMin != null ? String(rule.amountMin) : "",
      amountMax: rule.amountMax != null ? String(rule.amountMax) : "",
      debitAccountId: rule.debitAccount.id,
      creditAccountId: rule.creditAccount.id,
      priority: String(rule.priority),
    });
    setEditingId(rule.id);
    setShowModal(true);
  };

  const handleSave = () => {
    const payload: Record<string, unknown> = {
      tenantId,
      name: form.name,
      vendorName: form.vendorName || undefined,
      keywords: form.keywords || undefined,
      amountMin: form.amountMin ? Number(form.amountMin) : undefined,
      amountMax: form.amountMax ? Number(form.amountMax) : undefined,
      debitAccountId: form.debitAccountId,
      creditAccountId: form.creditAccountId,
      priority: Number(form.priority) || 0,
    };

    if (editingId) {
      updateMut.mutate({ id: editingId, ...payload });
    } else {
      createMut.mutate(payload);
    }
  };

  const canSave = form.name && form.debitAccountId && form.creditAccountId;

  const expenseAccounts = accounts.filter((a) => a.type === "EXPENSE" || a.type === "ASSET");
  const creditAccounts = accounts.filter((a) => a.type === "ASSET" || a.type === "LIABILITY" || a.type === "EQUITY");

  return (
    <div>
      <h1 className={styles.title}>자동 전표 규칙</h1>

      <div className={styles.toolbar}>
        <span style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>
          영수증 인식 시 조건에 맞는 규칙으로 자동 전표 생성
        </span>
        {canEdit && (
          <button className={styles.addBtn} onClick={openCreate}>
            + 규칙 추가
          </button>
        )}
      </div>

      <JournalRuleTable
        rules={rules}
        canEdit={canEdit}
        onEdit={openEdit}
        onDelete={(id) => deleteMut.mutate(id)}
        onToggle={(id, enabled) => toggleMut.mutate({ id, enabled })}
      />

      {showModal && (
        <JournalRuleForm
          editingId={editingId}
          form={form}
          onFormChange={setForm}
          expenseAccounts={expenseAccounts}
          creditAccounts={creditAccounts}
          canSave={!!canSave}
          onSave={handleSave}
          onClose={closeModal}
        />
      )}
    </div>
  );
}
