import { API_BASE } from "@/lib/api";
import styles from "./Trades.module.css";

export interface Vendor {
  id: string;
  name: string;
  bizNo: string | null;
}

export interface TradeItem {
  id: string;
  itemName: string;
  specification: string | null;
  quantity: number;
  unitPrice: number;
  amount: number;
  note: string | null;
}

export interface PaymentRecord {
  id: string;
  paymentDate: string;
  amount: number;
  paymentMethod: string;
  note: string | null;
}

export interface Trade {
  id: string;
  tradeType: string;
  tradeNo: string;
  tradeDate: string;
  dueDate: string | null;
  vendor: Vendor;
  supplyAmount: number;
  taxAmount: number;
  totalAmount: number;
  paidAmount: number;
  status: string;
  description: string | null;
  note: string | null;
  items: TradeItem[];
  payments?: PaymentRecord[];
}

export interface TradeSummary {
  sales: { count: number; total: number; paid: number; remaining: number };
  purchase: { count: number; total: number; paid: number; remaining: number };
}

export interface AgingRow {
  id: string;
  tradeNo: string;
  vendorName: string;
  tradeDate: string;
  dueDate: string | null;
  totalAmount: number;
  paidAmount: number;
  remaining: number;
  daysPast: number;
  bucket: string;
}

export interface AgingReport {
  rows: AgingRow[];
  buckets: { current: number; days30: number; days60: number; days90: number };
  total: number;
}

export interface ItemInput {
  itemName: string;
  specification: string;
  quantity: number;
  unitPrice: number;
}

export const fmt = (n: number | null | undefined) => (n ?? 0).toLocaleString();

export const statusLabel = (s: string) => {
  switch (s) {
    case "DRAFT": return { text: "임시", cls: styles.statusDraft };
    case "CONFIRMED": return { text: "확정", cls: styles.statusConfirmed };
    case "PARTIAL_PAID": return { text: "부분수금", cls: styles.statusPartialPaid };
    case "PAID": return { text: "수금완료", cls: styles.statusPaid };
    case "CANCELLED": return { text: "취소", cls: styles.statusCancelled };
    default: return { text: s, cls: "" };
  }
};

export const methodLabel = (m: string) => {
  switch (m) {
    case "CASH": return "현금";
    case "BANK_TRANSFER": return "계좌이체";
    case "CARD": return "카드";
    case "NOTE": return "어음";
    default: return m;
  }
};

export const emptyItem = (): ItemInput => ({
  itemName: "",
  specification: "",
  quantity: 1,
  unitPrice: 0,
});

export const downloadPdf = async (url: string, filename: string) => {
  const token = localStorage.getItem("token");
  const res = await fetch(`${API_BASE}${url}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const blob = await res.blob();
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
};
