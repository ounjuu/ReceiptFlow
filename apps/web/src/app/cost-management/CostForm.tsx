"use client";

import styles from "./CostManagement.module.css";
import type { ImportResult } from "./types";

export interface CostFormProps {
  showForm: boolean;
  editingId: string | null;
  formCode: string;
  formName: string;
  formCategory: string;
  formUnit: string;
  formStdCost: string;
  formSafetyStock: string;
  formDesc: string;
  formError: string;
  isPending: boolean;
  importPending: boolean;
  importResult: ImportResult | null;
  importRef: React.RefObject<HTMLInputElement | null>;
  canEdit: boolean;
  onFormCodeChange: (v: string) => void;
  onFormNameChange: (v: string) => void;
  onFormCategoryChange: (v: string) => void;
  onFormUnitChange: (v: string) => void;
  onFormStdCostChange: (v: string) => void;
  onFormSafetyStockChange: (v: string) => void;
  onFormDescChange: (v: string) => void;
  onToggleForm: () => void;
  onResetForm: () => void;
  onSubmit: () => void;
  onImport: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onDownloadTemplate: () => void;
  onClearImportResult: () => void;
}

export default function CostForm({
  showForm,
  editingId,
  formCode,
  formName,
  formCategory,
  formUnit,
  formStdCost,
  formSafetyStock,
  formDesc,
  formError,
  isPending,
  importPending,
  importResult,
  importRef,
  canEdit,
  onFormCodeChange,
  onFormNameChange,
  onFormCategoryChange,
  onFormUnitChange,
  onFormStdCostChange,
  onFormSafetyStockChange,
  onFormDescChange,
  onToggleForm,
  onResetForm,
  onSubmit,
  onImport,
  onDownloadTemplate,
  onClearImportResult,
}: CostFormProps) {
  return (
    <>
      <div className={styles.sectionHeader}>
        <h2 className={styles.sectionTitle}>품목 목록</h2>
        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          <button className={styles.secondaryBtn} onClick={onDownloadTemplate}>템플릿</button>
          <input type="file" ref={importRef} accept=".xlsx,.xls,.csv" onChange={onImport} hidden />
          <button className={styles.secondaryBtn} onClick={() => importRef.current?.click()} disabled={importPending}>
            {importPending ? "업로드 중..." : "엑셀 업로드"}
          </button>
          {canEdit && (
            <button className={styles.primaryBtn} onClick={onToggleForm}>
              {showForm ? "취소" : "품목 등록"}
            </button>
          )}
        </div>
      </div>

      {importResult && (
        <div style={{ marginBottom: "12px", padding: "12px", background: "var(--primary-light)", border: "1px solid var(--primary)", borderRadius: "var(--radius)" }}>
          <div style={{ display: "flex", gap: "12px", alignItems: "center", fontSize: "0.85rem", fontWeight: 600 }}>
            <span>총 {importResult.total}건</span>
            <span style={{ color: "#166534" }}>성공 {importResult.success}건</span>
            {importResult.failed > 0 && <span style={{ color: "#dc2626" }}>실패 {importResult.failed}건</span>}
            <button className={styles.secondaryBtn} onClick={onClearImportResult}>닫기</button>
          </div>
          {importResult.failed > 0 && (
            <ul style={{ margin: "8px 0 0", paddingLeft: "20px", fontSize: "0.8rem", color: "#dc2626" }}>
              {importResult.results.filter((r) => r.status === "error").map((r) => (
                <li key={r.index}>{r.error}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {showForm && (
        <div className={styles.form}>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>코드 *</label>
            <input className={styles.formInput} value={formCode} onChange={(e) => onFormCodeChange(e.target.value)} placeholder="P-001" readOnly={!!editingId} />
          </div>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>이름 *</label>
            <input className={styles.formInput} value={formName} onChange={(e) => onFormNameChange(e.target.value)} placeholder="품목명" />
          </div>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>카테고리</label>
            <input className={styles.formInput} value={formCategory} onChange={(e) => onFormCategoryChange(e.target.value)} placeholder="직접재료, 부품 등" />
          </div>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>단위</label>
            <input className={styles.formInput} value={formUnit} onChange={(e) => onFormUnitChange(e.target.value)} placeholder="EA, KG, M" />
          </div>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>표준원가</label>
            <input className={styles.formInput} type="number" value={formStdCost} onChange={(e) => onFormStdCostChange(e.target.value)} placeholder="0" />
          </div>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>안전재고</label>
            <input className={styles.formInput} type="number" value={formSafetyStock} onChange={(e) => onFormSafetyStockChange(e.target.value)} placeholder="0" />
          </div>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>설명</label>
            <input className={styles.formInput} value={formDesc} onChange={(e) => onFormDescChange(e.target.value)} placeholder="설명" />
          </div>
          {formError && <div className={styles.formGroupFull} style={{ color: "var(--danger)", fontSize: "0.85rem" }}>{formError}</div>}
          <div className={styles.formActions}>
            <button className={styles.secondaryBtn} onClick={onResetForm}>취소</button>
            <button className={styles.primaryBtn} onClick={onSubmit} disabled={isPending}>
              {isPending ? "저장 중..." : editingId ? "수정" : "등록"}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
