import { Module } from "@nestjs/common";
import { ReportController } from "./report.controller";
import { ReportService } from "./report.service";
import { LedgerReportService } from "./ledger-report.service";
import { FinancialReportService } from "./financial-report.service";
import { DashboardReportService } from "./dashboard-report.service";
import { AnomalyService } from "./anomaly.service";

@Module({
  controllers: [ReportController],
  providers: [
    ReportService,
    LedgerReportService,
    FinancialReportService,
    DashboardReportService,
    AnomalyService,
  ],
})
export class ReportModule {}
