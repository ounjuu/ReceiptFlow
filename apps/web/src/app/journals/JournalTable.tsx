"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { UseMutationResult } from "@tanstack/react-query";
import { exportToXlsx } from "@/lib/export-xlsx";
import { downloadTemplate } from "@/lib/import-xlsx";
import { apiDownload } from "@/lib/api";
import styles from "./Journals.module.css";
import {
  JournalEntry,
  JournalAttachment,
  statusLabel,
  journalTypeLabel,
  CURRENCY_SYMBOLS,
  Account,
} from "./types";

export interface JournalTableProps {
  journals: JournalEntry[];
  selectedIds: Set<string>;
  expandedId: string | null;
  canEdit: boolean;
  canDelete: boolean;
  hasApprovalLine: boolean;
  filterStart: string;
  filterEnd: string;
  setFilterStart: (v: string) => void;
  setFilterEnd: (v: string) => void;
  searchAccounts: Account[];
  searchAccountId: string;
  setSearchAccountId: (v: string) => void;
  searchKeyword: string;
  setSearchKeyword: (v: string) => void;
  searchMinAmount: string;
  setSearchMinAmount: (v: string) => void;
  searchMaxAmount: string;
  setSearchMaxAmount: (v: string) => void;
  searchStatus: string;
  setSearchStatus: (v: string) => void;
  journalImportRef: React.RefObject<HTMLInputElement | null>;
  journalImportResult: { total: number; success: number; failed: number; results: { index: number; status: string; error?: string }[] } | null;
  setJournalImportResult: (v: null) => void;
  handleJournalImport: (e: React.ChangeEvent<HTMLInputElement>) => void;
  journalImportMutation: UseMutationResult<
    { total: number; success: number; failed: number; results: { index: number; status: string; error?: string }[] },
    Error,
    { date: string; description?: string; lines: { accountCode: string; vendorBizNo?: string; vendorName?: string; debit: number; credit: number }[] }[]
  >;
  toggleAll: () => void;
  toggleOne: (id: string) => void;
  allSelectableChecked: boolean;
  hasDraft: boolean;
  hasApproved: boolean;
  selectedJournals: JournalEntry[];
  statusMutation: UseMutationResult<JournalEntry, Error, { id: string; status: string }>;
  batchMutation: UseMutationResult<{ count: number }, Error, { ids: string[]; status: string }>;
  batchUpdateMutation: UseMutationResult<{ count: number }, Error, { ids: string[]; description?: string; date?: string }>;
  submitApprovalMutation: UseMutationResult<unknown, Error, string>;
  deleteMutation: UseMutationResult<unknown, Error, string>;
  uploadAttachmentMut: UseMutationResult<JournalAttachment, Error, { journalId: string; file: File }>;
  deleteAttachmentMut: UseMutationResult<unknown, Error, { journalId: string; attachmentId: string }>;
  startEdit: (j: JournalEntry) => void;
  handleDelete: (id: string) => void;
  handleCopy: (id: string) => void;
  handleReverse: (id: string) => void;
  nextStatus: (current: string) => { label: string; next: string } | null;
  setExpandedId: (id: string | null) => void;
  onClearSelection: () => void;
  focusedRowId: string | null;
  setFocusedRowId: (id: string | null) => void;
  page: number;
  totalPages: number;
  totalCount: number;
  onPageChange: (page: number) => void;
  API_BASE: string;
}

export default function JournalTable({
  journals,
  selectedIds,
  expandedId,
  canEdit,
  canDelete,
  hasApprovalLine,
  filterStart,
  filterEnd,
  setFilterStart,
  setFilterEnd,
  searchAccounts,
  searchAccountId,
  setSearchAccountId,
  searchKeyword,
  setSearchKeyword,
  searchMinAmount,
  setSearchMinAmount,
  searchMaxAmount,
  setSearchMaxAmount,
  searchStatus,
  setSearchStatus,
  journalImportRef,
  journalImportResult,
  setJournalImportResult,
  handleJournalImport,
  journalImportMutation,
  toggleAll,
  toggleOne,
  allSelectableChecked,
  hasDraft,
  hasApproved,
  selectedJournals,
  statusMutation,
  batchMutation,
  batchUpdateMutation,
  submitApprovalMutation,
  deleteMutation,
  uploadAttachmentMut,
  deleteAttachmentMut,
  startEdit,
  handleDelete,
  handleCopy,
  handleReverse,
  nextStatus,
  setExpandedId,
  onClearSelection,
  focusedRowId,
  setFocusedRowId,
  page,
  totalPages,
  totalCount,
  onPageChange,
  API_BASE,
}: JournalTableProps) {
  const tableRef = useRef<HTMLTableSectionElement>(null);

  // 일괄 수정 모달
  const [batchUpdateOpen, setBatchUpdateOpen] = useState(false);
  const [batchEditDescription, setBatchEditDescription] = useState("");
  const [batchEditDate, setBatchEditDate] = useState("");

  const handleBatchUpdateSubmit = () => {
    const editableIds = selectedJournals
      .filter((j) => j.status !== "POSTED")
      .map((j) => j.id);
    if (editableIds.length === 0) {
      alert("수정 가능한 전표가 없습니다 (확정된 전표 제외)");
      return;
    }
    if (!batchEditDescription && !batchEditDate) {
      alert("수정할 항목을 입력해주세요");
      return;
    }
    batchUpdateMutation.mutate(
      {
        ids: editableIds,
        ...(batchEditDescription && { description: batchEditDescription }),
        ...(batchEditDate && { date: batchEditDate }),
      },
      {
        onSuccess: () => {
          setBatchUpdateOpen(false);
          setBatchEditDescription("");
          setBatchEditDate("");
        },
      },
    );
  };

  // 테이블 키보드 단축키
  const handleTableKeyDown = useCallback((e: React.KeyboardEvent) => {
    // input/button 등 내부 요소에서 발생한 이벤트 무시
    const tag = (e.target as HTMLElement).tagName;
    if (tag === "INPUT" || tag === "BUTTON" || tag === "SELECT") return;

    if (!journals.length) return;

    const currentIdx = focusedRowId ? journals.findIndex((j) => j.id === focusedRowId) : -1;

    // 화살표 아래: 다음 행
    if (e.key === "ArrowDown") {
      e.preventDefault();
      const nextIdx = currentIdx < journals.length - 1 ? currentIdx + 1 : 0;
      setFocusedRowId(journals[nextIdx].id);
    }
    // 화살표 위: 이전 행
    if (e.key === "ArrowUp") {
      e.preventDefault();
      const prevIdx = currentIdx > 0 ? currentIdx - 1 : journals.length - 1;
      setFocusedRowId(journals[prevIdx].id);
    }

    if (!focusedRowId) return;
    const focused = journals.find((j) => j.id === focusedRowId);
    if (!focused) return;

    // F2: 수정
    if (e.key === "F2" && canEdit && focused.status !== "POSTED" && focused.status !== "PENDING_APPROVAL") {
      e.preventDefault();
      startEdit(focused);
    }
    // Delete: 삭제
    if (e.key === "Delete" && canDelete && focused.status !== "POSTED") {
      e.preventDefault();
      handleDelete(focused.id);
    }
    // Enter: 펼침/접기
    if (e.key === "Enter") {
      e.preventDefault();
      setExpandedId(expandedId === focused.id ? null : focused.id);
    }
    // Space: 체크박스 토글
    if (e.key === " " && canEdit && focused.status !== "POSTED") {
      e.preventDefault();
      toggleOne(focused.id);
    }
  }, [journals, focusedRowId, canEdit, canDelete, expandedId, startEdit, handleDelete, setExpandedId, setFocusedRowId, toggleOne]);

  // 포커스된 행이 바뀌면 스크롤
  useEffect(() => {
    if (!focusedRowId || !tableRef.current) return;
    const row = tableRef.current.querySelector(`[data-row-id="${focusedRowId}"]`);
    if (row) {
      row.scrollIntoView({ block: "nearest" });
    }
  }, [focusedRowId]);

  return (
    <div
      className={styles.tableSection}
      tabIndex={0}
      onKeyDown={handleTableKeyDown}
    >
      <div className={styles.tableHeader}>
        <h2 className={styles.sectionTitle}>전표 목록</h2>
        <div className={styles.filterRow}>
          <button className={styles.downloadBtn} onClick={() => downloadTemplate("전표_템플릿", ["전표번호", "날짜", "적요", "계정코드", "거래처명", "사업자번호", "차변", "대변"])}>템플릿</button>
          <input type="file" ref={journalImportRef} accept=".xlsx,.xls,.csv" onChange={handleJournalImport} hidden />
          <button className={styles.downloadBtn} onClick={() => journalImportRef.current?.click()} disabled={journalImportMutation.isPending}>
            {journalImportMutation.isPending ? "업로드 중..." : "엑셀 업로드"}
          </button>
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
              exportToXlsx("전표목록", "전표", ["전표번호", "유형", "날짜", "거래처", "설명", "상태", "차변합계", "대변합계"], journals.map((j) => [
                j.journalNumber || "",
                journalTypeLabel(j.journalType),
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
        {/* 고급 검색 */}
        <div className={styles.filterRow}>
          <select
            className={styles.filterInput}
            value={searchAccountId}
            onChange={(e) => setSearchAccountId(e.target.value)}
            style={{ minWidth: 140 }}
          >
            <option value="">계정과목 전체</option>
            {searchAccounts.map((a) => (
              <option key={a.id} value={a.id}>{a.code} {a.name}</option>
            ))}
          </select>
          <select
            className={styles.filterInput}
            value={searchStatus}
            onChange={(e) => setSearchStatus(e.target.value)}
            style={{ minWidth: 100 }}
          >
            <option value="">상태 전체</option>
            <option value="DRAFT">임시</option>
            <option value="APPROVED">승인</option>
            <option value="POSTED">확정</option>
          </select>
          <input
            className={styles.filterInput}
            type="text"
            placeholder="적요 검색"
            value={searchKeyword}
            onChange={(e) => setSearchKeyword(e.target.value)}
            style={{ minWidth: 120 }}
          />
          <input
            className={styles.filterInput}
            type="number"
            placeholder="최소 금액"
            value={searchMinAmount}
            onChange={(e) => setSearchMinAmount(e.target.value)}
            style={{ width: 100 }}
          />
          <span className={styles.filterSep}>~</span>
          <input
            className={styles.filterInput}
            type="number"
            placeholder="최대 금액"
            value={searchMaxAmount}
            onChange={(e) => setSearchMaxAmount(e.target.value)}
            style={{ width: 100 }}
          />
          {(searchAccountId || searchKeyword || searchMinAmount || searchMaxAmount || searchStatus) && (
            <button
              className={styles.filterClear}
              onClick={() => {
                setSearchAccountId("");
                setSearchKeyword("");
                setSearchMinAmount("");
                setSearchMaxAmount("");
                setSearchStatus("");
              }}
            >
              검색 초기화
            </button>
          )}
        </div>
      </div>

      {journalImportResult && (
        <div style={{ marginBottom: "12px", padding: "12px", background: "var(--primary-light)", border: "1px solid var(--primary)", borderRadius: "var(--radius)" }}>
          <div style={{ display: "flex", gap: "12px", alignItems: "center", fontSize: "0.85rem", fontWeight: 600 }}>
            <span>총 {journalImportResult.total}건</span>
            <span style={{ color: "#166534" }}>성공 {journalImportResult.success}건</span>
            {journalImportResult.failed > 0 && <span style={{ color: "#dc2626" }}>실패 {journalImportResult.failed}건</span>}
            <button className={styles.secondaryBtn} onClick={() => setJournalImportResult(null)}>닫기</button>
          </div>
          {journalImportResult.failed > 0 && (
            <ul style={{ margin: "8px 0 0", paddingLeft: "20px", fontSize: "0.8rem", color: "#dc2626" }}>
              {journalImportResult.results.filter((r) => r.status === "error").map((r) => (
                <li key={r.index}>{r.error}</li>
              ))}
            </ul>
          )}
        </div>
      )}

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
            className={styles.batchApproveBtn}
            disabled={batchUpdateMutation.isPending}
            onClick={() => setBatchUpdateOpen(true)}
          >
            일괄 수정
          </button>
          <button
            className={styles.batchClearBtn}
            onClick={onClearSelection}
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

      {/* 일괄 수정 모달 */}
      {batchUpdateOpen && (
        <div className={styles.modalOverlay} onClick={() => setBatchUpdateOpen(false)}>
          <div className={styles.modalContent} role="dialog" aria-modal="true" aria-label="일괄 수정" onClick={(e) => e.stopPropagation()}>
            <h3 className={styles.modalTitle}>일괄 수정 ({selectedIds.size}건)</h3>
            <div className={styles.modalBody}>
              <div className={styles.modalField}>
                <label>적요</label>
                <input
                  type="text"
                  value={batchEditDescription}
                  onChange={(e) => setBatchEditDescription(e.target.value)}
                  placeholder="비워두면 변경 안 함"
                  className={styles.modalInput}
                />
              </div>
              <div className={styles.modalField}>
                <label>날짜</label>
                <input
                  type="date"
                  value={batchEditDate}
                  onChange={(e) => setBatchEditDate(e.target.value)}
                  className={styles.modalInput}
                />
              </div>
              <p className={styles.modalNote}>
                * 확정(POSTED) 상태 전표는 수정되지 않습니다.
              </p>
            </div>
            <div className={styles.modalActions}>
              <button
                className={styles.batchApproveBtn}
                disabled={batchUpdateMutation.isPending}
                onClick={handleBatchUpdateSubmit}
              >
                {batchUpdateMutation.isPending ? "수정 중..." : "수정 적용"}
              </button>
              <button
                className={styles.batchClearBtn}
                onClick={() => setBatchUpdateOpen(false)}
              >
                취소
              </button>
            </div>
            {batchUpdateMutation.isError && (
              <p className={styles.batchError}>
                {(batchUpdateMutation.error as Error).message}
              </p>
            )}
          </div>
        </div>
      )}

      <table>
        <caption className={styles.srOnly}>전표 목록</caption>
        <thead>
          <tr>
            {canEdit && (
              <th scope="col" style={{ width: 36 }}>
                <input
                  type="checkbox"
                  checked={allSelectableChecked}
                  onChange={toggleAll}
                />
              </th>
            )}
            <th scope="col">전표번호</th>
            <th scope="col">유형</th>
            <th scope="col">날짜</th>
            <th scope="col">거래처</th>
            <th scope="col">설명</th>
            <th scope="col">상태</th>
            <th scope="col">차변 합계</th>
            <th scope="col">대변 합계</th>
            <th scope="col">영수증</th>
            <th scope="col">첨부</th>
            <th scope="col">관리</th>
          </tr>
        </thead>
        <tbody ref={tableRef}>
          {journals.map((j) => {
            const s = statusLabel(j.status);
            const jTotalDebit = j.lines.reduce((sum, l) => sum + Number(l.debit), 0);
            const jTotalCredit = j.lines.reduce((sum, l) => sum + Number(l.credit), 0);
            const isPosted = j.status === "POSTED";
            const isFocused = focusedRowId === j.id;
            return (
              <React.Fragment key={j.id}>
              <tr
                data-row-id={j.id}
                className={`${selectedIds.has(j.id) ? styles.selectedRow : ""} ${isFocused ? styles.focusedRow : ""}`}
                onClick={() => setFocusedRowId(j.id)}
                onDoubleClick={() => {
                  if (canEdit && j.status !== "POSTED" && j.status !== "PENDING_APPROVAL") {
                    startEdit(j);
                  }
                }}
              >
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
                <td className={styles.journalNumber}>{j.journalNumber || "-"}</td>
                <td><span className={styles.journalType}>{journalTypeLabel(j.journalType)}</span></td>
                <td>{new Date(j.date).toLocaleDateString("ko-KR")}</td>
                <td>
                  {[...new Set(j.lines.map((l) => l.vendor?.name).filter(Boolean))].join(", ") || "-"}
                </td>
                <td>{j.description || "-"}</td>
                <td>
                  <span className={`${styles.status} ${s.cls}`}>{s.text}</span>
                </td>
                <td>{(CURRENCY_SYMBOLS[j.currency] || "")}{jTotalDebit.toLocaleString()}</td>
                <td>{(CURRENCY_SYMBOLS[j.currency] || "")}{jTotalCredit.toLocaleString()}</td>
                <td>{j.documentId ? "O" : "-"}</td>
                <td>
                  <button
                    className={styles.attachToggle}
                    aria-label="첨부파일 보기"
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
                    {canEdit && (
                      <button
                        className={styles.editBtn}
                        onClick={() => handleCopy(j.id)}
                        style={{ fontSize: "0.75rem" }}
                      >
                        복사
                      </button>
                    )}
                    <button
                      className={styles.editBtn}
                      onClick={() => {
                        apiDownload(
                          `/journals/${j.id}/export-pdf`,
                          `journal-${j.journalNumber || j.id}.pdf`,
                        ).catch((err) => alert((err as Error).message));
                      }}
                      style={{ fontSize: "0.75rem" }}
                    >
                      PDF
                    </button>
                    {canEdit && j.status === "POSTED" && (
                      <button
                        className={styles.statusBtn}
                        onClick={() => handleReverse(j.id)}
                        style={{ fontSize: "0.75rem" }}
                      >
                        역분개
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
                  <td colSpan={canEdit ? 13 : 12} className={styles.attachmentRow}>
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
                                aria-label="삭제"
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
              <td colSpan={canEdit ? 13 : 12} style={{ textAlign: "center", color: "var(--text-muted)" }}>
                전표가 없습니다
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {/* 페이지네이션 */}
      {totalPages > 1 && (
        <div className={styles.pagination}>
          <span className={styles.pageInfo}>총 {totalCount}건</span>
          <button
            className={styles.pageBtn}
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
          >
            이전
          </button>
          {Array.from({ length: Math.min(totalPages, 10) }, (_, i) => {
            const start = Math.max(1, Math.min(page - 4, totalPages - 9));
            const p = start + i;
            if (p > totalPages) return null;
            return (
              <button
                key={p}
                className={`${styles.pageBtn} ${p === page ? styles.pageBtnActive : ""}`}
                onClick={() => onPageChange(p)}
              >
                {p}
              </button>
            );
          })}
          <button
            className={styles.pageBtn}
            disabled={page >= totalPages}
            onClick={() => onPageChange(page + 1)}
          >
            다음
          </button>
        </div>
      )}

      {/* 테이블 단축키 안내 */}
      <div className={styles.tableShortcuts}>
        <kbd>↑↓</kbd> 행 이동
        <kbd>F2</kbd> 수정
        <kbd>Del</kbd> 삭제
        <kbd>Enter</kbd> 상세
        <kbd>Space</kbd> 선택
        <span className={styles.shortcutDivider}>|</span>
        <span>더블클릭으로 수정</span>
      </div>
    </div>
  );
}
