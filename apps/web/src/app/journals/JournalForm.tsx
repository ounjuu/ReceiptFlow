"use client";

import React, { useRef, useEffect, useCallback } from "react";
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
  EVIDENCE_TYPES,
} from "./types";

// 그리드 컬럼 순서 (키보드 네비게이션용)
const GRID_COLS = ["vendorBizNo", "vendorName", "accountId", "projectId", "departmentId", "debit", "credit"] as const;

interface SummaryItem {
  id: string;
  code: string;
  description: string;
}

export interface JournalFormProps {
  formMode: "create" | "edit";
  editingId: string | null;
  journalType: string;
  setJournalType: (v: string) => void;
  isTaxType: boolean;
  evidenceType: string;
  setEvidenceType: (v: string) => void;
  supplyAmount: string;
  handleSupplyAmountChange: (v: string) => void;
  vatAmount: string;
  setVatAmount: (v: string) => void;
  date: string;
  setDate: (v: string) => void;
  description: string;
  handleDescriptionInput: (v: string) => void;
  summarySuggestions: SummaryItem[];
  showSummaryDropdown: boolean;
  selectSummary: (item: SummaryItem) => void;
  summaryRef: React.RefObject<HTMLDivElement | null>;
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
  isTaxType,
  evidenceType,
  setEvidenceType,
  supplyAmount,
  handleSupplyAmountChange,
  vatAmount,
  setVatAmount,
  setJournalType,
  date,
  setDate,
  description,
  handleDescriptionInput,
  summarySuggestions,
  showSummaryDropdown,
  selectSummary,
  summaryRef,
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
  // 그리드 셀 ref 맵: gridRefs[row][col]
  const gridRefs = useRef<Map<string, HTMLElement>>(new Map());
  const formRef = useRef<HTMLFormElement>(null);

  const setGridRef = useCallback((row: number, col: number, el: HTMLElement | null) => {
    const key = `${row}-${col}`;
    if (el) {
      gridRefs.current.set(key, el);
    } else {
      gridRefs.current.delete(key);
    }
  }, []);

  const focusCell = useCallback((row: number, col: number) => {
    const el = gridRefs.current.get(`${row}-${col}`);
    if (el) {
      el.focus();
      // input[type=number]는 select()가 안 되므로 체크
      if (el instanceof HTMLInputElement && el.type !== "number") {
        el.select();
      }
    }
  }, []);

  // 새 라인 추가 후 첫 번째 셀에 포커스
  const prevLineCount = useRef(lines.length);
  useEffect(() => {
    if (lines.length > prevLineCount.current) {
      // 새 라인이 추가됨 → 새 라인의 첫 번째 셀로 포커스
      setTimeout(() => focusCell(lines.length - 1, 0), 50);
    }
    prevLineCount.current = lines.length;
  }, [lines.length, focusCell]);

  // 그리드 셀 키보드 핸들러
  const handleGridKeyDown = useCallback((e: React.KeyboardEvent, row: number, col: number) => {
    // Enter: 다음 셀로 이동 (마지막 열이면 다음 행 첫 셀, 마지막 행이면 라인 추가)
    if (e.key === "Enter" && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
      // select 요소는 Enter로 옵션 선택하므로 기본 동작 허용
      if ((e.target as HTMLElement).tagName === "SELECT") return;

      e.preventDefault();
      const nextCol = col + 1;
      if (nextCol < GRID_COLS.length) {
        focusCell(row, nextCol);
      } else if (row < lines.length - 1) {
        focusCell(row + 1, 0);
      } else {
        // 마지막 행의 마지막 열 → 새 라인 추가
        addLine();
      }
    }

    // Shift+Enter: 이전 셀로 이동
    if (e.key === "Enter" && e.shiftKey && !e.ctrlKey) {
      e.preventDefault();
      const prevCol = col - 1;
      if (prevCol >= 0) {
        focusCell(row, prevCol);
      } else if (row > 0) {
        focusCell(row - 1, GRID_COLS.length - 1);
      }
    }

    // 화살표 위/아래: 같은 열에서 행 이동
    if (e.key === "ArrowDown" && row < lines.length - 1) {
      e.preventDefault();
      focusCell(row + 1, col);
    }
    if (e.key === "ArrowUp" && row > 0) {
      e.preventDefault();
      focusCell(row - 1, col);
    }
  }, [lines.length, focusCell, addLine]);

  // 전역 단축키 (폼 범위)
  const handleFormKeyDown = useCallback((e: React.KeyboardEvent) => {
    // Esc: 폼 닫기
    if (e.key === "Escape") {
      e.preventDefault();
      resetForm();
      return;
    }
    // Ctrl+Enter 또는 F8: 저장
    if ((e.key === "Enter" && (e.ctrlKey || e.metaKey)) || e.key === "F8") {
      e.preventDefault();
      formRef.current?.requestSubmit();
      return;
    }
    // F3: 라인 추가
    if (e.key === "F3") {
      e.preventDefault();
      addLine();
      return;
    }
  }, [resetForm, addLine]);

  return (
    <div className={styles.formSection} onKeyDown={handleFormKeyDown}>
      <div className={styles.formTitleBar}>
        <h2 className={styles.sectionTitle}>
          {formMode === "edit" ? "전표 수정" : "수기 전표 입력"}
        </h2>
        <div className={styles.shortcutHints}>
          <kbd>Enter</kbd> 다음 칸
          <kbd>↑↓</kbd> 행 이동
          <kbd>F3</kbd> 라인 추가
          <kbd>Ctrl+Enter</kbd> 저장
          <kbd>Esc</kbd> 취소
        </div>
      </div>
      <form ref={formRef} onSubmit={handleSubmit}>
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
          <div className={styles.formRow} style={{ flex: 1, position: "relative" }} ref={summaryRef}>
            <label className={styles.label}>적요 (코드/내용 검색)</label>
            <input
              className={styles.input}
              type="text"
              placeholder="코드 또는 내용 입력 (예: 001, 사무용품)"
              value={description}
              onChange={(e) => handleDescriptionInput(e.target.value)}
              autoComplete="off"
            />
            {showSummaryDropdown && summarySuggestions.length > 0 && (
              <ul className={styles.autocomplete}>
                {summarySuggestions.map((s) => (
                  <li
                    key={s.id}
                    className={styles.autocompleteItem}
                    onMouseDown={() => selectSummary(s)}
                  >
                    <span className={styles.autocompleteNo}>{s.code}</span>
                    <span className={styles.autocompleteName}>{s.description}</span>
                  </li>
                ))}
              </ul>
            )}
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

        {/* 매입/매출 전표: 부가세 자동 계산 */}
        {isTaxType && (
          <div className={styles.vatSection}>
            <div className={styles.formRow}>
              <label className={styles.label}>증빙 유형</label>
              <select
                className={styles.select}
                value={evidenceType}
                onChange={(e) => setEvidenceType(e.target.value)}
              >
                {EVIDENCE_TYPES.map((t) => (
                  <option key={t.code} value={t.code}>{t.name}</option>
                ))}
              </select>
            </div>
            <div className={styles.formRow}>
              <label className={styles.label}>공급가액</label>
              <input
                className={styles.input}
                type="number"
                value={supplyAmount}
                onChange={(e) => handleSupplyAmountChange(e.target.value)}
                placeholder="0"
                min={0}
              />
            </div>
            <div className={styles.formRow}>
              <label className={styles.label}>부가세 (10%)</label>
              <input
                className={styles.input}
                type="number"
                value={vatAmount}
                onChange={(e) => setVatAmount(e.target.value)}
                placeholder="자동 계산"
                min={0}
              />
            </div>
            <div className={styles.formRow}>
              <label className={styles.label}>합계</label>
              <span className={styles.vatTotal}>
                {((Number(supplyAmount) || 0) + (Number(vatAmount) || 0)).toLocaleString()}원
              </span>
            </div>
          </div>
        )}

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
                ref={(el) => setGridRef(i, 0, el)}
                className={`${styles.input} ${line.vendorId ? styles.inputMatched : ""}`}
                type="text"
                value={line.vendorBizNo}
                onChange={(e) => handleBizNoInput(i, e.target.value)}
                onBlur={() => handleBizNoBlur(i)}
                onFocus={() => { if (lineSuggestions[i]?.length > 0) setShowLineSuggestions((prev) => ({ ...prev, [i]: true })); }}
                onKeyDown={(e) => handleGridKeyDown(e, i, 0)}
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
              ref={(el) => setGridRef(i, 1, el)}
              className={styles.input}
              type="text"
              value={line.vendorName}
              onChange={(e) => updateLine(i, "vendorName", e.target.value)}
              onKeyDown={(e) => handleGridKeyDown(e, i, 1)}
              placeholder="상호명"
              readOnly={!!line.vendorId}
            />
            <select
              ref={(el) => setGridRef(i, 2, el)}
              className={styles.select}
              value={line.accountId}
              onChange={(e) => updateLine(i, "accountId", e.target.value)}
              onKeyDown={(e) => handleGridKeyDown(e, i, 2)}
            >
              <option value="">계정 선택</option>
              {accounts.map((acc) => (
                <option key={acc.id} value={acc.id}>
                  {acc.code} {acc.name}
                </option>
              ))}
            </select>
            <select
              ref={(el) => setGridRef(i, 3, el)}
              className={styles.select}
              value={line.projectId}
              onChange={(e) => updateLine(i, "projectId", e.target.value)}
              onKeyDown={(e) => handleGridKeyDown(e, i, 3)}
            >
              <option value="">선택 안함</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.code} {p.name}
                </option>
              ))}
            </select>
            <select
              ref={(el) => setGridRef(i, 4, el)}
              className={styles.select}
              value={line.departmentId}
              onChange={(e) => updateLine(i, "departmentId", e.target.value)}
              onKeyDown={(e) => handleGridKeyDown(e, i, 4)}
            >
              <option value="">선택 안함</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.code} {d.name}
                </option>
              ))}
            </select>
            <input
              ref={(el) => setGridRef(i, 5, el)}
              className={styles.input}
              type="number"
              value={line.debit || ""}
              onChange={(e) => updateLine(i, "debit", e.target.value)}
              onKeyDown={(e) => handleGridKeyDown(e, i, 5)}
              placeholder="0"
              min={0}
            />
            <input
              ref={(el) => setGridRef(i, 6, el)}
              className={styles.input}
              type="number"
              value={line.credit || ""}
              onChange={(e) => updateLine(i, "credit", e.target.value)}
              onKeyDown={(e) => handleGridKeyDown(e, i, 6)}
              placeholder="0"
              min={0}
            />
            <button
              type="button"
              className={styles.removeBtn}
              onClick={() => removeLine(i)}
              disabled={lines.length <= 2}
              tabIndex={-1}
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
            tabIndex={-1}
          >
            + 라인 추가 (F3)
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
                : "전표 저장 (Ctrl+Enter)"}
          </button>
          <button
            type="button"
            className={styles.cancelFormBtn}
            onClick={resetForm}
            tabIndex={-1}
          >
            취소 (Esc)
          </button>
        </div>
      </form>
    </div>
  );
}
