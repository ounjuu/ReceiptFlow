"use client";

import type { InvoiceItem } from "./types";
import styles from "./VatReturns.module.css";

function statusLabel(status: string) {
  switch (status) {
    case "DRAFT": return { text: "임시", cls: styles.statusDraft };
    case "APPROVED": return { text: "승인", cls: styles.statusApproved };
    case "FINALIZED": return { text: "확정", cls: styles.statusFinalized };
    default: return { text: status, cls: "" };
  }
}

function fmt(n: number | null | undefined) {
  return `₩${(n ?? 0).toLocaleString()}`;
}

interface VatReturnsTableProps {
  title: string;
  subtitle: string;
  invoices: InvoiceItem[];
  totalSupply: number;
  totalTax: number;
}

export default function VatReturnsTable({
  title,
  subtitle,
  invoices,
  totalSupply,
  totalTax,
}: VatReturnsTableProps) {
  return (
    <div className={styles.tableSection}>
      <div className={styles.tableHeader}>
        <div>
          <div className={styles.tableTitle}>{title}</div>
          <div className={styles.tableSubtitle}>{subtitle}</div>
        </div>
      </div>
      <table>
        <thead>
          <tr>
            <th>No.</th>
            <th>세금계산서번호</th>
            <th>일자</th>
            <th>사업자번호</th>
            <th>거래처</th>
            <th>공급가액</th>
            <th>세액</th>
            <th>합계</th>
            <th>상태</th>
          </tr>
        </thead>
        <tbody>
          {invoices.map((inv, i) => {
            const s = statusLabel(inv.status);
            return (
              <tr key={inv.id}>
                <td>{i + 1}</td>
                <td>{inv.invoiceNo || "-"}</td>
                <td>{new Date(inv.invoiceDate).toLocaleDateString("ko-KR")}</td>
                <td>{inv.bizNo}</td>
                <td>{inv.name}</td>
                <td>{fmt(inv.supplyAmount)}</td>
                <td>{fmt(inv.taxAmount)}</td>
                <td>{fmt(inv.totalAmount)}</td>
                <td>
                  <span className={`${styles.status} ${s.cls}`}>{s.text}</span>
                </td>
              </tr>
            );
          })}
          {invoices.length === 0 && (
            <tr>
              <td colSpan={9} className={styles.emptyRow}>
                해당 분기 세금계산서가 없습니다
              </td>
            </tr>
          )}
          {invoices.length > 0 && (
            <tr className={styles.totalRow}>
              <td colSpan={5}>합계 ({invoices.length}건)</td>
              <td>{fmt(totalSupply)}</td>
              <td>{fmt(totalTax)}</td>
              <td>{fmt(totalSupply + totalTax)}</td>
              <td></td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
