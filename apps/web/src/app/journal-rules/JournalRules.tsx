"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { apiGet, apiPost, apiPatch, apiDelete } from "@/lib/api";
import styles from "./JournalRules.module.css";

interface Account {
  id: string;
  code: string;
  name: string;
  type: string;
}

interface JournalRule {
  id: string;
  name: string;
  vendorName: string | null;
  keywords: string | null;
  amountMin: number | null;
  amountMax: number | null;
  debitAccount: Account;
  creditAccount: Account;
  priority: number;
  enabled: boolean;
}

interface RuleForm {
  name: string;
  vendorName: string;
  keywords: string;
  amountMin: string;
  amountMax: string;
  debitAccountId: string;
  creditAccountId: string;
  priority: string;
}

const emptyForm: RuleForm = {
  name: "",
  vendorName: "",
  keywords: "",
  amountMin: "",
  amountMax: "",
  debitAccountId: "",
  creditAccountId: "",
  priority: "0",
};

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

  const fmtAmount = (v: number | null) => v != null ? `₩${Number(v).toLocaleString()}` : "-";

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

      {rules.length === 0 ? (
        <p className={styles.empty}>등록된 규칙이 없습니다</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>우선순위</th>
              <th>이름</th>
              <th>거래처</th>
              <th>키워드</th>
              <th>금액 범위</th>
              <th>차변</th>
              <th>대변</th>
              <th>상태</th>
              {canEdit && <th>관리</th>}
            </tr>
          </thead>
          <tbody>
            {rules.map((rule) => (
              <tr key={rule.id}>
                <td><span className={styles.priority}>{rule.priority}</span></td>
                <td>{rule.name}</td>
                <td><span className={styles.vendorName}>{rule.vendorName || "전체"}</span></td>
                <td><span className={styles.keywords}>{rule.keywords || "-"}</span></td>
                <td>
                  <span className={styles.amountRange}>
                    {rule.amountMin != null || rule.amountMax != null
                      ? `${fmtAmount(rule.amountMin)} ~ ${fmtAmount(rule.amountMax)}`
                      : "전체"}
                  </span>
                </td>
                <td>{rule.debitAccount.code} {rule.debitAccount.name}</td>
                <td>{rule.creditAccount.code} {rule.creditAccount.name}</td>
                <td>
                  <span
                    className={styles.enabledBadge}
                    data-enabled={String(rule.enabled)}
                    style={{ cursor: canEdit ? "pointer" : "default" }}
                    onClick={() => canEdit && toggleMut.mutate({ id: rule.id, enabled: !rule.enabled })}
                  >
                    {rule.enabled ? "활성" : "비활성"}
                  </span>
                </td>
                {canEdit && (
                  <td>
                    <div className={styles.actions}>
                      <button className={styles.editBtn} onClick={() => openEdit(rule)}>수정</button>
                      <button className={styles.deleteBtn} onClick={() => { if (confirm("삭제하시겠습니까?")) deleteMut.mutate(rule.id); }}>삭제</button>
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {showModal && (
        <div className={styles.overlay} onClick={(e) => e.target === e.currentTarget && closeModal()}>
          <div className={styles.modal}>
            <h2 className={styles.modalTitle}>{editingId ? "규칙 수정" : "규칙 추가"}</h2>

            <div className={styles.field}>
              <label className={styles.label}>규칙 이름 *</label>
              <input className={styles.input} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="예: 식대 자동 분류" />
            </div>

            <div className={styles.field}>
              <label className={styles.label}>거래처명 (포함 매칭)</label>
              <input className={styles.input} value={form.vendorName} onChange={(e) => setForm({ ...form, vendorName: e.target.value })} placeholder="비워두면 전체 거래처" />
            </div>

            <div className={styles.field}>
              <label className={styles.label}>키워드 (쉼표 구분)</label>
              <input className={styles.input} value={form.keywords} onChange={(e) => setForm({ ...form, keywords: e.target.value })} placeholder="예: 배달,음식,식당" />
            </div>

            <div className={styles.row}>
              <div className={styles.field}>
                <label className={styles.label}>최소 금액</label>
                <input className={styles.input} type="number" value={form.amountMin} onChange={(e) => setForm({ ...form, amountMin: e.target.value })} placeholder="0" />
              </div>
              <div className={styles.field}>
                <label className={styles.label}>최대 금액</label>
                <input className={styles.input} type="number" value={form.amountMax} onChange={(e) => setForm({ ...form, amountMax: e.target.value })} placeholder="무제한" />
              </div>
            </div>

            <div className={styles.row}>
              <div className={styles.field}>
                <label className={styles.label}>차변 계정 *</label>
                <select className={styles.select} value={form.debitAccountId} onChange={(e) => setForm({ ...form, debitAccountId: e.target.value })}>
                  <option value="">선택</option>
                  {expenseAccounts.map((a) => (
                    <option key={a.id} value={a.id}>{a.code} {a.name}</option>
                  ))}
                </select>
              </div>
              <div className={styles.field}>
                <label className={styles.label}>대변 계정 *</label>
                <select className={styles.select} value={form.creditAccountId} onChange={(e) => setForm({ ...form, creditAccountId: e.target.value })}>
                  <option value="">선택</option>
                  {creditAccounts.map((a) => (
                    <option key={a.id} value={a.id}>{a.code} {a.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className={styles.field}>
              <label className={styles.label}>우선순위 (높을수록 먼저 적용)</label>
              <input className={styles.input} type="number" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })} />
            </div>

            <div className={styles.modalActions}>
              <button className={styles.cancelBtn} onClick={closeModal}>취소</button>
              <button className={styles.saveBtn} onClick={handleSave} disabled={!canSave}>
                {editingId ? "수정" : "추가"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
