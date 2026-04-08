import styles from "./Projects.module.css";

export interface Project {
  id: string;
  code: string;
  name: string;
  description: string | null;
  status: string;
  startDate: string;
  endDate: string | null;
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
  status: string;
  budget: number | null;
  totalRevenue: number;
  totalExpense: number;
  netIncome: number;
  profitMargin: number;
}

export const fmt = (n: number | null | undefined) => (n ?? 0).toLocaleString();

export const statusLabel = (s: string) => {
  switch (s) {
    case "ACTIVE": return { text: "진행중", cls: styles.statusActive };
    case "COMPLETED": return { text: "완료", cls: styles.statusCompleted };
    case "ON_HOLD": return { text: "보류", cls: styles.statusOnHold };
    default: return { text: s, cls: "" };
  }
};
