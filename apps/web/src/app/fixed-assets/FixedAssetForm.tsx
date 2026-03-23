"use client";

import styles from "./FixedAssets.module.css";
import type { AccountOption } from "./types";

interface FixedAssetFormProps {
  formName: string;
  setFormName: (v: string) => void;
  formDesc: string;
  setFormDesc: (v: string) => void;
  formAssetAccountId: string;
  setFormAssetAccountId: (v: string) => void;
  formDepAccountId: string;
  setFormDepAccountId: (v: string) => void;
  formAccumAccountId: string;
  setFormAccumAccountId: (v: string) => void;
  formDate: string;
  setFormDate: (v: string) => void;
  formCost: string;
  setFormCost: (v: string) => void;
  formLifeMonths: string;
  setFormLifeMonths: (v: string) => void;
  formResidual: string;
  setFormResidual: (v: string) => void;
  formMethod: string;
  setFormMethod: (v: string) => void;
  assetAccounts: AccountOption[];
  depExpenseAccounts: AccountOption[];
  accumDepAccounts: AccountOption[];
  isPending: boolean;
  onSubmit: () => void;
  onCancel: () => void;
}

export default function FixedAssetForm({
  formName,
  setFormName,
  formDesc,
  setFormDesc,
  formAssetAccountId,
  setFormAssetAccountId,
  formDepAccountId,
  setFormDepAccountId,
  formAccumAccountId,
  setFormAccumAccountId,
  formDate,
  setFormDate,
  formCost,
  setFormCost,
  formLifeMonths,
  setFormLifeMonths,
  formResidual,
  setFormResidual,
  formMethod,
  setFormMethod,
  assetAccounts,
  depExpenseAccounts,
  accumDepAccounts,
  isPending,
  onSubmit,
  onCancel,
}: FixedAssetFormProps) {
  return (
    <div className={styles.section}>
      <div className={styles.sectionHeader}>
        <h2 className={styles.sectionTitle}>자산 등록</h2>
      </div>
      <div className={styles.form}>
        <div className={styles.formGroup}>
          <label className={styles.formLabel}>자산명 *</label>
          <input
            className={styles.formInput}
            value={formName}
            onChange={(e) => setFormName(e.target.value)}
            placeholder="예: 사무실 노트북"
          />
        </div>
        <div className={styles.formGroup}>
          <label className={styles.formLabel}>자산 계정 *</label>
          <select
            className={styles.formSelect}
            value={formAssetAccountId}
            onChange={(e) => setFormAssetAccountId(e.target.value)}
          >
            <option value="">선택</option>
            {assetAccounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.code} {a.name}
              </option>
            ))}
          </select>
        </div>
        <div className={styles.formGroup}>
          <label className={styles.formLabel}>감가상각비 계정 *</label>
          <select
            className={styles.formSelect}
            value={formDepAccountId}
            onChange={(e) => setFormDepAccountId(e.target.value)}
          >
            <option value="">선택</option>
            {depExpenseAccounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.code} {a.name}
              </option>
            ))}
          </select>
        </div>
        <div className={styles.formGroup}>
          <label className={styles.formLabel}>감가상각누계액 계정 *</label>
          <select
            className={styles.formSelect}
            value={formAccumAccountId}
            onChange={(e) => setFormAccumAccountId(e.target.value)}
          >
            <option value="">선택</option>
            {accumDepAccounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.code} {a.name}
              </option>
            ))}
          </select>
        </div>
        <div className={styles.formGroup}>
          <label className={styles.formLabel}>취득일 *</label>
          <input
            className={styles.formInput}
            type="date"
            value={formDate}
            onChange={(e) => setFormDate(e.target.value)}
          />
        </div>
        <div className={styles.formGroup}>
          <label className={styles.formLabel}>취득원가 *</label>
          <input
            className={styles.formInput}
            type="number"
            value={formCost}
            onChange={(e) => setFormCost(e.target.value)}
            placeholder="0"
          />
        </div>
        <div className={styles.formGroup}>
          <label className={styles.formLabel}>내용연수 (월) *</label>
          <input
            className={styles.formInput}
            type="number"
            value={formLifeMonths}
            onChange={(e) => setFormLifeMonths(e.target.value)}
            placeholder="예: 60 (5년)"
          />
        </div>
        <div className={styles.formGroup}>
          <label className={styles.formLabel}>잔존가치</label>
          <input
            className={styles.formInput}
            type="number"
            value={formResidual}
            onChange={(e) => setFormResidual(e.target.value)}
            placeholder="0"
          />
        </div>
        <div className={styles.formGroup}>
          <label className={styles.formLabel}>상각방법 *</label>
          <select
            className={styles.formSelect}
            value={formMethod}
            onChange={(e) => setFormMethod(e.target.value)}
          >
            <option value="STRAIGHT_LINE">정액법</option>
            <option value="DECLINING_BALANCE">정률법</option>
          </select>
        </div>
        <div className={styles.formGroupFull}>
          <label className={styles.formLabel}>설명</label>
          <input
            className={styles.formInput}
            value={formDesc}
            onChange={(e) => setFormDesc(e.target.value)}
            placeholder="선택사항"
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
            onClick={onSubmit}
            disabled={isPending}
          >
            {isPending ? "등록 중..." : "등록"}
          </button>
        </div>
      </div>
    </div>
  );
}
