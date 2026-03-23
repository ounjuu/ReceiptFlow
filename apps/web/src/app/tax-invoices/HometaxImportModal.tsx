"use client";

import styles from "./TaxInvoices.module.css";

export interface HometaxImportModalProps {
  importType: string;
  setImportType: (v: string) => void;
  importFile: File | null;
  setImportFile: (f: File | null) => void;
  importResult: string;
  importIsPending: boolean;
  handleImportSubmit: () => void;
  closeImportModal: () => void;
}

export default function HometaxImportModal({
  importType,
  setImportType,
  importFile,
  setImportFile,
  importResult,
  importIsPending,
  handleImportSubmit,
  closeImportModal,
}: HometaxImportModalProps) {
  return (
    <div className={styles.modalOverlay} onClick={closeImportModal}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <h2 className={styles.sectionTitle}>홈택스 XML 가져오기</h2>
        <div className={styles.formGrid}>
          <div className={styles.formRow}>
            <label className={styles.label}>유형</label>
            <select
              className={styles.select}
              value={importType}
              onChange={(e) => setImportType(e.target.value)}
            >
              <option value="PURCHASE">매입</option>
              <option value="SALES">매출</option>
            </select>
          </div>
          <div className={styles.formRow}>
            <label className={styles.label}>XML 파일</label>
            <input
              className={styles.input}
              type="file"
              accept=".xml"
              onChange={(e) => setImportFile(e.target.files?.[0] || null)}
            />
          </div>
        </div>
        {importResult && (
          <p
            style={{
              fontSize: "0.85rem",
              marginBottom: 12,
              color: importResult.startsWith("오류") ? "var(--danger)" : "#166534",
              fontWeight: 600,
            }}
          >
            {importResult}
          </p>
        )}
        <div className={styles.formActions}>
          <button
            className={styles.submitBtn}
            onClick={handleImportSubmit}
            disabled={!importFile || importIsPending}
          >
            {importIsPending ? "가져오는 중..." : "가져오기"}
          </button>
          <button className={styles.cancelFormBtn} onClick={closeImportModal}>
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}
