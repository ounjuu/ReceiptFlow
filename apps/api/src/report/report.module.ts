import { Module } from "@nestjs/common";
import { ReportController } from "./report.controller";
import { ReportService } from "./report.service";
import { AnomalyService } from "./anomaly.service";

@Module({
  controllers: [ReportController],
  providers: [ReportService, AnomalyService],
})
export class ReportModule {}
