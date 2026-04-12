"use client";

import { RefObject } from "react";
import styles from "./Documents.module.css";
import BatchCard from "./BatchCard";
import type {
  InputTab,
  Vendor,
  CreateResult,
  BatchResult,
  OcrData,
} from "./types";
import { CURRENCY_OPTIONS } from "./types";

interface DocumentFormProps {
  // 탭
  inputTab: InputTab;
  setInputTab: (tab: InputTab) => void;

  // 업로드
  fileRef: RefObject<HTMLInputElement | null>;
  selectedFiles: File[];
  handleFileSelect: () => void;
  removeFile: (index: number) => void;
  handleUpload: () => void;
  uploadIsPending: boolean;

  // 수동 입력
  vendorBizNo: string;
  vendorName: string;
  vendorMatched: boolean;
  totalAmount: string;
  docCurrency: string;
  transactionAt: string;
  setVendorName: (v: string) => void;
  setTotalAmount: (v: string) => void;
  setDocCurrency: (v: string) => void;
  setTransactionAt: (v: string) => void;
  handleBizNoChange: (value: string) => void;
  handleBizNoBlur: () => void;
  selectVendor: (vendor: Vendor) => void;
  suggestions: Vendor[];
  showSuggestions: boolean;
  setShowSuggestions: (v: boolean) => void;
  suggestRef: RefObject<HTMLDivElement | null>;
  handleManualSubmit: (e: React.FormEvent) => void;
  createIsPending: boolean;

  // 결과
  result: CreateResult | null;
  setResult: (r: CreateResult | null) => void;
  batchResult: BatchResult | null;
  setBatchResult: (r: BatchResult | null) => void;

  // OCR 보완 입력
  ocrBizNoInput: string;
  ocrVendorInput: string;
  ocrVendorMatched: boolean;
  ocrSuggestions: Vendor[];
  showOcrSuggestions: boolean;
  setShowOcrSuggestions: (v: boolean) => void;
  ocrSuggestRef: RefObject<HTMLDivElement | null>;
  handleOcrBizNoChange: (value: string) => void;
  handleOcrBizNoBlur: () => void;
  selectOcrVendor: (vendor: Vendor) => void;
  setOcrVendorInput: (v: string) => void;
  handleOcrComplete: () => void;
  completeOcrIsPending: boolean;

  // 기타
  tenantId: string;
  onJournalCreated: () => void;
}

export default function DocumentForm(props: DocumentFormProps) {
  const {
    inputTab,
    setInputTab,
    fileRef,
    selectedFiles,
    handleFileSelect,
    removeFile,
    handleUpload,
    uploadIsPending,
    vendorBizNo,
    vendorName,
    vendorMatched,
    totalAmount,
    docCurrency,
    transactionAt,
    setVendorName,
    setTotalAmount,
    setDocCurrency,
    setTransactionAt,
    handleBizNoChange,
    handleBizNoBlur,
    selectVendor,
    suggestions,
    showSuggestions,
    setShowSuggestions,
    suggestRef,
    handleManualSubmit,
    createIsPending,
    result,
    setResult,
    batchResult,
    setBatchResult,
    ocrBizNoInput,
    ocrVendorInput,
    ocrVendorMatched,
    ocrSuggestions,
    showOcrSuggestions,
    setShowOcrSuggestions,
    ocrSuggestRef,
    handleOcrBizNoChange,
    handleOcrBizNoBlur,
    selectOcrVendor,
    setOcrVendorInput,
    handleOcrComplete,
    completeOcrIsPending,
    tenantId,
    onJournalCreated,
  } = props;

  return (
    <div className={styles.formSection}>
      <div className={styles.inputTabs}>
        <button
          className={`${styles.inputTab} ${inputTab === "upload" ? styles.inputTabActive : ""}`}
          onClick={() => { setInputTab("upload"); setResult(null); setBatchResult(null); }}
        >
          이미지 업로드
        </button>
        <button
          className={`${styles.inputTab} ${inputTab === "manual" ? styles.inputTabActive : ""}`}
          onClick={() => { setInputTab("manual"); setResult(null); setBatchResult(null); }}
        >
          직접 입력
        </button>
      </div>

      {inputTab === "upload" && (
        <div>
          <div className={styles.uploadArea}>
            <input
              type="file"
              ref={fileRef}
              accept="image/*"
              multiple
              className={styles.fileInput}
              onChange={handleFileSelect}
            />
            <button
              className={styles.submitBtn}
              onClick={handleUpload}
              disabled={uploadIsPending || selectedFiles.length === 0}
            >
              {uploadIsPending
                ? `OCR 처리 중... (${selectedFiles.length}장)`
                : selectedFiles.length > 0
                  ? `업로드 + OCR (${selectedFiles.length}장)`
                  : "업로드 + OCR"}
            </button>
          </div>
          {selectedFiles.length > 0 && !uploadIsPending && (
            <div className={styles.fileList}>
              {selectedFiles.map((f, i) => (
                <span key={i} className={styles.fileChip}>
                  {f.name}
                  <button className={styles.fileChipRemove} onClick={() => removeFile(i)}>x</button>
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {inputTab === "manual" && (
        <form onSubmit={handleManualSubmit} className={styles.form}>
          <div className={styles.formRow} ref={suggestRef} style={{ position: "relative" }}>
            <label className={styles.label}>사업자등록번호</label>
            <input
              className={`${styles.input} ${vendorMatched ? styles.inputMatched : ""}`}
              type="text"
              placeholder="000-00-00000"
              value={vendorBizNo}
              onChange={(e) => handleBizNoChange(e.target.value)}
              onBlur={handleBizNoBlur}
              onFocus={() => { if (suggestions.length > 0) setShowSuggestions(true); }}
              required
              autoComplete="off"
            />
            {showSuggestions && suggestions.length > 0 && (
              <ul className={styles.autocomplete}>
                {suggestions.map((v) => (
                  <li
                    key={v.id}
                    className={styles.autocompleteItem}
                    onMouseDown={() => selectVendor(v)}
                  >
                    <span className={styles.autocompleteNo}>{v.bizNo}</span>
                    <span className={styles.autocompleteName}>{v.name}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className={styles.formRow}>
            <label className={styles.label}>
              거래처명
              {vendorMatched && <span className={styles.matchBadge}>기존 거래처</span>}
            </label>
            <input
              className={`${styles.input} ${vendorMatched ? styles.inputMatched : ""}`}
              type="text"
              placeholder={vendorMatched ? "" : "새 거래처명 입력"}
              value={vendorName}
              onChange={(e) => setVendorName(e.target.value)}
              readOnly={vendorMatched}
              required
            />
          </div>
          <div className={styles.formRow}>
            <label className={styles.label}>금액</label>
            <input
              className={styles.input}
              type="number"
              placeholder="예: 45000"
              value={totalAmount}
              onChange={(e) => setTotalAmount(e.target.value)}
              required
              min={1}
            />
          </div>
          <div className={styles.formRow}>
            <label className={styles.label}>통화</label>
            <select
              className={styles.input}
              value={docCurrency}
              onChange={(e) => setDocCurrency(e.target.value)}
            >
              {CURRENCY_OPTIONS.map((c) => (
                <option key={c.code} value={c.code}>{c.name}</option>
              ))}
            </select>
          </div>
          <div className={styles.formRow}>
            <label className={styles.label}>거래일</label>
            <input
              className={styles.input}
              type="date"
              value={transactionAt}
              onChange={(e) => setTransactionAt(e.target.value)}
              required
            />
          </div>
          <button
            type="submit"
            className={styles.submitBtn}
            disabled={createIsPending}
          >
            {createIsPending ? "처리 중..." : "등록"}
          </button>
        </form>
      )}

      {/* 단건 결과 (수기 입력) */}
      {result && (
        <div className={styles.resultBox}>
          {result.ocr && (
            <div className={styles.ocrSection}>
              <h3 className={styles.resultTitle}>OCR 추출 결과</h3>
              <div className={styles.resultGrid}>
                <div>
                  <span className={styles.resultLabel}>거래처명</span>
                  <span className={styles.resultValue}>
                    {result.ocr.vendor_name || "추출 실패"}
                  </span>
                </div>
                <div>
                  <span className={styles.resultLabel}>금액</span>
                  <span className={styles.resultValue}>
                    {result.ocr.total_amount
                      ? `${result.ocr.total_amount.toLocaleString()}원`
                      : "추출 실패"}
                  </span>
                </div>
                <div>
                  <span className={styles.resultLabel}>날짜</span>
                  <span className={styles.resultValue}>
                    {result.ocr.transaction_date || "추출 실패"}
                  </span>
                </div>
                <div>
                  <span className={styles.resultLabel}>OCR 신뢰도</span>
                  <span className={styles.resultValue}>
                    {Math.round(result.ocr.confidence * 100)}%
                  </span>
                </div>
              </div>
            </div>
          )}
          {result.classification && (
            <div className={styles.classifySection}>
              <h3 className={styles.resultTitle}>AI 분류 결과</h3>
              <div className={styles.resultGrid}>
                <div>
                  <span className={styles.resultLabel}>추천 계정</span>
                  <span className={styles.resultValue}>
                    {result.classification.accountCode}{" "}
                    {result.classification.accountName}
                  </span>
                </div>
                <div>
                  <span className={styles.resultLabel}>신뢰도</span>
                  <span className={styles.resultValue}>
                    {Math.round(result.classification.confidence * 100)}%
                  </span>
                </div>
                <div>
                  <span className={styles.resultLabel}>전표 상태</span>
                  <span className={`${styles.status} ${styles.statusJournal}`}>
                    자동 생성 완료
                  </span>
                </div>
              </div>
            </div>
          )}
          {!result.classification && result.ocr && (
            <div className={styles.ocrCompleteSection}>
              {result.ocr.total_amount ? (
                <>
                  <p className={styles.ocrWarning}>
                    사업자등록번호와 거래처명을 입력하면 전표가 자동 생성됩니다.
                  </p>
                  <div className={styles.ocrCompleteForm}>
                    <div ref={ocrSuggestRef} style={{ position: "relative" }}>
                      <input
                        className={`${styles.input} ${ocrVendorMatched ? styles.inputMatched : ""}`}
                        type="text"
                        placeholder="사업자등록번호"
                        value={ocrBizNoInput}
                        onChange={(e) => handleOcrBizNoChange(e.target.value)}
                        onBlur={handleOcrBizNoBlur}
                        onFocus={() => { if (ocrSuggestions.length > 0) setShowOcrSuggestions(true); }}
                        autoComplete="off"
                      />
                      {showOcrSuggestions && ocrSuggestions.length > 0 && (
                        <ul className={styles.autocomplete}>
                          {ocrSuggestions.map((v) => (
                            <li
                              key={v.id}
                              className={styles.autocompleteItem}
                              onMouseDown={() => selectOcrVendor(v)}
                            >
                              <span className={styles.autocompleteNo}>{v.bizNo}</span>
                              <span className={styles.autocompleteName}>{v.name}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                    <input
                      className={`${styles.input} ${ocrVendorMatched ? styles.inputMatched : ""}`}
                      type="text"
                      placeholder={ocrVendorMatched ? "" : "새 거래처명 입력"}
                      value={ocrVendorInput}
                      onChange={(e) => setOcrVendorInput(e.target.value)}
                      readOnly={ocrVendorMatched}
                    />
                    <button
                      className={styles.submitBtn}
                      onClick={handleOcrComplete}
                      disabled={!ocrBizNoInput || !ocrVendorInput || completeOcrIsPending}
                    >
                      {completeOcrIsPending ? "처리 중..." : "전표 생성"}
                    </button>
                  </div>
                </>
              ) : (
                <p className={styles.ocrWarning}>
                  금액을 추출하지 못해 전표를 자동 생성하지 못했습니다. 수동으로 입력해주세요.
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* 일괄 업로드 결과 */}
      {batchResult && (
        <div className={styles.resultBox}>
          <div className={styles.batchSummary}>
            <span>총 {batchResult.total}장</span>
            <span className={styles.batchSuccess}>성공 {batchResult.success}장</span>
            {batchResult.failed > 0 && (
              <span className={styles.batchFailed}>실패 {batchResult.failed}장</span>
            )}
          </div>
          <div className={styles.batchResults}>
            {batchResult.results.map((item) => (
              <BatchCard
                key={item.index}
                item={item}
                tenantId={tenantId}
                onJournalCreated={onJournalCreated}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
