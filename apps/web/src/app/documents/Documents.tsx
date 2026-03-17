"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost, apiPatch, apiDelete, apiUpload, API_BASE } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { exportToXlsx } from "@/lib/export-xlsx";
import styles from "./Documents.module.css";

interface Vendor {
  id: string;
  name: string;
  bizNo: string | null;
}

type InputTab = "upload" | "manual";

interface JournalLine {
  debit: string;
  credit: string;
  account: { code: string; name: string };
}

interface JournalEntry {
  id: string;
  lines: JournalLine[];
}

interface Document {
  id: string;
  vendorName: string | null;
  transactionAt: string | null;
  totalAmount: string | null;
  currency: string;
  status: string;
  imageUrl: string | null;
  createdAt: string;
  journalEntry: JournalEntry | null;
}

const CURRENCY_SYMBOLS: Record<string, string> = {
  KRW: "₩", USD: "$", EUR: "€", JPY: "¥", CNY: "¥", GBP: "£",
};

const CURRENCY_OPTIONS = [
  { code: "KRW", name: "원 (KRW)" },
  { code: "USD", name: "달러 (USD)" },
  { code: "EUR", name: "유로 (EUR)" },
  { code: "JPY", name: "엔 (JPY)" },
  { code: "CNY", name: "위안 (CNY)" },
  { code: "GBP", name: "파운드 (GBP)" },
];

interface OcrData {
  raw_text: string;
  vendor_name: string | null;
  total_amount: number | null;
  transaction_date: string | null;
  confidence: number;
}

interface CreateResult {
  document: Document;
  journalEntry: JournalEntry | null;
  classification: {
    accountCode: string;
    accountName: string;
    confidence: number;
  } | null;
  ocr?: OcrData;
}

function statusLabel(status: string) {
  switch (status) {
    case "PENDING": return { text: "대기", cls: styles.statusPending };
    case "OCR_DONE": return { text: "OCR 완료", cls: styles.statusOcr };
    case "JOURNAL_CREATED": return { text: "전표 생성", cls: styles.statusJournal };
    default: return { text: status, cls: "" };
  }
}

export default function DocumentsPage() {
  const { tenantId, canEdit, canDelete } = useAuth();
  const queryClient = useQueryClient();
  const [inputTab, setInputTab] = useState<InputTab>("upload");
  const fileRef = useRef<HTMLInputElement>(null);

  // 수동 입력
  const [vendorName, setVendorName] = useState("");
  const [vendorBizNo, setVendorBizNo] = useState("");
  const [vendorMatched, setVendorMatched] = useState(false);
  const [totalAmount, setTotalAmount] = useState("");
  const [docCurrency, setDocCurrency] = useState("KRW");
  const [transactionAt, setTransactionAt] = useState(
    new Date().toISOString().slice(0, 10),
  );

  const [result, setResult] = useState<CreateResult | null>(null);

  // 자동완성 상태 (수기 입력)
  const [suggestions, setSuggestions] = useState<Vendor[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const suggestRef = useRef<HTMLDivElement>(null);

  // 자동완성 상태 (OCR)
  const [ocrSuggestions, setOcrSuggestions] = useState<Vendor[]>([]);
  const [showOcrSuggestions, setShowOcrSuggestions] = useState(false);
  const ocrSuggestRef = useRef<HTMLDivElement>(null);

  // 바깥 클릭 시 드롭다운 닫기
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (suggestRef.current && !suggestRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
      if (ocrSuggestRef.current && !ocrSuggestRef.current.contains(e.target as Node)) {
        setShowOcrSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // 부분검색 API
  const searchAutocomplete = useCallback(async (query: string): Promise<Vendor[]> => {
    if (!query.trim() || !tenantId) return [];
    try {
      return await apiGet<Vendor[]>(`/vendors/autocomplete?tenantId=${tenantId}&q=${encodeURIComponent(query.trim())}`);
    } catch {
      return [];
    }
  }, [tenantId]);

  // 수기 입력 - bizNo 변경 시 자동완성
  const handleBizNoChange = async (value: string) => {
    setVendorBizNo(value);
    setVendorMatched(false);
    setVendorName("");
    if (value.trim().length >= 1) {
      const results = await searchAutocomplete(value);
      setSuggestions(results);
      setShowSuggestions(results.length > 0);
    } else {
      setSuggestions([]);
      setShowSuggestions(false);
    }
  };

  // 자동완성에서 선택
  const selectVendor = (vendor: Vendor) => {
    setVendorBizNo(vendor.bizNo || "");
    setVendorName(vendor.name);
    setVendorMatched(true);
    setShowSuggestions(false);
  };

  // blur 시 정확 매칭 확인
  const handleBizNoBlur = async () => {
    // 드롭다운 클릭을 위해 약간 딜레이
    setTimeout(async () => {
      if (!vendorBizNo.trim() || vendorMatched) return;
      try {
        const vendor = await apiGet<Vendor | null>(`/vendors/search?tenantId=${tenantId}&bizNo=${encodeURIComponent(vendorBizNo.trim())}`);
        if (vendor) {
          setVendorName(vendor.name);
          setVendorMatched(true);
        }
      } catch { /* ignore */ }
      setShowSuggestions(false);
    }, 200);
  };

  // 이미지 미리보기 모달
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  // 기간 필터
  const [filterStart, setFilterStart] = useState("");
  const [filterEnd, setFilterEnd] = useState("");

  // 수정 모드
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editVendor, setEditVendor] = useState("");
  const [editAmount, setEditAmount] = useState("");
  const [editDate, setEditDate] = useState("");

  const dateParams = [
    filterStart && `startDate=${filterStart}`,
    filterEnd && `endDate=${filterEnd}`,
  ].filter(Boolean).join("&");

  const { data: documents = [] } = useQuery({
    queryKey: ["documents", filterStart, filterEnd],
    queryFn: () => apiGet<Document[]>(`/documents?tenantId=${tenantId}${dateParams ? `&${dateParams}` : ""}`),
  });

  // 이미지 업로드 (OCR)
  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("tenantId", tenantId!);
      return apiUpload<CreateResult>("/documents/upload", fd);
    },
    onSuccess: (data) => {
      setResult(data);
      if (fileRef.current) fileRef.current.value = "";
      queryClient.invalidateQueries({ queryKey: ["documents"] });
      queryClient.invalidateQueries({ queryKey: ["journals"] });
    },
  });

  // 수동 입력
  const createMutation = useMutation({
    mutationFn: (body: {
      tenantId: string;
      vendorName: string;
      vendorBizNo: string;
      totalAmount: number;
      currency: string;
      transactionAt: string;
    }) => apiPost<CreateResult>("/documents", body),
    onSuccess: (data) => {
      setResult(data);
      setVendorName("");
      setVendorBizNo("");
      setVendorMatched(false);
      setTotalAmount("");
      setDocCurrency("KRW");
      queryClient.invalidateQueries({ queryKey: ["documents"] });
      queryClient.invalidateQueries({ queryKey: ["journals"] });
      queryClient.invalidateQueries({ queryKey: ["vendors"] });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Record<string, unknown> }) =>
      apiPatch<Document>(`/documents/${id}`, body),
    onSuccess: () => {
      setEditingId(null);
      queryClient.invalidateQueries({ queryKey: ["documents"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiDelete(`/documents/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["documents"] });
      queryClient.invalidateQueries({ queryKey: ["journals"] });
    },
  });

  const handleUpload = () => {
    const file = fileRef.current?.files?.[0];
    if (file) uploadMutation.mutate(file);
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!vendorName || !vendorBizNo || !totalAmount) return;
    createMutation.mutate({
      tenantId: tenantId!,
      vendorName,
      vendorBizNo,
      totalAmount: Number(totalAmount),
      currency: docCurrency,
      transactionAt,
    });
  };

  const startEdit = (doc: Document) => {
    setEditingId(doc.id);
    setEditVendor(doc.vendorName || "");
    setEditAmount(doc.totalAmount ? String(Number(doc.totalAmount)) : "");
    setEditDate(
      doc.transactionAt
        ? new Date(doc.transactionAt).toISOString().slice(0, 10)
        : "",
    );
  };

  const handleUpdate = (id: string) => {
    updateMutation.mutate({
      id,
      body: {
        vendorName: editVendor,
        totalAmount: Number(editAmount),
        transactionAt: editDate,
      },
    });
  };

  const handleDelete = (id: string) => {
    if (confirm("이 영수증을 삭제하시겠습니까? 연결된 전표도 함께 삭제됩니다.")) {
      deleteMutation.mutate(id);
    }
  };

  // OCR 후 보완 입력
  const [ocrVendorInput, setOcrVendorInput] = useState("");
  const [ocrBizNoInput, setOcrBizNoInput] = useState("");
  const [ocrVendorMatched, setOcrVendorMatched] = useState(false);

  const handleOcrBizNoChange = async (value: string) => {
    setOcrBizNoInput(value);
    setOcrVendorMatched(false);
    setOcrVendorInput("");
    if (value.trim().length >= 1) {
      const results = await searchAutocomplete(value);
      setOcrSuggestions(results);
      setShowOcrSuggestions(results.length > 0);
    } else {
      setOcrSuggestions([]);
      setShowOcrSuggestions(false);
    }
  };

  const selectOcrVendor = (vendor: Vendor) => {
    setOcrBizNoInput(vendor.bizNo || "");
    setOcrVendorInput(vendor.name);
    setOcrVendorMatched(true);
    setShowOcrSuggestions(false);
  };

  const handleOcrBizNoBlur = async () => {
    setTimeout(async () => {
      if (!ocrBizNoInput.trim() || ocrVendorMatched) return;
      try {
        const vendor = await apiGet<Vendor | null>(`/vendors/search?tenantId=${tenantId}&bizNo=${encodeURIComponent(ocrBizNoInput.trim())}`);
        if (vendor) {
          setOcrVendorInput(vendor.name);
          setOcrVendorMatched(true);
        }
      } catch { /* ignore */ }
      setShowOcrSuggestions(false);
    }, 200);
  };

  const completeOcrMutation = useMutation({
    mutationFn: (body: {
      tenantId: string;
      vendorName: string;
      vendorBizNo: string;
      totalAmount: number;
      transactionAt: string;
    }) => apiPost<CreateResult>("/documents", body),
    onSuccess: (data) => {
      setResult(data);
      setOcrVendorInput("");
      setOcrBizNoInput("");
      setOcrVendorMatched(false);
      queryClient.invalidateQueries({ queryKey: ["documents"] });
      queryClient.invalidateQueries({ queryKey: ["journals"] });
      queryClient.invalidateQueries({ queryKey: ["vendors"] });
    },
  });

  const handleOcrComplete = () => {
    if (!ocrBizNoInput || !ocrVendorInput || !result?.ocr) return;
    completeOcrMutation.mutate({
      tenantId: tenantId!,
      vendorName: ocrVendorInput,
      vendorBizNo: ocrBizNoInput,
      totalAmount: result.ocr.total_amount!,
      transactionAt: result.ocr.transaction_date || new Date().toISOString().slice(0, 10),
    });
  };

  const isPending = uploadMutation.isPending || createMutation.isPending;

  return (
    <div>
      <h1 className={styles.title}>영수증 관리</h1>

      {canEdit && <div className={styles.formSection}>
        <div className={styles.inputTabs}>
          <button
            className={`${styles.inputTab} ${inputTab === "upload" ? styles.inputTabActive : ""}`}
            onClick={() => { setInputTab("upload"); setResult(null); }}
          >
            이미지 업로드
          </button>
          <button
            className={`${styles.inputTab} ${inputTab === "manual" ? styles.inputTabActive : ""}`}
            onClick={() => { setInputTab("manual"); setResult(null); }}
          >
            직접 입력
          </button>
        </div>

        {inputTab === "upload" && (
          <div className={styles.uploadArea}>
            <input
              type="file"
              ref={fileRef}
              accept="image/*"
              className={styles.fileInput}
            />
            <button
              className={styles.submitBtn}
              onClick={handleUpload}
              disabled={uploadMutation.isPending}
            >
              {uploadMutation.isPending ? "OCR 처리 중..." : "업로드 + OCR"}
            </button>
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
              disabled={createMutation.isPending}
            >
              {createMutation.isPending ? "처리 중..." : "등록"}
            </button>
          </form>
        )}

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
                        disabled={!ocrBizNoInput || !ocrVendorInput || completeOcrMutation.isPending}
                      >
                        {completeOcrMutation.isPending ? "처리 중..." : "전표 생성"}
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
      </div>}

      <div className={styles.tableSection}>
        <div className={styles.tableHeader}>
          <h2 className={styles.sectionTitle}>영수증 목록</h2>
          <div className={styles.filterRow}>
            <button
              className={styles.downloadBtn}
              onClick={() => {
                const statusText = (s: string) => {
                  switch (s) {
                    case "PENDING": return "대기";
                    case "OCR_DONE": return "OCR 완료";
                    case "JOURNAL_CREATED": return "전표 생성";
                    default: return s;
                  }
                };
                exportToXlsx("영수증목록", "영수증", ["거래처", "거래일", "금액", "상태", "등록일"], documents.map((d) => [
                  d.vendorName || "",
                  d.transactionAt ? new Date(d.transactionAt).toLocaleDateString("ko-KR") : "",
                  d.totalAmount ? Number(d.totalAmount) : 0,
                  statusText(d.status),
                  new Date(d.createdAt).toLocaleDateString("ko-KR"),
                ]));
              }}
              disabled={documents.length === 0}
            >
              엑셀 다운로드
            </button>
          </div>
          <div className={styles.filterRow}>
            <span className={styles.filterLabel}>거래일 기준</span>
            <input
              className={styles.filterInput}
              type="date"
              value={filterStart}
              onChange={(e) => setFilterStart(e.target.value)}
            />
            <span className={styles.filterSep}>~</span>
            <input
              className={styles.filterInput}
              type="date"
              value={filterEnd}
              onChange={(e) => setFilterEnd(e.target.value)}
            />
            {(filterStart || filterEnd) && (
              <button
                className={styles.filterClear}
                onClick={() => { setFilterStart(""); setFilterEnd(""); }}
              >
                초기화
              </button>
            )}
          </div>
        </div>
        <table>
          <thead>
            <tr>
              <th>영수증</th>
              <th>거래처</th>
              <th>거래일</th>
              <th>금액</th>
              <th>상태</th>
              <th>등록일</th>
              <th>관리</th>
            </tr>
          </thead>
          <tbody>
            {documents.map((doc) => {
              const s = statusLabel(doc.status);
              const isEditing = editingId === doc.id;

              if (isEditing) {
                return (
                  <tr key={doc.id}>
                    <td>
                      {doc.imageUrl ? (
                        <img
                          src={`${API_BASE}${doc.imageUrl}`}
                          alt="영수증"
                          className={styles.thumbnail}
                          onClick={() => setPreviewUrl(`${API_BASE}${doc.imageUrl}`)}
                        />
                      ) : "-"}
                    </td>
                    <td>
                      <input
                        className={styles.editInput}
                        value={editVendor}
                        onChange={(e) => setEditVendor(e.target.value)}
                      />
                    </td>
                    <td>
                      <input
                        className={styles.editInput}
                        type="date"
                        value={editDate}
                        onChange={(e) => setEditDate(e.target.value)}
                      />
                    </td>
                    <td>
                      <input
                        className={styles.editInput}
                        type="number"
                        value={editAmount}
                        onChange={(e) => setEditAmount(e.target.value)}
                      />
                    </td>
                    <td>
                      <span className={`${styles.status} ${s.cls}`}>{s.text}</span>
                    </td>
                    <td>{new Date(doc.createdAt).toLocaleDateString("ko-KR")}</td>
                    <td>
                      <div className={styles.actions}>
                        <button
                          className={styles.saveBtn}
                          onClick={() => handleUpdate(doc.id)}
                          disabled={updateMutation.isPending}
                        >
                          저장
                        </button>
                        <button
                          className={styles.cancelBtn}
                          onClick={() => setEditingId(null)}
                        >
                          취소
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              }

              return (
                <tr key={doc.id}>
                  <td>
                    {doc.imageUrl ? (
                      <img
                        src={`${API_BASE}${doc.imageUrl}`}
                        alt="영수증"
                        className={styles.thumbnail}
                        onClick={() => setPreviewUrl(`${API_BASE}${doc.imageUrl}`)}
                      />
                    ) : "-"}
                  </td>
                  <td>{doc.vendorName || "-"}</td>
                  <td>
                    {doc.transactionAt
                      ? new Date(doc.transactionAt).toLocaleDateString("ko-KR")
                      : "-"}
                  </td>
                  <td>
                    {doc.totalAmount
                      ? `${CURRENCY_SYMBOLS[doc.currency] || ""}${Number(doc.totalAmount).toLocaleString()}`
                      : "-"}
                  </td>
                  <td>
                    <span className={`${styles.status} ${s.cls}`}>{s.text}</span>
                  </td>
                  <td>{new Date(doc.createdAt).toLocaleDateString("ko-KR")}</td>
                  <td>
                    {(canEdit || canDelete) && (
                      <div className={styles.actions}>
                        {canEdit && (
                          <button
                            className={styles.editBtn}
                            onClick={() => startEdit(doc)}
                          >
                            수정
                          </button>
                        )}
                        {canDelete && (
                          <button
                            className={styles.deleteBtn}
                            onClick={() => handleDelete(doc.id)}
                          >
                            삭제
                          </button>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
            {documents.length === 0 && (
              <tr>
                <td colSpan={7} style={{ textAlign: "center", color: "var(--text-muted)" }}>
                  영수증이 없습니다
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {previewUrl && (
        <div className={styles.modalOverlay} onClick={() => setPreviewUrl(null)}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <button className={styles.modalClose} onClick={() => setPreviewUrl(null)}>
              X
            </button>
            <img src={previewUrl} alt="영수증 원본" className={styles.modalImage} />
          </div>
        </div>
      )}
    </div>
  );
}
