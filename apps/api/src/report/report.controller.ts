import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { ReportService } from "./report.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { CurrentTenant } from "../auth/current-tenant.decorator";

@UseGuards(JwtAuthGuard)
@Controller("reports")
export class ReportController {
  constructor(private readonly reportService: ReportService) {}

  @Get("daily-summary")
  async dailySummary(
    @CurrentTenant() tenantId: string,
    @Query("date") date: string,
  ) {
    return this.reportService.dailySummary(tenantId, date);
  }

  @Get("monthly-summary")
  async monthlySummary(
    @CurrentTenant() tenantId: string,
    @Query("year") year: string,
    @Query("month") month: string,
  ) {
    return this.reportService.monthlySummary(tenantId, Number(year), Number(month));
  }

  @Get("account-ledger")
  async accountLedger(
    @CurrentTenant() tenantId: string,
    @Query("accountId") accountId: string,
    @Query("startDate") startDate?: string,
    @Query("endDate") endDate?: string,
  ) {
    return this.reportService.accountLedger(tenantId, accountId, startDate, endDate);
  }

  @Get("general-ledger")
  async generalLedger(
    @CurrentTenant() tenantId: string,
    @Query("startDate") startDate?: string,
    @Query("endDate") endDate?: string,
    @Query("accountId") accountId?: string,
  ) {
    return this.reportService.generalLedger(tenantId, startDate, endDate, accountId);
  }

  @Get("trial-balance")
  async trialBalance(
    @CurrentTenant() tenantId: string,
    @Query("startDate") startDate?: string,
    @Query("endDate") endDate?: string,
  ) {
    return this.reportService.trialBalance(tenantId, startDate, endDate);
  }

  @Get("income-statement")
  async incomeStatement(
    @CurrentTenant() tenantId: string,
    @Query("startDate") startDate?: string,
    @Query("endDate") endDate?: string,
  ) {
    return this.reportService.incomeStatement(tenantId, startDate, endDate);
  }

  @Get("balance-sheet")
  async balanceSheet(
    @CurrentTenant() tenantId: string,
    @Query("startDate") startDate?: string,
    @Query("endDate") endDate?: string,
  ) {
    return this.reportService.balanceSheet(tenantId, startDate, endDate);
  }

  @Get("daily-cash")
  async dailyCash(
    @CurrentTenant() tenantId: string,
    @Query("startDate") startDate?: string,
    @Query("endDate") endDate?: string,
  ) {
    return this.reportService.getDailyCashReport(tenantId, startDate, endDate);
  }

  @Get("cash-flow")
  async cashFlow(
    @CurrentTenant() tenantId: string,
    @Query("startDate") startDate?: string,
    @Query("endDate") endDate?: string,
  ) {
    return this.reportService.getCashFlowStatement(tenantId, startDate, endDate);
  }

  @Get("dashboard-kpi")
  async dashboardKpi(@CurrentTenant() tenantId: string) {
    return this.reportService.getDashboardKpi(tenantId);
  }

  @Get("dashboard-summary")
  async dashboardSummary(@CurrentTenant() tenantId: string) {
    return this.reportService.dashboardSummary(tenantId);
  }

  @Get("dashboard-alerts")
  async dashboardAlerts(@CurrentTenant() tenantId: string) {
    return this.reportService.getDashboardAlerts(tenantId);
  }

  @Get("cash-book")
  async cashBook(
    @CurrentTenant() tenantId: string,
    @Query("startDate") startDate?: string,
    @Query("endDate") endDate?: string,
  ) {
    return this.reportService.cashBook(tenantId, startDate, endDate);
  }

  @Get("journal-book")
  async journalBook(
    @CurrentTenant() tenantId: string,
    @Query("startDate") startDate?: string,
    @Query("endDate") endDate?: string,
  ) {
    return this.reportService.journalBook(tenantId, startDate, endDate);
  }
}
