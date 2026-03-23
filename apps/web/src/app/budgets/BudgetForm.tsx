"use client";

import styles from "./Budgets.module.css";
import type { AccountOption } from "./types";

interface BudgetFormProps {
  formAccountId: string;
  setFormAccountId: (v: string) => void;
  formMonth: number;
  setFormMonth: (v: number) => void;
  formAmount: string;
  setFormAmount: (v: string) => void;
  formNote: string;
  setFormNote: (v: string) => void;
  bulkMode: boolean;
  setBulkMode: (v: boolean) => void;
  expenseAccounts: AccountOption[];
  isPending: boolean;
  onSubmit: () => void;
  onCancel: () => void;
}

export default function BudgetForm({
  formAccountId,
  setFormAccountId,
  formMonth,
  setFormMonth,
  formAmount,
  setFormAmount,
  formNote,
  setFormNote,
  bulkMode,
  setBulkMode,
  expenseAccounts,
  isPending,
  onSubmit,
  onCancel,
}: BudgetFormProps) {
  return (
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
        <button className={styles.secondaryBtn} onClick={onCancel}>
          취소
        </button>
        <button
          className={styles.primaryBtn}
          onClick={onSubmit}
          disabled={isPending}
        >
          {isPending ? "저장 중..." : "저장"}
        </button>
      </div>
    </div>
  );
}
