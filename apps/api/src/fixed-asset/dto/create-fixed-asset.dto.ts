export class CreateFixedAssetDto {
  tenantId!: string;
  name!: string;
  description?: string;
  assetAccountId!: string;
  depreciationAccountId!: string;
  accumulatedDepAccountId!: string;
  acquisitionDate!: string; // ISO 날짜
  acquisitionCost!: number;
  usefulLifeMonths!: number;
  residualValue?: number;
  depreciationMethod!: string; // STRAIGHT_LINE, DECLINING_BALANCE
}
