"use client";

import styles from "./Departments.module.css";

export interface DepartmentFormProps {
  editingId: string | null;
  formCode: string;
  formName: string;
  formDesc: string;
  formManager: string;
  formBudget: string;
  formError: string;
  isPending: boolean;
  onCodeChange: (value: string) => void;
  onNameChange: (value: string) => void;
  onDescChange: (value: string) => void;
  onManagerChange: (value: string) => void;
  onBudgetChange: (value: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
}

export default function DepartmentForm({
  editingId,
  formCode,
  formName,
  formDesc,
  formManager,
  formBudget,
  formError,
  isPending,
  onCodeChange,
  onNameChange,
  onDescChange,
  onManagerChange,
  onBudgetChange,
  onSubmit,
  onCancel,
}: DepartmentFormProps) {
  return (
    <div className={styles.form}>
      <div className={styles.formGroup}>
        <label className={styles.formLabel}>코드 *</label>
        <input
          className={styles.formInput}
          value={formCode}
          onChange={(e) => onCodeChange(e.target.value)}
          placeholder="DP-001"
          readOnly={!!editingId}
        />
      </div>
      <div className={styles.formGroup}>
        <label className={styles.formLabel}>이름 *</label>
        <input
          className={styles.formInput}
          value={formName}
          onChange={(e) => onNameChange(e.target.value)}
          placeholder="부서명"
        />
      </div>
      <div className={styles.formGroup}>
        <label className={styles.formLabel}>담당자</label>
        <input
          className={styles.formInput}
          value={formManager}
          onChange={(e) => onManagerChange(e.target.value)}
          placeholder="담당자명"
        />
      </div>
      <div className={styles.formGroup}>
        <label className={styles.formLabel}>예산</label>
        <input
          className={styles.formInput}
          type="number"
          value={formBudget}
          onChange={(e) => onBudgetChange(e.target.value)}
          placeholder="0"
        />
      </div>
      <div className={styles.formGroupFull}>
        <label className={styles.formLabel}>설명</label>
        <input
          className={styles.formInput}
          value={formDesc}
          onChange={(e) => onDescChange(e.target.value)}
          placeholder="부서 설명"
        />
      </div>
      {formError && (
        <div className={styles.formGroupFull} style={{ color: "var(--danger)", fontSize: "0.85rem" }}>
          {formError}
        </div>
      )}
      <div className={styles.formActions}>
        <button className={styles.secondaryBtn} onClick={onCancel}>
          취소
        </button>
        <button
          className={styles.primaryBtn}
          onClick={onSubmit}
          disabled={isPending}
        >
          {isPending ? "저장 중..." : editingId ? "수정" : "등록"}
        </button>
      </div>
    </div>
  );
}
