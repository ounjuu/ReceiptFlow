"use client";

import styles from "./Trades.module.css";
import { Trade, fmt, statusLabel, downloadPdf } from "./types";

interface TradeTableProps {
  trades: Trade[];
  type: string;
  canEdit: boolean;
  canDelete: boolean;
  onConfirm: (id: string) => void;
  onCancel: (id: string) => void;
  onDelete: (id: string) => void;
}

export default function TradeTable({
  trades,
  type,
  canEdit,
  canDelete,
  onConfirm,
  onCancel,
  onDelete,
}: TradeTableProps) {
  return (
    <table>
      <thead>
        <tr>
          <th>거래번호</th>
          <th>거래일</th>
          <th>거래처</th>
          <th>설명</th>
          <th>상태</th>
          <th style={{ textAlign: "right" }}>공급가</th>
          <th style={{ textAlign: "right" }}>세액</th>
          <th style={{ textAlign: "right" }}>합계</th>
          <th style={{ textAlign: "right" }}>수금액</th>
          <th style={{ textAlign: "right" }}>잔액</th>
          {(canEdit || canDelete) && <th>관리</th>}
        </tr>
      </thead>
      <tbody>
        {trades.map((t) => {
          const s = statusLabel(t.status);
          const remaining = t.totalAmount - t.paidAmount;
          return (
            <tr key={t.id}>
              <td>{t.tradeNo}</td>
              <td>{new Date(t.tradeDate).toLocaleDateString("ko-KR")}</td>
              <td>{t.vendor.name}</td>
              <td>{t.description || "-"}</td>
              <td><span className={`${styles.status} ${s.cls}`}>{s.text}</span></td>
              <td style={{ textAlign: "right" }}>{fmt(t.supplyAmount)}</td>
              <td style={{ textAlign: "right" }}>{fmt(t.taxAmount)}</td>
              <td style={{ textAlign: "right" }}>{fmt(t.totalAmount)}</td>
              <td style={{ textAlign: "right" }}>{fmt(t.paidAmount)}</td>
              <td style={{ textAlign: "right", color: remaining > 0 ? "var(--danger)" : "inherit" }}>
                {fmt(remaining)}
              </td>
              {(canEdit || canDelete) && (
                <td>
                  <div className={styles.actions}>
                    <button
                      className={styles.confirmBtn}
                      style={{ fontSize: "0.75rem" }}
                      onClick={() =>
                        downloadPdf(
                          `/trades/${t.id}/export-pdf`,
                          `거래명세서-${t.tradeNo}.pdf`,
                        )
                      }
                      title="PDF 다운로드"
                    >
                      PDF
                    </button>
                    {canEdit && t.status === "DRAFT" && (
                      <button
                        className={styles.confirmBtn}
                        onClick={() => {
                          if (confirm("거래를 확정하시겠습니까? 자동으로 전표가 생성됩니다.")) {
                            onConfirm(t.id);
                          }
                        }}
                      >
                        확정
                      </button>
                    )}
                    {canEdit && !["PAID", "CANCELLED"].includes(t.status) && t.status !== "DRAFT" && (
                      <button
                        className={styles.cancelBtn}
                        onClick={() => {
                          if (confirm("거래를 취소하시겠습니까?")) {
                            onCancel(t.id);
                          }
                        }}
                      >
                        취소
                      </button>
                    )}
                    {canDelete && t.status === "DRAFT" && (
                      <button
                        className={styles.dangerBtn}
                        onClick={() => {
                          if (confirm("거래를 삭제하시겠습니까?")) {
                            onDelete(t.id);
                          }
                        }}
                      >
                        삭제
                      </button>
                    )}
                  </div>
                </td>
              )}
            </tr>
          );
        })}
        {trades.length === 0 && (
          <tr>
            <td colSpan={(canEdit || canDelete) ? 11 : 10} style={{ textAlign: "center", color: "var(--text-muted)" }}>
              {type} 거래가 없습니다
            </td>
          </tr>
        )}
      </tbody>
    </table>
  );
}
