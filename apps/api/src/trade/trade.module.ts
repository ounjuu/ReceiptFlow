import { Module } from "@nestjs/common";
import { TradeController } from "./trade.controller";
import { TradeService } from "./trade.service";
import { TradePdfService } from "./trade-pdf.service";
import { JournalModule } from "../journal/journal.module";

@Module({
  imports: [JournalModule],
  controllers: [TradeController],
  providers: [TradeService, TradePdfService],
})
export class TradeModule {}
