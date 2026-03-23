"use client";

import type { Account, RuleForm } from "./types";
import styles from "./JournalRules.module.css";

interface JournalRuleFormProps {
  editingId: string | null;
  form: RuleForm;
  onFormChange: (form: RuleForm) => void;
  expenseAccounts: Account[];
  creditAccounts: Account[];
  canSave: boolean;
  onSave: () => void;
  onClose: () => void;
}

export default function JournalRuleForm({
  editingId,
  form,
  onFormChange,
  expenseAccounts,
  creditAccounts,
  canSave,
  onSave,
  onClose,
}: JournalRuleFormProps) {
  return (
    <div className={styles.overlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className={styles.modal}>
        <h2 className={styles.modalTitle}>{editingId ? "규칙 수정" : "규칙 추가"}</h2>

        <div className={styles.field}>
          <label className={styles.label}>규칙 이름 *</label>
          <input className={styles.input} value={form.name} onChange={(e) => onFormChange({ ...form, name: e.target.value })} placeholder="예: 식대 자동 분류" />
        </div>

        <div className={styles.field}>
          <label className={styles.label}>거래처명 (포함 매칭)</label>
          <input className={styles.input} value={form.vendorName} onChange={(e) => onFormChange({ ...form, vendorName: e.target.value })} placeholder="비워두면 전체 거래처" />
        </div>

        <div className={styles.field}>
          <label className={styles.label}>키워드 (쉼표 구분)</label>
          <input className={styles.input} value={form.keywords} onChange={(e) => onFormChange({ ...form, keywords: e.target.value })} placeholder="예: 배달,음식,식당" />
        </div>

        <div className={styles.row}>
          <div className={styles.field}>
            <label className={styles.label}>최소 금액</label>
            <input className={styles.input} type="number" value={form.amountMin} onChange={(e) => onFormChange({ ...form, amountMin: e.target.value })} placeholder="0" />
          </div>
          <div className={styles.field}>
            <label className={styles.label}>최대 금액</label>
            <input className={styles.input} type="number" value={form.amountMax} onChange={(e) => onFormChange({ ...form, amountMax: e.target.value })} placeholder="무제한" />
          </div>
        </div>

        <div className={styles.row}>
          <div className={styles.field}>
            <label className={styles.label}>차변 계정 *</label>
            <select className={styles.select} value={form.debitAccountId} onChange={(e) => onFormChange({ ...form, debitAccountId: e.target.value })}>
              <option value="">선택</option>
              {expenseAccounts.map((a) => (
                <option key={a.id} value={a.id}>{a.code} {a.name}</option>
              ))}
            </select>
          </div>
          <div className={styles.field}>
            <label className={styles.label}>대변 계정 *</label>
            <select className={styles.select} value={form.creditAccountId} onChange={(e) => onFormChange({ ...form, creditAccountId: e.target.value })}>
              <option value="">선택</option>
              {creditAccounts.map((a) => (
                <option key={a.id} value={a.id}>{a.code} {a.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div className={styles.field}>
          <label className={styles.label}>우선순위 (높을수록 먼저 적용)</label>
          <input className={styles.input} type="number" value={form.priority} onChange={(e) => onFormChange({ ...form, priority: e.target.value })} />
        </div>

        <div className={styles.modalActions}>
          <button className={styles.cancelBtn} onClick={onClose}>취소</button>
          <button className={styles.saveBtn} onClick={onSave} disabled={!canSave}>
            {editingId ? "수정" : "추가"}
          </button>
        </div>
      </div>
    </div>
  );
}
