export interface Vendor {
  id: string;
  name: string;
  bizNo: string | null;
  creditRating: string | null;
  creditLimit: string;
  note: string | null;
  createdAt: string;
}

export const CREDIT_RATINGS = [
  { code: "A", name: "A - 우수" },
  { code: "B", name: "B - 양호" },
  { code: "C", name: "C - 보통" },
  { code: "D", name: "D - 주의" },
] as const;

export function creditRatingLabel(code: string | null) {
  if (!code) return "-";
  return CREDIT_RATINGS.find((r) => r.code === code)?.name || code;
}

export function creditRatingColor(code: string | null) {
  switch (code) {
    case "A": return "#16a34a";
    case "B": return "#2563eb";
    case "C": return "#d97706";
    case "D": return "#dc2626";
    default: return "#6b7280";
  }
}

export interface ImportResult {
  total: number;
  success: number;
  failed: number;
  results: { index: number; status: string; error?: string }[];
}
