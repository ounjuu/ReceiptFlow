"use client";

import styles from "./Payroll.module.css";

interface PayrollFormProps {
  formNo: string;
  setFormNo: (v: string) => void;
  formName: string;
  setFormName: (v: string) => void;
  formDept: string;
  setFormDept: (v: string) => void;
  formPosition: string;
  setFormPosition: (v: string) => void;
  formJoinDate: string;
  setFormJoinDate: (v: string) => void;
  formSalary: string;
  setFormSalary: (v: string) => void;
  onCancel: () => void;
  onCreate: () => void;
  isPending: boolean;
}

export default function PayrollForm({
  formNo,
  setFormNo,
  formName,
  setFormName,
  formDept,
  setFormDept,
  formPosition,
  setFormPosition,
  formJoinDate,
  setFormJoinDate,
  formSalary,
  setFormSalary,
  onCancel,
  onCreate,
  isPending,
}: PayrollFormProps) {
  return (
    <div className={styles.form}>
      <div className={styles.formGroup}>
        <label className={styles.formLabel}>사번 *</label>
        <input
          className={styles.formInput}
          value={formNo}
          onChange={(e) => setFormNo(e.target.value)}
          placeholder="예: EMP001"
        />
      </div>
      <div className={styles.formGroup}>
        <label className={styles.formLabel}>이름 *</label>
        <input
          className={styles.formInput}
          value={formName}
          onChange={(e) => setFormName(e.target.value)}
          placeholder="홍길동"
        />
      </div>
      <div className={styles.formGroup}>
        <label className={styles.formLabel}>부서</label>
        <input
          className={styles.formInput}
          value={formDept}
          onChange={(e) => setFormDept(e.target.value)}
          placeholder="경영지원팀"
        />
      </div>
      <div className={styles.formGroup}>
        <label className={styles.formLabel}>직급</label>
        <input
          className={styles.formInput}
          value={formPosition}
          onChange={(e) => setFormPosition(e.target.value)}
          placeholder="대리"
        />
      </div>
      <div className={styles.formGroup}>
        <label className={styles.formLabel}>입사일 *</label>
        <input
          className={styles.formInput}
          type="date"
          value={formJoinDate}
          onChange={(e) => setFormJoinDate(e.target.value)}
        />
      </div>
      <div className={styles.formGroup}>
        <label className={styles.formLabel}>월 기본급 *</label>
        <input
          className={styles.formInput}
          type="number"
          value={formSalary}
          onChange={(e) => setFormSalary(e.target.value)}
          placeholder="3000000"
        />
      </div>
      <div className={styles.formActions}>
        <button
          className={styles.secondaryBtn}
          onClick={onCancel}
        >
          취소
        </button>
        <button
          className={styles.primaryBtn}
          onClick={onCreate}
          disabled={isPending}
        >
          {isPending ? "등록 중..." : "등록"}
        </button>
      </div>
    </div>
  );
}
