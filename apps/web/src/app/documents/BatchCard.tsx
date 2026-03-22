"use client";

import { useState } from "react";
import { apiPost } from "@/lib/api";
import styles from "./Documents.module.css";
import type { BatchItem } from "./types";

export default function BatchCard({
  item,
  tenantId,
  onJournalCreated,
}: {
  item: BatchItem;
  tenantId: string;
  onJournalCreated: () => void;
}) {
  const [bizNo, setBizNo] = useState("");
  const [vName, setVName] = useState("");
  const [done, setDone] = useState(false);
  const [pending, setPending] = useState(false);

  const handleCreate = async () => {
    if (!bizNo || !vName || !item.ocr?.total_amount) return;
    setPending(true);
    try {
      await apiPost("/documents", {
        tenantId,
        vendorName: vName,
        vendorBizNo: bizNo,
        totalAmount: item.ocr.total_amount,
        transactionAt: item.ocr.transaction_date || new Date().toISOString().slice(0, 10),
      });
      setDone(true);
      onJournalCreated();
    } catch { /* ignore */ }
    setPending(false);
  };

  if (item.status === "error") {
    return (
      <div className={`${styles.batchCard} ${styles.batchCardError}`}>
        <div className={styles.batchCardHeader}>
          <span className={styles.batchCardFilename}>{item.filename}</span>
          <span className={`${styles.status} ${styles.statusPending}`}>실패</span>
        </div>
        <div className={styles.batchCardBody}>{item.error}</div>
      </div>
    );
  }

  const ocr = item.ocr!;
  return (
    <div className={`${styles.batchCard} ${styles.batchCardSuccess}`}>
      <div className={styles.batchCardHeader}>
        <span className={styles.batchCardFilename}>{item.filename}</span>
        <span className={`${styles.status} ${done ? styles.statusJournal : styles.statusOcr}`}>
          {done ? "전표 생성" : "OCR 완료"}
        </span>
      </div>
      <div className={styles.batchCardGrid}>
        <div>
          <span className={styles.resultLabel}>거래처</span>
          <span className={styles.resultValue}>{ocr.vendor_name || "-"}</span>
        </div>
        <div>
          <span className={styles.resultLabel}>금액</span>
          <span className={styles.resultValue}>
            {ocr.total_amount ? `${ocr.total_amount.toLocaleString()}원` : "-"}
          </span>
        </div>
        <div>
          <span className={styles.resultLabel}>날짜</span>
          <span className={styles.resultValue}>{ocr.transaction_date || "-"}</span>
        </div>
        <div>
          <span className={styles.resultLabel}>신뢰도</span>
          <span className={styles.resultValue}>{Math.round(ocr.confidence * 100)}%</span>
        </div>
      </div>
      {!done && ocr.total_amount && (
        <div className={styles.batchJournalForm}>
          <input
            placeholder="사업자번호"
            value={bizNo}
            onChange={(e) => setBizNo(e.target.value)}
          />
          <input
            placeholder="거래처명"
            value={vName}
            onChange={(e) => setVName(e.target.value)}
          />
          <button
            className={styles.batchJournalBtn}
            onClick={handleCreate}
            disabled={!bizNo || !vName || pending}
          >
            {pending ? "..." : "전표"}
          </button>
        </div>
      )}
    </div>
  );
}
