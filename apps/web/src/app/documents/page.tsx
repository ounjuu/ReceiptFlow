"use client";

import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost, apiPatch, apiDelete, apiUpload, TENANT_ID } from "@/lib/api";
import styles from "./page.module.css";

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
  status: string;
  imageUrl: string | null;
  createdAt: string;
  journalEntry: JournalEntry | null;
}

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
  const queryClient = useQueryClient();
  const [inputTab, setInputTab] = useState<InputTab>("upload");
  const fileRef = useRef<HTMLInputElement>(null);

  // 수동 입력
  const [vendorName, setVendorName] = useState("");
  const [totalAmount, setTotalAmount] = useState("");
  const [transactionAt, setTransactionAt] = useState(
    new Date().toISOString().slice(0, 10),
  );

  const [result, setResult] = useState<CreateResult | null>(null);

  // 수정 모드
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editVendor, setEditVendor] = useState("");
  const [editAmount, setEditAmount] = useState("");
  const [editDate, setEditDate] = useState("");

  const { data: documents = [] } = useQuery({
    queryKey: ["documents"],
    queryFn: () => apiGet<Document[]>(`/documents?tenantId=${TENANT_ID}`),
  });

  // 이미지 업로드 (OCR)
  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("tenantId", TENANT_ID);
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
      totalAmount: number;
      transactionAt: string;
    }) => apiPost<CreateResult>("/documents", body),
    onSuccess: (data) => {
      setResult(data);
      setVendorName("");
      setTotalAmount("");
      queryClient.invalidateQueries({ queryKey: ["documents"] });
      queryClient.invalidateQueries({ queryKey: ["journals"] });
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
    if (!vendorName || !totalAmount) return;
    createMutation.mutate({
      tenantId: TENANT_ID,
      vendorName,
      totalAmount: Number(totalAmount),
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

  // OCR 후 거래처명 보완 입력
  const [ocrVendorInput, setOcrVendorInput] = useState("");

  const completeOcrMutation = useMutation({
    mutationFn: (body: {
      tenantId: string;
      vendorName: string;
      totalAmount: number;
      transactionAt: string;
    }) => apiPost<CreateResult>("/documents", body),
    onSuccess: (data) => {
      setResult(data);
      setOcrVendorInput("");
      queryClient.invalidateQueries({ queryKey: ["documents"] });
      queryClient.invalidateQueries({ queryKey: ["journals"] });
    },
  });

  const handleOcrComplete = () => {
    if (!ocrVendorInput || !result?.ocr) return;
    completeOcrMutation.mutate({
      tenantId: TENANT_ID,
      vendorName: ocrVendorInput,
      totalAmount: result.ocr.total_amount!,
      transactionAt: result.ocr.transaction_date || new Date().toISOString().slice(0, 10),
    });
  };

  const isPending = uploadMutation.isPending || createMutation.isPending;

  return (
    <div>
      <h1 className={styles.title}>영수증 관리</h1>

      <div className={styles.formSection}>
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
            <div className={styles.formRow}>
              <label className={styles.label}>거래처명</label>
              <input
                className={styles.input}
                type="text"
                placeholder="예: 스타벅스 강남점"
                value={vendorName}
                onChange={(e) => setVendorName(e.target.value)}
                required
              />
            </div>
            <div className={styles.formRow}>
              <label className={styles.label}>금액 (원)</label>
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
                {!result.ocr.vendor_name && result.ocr.total_amount ? (
                  <>
                    <p className={styles.ocrWarning}>
                      거래처명을 추출하지 못했습니다. 직접 입력해주세요.
                    </p>
                    <div className={styles.ocrCompleteForm}>
                      <input
                        className={styles.input}
                        type="text"
                        placeholder="거래처명 입력"
                        value={ocrVendorInput}
                        onChange={(e) => setOcrVendorInput(e.target.value)}
                      />
                      <button
                        className={styles.submitBtn}
                        onClick={handleOcrComplete}
                        disabled={!ocrVendorInput || completeOcrMutation.isPending}
                      >
                        {completeOcrMutation.isPending ? "처리 중..." : "전표 생성"}
                      </button>
                    </div>
                  </>
                ) : !result.ocr.total_amount ? (
                  <p className={styles.ocrWarning}>
                    금액을 추출하지 못해 전표를 자동 생성하지 못했습니다. 수동으로 수정해주세요.
                  </p>
                ) : null}
              </div>
            )}
          </div>
        )}
      </div>

      <div className={styles.tableSection}>
        <h2 className={styles.sectionTitle}>영수증 목록</h2>
        <table>
          <thead>
            <tr>
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
                  <td>{doc.vendorName || "-"}</td>
                  <td>
                    {doc.transactionAt
                      ? new Date(doc.transactionAt).toLocaleDateString("ko-KR")
                      : "-"}
                  </td>
                  <td>
                    {doc.totalAmount
                      ? `${Number(doc.totalAmount).toLocaleString()}원`
                      : "-"}
                  </td>
                  <td>
                    <span className={`${styles.status} ${s.cls}`}>{s.text}</span>
                  </td>
                  <td>{new Date(doc.createdAt).toLocaleDateString("ko-KR")}</td>
                  <td>
                    <div className={styles.actions}>
                      <button
                        className={styles.editBtn}
                        onClick={() => startEdit(doc)}
                      >
                        수정
                      </button>
                      <button
                        className={styles.deleteBtn}
                        onClick={() => handleDelete(doc.id)}
                      >
                        삭제
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {documents.length === 0 && (
              <tr>
                <td colSpan={6} style={{ textAlign: "center", color: "var(--text-muted)" }}>
                  영수증이 없습니다
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
