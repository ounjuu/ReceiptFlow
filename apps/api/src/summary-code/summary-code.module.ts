import { Module } from "@nestjs/common";
import { SummaryCodeController } from "./summary-code.controller";
import { SummaryCodeService } from "./summary-code.service";

@Module({
  controllers: [SummaryCodeController],
  providers: [SummaryCodeService],
  exports: [SummaryCodeService],
})
export class SummaryCodeModule {}
