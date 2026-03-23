"use client";

import styles from "./TaxInvoices.module.css";

export interface TaxInvoiceFormProps {
  formMode: "create" | "edit";
  invoiceType: string;
  setInvoiceType: (v: string) => void;
  invoiceNo: string;
  setInvoiceNo: (v: string) => void;
  invoiceDate: string;
  setInvoiceDate: (v: string) => void;
  issuerBizNo: string;
  setIssuerBizNo: (v: string) => void;
  issuerName: string;
  setIssuerName: (v: string) => void;
  recipientBizNo: string;
  setRecipientBizNo: (v: string) => void;
  recipientName: string;
  setRecipientName: (v: string) => void;
  supplyAmount: string;
  taxAmount: string;
  totalAmount: string;
  approvalNo: string;
  setApprovalNo: (v: string) => void;
  description: string;
  setDescription: (v: string) => void;
  error: string;
  isPending: boolean;
  handleSupplyChange: (val: string) => void;
  handleTaxChange: (val: string) => void;
  handleSubmit: (e: React.FormEvent) => void;
  resetForm: () => void;
}

export default function TaxInvoiceForm({
  formMode,
  invoiceType,
  setInvoiceType,
  invoiceNo,
  setInvoiceNo,
  invoiceDate,
  setInvoiceDate,
  issuerBizNo,
  setIssuerBizNo,
  issuerName,
  setIssuerName,
  recipientBizNo,
  setRecipientBizNo,
  recipientName,
  setRecipientName,
  supplyAmount,
  taxAmount,
  totalAmount,
  approvalNo,
  setApprovalNo,
  description,
  setDescription,
  error,
  isPending,
  handleSupplyChange,
  handleTaxChange,
  handleSubmit,
  resetForm,
}: TaxInvoiceFormProps) {
  return (
    <div className={styles.formSection}>
      <h2 className={styles.sectionTitle}>
        {formMode === "edit" ? "세금계산서 수정" : "세금계산서 등록"}
      </h2>
      <form onSubmit={handleSubmit}>
        <div className={styles.formGrid}>
          <div className={styles.formRow}>
            <label className={styles.label}>유형</label>
            <select
              className={styles.select}
              value={invoiceType}
              onChange={(e) => setInvoiceType(e.target.value)}
              disabled={formMode === "edit"}
            >
              <option value="PURCHASE">매입</option>
              <option value="SALES">매출</option>
            </select>
          </div>
          <div className={styles.formRow}>
            <label className={styles.label}>세금계산서 번호</label>
            <input
              className={styles.input}
              type="text"
              value={invoiceNo}
              onChange={(e) => setInvoiceNo(e.target.value)}
              placeholder="선택 입력"
            />
          </div>
          <div className={styles.formRow}>
            <label className={styles.label}>발행일</label>
            <input
              className={styles.input}
              type="date"
              value={invoiceDate}
              onChange={(e) => setInvoiceDate(e.target.value)}
              required
            />
          </div>
          <div className={styles.formRow}>
            <label className={styles.label}>승인번호</label>
            <input
              className={styles.input}
              type="text"
              value={approvalNo}
              onChange={(e) => setApprovalNo(e.target.value)}
              placeholder="선택 입력"
            />
          </div>
        </div>

        <div className={styles.formGrid}>
          <div className={styles.formRow}>
            <label className={styles.label}>공급자 사업자등록번호</label>
            <input
              className={styles.input}
              type="text"
              value={issuerBizNo}
              onChange={(e) => setIssuerBizNo(e.target.value)}
              placeholder="000-00-00000"
              required
            />
          </div>
          <div className={styles.formRow}>
            <label className={styles.label}>공급자 상호</label>
            <input
              className={styles.input}
              type="text"
              value={issuerName}
              onChange={(e) => setIssuerName(e.target.value)}
              placeholder="상호명"
              required
            />
          </div>
          <div className={styles.formRow}>
            <label className={styles.label}>공급받는자 사업자등록번호</label>
            <input
              className={styles.input}
              type="text"
              value={recipientBizNo}
              onChange={(e) => setRecipientBizNo(e.target.value)}
              placeholder="000-00-00000"
              required
            />
          </div>
          <div className={styles.formRow}>
            <label className={styles.label}>공급받는자 상호</label>
            <input
              className={styles.input}
              type="text"
              value={recipientName}
              onChange={(e) => setRecipientName(e.target.value)}
              placeholder="상호명"
              required
            />
          </div>
        </div>

        <div className={styles.amountRow}>
          <div className={styles.formRow}>
            <label className={styles.label}>공급가액</label>
            <input
              className={styles.input}
              type="number"
              value={supplyAmount}
              onChange={(e) => handleSupplyChange(e.target.value)}
              placeholder="0"
              min={0}
              required
            />
          </div>
          <div className={styles.formRow}>
            <label className={styles.label}>세액 (자동 10%)</label>
            <input
              className={styles.input}
              type="number"
              value={taxAmount}
              onChange={(e) => handleTaxChange(e.target.value)}
              placeholder="0"
              min={0}
            />
          </div>
          <div className={styles.formRow}>
            <label className={styles.label}>합계</label>
            <input
              className={styles.input}
              type="number"
              value={totalAmount}
              readOnly
              placeholder="0"
            />
          </div>
        </div>

        <div className={styles.formGrid}>
          <div className={styles.formRowFull}>
            <label className={styles.label}>비고</label>
            <textarea
              className={styles.textarea}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="메모 (선택)"
            />
          </div>
        </div>

        {error && <p className={styles.error}>{error}</p>}

        <div className={styles.formActions}>
          <button
            type="submit"
            className={styles.submitBtn}
            disabled={isPending}
          >
            {isPending ? "저장 중..." : formMode === "edit" ? "수정 저장" : "등록"}
          </button>
          <button
            type="button"
            className={styles.cancelFormBtn}
            onClick={resetForm}
          >
            취소
          </button>
        </div>
      </form>
    </div>
  );
}
