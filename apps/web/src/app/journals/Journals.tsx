"use client";

import React, { useState, useCallback, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost, apiPatch, apiDelete, apiUpload } from "@/lib/api";
import { API_BASE } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { parseXlsx } from "@/lib/import-xlsx";
import styles from "./Journals.module.css";
import {
  Account,
  Vendor,
  ProjectOption,
  DepartmentOption,
  JournalEntry,
  JournalAttachment,
  LineInput,
  emptyLine,
  JOURNAL_TYPES,
} from "./types";
import JournalForm from "./JournalForm";
import JournalTable from "./JournalTable";

export default function JournalsPage() {
  const { tenantId, canEdit, canDelete } = useAuth();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<string>(""); // "" = 전체
  const [formMode, setFormMode] = useState<"none" | "create" | "edit">("none");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [journalType, setJournalType] = useState("GENERAL");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [description, setDescription] = useState("");
  const [currency, setCurrency] = useState("KRW");
  const [exchangeRate, setExchangeRate] = useState("1");
  const [lines, setLines] = useState<LineInput[]>([emptyLine(), emptyLine()]);
  const [error, setError] = useState("");

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [focusedRowId, setFocusedRowId] = useState<string | null>(null);
  const journalImportRef = useRef<HTMLInputElement>(null);
  const [journalImportResult, setJournalImportResult] = useState<{ total: number; success: number; failed: number; results: { index: number; status: string; error?: string }[] } | null>(null);

  // 기간 필터
  const [filterStart, setFilterStart] = useState("");
  const [filterEnd, setFilterEnd] = useState("");

  const queryParams = [
    filterStart && `startDate=${filterStart}`,
    filterEnd && `endDate=${filterEnd}`,
    activeTab && `journalType=${activeTab}`,
  ].filter(Boolean).join("&");

  const { data: journals = [] } = useQuery({
    queryKey: ["journals", filterStart, filterEnd, activeTab],
    queryFn: () => apiGet<JournalEntry[]>(`/journals?tenantId=${tenantId}${queryParams ? `&${queryParams}` : ""}`),
  });

  const { data: accounts = [] } = useQuery({
    queryKey: ["accounts"],
    queryFn: () => apiGet<Account[]>(`/accounts?tenantId=${tenantId}`),
    enabled: formMode !== "none",
  });

  const { data: projects = [] } = useQuery({
    queryKey: ["projects"],
    queryFn: () => apiGet<ProjectOption[]>(`/projects?tenantId=${tenantId}`),
    enabled: formMode !== "none",
  });

  const { data: departments = [] } = useQuery({
    queryKey: ["departments"],
    queryFn: () => apiGet<DepartmentOption[]>(`/departments?tenantId=${tenantId}`),
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
      journalType: string;
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

  const journalImportMutation = useMutation({
    mutationFn: (journals: { date: string; description?: string; lines: { accountCode: string; vendorBizNo?: string; vendorName?: string; debit: number; credit: number }[] }[]) =>
      apiPost<{ total: number; success: number; failed: number; results: { index: number; status: string; error?: string }[] }>("/journals/batch", { tenantId: tenantId!, journals }),
    onSuccess: (data) => {
      setJournalImportResult(data);
      queryClient.invalidateQueries({ queryKey: ["journals"] });
      if (journalImportRef.current) journalImportRef.current.value = "";
    },
  });

  const handleJournalImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const rows = await parseXlsx(file);
      // 전표번호(그룹키)로 그룹핑
      const groups = new Map<string, typeof rows>();
      rows.forEach((r) => {
        const key = r["전표번호"] || `auto-${Math.random()}`;
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key)!.push(r);
      });
      const journals = Array.from(groups.values()).map((group) => {
        const first = group[0];
        return {
          date: first["날짜"] || new Date().toISOString().slice(0, 10),
          description: first["적요"] || undefined,
          lines: group.map((r) => ({
            accountCode: r["계정코드"] || "",
            vendorBizNo: r["사업자번호"] || undefined,
            vendorName: r["거래처명"] || undefined,
            debit: Number(r["차변"]) || 0,
            credit: Number(r["대변"]) || 0,
          })),
        };
      }).filter((j) => j.lines.some((l) => l.accountCode));
      if (journals.length === 0) { alert("유효한 전표 데이터가 없습니다."); return; }
      journalImportMutation.mutate(journals);
    } catch { alert("엑셀 파일 파싱에 실패했습니다."); }
  };

  const resetForm = () => {
    setFormMode("none");
    setEditingId(null);
    setJournalType(activeTab || "GENERAL");
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
    setJournalType(j.journalType || "GENERAL");
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
        projectId: l.project?.id || "",
        departmentId: l.department?.id || "",
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
      ...(l.projectId ? { projectId: l.projectId } : {}),
      ...(l.departmentId ? { departmentId: l.departmentId } : {}),
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
        journalType,
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

  const handleCopy = (id: string) => {
    apiPost<JournalEntry>(`/journals/${id}/copy`, {}).then(() => {
      queryClient.invalidateQueries({ queryKey: ["journals"] });
    });
  };

  const handleReverse = (id: string) => {
    if (confirm("이 전표의 역분개 전표를 생성하시겠습니까?")) {
      apiPost<JournalEntry>(`/journals/${id}/reverse`, {}).then(() => {
        queryClient.invalidateQueries({ queryKey: ["journals"] });
      });
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

  // 탭 변경 시 새 전표 유형 기본값 설정
  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    setSelectedIds(new Set());
    if (tab) setJournalType(tab);
  };

  return (
    <div>
      <div className={styles.header}>
        <h1 className={styles.title}>전표 관리</h1>
        {formMode === "none" && canEdit && (
          <button
            className={styles.addBtn}
            onClick={() => {
              if (activeTab) setJournalType(activeTab);
              setFormMode("create");
            }}
          >
            수기 전표 추가
          </button>
        )}
      </div>

      {/* 전표 유형 탭 */}
      <div className={styles.tabBar}>
        <button
          className={`${styles.tab} ${activeTab === "" ? styles.tabActive : ""}`}
          onClick={() => handleTabChange("")}
        >
          전체
        </button>
        {JOURNAL_TYPES.map((t) => (
          <button
            key={t.code}
            className={`${styles.tab} ${activeTab === t.code ? styles.tabActive : ""}`}
            onClick={() => handleTabChange(t.code)}
          >
            {t.name}
          </button>
        ))}
      </div>

      {formMode !== "none" && (
        <JournalForm
          formMode={formMode}
          editingId={editingId}
          journalType={journalType}
          setJournalType={setJournalType}
          date={date}
          setDate={setDate}
          description={description}
          setDescription={setDescription}
          currency={currency}
          exchangeRate={exchangeRate}
          setExchangeRate={setExchangeRate}
          lines={lines}
          error={error}
          isPending={isPending}
          isBalanced={isBalanced}
          totalDebit={totalDebit}
          totalCredit={totalCredit}
          accounts={accounts}
          projects={projects}
          departments={departments}
          handleCurrencyChange={handleCurrencyChange}
          handleBizNoInput={handleBizNoInput}
          handleBizNoBlur={handleBizNoBlur}
          selectLineVendor={selectLineVendor}
          updateLine={updateLine}
          addLine={addLine}
          removeLine={removeLine}
          handleSubmit={handleSubmit}
          resetForm={resetForm}
          lineSuggestions={lineSuggestions}
          showLineSuggestions={showLineSuggestions}
          setShowLineSuggestions={setShowLineSuggestions}
          linesSuggestRef={linesSuggestRef}
        />
      )}

      <JournalTable
        journals={journals}
        selectedIds={selectedIds}
        expandedId={expandedId}
        canEdit={canEdit}
        canDelete={canDelete}
        hasApprovalLine={hasApprovalLine}
        filterStart={filterStart}
        filterEnd={filterEnd}
        setFilterStart={setFilterStart}
        setFilterEnd={setFilterEnd}
        journalImportRef={journalImportRef}
        journalImportResult={journalImportResult}
        setJournalImportResult={setJournalImportResult}
        handleJournalImport={handleJournalImport}
        journalImportMutation={journalImportMutation}
        toggleAll={toggleAll}
        toggleOne={toggleOne}
        allSelectableChecked={allSelectableChecked}
        hasDraft={hasDraft}
        hasApproved={hasApproved}
        selectedJournals={selectedJournals}
        statusMutation={statusMutation}
        batchMutation={batchMutation}
        submitApprovalMutation={submitApprovalMutation}
        deleteMutation={deleteMutation}
        uploadAttachmentMut={uploadAttachmentMut}
        deleteAttachmentMut={deleteAttachmentMut}
        startEdit={startEdit}
        handleDelete={handleDelete}
        handleCopy={handleCopy}
        handleReverse={handleReverse}
        nextStatus={nextStatus}
        setExpandedId={setExpandedId}
        onClearSelection={() => setSelectedIds(new Set())}
        focusedRowId={focusedRowId}
        setFocusedRowId={setFocusedRowId}
        API_BASE={API_BASE}
      />
    </div>
  );
}
