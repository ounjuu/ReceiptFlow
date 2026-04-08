"use client";

import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiGet } from "@/lib/api";
import { API_BASE } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import styles from "./Journals.module.css";
import {
  Account,
  ProjectOption,
  DepartmentOption,
  JournalEntry,
  JOURNAL_TYPES,
} from "./types";
import JournalForm from "./JournalForm";
import JournalTable from "./JournalTable";
import { useJournalForm } from "./hooks/useJournalForm";
import { useVendorAutocomplete, useSummaryAutocomplete } from "./hooks/useAutocomplete";
import { useJournalActions } from "./hooks/useJournalActions";

export default function JournalsPage() {
  const { tenantId, canEdit, canDelete } = useAuth();
  const [activeTab, setActiveTab] = useState<string>("");
  const [filterStart, setFilterStart] = useState("");
  const [filterEnd, setFilterEnd] = useState("");
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 20;

  // 커스텀 훅
  const form = useJournalForm(tenantId, activeTab);
  const actions = useJournalActions(tenantId);
  const vendorAC = useVendorAutocomplete(tenantId, form.lines, form.setLines, form.updateLine);
  const summaryAC = useSummaryAutocomplete(tenantId, form.journalType, form.setDescription);

  // 전표 목록 조회 (페이지네이션)
  const queryParams = [
    filterStart && `startDate=${filterStart}`,
    filterEnd && `endDate=${filterEnd}`,
    activeTab && `journalType=${activeTab}`,
    `page=${page}`,
    `limit=${PAGE_SIZE}`,
  ].filter(Boolean).join("&");

  const { data: journalResult } = useQuery({
    queryKey: ["journals", filterStart, filterEnd, activeTab, page],
    queryFn: () => apiGet<{ data: JournalEntry[]; total: number; page: number; totalPages: number }>(
      `/journals?tenantId=${tenantId}&${queryParams}`,
    ),
  });

  const journals = journalResult?.data ?? [];
  const totalPages = journalResult?.totalPages ?? 1;
  const totalCount = journalResult?.total ?? 0;

  // 폼용 마스터 데이터
  const { data: accounts = [] } = useQuery({
    queryKey: ["accounts"],
    queryFn: () => apiGet<Account[]>(`/accounts?tenantId=${tenantId}`),
    enabled: form.formMode !== "none",
  });
  const { data: projects = [] } = useQuery({
    queryKey: ["projects"],
    queryFn: () => apiGet<ProjectOption[]>(`/projects?tenantId=${tenantId}`),
    enabled: form.formMode !== "none",
  });
  const { data: departments = [] } = useQuery({
    queryKey: ["departments"],
    queryFn: () => apiGet<DepartmentOption[]>(`/departments?tenantId=${tenantId}`),
    enabled: form.formMode !== "none",
  });

  // 선택된 전표 분석
  const selectedJournals = journals.filter((j) => actions.selectedIds.has(j.id));
  const selectableJournals = journals.filter((j) => j.status !== "POSTED");
  const allSelectableChecked = selectableJournals.length > 0 && selectableJournals.every((j) => actions.selectedIds.has(j.id));
  const hasDraft = selectedJournals.some((j) => j.status === "DRAFT");
  const hasApproved = selectedJournals.some((j) => j.status === "APPROVED");

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    setPage(1);
    actions.setSelectedIds(new Set());
    if (tab) form.setJournalType(tab);
  };

  return (
    <div>
      <div className={styles.header}>
        <h1 className={styles.title}>전표 관리</h1>
        {form.formMode === "none" && canEdit && (
          <button
            className={styles.addBtn}
            onClick={() => {
              if (activeTab) form.setJournalType(activeTab);
              form.setFormMode("create");
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

      {form.formMode !== "none" && (
        <JournalForm
          formMode={form.formMode}
          editingId={form.editingId}
          journalType={form.journalType}
          setJournalType={form.setJournalType}
          date={form.date}
          setDate={form.setDate}
          description={form.description}
          handleDescriptionInput={summaryAC.handleDescriptionInput}
          summarySuggestions={summaryAC.summarySuggestions}
          showSummaryDropdown={summaryAC.showSummaryDropdown}
          selectSummary={summaryAC.selectSummary}
          summaryRef={summaryAC.summaryRef}
          currency={form.currency}
          exchangeRate={form.exchangeRate}
          setExchangeRate={form.setExchangeRate}
          lines={form.lines}
          error={form.error}
          isPending={form.isPending}
          isBalanced={form.isBalanced}
          totalDebit={form.totalDebit}
          totalCredit={form.totalCredit}
          accounts={accounts}
          projects={projects}
          departments={departments}
          handleCurrencyChange={form.handleCurrencyChange}
          handleBizNoInput={vendorAC.handleBizNoInput}
          handleBizNoBlur={vendorAC.handleBizNoBlur}
          selectLineVendor={vendorAC.selectLineVendor}
          updateLine={form.updateLine}
          addLine={form.addLine}
          removeLine={form.removeLine}
          handleSubmit={form.handleSubmit}
          resetForm={form.resetForm}
          lineSuggestions={vendorAC.lineSuggestions}
          showLineSuggestions={vendorAC.showLineSuggestions}
          setShowLineSuggestions={vendorAC.setShowLineSuggestions}
          linesSuggestRef={vendorAC.linesSuggestRef}
        />
      )}

      <JournalTable
        journals={journals}
        selectedIds={actions.selectedIds}
        expandedId={actions.expandedId}
        canEdit={canEdit}
        canDelete={canDelete}
        hasApprovalLine={actions.hasApprovalLine}
        filterStart={filterStart}
        filterEnd={filterEnd}
        setFilterStart={(v: string) => { setFilterStart(v); setPage(1); }}
        setFilterEnd={(v: string) => { setFilterEnd(v); setPage(1); }}
        journalImportRef={actions.journalImportRef}
        journalImportResult={actions.journalImportResult}
        setJournalImportResult={actions.setJournalImportResult}
        handleJournalImport={actions.handleJournalImport}
        journalImportMutation={actions.journalImportMutation}
        toggleAll={() => actions.toggleAll(journals)}
        toggleOne={actions.toggleOne}
        allSelectableChecked={allSelectableChecked}
        hasDraft={hasDraft}
        hasApproved={hasApproved}
        selectedJournals={selectedJournals}
        statusMutation={actions.statusMutation}
        batchMutation={actions.batchMutation}
        submitApprovalMutation={actions.submitApprovalMutation}
        deleteMutation={actions.deleteMutation}
        uploadAttachmentMut={actions.uploadAttachmentMut}
        deleteAttachmentMut={actions.deleteAttachmentMut}
        startEdit={form.startEdit}
        handleDelete={actions.handleDelete}
        handleCopy={actions.handleCopy}
        handleReverse={actions.handleReverse}
        nextStatus={actions.nextStatus}
        setExpandedId={actions.setExpandedId}
        onClearSelection={() => actions.setSelectedIds(new Set())}
        focusedRowId={actions.focusedRowId}
        setFocusedRowId={actions.setFocusedRowId}
        page={page}
        totalPages={totalPages}
        totalCount={totalCount}
        onPageChange={(p: number) => { setPage(p); actions.setSelectedIds(new Set()); }}
        API_BASE={API_BASE}
      />
    </div>
  );
}
