"use client";

import React from "react";
import styles from "./Journals.module.css";
import {
  Account,
  Vendor,
  ProjectOption,
  DepartmentOption,
  LineInput,
  CURRENCY_OPTIONS,
  CURRENCY_SYMBOLS,
  JOURNAL_TYPES,
} from "./types";

export interface JournalFormProps {
  formMode: "create" | "edit";
  editingId: string | null;
  journalType: string;
  setJournalType: (v: string) => void;
  date: string;
  setDate: (v: string) => void;
  description: string;
  setDescription: (v: string) => void;
  currency: string;
  exchangeRate: string;
  setExchangeRate: (v: string) => void;
  lines: LineInput[];
  error: string;
  isPending: boolean;
  isBalanced: boolean;
  totalDebit: number;
  totalCredit: number;
  accounts: Account[];
  projects: ProjectOption[];
  departments: DepartmentOption[];
  handleCurrencyChange: (cur: string) => void;
  handleBizNoInput: (index: number, value: string) => void;
  handleBizNoBlur: (index: number) => void;
  selectLineVendor: (index: number, vendor: Vendor) => void;
  updateLine: (index: number, field: keyof LineInput, value: string) => void;
  addLine: () => void;
  removeLine: (index: number) => void;
  handleSubmit: (e: React.FormEvent) => void;
  resetForm: () => void;
  lineSuggestions: Record<number, Vendor[]>;
  showLineSuggestions: Record<number, boolean>;
  setShowLineSuggestions: React.Dispatch<React.SetStateAction<Record<number, boolean>>>;
  linesSuggestRef: React.RefObject<HTMLDivElement | null>;
}

export default function JournalForm({
  formMode,
  journalType,
  setJournalType,
  date,
  setDate,
  description,
  setDescription,
  currency,
  exchangeRate,
  setExchangeRate,
  lines,
  error,
  isPending,
  isBalanced,
  totalDebit,
  totalCredit,
  accounts,
  projects,
  departments,
  handleCurrencyChange,
  handleBizNoInput,
  handleBizNoBlur,
  selectLineVendor,
  updateLine,
  addLine,
  removeLine,
  handleSubmit,
  resetForm,
  lineSuggestions,
  showLineSuggestions,
  setShowLineSuggestions,
  linesSuggestRef,
}: JournalFormProps) {
  return (
    <div className={styles.formSection}>
      <h2 className={styles.sectionTitle}>
        {formMode === "edit" ? "전표 수정" : "수기 전표 입력"}
      </h2>
      <form onSubmit={handleSubmit}>
        <div className={styles.formTop}>
          <div className={styles.formRow}>
            <label className={styles.label}>전표유형</label>
            <select
              className={styles.select}
              value={journalType}
              onChange={(e) => setJournalType(e.target.value)}
              disabled={formMode === "edit"}
            >
              {JOURNAL_TYPES.map((t) => (
                <option key={t.code} value={t.code}>{t.name}</option>
              ))}
            </select>
          </div>
          <div className={styles.formRow}>
            <label className={styles.label}>날짜</label>
            <input
              className={styles.input}
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
            />
          </div>
          <div className={styles.formRow} style={{ flex: 1 }}>
            <label className={styles.label}>설명</label>
            <input
              className={styles.input}
              type="text"
              placeholder="예: 사무용품 구매"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div className={styles.formRow}>
            <label className={styles.label}>통화</label>
            <select
              className={styles.select}
              value={currency}
              onChange={(e) => handleCurrencyChange(e.target.value)}
            >
              {CURRENCY_OPTIONS.map((c) => (
                <option key={c.code} value={c.code}>{c.name}</option>
              ))}
            </select>
          </div>
          {currency !== "KRW" && (
            <div className={styles.formRow}>
              <label className={styles.label}>환율 (1 {currency} = KRW)</label>
              <input
                className={styles.input}
                type="number"
                step="0.000001"
                min="0"
                value={exchangeRate}
                onChange={(e) => setExchangeRate(e.target.value)}
              />
            </div>
          )}
        </div>

        <div className={styles.linesHeader}>
          <span>사업자번호</span>
          <span>거래처명</span>
          <span>계정과목</span>
          <span>프로젝트</span>
          <span>부서</span>
          <span>차변</span>
          <span>대변</span>
          <span></span>
        </div>

        <div ref={linesSuggestRef}>
        {lines.map((line, i) => (
          <div key={i} className={styles.lineRow}>
            <div style={{ position: "relative" }}>
              <input
                className={`${styles.input} ${line.vendorId ? styles.inputMatched : ""}`}
                type="text"
                value={line.vendorBizNo}
                onChange={(e) => handleBizNoInput(i, e.target.value)}
                onBlur={() => handleBizNoBlur(i)}
                onFocus={() => { if (lineSuggestions[i]?.length > 0) setShowLineSuggestions((prev) => ({ ...prev, [i]: true })); }}
                placeholder="000-00-00000"
                autoComplete="off"
              />
              {showLineSuggestions[i] && lineSuggestions[i]?.length > 0 && (
                <ul className={styles.autocomplete}>
                  {lineSuggestions[i].map((v) => (
                    <li
                      key={v.id}
                      className={styles.autocompleteItem}
                      onMouseDown={() => selectLineVendor(i, v)}
                    >
                      <span className={styles.autocompleteNo}>{v.bizNo}</span>
                      <span className={styles.autocompleteName}>{v.name}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <input
              className={styles.input}
              type="text"
              value={line.vendorName}
              onChange={(e) => updateLine(i, "vendorName", e.target.value)}
              placeholder="상호명"
              readOnly={!!line.vendorId}
            />
            <select
              className={styles.select}
              value={line.accountId}
              onChange={(e) => updateLine(i, "accountId", e.target.value)}
            >
              <option value="">계정 선택</option>
              {accounts.map((acc) => (
                <option key={acc.id} value={acc.id}>
                  {acc.code} {acc.name}
                </option>
              ))}
            </select>
            <select
              className={styles.select}
              value={line.projectId}
              onChange={(e) => updateLine(i, "projectId", e.target.value)}
            >
              <option value="">선택 안함</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.code} {p.name}
                </option>
              ))}
            </select>
            <select
              className={styles.select}
              value={line.departmentId}
              onChange={(e) => updateLine(i, "departmentId", e.target.value)}
            >
              <option value="">선택 안함</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.code} {d.name}
                </option>
              ))}
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
              onClick={() => removeLine(i)}
              disabled={lines.length <= 2}
            >
              X
            </button>
          </div>
        ))}
        </div>

        <div className={styles.lineFooter}>
          <button
            type="button"
            className={styles.addLineBtn}
            onClick={addLine}
          >
            + 라인 추가
          </button>
          <div className={styles.totals}>
            <span>차변: {(CURRENCY_SYMBOLS[currency] || "")}{totalDebit.toLocaleString()}</span>
            <span>대변: {(CURRENCY_SYMBOLS[currency] || "")}{totalCredit.toLocaleString()}</span>
            <span className={isBalanced ? styles.balanced : styles.unbalanced}>
              {isBalanced ? "균형" : "불균형"}
            </span>
          </div>
        </div>

        {error && <p className={styles.error}>{error}</p>}

        <div className={styles.formActions}>
          <button
            type="submit"
            className={styles.submitBtn}
            disabled={isPending || !isBalanced}
          >
            {isPending
              ? "저장 중..."
              : formMode === "edit"
                ? "수정 저장"
                : "전표 저장"}
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
