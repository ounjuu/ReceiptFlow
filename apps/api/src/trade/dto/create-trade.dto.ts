export class TradeItemDto {
  itemName!: string;
  specification?: string;
  quantity!: number;
  unitPrice!: number;
  note?: string;
}

export class CreateTradeDto {
  tenantId!: string;
  tradeType!: string; // SALES, PURCHASE
  tradeDate!: string;
  dueDate?: string;
  vendorId!: string;
  description?: string;
  note?: string;
  items!: TradeItemDto[];
}
