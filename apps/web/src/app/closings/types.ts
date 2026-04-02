export interface PeriodSummary {
  total: number;
  posted: number;
  draft: number;
  approved: number;
  unposted: number;
}

export interface AccountingPeriod {
  id: string;
  year: number;
  month: number;
  status: string;
  closedAt: string | null;
  closedBy: string | null;
}

export interface CarryForwardSummary {
  assetBalance: number;
  liabilityBalance: number;
  equityBalance: number;
  netIncome: number;
}

export interface CarryForwardResult {
  carryForwardEntry: unknown | null;
  profitClosingEntry: unknown | null;
  summary: CarryForwardSummary;
}
