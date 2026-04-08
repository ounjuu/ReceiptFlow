export interface Department {
  id: string;
  code: string;
  name: string;
  description: string | null;
  manager: string | null;
  budget: number | null;
}

export interface PnLAccount {
  code: string;
  name: string;
  amount: number;
}

export interface PnLResult {
  revenue: PnLAccount[];
  totalRevenue: number;
  expense: PnLAccount[];
  totalExpense: number;
  netIncome: number;
  profitMargin: number;
}

export interface ComparisonRow {
  id: string;
  code: string;
  name: string;
  manager: string | null;
  budget: number | null;
  totalRevenue: number;
  totalExpense: number;
  netIncome: number;
  profitMargin: number;
}

export const fmt = (n: number | null | undefined) => (n ?? 0).toLocaleString();
