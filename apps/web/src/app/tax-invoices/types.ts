import { API_BASE } from "@/lib/api";
import styles from "./TaxInvoices.module.css";

export interface Vendor {
  id: string;
  name: string;
  bizNo: string | null;
}

export interface TaxInvoice {
  id: string;
  invoiceType: string;
  invoiceNo: string | null;
  invoiceDate: string;
  status: string;
  issuerBizNo: string;
  issuerName: string;
  recipientBizNo: string;
  recipientName: string;
  supplyAmount: string;
  taxAmount: string;
  totalAmount: string;
  approvalNo: string | null;
  description: string | null;
  vendor: Vendor | null;
  hometaxSyncStatus: "IMPORTED" | "EXPORTED" | "VERIFIED" | null;
}

export interface TaxSummary {
  year: number;
  quarter: number;
  purchase: { count: number; supplyAmount: number; taxAmount: number };
  sales: { count: number; supplyAmount: number; taxAmount: number };
  netTaxAmount: number;
}

export function statusLabel(status: string) {
  switch (status) {
    case "DRAFT": return { text: "임시", cls: styles.statusDraft };
    case "PENDING_APPROVAL": return { text: "결재중", cls: styles.statusPending };
    case "APPROVED": return { text: "승인", cls: styles.statusApproved };
    case "FINALIZED": return { text: "확정", cls: styles.statusFinalized };
    default: return { text: status, cls: "" };
  }
}

export function typeLabel(type: string) {
  return type === "PURCHASE"
    ? { text: "매입", cls: styles.typePurchase }
    : { text: "매출", cls: styles.typeSales };
}

// 홈택스 동기화 상태 뱃지
export function hometaxBadge(status: string | null) {
  switch (status) {
    case "IMPORTED": return { text: "가져옴", cls: styles.hometaxImported };
    case "EXPORTED": return { text: "내보냄", cls: styles.hometaxExported };
    case "VERIFIED": return { text: "검증됨", cls: styles.hometaxVerified };
    default: return null;
  }
}

/** 인증 헤더 포함 파일 다운로드 */
export async function downloadFileWithAuth(url: string, filename: string) {
  const token = localStorage.getItem("token");
  const res = await fetch(`${API_BASE}${url}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new Error("다운로드 실패");
  const blob = await res.blob();
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

export function nextStatus(current: string): { label: string; next: string } | null {
  switch (current) {
    case "DRAFT": return { label: "승인", next: "APPROVED" };
    case "APPROVED": return { label: "확정", next: "FINALIZED" };
    default: return null;
  }
}
