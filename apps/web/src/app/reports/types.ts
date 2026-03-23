// --- 타입 ---

export type Tab = "trial-balance" | "income-statement" | "balance-sheet";

export interface TrialRow {
  code: string;
  name: string;
  type: string;
  debit: number;
  credit: number;
  balance: number;
}

export interface TrialBalance {
  rows: TrialRow[];
  totalDebit: number;
  totalCredit: number;
}

export interface IncomeRow extends TrialRow {
  amount: number;
}

export interface IncomeStatement {
  revenue: IncomeRow[];
  totalRevenue: number;
  expense: IncomeRow[];
  totalExpense: number;
  netIncome: number;
}

export interface BalanceRow extends TrialRow {
  amount: number;
}

export interface BalanceSheet {
  currentAssets: BalanceRow[];
  totalCurrentAssets: number;
  nonCurrentAssets: BalanceRow[];
  totalNonCurrentAssets: number;
  totalAssets: number;
  currentLiabilities: BalanceRow[];
  totalCurrentLiabilities: number;
  nonCurrentLiabilities: BalanceRow[];
  totalNonCurrentLiabilities: number;
  totalLiabilities: number;
  equity: BalanceRow[];
  totalEquity: number;
  retainedEarnings: number;
  totalLiabilitiesAndEquity: number;
  isBalanced: boolean;
}

// --- 상수 ---

export const tabs: { key: Tab; label: string }[] = [
  { key: "trial-balance", label: "시산표" },
  { key: "income-statement", label: "손익계산서" },
  { key: "balance-sheet", label: "재무상태표" },
];

// --- 헬퍼 ---

export const fmt = (n: number) => n.toLocaleString();
