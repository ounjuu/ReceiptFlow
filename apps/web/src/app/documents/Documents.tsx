"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost, apiPatch, apiDelete, apiUpload, API_BASE } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import styles from "./Documents.module.css";
import DocumentForm from "./DocumentForm";
import DocumentTable from "./DocumentTable";
import type {
  Vendor,
  InputTab,
  Document,
  CreateResult,
  BatchResult,
} from "./types";

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
  const [batchResult, setBatchResult] = useState<BatchResult | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);

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

  // 이미지 업로드 (OCR) — 일괄
  const uploadMutation = useMutation({
    mutationFn: async (files: File[]) => {
      const fd = new FormData();
      files.forEach((f) => fd.append("files", f));
      fd.append("tenantId", tenantId!);
      return apiUpload<BatchResult>("/documents/upload-batch", fd);
    },
    onSuccess: (data) => {
      setBatchResult(data);
      setResult(null);
      setSelectedFiles([]);
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

  const handleFileSelect = () => {
    const files = fileRef.current?.files;
    if (!files) return;
    const arr = Array.from(files).slice(0, 10);
    setSelectedFiles(arr);
  };

  const removeFile = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleUpload = () => {
    if (selectedFiles.length === 0) return;
    if (selectedFiles.length > 10) {
      alert("최대 10장까지 업로드할 수 있습니다.");
      return;
    }
    uploadMutation.mutate(selectedFiles);
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

  const onJournalCreated = () => {
    queryClient.invalidateQueries({ queryKey: ["documents"] });
    queryClient.invalidateQueries({ queryKey: ["journals"] });
    queryClient.invalidateQueries({ queryKey: ["vendors"] });
  };

  return (
    <div>
      <h1 className={styles.title}>영수증 관리</h1>

      {canEdit && (
        <DocumentForm
          inputTab={inputTab}
          setInputTab={setInputTab}
          fileRef={fileRef}
          selectedFiles={selectedFiles}
          handleFileSelect={handleFileSelect}
          removeFile={removeFile}
          handleUpload={handleUpload}
          uploadIsPending={uploadMutation.isPending}
          vendorBizNo={vendorBizNo}
          vendorName={vendorName}
          vendorMatched={vendorMatched}
          totalAmount={totalAmount}
          docCurrency={docCurrency}
          transactionAt={transactionAt}
          setVendorName={setVendorName}
          setTotalAmount={setTotalAmount}
          setDocCurrency={setDocCurrency}
          setTransactionAt={setTransactionAt}
          handleBizNoChange={handleBizNoChange}
          handleBizNoBlur={handleBizNoBlur}
          selectVendor={selectVendor}
          suggestions={suggestions}
          showSuggestions={showSuggestions}
          setShowSuggestions={setShowSuggestions}
          suggestRef={suggestRef}
          handleManualSubmit={handleManualSubmit}
          createIsPending={createMutation.isPending}
          result={result}
          setResult={setResult}
          batchResult={batchResult}
          setBatchResult={setBatchResult}
          ocrBizNoInput={ocrBizNoInput}
          ocrVendorInput={ocrVendorInput}
          ocrVendorMatched={ocrVendorMatched}
          ocrSuggestions={ocrSuggestions}
          showOcrSuggestions={showOcrSuggestions}
          setShowOcrSuggestions={setShowOcrSuggestions}
          ocrSuggestRef={ocrSuggestRef}
          handleOcrBizNoChange={handleOcrBizNoChange}
          handleOcrBizNoBlur={handleOcrBizNoBlur}
          selectOcrVendor={selectOcrVendor}
          setOcrVendorInput={setOcrVendorInput}
          handleOcrComplete={handleOcrComplete}
          completeOcrIsPending={completeOcrMutation.isPending}
          tenantId={tenantId!}
          onJournalCreated={onJournalCreated}
        />
      )}

      <DocumentTable
        documents={documents}
        canEdit={canEdit}
        canDelete={canDelete}
        editingId={editingId}
        editVendor={editVendor}
        editAmount={editAmount}
        editDate={editDate}
        setEditVendor={setEditVendor}
        setEditAmount={setEditAmount}
        setEditDate={setEditDate}
        startEdit={startEdit}
        handleUpdate={handleUpdate}
        handleDelete={handleDelete}
        setEditingId={setEditingId}
        updateMutation={updateMutation}
        filterStart={filterStart}
        filterEnd={filterEnd}
        setFilterStart={setFilterStart}
        setFilterEnd={setFilterEnd}
        setPreviewUrl={setPreviewUrl}
        API_BASE={API_BASE}
      />

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
