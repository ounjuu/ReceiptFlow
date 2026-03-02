import { Controller, Get, Query } from "@nestjs/common";
import { ReportService } from "./report.service";

@Controller("reports")
export class ReportController {
  constructor(private readonly reportService: ReportService) {}

  @Get("trial-balance")
  async trialBalance(@Query("tenantId") tenantId: string) {
    return this.reportService.trialBalance(tenantId);
  }

  @Get("income-statement")
  async incomeStatement(@Query("tenantId") tenantId: string) {
    return this.reportService.incomeStatement(tenantId);
  }

  @Get("balance-sheet")
  async balanceSheet(@Query("tenantId") tenantId: string) {
    return this.reportService.balanceSheet(tenantId);
  }
}
