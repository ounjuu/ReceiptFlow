// 자금 관리 관련 타입, 상수, 헬퍼

export type Tab = "daily" | "cashflow" | "forecast";

export interface CashForecastHistory {
  month: string;
  inflow: number;
  outflow: number;
  net: number;
}

export interface CashForecastFuture {
  month: string;
  inflow: number;
  outflow: number;
  net: number;
  balance: number;
}

export interface CashForecast {
  currentBalance: number;
  history: CashForecastHistory[];
  forecast: CashForecastFuture[];
  avgInflow: number;
  avgOutflow: number;
  avgNet: number;
}

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

export { fmt, today } from "@/lib/formatters";
