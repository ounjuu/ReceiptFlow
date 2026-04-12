export interface BudgetItem {
  id: string;
  accountId: string;
  accountCode: string;
  accountName: string;
  accountType: string;
  year: number;
  month: number;
  amount: number;
  note: string | null;
}

export interface AccountOption {
  id: string;
  code: string;
  name: string;
  type: string;
}

export interface VsActualRow {
  accountId: string;
  accountCode: string;
  accountName: string;
  budget: number;
  actual: number;
  variance: number;
  rate: number;
}

export interface VsActualData {
  rows: VsActualRow[];
  totalBudget: number;
  totalActual: number;
  totalVariance: number;
  totalRate: number;
}

export interface BudgetGridRow {
  accountId: string;
  code: string;
  name: string;
  months: Record<number, { id: string; amount: number }>;
}


export const now = new Date();

export const getRateColor = (rate: number, styles: Record<string, string>) => {
  if (rate > 100) return styles.rateDanger;
  if (rate > 80) return styles.rateWarning;
  return styles.rateNormal;
};

export const getProgressColor = (rate: number) => {
  if (rate > 100) return "#ef4444";
  if (rate > 80) return "#f59e0b";
  return "#22c55e";
};

export { fmt, today } from "@/lib/formatters";
