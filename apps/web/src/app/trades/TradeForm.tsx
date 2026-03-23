"use client";

import styles from "./Trades.module.css";
import { Vendor, ItemInput, fmt } from "./types";

interface TradeFormProps {
  vendors: Vendor[];
  formVendorId: string;
  setFormVendorId: (v: string) => void;
  formDate: string;
  setFormDate: (v: string) => void;
  formDueDate: string;
  setFormDueDate: (v: string) => void;
  formDesc: string;
  setFormDesc: (v: string) => void;
  formNote: string;
  setFormNote: (v: string) => void;
  formItems: ItemInput[];
  setFormItems: React.Dispatch<React.SetStateAction<ItemInput[]>>;
  formError: string;
  supplyTotal: number;
  taxTotal: number;
  resetForm: () => void;
  handleSubmit: () => void;
  isPending: boolean;
}

export default function TradeForm({
  vendors,
  formVendorId,
  setFormVendorId,
  formDate,
  setFormDate,
  formDueDate,
  setFormDueDate,
  formDesc,
  setFormDesc,
  formNote,
  setFormNote,
  formItems,
  setFormItems,
  formError,
  supplyTotal,
  taxTotal,
  resetForm,
  handleSubmit,
  isPending,
}: TradeFormProps) {
  return (
    <>
      <div className={styles.form}>
        <div className={styles.formGroup}>
          <label className={styles.formLabel}>거래처 *</label>
          <select className={styles.formSelect} value={formVendorId} onChange={(e) => setFormVendorId(e.target.value)}>
            <option value="">선택</option>
            {vendors.map((v) => (
              <option key={v.id} value={v.id}>{v.bizNo ? `[${v.bizNo}] ` : ""}{v.name}</option>
            ))}
          </select>
        </div>
        <div className={styles.formGroup}>
          <label className={styles.formLabel}>거래일 *</label>
          <input className={styles.formInput} type="date" value={formDate} onChange={(e) => setFormDate(e.target.value)} />
        </div>
        <div className={styles.formGroup}>
          <label className={styles.formLabel}>결제 예정일</label>
          <input className={styles.formInput} type="date" value={formDueDate} onChange={(e) => setFormDueDate(e.target.value)} />
        </div>
        <div className={styles.formGroup}>
          <label className={styles.formLabel}>설명</label>
          <input className={styles.formInput} value={formDesc} onChange={(e) => setFormDesc(e.target.value)} placeholder="거래 설명" />
        </div>
      </div>

      {/* 품목 */}
      <div className={styles.itemsHeader}>
        <span>품목명 *</span>
        <span>규격</span>
        <span>수량</span>
        <span>단가 *</span>
        <span>금액</span>
        <span></span>
      </div>
      {formItems.map((item, i) => (
        <div key={i} className={styles.itemRow}>
          <input className={styles.formInput} value={item.itemName} onChange={(e) => setFormItems((prev) => prev.map((it, j) => j === i ? { ...it, itemName: e.target.value } : it))} placeholder="품목명" />
          <input className={styles.formInput} value={item.specification} onChange={(e) => setFormItems((prev) => prev.map((it, j) => j === i ? { ...it, specification: e.target.value } : it))} placeholder="규격" />
          <input className={styles.formInput} type="number" min={1} value={item.quantity} onChange={(e) => setFormItems((prev) => prev.map((it, j) => j === i ? { ...it, quantity: Number(e.target.value) || 1 } : it))} />
          <input className={styles.formInput} type="number" min={0} value={item.unitPrice || ""} onChange={(e) => setFormItems((prev) => prev.map((it, j) => j === i ? { ...it, unitPrice: Number(e.target.value) || 0 } : it))} placeholder="0" />
          <span style={{ padding: "8px 12px", fontSize: "0.9rem" }}>{fmt(item.quantity * item.unitPrice)}</span>
          <button type="button" className={styles.removeBtn} onClick={() => setFormItems((prev) => prev.filter((_, j) => j !== i))} disabled={formItems.length <= 1}>X</button>
        </div>
      ))}
      <div className={styles.itemFooter}>
        <button type="button" className={styles.addItemBtn} onClick={() => setFormItems((prev) => [...prev, { itemName: "", specification: "", quantity: 1, unitPrice: 0 }])}>+ 품목 추가</button>
        <div>
          <span>공급가: {fmt(supplyTotal)}원</span>
          <span style={{ margin: "0 12px" }}>세액: {fmt(taxTotal)}원</span>
          <span style={{ fontWeight: 700 }}>합계: {fmt(supplyTotal + taxTotal)}원</span>
        </div>
      </div>

      {formError && <p className={styles.error}>{formError}</p>}

      <div className={styles.formActions}>
        <button className={styles.secondaryBtn} onClick={resetForm}>취소</button>
        <button className={styles.primaryBtn} onClick={handleSubmit} disabled={isPending}>
          {isPending ? "저장 중..." : "등록"}
        </button>
      </div>
    </>
  );
}
