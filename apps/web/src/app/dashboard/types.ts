// 대시보드 관련 인터페이스, 상수, 헬퍼 함수

export interface DashboardSummary {
  monthlyExpense: { month: string; total: number }[];
  statusCounts: { status: string; count: number }[];
  topVendors: { name: string; total: number }[];
  totalRevenue: number;
  totalExpense: number;
  netIncome: number;
  journalTypeCounts?: { type: string; count: number }[];
  journalStatusCounts?: { status: string; count: number }[];
}

export interface DashboardAlerts {
  draftCount: number;
  approvedCount: number;
  pendingDocCount: number;
  closing: { year: number; month: number; isClosed: boolean; daysUntilMonthEnd: number };
  recentLogs: {
    id: string;
    action: string;
    description: string | null;
    createdAt: string;
    userName: string;
  }[];
}

export interface DashboardKpi {
  trades: { salesTotal: number; salesRemaining: number; purchaseTotal: number; purchaseRemaining: number };
  bankBalance: number;
  expenseClaims: { pendingCount: number; pendingAmount: number };
  inventory: { lowStockCount: number };
  approvals: { pendingCount: number };
  budget: { year: number; totalBudget: number };
}

export interface BudgetVsActual {
  rows: { accountName: string; budget: number; actual: number; variance: number; rate: number }[];
  totalBudget: number;
  totalActual: number;
  totalVariance: number;
  totalRate: number;
}

export interface JournalEntry {
  id: string;
  journalType: string;
  date: string;
  description: string | null;
  status: string;
  lines: { debit: string; credit: string; account: { name: string } }[];
}

export const JOURNAL_TYPE_LABELS: Record<string, string> = {
  GENERAL: "일반전표",
  PURCHASE: "매입전표",
  SALES: "매출전표",
  CASH: "현금전표",
};

export const JOURNAL_TYPE_COLORS: Record<string, string> = {
  GENERAL: "#7c5cbf",
  PURCHASE: "#e5a336",
  SALES: "#4caf82",
  CASH: "#5b9bd5",
};

export const JOURNAL_STATUS_COLORS: Record<string, string> = {
  DRAFT: "#e5a336",
  APPROVED: "#7c5cbf",
  POSTED: "#4caf82",
};

export const JOURNAL_STATUS_LABELS: Record<string, string> = {
  DRAFT: "임시저장",
  APPROVED: "승인",
  POSTED: "전기",
};

export interface PendingApproval {
  id: string;
  documentType: string;
  status: string;
  currentStep: number;
  totalSteps: number;
  submittedBy: string;
  createdAt: string;
}

export interface AlertItem {
  type: string;
  icon: string;
  message: string;
  href: string;
}

export interface PieDataEntry {
  name: string;
  value: number;
  color: string;
}

export interface BudgetChartEntry {
  name: string;
  예산: number;
  실적: number;
  집행률: number;
}

export const COLORS = {
  primary: "#7c5cbf",
  primaryLight: "#ede8f5",
  success: "#4caf82",
  danger: "#d95454",
  warning: "#e5a336",
  muted: "#8578a0",
};

export const STATUS_MAP_KEYS: Record<string, { labelKey: "docStatus_PENDING" | "docStatus_OCR_DONE" | "docStatus_JOURNAL_CREATED"; color: string }> = {
  PENDING: { labelKey: "docStatus_PENDING", color: COLORS.warning },
  OCR_DONE: { labelKey: "docStatus_OCR_DONE", color: COLORS.primary },
  JOURNAL_CREATED: { labelKey: "docStatus_JOURNAL_CREATED", color: COLORS.success },
};

export const JOURNAL_STATUS_KEYS: Record<string, "status_DRAFT" | "status_APPROVED" | "status_POSTED"> = {
  DRAFT: "status_DRAFT",
  APPROVED: "status_APPROVED",
  POSTED: "status_POSTED",
};

export const DOC_TYPE_LABEL: Record<string, string> = {
  JOURNAL: "전표",
  TAX_INVOICE: "세금계산서",
};

export const ACTION_LABELS: Record<string, string> = {
  JOURNAL_CREATED: "전표 생성",
  JOURNAL_UPDATED: "전표 수정",
  JOURNAL_STATUS_CHANGED: "상태 변경",
  JOURNAL_DELETED: "전표 삭제",
  JOURNAL_BATCH_STATUS: "일괄 변경",
  PERIOD_CLOSED: "월 마감",
  PERIOD_REOPENED: "마감 취소",
};

export const fmt = (n: number | null | undefined) => (n ?? 0).toLocaleString();

export function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "방금 전";
  if (minutes < 60) return `${minutes}분 전`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}시간 전`;
  const days = Math.floor(hours / 24);
  return `${days}일 전`;
}
