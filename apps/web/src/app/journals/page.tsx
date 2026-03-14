"use client";

import React, { useState, useCallback, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost, apiPatch, apiDelete, apiUpload } from "@/lib/api";
import { API_BASE } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { exportToXlsx } from "@/lib/export-xlsx";
import styles from "./page.module.css";

interface Account {
  id: string;
  code: string;
  name: string;
  type: string;
}

interface Vendor {
  id: string;
  name: string;
  bizNo: string | null;
}

interface JournalLine {
  debit: string;
  credit: string;
  account: { id: string; code: string; name: string };
  vendor: { id: string; name: string; bizNo: string | null } | null;
}

interface JournalAttachment {
  id: string;
  filename: string;
  url: string;
  createdAt: string;
}

interface JournalEntry {
  id: string;
  date: string;
  description: string | null;
  status: string;
  currency: string;
  exchangeRate: string;
  documentId: string | null;
  lines: JournalLine[];
  attachments?: JournalAttachment[];
}

interface LineInput {
  accountId: string;
  vendorBizNo: string;
  vendorName: string;
  vendorId: string; // 기존 거래처 매칭 시
  debit: number;
  credit: number;
}

function statusLabel(status: string) {
  switch (status) {
    case "DRAFT": return { text: "임시", cls: styles.statusDraft };
    case "PENDING_APPROVAL": return { text: "결재중", cls: styles.statusPending };
    case "APPROVED": return { text: "승인", cls: styles.statusApproved };
    case "POSTED": return { text: "확정", cls: styles.statusPosted };
    default: return { text: status, cls: "" };
  }
}

const CURRENCY_SYMBOLS: Record<string, string> = {
  KRW: "₩",
  USD: "$",
  EUR: "€",
  JPY: "¥",
  CNY: "¥",
  GBP: "£",
};

const CURRENCY_OPTIONS = [
  { code: "KRW", name: "원 (KRW)" },
  { code: "USD", name: "달러 (USD)" },
  { code: "EUR", name: "유로 (EUR)" },
  { code: "JPY", name: "엔 (JPY)" },
  { code: "CNY", name: "위안 (CNY)" },
  { code: "GBP", name: "파운드 (GBP)" },
];

const emptyLine = (): LineInput => ({
  accountId: "",
  vendorBizNo: "",
  vendorName: "",
  vendorId: "",
  debit: 0,
  credit: 0,
});

export default function JournalsPage() {
  const { tenantId, canEdit, canDelete } = useAuth();
  const queryClient = useQueryClient();
  const [formMode, setFormMode] = useState<"none" | "create" | "edit">("none");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [description, setDescription] = useState("");
  const [currency, setCurrency] = useState("KRW");
  const [exchangeRate, setExchangeRate] = useState("1");
  const [lines, setLines] = useState<LineInput[]>([emptyLine(), emptyLine()]);
  const [error, setError] = useState("");

  const [expandedId, setExpandedId] = useState<string | null>(null);

  // 기간 필터
  const [filterStart, setFilterStart] = useState("");
  const [filterEnd, setFilterEnd] = useState("");

  const dateParams = [
    filterStart && `startDate=${filterStart}`,
    filterEnd && `endDate=${filterEnd}`,
  ].filter(Boolean).join("&");

  const { data: journals = [] } = useQuery({
    queryKey: ["journals", filterStart, filterEnd],
    queryFn: () => apiGet<JournalEntry[]>(`/journals?tenantId=${tenantId}${dateParams ? `&${dateParams}` : ""}`),
  });

  const { data: accounts = [] } = useQuery({
    queryKey: ["accounts"],
    queryFn: () => apiGet<Account[]>(`/accounts?tenantId=${tenantId}`),
    enabled: formMode !== "none",
  });

  // 자동완성 상태
  const [lineSuggestions, setLineSuggestions] = useState<Record<number, Vendor[]>>({});
  const [showLineSuggestions, setShowLineSuggestions] = useState<Record<number, boolean>>({});
  const linesSuggestRef = useRef<HTMLDivElement>(null);

  // 바깥 클릭 시 드롭다운 닫기
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (linesSuggestRef.current && !linesSuggestRef.current.contains(e.target as Node)) {
        setShowLineSuggestions({});
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // 통화 변경 시 최신 환율 자동 조회
  const handleCurrencyChange = async (cur: string) => {
    setCurrency(cur);
    if (cur === "KRW") {
      setExchangeRate("1");
      return;
    }
    try {
      const res = await apiGet<{ rate: string }>(`/exchange-rates/latest?tenantId=${tenantId}&currency=${cur}`);
      setExchangeRate(String(Number(res.rate)));
    } catch {
      setExchangeRate("1");
    }
  };

  // 부분검색 API
  const searchAutocomplete = useCallback(async (query: string): Promise<Vendor[]> => {
    if (!query.trim() || !tenantId) return [];
    try {
      return await apiGet<Vendor[]>(`/vendors/autocomplete?tenantId=${tenantId}&q=${encodeURIComponent(query.trim())}`);
    } catch {
      return [];
    }
  }, [tenantId]);

  // 사업자번호 입력 시 자동완성
  const handleBizNoInput = async (index: number, value: string) => {
    updateLine(index, "vendorBizNo", value);
    if (value.trim().length >= 1) {
      const results = await searchAutocomplete(value);
      setLineSuggestions((prev) => ({ ...prev, [index]: results }));
      setShowLineSuggestions((prev) => ({ ...prev, [index]: results.length > 0 }));
    } else {
      setLineSuggestions((prev) => ({ ...prev, [index]: [] }));
      setShowLineSuggestions((prev) => ({ ...prev, [index]: false }));
    }
  };

  // 자동완성 선택
  const selectLineVendor = (index: number, vendor: Vendor) => {
    setLines((prev) =>
      prev.map((l, i) =>
        i === index
          ? { ...l, vendorBizNo: vendor.bizNo || "", vendorName: vendor.name, vendorId: vendor.id }
          : l,
      ),
    );
    setShowLineSuggestions((prev) => ({ ...prev, [index]: false }));
  };

  // blur 시 정확 매칭 확인
  const handleBizNoBlur = async (index: number) => {
    setTimeout(async () => {
      const bizNo = lines[index].vendorBizNo;
      if (!bizNo.trim() || lines[index].vendorId) return;
      try {
        const vendor = await apiGet<Vendor | null>(`/vendors/search?tenantId=${tenantId}&bizNo=${encodeURIComponent(bizNo.trim())}`);
        if (vendor) {
          setLines((prev) =>
            prev.map((l, i) =>
              i === index
                ? { ...l, vendorId: vendor.id, vendorName: vendor.name }
                : l,
            ),
          );
        }
      } catch { /* ignore */ }
      setShowLineSuggestions((prev) => ({ ...prev, [index]: false }));
    }, 200);
  };

  const createMutation = useMutation({
    mutationFn: (body: {
      tenantId: string;
      date: string;
      description: string;
      currency: string;
      exchangeRate: number;
      lines: { accountId: string; vendorId?: string; vendorBizNo?: string; vendorName?: string; debit: number; credit: number }[];
    }) => apiPost<JournalEntry>("/journals", body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["journals"] });
      queryClient.invalidateQueries({ queryKey: ["vendors"] });
      resetForm();
    },
    onError: (err: Error) => setError(err.message),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Record<string, unknown> }) =>
      apiPatch<JournalEntry>(`/journals/${id}`, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["journals"] });
      queryClient.invalidateQueries({ queryKey: ["vendors"] });
      resetForm();
    },
    onError: (err: Error) => setError(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiDelete(`/journals/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["journals"] });
      queryClient.invalidateQueries({ queryKey: ["documents"] });
    },
  });

  const uploadAttachmentMut = useMutation({
    mutationFn: ({ journalId, file }: { journalId: string; file: File }) => {
      const formData = new FormData();
      formData.append("file", file);
      return apiUpload<JournalAttachment>(`/journals/${journalId}/attachments`, formData);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["journals"] }),
  });

  const deleteAttachmentMut = useMutation({
    mutationFn: ({ journalId, attachmentId }: { journalId: string; attachmentId: string }) =>
      apiDelete(`/journals/${journalId}/attachments/${attachmentId}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["journals"] }),
  });

  const resetForm = () => {
    setFormMode("none");
    setEditingId(null);
    setDate(new Date().toISOString().slice(0, 10));
    setDescription("");
    setCurrency("KRW");
    setExchangeRate("1");
    setLines([emptyLine(), emptyLine()]);
    setError("");
  };

  const startEdit = (j: JournalEntry) => {
    setFormMode("edit");
    setEditingId(j.id);
    setDate(new Date(j.date).toISOString().slice(0, 10));
    setDescription(j.description || "");
    setCurrency(j.currency || "KRW");
    setExchangeRate(String(Number(j.exchangeRate) || 1));
    setLines(
      j.lines.map((l) => ({
        accountId: l.account.id,
        vendorBizNo: l.vendor?.bizNo || "",
        vendorName: l.vendor?.name || "",
        vendorId: l.vendor?.id || "",
        debit: Number(l.debit),
        credit: Number(l.credit),
      })),
    );
    setError("");
  };

  const updateLine = (index: number, field: keyof LineInput, value: string) => {
    setLines((prev) =>
      prev.map((l, i) => {
        if (i !== index) return l;
        if (field === "debit" || field === "credit") {
          return { ...l, [field]: Number(value) || 0 };
        }
        // 사업자번호 변경 시 기존 매칭 초기화
        if (field === "vendorBizNo") {
          return { ...l, vendorBizNo: value, vendorId: "", vendorName: "" };
        }
        return { ...l, [field]: value };
      }),
    );
  };

  const addLine = () => {
    setLines((prev) => [...prev, emptyLine()]);
  };

  const removeLine = (index: number) => {
    if (lines.length <= 2) return;
    setLines((prev) => prev.filter((_, i) => i !== index));
  };

  const totalDebit = lines.reduce((s, l) => s + l.debit, 0);
  const totalCredit = lines.reduce((s, l) => s + l.credit, 0);
  const isBalanced = Math.abs(totalDebit - totalCredit) < 0.01;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (lines.some((l) => !l.accountId)) {
      setError("모든 라인의 계정을 선택해주세요");
      return;
    }
    if (lines.some((l) => !l.vendorBizNo)) {
      setError("모든 라인의 사업자등록번호를 입력해주세요");
      return;
    }
    if (lines.some((l) => !l.vendorName)) {
      setError("모든 라인의 거래처명을 입력해주세요");
      return;
    }
    if (!isBalanced) {
      setError("차변과 대변의 합계가 일치하지 않습니다");
      return;
    }
    if (totalDebit === 0) {
      setError("금액을 입력해주세요");
      return;
    }

    // 기존 매칭된 거래처는 vendorId, 신규는 bizNo+name
    const submitLines = lines.map((l) => ({
      accountId: l.accountId,
      ...(l.vendorId
        ? { vendorId: l.vendorId }
        : { vendorBizNo: l.vendorBizNo, vendorName: l.vendorName }),
      debit: l.debit,
      credit: l.credit,
    }));

    if (formMode === "edit" && editingId) {
      updateMutation.mutate({
        id: editingId,
        body: { date, description, currency, exchangeRate: Number(exchangeRate), lines: submitLines },
      });
    } else {
      createMutation.mutate({
        tenantId: tenantId!,
        date,
        description,
        currency,
        exchangeRate: Number(exchangeRate),
        lines: submitLines,
      });
    }
  };

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      apiPatch<JournalEntry>(`/journals/${id}`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["journals"] });
    },
  });

  const handleDelete = (id: string) => {
    if (confirm("이 전표를 삭제하시겠습니까?")) {
      deleteMutation.mutate(id);
    }
  };

  const nextStatus = (current: string): { label: string; next: string } | null => {
    switch (current) {
      case "DRAFT": return { label: "승인", next: "APPROVED" };
      case "APPROVED": return { label: "확정", next: "POSTED" };
      default: return null;
    }
  };

  // 결재 요청
  const submitApprovalMutation = useMutation({
    mutationFn: (documentId: string) =>
      apiPost("/approvals/submit", {
        tenantId,
        documentType: "JOURNAL",
        documentId,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["journals"] });
    },
  });

  // 결재선 존재 여부
  const { data: approvalLines = [] } = useQuery({
    queryKey: ["approval-lines-journal"],
    queryFn: () =>
      apiGet<{ id: string }[]>(
        `/approvals/lines?tenantId=${tenantId}&documentType=JOURNAL`,
      ),
    enabled: !!tenantId,
  });

  const hasApprovalLine = approvalLines.length > 0;

  // 일괄 상태 변경
  const batchMutation = useMutation({
    mutationFn: ({ ids, status }: { ids: string[]; status: string }) =>
      apiPatch<{ count: number }>("/journals/batch/status", { ids, status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["journals"] });
      setSelectedIds(new Set());
    },
  });

  const selectableJournals = journals.filter((j) => j.status !== "POSTED");
  const allSelectableChecked =
    selectableJournals.length > 0 &&
    selectableJournals.every((j) => selectedIds.has(j.id));

  const toggleAll = () => {
    if (allSelectableChecked) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(selectableJournals.map((j) => j.id)));
    }
  };

  const toggleOne = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // 선택된 전표들의 상태 분석
  const selectedJournals = journals.filter((j) => selectedIds.has(j.id));
  const hasDraft = selectedJournals.some((j) => j.status === "DRAFT");
  const hasApproved = selectedJournals.some((j) => j.status === "APPROVED");

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <div>
      <div className={styles.header}>
        <h1 className={styles.title}>전표 관리</h1>
        {formMode === "none" && canEdit && (
          <button
            className={styles.addBtn}
            onClick={() => setFormMode("create")}
          >
            수기 전표 추가
          </button>
        )}
      </div>

      {formMode !== "none" && (
        <div className={styles.formSection}>
          <h2 className={styles.sectionTitle}>
            {formMode === "edit" ? "전표 수정" : "수기 전표 입력"}
          </h2>
          <form onSubmit={handleSubmit}>
            <div className={styles.formTop}>
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
      )}

      <div className={styles.tableSection}>
        <div className={styles.tableHeader}>
          <h2 className={styles.sectionTitle}>전표 목록</h2>
          <div className={styles.filterRow}>
            <button
              className={styles.downloadBtn}
              onClick={() => {
                const statusText = (s: string) => {
                  switch (s) {
                    case "DRAFT": return "임시";
                    case "APPROVED": return "승인";
                    case "POSTED": return "확정";
                    default: return s;
                  }
                };
                exportToXlsx("전표목록", "전표", ["날짜", "거래처", "설명", "상태", "차변합계", "대변합계"], journals.map((j) => [
                  new Date(j.date).toLocaleDateString("ko-KR"),
                  [...new Set(j.lines.map((l) => l.vendor?.name).filter(Boolean))].join(", ") || "",
                  j.description || "",
                  statusText(j.status),
                  j.lines.reduce((s, l) => s + Number(l.debit), 0),
                  j.lines.reduce((s, l) => s + Number(l.credit), 0),
                ]));
              }}
              disabled={journals.length === 0}
            >
              엑셀 다운로드
            </button>
          </div>
          <div className={styles.filterRow}>
            <span className={styles.filterLabel}>전표일 기준</span>
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

        {/* 일괄 처리 바 */}
        {selectedIds.size > 0 && canEdit && (
          <div className={styles.batchBar}>
            <span className={styles.batchCount}>{selectedIds.size}건 선택됨</span>
            {hasDraft && (
              <button
                className={styles.batchApproveBtn}
                disabled={batchMutation.isPending}
                onClick={() => {
                  const draftIds = selectedJournals
                    .filter((j) => j.status === "DRAFT")
                    .map((j) => j.id);
                  if (confirm(`${draftIds.length}건을 일괄 승인하시겠습니까?`)) {
                    batchMutation.mutate({ ids: draftIds, status: "APPROVED" });
                  }
                }}
              >
                일괄 승인
              </button>
            )}
            {hasApproved && (
              <button
                className={styles.batchPostBtn}
                disabled={batchMutation.isPending}
                onClick={() => {
                  const approvedIds = selectedJournals
                    .filter((j) => j.status === "APPROVED")
                    .map((j) => j.id);
                  if (confirm(`${approvedIds.length}건을 일괄 확정하시겠습니까?`)) {
                    batchMutation.mutate({ ids: approvedIds, status: "POSTED" });
                  }
                }}
              >
                일괄 확정
              </button>
            )}
            <button
              className={styles.batchClearBtn}
              onClick={() => setSelectedIds(new Set())}
            >
              선택 해제
            </button>
            {batchMutation.isError && (
              <span className={styles.batchError}>
                {(batchMutation.error as Error).message}
              </span>
            )}
          </div>
        )}

        <table>
          <thead>
            <tr>
              {canEdit && (
                <th style={{ width: 36 }}>
                  <input
                    type="checkbox"
                    checked={allSelectableChecked}
                    onChange={toggleAll}
                  />
                </th>
              )}
              <th>날짜</th>
              <th>거래처</th>
              <th>설명</th>
              <th>통화</th>
              <th>상태</th>
              <th>차변 합계</th>
              <th>대변 합계</th>
              <th>영수증</th>
              <th>첨부</th>
              <th>관리</th>
            </tr>
          </thead>
          <tbody>
            {journals.map((j) => {
              const s = statusLabel(j.status);
              const jTotalDebit = j.lines.reduce((sum, l) => sum + Number(l.debit), 0);
              const jTotalCredit = j.lines.reduce((sum, l) => sum + Number(l.credit), 0);
              const isPosted = j.status === "POSTED";
              return (
                <React.Fragment key={j.id}>
                <tr className={selectedIds.has(j.id) ? styles.selectedRow : ""}>
                  {canEdit && (
                    <td>
                      <input
                        type="checkbox"
                        checked={selectedIds.has(j.id)}
                        disabled={isPosted}
                        onChange={() => toggleOne(j.id)}
                      />
                    </td>
                  )}
                  <td>{new Date(j.date).toLocaleDateString("ko-KR")}</td>
                  <td>
                    {[...new Set(j.lines.map((l) => l.vendor?.name).filter(Boolean))].join(", ") || "-"}
                  </td>
                  <td>{j.description || "-"}</td>
                  <td>{j.currency || "KRW"}</td>
                  <td>
                    <span className={`${styles.status} ${s.cls}`}>{s.text}</span>
                  </td>
                  <td>{(CURRENCY_SYMBOLS[j.currency] || "")}{jTotalDebit.toLocaleString()}</td>
                  <td>{(CURRENCY_SYMBOLS[j.currency] || "")}{jTotalCredit.toLocaleString()}</td>
                  <td>{j.documentId ? "O" : "-"}</td>
                  <td>
                    <button
                      className={styles.attachToggle}
                      onClick={() => setExpandedId(expandedId === j.id ? null : j.id)}
                    >
                      {(j.attachments?.length || 0)}건
                    </button>
                  </td>
                  <td>
                    <div className={styles.actions}>
                      {canEdit && j.status === "DRAFT" && hasApprovalLine && (
                        <button
                          className={styles.statusBtn}
                          onClick={() => submitApprovalMutation.mutate(j.id)}
                          disabled={submitApprovalMutation.isPending}
                        >
                          결재요청
                        </button>
                      )}
                      {canEdit && nextStatus(j.status) && !(j.status === "DRAFT" && hasApprovalLine) && (
                        <button
                          className={styles.statusBtn}
                          onClick={() => {
                            const ns = nextStatus(j.status)!;
                            statusMutation.mutate({ id: j.id, status: ns.next });
                          }}
                          disabled={statusMutation.isPending}
                        >
                          {nextStatus(j.status)!.label}
                        </button>
                      )}
                      {j.status !== "POSTED" && j.status !== "PENDING_APPROVAL" && canEdit && (
                        <button
                          className={styles.editBtn}
                          onClick={() => startEdit(j)}
                        >
                          수정
                        </button>
                      )}
                      {j.status !== "POSTED" && canDelete && (
                        <button
                          className={styles.deleteBtn}
                          onClick={() => handleDelete(j.id)}
                        >
                          삭제
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
                {expandedId === j.id && (
                  <tr>
                    <td colSpan={canEdit ? 12 : 11} className={styles.attachmentRow}>
                      <div className={styles.attachmentSection}>
                        <div className={styles.attachmentList}>
                          {(j.attachments || []).map((att) => (
                            <div key={att.id} className={styles.attachmentItem}>
                              <a
                                href={`${API_BASE}${att.url}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className={styles.attachmentLink}
                              >
                                {att.filename}
                              </a>
                              {canEdit && (
                                <button
                                  className={styles.attachmentDeleteBtn}
                                  onClick={() => {
                                    if (confirm(`${att.filename}을(를) 삭제하시겠습니까?`)) {
                                      deleteAttachmentMut.mutate({ journalId: j.id, attachmentId: att.id });
                                    }
                                  }}
                                >
                                  X
                                </button>
                              )}
                            </div>
                          ))}
                          {(j.attachments || []).length === 0 && (
                            <span className={styles.attachmentEmpty}>첨부파일 없음</span>
                          )}
                        </div>
                        {canEdit && (
                          <label className={styles.attachmentUploadBtn}>
                            파일 첨부
                            <input
                              type="file"
                              hidden
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) {
                                  uploadAttachmentMut.mutate({ journalId: j.id, file });
                                  e.target.value = "";
                                }
                              }}
                            />
                          </label>
                        )}
                      </div>
                    </td>
                  </tr>
                )}
                </React.Fragment>
              );
            })}
            {journals.length === 0 && (
              <tr>
                <td colSpan={canEdit ? 12 : 11} style={{ textAlign: "center", color: "var(--text-muted)" }}>
                  전표가 없습니다
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
