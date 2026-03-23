"use client";

import styles from "./JournalTemplates.module.css";
import { Account, LineInput, emptyLine } from "./types";

export interface JournalTemplateFormProps {
  formMode: "create" | "edit";
  name: string;
  setName: (v: string) => void;
  description: string;
  setDescription: (v: string) => void;
  lines: LineInput[];
  setLines: React.Dispatch<React.SetStateAction<LineInput[]>>;
  accounts: Account[];
  updateLine: (i: number, field: keyof LineInput, value: string) => void;
  totalDebit: number;
  totalCredit: number;
  isBalanced: boolean;
  error: string;
  isPending: boolean;
  onSubmit: (e: React.FormEvent) => void;
  onCancel: () => void;
}

export default function JournalTemplateForm({
  formMode,
  name,
  setName,
  description,
  setDescription,
  lines,
  setLines,
  accounts,
  updateLine,
  totalDebit,
  totalCredit,
  isBalanced,
  error,
  isPending,
  onSubmit,
  onCancel,
}: JournalTemplateFormProps) {
  return (
    <div className={styles.formSection}>
      <h2 className={styles.sectionTitle}>
        {formMode === "edit" ? "템플릿 수정" : "템플릿 등록"}
      </h2>
      <form onSubmit={onSubmit}>
        <div className={styles.formTop}>
          <div className={styles.formRow}>
            <label className={styles.label}>템플릿 이름</label>
            <input
              className={styles.input}
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="예: 월세 납부"
              required
            />
          </div>
          <div className={styles.formRow} style={{ flex: 1 }}>
            <label className={styles.label}>설명</label>
            <input
              className={styles.input}
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="예: 매월 사무실 월세"
            />
          </div>
        </div>

        <div className={styles.linesHeader}>
          <span>계정과목</span>
          <span>거래처 (선택)</span>
          <span>차변</span>
          <span>대변</span>
          <span></span>
        </div>

        {lines.map((line, i) => (
          <div key={i} className={styles.lineRow}>
            <select
              className={styles.select}
              value={line.accountId}
              onChange={(e) => updateLine(i, "accountId", e.target.value)}
            >
              <option value="">계정 선택</option>
              {accounts.map((acc) => (
                <option key={acc.id} value={acc.id}>{acc.code} {acc.name}</option>
              ))}
            </select>
            <select
              className={styles.select}
              value={line.vendorId}
              onChange={(e) => updateLine(i, "vendorId", e.target.value)}
            >
              <option value="">거래처 없음</option>
            </select>
            <input
              className={styles.input}
              type="number"
              value={line.debit || ""}
              onChange={(e) => updateLine(i, "debit", e.target.value)}
              placeholder="0"
              min={0}
            />
            <input
              className={styles.input}
              type="number"
              value={line.credit || ""}
              onChange={(e) => updateLine(i, "credit", e.target.value)}
              placeholder="0"
              min={0}
            />
            <button
              type="button"
              className={styles.removeBtn}
              onClick={() => lines.length > 2 && setLines((prev) => prev.filter((_, idx) => idx !== i))}
              disabled={lines.length <= 2}
            >
              X
            </button>
          </div>
        ))}

        <div className={styles.lineFooter}>
          <button type="button" className={styles.addLineBtn} onClick={() => setLines((prev) => [...prev, emptyLine()])}>
            + 라인 추가
          </button>
          <div className={styles.totals}>
            <span>차변: {totalDebit.toLocaleString()}원</span>
            <span>대변: {totalCredit.toLocaleString()}원</span>
            <span className={isBalanced ? styles.balanced : styles.unbalanced}>
              {isBalanced ? "균형" : "불균형"}
            </span>
          </div>
        </div>

        {error && <p className={styles.error}>{error}</p>}

        <div className={styles.formActions}>
          <button type="submit" className={styles.submitBtn} disabled={isPending || !isBalanced}>
            {isPending ? "저장 중..." : formMode === "edit" ? "수정 저장" : "템플릿 저장"}
          </button>
          <button type="button" className={styles.cancelFormBtn} onClick={onCancel}>취소</button>
        </div>
      </form>
    </div>
  );
}
