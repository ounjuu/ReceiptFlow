export class CreateInventoryTxDto {
  tenantId!: string;
  txType!: string; // IN | OUT | ADJUST
  txDate!: string; // YYYY-MM-DD
  productId!: string;
  quantity!: number;
  unitCost!: number;
  reason?: string;
  tradeId?: string;
}
