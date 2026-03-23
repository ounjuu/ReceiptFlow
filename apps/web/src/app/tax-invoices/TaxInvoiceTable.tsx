"use client";

import styles from "./TaxInvoices.module.css";
import { TaxInvoice, TaxSummary, statusLabel, typeLabel, hometaxBadge, downloadFileWithAuth, nextStatus } from "./types";

export interface TaxInvoiceTableProps {
  invoices: TaxInvoice[];
  summary: TaxSummary | undefined;
  activeTab: "ALL" | "PURCHASE" | "SALES";
  setActiveTab: (tab: "ALL" | "PURCHASE" | "SALES") => void;
  filterStart: string;
  setFilterStart: (v: string) => void;
  filterEnd: string;
  setFilterEnd: (v: string) => void;
  filterStatus: string;
  setFilterStatus: (v: string) => void;
  summaryYear: number;
  setSummaryYear: (v: number) => void;
  summaryQuarter: number;
  setSummaryQuarter: (v: number) => void;
  years: number[];
  canEdit: boolean;
  canDelete: boolean;
  hasApprovalLine: boolean;
  handleExport: () => void;
  startEdit: (inv: TaxInvoice) => void;
  handleDelete: (id: string) => void;
  submitApprovalMutation: { mutate: (id: string) => void; isPending: boolean };
  statusMutation: { mutate: (args: { id: string; status: string }) => void; isPending: boolean };
}

export default function TaxInvoiceTable({
  invoices,
  summary,
  activeTab,
  setActiveTab,
  filterStart,
  setFilterStart,
  filterEnd,
  setFilterEnd,
  filterStatus,
  setFilterStatus,
  summaryYear,
  setSummaryYear,
  summaryQuarter,
  setSummaryQuarter,
  years,
  canEdit,
  canDelete,
  hasApprovalLine,
  handleExport,
  startEdit,
  handleDelete,
  submitApprovalMutation,
  statusMutation,
}: TaxInvoiceTableProps) {
  return (
    <>
      {/* 부가세 신고 요약 */}
      <div className={styles.summaryControls}>
        <span className={styles.summaryTitle}>부가세 신고 요약</span>
        <select
          className={styles.summarySelect}
          value={summaryYear}
          onChange={(e) => setSummaryYear(Number(e.target.value))}
        >
          {years.map((y) => (
            <option key={y} value={y}>{y}년</option>
          ))}
        </select>
        <select
          className={styles.summarySelect}
          value={summaryQuarter}
          onChange={(e) => setSummaryQuarter(Number(e.target.value))}
        >
          <option value={1}>1분기 (1~3월)</option>
          <option value={2}>2분기 (4~6월)</option>
          <option value={3}>3분기 (7~9월)</option>
          <option value={4}>4분기 (10~12월)</option>
        </select>
      </div>

      {summary && (
        <div className={styles.summarySection}>
          <div className={styles.summaryCard}>
            <div className={styles.summaryLabel}>매출 공급가액</div>
            <div className={styles.summaryValue}>
              ₩{summary.sales.supplyAmount.toLocaleString()}
            </div>
            <div className={styles.summaryCount}>세액: ₩{summary.sales.taxAmount.toLocaleString()} / {summary.sales.count}건</div>
          </div>
          <div className={styles.summaryCard}>
            <div className={styles.summaryLabel}>매입 공급가액</div>
            <div className={styles.summaryValue}>
              ₩{summary.purchase.supplyAmount.toLocaleString()}
            </div>
            <div className={styles.summaryCount}>세액: ₩{summary.purchase.taxAmount.toLocaleString()} / {summary.purchase.count}건</div>
          </div>
          <div className={styles.summaryCard}>
            <div className={styles.summaryLabel}>매출세액</div>
            <div className={styles.summaryValue}>
              ₩{summary.sales.taxAmount.toLocaleString()}
            </div>
          </div>
          <div className={styles.summaryCard}>
            <div className={styles.summaryLabel}>납부(환급)세액</div>
            <div className={`${styles.summaryValue} ${summary.netTaxAmount >= 0 ? styles.summaryPositive : styles.summaryNegative}`}>
              {summary.netTaxAmount >= 0 ? "" : "-"}₩{Math.abs(summary.netTaxAmount).toLocaleString()}
            </div>
            <div className={styles.summaryCount}>
              {summary.netTaxAmount >= 0 ? "납부" : "환급"}
            </div>
          </div>
        </div>
      )}

      {/* 탭 */}
      <div className={styles.tabs}>
        {(["ALL", "PURCHASE", "SALES"] as const).map((tab) => (
          <button
            key={tab}
            className={`${styles.tab} ${activeTab === tab ? styles.tabActive : ""}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab === "ALL" ? "전체" : tab === "PURCHASE" ? "매입" : "매출"}
          </button>
        ))}
      </div>

      {/* 목록 */}
      <div className={styles.tableSection}>
        <div className={styles.tableHeader}>
          <h2 className={styles.sectionTitle}>세금계산서 목록</h2>
          <div className={styles.filterRow}>
            <button
              className={styles.downloadBtn}
              onClick={handleExport}
              disabled={invoices.length === 0}
            >
              엑셀 다운로드
            </button>
          </div>
          <div className={styles.filterRow}>
            <span className={styles.filterLabel}>상태</span>
            <select
              className={styles.filterInput}
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
            >
              <option value="">전체</option>
              <option value="DRAFT">임시</option>
              <option value="APPROVED">승인</option>
              <option value="FINALIZED">확정</option>
            </select>
            <span className={styles.filterLabel}>기간</span>
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
            {(filterStart || filterEnd || filterStatus) && (
              <button
                className={styles.filterClear}
                onClick={() => { setFilterStart(""); setFilterEnd(""); setFilterStatus(""); }}
              >
                초기화
              </button>
            )}
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th>유형</th>
              <th>번호</th>
              <th>일자</th>
              <th>공급자</th>
              <th>공급받는자</th>
              <th>공급가액</th>
              <th>세액</th>
              <th>합계</th>
              <th>홈택스</th>
              <th>상태</th>
              <th>관리</th>
            </tr>
          </thead>
          <tbody>
            {invoices.map((inv) => {
              const s = statusLabel(inv.status);
              const t = typeLabel(inv.invoiceType);
              return (
                <tr key={inv.id}>
                  <td>
                    <span className={`${styles.status} ${t.cls}`}>{t.text}</span>
                  </td>
                  <td>{inv.invoiceNo || "-"}</td>
                  <td>{new Date(inv.invoiceDate).toLocaleDateString("ko-KR")}</td>
                  <td title={inv.issuerBizNo}>{inv.issuerName}</td>
                  <td title={inv.recipientBizNo}>{inv.recipientName}</td>
                  <td>₩{Number(inv.supplyAmount).toLocaleString()}</td>
                  <td>₩{Number(inv.taxAmount).toLocaleString()}</td>
                  <td>₩{Number(inv.totalAmount).toLocaleString()}</td>
                  <td>
                    {(() => {
                      const hb = hometaxBadge(inv.hometaxSyncStatus);
                      return hb ? (
                        <span className={`${styles.status} ${hb.cls}`}>{hb.text}</span>
                      ) : "-";
                    })()}
                  </td>
                  <td>
                    <span className={`${styles.status} ${s.cls}`}>{s.text}</span>
                  </td>
                  <td>
                    <div className={styles.actions}>
                      <button
                        className={styles.editBtn}
                        style={{ fontSize: "0.75rem" }}
                        onClick={() =>
                          downloadFileWithAuth(
                            `/tax-invoices/${inv.id}/export-pdf`,
                            `세금계산서-${inv.invoiceNo || inv.id}.pdf`,
                          )
                        }
                        title="PDF 다운로드"
                      >
                        PDF
                      </button>
                      <button
                        className={styles.editBtn}
                        style={{ fontSize: "0.75rem" }}
                        onClick={() =>
                          downloadFileWithAuth(
                            `/tax-invoices/${inv.id}/export-xml`,
                            `세금계산서_${inv.invoiceNo || inv.id}.xml`,
                          )
                        }
                        title="XML 내보내기"
                      >
                        XML
                      </button>
                      {canEdit && inv.status === "DRAFT" && hasApprovalLine && (
                        <button
                          className={styles.statusBtn}
                          onClick={() => submitApprovalMutation.mutate(inv.id)}
                          disabled={submitApprovalMutation.isPending}
                        >
                          결재요청
                        </button>
                      )}
                      {canEdit && nextStatus(inv.status) && !(inv.status === "DRAFT" && hasApprovalLine) && (
                        <button
                          className={styles.statusBtn}
                          onClick={() => {
                            const ns = nextStatus(inv.status)!;
                            statusMutation.mutate({ id: inv.id, status: ns.next });
                          }}
                          disabled={statusMutation.isPending}
                        >
                          {nextStatus(inv.status)!.label}
                        </button>
                      )}
                      {inv.status !== "FINALIZED" && inv.status !== "PENDING_APPROVAL" && canEdit && (
                        <button
                          className={styles.editBtn}
                          onClick={() => startEdit(inv)}
                        >
                          수정
                        </button>
                      )}
                      {inv.status !== "FINALIZED" && canDelete && (
                        <button
                          className={styles.deleteBtn}
                          onClick={() => handleDelete(inv.id)}
                        >
                          삭제
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
            {invoices.length === 0 && (
              <tr>
                <td colSpan={11} style={{ textAlign: "center", color: "var(--text-muted)" }}>
                  세금계산서가 없습니다
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
