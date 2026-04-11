"use client";

import { CREDIT_RATINGS } from "./types";
import styles from "./Vendors.module.css";

interface VendorFormProps {
  name: string;
  bizNo: string;
  creditRating: string;
  creditLimit: string;
  note: string;
  onNameChange: (value: string) => void;
  onBizNoChange: (value: string) => void;
  onCreditRatingChange: (value: string) => void;
  onCreditLimitChange: (value: string) => void;
  onNoteChange: (value: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  isPending: boolean;
  error: string;
}

export default function VendorForm({
  name,
  bizNo,
  creditRating,
  creditLimit,
  note,
  onNameChange,
  onBizNoChange,
  onCreditRatingChange,
  onCreditLimitChange,
  onNoteChange,
  onSubmit,
  isPending,
  error,
}: VendorFormProps) {
  return (
    <div className={styles.formSection}>
      <h2 className={styles.sectionTitle}>거래처 등록</h2>
      <form className={styles.form} onSubmit={onSubmit}>
        <div className={styles.formRow}>
          <label className={styles.label}>거래처명</label>
          <input
            className={styles.input}
            value={name}
            onChange={(e) => onNameChange(e.target.value)}
            placeholder="거래처명"
            required
          />
        </div>
        <div className={styles.formRow}>
          <label className={styles.label}>사업자등록번호</label>
          <input
            className={styles.input}
            value={bizNo}
            onChange={(e) => onBizNoChange(e.target.value)}
            placeholder="000-00-00000"
          />
        </div>
        <div className={styles.formRow}>
          <label className={styles.label}>신용등급</label>
          <select
            className={styles.input}
            value={creditRating}
            onChange={(e) => onCreditRatingChange(e.target.value)}
          >
            <option value="">선택 안함</option>
            {CREDIT_RATINGS.map((r) => (
              <option key={r.code} value={r.code}>
                {r.name}
              </option>
            ))}
          </select>
        </div>
        <div className={styles.formRow}>
          <label className={styles.label}>거래한도</label>
          <input
            className={styles.input}
            type="number"
            min="0"
            value={creditLimit}
            onChange={(e) => onCreditLimitChange(e.target.value)}
            placeholder="0"
          />
        </div>
        <div className={styles.formRow}>
          <label className={styles.label}>메모</label>
          <textarea
            className={styles.input}
            value={note}
            onChange={(e) => onNoteChange(e.target.value)}
            placeholder="거래처 관련 메모"
            rows={2}
          />
        </div>
        <button
          type="submit"
          className={styles.submitBtn}
          disabled={isPending}
        >
          {isPending ? "등록 중..." : "등록"}
        </button>
      </form>
      {error && <p className={styles.error}>{error}</p>}
    </div>
  );
}
