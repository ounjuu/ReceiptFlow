import { TradeItemDto } from "./create-trade.dto";

export class UpdateTradeDto {
  tradeDate?: string;
  dueDate?: string;
  description?: string;
  note?: string;
  items?: TradeItemDto[];
}
