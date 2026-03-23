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
