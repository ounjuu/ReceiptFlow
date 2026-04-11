import { Injectable } from "@nestjs/common";
import { LedgerReportService } from "./ledger-report.service";
import { FinancialReportService } from "./financial-report.service";
import { DashboardReportService } from "./dashboard-report.service";

// 타입 재export (기존 import 호환)
export { TrialBalanceRow } from "./report.types";

@Injectable()
export class ReportService {
  constructor(
    private readonly ledgerReport: LedgerReportService,
    private readonly financialReport: FinancialReportService,
    private readonly dashboardReport: DashboardReportService,
  ) {}

  // === 장부/기본보고서 (LedgerReportService 위임) ===

  trialBalance(tenantId: string, startDate?: string, endDate?: string) {
    return this.ledgerReport.trialBalance(tenantId, startDate, endDate);
  }

  dailySummary(tenantId: string, date: string) {
    return this.ledgerReport.dailySummary(tenantId, date);
  }

  monthlySummary(tenantId: string, year: number, month: number) {
    return this.ledgerReport.monthlySummary(tenantId, year, month);
  }

  generalLedger(tenantId: string, startDate?: string, endDate?: string, accountId?: string) {
    return this.ledgerReport.generalLedger(tenantId, startDate, endDate, accountId);
  }

  accountLedger(tenantId: string, accountId: string, startDate?: string, endDate?: string) {
    return this.ledgerReport.accountLedger(tenantId, accountId, startDate, endDate);
  }

  journalBook(tenantId: string, startDate?: string, endDate?: string) {
    return this.ledgerReport.journalBook(tenantId, startDate, endDate);
  }

  cashBook(tenantId: string, startDate?: string, endDate?: string) {
    return this.ledgerReport.cashBook(tenantId, startDate, endDate);
  }

  // === 재무제표/비교/현금 (FinancialReportService 위임) ===

  incomeStatement(tenantId: string, startDate?: string, endDate?: string) {
    return this.financialReport.incomeStatement(tenantId, startDate, endDate);
  }

  balanceSheet(tenantId: string, startDate?: string, endDate?: string) {
    return this.financialReport.balanceSheet(tenantId, startDate, endDate);
  }

  comparativeIncomeStatement(
    tenantId: string,
    currentStart: string,
    currentEnd: string,
    previousStart: string,
    previousEnd: string,
  ) {
    return this.financialReport.comparativeIncomeStatement(
      tenantId, currentStart, currentEnd, previousStart, previousEnd,
    );
  }

  comparativeBalanceSheet(tenantId: string, currentEnd: string, previousEnd: string) {
    return this.financialReport.comparativeBalanceSheet(tenantId, currentEnd, previousEnd);
  }

  getDailyCashReport(tenantId: string, startDate?: string, endDate?: string) {
    return this.financialReport.getDailyCashReport(tenantId, startDate, endDate);
  }

  getCashFlowStatement(tenantId: string, startDate?: string, endDate?: string) {
    return this.financialReport.getCashFlowStatement(tenantId, startDate, endDate);
  }

  getCashForecast(tenantId: string, monthsAhead?: number) {
    return this.financialReport.getCashForecast(tenantId, monthsAhead);
  }

  vendorSummary(tenantId: string, startDate?: string, endDate?: string) {
    return this.financialReport.vendorSummary(tenantId, startDate, endDate);
  }

  depreciationSchedule(tenantId: string, year: number) {
    return this.financialReport.depreciationSchedule(tenantId, year);
  }

  // === 대시보드 (DashboardReportService 위임) ===

  dashboardSummary(tenantId: string) {
    return this.dashboardReport.dashboardSummary(tenantId);
  }

  getDashboardAlerts(tenantId: string) {
    return this.dashboardReport.getDashboardAlerts(tenantId);
  }

  getDashboardKpi(tenantId: string) {
    return this.dashboardReport.getDashboardKpi(tenantId);
  }
}
