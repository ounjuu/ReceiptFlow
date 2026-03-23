// 경비 정산 관련 타입, 상수, 유틸 함수

export interface Employee {
  id: string;
  name: string;
  employeeNo: string;
  department: string | null;
}

export interface ExpenseItem {
  id?: string;
  category: string;
  description: string;
  amount: number;
  expenseDate: string;
  receiptUrl?: string;
}

export interface ExpenseClaim {
  id: string;
  claimNo: string;
  title: string;
  claimDate: string;
  totalAmount: number;
  status: string;
  memo: string | null;
  employeeId: string;
  employee: Employee;
  items: ExpenseItem[];
  settledAt: string | null;
  journalEntryId: string | null;
  createdAt: string;
}

export interface Summary {
  draft: number;
  pending: number;
  approved: number;
  settled: number;
  rejected: number;
  totalSettled: number;
  totalPending: number;
}

export const CATEGORIES = ["교통비", "식비", "숙박비", "회의비", "사무용품", "기타"];

export const STATUS_LABEL: Record<string, string> = {
  DRAFT: "임시저장",
  PENDING_APPROVAL: "결재중",
  APPROVED: "승인",
  REJECTED: "반려",
  SETTLED: "정산완료",
};

export const STATUS_STYLE: Record<string, string> = {
  DRAFT: "badgeDraft",
  PENDING_APPROVAL: "badgePending",
  APPROVED: "badgeApproved",
  REJECTED: "badgeRejected",
  SETTLED: "badgeSettled",
};

export const fmt = (n: number) => n.toLocaleString();
export const today = () => new Date().toISOString().slice(0, 10);
