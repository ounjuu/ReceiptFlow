"use client";

import styles from "./Vendors.module.css";

interface VendorFormProps {
  name: string;
  bizNo: string;
  onNameChange: (value: string) => void;
  onBizNoChange: (value: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  isPending: boolean;
  error: string;
}

export default function VendorForm({
  name,
  bizNo,
  onNameChange,
  onBizNoChange,
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
