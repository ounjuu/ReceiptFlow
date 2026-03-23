"use client";

import type { RefObject } from "react";
import type { Vendor, ImportResult } from "./types";
import styles from "./Vendors.module.css";

interface VendorTableProps {
  vendors: Vendor[];
  canEdit: boolean;
  canDelete: boolean;
  editId: string | null;
  editName: string;
  editBizNo: string;
  onEditNameChange: (value: string) => void;
  onEditBizNoChange: (value: string) => void;
  onStartEdit: (vendor: Vendor) => void;
  onUpdate: () => void;
  onCancelEdit: () => void;
  onDelete: (vendor: Vendor) => void;
  updatePending: boolean;
  importRef: RefObject<HTMLInputElement | null>;
  importPending: boolean;
  importResult: ImportResult | null;
  onImport: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onClearImportResult: () => void;
  onDownloadTemplate: () => void;
  onExport: () => void;
}

export default function VendorTable({
  vendors,
  canEdit,
  canDelete,
  editId,
  editName,
  editBizNo,
  onEditNameChange,
  onEditBizNoChange,
  onStartEdit,
  onUpdate,
  onCancelEdit,
  onDelete,
  updatePending,
  importRef,
  importPending,
  importResult,
  onImport,
  onClearImportResult,
  onDownloadTemplate,
  onExport,
}: VendorTableProps) {
  return (
    <div className={styles.tableSection}>
      <div className={styles.tableHeader}>
        <h2 className={styles.sectionTitle}>거래처 목록</h2>
        <div className={styles.actions}>
          <button
            className={styles.downloadBtn}
            onClick={onDownloadTemplate}
          >
            템플릿 다운로드
          </button>
          <input type="file" ref={importRef} accept=".xlsx,.xls,.csv" onChange={onImport} hidden />
          <button
            className={styles.downloadBtn}
            onClick={() => importRef.current?.click()}
            disabled={importPending}
          >
            {importPending ? "업로드 중..." : "엑셀 업로드"}
          </button>
          <button
            className={styles.downloadBtn}
            onClick={onExport}
            disabled={vendors.length === 0}
          >
            엑셀 다운로드
          </button>
        </div>
      </div>
      {importResult && (
        <div className={styles.importResult}>
          <div className={styles.importSummary}>
            <span>총 {importResult.total}건</span>
            <span className={styles.importSuccess}>성공 {importResult.success}건</span>
            {importResult.failed > 0 && <span className={styles.importFailed}>실패 {importResult.failed}건</span>}
            <button className={styles.cancelBtn} onClick={onClearImportResult}>닫기</button>
          </div>
          {importResult.failed > 0 && (
            <ul className={styles.importErrors}>
              {importResult.results.filter((r) => r.status === "error").map((r) => (
                <li key={r.index}>{r.error}</li>
              ))}
            </ul>
          )}
        </div>
      )}
      <table>
        <thead>
          <tr>
            <th>거래처명</th>
            <th>사업자등록번호</th>
            <th>등록일</th>
            {(canEdit || canDelete) && <th>관리</th>}
          </tr>
        </thead>
        <tbody>
          {vendors.map((vendor) => (
            <tr key={vendor.id}>
              <td>
                {editId === vendor.id ? (
                  <input
                    className={styles.editInput}
                    value={editName}
                    onChange={(e) => onEditNameChange(e.target.value)}
                  />
                ) : (
                  vendor.name
                )}
              </td>
              <td>
                {editId === vendor.id ? (
                  <input
                    className={styles.editInput}
                    value={editBizNo}
                    onChange={(e) => onEditBizNoChange(e.target.value)}
                  />
                ) : (
                  vendor.bizNo || "-"
                )}
              </td>
              <td>{new Date(vendor.createdAt).toLocaleDateString("ko-KR")}</td>
              {(canEdit || canDelete) && (
                <td>
                  <div className={styles.actions}>
                    {editId === vendor.id ? (
                      <>
                        <button
                          className={styles.saveBtn}
                          onClick={onUpdate}
                          disabled={updatePending}
                        >
                          저장
                        </button>
                        <button
                          className={styles.cancelBtn}
                          onClick={onCancelEdit}
                        >
                          취소
                        </button>
                      </>
                    ) : (
                      <>
                        {canEdit && (
                          <button
                            className={styles.editBtn}
                            onClick={() => onStartEdit(vendor)}
                          >
                            수정
                          </button>
                        )}
                        {canDelete && (
                          <button
                            className={styles.deleteBtn}
                            onClick={() => onDelete(vendor)}
                          >
                            삭제
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </td>
              )}
            </tr>
          ))}
          {vendors.length === 0 && (
            <tr>
              <td
                colSpan={canEdit || canDelete ? 4 : 3}
                style={{ textAlign: "center", color: "var(--text-muted)" }}
              >
                등록된 거래처가 없습니다
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
