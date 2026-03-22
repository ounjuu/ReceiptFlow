import { Module } from "@nestjs/common";
import { TradeController } from "./trade.controller";
import { TradeService } from "./trade.service";
import { TradePdfService } from "./trade-pdf.service";

@Module({
  controllers: [TradeController],
  providers: [TradeService, TradePdfService],
})
export class TradeModule {}
