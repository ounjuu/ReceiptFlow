"use client";

import { StockItem, TX_TYPE_LABEL, fmt } from "./types";
import styles from "./Inventory.module.css";

export interface InventoryFormProps {
  formTxType: string;
  formProductId: string;
  formQuantity: string;
  formUnitCost: string;
  formDate: string;
  formReason: string;
  stockList: StockItem[];
  isPending: boolean;
  isError: boolean;
  errorMessage: string;
  onTxTypeChange: (value: string) => void;
  onProductSelect: (productId: string) => void;
  onQuantityChange: (value: string) => void;
  onUnitCostChange: (value: string) => void;
  onDateChange: (value: string) => void;
  onReasonChange: (value: string) => void;
  onReset: () => void;
  onCreate: () => void;
}

export default function InventoryForm({
  formTxType,
  formProductId,
  formQuantity,
  formUnitCost,
  formDate,
  formReason,
  stockList,
  isPending,
  isError,
  errorMessage,
  onTxTypeChange,
  onProductSelect,
  onQuantityChange,
  onUnitCostChange,
  onDateChange,
  onReasonChange,
  onReset,
  onCreate,
}: InventoryFormProps) {
  return (
    <div className={styles.section}>
      <h2 className={styles.sectionTitle}>입출고 등록</h2>
      <div className={styles.form}>
        <div className={styles.formGroup}>
          <label className={styles.formLabel}>유형</label>
          <select
            className={styles.formSelect}
            value={formTxType}
            onChange={(e) => onTxTypeChange(e.target.value)}
          >
            <option value="IN">입고</option>
            <option value="OUT">출고</option>
            <option value="ADJUST">재고 조정 (실사)</option>
          </select>
        </div>
        <div className={styles.formGroup}>
          <label className={styles.formLabel}>일자</label>
          <input
            className={styles.formInput}
            type="date"
            value={formDate}
            onChange={(e) => onDateChange(e.target.value)}
          />
        </div>
        <div className={styles.formGroup}>
          <label className={styles.formLabel}>품목</label>
          <select
            className={styles.formSelect}
            value={formProductId}
            onChange={(e) => onProductSelect(e.target.value)}
          >
            <option value="">선택</option>
            {stockList.map((s) => (
              <option key={s.id} value={s.id}>
                [{s.code}] {s.name} (재고: {s.currentStock})
              </option>
            ))}
          </select>
        </div>
        <div className={styles.formGroup}>
          <label className={styles.formLabel}>
            {formTxType === "ADJUST" ? "실사 수량" : "수량"}
          </label>
          <input
            className={styles.formInput}
            type="number"
            value={formQuantity}
            onChange={(e) => onQuantityChange(e.target.value)}
            placeholder="0"
            min={0}
          />
        </div>
        <div className={styles.formGroup}>
          <label className={styles.formLabel}>단가</label>
          <input
            className={styles.formInput}
            type="number"
            value={formUnitCost}
            onChange={(e) => onUnitCostChange(e.target.value)}
            placeholder="0"
            min={0}
          />
        </div>
        <div className={styles.formGroup}>
          <label className={styles.formLabel}>총액</label>
          <input
            className={styles.formInput}
            type="text"
            value={formQuantity && formUnitCost ? `${fmt(Number(formQuantity) * Number(formUnitCost))}원` : ""}
            readOnly
          />
        </div>
        <div className={styles.formGroupFull}>
          <label className={styles.formLabel}>사유</label>
          <input
            className={styles.formInput}
            value={formReason}
            onChange={(e) => onReasonChange(e.target.value)}
            placeholder="입고/출고/조정 사유 (선택)"
          />
        </div>
        <div className={styles.formActions}>
          <button className={styles.secondaryBtn} onClick={onReset}>초기화</button>
          <button
            className={styles.primaryBtn}
            onClick={onCreate}
            disabled={isPending || !formProductId || !formQuantity || !formUnitCost}
          >
            {isPending ? "처리 중..." : `${TX_TYPE_LABEL[formTxType] || formTxType} 등록`}
          </button>
        </div>
      </div>
      {isError && (
        <div className={styles.errorMsg}>
          {errorMessage}
        </div>
      )}
    </div>
  );
}
