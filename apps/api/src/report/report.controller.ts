import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { ReportService } from "./report.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";

@UseGuards(JwtAuthGuard)
@Controller("reports")
export class ReportController {
  constructor(private readonly reportService: ReportService) {}

  @Get("trial-balance")
  async trialBalance(
    @Query("tenantId") tenantId: string,
    @Query("startDate") startDate?: string,
    @Query("endDate") endDate?: string,
  ) {
    return this.reportService.trialBalance(tenantId, startDate, endDate);
  }

  @Get("income-statement")
  async incomeStatement(
    @Query("tenantId") tenantId: string,
    @Query("startDate") startDate?: string,
    @Query("endDate") endDate?: string,
  ) {
    return this.reportService.incomeStatement(tenantId, startDate, endDate);
  }

  @Get("balance-sheet")
  async balanceSheet(
    @Query("tenantId") tenantId: string,
    @Query("startDate") startDate?: string,
    @Query("endDate") endDate?: string,
  ) {
    return this.reportService.balanceSheet(tenantId, startDate, endDate);
  }

  @Get("daily-cash")
  async dailyCash(
    @Query("tenantId") tenantId: string,
    @Query("startDate") startDate?: string,
    @Query("endDate") endDate?: string,
  ) {
    return this.reportService.getDailyCashReport(tenantId, startDate, endDate);
  }

  @Get("cash-flow")
  async cashFlow(
    @Query("tenantId") tenantId: string,
    @Query("startDate") startDate?: string,
    @Query("endDate") endDate?: string,
  ) {
    return this.reportService.getCashFlowStatement(tenantId, startDate, endDate);
  }

  @Get("dashboard-kpi")
  async dashboardKpi(@Query("tenantId") tenantId: string) {
    return this.reportService.getDashboardKpi(tenantId);
  }

  @Get("dashboard-summary")
  async dashboardSummary(@Query("tenantId") tenantId: string) {
    return this.reportService.dashboardSummary(tenantId);
  }

  @Get("dashboard-alerts")
  async dashboardAlerts(@Query("tenantId") tenantId: string) {
    return this.reportService.getDashboardAlerts(tenantId);
  }
}
