import styles from "./Documents.module.css";

export interface Vendor {
  id: string;
  name: string;
  bizNo: string | null;
}

export type InputTab = "upload" | "manual";

export interface JournalLine {
  debit: string;
  credit: string;
  account: { code: string; name: string };
}

export interface JournalEntry {
  id: string;
  lines: JournalLine[];
}

export interface Document {
  id: string;
  vendorName: string | null;
  transactionAt: string | null;
  totalAmount: string | null;
  currency: string;
  status: string;
  imageUrl: string | null;
  createdAt: string;
  journalEntry: JournalEntry | null;
}

export const CURRENCY_SYMBOLS: Record<string, string> = {
  KRW: "₩", USD: "$", EUR: "€", JPY: "¥", CNY: "¥", GBP: "£",
};

export const CURRENCY_OPTIONS = [
  { code: "KRW", name: "원 (KRW)" },
  { code: "USD", name: "달러 (USD)" },
  { code: "EUR", name: "유로 (EUR)" },
  { code: "JPY", name: "엔 (JPY)" },
  { code: "CNY", name: "위안 (CNY)" },
  { code: "GBP", name: "파운드 (GBP)" },
];

export interface OcrData {
  raw_text: string;
  vendor_name: string | null;
  total_amount: number | null;
  transaction_date: string | null;
  confidence: number;
}

export interface CreateResult {
  document: Document;
  journalEntry: JournalEntry | null;
  classification: {
    accountCode: string;
    accountName: string;
    confidence: number;
  } | null;
  ocr?: OcrData;
}

export interface BatchItem {
  index: number;
  filename: string;
  status: "success" | "error";
  document?: Document;
  ocr?: OcrData;
  error?: string;
}

export interface BatchResult {
  total: number;
  success: number;
  failed: number;
  results: BatchItem[];
}

export function statusLabel(status: string) {
  switch (status) {
    case "PENDING": return { text: "대기", cls: styles.statusPending };
    case "OCR_DONE": return { text: "OCR 완료", cls: styles.statusOcr };
    case "JOURNAL_CREATED": return { text: "전표 생성", cls: styles.statusJournal };
    default: return { text: status, cls: "" };
  }
}
