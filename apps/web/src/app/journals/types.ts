import styles from "./Journals.module.css";

export interface Account {
  id: string;
  code: string;
  name: string;
  type: string;
}

export interface Vendor {
  id: string;
  name: string;
  bizNo: string | null;
}

export interface ProjectOption {
  id: string;
  code: string;
  name: string;
}

export interface DepartmentOption {
  id: string;
  code: string;
  name: string;
}

export interface JournalLine {
  debit: string;
  credit: string;
  account: { id: string; code: string; name: string };
  vendor: { id: string; name: string; bizNo: string | null } | null;
  project: { id: string; code: string; name: string } | null;
  department: { id: string; code: string; name: string } | null;
}

export interface JournalAttachment {
  id: string;
  filename: string;
  url: string;
  createdAt: string;
}

export interface JournalEntry {
  id: string;
  journalNumber: string | null;
  journalType: string;
  evidenceType: string | null;
  supplyAmount: string | null;
  vatAmount: string | null;
  date: string;
  description: string | null;
  status: string;
  currency: string;
  exchangeRate: string;
  documentId: string | null;
  lines: JournalLine[];
  attachments?: JournalAttachment[];
}

export interface LineInput {
  accountId: string;
  vendorBizNo: string;
  vendorName: string;
  vendorId: string; // 기존 거래처 매칭 시
  projectId: string;
  departmentId: string;
  debit: number;
  credit: number;
}

export function statusLabel(status: string) {
  switch (status) {
    case "DRAFT": return { text: "임시", cls: styles.statusDraft };
    case "PENDING_APPROVAL": return { text: "결재중", cls: styles.statusPending };
    case "APPROVED": return { text: "승인", cls: styles.statusApproved };
    case "POSTED": return { text: "확정", cls: styles.statusPosted };
    default: return { text: status, cls: "" };
  }
}

export const CURRENCY_SYMBOLS: Record<string, string> = {
  KRW: "₩",
  USD: "$",
  EUR: "€",
  JPY: "¥",
  CNY: "¥",
  GBP: "£",
};

export const JOURNAL_TYPES = [
  { code: "GENERAL", name: "일반전표" },
  { code: "PURCHASE", name: "매입전표" },
  { code: "SALES", name: "매출전표" },
  { code: "CASH", name: "자금전표" },
] as const;

export function journalTypeLabel(type: string) {
  switch (type) {
    case "GENERAL": return "일반";
    case "PURCHASE": return "매입";
    case "SALES": return "매출";
    case "CASH": return "자금";
    default: return type;
  }
}

export const EVIDENCE_TYPES = [
  { code: "TAX_INVOICE", name: "세금계산서" },
  { code: "CARD", name: "신용카드" },
  { code: "CASH_RECEIPT", name: "현금영수증" },
  { code: "NONE", name: "없음" },
] as const;

export const CURRENCY_OPTIONS = [
  { code: "KRW", name: "원 (KRW)" },
  { code: "USD", name: "달러 (USD)" },
  { code: "EUR", name: "유로 (EUR)" },
  { code: "JPY", name: "엔 (JPY)" },
  { code: "CNY", name: "위안 (CNY)" },
  { code: "GBP", name: "파운드 (GBP)" },
];

export const emptyLine = (): LineInput => ({
  accountId: "",
  vendorBizNo: "",
  vendorName: "",
  vendorId: "",
  projectId: "",
  departmentId: "",
  debit: 0,
  credit: 0,
});
