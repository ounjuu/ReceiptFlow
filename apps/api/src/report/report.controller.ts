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
}
