import { Module } from "@nestjs/common";
import { YearEndSettlementController } from "./year-end-settlement.controller";
import { YearEndSettlementService } from "./year-end-settlement.service";

@Module({
  controllers: [YearEndSettlementController],
  providers: [YearEndSettlementService],
})
export class YearEndSettlementModule {}
