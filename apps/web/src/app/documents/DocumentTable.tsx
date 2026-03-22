"use client";

import { UseMutationResult } from "@tanstack/react-query";
import { exportToXlsx } from "@/lib/export-xlsx";
import styles from "./Documents.module.css";
import { CURRENCY_SYMBOLS, statusLabel } from "./types";
import type { Document } from "./types";

interface DocumentTableProps {
  documents: Document[];
  canEdit: boolean;
  canDelete: boolean;
  editingId: string | null;
  editVendor: string;
  editAmount: string;
  editDate: string;
  setEditVendor: (v: string) => void;
  setEditAmount: (v: string) => void;
  setEditDate: (v: string) => void;
  startEdit: (doc: Document) => void;
  handleUpdate: (id: string) => void;
  handleDelete: (id: string) => void;
  setEditingId: (id: string | null) => void;
  updateMutation: UseMutationResult<Document, Error, { id: string; body: Record<string, unknown> }>;
  filterStart: string;
  filterEnd: string;
  setFilterStart: (v: string) => void;
  setFilterEnd: (v: string) => void;
  setPreviewUrl: (url: string | null) => void;
  API_BASE: string;
}

export default function DocumentTable(props: DocumentTableProps) {
  const {
    documents,
    canEdit,
    canDelete,
    editingId,
    editVendor,
    editAmount,
    editDate,
    setEditVendor,
    setEditAmount,
    setEditDate,
    startEdit,
    handleUpdate,
    handleDelete,
    setEditingId,
    updateMutation,
    filterStart,
    filterEnd,
    setFilterStart,
    setFilterEnd,
    setPreviewUrl,
    API_BASE,
  } = props;

  return (
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
  );
}
