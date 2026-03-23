"use client";

import styles from "./ExpenseClaims.module.css";
import { Employee, ExpenseItem, CATEGORIES, fmt, today } from "./types";

export interface ExpenseClaimFormProps {
  employees: Employee[];
  formEmployeeId: string;
  onFormEmployeeIdChange: (value: string) => void;
  formTitle: string;
  onFormTitleChange: (value: string) => void;
  formDate: string;
  onFormDateChange: (value: string) => void;
  formMemo: string;
  onFormMemoChange: (value: string) => void;
  formItems: ExpenseItem[];
  onAddItem: () => void;
  onRemoveItem: (idx: number) => void;
  onItemChange: (idx: number, field: keyof ExpenseItem, value: string | number) => void;
  totalAmount: number;
  onCreate: (andSubmit: boolean) => void;
  isCreating: boolean;
}

export default function ExpenseClaimForm({
  employees,
  formEmployeeId,
  onFormEmployeeIdChange,
  formTitle,
  onFormTitleChange,
  formDate,
  onFormDateChange,
  formMemo,
  onFormMemoChange,
  formItems,
  onAddItem,
  onRemoveItem,
  onItemChange,
  totalAmount,
  onCreate,
  isCreating,
}: ExpenseClaimFormProps) {
  return (
    <div className={styles.section}>
      <h2 className={styles.sectionTitle}>경비 신청서 작성</h2>
      <div className={styles.form}>
        <div className={styles.formGroup}>
          <label className={styles.formLabel}>직원</label>
          <select
            className={styles.formSelect}
            value={formEmployeeId}
            onChange={(e) => onFormEmployeeIdChange(e.target.value)}
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
            onChange={(e) => onFormDateChange(e.target.value)}
          />
        </div>
        <div className={styles.formGroupFull}>
          <label className={styles.formLabel}>제목</label>
          <input
            className={styles.formInput}
            value={formTitle}
            onChange={(e) => onFormTitleChange(e.target.value)}
            placeholder="예: 3월 출장 경비"
          />
        </div>
        <div className={styles.formGroupFull}>
          <label className={styles.formLabel}>메모</label>
          <textarea
            className={styles.formTextarea}
            value={formMemo}
            onChange={(e) => onFormMemoChange(e.target.value)}
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
            onChange={(e) => onItemChange(idx, "category", e.target.value)}
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <input
            className={styles.itemInput}
            value={item.description}
            onChange={(e) => onItemChange(idx, "description", e.target.value)}
            placeholder="내역"
          />
          <input
            className={styles.itemInput}
            type="number"
            value={item.amount || ""}
            onChange={(e) => onItemChange(idx, "amount", Number(e.target.value))}
            placeholder="0"
          />
          <input
            className={styles.itemInput}
            type="date"
            value={item.expenseDate}
            onChange={(e) => onItemChange(idx, "expenseDate", e.target.value)}
          />
          <button className={styles.removeItemBtn} onClick={() => onRemoveItem(idx)}>
            ×
          </button>
        </div>
      ))}
      <button className={styles.secondaryBtn} onClick={onAddItem} style={{ marginTop: "8px" }}>
        + 항목 추가
      </button>

      <div className={styles.totalRow}>
        <span>합계:</span>
        <span>{fmt(totalAmount)}원</span>
      </div>

      <div className={styles.formActions}>
        <button
          className={styles.secondaryBtn}
          onClick={() => onCreate(false)}
          disabled={isCreating}
        >
          임시저장
        </button>
        <button
          className={styles.primaryBtn}
          onClick={() => onCreate(true)}
          disabled={isCreating}
        >
          결재 요청
        </button>
      </div>
    </div>
  );
}
