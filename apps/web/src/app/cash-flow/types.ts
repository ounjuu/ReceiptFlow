// 자금 관리 관련 타입, 상수, 헬퍼

export type Tab = "daily" | "cashflow";

export interface DayDetail {
  description: string;
  account: string;
  deposit: number;
  withdraw: number;
}

export interface DailyCashDay {
  date: string;
  prevBalance: number;
  deposit: number;
  withdraw: number;
  balance: number;
  details: DayDetail[];
}

export interface DailyCashReport {
  days: DailyCashDay[];
  openingBalance: number;
  closingBalance: number;
  totalDeposit: number;
  totalWithdraw: number;
}

export interface CashFlowItem {
  name: string;
  amount: number;
}

export interface CashFlowSection {
  items: CashFlowItem[];
  total: number;
}

export interface CashFlowStatement {
  operating: CashFlowSection;
  investing: CashFlowSection;
  financing: CashFlowSection;
  netCashChange: number;
  openingCash: number;
  closingCash: number;
}

export const COLORS = {
  deposit: "#4caf82",
  withdraw: "#d95454",
};

export const fmt = (n: number | null | undefined) => (n ?? 0).toLocaleString();
